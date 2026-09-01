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
// This handles the initial/reconnect race where Firestore briefly reports an empty query.
const guards = [
  ['subscribeProducts', 'barakah_products'],
  ['subscribeCustomers', 'barakah_contacts'],
  ['subscribeExpenses', 'barakah_expenses'],
  ['subscribePurchases', 'barakah_purchases'],
  ['subscribeTransactions', 'barakah_flat_transactions']
];

for (const [subscriber, storageKey] of guards) {
  const pattern = new RegExp(`(const unsub${subscriber.replace('subscribe', '')} = ${subscriber}\\(activeUserId, \\(items\\) => \\{\\n\\s*)markRemoteUpdateActive\\(\\);`);
  appSource = appSource.replace(pattern, `$1if (items.length === 0) {\n        try {\n          const cached = localStorage.getItem(getDbKey("${storageKey}", undefined, activeUserId));\n          if (cached) { const parsed = JSON.parse(cached); if (Array.isArray(parsed) && parsed.length > 0) return; }\n        } catch (_) {}\n      }\n      markRemoteUpdateActive();`);
}

// The transaction-items listener is collection-wide and then filtered locally.
// Never wipe cached transaction items because a reconnect/filtering pass returns zero.
appSource = appSource.replace(
  'const flatItems = snapshot.docs\n        .filter(docSnap => isDocMatchingStore(docSnap.data(), cleanEmail, activeUserId))',
  'const matchingDocs = snapshot.docs.filter(docSnap => isDocMatchingStore(docSnap.data(), cleanEmail, activeUserId));\n      if (matchingDocs.length === 0) {\n        try {\n          const cached = localStorage.getItem(getDbKey("barakah_flat_transaction_items", undefined, activeUserId));\n          if (cached) { const parsed = JSON.parse(cached); if (Array.isArray(parsed) && parsed.length > 0) return; }\n        } catch (_) {}\n      }\n\n      const flatItems = matchingDocs'
);

if (appSource !== originalApp) fs.writeFileSync(appFile, appSource, 'utf8');

console.log('Safe sync/recovery build patch applied.');
