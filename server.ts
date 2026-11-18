import "dotenv/config";
import express, { Request, Response } from "express";
import path from "path";
import { createHash, createSign } from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase/app";
import { cert, getApps as getAdminApps, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore, type Firestore as FirebaseAdminFirestore } from "firebase-admin/firestore";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where,
  setLogLevel
} from "firebase/firestore";
import {
  hashPin,
  verifyPinAgainstHash,
  getCredentialDocId
} from "./src/server/pinAuthService";
import firebaseConfig from "./firebase-applet-config.json";

// Set Silent logging level for Firestore client to silence idle stream cancel warnings
try {
  setLogLevel("silent");
} catch (e) {
  console.warn("Could not set Firestore log level:", e);
}

// Initialize Firebase Core Client on express node runtime
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const firebaseAuth = getAuth(firebaseApp);

// Initialize privileged Firebase Admin Firestore from the encrypted Vercel Secret.
// ID tokens are verified through Firebase Identity Toolkit below to avoid loading
// the Admin Auth dependency chain in the serverless CommonJS bundle.
let adminDb: FirebaseAdminFirestore | null = null;
let serviceAccountForAuth: any = null;

let adminSdkInitError = "";

// Only the designated owner account may enter or administer the Admin panel.
const PRIMARY_ADMIN_EMAIL = "barakahbillpro@gmail.com";

async function verifyStorePanelPin(
  storeIdInput: string,
  role: "admin" | "sales",
  pinInput: string
): Promise<"valid" | "invalid" | "locked"> {
  const cleanEmail = String(storeIdInput || "").trim().toLowerCase();
  const pin = String(pinInput || "");
  if (!adminDb || !cleanEmail || !/^\d{4}$/.test(pin)) return "invalid";

  const credentialRef = adminDb.collection("store_auth_credentials").doc(getCredentialDocId(cleanEmail));
  const rateLimitId = createHash("sha256").update(`${cleanEmail}:panel-pin:${role}`).digest("hex");
  const rateLimitRef = adminDb.collection("security_rate_limits").doc(rateLimitId);
  const now = Date.now();

  return adminDb.runTransaction(async (transaction) => {
    const [credentialSnap, rateLimitSnap] = await Promise.all([
      transaction.get(credentialRef),
      transaction.get(rateLimitRef)
    ]);
    const credential = credentialSnap.exists ? credentialSnap.data() as AdminPinCredentials : null;
    const current = rateLimitSnap.exists ? rateLimitSnap.data() as any : {};
    const windowStartedAt = Number(current.window_started_at) || now;
    const lockedUntil = Number(current.locked_until) || 0;
    let attempts = Number(current.attempts) || 0;

    if (lockedUntil > now) return "locked";
    if (now - windowStartedAt > 5 * 60 * 1000) attempts = 0;

    const targetHash = role === "admin" ? credential?.admin_pin_hash : credential?.sales_pin_hash;
    if (targetHash && verifyPinAgainstHash(pin, targetHash)) {
      transaction.delete(rateLimitRef);
      return "valid";
    }

    attempts += 1;
    const expiredWindow = now - windowStartedAt > 5 * 60 * 1000;
    transaction.set(rateLimitRef, {
      attempts,
      window_started_at: attempts === 1 || expiredWindow ? now : windowStartedAt,
      locked_until: attempts >= 5 ? now + 60 * 1000 : 0,
      updated_at: new Date(now).toISOString()
    }, { merge: true });
    return attempts >= 5 ? "locked" : "invalid";
  });
}

async function verifyPrimaryAdminPin(email: string, pin: string): Promise<boolean> {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (cleanEmail !== PRIMARY_ADMIN_EMAIL) return false;
  return (await verifyStorePanelPin(cleanEmail, "admin", pin)) === "valid";
}

// PIN credential operations use the privileged Admin Firestore instance only.
// This prevents server routes from depending on an unauthenticated Firebase client SDK.
type AdminPinCredentials = {
  id: string;
  store_id: string;
  admin_pin_hash: string;
  sales_pin_hash: string;
  created_at: string;
  updated_at: string;
  version: number;
};

async function getAdminPinCredentials(storeId: string): Promise<AdminPinCredentials | null> {
  if (!adminDb) throw new Error("Firebase Admin Firestore is not configured.");
  const cleanStoreId = (storeId || "").trim().toLowerCase();
  if (!cleanStoreId) return null;
  const snap = await adminDb.collection("store_auth_credentials").doc(getCredentialDocId(cleanStoreId)).get();
  return snap.exists ? (snap.data() as AdminPinCredentials) : null;
}

async function migrateAdminPinCredentials(
  storeId: string,
  providedAdminPin?: string,
  providedSalesPin?: string
): Promise<{ success: boolean; migrated: boolean; store_id: string; message: string }> {
  if (!adminDb) throw new Error("Firebase Admin Firestore is not configured.");
  const cleanStoreId = (storeId || "").trim().toLowerCase();
  if (!cleanStoreId) throw new Error("Invalid store account.");

  const existing = await getAdminPinCredentials(cleanStoreId);
  if (existing?.admin_pin_hash && existing?.sales_pin_hash) {
    return { success: true, migrated: false, store_id: cleanStoreId, message: "PIN credentials are already initialized." };
  }

  let legacyAdminPin = "";
  let legacySalesPin = "";
  try {
    let legacySnap = await adminDb.collection("passcode_syncs")
      .where("linked_email", "==", cleanStoreId).limit(1).get();
    if (legacySnap.empty) {
      legacySnap = await adminDb.collection("passcode_syncs")
        .where("linkedEmail", "==", cleanStoreId).limit(1).get();
    }
    if (!legacySnap.empty) {
      const legacy = legacySnap.docs[0].data();
      const business = legacy.businessInfo || legacy.business_info || {};
      legacyAdminPin = String(business.adminPasscode || "");
      legacySalesPin = String(business.salesPasscode || "");
    }
  } catch (error) {
    console.warn("[PIN migration] Legacy credential lookup failed; using authenticated settings values only.");
  }

  // Preserve legacy defaults for existing installations; the values are hashed before storage.
  const adminPin = String(providedAdminPin || legacyAdminPin || (existing?.admin_pin_hash ? "" : "1234")).trim();
  const salesPin = String(providedSalesPin || legacySalesPin || (existing?.sales_pin_hash ? "" : "5555")).trim();
  const now = new Date().toISOString();
  const record: AdminPinCredentials = {
    id: getCredentialDocId(cleanStoreId),
    store_id: cleanStoreId,
    admin_pin_hash: adminPin ? hashPin(adminPin) : String(existing?.admin_pin_hash || ""),
    sales_pin_hash: salesPin ? hashPin(salesPin) : String(existing?.sales_pin_hash || ""),
    created_at: existing?.created_at || now,
    updated_at: now,
    version: 1
  };
  if (!record.admin_pin_hash || !record.sales_pin_hash) {
    throw new Error("Both Admin and Sales PINs must be configured before access can be enabled.");
  }

  await adminDb.collection("store_auth_credentials").doc(record.id).set(record, { merge: true });
  return { success: true, migrated: true, store_id: cleanStoreId, message: "PIN credentials securely initialized." };
}

try {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (serviceAccount.project_id !== firebaseConfig.projectId) {
      throw new Error("Firebase service account project does not match the app project.");
    }
    serviceAccountForAuth = serviceAccount;
    const adminApp = getAdminApps().find((app) => app.name === "[DEFAULT]") ||
      initializeAdminApp({ credential: cert(serviceAccount), projectId: firebaseConfig.projectId });
    adminDb = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
  }
} catch (error) {
  // Never log service-account contents or private keys.
  adminSdkInitError = error instanceof Error ? error.message : "Unknown initialization error";
  console.error("Firebase Admin SDK initialization failed:", adminSdkInitError);
}

async function getFirebaseAdminAccessToken(): Promise<string> {
  if (!serviceAccountForAuth?.client_email || !serviceAccountForAuth?.private_key) {
    throw new Error("Firebase Admin service account is not configured.");
  }
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: any) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = [
    encode({ alg: "RS256", typ: "JWT" }),
    encode({
      iss: serviceAccountForAuth.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  ].join(".");
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = unsigned + "." + signer.sign(serviceAccountForAuth.private_key, "base64url");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }).toString()
  });
  const tokenData: any = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error("Could not authorize Firebase account management.");
  }
  return String(tokenData.access_token);
}

async function deleteFirebaseAuthUser(uid: string): Promise<void> {
  const accessToken = await getFirebaseAdminAccessToken();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/accounts:batchDelete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ localIds: [uid], force: true })
    }
  );
  const result: any = await response.json().catch(() => ({}));
  const deleteErrors = Array.isArray(result?.errors) ? result.errors : [];
  if (!response.ok || deleteErrors.some((item: any) => String(item?.localId || "") === uid)) {
    throw new Error("Firebase could not delete this delivery login account. No staff records were removed.");
  }
}

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured in your environment variables. Please open settings and save GEMINI_API_KEY.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Shared fallback generators when Gemini is unavailable or rate-limited
function getDynamicFallbackInsights(transactions: any[], expenses: any[], products: any[]) {
  const lowStock = (products || []).filter((p: any) => p.stock !== undefined && Number(p.stock) <= 3);
  const duesTotal = (transactions || []).reduce((acc: number, t: any) => acc + (Number(t.dueBalance) || 0), 0);

  const expenseCategories: { [key: string]: number } = {};
  (expenses || []).forEach((e: any) => {
    const cat = e.cat || e.category || "Others";
    const amt = Number(e.amount) || 0;
    expenseCategories[cat] = (expenseCategories[cat] || 0) + amt;
  });
  let maxExpenseCat = "Others";
  let maxExpenseAmt = 0;
  Object.entries(expenseCategories).forEach(([cat, amt]) => {
    if (amt > maxExpenseAmt) {
      maxExpenseAmt = amt;
      maxExpenseCat = cat;
    }
  });

  const list = [];

  // 1. Cashflow & Dues Insight
  if (duesTotal > 0) {
    list.push({
      title: "📊 বকেয়া পাওনা সতর্কতা (Outstanding Due Alert)",
      description: `আপনার স্টোরের বকেয়া খাতার মোট ব্যালেন্স **৳${duesTotal.toLocaleString()}**। ব্যবসার ক্যাশফ্লো সচল ও হেলদি রাখতে বাকী খাতা নিয়মিত পর্যালোচনা করুন এবং পাওনা সংগ্রহ ত্বরান্বিত করুন।`,
      type: "warning" as const
    });
  } else {
    list.push({
      title: "💰 শতভাগ ক্যাশ রিসিভড (100% Cashflow Secured)",
      description: "চমৎকার! আপনার স্টোরের বকেয়া খাতা সম্পূর্ণ পরিষ্কার, সমস্ত লেনদেন সফলভাবে আদায় করা হয়েছে। এটি ব্যবসার ওয়ার্কিং ক্যাপিটাল সচল রাখতে অগ্রণী ভূমিকা রাখবে।",
      type: "success" as const
    });
  }

  // 2. Stock Inventory Insight
  if (lowStock.length > 0) {
    const names = lowStock.slice(0, 3).map((p: any) => p.name).join(", ");
    list.push({
      title: "⚠️ স্টক রিঅর্ডার সতর্কতা (Inventory Stock Alert)",
      description: `স্টোরে **${names}** সহ কিছু পণ্যের স্টক ফুরিয়ে আসছে (স্টক লেভেল ৩ বা তার নিচে)। ক্রেতার চাহিদা মেটাতে অবিলম্বে নতুন স্টক অর্ডার দিন।`,
      type: "info" as const
    });
  } else {
    list.push({
      title: "📦 স্টক ইন্টিগ্রিটি সন্তোষজনক (Inventory Health Good)",
      description: "স্টোরের সব প্রোডাক্টের পরিমিত ভারসাম্যপূর্ণ স্টক লেভেল রয়েছে। অনাকাঙ্ক্ষিতভাবে ফাঁকা স্টকে পড়ার ঝুঁকি নেই।",
      type: "info" as const
    });
  }

  // 3. Expense Control Insight
  if (maxExpenseAmt > 0) {
    list.push({
      title: "💸 ব্যয় পর্যালোচনা ও অপ্টিমাইজেশন (Expense Focus)",
      description: `চলতি মেয়াদে আপনার সর্বোচ্চ খরচ হয়েছে **${maxExpenseCat}** ক্যাটাগরিতে (মোট **৳${maxExpenseAmt.toLocaleString()}**)। নিট প্রফিট বাড়াতে অপ্রয়োজনীয় পরিচালনা ব্যয় হ্রাস করুন।`,
      type: "success" as const
    });
  } else {
    list.push({
      title: "📈 পরিচালনা ব্যয় নিয়ন্ত্রণ (Low Operational Expense)",
      description: "এই সপ্তাহে কোনো অস্বাভাবিক অতিরিক্ত ব্যয় নথিভুক্ত হয়নি। খরচের সামঞ্জস্য বজায় রাখলে ব্যবসার ক্যাশ মার্জিন বৃদ্ধি পাবে।",
      type: "success" as const
    });
  }

  return list;
}

function classifyExpenseLocally(description: string): string {
  const desc = (description || "").toLowerCase();
  if (desc.includes("rent") || desc.includes("ভাড়া") || desc.includes("দোকান") || desc.includes("shop rent")) return "Rent";
  if (desc.includes("electric") || desc.includes("power") || desc.includes("বিল") || desc.includes("current") || desc.includes("বিদ্যুৎ") || desc.includes("utility")) return "Electricity";
  if (desc.includes("salary") || desc.includes("wage") || desc.includes("বেতন") || desc.includes("staff") || desc.includes("কর্মচারী")) return "Salary";
  if (desc.includes("ad") || desc.includes("market") || desc.includes("promo") || desc.includes("ফেসবুক") || desc.includes("বিজ্ঞাপন") || desc.includes("marketing")) return "Marketing";
  return "Others";
}

function isOwnedByVerifiedAccount(data: any, verified: { uid: string; email: string }): boolean {
  if (!data || typeof data !== "object") return false;
  const uidValues = [data.user_id, data.userId, data.owner_id].filter((v) => typeof v === "string");
  const email = (verified.email || "").trim().toLowerCase();
  const emailValues = [data.store_id, data.storeId, data.email, data.linked_email, data.linkedEmail]
    .filter((v) => typeof v === "string")
    .map((v) => v.trim().toLowerCase());
  return uidValues.includes(verified.uid) || (!!email && emailValues.includes(email));
}

const ALLOWED_SYNC_TABLES = new Set([
  "products", "customers", "expenses", "transactions",
  "transaction_items", "purchases", "business_info"
]);

async function verifyFirebaseToken(req: Request): Promise<{ uid: string; email: string } | null> {
  // Only a Firebase-issued ID token is an identity proof; caller-supplied UID/email
  // headers and query parameters are never trusted.
  const authHeader = req.headers.authorization;
  const headerToken = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const queryToken = typeof req.query.idToken === "string" ? req.query.idToken : "";
  const idToken = headerToken || queryToken;
  if (!idToken || idToken.length > 5000) return null;

  try {
    // Verify the Firebase-issued ID token with the project Identity Toolkit API.
    // This validates the signature, issuer, audience, expiry and account identity.
    if (!firebaseConfig.apiKey) return null;
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      }
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const account = Array.isArray(payload?.users) ? payload.users[0] : null;
    if (!account?.localId || typeof account.localId !== "string" || account.disabled === true) return null;
    return {
      uid: account.localId,
      email: typeof account.email === "string" ? account.email.trim().toLowerCase() : ""
    };
  } catch (err) {
    console.warn("Firebase ID token verification failed:", err instanceof Error ? err.message : "Unknown error");
    return null;
  }
}

async function createApp(options: { serveFrontend?: boolean } = {}) {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ 
      status: "ok", 
      firebaseConfigured: !!firebaseConfig.apiKey,
      firebaseAdminConfigured: !!adminDb,
      firebaseAdminInitError: adminSdkInitError ? "initialization_failed" : null,
      tokenVerificationMode: "firebase_identity_toolkit",
      isUsingFallback: false 
    });
  });

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
      const cleanEmail = email.trim().toLowerCase();
      const creds = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, password);
      res.json({ 
        user: {
          id: creds.user.uid,
          uid: creds.user.uid,
          email: creds.user.email
        }
      });
    } catch (err: any) {
      let displayError = err.message || String(err);
      if (err.code === "auth/weak-password" || err.message?.includes("at least") || err.message?.includes("weak")) {
        displayError = "পাসওয়ার্ডটি কমপক্ষে ৬ অক্ষরের হতে হবে!";
      } else if (err.code === "auth/email-already-in-use" || err.message?.includes("already registered")) {
        displayError = "এই ইমেইলটি ইতিপূর্বে রেজিস্টার করা হয়েছে!";
      }
      res.status(400).json({ error: displayError });
    }
  });

  app.post("/api/auth/signin", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
      const cleanEmail = email.trim().toLowerCase();
      const creds = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, password);
      res.json({ 
        user: {
          id: creds.user.uid,
          uid: creds.user.uid,
          email: creds.user.email
        }
      });
    } catch (err: any) {
      let displayError = err.message || String(err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.message?.toLowerCase().includes("credentials")) {
        displayError = "ভুল পাসওয়ার্ড! অথবা একাউন্টটি এখনো তৈরি করা হয়নি। পাসওয়ার্ডটি পুনরায় চেক করুন!";
      }
      res.status(400).json({ error: displayError });
    }
  });

  // In-memory sync cache for seamless multi-device realtime propagation
  const serverDbCache = new Map<string, Map<string, any>>();

  function getTableCache(table: string) {
    let tableMap = serverDbCache.get(table);
    if (!tableMap) {
      tableMap = new Map<string, any>();
      serverDbCache.set(table, tableMap);
    }
    return tableMap;
  }

  // Real-time synchronization hub for cross-device updates
  interface SyncChangeRecord {
    id: string;
    table: string;
    docId: string;
    data?: any;
    isDelete: boolean;
    storeEmail: string;
    userIds: string[];
    timestamp: number;
  }

  const syncChangeHistory: SyncChangeRecord[] = [];
  const sseClients = new Set<{ res: Response; email: string; uid: string }>();

  // Periodically send SSE keepalive ping only for the traditional local server.
  if (options.serveFrontend) setInterval(() => {
    const pingPayload = `: ping\n\n`;
    for (const client of sseClients) {
      try {
        client.res.write(pingPayload);
      } catch (_) {
        sseClients.delete(client);
      }
    }
  }, 15000);

  async function broadcastSyncChange(change: SyncChangeRecord) {
    // Persist the change so polling works across stateless Vercel Function instances.
    if (adminDb) {
      const storeKey = createHash("sha256").update(change.storeEmail).digest("hex");
      await adminDb.collection("sync_events").doc(storeKey).collection("events").add({
        table: change.table,
        docId: change.docId,
        data: change.data ?? null,
        isDelete: change.isDelete,
        storeEmail: change.storeEmail,
        timestamp: change.timestamp
      });
    }
    // Keep max 1000 local history items for local development.
    syncChangeHistory.push(change);
    if (syncChangeHistory.length > 1000) {
      syncChangeHistory.shift();
    }

    const payload = `data: ${JSON.stringify({
      type: change.isDelete ? 'delete' : 'upsert',
      table: change.table,
      id: change.docId,
      data: change.data,
      storeEmail: change.storeEmail,
      timestamp: change.timestamp
    })}\n\n`;

    for (const client of sseClients) {
      try {
        const clientEmail = (client.email || "").trim().toLowerCase();
        const eventEmail = (change.storeEmail || "").trim().toLowerCase();
        // Never broadcast when either side lacks a verified store identity.
        // A missing email must not become a wildcard that leaks one store's data to another.
        const isMatch = !!clientEmail && !!eventEmail && clientEmail === eventEmail;
        if (isMatch) {
          client.res.write(payload);
        }
      } catch (_) {
        sseClients.delete(client);
      }
    }
  }

  // Cache account identity lookups: polling must not re-read profiles and passcode
  // vault documents on every reconciliation request.
  const resolvedUserIdsCache = new Map<string, { ids: string[]; expiresAt: number }>();
  const RESOLVED_USER_IDS_CACHE_TTL = 5 * 60 * 1000;

  // Helper to dynamically resolve all user/profile IDs associated with user's verified identity
  async function resolveAllUserIdsForEmail(email: string, defaultUid: string): Promise<string[]> {
    const cleanEmail = (email || "").trim().toLowerCase();
    const ids = new Set<string>();
    if (defaultUid) ids.add(defaultUid);
    if (cleanEmail) {
      const cached = resolvedUserIdsCache.get(cleanEmail);
      if (cached && cached.expiresAt > Date.now()) {
        cached.ids.forEach(id => ids.add(id));
        ids.add(cleanEmail);
        return Array.from(ids);
      }
      ids.add(cleanEmail);
      if (cleanEmail === "barakahemart@gmail.com") {
        ["1d4ce803-cbf5-44f1-9ec5-56642de068a1", "DGeDhFzjTDaYCeLZiMSvm8TY4sc2", "vault_a2vflc", "xrTguetUZqSbZOxUKRiUNJV3X1M2", "C5eOR2R8WEMegF53NA5eItMWDrr2", "Lzk64vTQcRPy0MWwQK6t0echMmq1", "1ys9dKJ3fKOKIVOl0GIbuIiHeB73"].forEach(id => ids.add(id));
      } else if (cleanEmail === "barakahbillpro@gmail.com") {
        ["xckXTyRn5AbsrU1paXbmj9dR6HX2"].forEach(id => ids.add(id));
      } else if (cleanEmail === "tendabangladesh72@gmail.com") {
        ["yVAiT3KAHnMYGX2D1hSxWGiZETw1", "rb0SFawVFSTANoZhNwYokmJOFyP2"].forEach(id => ids.add(id));
      }

      // Do not infer account ownership from profile payload fields or backup vaults.
      // passcode_syncs IDs are backup identifiers, not authenticated user identities.
      // Legacy account UIDs are kept only in the explicit per-email allowlist above.
      // This prevents a stale/mislinked vault from importing another business's records.
      try {
        const profilesQ = query(collection(db, "profiles"), where("email", "==", cleanEmail));
        const profilesSnap = await getDocs(profilesQ);
        profilesSnap.forEach(docSnap => {
          // A profile document ID is a Firebase UID, but only trust it when it is
          // the UID presented by the verified Firebase ID token.
          if (docSnap.id === defaultUid) ids.add(docSnap.id);
        });
      } catch (err) {
        console.warn("resolveAllUserIdsForEmail profile verification error:", err);
      }
    }

    const resolvedIds = Array.from(ids);
    if (cleanEmail) {
      resolvedUserIdsCache.set(cleanEmail, {
        ids: resolvedIds.filter(id => id !== defaultUid),
        expiresAt: Date.now() + RESOLVED_USER_IDS_CACHE_TTL
      });
    }
    return resolvedIds;
  }

  // Helper to sync REST updates from the phone directly back to the passcode_syncs backing document on Firestore
  async function syncCollectionAndPasscodeVault(
    verified: { uid: string; email: string },
    table: string,
    id: string,
    data: any,
    isDelete: boolean = false
  ) {
    const email = (verified.email || "").trim().toLowerCase();
    if (!email) return;

    try {
      // Find all passcode_syncs documents linked to this email
      const syncsQ = query(collection(db, "passcode_syncs"), where("linked_email", "==", email));
      const syncsSnap = await getDocs(syncsQ);

      if (syncsSnap.empty) {
        console.log(`[Sync Engine server] No passcode_syncs document found for ${email}. No backup to propagate.`);
        return;
      }

      const promises = syncsSnap.docs.map(async (docSnap) => {
        const syncId = docSnap.id;
        const syncData = docSnap.data();

        let arrayFieldName = "";
        const tableStr = String(table);
        if (tableStr === "products") arrayFieldName = "products";
        else if (tableStr === "customers" || tableStr === "contacts") arrayFieldName = "contacts";
        else if (tableStr === "expenses") arrayFieldName = "expenses";
        else if (tableStr === "transactions") arrayFieldName = "transactions";
        else if (tableStr === "purchases") arrayFieldName = "purchases";

        const updatedFields: any = {
          updated_at: new Date().toISOString()
        };

        if (arrayFieldName) {
          let currentArray = syncData[arrayFieldName] || [];
          if (!Array.isArray(currentArray)) currentArray = [];

          if (isDelete) {
            currentArray = currentArray.filter((item: any) => item && item.id !== id);
          } else {
            let itemObj: any = { ...data, id };

            if (tableStr === "products") {
              itemObj = {
                id: data.id || id,
                name: data.name,
                sku: data.sku || "",
                stock: Number(data.stock) || 0,
                buyPrice: Number(data.buy_price) || 0,
                sellPrice: Number(data.sell_price) || 0,
                category: data.category || "Electronics",
                unit: data.unit || "piece",
                imageUrl: data.image_url || undefined,
                costLots: Array.isArray(data.costLots) ? data.costLots : (Array.isArray(data.cost_lots) ? data.cost_lots : undefined)
              };
            } else if (tableStr === "customers" || tableStr === "contacts") {
              itemObj = {
                id: data.id || id,
                name: data.name,
                phone: data.phone || "",
                address: data.address || "",
                type: data.type || "customer",
                created_at: data.created_at || data.updated_at || new Date().toISOString()
              };
            } else if (tableStr === "expenses") {
              itemObj = {
                id: data.id || id,
                category: data.category || "Others",
                amount: Number(data.amount) || 0,
                description: data.description || "",
                // The expense ledger date is user-selected; created_at is only a legacy fallback.\n                date: data.date || data.created_at || new Date().toISOString()
              };
            } else if (tableStr === "purchases") {
              const quantity = Number(data.quantity) || 0;
              const buyPrice = Number(data.buyPrice ?? data.buy_price) || 0;
              itemObj = {
                id: data.id || id,
                productId: data.productId || data.product_id || "",
                productName: data.productName || data.product_name || "Purchase Item",
                supplierId: data.supplierId || data.supplier_id || "",
                supplierName: data.supplierName || data.supplier_name || "Main Depot",
                quantity,
                buyPrice,
                totalAmount: Number(data.totalAmount ?? data.total_amount) || quantity * buyPrice,
                date: data.date || data.created_at || new Date().toISOString(),
                cashPaid: Number(data.cashPaid ?? data.cash_paid) || 0,
                dueAmount: Number(data.dueAmount ?? data.due_amount) || 0,
                invoiceNo: data.invoiceNo || data.invoice_no || "",
                note: data.note || ""
              };
            } else if (tableStr === "transactions") {
              let mappedItems: any[] = [];
              try {
                const itemsSnap = await getDocs(query(collection(db, "transaction_items"), where("transaction_id", "==", id)));
                itemsSnap.forEach(itemDoc => {
                  const item = itemDoc.data();
                  mappedItems.push({
                    id: item.id || itemDoc.id,
                    name: item.product_name || "Product Item",
                    quantity: Number(item.quantity) || 0,
                    price: Number(item.sell_price) || 0,
                    total: Number(item.quantity * item.sell_price) || 0,
                    productId: item.product_id || undefined,
                    buyPrice: item.cost_price !== undefined ? Number(item.cost_price) : undefined,
                    costAllocations: item.cost_allocations || item.costAllocations || undefined
                  });
                });
              } catch (itmErr) {
                console.warn("Error fetching transaction items during sync:", itmErr);
              }

              if (mappedItems.length === 0 && data.items) {
                mappedItems = data.items;
              }

              itemObj = {
                id: data.id || id,
                invoiceNo: data.invoice_no || data.invoiceNo,
                date: data.created_at || data.date || new Date().toISOString(),
                items: mappedItems,
                subtotal: Number(data.total_amount || data.subtotal) || 0,
                tax: Number(data.tax) || 0,
                discount: Number(data.discount) || 0,
                total: Number(data.total_amount || data.total) || 0,
                paymentMethod: data.payment_method || data.paymentMethod || "Cash",
                status: data.paid_amount >= data.total_amount ? "paid" : (data.paid_amount > 0 ? "partial" : "due"),
                paidAmount: Number(data.paid_amount || data.paidAmount) || 0,
                dueBalance: Math.max(0, Number(data.total_amount || data.total) - Number(data.paid_amount || data.paidAmount)) || 0,
                contactId: data.customer_id || data.contactId || undefined,
                customerSignature: data.signature_svg || data.customerSignature || undefined
              };
            }

            const existingIndex = currentArray.findIndex((item: any) => item && item.id === id);
            if (existingIndex >= 0) {
              currentArray[existingIndex] = { ...currentArray[existingIndex], ...itemObj };
            } else {
              currentArray.push(itemObj);
            }
          }

          updatedFields[arrayFieldName] = currentArray;

          if (tableStr === "purchases") {
            const bizData = syncData.businessInfo || syncData.business_info || {};
            const currentBizPurchases = bizData.purchases || [];
            let updatedBizPurchases = Array.isArray(currentBizPurchases) ? [...currentBizPurchases] : [];
            if (isDelete) {
              updatedBizPurchases = updatedBizPurchases.filter((item: any) => item && item.id !== id);
            } else {
              const quantity = Number(data.quantity) || 0;
              const buyPrice = Number(data.buyPrice ?? data.buy_price) || 0;
              const itemObj = {
                id: data.id || id,
                productId: data.productId || data.product_id || "",
                productName: data.productName || data.product_name || "Purchase Item",
                supplierId: data.supplierId || data.supplier_id || "",
                supplierName: data.supplierName || data.supplier_name || "Main Depot",
                quantity,
                buyPrice,
                totalAmount: Number(data.totalAmount ?? data.total_amount) || quantity * buyPrice,
                date: data.date || data.created_at || new Date().toISOString(),
                cashPaid: Number(data.cashPaid ?? data.cash_paid) || 0,
                dueAmount: Number(data.dueAmount ?? data.due_amount) || 0,
                invoiceNo: data.invoiceNo || data.invoice_no || "",
                note: data.note || ""
              };
              const existingIdx = updatedBizPurchases.findIndex((item: any) => item && item.id === id);
              if (existingIdx >= 0) {
                updatedBizPurchases[existingIdx] = { ...updatedBizPurchases[existingIdx], ...itemObj };
              } else {
                updatedBizPurchases.push(itemObj);
              }
            }
            updatedFields.businessInfo = {
              ...bizData,
              purchases: updatedBizPurchases
            };
            updatedFields.business_info = updatedFields.businessInfo;
          }
        } else if (tableStr === "business_info" || tableStr === "businessInfo") {
          const bizData = syncData.businessInfo || syncData.business_info || {};
          const mergedBiz = {
            ...bizData,
            ...data
          };
          updatedFields.businessInfo = mergedBiz;
          updatedFields.business_info = mergedBiz;
        }

        await setDoc(doc(db, "passcode_syncs", syncId), {
          ...syncData,
          ...updatedFields
        }, { merge: true });

        console.log(`[Sync Engine server] Successfully propagated ${isDelete ? 'delete' : 'upsert'} of table=${tableStr}, id=${id} to passcode_syncs/${syncId}`);
      });

      await Promise.all(promises);
    } catch (err: any) {
      console.warn("[Sync Engine server] Failed to propagate changes to passcode_syncs document:", err.message);
    }
  }

  app.get("/api/db/fetch", async (req: Request, res: Response) => {
    const { table, owner_email } = req.query;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) {
        return res.status(401).json({ error: "Access Denied: Unauthenticated user request." });
      }

      const cleanEmail = (verified.email || "").trim().toLowerCase();
      const tableStr = String(table || "");
      if (!ALLOWED_SYNC_TABLES.has(tableStr)) {
        return res.status(400).json({ error: "Unsupported data collection." });
      }
      if (typeof owner_email === "string" && owner_email.trim().toLowerCase() !== cleanEmail) {
        return res.status(403).json({ error: "Access Forbidden: Store account mismatch." });
      }
      const allowedIds = await resolveAllUserIdsForEmail(verified.email, verified.uid);
      const recordsMap = new Map<string, any>();

      // 1. First populate from server in-memory real-time sync cache
      const memCache = getTableCache(tableStr);
      for (const [docId, data] of memCache.entries()) {
        const docStore = (data.store_id || data.storeId || data.email || data.linked_email || "").trim().toLowerCase();
        const docUid = String(data.user_id || data.userId || data.owner_id || "");
        if ((cleanEmail && docStore === cleanEmail) || (cleanEmail && docUid === cleanEmail) || allowedIds.includes(docUid)) {
          recordsMap.set(docId, data);
        }
      }

      // 2. Query Firestore collection by allowed IDs and store email
      try {
        if (cleanEmail) {
          try {
            const storeQ = query(collection(db, tableStr), where("store_id", "==", cleanEmail));
            const storeSnap = await getDocs(storeQ);
            storeSnap.forEach(docSnapshot => {
              const data = docSnapshot.data();
              const docId = data.id || docSnapshot.id;
              recordsMap.set(docId, data);
              memCache.set(docId, data);
            });
          } catch (_) {}

          try {
            const emailQ = query(collection(db, tableStr), where("email", "==", cleanEmail));
            const emailSnap = await getDocs(emailQ);
            emailSnap.forEach(docSnapshot => {
              const data = docSnapshot.data();
              const docId = data.id || docSnapshot.id;
              recordsMap.set(docId, data);
              memCache.set(docId, data);
            });
          } catch (_) {}
        }

        // Query each allowed UID
        for (const uid of allowedIds) {
          try {
            const q = query(collection(db, tableStr), where("user_id", "==", uid));
            const docsSnap = await getDocs(q);
            docsSnap.forEach(docSnapshot => {
              const data = docSnapshot.data();
              const docId = data.id || docSnapshot.id;
              recordsMap.set(docId, data);
              memCache.set(docId, data);
            });
          } catch (_) {}
        }
      } catch (fErr) {
        console.warn(`[server.ts] Firestore fetch for ${tableStr} notice:`, fErr);
      }

      const records = Array.from(recordsMap.values());
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/upsert", async (req: Request, res: Response) => {
    const { table, id, data } = req.body;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) {
        return res.status(401).json({ error: "Access Denied: Unauthenticated user request." });
      }

      const cleanEmail = (verified.email || "").trim().toLowerCase();
      const tableStr = String(table || "");
      const docId = String(id || data?.id || "");
      if (!ALLOWED_SYNC_TABLES.has(tableStr) || !docId || docId.length > 128) {
        return res.status(400).json({ error: "Invalid collection or record ID." });
      }
      if (!cleanEmail) return res.status(403).json({ error: "A Firebase account email is required." });

      const existingRef = doc(db, tableStr, docId);
      const existingSnap = await getDoc(existingRef);
      if (existingSnap.exists() && !isOwnedByVerifiedAccount(existingSnap.data(), verified)) {
        return res.status(403).json({ error: "Access Forbidden: This record belongs to another account." });
      }

      const enrichedData = {
        ...data,
        id: docId,
        user_id: verified.uid,
        userId: verified.uid,
        owner_id: verified.uid,
        store_id: cleanEmail,
        storeId: cleanEmail,
        email: cleanEmail,
        linked_email: cleanEmail,
        linkedEmail: cleanEmail,
        updated_at: data?.updated_at || new Date().toISOString()
      };

      // 1. Immediately store in server in-memory sync cache
      getTableCache(tableStr).set(docId, enrichedData);

      // 2. Instantly broadcast change to all connected devices in realtime via SSE (< 10ms latency)
      const allowedIds = [verified.uid, cleanEmail];
      await broadcastSyncChange({
        id: `${tableStr}_${docId}_${Date.now()}`,
        table: tableStr,
        docId: docId,
        data: enrichedData,
        isDelete: false,
        storeEmail: cleanEmail,
        userIds: allowedIds,
        timestamp: Date.now()
      });

      // 3. Send instant success response to caller
      res.json({ success: true, id: docId });

      // 4. Asynchronously persist to Firestore & Passcode sync vault in background without blocking caller
      (async () => {
        try {
          await setDoc(doc(db, tableStr, docId), enrichedData, { merge: true });
        } catch (fErr) {
          console.warn(`[server.ts] Firestore setDoc for ${tableStr}/${docId} notice:`, fErr);
        }

        try {
          await syncCollectionAndPasscodeVault(verified, tableStr, docId, enrichedData, false);
        } catch (pErr) {
          console.warn(`[server.ts] syncCollectionAndPasscodeVault notice:`, pErr);
        }
      })().catch(() => {});
    } catch (err: any) {
      console.error("[server.ts] /api/db/upsert error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/delete", async (req: Request, res: Response) => {
    const { table, id } = req.body;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) {
        return res.status(401).json({ error: "Access Denied: Unauthenticated user request." });
      }

      const cleanEmail = (verified.email || "").trim().toLowerCase();
      const tableStr = String(table || "");
      const docId = String(id || "");
      if (!ALLOWED_SYNC_TABLES.has(tableStr) || !docId || docId.length > 128) {
        return res.status(400).json({ error: "Invalid collection or record ID." });
      }
      const existingSnap = await getDoc(doc(db, tableStr, docId));
      if (existingSnap.exists() && !isOwnedByVerifiedAccount(existingSnap.data(), verified)) {
        return res.status(403).json({ error: "Access Forbidden: This record belongs to another account." });
      }

      // 1. Remove from server cache
      getTableCache(tableStr).delete(docId);

      // 2. Instantly broadcast deletion to all connected devices in realtime via SSE
      const allowedIds = [verified.uid, cleanEmail];
      await broadcastSyncChange({
        id: `${tableStr}_${docId}_del_${Date.now()}`,
        table: tableStr,
        docId: docId,
        isDelete: true,
        storeEmail: cleanEmail,
        userIds: allowedIds,
        timestamp: Date.now()
      });

      // 3. Send instant success response
      res.json({ success: true });

      // 4. Asynchronously persist deletion to Firestore & Passcode sync vault in background
      (async () => {
        try {
          const docRef = doc(db, tableStr, docId);
          await deleteDoc(docRef);
        } catch (fErr) {
          console.warn(`[server.ts] Firestore delete for ${tableStr}/${docId} notice:`, fErr);
        }

        try {
          await syncCollectionAndPasscodeVault(verified, tableStr, docId, {}, true);
        } catch (pErr) {
          console.warn(`[server.ts] syncCollectionAndPasscodeVault delete notice:`, pErr);
        }
      })().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Real-time SSE Stream Endpoint for Live Multi-Device Push
  app.get("/api/sync/stream", async (req: Request, res: Response) => {
    const verified = await verifyFirebaseToken(req);
    if (!verified) return res.status(401).json({ error: "Access Denied: Valid Firebase login required." });
    const email = verified.email.trim().toLowerCase();
    const uid = verified.uid;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const client = { res, email, uid };
    sseClients.add(client);

    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

    req.on("close", () => {
      sseClients.delete(client);
    });
  });

  // Real-time Poll Endpoint for incremental sync reconciliation
  app.get("/api/sync/poll", async (req: Request, res: Response) => {
    const verified = await verifyFirebaseToken(req);
    if (!verified) return res.status(401).json({ error: "Access Denied: Valid Firebase login required." });
    const email = verified.email.trim().toLowerCase();
    const since = Number(req.query.since) || 0;

    const allowedIds = email ? await resolveAllUserIdsForEmail(email, verified?.uid || "") : [];

    let changes: SyncChangeRecord[] = [];
    if (adminDb && email) {
      try {
        const storeKey = createHash("sha256").update(email).digest("hex");
        const eventsSnap = await adminDb.collection("sync_events").doc(storeKey).collection("events")
          .where("timestamp", ">", since).orderBy("timestamp", "asc").limit(500).get();
        changes = eventsSnap.docs.map((eventDoc) => ({
          id: eventDoc.id,
          ...(eventDoc.data() as Omit<SyncChangeRecord, "id" | "userIds">),
          userIds: [verified.uid, email]
        }));
      } catch (eventError) {
        console.error("[sync/poll] Durable event read failed:", eventError instanceof Error ? eventError.message : "unknown");
        return res.status(503).json({ error: "Sync temporarily unavailable. Please retry." });
      }
    } else {
      changes = syncChangeHistory.filter(c => {
        if (c.timestamp <= since) return false;
        const changeEmail = (c.storeEmail || "").trim().toLowerCase();
        return !!email && !!changeEmail && changeEmail === email;
      });
    }

    res.json({
      changes,
      serverTime: Date.now()
    });
  });

  // Full aggregate state sync endpoint across all collections for fresh device boots
  app.get("/api/sync/full", async (req: Request, res: Response) => {
    const verified = await verifyFirebaseToken(req);
    if (!verified) return res.status(401).json({ error: "Access Denied: Valid Firebase login required." });
    const cleanEmail = verified.email.trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ error: "Email is required for full sync" });
    }

    try {
      const allowedIds = await resolveAllUserIdsForEmail(cleanEmail, verified?.uid || "");
      const tables = ["products", "customers", "transactions", "transaction_items", "expenses", "purchases", "business_info"];
      const fullState: { [key: string]: any[] } = {};

      for (const table of tables) {
        const recordsMap = new Map<string, any>();
        
        // 1. In-memory cache
        const memCache = getTableCache(table);
        for (const [docId, data] of memCache.entries()) {
          const docStore = (data.store_id || data.storeId || data.email || data.linked_email || "").trim().toLowerCase();
          const docUid = String(data.user_id || data.userId || data.owner_id || "");
          if (docStore === cleanEmail || docUid === cleanEmail || allowedIds.includes(docUid)) {
            recordsMap.set(docId, data);
          }
        }

        // 2. Firestore query
        try {
          const storeQ = query(collection(db, table), where("store_id", "==", cleanEmail));
          const storeSnap = await getDocs(storeQ);
          storeSnap.forEach(snap => {
            const d = snap.data();
            recordsMap.set(d.id || snap.id, d);
          });
        } catch (_) {}

        try {
          const emailQ = query(collection(db, table), where("email", "==", cleanEmail));
          const emailSnap = await getDocs(emailQ);
          emailSnap.forEach(snap => {
            const d = snap.data();
            recordsMap.set(d.id || snap.id, d);
          });
        } catch (_) {}

        for (const uid of allowedIds) {
          try {
            const uq = query(collection(db, table), where("user_id", "==", uid));
            const uSnap = await getDocs(uq);
            uSnap.forEach(snap => {
              const d = snap.data();
              recordsMap.set(d.id || snap.id, d);
            });
          } catch (_) {}
        }

        fullState[table] = Array.from(recordsMap.values());
      }

      res.json({
        success: true,
        data: fullState,
        serverTime: Date.now()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // Secure Server-Side PIN Credential Services
  // ==========================================

  app.post("/api/panel-security/pin/migrate", async (req: Request, res: Response) => {
    const { store_id, admin_pin, sales_pin } = req.body || {};
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) return res.status(401).json({ error: "Valid Firebase login required." });
      const cleanStoreId = String(store_id || "").trim().toLowerCase();
      if (!cleanStoreId || cleanStoreId !== verified.email) {
        return res.status(403).json({ error: "Access Forbidden: Store account mismatch." });
      }
      const result = await migrateAdminPinCredentials(cleanStoreId, admin_pin, sales_pin);
      return res.json(result);
    } catch (err: any) {
      console.warn("[pin-credentials/migrate] Initialization failed:", err?.message || "Unknown error");
      return res.status(500).json({ error: err?.message || "Failed to initialize credentials." });
    }
  });

  app.post("/api/panel-security/pin/update", async (req: Request, res: Response) => {
    const { store_id, current_admin_pin, admin_pin, sales_pin } = req.body || {};
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) return res.status(401).json({ error: "Valid Firebase login required." });
      const cleanStoreId = String(store_id || "").trim().toLowerCase();
      if (!cleanStoreId || cleanStoreId !== verified.email || verified.email !== PRIMARY_ADMIN_EMAIL) {
        return res.status(403).json({ error: "Only the primary Admin account can change panel security settings." });
      }
      const newAdminPin = String(admin_pin || "");
      const newSalesPin = String(sales_pin || "");
      if (!/^\d{4}$/.test(newAdminPin) || !/^\d{4}$/.test(newSalesPin) || newAdminPin === newSalesPin) {
        return res.status(400).json({ error: "Set two different 4-digit numeric PINs." });
      }

      const currentPinResult = await verifyStorePanelPin(cleanStoreId, "admin", String(current_admin_pin || ""));
      if (currentPinResult !== "valid") {
        return res.status(currentPinResult === "locked" ? 429 : 403).json({
          error: currentPinResult === "locked" ? "Too many failed attempts. Please wait 60 seconds." : "Current Admin PIN is incorrect."
        });
      }
      const existing = await getAdminPinCredentials(cleanStoreId);
      if (!existing?.admin_pin_hash) return res.status(409).json({ error: "Admin PIN credentials are not initialized." });

      const now = new Date().toISOString();
      const updated = {
        ...existing,
        admin_pin_hash: hashPin(newAdminPin),
        sales_pin_hash: hashPin(newSalesPin),
        admin_pin_updated_at: now,
        sales_pin_updated_at: now,
        updated_at: now,
        version: 1
      };
      await adminDb!.collection("store_auth_credentials").doc(getCredentialDocId(cleanStoreId)).set(updated, { merge: true });
      await Promise.all((["admin", "sales"] as const).map((role) => {
        const rateLimitId = createHash("sha256").update(`${cleanStoreId}:panel-pin:${role}`).digest("hex");
        return adminDb!.collection("security_rate_limits").doc(rateLimitId).delete();
      }));
      return res.json({ success: true, message: "Admin and Sales PINs updated securely." });
    } catch (err: any) {
      console.warn("[pin-credentials/update] Update failed:", err?.message || "Unknown error");
      return res.status(503).json({ error: err?.message || "PIN update is temporarily unavailable." });
    }
  });

  app.get("/api/panel-security/pin/status", async (req: Request, res: Response) => {
    const { store_id } = req.query;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) return res.status(401).json({ error: "Valid Firebase login required." });
      const cleanStoreId = String(store_id || "").trim().toLowerCase();
      if (!cleanStoreId || cleanStoreId !== verified.email) {
        return res.status(403).json({ error: "Access Forbidden: Store account mismatch." });
      }
      const creds = await getAdminPinCredentials(cleanStoreId);
      return res.json({
        store_id: cleanStoreId,
        configured: !!(creds?.admin_pin_hash && creds?.sales_pin_hash),
        has_admin_pin: !!creds?.admin_pin_hash,
        has_sales_pin: !!creds?.sales_pin_hash,
        version: creds?.version || null,
        updated_at: creds?.updated_at || null
      });
    } catch (err: any) {
      return res.status(503).json({ error: err?.message || "PIN status is temporarily unavailable." });
    }
  });

  app.post("/api/panel-security/pin/verify", async (req: Request, res: Response) => {
    const { store_id, role, pin } = req.body || {};
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) return res.status(401).json({ error: "Valid Firebase login required." });
      const cleanStoreId = String(store_id || "").trim().toLowerCase();
      const cleanRole = String(role || "").trim().toLowerCase();
      const enteredPin = String(pin || "");
      if (!cleanStoreId || cleanStoreId !== verified.email) {
        return res.status(403).json({ error: "Access Forbidden: Store account mismatch." });
      }
      if (cleanRole !== "admin" && cleanRole !== "sales") {
        return res.status(400).json({ error: "Invalid panel role." });
      }
      if (cleanRole === "admin" && verified.email !== PRIMARY_ADMIN_EMAIL) {
        return res.status(403).json({ error: "Admin Panel access is restricted to the primary Admin account." });
      }
      if (!/^\d{4}$/.test(enteredPin)) {
        return res.status(400).json({ error: "Enter a valid 4-digit PIN." });
      }

      const pinResult = await verifyStorePanelPin(cleanStoreId, cleanRole as "admin" | "sales", enteredPin);
      if (pinResult !== "valid") {
        return res.status(pinResult === "locked" ? 429 : 401).json({
          valid: false,
          error: pinResult === "locked"
            ? "Too many failed attempts. Please wait 60 seconds."
            : "Incorrect PIN."
        });
      }

      return res.json({ success: true, valid: true, store_id: cleanStoreId, role: cleanRole });
    } catch (err: any) {
      console.warn("[pin-credentials/verify] Verification failed:", err?.message || "Unknown error");
      return res.status(503).json({ error: err?.message || "PIN verification is temporarily unavailable." });
    }
  });

  // ==========================================
  // Delivery operations — all privileged writes use Admin Firestore.
  // Drivers can read only their own active assignments and submit their own expenses.
  // ==========================================

  async function getDeliveryStaff(uid: string) {
    if (!adminDb) throw new Error("Firebase Admin Firestore is not configured.");
    const snap = await adminDb.collection("delivery_staff").doc(uid).get();
    return snap.exists ? snap.data() as any : null;
  }

  async function requireDeliveryAdmin(req: Request, storeIdInput: any, pinInput: any) {
    const verified = await verifyFirebaseToken(req);
    const storeId = String(storeIdInput || "").trim().toLowerCase();
    const pin = String(pinInput || "");
    if (!verified || !verified.email || verified.email.trim().toLowerCase() !== storeId) return null;
    if (await verifyStorePanelPin(storeId, "admin", pin) !== "valid") return null;
    return verified;
  }

  async function requireDeliverySales(req: Request, storeIdInput: any, pinInput: any) {
    const verified = await verifyFirebaseToken(req);
    const storeId = String(storeIdInput || "").trim().toLowerCase();
    const pin = String(pinInput || "");
    if (!verified || !verified.email || verified.email.trim().toLowerCase() !== storeId) return null;
    if (await verifyStorePanelPin(storeId, "sales", pin) !== "valid") return null;
    return verified;
  }

  async function requireDeliveryAssignmentManager(req: Request, body: any) {
    if (body?.panel_role === "sales") return await requireDeliverySales(req, body.store_id, body.sales_pin);
    return await requireDeliveryAdmin(req, body?.store_id, body?.admin_pin);
  }

  app.get("/api/delivery/session", async (req: Request, res: Response) => {
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) return res.status(401).json({ error: "Valid Firebase login required." });
      const staff = await getDeliveryStaff(verified.uid);
      if (!staff || !staff.owner_store_id) {
        return res.status(404).json({ isDeliveryStaff: false, isDeliveryAccount: false });
      }
      // Keep disabled delivery accounts out of the normal Admin/Sales login flow.
      // The account remains a delivery identity, but receives no delivery data.
      return res.json({
        isDeliveryStaff: staff.status === "active",
        isDeliveryAccount: true,
        role: "delivery",
        staff: {
          uid: verified.uid,
          name: String(staff.name || ""),
          email: verified.email,
          phone: String(staff.phone || ""),
          status: staff.status === "active" ? "active" : "inactive"
        }
      });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Delivery session unavailable." });
    }
  });

  app.post("/api/delivery/staff/create", async (req: Request, res: Response) => {
    const { store_id, admin_pin, name, email, phone, temporary_password } = req.body || {};
    try {
      const admin = await requireDeliveryAdmin(req, store_id, admin_pin);
      if (!admin) return res.status(403).json({ error: "Admin login and current Admin PIN are required." });
      const storeId = String(store_id || "").trim().toLowerCase();
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });

      const cleanName = String(name || "").trim();
      const cleanEmail = String(email || "").trim().toLowerCase();
      const cleanPhone = String(phone || "").trim();
      const password = String(temporary_password || "");
      if (cleanName.length < 2 || cleanName.length > 100) return res.status(400).json({ error: "Enter a valid staff name." });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail === String(store_id || "").trim().toLowerCase()) {
        return res.status(400).json({ error: "Enter a valid, separate delivery staff email." });
      }
      if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "Temporary password must be 8–128 characters." });
      if (!firebaseConfig.apiKey) return res.status(503).json({ error: "Firebase Authentication is not configured." });

      const createResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, password, returnSecureToken: true })
        }
      );
      const authResult: any = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok || !authResult.localId) {
        const code = String(authResult?.error?.message || "");
        if (code.includes("EMAIL_EXISTS")) return res.status(409).json({ error: "This email already has a Firebase account. Use a new email address." });
        return res.status(400).json({ error: "Firebase could not create this staff account. Check the email and password requirements." });
      }

      const staffRecord = {
        uid: authResult.localId,
        owner_store_id: storeId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: "delivery",
        status: "active",
        created_at: new Date().toISOString(),
        created_by: admin.uid,
        updated_at: new Date().toISOString()
      };
      try {
        await adminDb.collection("delivery_staff").doc(authResult.localId).set(staffRecord);
      } catch (writeError) {
        try {
          await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken: authResult.idToken })
          });
        } catch (_) {}
        throw writeError;
      }
      return res.status(201).json({
        success: true,
        staff: { uid: staffRecord.uid, name: staffRecord.name, email: staffRecord.email, phone: staffRecord.phone, status: staffRecord.status },
        message: "Delivery staff account created."
      });
    } catch (error: any) {
      console.warn("[delivery/staff/create] Failed:", error?.message || "Unknown error");
      return res.status(503).json({ error: error?.message || "Could not create delivery staff account." });
    }
  });

  app.post("/api/delivery/staff/list", async (req: Request, res: Response) => {
    const { store_id, admin_pin } = req.body || {};
    try {
      const manager = await requireDeliveryAssignmentManager(req, req.body || {});
      if (!manager) return res.status(403).json({ error: "Authorized Admin or Sales panel access is required." });
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const storeId = String(req.body?.store_id || "").trim().toLowerCase();
      const snap = await adminDb.collection("delivery_staff").where("owner_store_id", "==", storeId).get();
      const staff = snap.docs.map(d => {
        const v = d.data();
        return { uid: d.id, name: v.name || "", email: v.email || "", phone: v.phone || "", status: v.status || "inactive", created_at: v.created_at || "" };
      });
      return res.json({ staff });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Could not load delivery staff." });
    }
  });

  app.post("/api/delivery/staff/status", async (req: Request, res: Response) => {
    const { store_id, admin_pin, staff_uid, status } = req.body || {};
    try {
      const admin = await requireDeliveryAdmin(req, store_id, admin_pin);
      if (!admin) return res.status(403).json({ error: "Admin login and current Admin PIN are required." });
      const storeId = String(store_id || "").trim().toLowerCase();
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const uid = String(staff_uid || "").trim();
      if (!uid || !["active", "inactive"].includes(String(status))) return res.status(400).json({ error: "Invalid staff status request." });
      const ref = adminDb.collection("delivery_staff").doc(uid);
      const staffSnap = await ref.get();
      if (!staffSnap.exists || staffSnap.data()?.owner_store_id !== storeId) return res.status(404).json({ error: "Delivery staff member not found." });
      await ref.update({ status, updated_at: new Date().toISOString(), updated_by: admin.uid });
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Could not update delivery staff status." });
    }
  });

  app.post("/api/delivery/staff/delete", async (req: Request, res: Response) => {
    const { store_id, admin_pin, staff_uid } = req.body || {};
    try {
      const admin = await requireDeliveryAdmin(req, store_id, admin_pin);
      if (!admin) return res.status(403).json({ error: "Primary Admin login and current Admin PIN are required." });
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const storeId = String(store_id || "").trim().toLowerCase();
      const uid = String(staff_uid || "").trim();
      if (!uid || uid === admin.uid) return res.status(400).json({ error: "Invalid delivery staff account." });
      const staffRef = adminDb.collection("delivery_staff").doc(uid);
      const staffSnap = await staffRef.get();
      if (!staffSnap.exists || staffSnap.data()?.owner_store_id !== storeId) {
        return res.status(404).json({ error: "Delivery staff member not found." });
      }

      // Delete the Firebase Authentication identity first. If this fails, keep all
      // Firestore records intact so the admin can safely retry.
      await deleteFirebaseAuthUser(uid);

      const [assignmentSnap, expenseSnap, queueSnap] = await Promise.all([
        adminDb.collection("delivery_assignments").where("driver_uid", "==", uid).get(),
        adminDb.collection("delivery_expenses").where("driver_uid", "==", uid).get(),
        adminDb.collection("delivery_queue").where("assigned_to", "==", uid).get()
      ]);
      const docsToDelete = [...assignmentSnap.docs, ...expenseSnap.docs].filter(d => d.data().owner_store_id === staff.owner_store_id);
      for (let offset = 0; offset < docsToDelete.length; offset += 450) {
        const batch = adminDb.batch();
        docsToDelete.slice(offset, offset + 450).forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
      }
      for (let offset = 0; offset < queueSnap.docs.length; offset += 450) {
        const batch = adminDb.batch();
        queueSnap.docs.slice(offset, offset + 450).filter(docSnap => docSnap.data().owner_store_id === storeId).forEach(docSnap => {
          batch.set(docSnap.ref, { assigned: false, assigned_to: "", assigned_at: "" }, { merge: true });
        });
        await batch.commit();
      }
      await staffRef.delete();
      return res.json({ success: true, deleted: true });
    } catch (error: any) {
      console.warn("[delivery/staff/delete] Failed:", error?.message || "Unknown error");
      return res.status(503).json({ error: error?.message || "Could not completely delete delivery staff account." });
    }
  });

  app.get("/api/delivery/assignments", async (req: Request, res: Response) => {
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) return res.status(401).json({ error: "Valid Firebase login required." });
      const staff = await getDeliveryStaff(verified.uid);
      if (!staff || staff.status !== "active" || !staff.owner_store_id) {
        return res.status(403).json({ error: "Active delivery staff account required." });
      }
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const snap = await adminDb.collection("delivery_assignments")
        .where("driver_uid", "==", verified.uid).get();
      const assignments = snap.docs
        .filter(d => d.data().owner_store_id === staff.owner_store_id)
        .map(d => ({ id: d.id, ...d.data() }));
      return res.json({ assignments });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Could not load assigned deliveries." });
    }
  });

  app.post("/api/delivery/queue/add", async (req: Request, res: Response) => {
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified || !verified.email) return res.status(403).json({ error: "Authenticated business account required." });
      const storeId = verified.email.trim().toLowerCase();
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const invoiceNo = String(req.body?.invoice_no || "").trim();
      if (!invoiceNo) return res.status(400).json({ error: "Invoice number is required." });
      const id = createHash("sha256").update(`${storeId}:${invoiceNo}`).digest("hex");
      const ref = adminDb.collection("delivery_queue").doc(id);
      const existing = await ref.get();
      if (existing.exists && existing.data()?.assigned === true) return res.json({ success: true, queued: false, already_assigned: true });
      const record = {
        id, owner_store_id: storeId, invoice_no: invoiceNo,
        transaction_id: String(req.body?.transaction_id || ""),
        customer_name: String(req.body?.customer_name || "Customer"),
        customer_phone: String(req.body?.customer_phone || ""),
        customer_address: String(req.body?.customer_address || ""),
        items: Array.isArray(req.body?.items) ? req.body.items.slice(0, 100).map((item: any) => ({
          name: String(item?.name || "Item").slice(0, 200), quantity: Math.max(0, Number(item?.quantity) || 0)
        })) : [],
        total_amount: Number(req.body?.total_amount) || 0,
        created_at: existing.data()?.created_at || new Date().toISOString(),
        queued_at: new Date().toISOString(),
        assigned: false
      };
      await ref.set(record, { merge: true });
      return res.status(201).json({ success: true, queued: true });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Could not add invoice to delivery queue." });
    }
  });

  app.post("/api/delivery/queue/list", async (req: Request, res: Response) => {
    try {
      const manager = await requireDeliveryAssignmentManager(req, req.body || {});
      if (!manager) return res.status(403).json({ error: "Authorized Admin or Sales panel access is required." });
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const storeId = String(req.body?.store_id || "").trim().toLowerCase();
      const snap = await adminDb.collection("delivery_queue").where("owner_store_id", "==", storeId).get();
      const queue = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((item: any) => item.assigned !== true);
      return res.json({ queue });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Could not load delivery queue." });
    }
  });

  app.post("/api/delivery/assignments/create", async (req: Request, res: Response) => {
    const { store_id, admin_pin, invoice_no, driver_uid } = req.body || {};
    try {
      const manager = await requireDeliveryAssignmentManager(req, req.body || {});
      if (!manager) return res.status(403).json({ error: "Authorized Admin or Sales panel access is required." });
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const storeId = String(store_id || "").trim().toLowerCase();
      const invoiceNo = String(invoice_no || "").trim();
      const driverUid = String(driver_uid || "").trim();
      if (!invoiceNo || !driverUid) return res.status(400).json({ error: "Invoice number and delivery staff are required." });

      const driver = await getDeliveryStaff(driverUid);
      if (!driver || driver.owner_store_id !== storeId || driver.status !== "active") {
        return res.status(404).json({ error: "Active delivery staff member not found." });
      }

      const queueId = createHash("sha256").update(`${storeId}:${invoiceNo}`).digest("hex");
      const queuedSnap = await adminDb.collection("delivery_queue").doc(queueId).get();
      let transaction: any = queuedSnap.exists ? queuedSnap.data() : null;
      let transactionId = String(transaction?.transaction_id || "");
      let customer: any = {};
      if (!transaction) {
        const transactionSnap = await adminDb.collection("transactions")
          .where("invoiceNo", "==", invoiceNo).limit(5).get();
        const transactionDoc = transactionSnap.docs.find(d => String(d.data().store_id || d.data().storeId || "").toLowerCase() === storeId);
        if (!transactionDoc) return res.status(404).json({ error: "Invoice not found in this store." });
        transaction = transactionDoc.data();
        transactionId = transactionDoc.id;
        const contactId = String(transaction.contactId || transaction.contact_id || "");
        if (contactId) {
          const contactDoc = await adminDb.collection("customers").doc(contactId).get();
          if (contactDoc.exists) customer = contactDoc.data() || {};
        }
      }

      // The delivery queue is a compact copy and may not contain the original
      // customer note. Re-read the sale record so invoice/customer notes survive
      // even when an assignment is created from the automatic queue.
      let sourceTransaction: any = null;
      if (transactionId) {
        const sourceSnap = await adminDb.collection("transactions").doc(transactionId).get();
        if (sourceSnap.exists) sourceTransaction = sourceSnap.data() || null;
      }
      if (!sourceTransaction) {
        const sourceMatches = await adminDb.collection("transactions").where("invoiceNo", "==", invoiceNo).limit(5).get();
        const sourceDoc = sourceMatches.docs.find(d => String(d.data().store_id || d.data().storeId || "").toLowerCase() === storeId);
        if (sourceDoc) {
          sourceTransaction = sourceDoc.data();
          transactionId = sourceDoc.id;
        }
      }
      if (sourceTransaction) transaction = { ...sourceTransaction, ...transaction };

      const assignmentId = createHash("sha256").update(`${storeId}:${invoiceNo}`).digest("hex");
      const assignmentRef = adminDb.collection("delivery_assignments").doc(assignmentId);
      const previousAssignmentSnap = await assignmentRef.get();
      const previousAssignment = previousAssignmentSnap.exists ? previousAssignmentSnap.data() || {} : {};
      const assignment = {
        id: assignmentId,
        owner_store_id: storeId,
        driver_uid: driverUid,
        driver_name: String(driver.name || ""),
        invoice_no: invoiceNo,
        transaction_id: transactionId,
        customer_name: String(customer.name || transaction.customer_name || transaction.customerName || "Customer"),
        customer_phone: String(customer.phone || transaction.customer_phone || transaction.customerPhone || ""),
        customer_address: String(customer.address || transaction.customer_address || transaction.customerAddress || ""),
        customer_note: String(transaction.customer_note || transaction.customerNote || transaction.note || transaction.notes || transaction.remark || ""),
        delivery_note: String(previousAssignment.delivery_note || transaction.delivery_note || transaction.deliveryNote || ""),
        items: Array.isArray(transaction.items) ? transaction.items.map((item: any) => ({
          name: String(item.name || item.productName || "Item"),
          quantity: Number(item.quantity) || 0
        })) : [],
        delivery_status: "assigned",
        delivery_fee: Number(previousAssignment.delivery_fee) || 0,
        payment_status: previousAssignment.payment_status === "paid" ? "paid" : "unpaid",
        payment_timing: previousAssignment.payment_timing === "advance" ? "advance" : "after_delivery",
        payment_updated_at: String(previousAssignment.payment_updated_at || ""),
        payment_received_at: String(previousAssignment.payment_received_at || ""),
        assigned_at: new Date().toISOString(),
        assigned_by: manager.uid
      };
      await assignmentRef.set(assignment, { merge: true });
      if (queuedSnap.exists) await adminDb.collection("delivery_queue").doc(queueId).set({ assigned: true, assigned_to: driverUid, assigned_at: new Date().toISOString() }, { merge: true });
      return res.status(201).json({ success: true, assignment });
    } catch (error: any) {
      console.warn("[delivery/assignments/create] Failed:", error?.message || "Unknown error");
      return res.status(503).json({ error: error?.message || "Could not assign invoice." });
    }
  });

  app.post("/api/delivery/assignments/update-mine", async (req: Request, res: Response) => {
    const { assignment_id, delivery_status, delivery_note } = req.body || {};
    const hasFeeUpdate = Object.prototype.hasOwnProperty.call(req.body || {}, "delivery_fee");
    const fee = Number(req.body?.delivery_fee);
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) return res.status(401).json({ error: "Valid Firebase login required." });
      const staff = await getDeliveryStaff(verified.uid);
      if (!staff || staff.status !== "active" || !staff.owner_store_id) {
        return res.status(403).json({ error: "Active delivery staff account required." });
      }
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const id = String(assignment_id || "").trim();
      const allowedStatuses = ["assigned", "delivered", "cancelled", "failed", "returned"];
      if (!id || !allowedStatuses.includes(String(delivery_status))) {
        return res.status(400).json({ error: "Invalid delivery update." });
      }
      if (hasFeeUpdate && (!Number.isFinite(fee) || fee < 0 || fee > 1000000)) {
        return res.status(400).json({ error: "Enter a valid delivery amount." });
      }

      const assignmentRef = adminDb.collection("delivery_assignments").doc(id);
      const now = new Date().toISOString();
      const result = await adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(assignmentRef);
        const assignment = snap.exists ? snap.data() : null;
        if (!assignment || assignment.driver_uid !== verified.uid || assignment.owner_store_id !== staff.owner_store_id) {
          return "not_assigned";
        }
        if (hasFeeUpdate && assignment.payment_status === "paid") return "already_paid";
        const updates: Record<string, any> = {
          delivery_status,
          delivery_note: String(delivery_note || "").trim().slice(0, 500),
          status_updated_at: now,
          status_updated_by: verified.uid
        };
        if (hasFeeUpdate) {
          updates.delivery_fee = fee;
          updates.amount_updated_at = now;
          updates.amount_updated_by = verified.uid;
        }
        transaction.update(assignmentRef, updates);
        return "updated";
      });
      if (result === "not_assigned") return res.status(403).json({ error: "This delivery is not assigned to your account." });
      if (result === "already_paid") return res.status(409).json({ error: "This payment is already marked Paid. The amount can no longer be edited by delivery staff." });
      return res.json({ success: true, updated_at: now });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Could not update delivery details." });
    }
  });

  app.post("/api/delivery/assignments/admin-list", async (req: Request, res: Response) => {
    const { store_id, admin_pin } = req.body || {};
    try {
      const manager = await requireDeliveryAssignmentManager(req, req.body || {});
      if (!manager) return res.status(403).json({ error: "Authorized Admin or Sales panel access is required." });
      const storeId = String(req.body?.store_id || "").trim().toLowerCase();
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const snap = await adminDb.collection("delivery_assignments")
        .where("owner_store_id", "==", storeId).get();
      return res.json({ assignments: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Could not load delivery assignments." });
    }
  });

  app.post("/api/delivery/assignments/payment", async (req: Request, res: Response) => {
    const { store_id, admin_pin, assignment_id, delivery_fee, payment_status, payment_timing } = req.body || {};
    try {
      const admin = await requireDeliveryAdmin(req, store_id, admin_pin);
      if (!admin) return res.status(403).json({ error: "Only Admin can control delivery payments." });
      const storeId = String(store_id || "").trim().toLowerCase();
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const id = String(assignment_id || "").trim();
      const fee = Number(delivery_fee);
      if (!id || !Number.isFinite(fee) || fee < 0 || fee > 1000000 ||
          !["paid", "unpaid"].includes(String(payment_status)) ||
          !["advance", "after_delivery"].includes(String(payment_timing))) {
        return res.status(400).json({ error: "Invalid delivery payment details." });
      }

      const assignmentRef = adminDb.collection("delivery_assignments").doc(id);
      // One stable expense document per delivery assignment prevents duplicate
      // expense rows when an Admin saves the same Paid record more than once.
      const expenseRef = adminDb.collection("expenses").doc(`delivery_payment_${id}`);
      const now = new Date().toISOString();

      const result = await adminDb.runTransaction(async (transaction) => {
        const assignmentSnap = await transaction.get(assignmentRef);
        if (!assignmentSnap.exists || assignmentSnap.data()?.owner_store_id !== storeId) {
          throw new Error("DELIVERY_ASSIGNMENT_NOT_FOUND");
        }
        const assignment = assignmentSnap.data() || {};
        const paymentWasAlreadyPaid = String(assignment.payment_status || "").toLowerCase() === "paid";
        const paymentReceivedAt = payment_status === "paid"
          ? (paymentWasAlreadyPaid && assignment.payment_received_at ? String(assignment.payment_received_at) : now)
          : "";

        transaction.update(assignmentRef, {
          delivery_fee: fee,
          payment_status,
          payment_timing,
          payment_updated_at: now,
          payment_updated_by: admin.uid,
          payment_received_at: paymentReceivedAt
        });

        if (payment_status === "paid") {
          const invoiceNo = String(assignment.invoice_no || "");
          const driverName = String(assignment.driver_name || "Delivery Staff");
          const customerName = String(assignment.customer_name || "Customer");
          const customerNote = String(assignment.customer_note || assignment.customerNote || assignment.note || "");
          const deliveryNote = String(assignment.delivery_note || assignment.deliveryNote || "");
          const noteParts = [
            `Delivery payment to: ${driverName}`,
            `Delivery Challan / Invoice: ${invoiceNo || id}`,
            `Customer: ${customerName}`,
            customerNote ? `Customer Note: ${customerNote}` : "",
            deliveryNote ? `Delivery Note: ${deliveryNote}` : ""
          ].filter(Boolean);
          const expenseDate = paymentReceivedAt.slice(0, 10);

          transaction.set(expenseRef, {
            id: expenseRef.id,
            category: "Delivery Payment",
            amount: fee,
            description: noteParts.join(" | "),
            date: expenseDate,
            source: "delivery_payment",
            source_id: id,
            assignment_id: id,
            invoice_no: invoiceNo,
            driver_uid: String(assignment.driver_uid || ""),
            driver_name: driverName,
            customer_name: customerName,
            customer_phone: String(assignment.customer_phone || ""),
            customer_address: String(assignment.customer_address || ""),
            customer_note: customerNote,
            delivery_note: deliveryNote,
            payment_timing,
            payment_status: "paid",
            user_id: admin.uid,
            userId: admin.uid,
            owner_id: admin.uid,
            store_id: storeId,
            storeId: storeId,
            email: storeId,
            linked_email: storeId,
            linkedEmail: storeId,
            deleted: false,
            isDeleted: false,
            created_at: paymentWasAlreadyPaid ? (assignment.payment_received_at || now) : now,
            updated_at: now
          }, { merge: true });
        } else {
          // Reversing Paid -> Unpaid removes the linked expense from Net Profit.
          transaction.delete(expenseRef);
        }

        return { payment_received_at: paymentReceivedAt, expense_id: payment_status === "paid" ? expenseRef.id : "" };
      });

      return res.json({ success: true, payment_updated_at: now, ...result });
    } catch (error: any) {
      if (error?.message === "DELIVERY_ASSIGNMENT_NOT_FOUND") {
        return res.status(404).json({ error: "Delivery assignment not found." });
      }
      console.warn("[delivery/assignments/payment] Failed:", error?.message || "Unknown error");
      return res.status(503).json({ error: error?.message || "Could not update delivery payment." });
    }
  });

  app.post("/api/delivery/assignments/status", async (req: Request, res: Response) => {
    const { store_id, admin_pin, assignment_id, delivery_status } = req.body || {};
    try {
      const admin = await requireDeliveryAdmin(req, store_id, admin_pin);
      if (!admin) return res.status(403).json({ error: "Admin login and current Admin PIN are required." });
      const storeId = String(store_id || "").trim().toLowerCase();
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const id = String(assignment_id || "").trim();
      if (!id || !["assigned", "delivered", "failed", "returned"].includes(String(delivery_status))) {
        return res.status(400).json({ error: "Invalid delivery status." });
      }
      const ref = adminDb.collection("delivery_assignments").doc(id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.owner_store_id !== storeId) return res.status(404).json({ error: "Delivery assignment not found." });
      await ref.update({ delivery_status, status_updated_at: new Date().toISOString(), status_updated_by: admin.uid });
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Could not update delivery status." });
    }
  });

  app.post("/api/delivery/expenses", async (req: Request, res: Response) => {
    const { amount, reason, category, date, assignment_id } = req.body || {};
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) return res.status(401).json({ error: "Valid Firebase login required." });
      const staff = await getDeliveryStaff(verified.uid);
      if (!staff || staff.status !== "active" || !staff.owner_store_id) {
        return res.status(403).json({ error: "Active delivery staff account required." });
      }
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const cleanAmount = Number(amount);
      const cleanReason = String(reason || "").trim();
      const cleanCategory = String(category || "Other").trim().slice(0, 60);
      const cleanDate = String(date || "");
      if (!Number.isFinite(cleanAmount) || cleanAmount <= 0 || cleanAmount > 1000000) return res.status(400).json({ error: "Enter a valid expense amount." });
      if (cleanReason.length < 2 || cleanReason.length > 500) return res.status(400).json({ error: "Enter an expense reason (2–500 characters)." });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) || Number.isNaN(Date.parse(cleanDate))) return res.status(400).json({ error: "Enter a valid expense date." });

      let assignmentId = "";
      if (assignment_id) {
        assignmentId = String(assignment_id);
        const assignment = await adminDb.collection("delivery_assignments").doc(assignmentId).get();
        if (!assignment.exists || assignment.data()?.driver_uid !== verified.uid || assignment.data()?.owner_store_id !== staff.owner_store_id) {
          return res.status(403).json({ error: "Expense must belong to one of your assigned deliveries." });
        }
      }
      const ref = adminDb.collection("delivery_expenses").doc();
      const record = {
        id: ref.id,
        owner_store_id: staff.owner_store_id,
        driver_uid: verified.uid,
        driver_name: String(staff.name || ""),
        amount: cleanAmount,
        reason: cleanReason,
        category: cleanCategory,
        date: cleanDate,
        assignment_id: assignmentId,
        payment_status: "unpaid",
        created_at: new Date().toISOString()
      };
      await ref.set(record);
      return res.status(201).json({ success: true, expense: record });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Could not submit delivery expense." });
    }
  });

  app.get("/api/delivery/expenses/mine", async (req: Request, res: Response) => {
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) return res.status(401).json({ error: "Valid Firebase login required." });
      const staff = await getDeliveryStaff(verified.uid);
      if (!staff || staff.status !== "active" || !staff.owner_store_id) {
        return res.status(403).json({ error: "Active delivery staff account required." });
      }
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const snap = await adminDb.collection("delivery_expenses")
        .where("driver_uid", "==", verified.uid).get();
      const expenses = snap.docs
        .filter(d => d.data().owner_store_id === staff.owner_store_id)
        .map(d => ({ id: d.id, ...d.data() }));
      return res.json({ expenses });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Could not load your delivery expenses." });
    }
  });

  app.post("/api/delivery/expenses/admin-list", async (req: Request, res: Response) => {
    const { store_id, admin_pin, payment_status } = req.body || {};
    try {
      const admin = await requireDeliveryAdmin(req, store_id, admin_pin);
      if (!admin) return res.status(403).json({ error: "Primary Admin login and current Admin PIN are required." });
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const storeId = String(store_id || "").trim().toLowerCase();
      const snap = await adminDb.collection("delivery_expenses").where("owner_store_id", "==", storeId).get();
      const expenses = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((item: any) => (payment_status !== "paid" && payment_status !== "unpaid") || item.payment_status === payment_status);
      return res.json({ expenses });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Could not load delivery expenses." });
    }
  });

  app.post("/api/delivery/expenses/payment-status", async (req: Request, res: Response) => {
    const { store_id, admin_pin, expense_id, payment_status } = req.body || {};
    try {
      const admin = await requireDeliveryAdmin(req, store_id, admin_pin);
      if (!admin) return res.status(403).json({ error: "Admin login and current Admin PIN are required." });
      const storeId = String(store_id || "").trim().toLowerCase();
      if (!adminDb) return res.status(503).json({ error: "Delivery service is not configured." });
      const id = String(expense_id || "").trim();
      if (!id || !["paid", "unpaid"].includes(String(payment_status))) return res.status(400).json({ error: "Invalid expense payment status." });
      const ref = adminDb.collection("delivery_expenses").doc(id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.owner_store_id !== storeId) return res.status(404).json({ error: "Delivery expense not found." });
      await ref.update({ payment_status, reviewed_at: new Date().toISOString(), reviewed_by: admin.uid });
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || "Could not update expense payment status." });
    }
  });

  app.get("/api/passcode_syncs/get", async (req: Request, res: Response) => {
    const { id, email } = req.query;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) {
        return res.status(401).json({ error: "Access Denied: Unauthenticated user request." });
      }

      if (email) {
        const cleanEmail = String(email).trim().toLowerCase();
        if (cleanEmail !== verified.email && cleanEmail !== verified.uid) {
          return res.status(403).json({ error: "Access Forbidden: Mismatched credentials." });
        }

        const passcodeRef = collection(db, "passcode_syncs");
        const q = query(passcodeRef, where("linked_email", "==", cleanEmail));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const docs = querySnap.docs.map(docSnapshot => docSnapshot.data());
          docs.sort((a: any, b: any) => {
            const t1 = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const t2 = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return t2 - t1;
          });

          const resDoc = docs[0];
          if (resDoc && resDoc.user_id && resDoc.user_id !== verified.uid) {
            return res.status(403).json({ error: "Access Forbidden: Vault belongs to another user." });
          }
          return res.json(resDoc);
        }
        return res.json(null);
      }

      if (!id) {
        return res.status(400).json({ error: "Missing id or email parameter" });
      }

      const docSnap = await getDoc(doc(db, "passcode_syncs", String(id)));
      if (docSnap.exists()) {
        const syncData = docSnap.data();
        if (syncData.user_id && syncData.user_id !== verified.uid && syncData.linked_email !== verified.email) {
          return res.status(403).json({ error: "Access Forbidden: Vault belongs to another user." });
        }
        return res.json(syncData);
      }
      res.json(null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/passcode_syncs/upsert", async (req: Request, res: Response) => {
    const { payload } = req.body;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) {
        return res.status(401).json({ error: "Access Denied: Unauthenticated user request." });
      }

      if (payload && payload.id) {
        const docRef = doc(db, "passcode_syncs", payload.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const existing = docSnap.data();
          if (existing.user_id && existing.user_id !== verified.uid && existing.linked_email !== verified.email) {
            return res.status(403).json({ error: "Access Forbidden: Vault belongs to another user." });
          }

          const incomingProductsCount = (payload.products || []).length;
          const incomingTransactionsCount = (payload.transactions || []).length;
          
          if (incomingProductsCount === 0 && incomingTransactionsCount === 0) {
            const existingProductsCount = (existing.products || []).length;
            const existingTransactionsCount = (existing.transactions || []).length;
            if (existingProductsCount > 0 || existingTransactionsCount > 0) {
              console.log(`[Server Sync] Stopped blank payload override for sync ID: ${payload.id}`);
              return res.json({ success: true, ignored: true, message: "Protected existing non-empty cloud backup." });
            }
          }
        }

        const enrichedPayload = {
          ...payload,
          user_id: verified.uid,
          userId: verified.uid,
          linked_email: verified.email,
          updated_at: new Date().toISOString()
        };

        await setDoc(docRef, enrichedPayload);
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "Invalid sync payload format." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Endpoint: Intelligent Business Insights
  app.post("/api/ai/insights", async (req: Request, res: Response) => {
    const { transactions, expenses, products } = req.body;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) return res.status(401).json({ error: "Valid Firebase login required." });
      const dataSummary = {
        transactions: (transactions || []).slice(0, 30).map((t: any) => ({ type: t.type, total: t.total, date: t.date })),
        expenses: (expenses || []).map((e: any) => ({ cat: e.category, amount: e.amount, desc: e.description })),
        products: (products || []).map((p: any) => ({ name: p.name, stock: p.stock, buy: p.buyPrice, sell: p.sellPrice }))
      };

      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        // Silent default dynamic fallback
        res.json(getDynamicFallbackInsights(transactions, expenses, products));
        return;
      }

      const prompt = `You are a professional retail and shop business analytical advisor. Analyze the store's current transactions, expenses, and products data in JSON format: ${JSON.stringify(dataSummary)}. Suggest 3 strategic business decisions or insights written strictly in a professional mixture of elegant Bengali and English (Banglish / pure Bengali with key business nouns in English) for local small/medium shop operations. For example, explain stock management, profit margins, expense categories, and customer credits.
Format the output ONLY as a valid JSON list of objects with the exact schema block:
[{"title":"Title Text (Mixed Bengali-English Title)","description":"Detailed actionable advice with bold marker '**' for emphasis","type":"warning"|"success"|"info"}]`;

      let jsonStr = "[]";
      try {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              systemInstruction: "You are an elite, friendly business auditor specializing in retail stores and general shops."
            }
          });
          jsonStr = response.text?.trim() || "[]";
        } catch (firstTryErr: any) {
          console.log("[AI Insights] Primary gemini-3.6-flash experiencing high demand. Trying backup model gemini-3.1-flash-lite...");
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              systemInstruction: "You are an elite, friendly business auditor specializing in retail stores and general shops."
            }
          });
          jsonStr = response.text?.trim() || "[]";
        }
      } catch (geminiErr: any) {
        console.log("[AI Insights] Serving live high-fidelity fallback insights (models offline or busy).");
        res.json(getDynamicFallbackInsights(transactions, expenses, products));
        return;
      }

      try {
        const result = JSON.parse(jsonStr);
        res.json(result);
      } catch (jsonErr: any) {
        res.json(getDynamicFallbackInsights(transactions, expenses, products));
      }
    } catch (error: any) {
      res.json(getDynamicFallbackInsights(transactions, expenses, products));
    }
  });

  // API Endpoint: Intelligent Expense Classification
  app.post("/api/ai/expense-category", async (req: Request, res: Response) => {
    const { description } = req.body;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) return res.status(401).json({ error: "Valid Firebase login required." });
      if (!description) {
        res.json({ category: "Others" });
        return;
      }

      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        res.json({ category: classifyExpenseLocally(description) });
        return;
      }

      const categories = ["Rent", "Electricity", "Salary", "Marketing", "Others"];
      const prompt = `Classify this business expense based on its description: "${description}". Choose exactly one category from this restricted list: ${categories.join(", ")}. Return only the category name directly, with no surrounding quotes or markings.`;

      let category = "";
      try {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt
          });
          category = response.text?.trim() || "";
        } catch (firstTryErr) {
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt
          });
          category = response.text?.trim() || "";
        }
      } catch (geminiErr) {
        category = classifyExpenseLocally(description);
      }

      const finalCategory = category || classifyExpenseLocally(description);
      res.json({ category: finalCategory });
    } catch (error: any) {
      res.json({ category: classifyExpenseLocally(description) });
    }
  });

  // Fallback translation and digit conversion helpers
  function cleanBanglaDigits(str: string): string {
    if (!str) return "";
    const map: { [key: string]: string } = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    return str.replace(/[০-৯]/g, (m) => map[m] || m).replace(/[^0-9]/g, "");
  }

  function fallbackTranslateText(str: string): string {
    if (!str) return "";
    return str; // Fallback directly if no API has run
  }

  // API Endpoint: Translate and Transliterate Customer/Partner Bengali Info to English
  app.post("/api/ai/translate-partner", async (req: Request, res: Response) => {
    const { name, phone, address } = req.body;
    try {
      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        res.json({
          name: fallbackTranslateText(name),
          phone: cleanBanglaDigits(phone),
          address: fallbackTranslateText(address)
        });
        return;
      }

      const prompt = `You are a professional Bangladeshi bilingual translator and transliterator.
Your task is to translate and transliterate the given customer information to standard, professional English.

Input Data:
- Name: "${name}"
- Phone: "${phone}"
- Address: "${address}"

Instructions:
1. Transliterate or translate the Bengali name to standard English letters (e.g., "মোঃ রফিকুল ইসলাম" -> "Md. Rofiqul Islam", "সাকিব হাসান" -> "Sakib Hasan", "সজীব সিকদার" -> "Sajib Shikder").
2. Translate/transliterate the address details to professional English (e.g., "গুলশান-২, রোড ৪, ঢাকা" -> "Gulshan-2, Road 4, Dhaka", "মিরপুর ২" -> "Mirpur 2").
3. Convert all Bengali digits (০-৯) to standard English digits (0-9) in the phone number and remove any character except numbers.
4. Response MUST strictly be a direct JSON object containing ONLY keys: "name", "phone", and "address". No explanations, no markdown block tickers.

Example response structure:
{
  "name": "Translated Name",
  "phone": "01712345678",
  "address": "Translated Address"
}`;

      let resultObj = { name, phone, address };
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt
        });
        const text = response.text?.trim() || "";
        const cleanJson = text.replace(/```json/i, "").replace(/```/g, "").trim();
        resultObj = JSON.parse(cleanJson);
      } catch (geminiErr) {
        resultObj = {
          name: fallbackTranslateText(name),
          phone: cleanBanglaDigits(phone),
          address: fallbackTranslateText(address)
        };
      }
      res.json(resultObj);
    } catch (error: any) {
      res.json({
        name: fallbackTranslateText(name),
        phone: cleanBanglaDigits(phone),
        address: fallbackTranslateText(address)
      });
    }
  });

  // The Vite frontend is served by Vercel's static output. Only local development
  // attaches Vite middleware and starts an HTTP listener.
  if (options.serveFrontend) {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  return app;
}

let serverlessAppPromise: ReturnType<typeof createApp> | null = null;
export function getServerlessApp() {
  if (!serverlessAppPromise) serverlessAppPromise = createApp({ serveFrontend: false });
  return serverlessAppPromise;
}

async function startServer() {
  const app = await createApp({ serveFrontend: true });
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Proxy Server] running on http://localhost:${PORT}`);
  });
}

// Vercel imports this module for the API function; local development still starts normally.
if (process.env.VERCEL !== "1") {
  startServer();
}
