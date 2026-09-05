const fs = require('fs');

function patch(path, fn, label) {
  const before = fs.readFileSync(path, 'utf8');
  const after = fn(before);
  if (after !== before) fs.writeFileSync(path, after, 'utf8');
  console.log(`[stability] ${label}: ${after !== before ? 'patched' : 'unchanged'}`);
}

// Keep the lightweight memory cache. The persistent IndexedDB/multi-tab cache
// introduced by the quota guard can make Safari startup noticeably slower.
patch('src/lib/firebase.ts', source => {
  let next = source
    .replace(/persistentLocalCache\(\{\s*tabManager:\s*persistentMultipleTabManager\(\)\s*\}\)/g, 'memoryLocalCache()')
    .replace(/\s*persistentMultipleTabManager,?\s*/g, '\n')
    .replace(/\nasync function testConnection\(\) \{[\s\S]*?\n\}\n\ntestConnection\(\);\s*$/m, '\n');
  return next;
}, 'Firebase startup path');

// Reports: use exact calendar-day boundaries. "7 Days" means today + the
// previous six calendar days, never eight days and never an entire month.
patch('src/components/ReportsView.tsx', source => {
  const start = source.indexOf('  const isDateInFilter = (dateStr: any) => {');
  const end = source.indexOf('\n  // Filter records in real time', start);
  if (start < 0 || end < 0) return source;
  const replacement = `  const isDateInFilter = (dateStr: any) => {
    try {
      if (!dateStr) return false;
      const date = safeDate(dateStr);
      const now = new Date();
      if (!date || isNaN(date.getTime())) return false;
      if (filterType === 'all') return true;
      if (filterType === 'yearly') return date.getFullYear() === now.getFullYear();
      if (filterType === 'custom') {
        if (!startDate || !endDate) return false;
        const s = safeStartOfDay(startDate);
        const e = safeEndOfDay(endDate);
        return !!s && !!e && safeIsWithinInterval(date, { start: s, end: e });
      }
      const today = safeStartOfDay(now);
      if (!today) return false;
      if (filterType === 'today') {
        const end = safeEndOfDay(today);
        return !!end && safeIsWithinInterval(date, { start: today, end });
      }
      if (filterType === 'yesterday') {
        const yesterday = safeSubDays(today, 1);
        const end = yesterday ? safeEndOfDay(yesterday) : null;
        return !!yesterday && !!end && safeIsWithinInterval(date, { start: yesterday, end });
      }
      if (filterType === 'weekly') {
        const sevenDayStart = safeSubDays(today, 6);
        const end = safeEndOfDay(today);
        return !!sevenDayStart && !!end && safeIsWithinInterval(date, { start: sevenDayStart, end });
      }
      if (filterType === 'monthly') {
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      }
    } catch (_) { return false; }
    return false;
  };
`;
  return source.slice(0, start) + replacement + source.slice(end);
}, 'Reports date filters');

// Firebase Auth.currentUser can be temporarily null while Auth is initializing.
// Never permanently lose the realtime subscription because it was requested too early.
patch('src/lib/firestoreService.ts', source => {
  let next = source;
  next = next.replace(
    "import { db, auth } from './firebase';",
    "import { db, auth } from './firebase';\nimport { onAuthStateChanged } from 'firebase/auth';"
  );
  const old = `    if (!currentUser || !storeId) {
      console.warn(\`[Realtime Listener] Waiting for authenticated account: \${collName}\`);
      return () => {};
    }`;
  const replacement = `    if (!currentUser || !storeId) {
      let innerUnsubscribe: (() => void) | null = null;
      let active = true;
      const authUnsubscribe = onAuthStateChanged(auth, (readyUser) => {
        if (!active || !readyUser) return;
        if (innerUnsubscribe) innerUnsubscribe();
        innerUnsubscribe = createSubscription(collName)(userIdentifier, callback);
      });
      return () => {
        active = false;
        authUnsubscribe();
        if (innerUnsubscribe) innerUnsubscribe();
      };
    }`;
  next = next.replace(old, replacement);
  return next;
}, 'Realtime auth initialization');

// IMPORTANT: transaction_items must be account-scoped. The old whole-collection
// listener scanned every store on every device and could also rebuild an empty
// transaction list before the account's transaction snapshot arrived. Use the
// already account-filtered subscription instead.
patch('src/App.tsx', source => {
  const oldStart = '    // 6. TRANSACTION ITEMS SUBSCRIBER\n';
  const oldEnd = '    // 7. BUSINESS INFO / SETTINGS SUBSCRIBER\n';
  const start = source.indexOf(oldStart);
  const end = source.indexOf(oldEnd, start);
  if (start < 0 || end < 0) return source;

  const replacement = `    // 6. TRANSACTION ITEMS SUBSCRIBER\n    // Account-scoped listener: never scan every transaction item in Firestore.\n    const unsubItems = subscribeTransactionItems(activeUserId, (items) => {\n      markRemoteUpdateActive();\n\n      const flatItems = items.map((docData: any) => ({\n        id: docData.id,\n        firestoreId: docData.firestoreId,\n        transaction_id: docData.transaction_id,\n        product_id: docData.product_id || null,\n        product_name: docData.product_name || \"Product Item\",\n        quantity: Number(docData.quantity) || 0,\n        sell_price: Number(docData.sell_price) || 0,\n        cost_price: docData.cost_price !== undefined ? Number(docData.cost_price) : 0\n      }));\n\n      localStorage.setItem(getDbKey(\"barakah_flat_transaction_items\", undefined, activeUserId), JSON.stringify(flatItems));\n      handleTransactionsChange(undefined, flatItems);\n    });\n\n`;
  return source.slice(0, start) + replacement + source.slice(end);
}, 'Account-scoped transaction item listener');

// Make checkout writes authoritative. Firestore listeners can show local data
// immediately, but the checkout must not report success until the main sale is
// acknowledged by the backend. This prevents a sale from appearing locally and
// then failing to appear on another device after reload.
patch('src/App.tsx', source => {
  const old = `        saveTransaction(activeUserId, flatTxItem).catch(err => {\n          console.error(\"Cloud save transaction failed:\", err);\n        });`;
  const replacement = `        await saveTransaction(activeUserId, flatTxItem);`;
  return source.replace(old, replacement);
}, 'Authoritative sale save');

// Save the transaction/item under the business owner's canonical store email
// when business settings already identify it. This keeps Admin and Sales panels
// on the same Firestore partition even if their Firebase auth UID/email differs.
patch('src/App.tsx', source => {
  const oldTx = `        store_id: cleanEmail,\n        email: cleanEmail`;
  const replacementTx = `        store_id: (businessInfo?.email || cleanEmail).trim().toLowerCase(),\n        storeId: (businessInfo?.email || cleanEmail).trim().toLowerCase(),\n        linked_email: (businessInfo?.email || cleanEmail).trim().toLowerCase(),\n        email: cleanEmail`;
  let next = source.replace(oldTx, replacementTx);
  const oldItem = `            store_id: cleanEmail,\n            email: cleanEmail`;
  const replacementItem = `            store_id: (businessInfo?.email || cleanEmail).trim().toLowerCase(),\n            storeId: (businessInfo?.email || cleanEmail).trim().toLowerCase(),\n            linked_email: (businessInfo?.email || cleanEmail).trim().toLowerCase(),\n            email: cleanEmail`;
  return next.replace(oldItem, replacementItem);
}, 'Canonical business store identity on checkout');

// The realtime service uses the same canonical business email as checkout when
// that identity has already been hydrated for the authenticated UID.
patch('src/lib/firestoreService.ts', source => {
  const old = `export function getActiveStoreEmail(): string {\n  return (auth.currentUser?.email || '').trim().toLowerCase();\n}`;
  const replacement = `export function getActiveStoreEmail(): string {\n  const user = auth.currentUser;\n  const authEmail = (user?.email || '').trim().toLowerCase();\n  if (typeof window === 'undefined' || !user?.uid) return authEmail;\n  try {\n    const key = \`BARAKAH_DB_\${user.uid}_business_info\`;\n    const raw = window.localStorage.getItem(key);\n    if (raw) {\n      const info = JSON.parse(raw);\n      const businessEmail = String(info?.email || info?.linked_email || '').trim().toLowerCase();\n      if (businessEmail && businessEmail.includes('@')) return businessEmail;\n    }\n  } catch (_) {}\n  return authEmail;\n}`;
  return source.replace(old, replacement);
}, 'Canonical realtime store identity');

console.log('[stability] complete');
