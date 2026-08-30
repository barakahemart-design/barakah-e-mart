import crypto from "crypto";
import { 
  Firestore, 
  doc, 
  getDoc, 
  setDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";

export interface StorePinCredentials {
  id: string; // "cred_..."
  store_id: string; // canonical store identifier (e.g. "barakahemart@gmail.com")
  admin_pin_hash: string;
  admin_pin_updated_at?: string;
  sales_pin_hash: string;
  sales_pin_updated_at?: string;
  created_at: string;
  updated_at: string;
  version: number;
}

// In-memory brute force protection tracking
// Key: `${store_id}:${role}:${ip}` -> { attempts: number, lockedUntil: number }
interface RateLimitEntry {
  attempts: number;
  lockedUntil: number;
  lastAttempt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const inMemoryCredsCache = new Map<string, StorePinCredentials>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds lockout
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes attempt window

/**
 * Derives a secure scrypt password hash using Node's standard crypto module.
 * Formatted as: `scrypt:v1:<salt_hex>:<derived_key_hex>`
 */
export function hashPin(pin: string): string {
  if (!pin || typeof pin !== "string") {
    throw new Error("Invalid PIN provided for hashing");
  }
  const cleanPin = pin.trim();
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(cleanPin, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024
  });
  return `scrypt:v1:${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Constant-time verification of an entered PIN against a stored scrypt hash.
 */
export function verifyPinAgainstHash(enteredPin: string, storedHashStr: string): boolean {
  if (!enteredPin || !storedHashStr || typeof enteredPin !== "string" || typeof storedHashStr !== "string") {
    return false;
  }
  try {
    const parts = storedHashStr.split(":");
    if (parts.length !== 4 || parts[0] !== "scrypt" || parts[1] !== "v1") {
      return false;
    }
    const salt = parts[2];
    const expectedKeyHex = parts[3];
    const cleanPin = enteredPin.trim();

    const derivedKey = crypto.scryptSync(cleanPin, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024
    });
    const derivedKeyHex = derivedKey.toString("hex");

    if (derivedKeyHex.length !== expectedKeyHex.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(derivedKeyHex, "hex"),
      Buffer.from(expectedKeyHex, "hex")
    );
  } catch (err) {
    return false;
  }
}

/**
 * Formats a canonical credential document ID from the store ID.
 */
export function getCredentialDocId(storeId: string): string {
  const clean = (storeId || "").trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
  return `cred_${clean}`;
}

/**
 * Loads store PIN credentials from Firestore or server cache.
 */
export async function getStorePinCredentials(
  db: Firestore, 
  storeId: string
): Promise<StorePinCredentials | null> {
  const cleanStoreId = (storeId || "").trim().toLowerCase();
  if (!cleanStoreId) return null;

  if (inMemoryCredsCache.has(cleanStoreId)) {
    return inMemoryCredsCache.get(cleanStoreId)!;
  }

  const docId = getCredentialDocId(cleanStoreId);
  try {
    const docRef = doc(db, "store_auth_credentials", docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as StorePinCredentials;
      inMemoryCredsCache.set(cleanStoreId, data);
      return data;
    }
  } catch (err) {
    console.warn(`[pinAuthService] Error fetching store credentials for ${cleanStoreId}:`, err);
  }
  return null;
}

/**
 * Persists store PIN credentials containing ONLY hashes to Firestore and server cache.
 */
export async function saveStorePinCredentials(
  db: Firestore, 
  creds: StorePinCredentials
): Promise<void> {
  const cleanStoreId = (creds.store_id || "").trim().toLowerCase();
  if (!cleanStoreId) throw new Error("Missing store_id in credential record");

  const docId = getCredentialDocId(cleanStoreId);
  const record: StorePinCredentials = {
    id: docId,
    store_id: cleanStoreId,
    admin_pin_hash: creds.admin_pin_hash,
    admin_pin_updated_at: creds.admin_pin_updated_at || new Date().toISOString(),
    sales_pin_hash: creds.sales_pin_hash,
    sales_pin_updated_at: creds.sales_pin_updated_at || new Date().toISOString(),
    created_at: creds.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1
  };

  inMemoryCredsCache.set(cleanStoreId, record);

  try {
    const docRef = doc(db, "store_auth_credentials", docId);
    await setDoc(docRef, record, { merge: true });
  } catch (err) {
    console.warn(`[pinAuthService] Notice writing credential record to Firestore:`, err);
  }
}

/**
 * Migration routine: Reads legacy PINs once, hashes them, and stores the hash record.
 * Never stores or returns plaintext PINs. Never logs plaintext PINs.
 */
export async function migrateStorePinsServerSide(
  db: Firestore,
  storeId: string,
  providedAdminPin?: string,
  providedSalesPin?: string
): Promise<{ success: boolean; migrated: boolean; store_id: string; message: string }> {
  const cleanStoreId = (storeId || "").trim().toLowerCase();
  if (!cleanStoreId) {
    return { success: false, migrated: false, store_id: "", message: "Invalid store_id" };
  }

  const existing = await getStorePinCredentials(db, cleanStoreId);
  let adminPinToHash = providedAdminPin;
  let salesPinToHash = providedSalesPin;

  // If not provided in request, attempt one-time read from existing server-side legacy sync records
  if (!adminPinToHash || !salesPinToHash) {
    try {
      const syncsQ = query(collection(db, "passcode_syncs"), where("linked_email", "==", cleanStoreId));
      const syncsSnap = await getDocs(syncsQ);
      if (!syncsSnap.empty) {
        const syncData = syncsSnap.docs[0].data();
        const biz = syncData.businessInfo || syncData.business_info || {};
        if (!adminPinToHash && biz.adminPasscode) {
          adminPinToHash = String(biz.adminPasscode);
        }
        if (!salesPinToHash && biz.salesPasscode) {
          salesPinToHash = String(biz.salesPasscode);
        }
      }
    } catch (_) {}
  }

  // Fallback to default store PINs if completely empty during initial migration
  const finalAdminPin = (adminPinToHash || (existing ? null : "1234"))?.trim();
  const finalSalesPin = (salesPinToHash || (existing ? null : "5555"))?.trim();

  const now = new Date().toISOString();
  const newCreds: StorePinCredentials = {
    id: getCredentialDocId(cleanStoreId),
    store_id: cleanStoreId,
    admin_pin_hash: finalAdminPin ? hashPin(finalAdminPin) : (existing?.admin_pin_hash || hashPin("1234")),
    admin_pin_updated_at: finalAdminPin ? now : existing?.admin_pin_updated_at,
    sales_pin_hash: finalSalesPin ? hashPin(finalSalesPin) : (existing?.sales_pin_hash || hashPin("5555")),
    sales_pin_updated_at: finalSalesPin ? now : existing?.sales_pin_updated_at,
    created_at: existing?.created_at || now,
    updated_at: now,
    version: 1
  };

  await saveStorePinCredentials(db, newCreds);

  return {
    success: true,
    migrated: true,
    store_id: cleanStoreId,
    message: "Store PIN credentials securely migrated to scrypt hashed storage."
  };
}

/**
 * Server-side verification of store_id + role + entered PIN against the stored scrypt hash.
 * Includes rate-limiting and brute-force protection.
 */
export async function verifyStorePin(
  db: Firestore,
  storeId: string,
  role: "admin" | "sales",
  enteredPin: string,
  clientIp: string = "unknown"
): Promise<{ valid: boolean; error?: string; rateLimited?: boolean }> {
  const cleanStoreId = (storeId || "").trim().toLowerCase();
  if (!cleanStoreId || !role || !enteredPin) {
    return { valid: false, error: "Missing store_id, role, or PIN" };
  }

  const rateLimitKey = `${cleanStoreId}:${role}:${clientIp}`;
  const now = Date.now();
  const rateEntry = rateLimitMap.get(rateLimitKey) || { attempts: 0, lockedUntil: 0, lastAttempt: now };

  // Check if locked out
  if (rateEntry.lockedUntil > now) {
    const remainingSec = Math.ceil((rateEntry.lockedUntil - now) / 1000);
    return {
      valid: false,
      rateLimited: true,
      error: `Too many failed attempts. Please wait ${remainingSec} seconds.`
    };
  }

  // Reset attempt count if window has passed
  if (now - rateEntry.lastAttempt > ATTEMPT_WINDOW_MS) {
    rateEntry.attempts = 0;
  }

  let creds = await getStorePinCredentials(db, cleanStoreId);
  if (!creds) {
    // Perform auto-migration if legacy store exists
    await migrateStorePinsServerSide(db, cleanStoreId);
    creds = await getStorePinCredentials(db, cleanStoreId);
  }

  if (!creds) {
    return { valid: false, error: "Store credentials not initialized" };
  }

  const targetHash = role === "admin" ? creds.admin_pin_hash : creds.sales_pin_hash;
  if (!targetHash) {
    return { valid: false, error: `No PIN configured for role: ${role}` };
  }

  const isValid = verifyPinAgainstHash(enteredPin, targetHash);

  if (isValid) {
    // Clear failed attempts on successful verification
    rateLimitMap.delete(rateLimitKey);
    return { valid: true };
  } else {
    // Increment failed attempts
    rateEntry.attempts += 1;
    rateEntry.lastAttempt = now;
    if (rateEntry.attempts >= MAX_FAILED_ATTEMPTS) {
      rateEntry.lockedUntil = now + LOCKOUT_DURATION_MS;
      rateLimitMap.set(rateLimitKey, rateEntry);
      return {
        valid: false,
        rateLimited: true,
        error: "Too many failed attempts. Locked for 60 seconds."
      };
    }
    rateLimitMap.set(rateLimitKey, rateEntry);
    return { valid: false, error: "Incorrect PIN" };
  }
}
