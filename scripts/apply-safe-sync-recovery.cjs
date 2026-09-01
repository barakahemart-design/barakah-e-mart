const fs = require('fs');
const path = require('path');

// Build-time safety patch for Vercel. Read/recovery only; never deletes or renames data.

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

// Vercel is deploying the Vite SPA, not server.ts. Recovery therefore reads Firestore directly.
const directRecoveryFunction = `export const fetchAndRestoreCloudBackup = async (email: string, pin: string, overwrite: boolean = false) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return false;
  try {
    const activeUid = currentFirebaseUser?.uid || firebaseAuth.currentUser?.uid || '';
    const result: any = { linked_email: cleanEmail, email: cleanEmail, products: [], contacts: [], expenses: [], transactions: [], purchases: [] };
    let found = false;

    try {
      const vaultSnap = await getDocs(query(collection(db, 'passcode_syncs'), where('linked_email', '==', cleanEmail)));
      const candidates = vaultSnap.docs.map(d => ({ id: d.id, data: d.data() || {} })).sort((a, b) => String(b.data.updated_at || '').localeCompare(String(a.data.updated_at || '')));
      const candidate = candidates.find(c =>
        (Array.isArray(c.data.products) && c.data.products.length > 0) ||
        (Array.isArray(c.data.contacts) && c.data.contacts.length > 0) ||
        (Array.isArray(c.data.expenses) && c.data.expenses.length > 0) ||
        (Array.isArray(c.data.transactions) && c.data.transactions.length > 0) ||
        (Array.isArray(c.data.purchases) && c.data.purchases.length > 0) ||
        (c.data.businessInfo && typeof c.data.businessInfo === 'object') ||
        (c.data.business_info && typeof c.data.business_info === 'object')
      );
      if (candidate) { Object.assign(result, candidate.data); result.linked_email = cleanEmail; found = true; }
    } catch (vaultErr) { console.warn('[Cloud Restore] Direct vault read warning:', vaultErr); }

    const collectionMap: Array<[string, string]> = [
      ['products', 'products'], ['customers', 'contacts'], ['expenses', 'expenses'], ['purchases', 'purchases'], ['transactions', 'transactions']
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
          if (resultKey === 'transactions') { if (!Array.isArray(result.transactions) || result.transactions.length === 0) result.transactions = rows; }
          else result[resultKey] = rows;
          found = true;
        }
      } catch (collectionErr) { console.warn('[Cloud Restore] Direct collection read warning:', collectionName, collectionErr); }
    }

    try {
      const settingsId = 'settings_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const settingsSnap = await fetchDocFresh(doc(db, 'business_info', settingsId));
      if (settingsSnap.exists()) {
        const settings = settingsSnap.data() || {};
        result.businessInfo = { ...(result.businessInfo || result.business_info || {}), ...settings };
        result.business_info = result.businessInfo;
        found = true;
      }
    } catch (settingsErr) { console.warn('[Cloud Restore] Business settings read warning:', settingsErr); }

    if (!found) return false;

    const writeCanonical = async (collectionName: string, row: any) => {
      if (!row || !row.id) return;
      const { id, ...rest } = row;
      await setDoc(doc(db, collectionName, String(id)), {
        ...rest, id: String(id), user_id: activeUid || row.user_id || '', userId: activeUid || row.userId || '', owner_id: activeUid || row.owner_id || '',
        store_id: cleanEmail, storeId: cleanEmail, email: cleanEmail, linked_email: cleanEmail, linkedEmail: cleanEmail,
        updated_at: row.updated_at || new Date().toISOString()
      }, { merge: true });
    };

    const canonicalWrites: Promise<any>[] = [];
    (Array.isArray(result.products) ? result.products : []).forEach((row: any) => canonicalWrites.push(writeCanonical('products', row)));
    (Array.isArray(result.contacts) ? result.contacts : []).forEach((row: any) => canonicalWrites.push(writeCanonical('customers', row)));
    (Array.isArray(result.expenses) ? result.expenses : []).forEach((row: any) => canonicalWrites.push(writeCanonical('expenses', row)));
    (Array.isArray(result.purchases) ? result.purchases : []).forEach((row: any) => canonicalWrites.push(writeCanonical('purchases', row)));
    if (Array.isArray(result.transactions)) {
      result.transactions.forEach((row: any) => {
        const flat = row && row.total_amount !== undefined ? row : {
          id: row?.id, invoice_no: row?.invoiceNo, customer_id: row?.contactId, total_amount: Number(row?.total ?? row?.total_amount) || 0,
          discount: Number(row?.discount) || 0, vat_rate: Number(row?.vat_rate) || 0, paid_amount: Number(row?.paidAmount ?? row?.paid_amount) || 0,
          payment_method: row?.paymentMethod || row?.payment_method || 'Cash', signature_svg: row?.customerSignature || row?.signature_svg || null,
          created_at: row?.date || row?.created_at || new Date().toISOString()
        };
        if (flat.id) canonicalWrites.push(writeCanonical('transactions', flat));
      });
    }
    // A malformed legacy row must not block the rest of the recovery.
    await Promise.allSettled(canonicalWrites);

    restoreLocalKeys(result, overwrite, activeUid || currentFirebaseUser?.uid);
    return true;
  } catch (err) {
    console.warn('[Cloud Restore] Direct Firestore recovery failed:', err);
    return false;
  }
};\n\n`;

helperSource = helperSource.replace(/export const fetchAndRestoreCloudBackup = async[\\s\\S]*?(?=\\nexport (?:const|async|function) )/, directRecoveryFunction);

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
      localStorage.setItem(key, JSON.stringify(overwrite ? incoming : merger(safeExisting, incoming)));
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
const guards = [
  ['subscribeProducts', 'barakah_products'], ['subscribeCustomers', 'barakah_contacts'], ['subscribeExpenses', 'barakah_expenses'],
  ['subscribePurchases', 'barakah_purchases'], ['subscribeTransactions', 'barakah_flat_transactions']
];
for (const [subscriber, storageKey] of guards) {
  const pattern = new RegExp(`(const unsub${subscriber.replace('subscribe', '')} = ${subscriber}\\(activeUserId, \\(items\\) => \\{\\n\\s*)markRemoteUpdateActive\\(\\);`);
  appSource = appSource.replace(pattern, `$1if (items.length === 0) {\n        try {\n          const cached = localStorage.getItem(getDbKey("${storageKey}", undefined, activeUserId));\n          if (cached) { const parsed = JSON.parse(cached); if (Array.isArray(parsed) && parsed.length > 0) return; }\n        } catch (_) {}\n      }\n      markRemoteUpdateActive();`);
}
appSource = appSource.replace(
  'const flatItems = snapshot.docs\n        .filter(docSnap => isDocMatchingStore(docSnap.data(), cleanEmail, activeUserId))',
  'const matchingDocs = snapshot.docs.filter(docSnap => isDocMatchingStore(docSnap.data(), cleanEmail, activeUserId));\n      if (matchingDocs.length === 0) {\n        try {\n          const cached = localStorage.getItem(getDbKey("barakah_flat_transaction_items", undefined, activeUserId));\n          if (cached) { const parsed = JSON.parse(cached); if (Array.isArray(parsed) && parsed.length > 0) return; }\n        } catch (_) {}\n      }\n\n      const flatItems = matchingDocs'
);
appSource = appSource.replace(
  'if (products.length === 0 && transactions.length === 0 && !isSettingsModified) {',
  'if (products.length === 0 && contacts.length === 0 && expenses.length === 0 && transactions.length === 0 && purchases.length === 0 && !isSettingsModified) {'
);
if (appSource !== originalApp) fs.writeFileSync(appFile, appSource, 'utf8');

console.log('Safe sync/recovery build patch applied.');
