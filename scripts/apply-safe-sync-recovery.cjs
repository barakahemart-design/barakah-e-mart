const fs = require('fs');
const path = require('path');

// Build-time safety patch for Vercel. Read/recovery only; never deletes or renames data.

const serverFile = path.join(process.cwd(), 'server.ts');
let serverSource = fs.readFileSync(serverFile, 'utf8');
const originalServer = serverSource;

// Legacy collection documents may use their old identity as the Firestore document id.
serverSource = serverSource.replace(
  'if ((cleanEmail && docStore === cleanEmail) || (cleanEmail && docUid === cleanEmail) || allowedIds.includes(docUid)) {',
  'if ((cleanEmail && docStore === cleanEmail) || (cleanEmail && docUid === cleanEmail) || allowedIds.includes(docUid) || allowedIds.includes(docId)) {'
);
serverSource = serverSource.replace(
  'if (docStore === cleanEmail || docUid === cleanEmail || allowedIds.includes(docUid)) {',
  'if (docStore === cleanEmail || docUid === cleanEmail || allowedIds.includes(docUid) || allowedIds.includes(docId)) {'
);

// A legacy vault is safe to READ when its linked email is the authenticated account,
// even if its historical user_id belongs to an older Firebase identity.
serverSource = serverSource.replace(
  'if (resDoc && resDoc.user_id && resDoc.user_id !== verified.uid) {\n            return res.status(403).json({ error: "Access Forbidden: Vault belongs to another user." });',
  'if (resDoc && resDoc.user_id && resDoc.user_id !== verified.uid && String(resDoc.linked_email || "").trim().toLowerCase() !== String(verified.email || "").trim().toLowerCase()) {\n            return res.status(403).json({ error: "Access Forbidden: Vault belongs to another user." });'
);
serverSource = serverSource.replace(
  'if (syncData.user_id && syncData.user_id !== verified.uid && syncData.linked_email !== verified.email) {\n          return res.status(403).json({ error: "Access Forbidden: Vault belongs to another user." });',
  'if (syncData.user_id && syncData.user_id !== verified.uid && String(syncData.linked_email || "").trim().toLowerCase() !== String(verified.email || "").trim().toLowerCase()) {\n          return res.status(403).json({ error: "Access Forbidden: Vault belongs to another user." });'
);

if (serverSource !== originalServer) fs.writeFileSync(serverFile, serverSource, 'utf8');

const helperFile = path.join(process.cwd(), 'src', 'lib', 'firebase-helpers.ts');
let helperSource = fs.readFileSync(helperFile, 'utf8');
const originalHelper = helperSource;

// Vercel serves this app as a Vite SPA, so /api/* is not an Express runtime.
// Replace the old API-dependent restore routine with a direct Firestore recovery path.
const directRecoveryFunction = `export const fetchAndRestoreCloudBackup = async (email: string, pin: string, overwrite: boolean = false) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return false;

  try {
    const activeUid = currentFirebaseUser?.uid || firebaseAuth.currentUser?.uid || '';
    const result: any = {
      linked_email: cleanEmail,
      email: cleanEmail,
      products: [],
      contacts: [],
      expenses: [],
      transactions: [],
      purchases: []
    };
    let found = false;

    // 1) Recover the newest non-empty vault for this exact account email.
    try {
      const vaultSnap = await getDocs(query(collection(db, 'passcode_syncs'), where('linked_email', '==', cleanEmail)));
      const candidates = vaultSnap.docs
        .map(d => ({ id: d.id, data: d.data() || {} }))
        .sort((a, b) => String(b.data.updated_at || '').localeCompare(String(a.data.updated_at || '')));

      const nonEmpty = candidates.find(c =>
        (Array.isArray(c.data.products) && c.data.products.length) ||
        (Array.isArray(c.data.contacts) && c.data.contacts.length) ||
        (Array.isArray(c.data.expenses) && c.data.expenses.length) ||
        (Array.isArray(c.data.transactions) && c.data.transactions.length) ||
        (Array.isArray(c.data.purchases) && c.data.purchases.length) ||
        (c.data.businessInfo && typeof c.data.businessInfo === 'object') ||
        (c.data.business_info && typeof c.data.business_info === 'object')
      );

      if (nonEmpty) {
        Object.assign(result, nonEmpty.data);
        result.linked_email = cleanEmail;
        found = true;
      }
    } catch (vaultErr) {
      console.warn('[Cloud Restore] Direct vault read warning:', vaultErr);
    }

    // 2) Recover granular Firestore collections for the current canonical email/UID.
    const collectionMap: Array<[string, string]> = [
      ['products', 'products'],
      ['customers', 'contacts'],
      ['expenses', 'expenses'],
      ['purchases', 'purchases'],
      ['transactions', 'transactions']
    ];

    for (const [collectionName, resultKey] of collectionMap) {
      try {
        const docsById = new Map<string, any>();
        const storeSnap = await getDocs(query(collection(db, collectionName), where('store_id', '==', cleanEmail)));
        storeSnap.docs.forEach(d => docsById.set(d.id, { ...d.data(), id: d.data()?.id || d.id }));

        if (activeUid) {
          const uidSnap = await getDocs(query(collection(db, collectionName), where('user_id', '==', activeUid)));
          uidSnap.docs.forEach(d => docsById.set(d.id, { ...d.data(), id: d.data()?.id || d.id }));
        }

        if (docsById.size > 0) {
          const rows = Array.from(docsById.values());
          if (resultKey === 'transactions') {
            // Keep the existing nested vault transactions when present; otherwise use flat cloud rows.
            if (!Array.isArray(result.transactions) || result.transactions.length === 0) result.transactions = rows;
          } else {
            result[resultKey] = rows;
          }
          found = true;
        }
      } catch (collectionErr) {
        console.warn('[Cloud Restore] Direct collection read warning:', collectionName, collectionErr);
      }
    }

    // 3) Recover business settings directly.
    try {
      const settingsId = 'settings_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const settingsSnap = await fetchDocFresh(doc(db, 'business_info', settingsId));
      if (settingsSnap.exists()) {
        const settings = settingsSnap.data() || {};
        result.businessInfo = { ...(result.businessInfo || result.business_info || {}), ...settings };
        result.business_info = result.businessInfo;
        found = true;
      }
    } catch (settingsErr) {
      console.warn('[Cloud Restore] Business settings read warning:', settingsErr);
    }

    if (!found) return false;

    restoreLocalKeys(result, overwrite, activeUid || currentFirebaseUser?.uid);
    return true;
  } catch (err) {
    console.warn('[Cloud Restore] Direct Firestore recovery failed:', err);
    return false;
  }
};\n\n`;

helperSource = helperSource.replace(
  /export const fetchAndRestoreCloudBackup = async[\\s\\S]*?(?=\\nexport (?:const|async|function) )/,
  directRecoveryFunction
);

const disabledRestore = `export const restoreLocalKeys = (data: any, overwrite: boolean = false, uid?: string) => {
  // Phase 1: Disabled restoreLocalKeys merge logic
  return;
};`;

const safeRestore = `export const restoreLocalKeys = (data: any, overwrite: boolean = false, uid?: string) => {
  if (!data || typeof window === 'undefined') return;
  const email = String(data.linked_email || data.linkedEmail || data.email || currentFirebaseUser?.email || '').trim().toLowerCase();
  if (!email && !uid) return;
  const targetUid = uid || currentFirebaseUser?.uid || '';

  const writeList = (baseKey: string, incoming: any[], merger: (a: any[], b: any[]) => any[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    try {
      const key = getDbKey(baseKey, email, targetUid);
      const raw = localStorage.getItem(key);
      const existing = raw ? JSON.parse(raw) : [];
      const safeExisting = Array.isArray(existing) ? existing : [];
      const merged = overwrite ? incoming : merger(safeExisting, incoming);
      localStorage.setItem(key, JSON.stringify(merged));
    } catch (err) {
      console.warn('[Cloud Restore] Local restore warning:', err);
    }
  };

  writeList('barakah_products', data.products, mergeListsById);
  writeList('barakah_contacts', data.contacts, mergeListsById);
  writeList('barakah_expenses', data.expenses, mergeListsById);
  writeList('barakah_purchases', data.purchases, mergeListsById);
  writeList('barakah_transactions', data.transactions, mergeTransactionsLists);
};`;

if (helperSource.includes(disabledRestore)) helperSource = helperSource.replace(disabledRestore, safeRestore);

const loginMarker = '      // Legacy passcode restore disabled on login to prevent overwriting realtime Firestore state';
if (helperSource.includes(loginMarker)) {
  helperSource = helperSource.replace(loginMarker, '      await fetchAndRestoreCloudBackup(cleanEmail, "", false).catch(err => console.warn("[Cloud Restore] Email login restore warning:", err));');
}
const signupMarker = '      // Legacy passcode restore disabled on signup to prevent overwriting realtime Firestore state';
if (helperSource.includes(signupMarker)) {
  helperSource = helperSource.replace(signupMarker, '      await fetchAndRestoreCloudBackup(cleanEmail, "", false).catch(err => console.warn("[Cloud Restore] Signup recovery warning:", err));');
}
const passcodeMarker = '  // Legacy passcode restore disabled on passcode login to prevent overwriting realtime Firestore state';
if (helperSource.includes(passcodeMarker)) {
  helperSource = helperSource.replace(passcodeMarker, '  await fetchAndRestoreCloudBackup(cleanEmail, pin, false).catch(err => console.warn("[Cloud Restore] Passcode login restore warning:", err));');
}

if (helperSource !== originalHelper) fs.writeFileSync(helperFile, helperSource, 'utf8');

const appFile = path.join(process.cwd(), 'src', 'App.tsx');
let appSource = fs.readFileSync(appFile, 'utf8');
const originalApp = appSource;

// IMPORTANT: an empty realtime result must never replace a non-empty local database.
const guards = [
  ['subscribeProducts', 'barakah_products'],
  ['subscribeCustomers', 'barakah_contacts'],
  ['subscribeExpenses', 'barakah_expenses'],
  ['subscribePurchases', 'barakah_purchases'],
  ['subscribeTransactions', 'barakah_flat_transactions']
];

for (const [subscriber, storageKey] of guards) {
  const pattern = new RegExp(`(const unsub${subscriber.replace('subscribe', '')} = ${subscriber}\\\\(activeUserId, \\\\(items\\\\) => \\\\{\\\\n\\\\s*)markRemoteUpdateActive\\\\(\\\\);`);
  appSource = appSource.replace(pattern, `$1if (items.length === 0) {\\n        try {\\n          const cached = localStorage.getItem(getDbKey(\"${storageKey}\", undefined, activeUserId));\\n          if (cached) { const parsed = JSON.parse(cached); if (Array.isArray(parsed) && parsed.length > 0) return; }\\n        } catch (_) {}\\n      }\\n      markRemoteUpdateActive();`);
}

// Also protect against an empty transaction-items filtering pass.
appSource = appSource.replace(
  'const flatItems = snapshot.docs\\n        .filter(docSnap => isDocMatchingStore(docSnap.data(), cleanEmail, activeUserId))',
  'const matchingDocs = snapshot.docs.filter(docSnap => isDocMatchingStore(docSnap.data(), cleanEmail, activeUserId));\\n      if (matchingDocs.length === 0) {\\n        try {\\n          const cached = localStorage.getItem(getDbKey("barakah_flat_transaction_items", undefined, activeUserId));\\n          if (cached) { const parsed = JSON.parse(cached); if (Array.isArray(parsed) && parsed.length > 0) return; }\\n        } catch (_) {}\\n      }\\n\\n      const flatItems = matchingDocs'
);

if (appSource !== originalApp) fs.writeFileSync(appFile, appSource, 'utf8');

console.log('Safe sync/recovery build patch applied.');
