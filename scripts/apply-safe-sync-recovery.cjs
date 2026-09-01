const fs = require('fs');
const path = require('path');

// Safe build-time recovery patch. It only changes read/restore behavior.
// It never deletes, renames, or migrates Firestore records.

const serverFile = path.join(process.cwd(), 'server.ts');
let serverSource = fs.readFileSync(serverFile, 'utf8');
const originalServer = serverSource;
serverSource = serverSource.replace(
  'if ((cleanEmail && docStore === cleanEmail) || (cleanEmail && docUid === cleanEmail) || allowedIds.includes(docUid)) {',
  'if ((cleanEmail && docStore === cleanEmail) || (cleanEmail && docUid === cleanEmail) || allowedIds.includes(docUid) || allowedIds.includes(docId)) {'
);
serverSource = serverSource.replace(
  'if (docStore === cleanEmail || docUid === cleanEmail || allowedIds.includes(docUid)) {',
  'if (docStore === cleanEmail || docUid === cleanEmail || allowedIds.includes(docUid) || allowedIds.includes(docId)) {'
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
    } catch (err) { console.warn('[Cloud Restore] Local restore warning:', err); }
  };
  writeList('barakah_products', data.products, mergeListsById);
  writeList('barakah_contacts', data.contacts, mergeListsById);
  writeList('barakah_expenses', data.expenses, mergeListsById);
  writeList('barakah_purchases', data.purchases, mergeListsById);
  writeList('barakah_transactions', data.transactions, mergeTransactionsLists);
};`;
if (helperSource.includes(disabledRestore)) helperSource = helperSource.replace(disabledRestore, safeRestore);
const loginMarker = '      // Legacy passcode restore disabled on login to prevent overwriting realtime Firestore state';
if (helperSource.includes(loginMarker)) helperSource = helperSource.replace(loginMarker, '      await fetchAndRestoreCloudBackup(cleanEmail, "", false).catch(err => console.warn("[Cloud Restore] Email login restore warning:", err));');
const signupMarker = '      // Legacy passcode restore disabled on signup to prevent overwriting realtime Firestore state';
if (helperSource.includes(signupMarker)) helperSource = helperSource.replace(signupMarker, '      await fetchAndRestoreCloudBackup(cleanEmail, "", false).catch(err => console.warn("[Cloud Restore] Signup recovery warning:", err));');
const passcodeMarker = '  // Legacy passcode restore disabled on passcode login to prevent overwriting realtime Firestore state';
if (helperSource.includes(passcodeMarker)) helperSource = helperSource.replace(passcodeMarker, '  await fetchAndRestoreCloudBackup(cleanEmail, pin, false).catch(err => console.warn("[Cloud Restore] Passcode login restore warning:", err));');
if (helperSource !== originalHelper) fs.writeFileSync(helperFile, helperSource, 'utf8');

const appFile = path.join(process.cwd(), 'src', 'App.tsx');
let appSource = fs.readFileSync(appFile, 'utf8');
const originalApp = appSource;
// Never let an empty realtime snapshot wipe a non-empty local database during startup/reconnect.
appSource = appSource.replace(
  'const unsubProducts = subscribeProducts(activeUserId, (items) => {\n      markRemoteUpdateActive();',
  'const unsubProducts = subscribeProducts(activeUserId, (items) => {\n      if (items.length === 0) return;\n      markRemoteUpdateActive();'
);
appSource = appSource.replace(
  'const unsubCustomers = subscribeCustomers(activeUserId, (items) => {\n      markRemoteUpdateActive();',
  'const unsubCustomers = subscribeCustomers(activeUserId, (items) => {\n      if (items.length === 0) return;\n      markRemoteUpdateActive();'
);
appSource = appSource.replace(
  'const unsubExpenses = subscribeExpenses(activeUserId, (items) => {\n      markRemoteUpdateActive();',
  'const unsubExpenses = subscribeExpenses(activeUserId, (items) => {\n      if (items.length === 0) return;\n      markRemoteUpdateActive();'
);
appSource = appSource.replace(
  'const unsubPurchases = subscribePurchases(activeUserId, (items) => {\n      markRemoteUpdateActive();',
  'const unsubPurchases = subscribePurchases(activeUserId, (items) => {\n      if (items.length === 0) return;\n      markRemoteUpdateActive();'
);
appSource = appSource.replace(
  'const unsubTransactions = subscribeTransactions(activeUserId, (items) => {\n      markRemoteUpdateActive();',
  'const unsubTransactions = subscribeTransactions(activeUserId, (items) => {\n      if (items.length === 0) return;\n      markRemoteUpdateActive();'
);
if (appSource !== originalApp) fs.writeFileSync(appFile, appSource, 'utf8');

console.log('Safe sync/recovery build patch applied.');
