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

console.log('[stability] complete');
