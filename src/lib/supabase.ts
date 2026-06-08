import { 
  cleanDemoProducts, 
  cleanDemoContacts, 
  cleanDemoExpenses, 
  cleanDemoPurchases, 
  cleanDemoTransactions,
  INITIAL_BUSINESS_INFO,
  getDbKey
} from './mockDB';

import { 
  db, 
  auth as firebaseAuth, 
  handleFirestoreError, 
  OperationType 
} from './firebase';

import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';

import { 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where 
} from 'firebase/firestore';

export const isSupabaseConfigured = true;
export const supabase = null as any; // Mock for any uncalled references

let currentSupabaseUser: any = null;
const authListeners = new Set<(user: any) => void>();

const updateCurrentUser = (sessionUser: any) => {
  if (sessionUser) {
    currentSupabaseUser = { 
      uid: sessionUser.id || sessionUser.uid, 
      id: sessionUser.id || sessionUser.uid, 
      email: sessionUser.email, 
      ...sessionUser 
    };
  } else {
    currentSupabaseUser = null;
  }
  authListeners.forEach(cb => cb(currentSupabaseUser));
};

// Listen for firebase auth state alterations
onAuthStateChanged(firebaseAuth, (user: FirebaseUser | null) => {
  if (user) {
    updateCurrentUser({
      id: user.uid,
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified
    });
  } else {
    const cached = localStorage.getItem('barakah_local_active_user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed) {
          updateCurrentUser(parsed);
          return;
        }
      } catch (e) {
        // ignore
      }
    }
    updateCurrentUser(null);
  }
});

// Load standard initial active user cached state if exists
const cachedUser = localStorage.getItem('barakah_local_active_user');
if (cachedUser) {
  try {
    currentSupabaseUser = JSON.parse(cachedUser);
  } catch (e) {
    // ignore
  }
}

export function deduplicateProducts(products: any[]): any[] {
  if (!Array.isArray(products)) return [];
  const uniqueList: any[] = [];
  for (const p of products) {
    if (!p) continue;
    const cleanId = (p.id || "").trim();
    const cleanSku = (p.sku || "").trim().toLowerCase();
    const cleanName = (p.name || "").trim().toLowerCase();

    let matchedIdx = -1;
    if (cleanId) {
      matchedIdx = uniqueList.findIndex(x => (x.id || "").trim() === cleanId);
    }
    if (matchedIdx === -1 && cleanSku) {
      matchedIdx = uniqueList.findIndex(x => (x.sku || "").trim().toLowerCase() === cleanSku);
    }
    if (matchedIdx === -1 && cleanName) {
      matchedIdx = uniqueList.findIndex(x => (x.name || "").trim().toLowerCase() === cleanName);
    }

    if (matchedIdx >= 0) {
      const existing = uniqueList[matchedIdx];
      uniqueList[matchedIdx] = {
        ...existing,
        ...p,
        stock: Math.max(existing.stock || 0, p.stock || 0),
        buyPrice: p.buyPrice || existing.buyPrice || 0,
        sellPrice: p.sellPrice || existing.sellPrice || 0,
        id: existing.id || p.id,
      };
    } else {
      uniqueList.push({ ...p });
    }
  }
  return uniqueList;
}

export function deduplicateContacts(contacts: any[]): any[] {
  if (!Array.isArray(contacts)) return [];
  const uniqueList: any[] = [];
  for (const c of contacts) {
    if (!c) continue;
    const cleanId = (c.id || "").trim();
    const cleanPhone = (c.phone || "").trim().toLowerCase().replace(/[-()\s]/g, "");

    let matchedIdx = -1;
    if (cleanId) {
      matchedIdx = uniqueList.findIndex(x => (x.id || "").trim() === cleanId);
    }
    if (matchedIdx === -1 && cleanPhone && cleanPhone.length >= 7) {
      matchedIdx = uniqueList.findIndex(x => (x.phone || "").trim().toLowerCase().replace(/[-()\s]/g, "") === cleanPhone);
    }

    if (matchedIdx >= 0) {
      uniqueList[matchedIdx] = {
        ...uniqueList[matchedIdx],
        ...c,
        id: uniqueList[matchedIdx].id || c.id
      };
    } else {
      uniqueList.push({ ...c });
    }
  }
  return uniqueList;
}

export function deduplicateExpenses(expenses: any[]): any[] {
  if (!Array.isArray(expenses)) return [];
  const uniqueList: any[] = [];
  for (const e of expenses) {
    if (!e) continue;
    const cleanId = (e.id || "").trim();
    const cleanDesc = (e.description || "").trim().toLowerCase();
    const amount = Number(e.amount) || 0;

    let matchedIdx = -1;
    if (cleanId) {
      matchedIdx = uniqueList.findIndex(x => (x.id || "").trim() === cleanId);
    }
    if (matchedIdx === -1 && cleanDesc && amount > 0) {
      matchedIdx = uniqueList.findIndex(x => (x.description || "").trim().toLowerCase() === cleanDesc && Number(x.amount) === amount);
    }

    if (matchedIdx >= 0) {
      uniqueList[matchedIdx] = {
        ...uniqueList[matchedIdx],
        ...e,
        id: uniqueList[matchedIdx].id || e.id
      };
    } else {
      uniqueList.push({ ...e });
    }
  }
  return uniqueList;
}

export function deduplicatePurchases(purchases: any[]): any[] {
  if (!Array.isArray(purchases)) return [];
  const uniqueList: any[] = [];
  for (const pur of purchases) {
    if (!pur) continue;
    const cleanId = (pur.id || "").trim();
    const productId = (pur.productId || "").trim();
    const qty = Number(pur.quantity) || 0;

    let matchedIdx = -1;
    if (cleanId) {
      matchedIdx = uniqueList.findIndex(x => (x.id || "").trim() === cleanId);
    }
    if (matchedIdx === -1 && productId && qty > 0) {
      matchedIdx = uniqueList.findIndex(x => (x.productId || "").trim() === productId && Number(x.quantity) === qty);
    }

    if (matchedIdx >= 0) {
      uniqueList[matchedIdx] = {
        ...uniqueList[matchedIdx],
        ...pur,
        id: uniqueList[matchedIdx].id || pur.id
      };
    } else {
      uniqueList.push({ ...pur });
    }
  }
  return uniqueList;
}

export function deduplicateTransactions(transactions: any[]): any[] {
  if (!Array.isArray(transactions)) return [];
  const uniqueList: any[] = [];
  for (const t of transactions) {
    if (!t) continue;
    const cleanId = (t.id || "").trim();
    const invoiceNo = (t.invoiceNo || "").trim().toLowerCase();

    let matchedIdx = -1;
    if (cleanId) {
      matchedIdx = uniqueList.findIndex(x => (x.id || "").trim() === cleanId);
    }
    if (matchedIdx === -1 && invoiceNo) {
      matchedIdx = uniqueList.findIndex(x => (x.invoiceNo || "").trim().toLowerCase() === invoiceNo);
    }

    if (matchedIdx >= 0) {
      uniqueList[matchedIdx] = {
        ...uniqueList[matchedIdx],
        ...t,
        id: uniqueList[matchedIdx].id || t.id
      };
    } else {
      uniqueList.push({ ...t });
    }
  }
  return uniqueList;
}

export const selfHealDatabase = (customEmail?: string, uid?: string) => {
  const cached = localStorage.getItem('barakah_local_active_user');
  let email = (customEmail || "").trim().toLowerCase();
  let finalUid = uid;
  if (!email && cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.email) {
        email = parsed.email.trim().toLowerCase();
      }
    } catch (_) {}
  }
  if (!email && currentSupabaseUser?.email) {
    email = currentSupabaseUser.email.trim().toLowerCase();
  }
  if (!finalUid && cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.uid || parsed.id)) {
        finalUid = parsed.uid || parsed.id;
      }
    } catch (_) {}
  }
  if (!finalUid && currentSupabaseUser?.id) {
    finalUid = currentSupabaseUser.id;
  }

  const normalizeWithEmail = (id: string) => toUUID(id, email);

  // 1. PRODUCTS DEDUPLICATE
  const rawProducts = localStorage.getItem(getDbKey('barakah_products', email, finalUid));
  if (rawProducts) {
    try {
      const products = JSON.parse(rawProducts);
      if (Array.isArray(products)) {
        const normalized = products.map((p: any) => ({ ...p, id: normalizeWithEmail(p.id) }));
        const cleaned = deduplicateProducts(normalized);
        localStorage.setItem(getDbKey('barakah_products', email, finalUid), JSON.stringify(cleaned));
      }
    } catch (_) {}
  }

  // 2. CONTACTS DEDUPLICATE
  const rawContacts = localStorage.getItem(getDbKey('barakah_contacts', email, finalUid));
  if (rawContacts) {
    try {
      const contacts = JSON.parse(rawContacts);
      if (Array.isArray(contacts)) {
        const normalized = contacts.map((c: any) => ({ ...c, id: normalizeWithEmail(c.id) }));
        const cleaned = deduplicateContacts(normalized);
        localStorage.setItem(getDbKey('barakah_contacts', email, finalUid), JSON.stringify(cleaned));
      }
    } catch (_) {}
  }

  // 4. EXPENSES DEDUPLICATE
  const rawExpenses = localStorage.getItem(getDbKey('barakah_expenses', email, finalUid));
  if (rawExpenses) {
    try {
      const expenses = JSON.parse(rawExpenses);
      if (Array.isArray(expenses)) {
        const normalized = expenses.map((e: any) => ({ ...e, id: normalizeWithEmail(e.id) }));
        const cleaned = deduplicateExpenses(normalized);
        localStorage.setItem(getDbKey('barakah_expenses', email, finalUid), JSON.stringify(cleaned));
      }
    } catch (_) {}
  }

  // 4. PURCHASES DEDUPLICATE
  const rawPurchases = localStorage.getItem(getDbKey('barakah_purchases', email, finalUid));
  if (rawPurchases) {
    try {
      const purchases = JSON.parse(rawPurchases);
      if (Array.isArray(purchases)) {
        const normalized = purchases.map((pur: any) => ({
          ...pur,
          id: normalizeWithEmail(pur.id),
          productId: pur.productId ? normalizeWithEmail(pur.productId) : ""
        }));
        const cleaned = deduplicatePurchases(normalized);
        localStorage.setItem(getDbKey('barakah_purchases', email, finalUid), JSON.stringify(cleaned));
      }
    } catch (_) {}
  }

  // 5. TRANSACTIONS DEDUPLICATE
  const rawTransactions = localStorage.getItem(getDbKey('barakah_transactions', email, finalUid));
  if (rawTransactions) {
    try {
      const transactions = JSON.parse(rawTransactions);
      if (Array.isArray(transactions)) {
        const normalized = transactions.map((t: any) => ({
          ...t,
          id: normalizeWithEmail(t.id),
          contactId: t.contactId ? normalizeWithEmail(t.contactId) : undefined,
          items: (t.items || []).map((item: any) => ({
            ...item,
            id: item.id ? normalizeWithEmail(item.id) : normalizeWithEmail(`${t.id}_item_${item.productId || Math.random()}`),
            productId: item.productId ? normalizeWithEmail(item.productId) : undefined
          }))
        }));
        const cleaned = deduplicateTransactions(normalized);
        localStorage.setItem(getDbKey('barakah_transactions', email, finalUid), JSON.stringify(cleaned));
      }
    } catch (_) {}
  }
};

export const restoreLocalKeys = (data: any, overwrite: boolean = false, uid?: string) => {
  if (!data) return;

  const email = (data.linked_email || data.linkedEmail || currentSupabaseUser?.email || "").trim().toLowerCase();

  const normalizeProduct = (p: any): any => {
    if (!p) return p;
    return {
      ...p,
      id: toUUID(p.id, email)
    };
  };

  const normalizeContact = (c: any): any => {
    if (!c) return c;
    return {
      ...c,
      id: toUUID(c.id, email)
    };
  };

  const normalizeExpense = (e: any): any => {
    if (!e) return e;
    return {
      ...e,
      id: toUUID(e.id, email)
    };
  };

  const normalizePurchase = (pur: any): any => {
    if (!pur) return pur;
    return {
      ...pur,
      id: toUUID(pur.id, email),
      productId: pur.productId ? toUUID(pur.productId, email) : undefined
    };
  };

  const normalizeTransaction = (t: any): any => {
    if (!t) return t;
    return {
      ...t,
      id: toUUID(t.id, email),
      contactId: t.contactId ? toUUID(t.contactId, email) : undefined,
      items: (t.items || []).map((item: any) => ({
        ...item,
        id: item.id ? toUUID(item.id, email) : toUUID(`${t.id}_item_${item.productId || Math.random()}`, email),
        productId: item.productId ? toUUID(item.productId, email) : undefined
      }))
    };
  };

  const cleanCloudProducts = data.products ? cleanDemoProducts(data.products).map(p => normalizeProduct(p)) : [];
  const cleanCloudContacts = data.contacts ? cleanDemoContacts(data.contacts).map(c => normalizeContact(c)) : [];
  const cleanCloudExpenses = data.expenses ? cleanDemoExpenses(data.expenses).map(e => normalizeExpense(e)) : [];
  const cleanCloudTransactions = data.transactions ? cleanDemoTransactions(data.transactions).map(t => normalizeTransaction(t)) : [];

  let p = data.purchases;
  const bizData = data.businessInfo || data.business_info || data.businessinfo;
  if (!p && bizData && bizData.purchases) {
    p = bizData.purchases;
  }
  const cleanCloudPurchases = p ? cleanDemoPurchases(p).map(pur => normalizePurchase(pur)) : [];
  const cleanCloudDeletedItems = data.deletedItems || data.deleted_items || [];

  if (overwrite) {
    // 1. PRODUCTS OVERWRITE
    if (data.products) {
      localStorage.setItem(getDbKey('barakah_products', email, uid), JSON.stringify(cleanCloudProducts));
    }
    // 2. CONTACTS OVERWRITE
    if (data.contacts) {
      localStorage.setItem(getDbKey('barakah_contacts', email, uid), JSON.stringify(cleanCloudContacts));
    }
    // 3. EXPENSES OVERWRITE
    if (data.expenses) {
      localStorage.setItem(getDbKey('barakah_expenses', email, uid), JSON.stringify(cleanCloudExpenses));
    }
    // 4. TRANSACTIONS OVERWRITE
    if (data.transactions) {
      cleanCloudTransactions.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      localStorage.setItem(getDbKey('barakah_transactions', email, uid), JSON.stringify(cleanCloudTransactions));
    }
    // 5. PURCHASES OVERWRITE
    if (p) {
      localStorage.setItem(getDbKey('barakah_purchases', email, uid), JSON.stringify(cleanCloudPurchases));
    }
    // 6. BUSINESS SETTINGS OVERWRITE
    if (bizData) {
      const { purchases: ignore, ...cleanInfo } = bizData;
      const mergedBiz = { ...INITIAL_BUSINESS_INFO, ...cleanInfo };
      localStorage.setItem(getDbKey('barakah_business_info', email, uid), JSON.stringify(mergedBiz));
    }
    // 7. DELETED ITEMS OVERWRITE
    if (data.deletedItems || data.deleted_items) {
      localStorage.setItem(getDbKey('barakah_deleted_items', email, uid), JSON.stringify(cleanCloudDeletedItems));
    }
  } else {
    // 1. MERGE PRODUCTS
    if (data.products) {
      const rawLocalProducts = localStorage.getItem(getDbKey('barakah_products', email, uid));
      let localProducts = [];
      if (rawLocalProducts) {
        try {
          localProducts = JSON.parse(rawLocalProducts);
          if (!Array.isArray(localProducts)) localProducts = [];
        } catch (e) {}
      }
      const normalizedLocalProducts = localProducts.map(p => normalizeProduct(p));
      const mergedProducts = deduplicateProducts([...cleanCloudProducts, ...normalizedLocalProducts]);
      localStorage.setItem(getDbKey('barakah_products', email, uid), JSON.stringify(mergedProducts));
    } else {
      const rawLocalProducts = localStorage.getItem(getDbKey('barakah_products', email, uid));
      if (!rawLocalProducts) {
        localStorage.setItem(getDbKey('barakah_products', email, uid), JSON.stringify([]));
      }
    }

    // 2. MERGE CONTACTS
    if (data.contacts) {
      const rawLocalContacts = localStorage.getItem(getDbKey('barakah_contacts', email, uid));
      let localContacts = [];
      if (rawLocalContacts) {
        try {
          localContacts = JSON.parse(rawLocalContacts);
          if (!Array.isArray(localContacts)) localContacts = [];
        } catch (e) {}
      }
      const normalizedLocalContacts = localContacts.map(c => normalizeContact(c));
      const mergedContacts = deduplicateContacts([...cleanCloudContacts, ...normalizedLocalContacts]);
      localStorage.setItem(getDbKey('barakah_contacts', email, uid), JSON.stringify(mergedContacts));
    } else {
      const rawLocalContacts = localStorage.getItem(getDbKey('barakah_contacts', email, uid));
      if (!rawLocalContacts) {
        localStorage.setItem(getDbKey('barakah_contacts', email, uid), JSON.stringify([]));
      }
    }

    // 3. MERGE EXPENSES
    if (data.expenses) {
      const rawLocalExpenses = localStorage.getItem(getDbKey('barakah_expenses', email, uid));
      let localExpenses = [];
      if (rawLocalExpenses) {
        try {
          localExpenses = JSON.parse(rawLocalExpenses);
          if (!Array.isArray(localExpenses)) localExpenses = [];
        } catch (e) {}
      }
      const normalizedLocalExpenses = localExpenses.map(e => normalizeExpense(e));
      const mergedExpenses = deduplicateExpenses([...cleanCloudExpenses, ...normalizedLocalExpenses]);
      localStorage.setItem(getDbKey('barakah_expenses', email, uid), JSON.stringify(mergedExpenses));
    } else {
      const rawLocalExpenses = localStorage.getItem(getDbKey('barakah_expenses', email, uid));
      if (!rawLocalExpenses) {
        localStorage.setItem(getDbKey('barakah_expenses', email, uid), JSON.stringify([]));
      }
    }

    // 4. MERGE TRANSACTIONS
    if (data.transactions) {
      const rawLocalTransactions = localStorage.getItem(getDbKey('barakah_transactions', email, uid));
      let localTransactions = [];
      if (rawLocalTransactions) {
        try {
          localTransactions = JSON.parse(rawLocalTransactions);
          if (!Array.isArray(localTransactions)) localTransactions = [];
        } catch (e) {}
      }
      const normalizedLocalTransactions = localTransactions.map(t => normalizeTransaction(t));
      const mergedTransactions = deduplicateTransactions([...cleanCloudTransactions, ...normalizedLocalTransactions]);
      mergedTransactions.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      localStorage.setItem(getDbKey('barakah_transactions', email, uid), JSON.stringify(mergedTransactions));
    } else {
      const rawLocalTransactions = localStorage.getItem(getDbKey('barakah_transactions', email, uid));
      if (!rawLocalTransactions) {
        localStorage.setItem(getDbKey('barakah_transactions', email, uid), JSON.stringify([]));
      }
    }

    // 5. MERGE PURCHASES
    if (p) {
      const rawLocalPurchases = localStorage.getItem(getDbKey('barakah_purchases', email, uid));
      let localPurchases = [];
      if (rawLocalPurchases) {
        try {
          localPurchases = JSON.parse(rawLocalPurchases);
          if (!Array.isArray(localPurchases)) localPurchases = [];
        } catch (e) {}
      }
      const normalizedLocalPurchases = localPurchases.map(pur => normalizePurchase(pur));
      const mergedPurchases = deduplicatePurchases([...cleanCloudPurchases, ...normalizedLocalPurchases]);
      localStorage.setItem(getDbKey('barakah_purchases', email, uid), JSON.stringify(mergedPurchases));
    } else {
      const rawLocalPurchases = localStorage.getItem(getDbKey('barakah_purchases', email, uid));
      if (!rawLocalPurchases) {
        localStorage.setItem(getDbKey('barakah_purchases', email, uid), JSON.stringify([]));
      }
    }

    // 6. BUSINESS SETTINGS MERGE
    if (bizData) {
      const { purchases: ignore, ...cleanInfo } = bizData;
      const rawLocalBiz = localStorage.getItem(getDbKey('barakah_business_info', email, uid));
      let mergedBiz = { ...INITIAL_BUSINESS_INFO, ...cleanInfo };
      if (rawLocalBiz) {
        try {
          const localBiz = JSON.parse(rawLocalBiz);
          mergedBiz = { ...localBiz, ...cleanInfo };
        } catch (e) {}
      }
      localStorage.setItem(getDbKey('barakah_business_info', email, uid), JSON.stringify(mergedBiz));
    }

    // 7. DELETED ITEMS MERGE
    const rawLocalDeleted = localStorage.getItem(getDbKey('barakah_deleted_items', email, uid));
    let localDeleted = [];
    if (rawLocalDeleted) {
      try {
        localDeleted = JSON.parse(rawLocalDeleted);
        if (!Array.isArray(localDeleted)) localDeleted = [];
      } catch (e) {}
    }
    const mergedDeleted = [...cleanCloudDeletedItems];
    localDeleted.forEach((ld: any) => {
      if (!mergedDeleted.some((md: any) => md.id === ld.id)) {
        mergedDeleted.push(ld);
      }
    });
    localStorage.setItem(getDbKey('barakah_deleted_items', email, uid), JSON.stringify(mergedDeleted));
  }

  try {
    selfHealDatabase(email, uid);
  } catch (_) {}
};

export async function deleteCloudDocument(collectionName: string, id: string): Promise<void> {
  const cleanEmail = (firebaseAuth.currentUser?.email || "").trim().toLowerCase();
  if (!cleanEmail) {
    console.warn("[Cloud Deletion] Ignored deletion because user is guest or not logged in.");
    return;
  }
  const idUUID = toUUID(id, cleanEmail);
  try {
    const docRef = doc(db, collectionName, idUUID);
    await deleteDoc(docRef);
    console.log(`[Cloud Deletion] Cleanly deleted ${idUUID} from Firestore collection: ${collectionName}`);
  } catch (err: any) {
    console.warn(`[Cloud Deletion] Failed deleting document from Firestore collection ${collectionName}:`, err.message);
  }
}

export function toUUID(str: string, email: string = ""): string {
  if (!str) {
    return "00000000-0000-0000-0000-000000000000";
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str;
  }
  const cleanEmail = email ? email.trim().toLowerCase() : "";
  const saltedStr = cleanEmail ? `${cleanEmail}_${str}` : str;
  let hash = 0;
  for (let i = 0; i < saltedStr.length; i++) {
    hash = (hash << 5) - hash + saltedStr.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash).toString(16).padStart(8, "0");
  const part1 = absHash.substring(0, 8);
  const part2 = "4000";
  const part3 = "8000";
  const part4 = absHash.substring(4, 8).padStart(4, "0");

  let hash2 = 1729;
  for (let i = saltedStr.length - 1; i >= 0; i--) {
    hash2 = (hash2 << 5) - hash2 + saltedStr.charCodeAt(i);
    hash2 |= 0;
  }
  const absHash2 = Math.abs(hash2).toString(16).padStart(12, "1");
  const part5 = absHash2.substring(0, 12);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

function mergeListsById(listA: any[], listB: any[]) {
  const merged = [...listA];
  for (const b of listB) {
    const idx = merged.findIndex(a => a.id === b.id);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...b };
    } else {
      merged.push(b);
    }
  }
  return merged;
}

function mergeTransactionsLists(listA: any[], listB: any[]) {
  const merged = [...listA];
  for (const b of listB) {
    const idx = merged.findIndex(a => a.id === b.id || (a.invoiceNo && b.invoiceNo && a.invoiceNo === b.invoiceNo));
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...b };
    } else {
      merged.push(b);
    }
  }
  return merged;
}

export const fetchAndRestoreCloudBackup = async (email: string, pin: string, overwrite: boolean = false) => {
  const cleanEmail = email.trim().toLowerCase();
  const syncId = getPasscodeSyncId(cleanEmail, pin);

  try {
    let finalData: any = null;
    let activeUserId = firebaseAuth.currentUser?.uid || "";

    // 1. Fetch cloud backups matching this email
    try {
      const passcodeRef = collection(db, "passcode_syncs");
      const q = query(passcodeRef, where("linked_email", "==", cleanEmail));
      const querySnap = await getDocs(q);
      
      if (!querySnap.empty) {
        const docs = querySnap.docs.map(docSnap => docSnap.data());
        docs.sort((a: any, b: any) => {
          const t1 = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const t2 = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return t2 - t1;
        });
        finalData = docs[0];
      } else {
        const docSnap = await getDoc(doc(db, "passcode_syncs", syncId));
        if (docSnap.exists()) {
          finalData = docSnap.data();
        }
      }
    } catch (dbErr) {
      console.warn("Direct firestore backup list fetch failed:", dbErr);
    }

    // 2. Express fallback backup retrieval query
    if (!finalData) {
      finalData = await (async () => {
        try {
          const authHeaders = await getAuthHeaders();
          const response = await fetch(`/api/passcode_syncs/get?email=${encodeURIComponent(cleanEmail)}&id=${encodeURIComponent(syncId)}`, {
            headers: authHeaders
          });
          if (response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              return await response.json();
            }
          }
        } catch (e) {
          console.warn("Express fallback fetch by email/id failed:", e);
        }
        return null;
      })();
    }

    // 3. Sync individual collection records to construct the complete state
    try {
      // Find the active profile mapping or fallback
      activeUserId = firebaseAuth.currentUser?.uid || "";
      if (!activeUserId) {
        try {
          const profileSnap = await getDoc(doc(db, "profiles", syncId));
          if (profileSnap.exists()) {
            activeUserId = profileSnap.id;
          } else {
            const profileQ = query(collection(db, "profiles"), where("email", "==", cleanEmail));
            const profileSnapQ = await getDocs(profileQ);
            if (!profileSnapQ.empty) {
              activeUserId = profileSnapQ.docs[0].id;
            }
          }
        } catch (profErr) {
          console.warn("Could not query profiles lookup directly:", profErr);
        }
      }

      if (activeUserId) {
        console.log(`[Direct Firestore Sync Engine] Mapping profile: ${activeUserId}`);

        if (finalData) {
          if (finalData.products) {
            finalData.products = finalData.products.map((p: any) => ({ ...p, id: toUUID(p.id, cleanEmail) }));
          }
          if (finalData.contacts) {
            finalData.contacts = finalData.contacts.map((c: any) => ({ ...c, id: toUUID(c.id, cleanEmail) }));
          }
          if (finalData.expenses) {
            finalData.expenses = finalData.expenses.map((e: any) => ({ ...e, id: toUUID(e.id, cleanEmail) }));
          }
          if (finalData.purchases) {
            finalData.purchases = finalData.purchases.map((pur: any) => ({ ...pur, id: toUUID(pur.id, cleanEmail), productId: toUUID(pur.productId, cleanEmail) }));
          }
          if (finalData.transactions) {
            finalData.transactions = finalData.transactions.map((t: any) => ({
              ...t,
              id: toUUID(t.id, cleanEmail),
              contactId: t.contactId ? toUUID(t.contactId, cleanEmail) : undefined,
              items: (t.items || []).map((item: any) => ({
                ...item,
                id: toUUID(item.id, cleanEmail),
                productId: item.productId ? toUUID(item.productId, cleanEmail) : undefined
              }))
            }));
          }
        }

        const [productsRes, customersRes, expensesRes, transactionsRes, purchasesRes] = await Promise.all([
          getDocs(query(collection(db, "products"), where("user_id", "==", activeUserId))),
          getDocs(query(collection(db, "customers"), where("user_id", "==", activeUserId))),
          getDocs(query(collection(db, "expenses"), where("user_id", "==", activeUserId))),
          getDocs(query(collection(db, "transactions"), where("user_id", "==", activeUserId))),
          getDocs(query(collection(db, "purchases"), where("user_id", "==", activeUserId)))
        ]);

        if (!productsRes.empty) {
          const sqlProducts = productsRes.docs.map(docSnapshot => {
            const p = docSnapshot.data();
            return {
              id: p.id,
              name: p.name,
              sku: p.sku || "",
              stock: Number(p.stock) || 0,
              buyPrice: Number(p.buy_price) || 0,
              sellPrice: Number(p.sell_price) || 0,
              category: p.category || "Electronics",
              unit: p.unit || "piece",
              imageUrl: p.image_url || undefined
            };
          });
          if (!finalData) finalData = { id: syncId, linked_email: cleanEmail };
          finalData.products = mergeListsById(finalData.products || [], sqlProducts);
        }

        if (!customersRes.empty) {
          const sqlCustomers = customersRes.docs.map(docSnapshot => {
            const c = docSnapshot.data();
            return {
              id: c.id,
              name: c.name,
              phone: c.phone || "",
              address: c.address || "",
              type: c.type || "customer",
              created_at: c.updated_at || new Date().toISOString()
            };
          });
          if (!finalData) finalData = { id: syncId, linked_email: cleanEmail };
          finalData.contacts = mergeListsById(finalData.contacts || [], sqlCustomers);
        }

        if (!expensesRes.empty) {
          const sqlExpenses = expensesRes.docs.map(docSnapshot => {
            const e = docSnapshot.data();
            return {
              id: e.id,
              category: e.category || "Others",
              amount: Number(e.amount) || 0,
              description: e.description || "",
              date: e.created_at || new Date().toISOString()
            };
          });
          if (!finalData) finalData = { id: syncId, linked_email: cleanEmail };
          finalData.expenses = mergeListsById(finalData.expenses || [], sqlExpenses);
        }

        if (!transactionsRes.empty) {
          const itemsRes = await getDocs(query(collection(db, "transaction_items"), where("user_id", "==", activeUserId)));
          const itemRows = itemsRes.empty ? [] : itemsRes.docs.map(docSnapshot => docSnapshot.data());

          const sqlTransactions = transactionsRes.docs.map(docSnapshot => {
            const t = docSnapshot.data();
            const relatedItems = itemRows.filter((item: any) => item.transaction_id === t.id);
            const mappedItems = relatedItems.map((item: any) => {
              let resolvedName = item.product_name;
              if (!resolvedName && item.product_id) {
                // Try finding the name in productsRes
                const matchedProd = productsRes.empty ? null : productsRes.docs.find(docSnap => docSnap.id === item.product_id);
                resolvedName = matchedProd ? (matchedProd.data()?.name || "Product Item") : "Product Item";
              }
              if (!resolvedName) {
                resolvedName = item.product_id ? "Product Item" : "Standard Item";
              }
              return {
                id: item.id,
                name: resolvedName,
                quantity: Number(item.quantity) || 0,
                price: Number(item.sell_price) || 0,
                total: Number(item.quantity * item.sell_price) || 0,
                productId: item.product_id || undefined,
                buyPrice: item.cost_price !== undefined ? Number(item.cost_price) : undefined
              };
            });

            return {
              id: t.id,
              invoiceNo: t.invoice_no,
              date: t.created_at || new Date().toISOString(),
              items: mappedItems,
              subtotal: Number(t.total_amount) || 0,
              tax: t.vat_rate ? Number(((t.total_amount * t.vat_rate) / 100).toFixed(2)) : 0,
              discount: Number(t.discount) || 0,
              total: Number(t.total_amount) || 0,
              paymentMethod: t.payment_method || "Cash",
              status: t.paid_amount >= t.total_amount ? "paid" : (t.paid_amount > 0 ? "partial" : "due"),
              paidAmount: Number(t.paid_amount) || 0,
              dueBalance: Math.max(0, Number(t.total_amount) - Number(t.paid_amount)) || 0,
              contactId: t.customer_id || undefined,
              customerSignature: t.signature_svg || undefined
            };
          });
          if (!finalData) finalData = { id: syncId, linked_email: cleanEmail };
          finalData.transactions = mergeTransactionsLists(finalData.transactions || [], sqlTransactions);
        }

        if (!purchasesRes.empty) {
          const sqlPurchases = purchasesRes.docs.map(docSnapshot => {
            const p = docSnapshot.data();
            return {
              id: p.id,
              productId: p.product_id,
              productName: "Purchase Item",
              supplierId: "",
              supplierName: "Main Depot",
              quantity: Number(p.quantity) || 0,
              buyPrice: Number(p.buy_price) || 0,
              totalAmount: Number(p.quantity * p.buy_price) || 0,
              date: p.created_at || new Date().toISOString()
            };
          });
          if (!finalData) finalData = { id: syncId, linked_email: cleanEmail };
          finalData.purchases = mergeListsById(finalData.purchases || [], sqlPurchases);
        }
      }
    } catch (tblErr) {
      console.warn("[Firestore Sync Engine] Background load completed with fallback:", tblErr);
    }

    if (finalData) {
      if (finalData.products) {
        finalData.products = finalData.products.map((p: any) => ({ ...p, id: toUUID(p.id, cleanEmail) }));
      }
      if (finalData.contacts) {
        finalData.contacts = finalData.contacts.map((c: any) => ({ ...c, id: toUUID(c.id, cleanEmail) }));
      }
      if (finalData.expenses) {
        finalData.expenses = finalData.expenses.map((e: any) => ({ ...e, id: toUUID(e.id, cleanEmail) }));
      }
      if (finalData.purchases) {
        finalData.purchases = finalData.purchases.map((pur: any) => ({ ...pur, id: toUUID(pur.id, cleanEmail), productId: toUUID(pur.productId, cleanEmail) }));
      }
      if (finalData.transactions) {
        finalData.transactions = finalData.transactions.map((t: any) => ({
          ...t,
          id: toUUID(t.id, cleanEmail),
          contactId: t.contactId ? toUUID(t.contactId, cleanEmail) : undefined,
          items: (t.items || []).map((item: any) => ({
            ...item,
            id: toUUID(item.id, cleanEmail),
            productId: item.productId ? toUUID(item.productId, cleanEmail) : undefined
          }))
        }));
      }

      restoreLocalKeys(finalData, overwrite, activeUserId);
      return true;
    }
  } catch (err) {
    console.warn("Backup restoration procedure failed:", err);
  }
  return false;
};

export const signUpWithEmail = async (email: string, pass: string) => {
  const cleanEmail = email.trim().toLowerCase();
  try {
    let authUser: any = null;
    let fallbackError: string | null = null;
    try {
      const creds = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, pass);
      authUser = creds.user;
    } catch (directErr: any) {
      console.warn("Direct Firebase authentication signUp failing, retrying server fallback...", directErr);
      const errCode = directErr?.code || "";
      const errMsg = directErr?.message || "";

      if (errCode === "auth/weak-password" || errMsg.includes("6 characters") || errMsg.includes("weak")) {
        throw new Error("Password must be at least 6 characters long!");
      }
      if (errCode === "auth/email-already-in-use" || errMsg.includes("already-registered") || errMsg.includes("already in use") || errMsg.includes("already registered")) {
        throw new Error("This email is already registered! Please sign in instead.");
      }
      if (errCode === "auth/operation-not-allowed" || errMsg.includes("operation-not-allowed") || errMsg.includes("not-allowed")) {
        throw new Error("Email/Password Auth is disabled in Firebase. Please enable it under Auth Sign-in methods in your Firebase Console.");
      }
      if (errCode === "auth/invalid-api-key" || errMsg.includes("invalid-api-key") || errMsg.includes("api-key")) {
        throw new Error("Invalid Firebase API Key! Please verify your project configuration in the Settings.");
      }
      fallbackError = errMsg || String(directErr);
    }

    if (!authUser) {
      // Direct call fallback proxy
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: pass })
        });
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const result = await response.json();
          if (result.error) throw new Error(result.error);
          if (response.ok) {
            authUser = result.user;
          } else {
            throw new Error("Registration failed.");
          }
        } else {
          if (fallbackError) {
            let readableMsg = fallbackError;
            if (fallbackError.includes("auth/operation-not-allowed") || fallbackError.includes("operation-not-allowed")) {
              readableMsg = "Email/Password sign-in method is not enabled in your Firebase Console. Please enable it to proceed.";
            } else if (fallbackError.includes("api-key")) {
              readableMsg = "Invalid Firebase API Key! Please verify your settings and credentials.";
            }
            throw new Error(readableMsg);
          }
          throw new Error("Registration server is currently unavailable on this deployment. Please ensure Email/Password Auth is enabled in the Firebase Console.");
        }
      } catch (fetchErr: any) {
        const errMsg = fetchErr.message || "";
        if (errMsg && !errMsg.includes("Failed to fetch") && !errMsg.includes("fetch") && !errMsg.includes("network")) {
          throw fetchErr;
        }
        const suffix = fallbackError ? ` (${fallbackError})` : "";
        throw new Error(`Registration network request failed. Please check your internet connection.${suffix}`);
      }
    }

    if (authUser) {
      const userObj = { 
        email: cleanEmail, 
        id: authUser.uid || authUser.id, 
        uid: authUser.uid || authUser.id, 
        restored: false, 
        isPasscodeUser: false 
      };

      try {
        const uId = authUser.uid || authUser.id;
        if (uId) {
          const profileData = {
            id: uId,
            email: cleanEmail,
            shop_name: "Barakah Electronics",
            shop_address: "Dhaka, Bangladesh",
            support_phone: "01700-000000",
            vat_reg_id: "VAT-884499"
          };
          await setDoc(doc(db, "profiles", uId), profileData);
        }
      } catch (profErr: any) {
        console.warn("[Auth Engine] Automatically ensuring profile document warning:", profErr.message);
      }

      try {
        const wasRestored = await fetchAndRestoreCloudBackup(cleanEmail, "classic_account_secure");
        userObj.restored = wasRestored;
      } catch (err) {
        console.warn("Auto restorating backup after secure login failed:", err);
      }

      updateCurrentUser(userObj);
      localStorage.setItem('barakah_local_active_user', JSON.stringify(userObj));
      return userObj;
    }
  } catch (err: any) {
    throw err;
  }
};

export const signInWithEmail = async (email: string, pass: string) => {
  const cleanEmail = email.trim().toLowerCase();
  try {
    let authUser: any = null;
    let fallbackError: string | null = null;
    try {
      const creds = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, pass);
      authUser = creds.user;
    } catch (directErr: any) {
      console.warn("Direct Firebase authentication signIn failing, retrying server fallback...", directErr);
      const errCode = directErr?.code || "";
      const errMsg = directErr?.message || "";

      if (errCode === "auth/operation-not-allowed" || errMsg.includes("operation-not-allowed") || errMsg.includes("not-allowed")) {
        throw new Error("Email/Password Auth is disabled in Firebase. Please enable it under Auth Sign-in methods in your Firebase Console.");
      }
      if (errCode === "auth/invalid-api-key" || errMsg.includes("invalid-api-key") || errMsg.includes("api-key")) {
        throw new Error("Invalid Firebase API Key! Please verify your project configuration in the Settings.");
      }
      if (errCode === "auth/wrong-password" || errCode === "auth/invalid-credential" || errCode === "auth/user-not-found" || errMsg.toLowerCase().includes("credentials") || errMsg.toLowerCase().includes("password")) {
        throw new Error("Invalid email or password! Please check your credentials or create a new account.");
      }
      fallbackError = errMsg || String(directErr);
    }

    if (!authUser) {
      try {
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: pass })
        });
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const result = await response.json();
          if (result.error) throw new Error(result.error);
          if (response.ok) {
            authUser = result.user;
          } else {
            throw new Error("Login failed.");
          }
        } else {
          if (fallbackError) {
            let readableMsg = fallbackError;
            if (fallbackError.includes("auth/operation-not-allowed") || fallbackError.includes("operation-not-allowed")) {
              readableMsg = "Email/Password sign-in method is not enabled in your Firebase Console. Please enable it to proceed.";
            } else if (fallbackError.includes("api-key")) {
              readableMsg = "Invalid Firebase API Key! Please verify your settings and credentials.";
            }
            throw new Error(readableMsg);
          }
          throw new Error("Login server is currently unavailable on this deployment. Please ensure Email/Password Auth is enabled in the Firebase Console.");
        }
      } catch (fetchErr: any) {
        const errMsg = fetchErr.message || "";
        if (errMsg && !errMsg.includes("Failed to fetch") && !errMsg.includes("fetch") && !errMsg.includes("network")) {
          throw fetchErr;
        }
        const suffix = fallbackError ? ` (${fallbackError})` : "";
        throw new Error(`Login network request failed. Please check your credentials and internet connection.${suffix}`);
      }
    }

    if (authUser) {
      const userObj = { 
        email: cleanEmail, 
        id: authUser.uid || authUser.id, 
        uid: authUser.uid || authUser.id, 
        restored: false, 
        isPasscodeUser: false 
      };

      try {
        const uId = authUser.uid || authUser.id;
        if (uId) {
          const profileData = {
            id: uId,
            email: cleanEmail,
            shop_name: "Barakah Electronics",
            shop_address: "Dhaka, Bangladesh",
            support_phone: "01700-000000",
            vat_reg_id: "VAT-884499"
          };
          await setDoc(doc(db, "profiles", uId), profileData);
        }
      } catch (profErr: any) {
        console.warn("[Auth Engine] Profile write warning:", profErr.message);
      }

      try {
        const wasRestored = await fetchAndRestoreCloudBackup(cleanEmail, "classic_account_secure");
        userObj.restored = wasRestored;
      } catch (err) {
        console.warn("Restore backup information on standard email login failed:", err);
      }

      updateCurrentUser(userObj);
      localStorage.setItem('barakah_local_active_user', JSON.stringify(userObj));
      return userObj;
    }
  } catch (err: any) {
    throw err;
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(firebaseAuth);
  } catch (e) {
    console.warn("Direct auth engine signout warning:", e);
  }
  localStorage.removeItem('barakah_local_active_user');
  currentSupabaseUser = null;
  authListeners.forEach(cb => cb(null));
};

export const subscribeToAuthChanges = (callback: (user: any) => void) => {
  authListeners.add(callback);
  callback(currentSupabaseUser);
  return () => {
    authListeners.delete(callback);
  };
};

export const auth = {
  get currentUser() {
    return currentSupabaseUser;
  },
  signUpWithEmail,
  signInWithEmail,
  signOut,
  subscribeToAuthChanges
};

export function getPasscodeSyncId(email: string, pin: string): string {
  if (!email) return "anonymous_vault";
  const cleanEmail = email.trim().toLowerCase();
  let resolvedPin = String(pin || "").trim();

  if (!resolvedPin) {
    try {
      const bizInfoStr = localStorage.getItem(getDbKey("barakah_business_info", email));
      if (bizInfoStr) {
        const bizInfo = JSON.parse(bizInfoStr);
        if (bizInfo && bizInfo.adminPasscode) {
          resolvedPin = String(bizInfo.adminPasscode).trim();
        }
      }
    } catch (_) {}

    if (resolvedPin === "classic_account_secure") {
      resolvedPin = "1234";
    }
  }

  const rawKey = `${cleanEmail}_${resolvedPin}_smart_v1`;
  let hash = 2166136261;
  for (let i = 0; i < rawKey.length; i++) {
    hash ^= rawKey.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `vault_${Math.abs(hash).toString(36)}`;
}

export const signInOrSignUpWithPasscode = async (email: string, pin: string) => {
  const cleanEmail = email.trim().toLowerCase();
  const syncId = getPasscodeSyncId(cleanEmail, pin);

  const userObj = { 
    email: cleanEmail, 
    uid: syncId, 
    id: syncId, 
    isPasscodeUser: true, 
    restored: false, 
    passcode: pin 
  };

  const bgPassword = `PasscodeSecure_${pin}_Barakah_77`;
  try {
    let authUser: any = null;
    try {
      const creds = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, bgPassword);
      authUser = creds.user;
    } catch (signInErr: any) {
      try {
        const creds = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, bgPassword);
        authUser = creds.user;
      } catch (signUpErr: any) {
        console.warn("Background auto signup passcode credentials exception:", signUpErr);
      }
    }

    if (authUser) {
      userObj.id = authUser.uid;
      userObj.uid = authUser.uid;

      const profileData = {
        id: authUser.uid,
        email: cleanEmail,
        shop_name: "Barakah Electronics",
        shop_address: "Dhaka, Bangladesh",
        support_phone: "01700-000000",
        vat_reg_id: "VAT-884499"
      };
      await setDoc(doc(db, "profiles", authUser.uid), profileData);
    }
  } catch (authErr) {
    console.warn("Background authentication link procedure skipped:", authErr);
  }

  try {
    const wasRestored = await fetchAndRestoreCloudBackup(cleanEmail, pin);
    userObj.restored = wasRestored;
  } catch (err) {
    console.warn("Auto restoring backups returned safely with warning:", err);
  }

  updateCurrentUser(userObj);
  localStorage.setItem('barakah_local_active_user', JSON.stringify(userObj));
  return userObj;
};

export const uploadPasscodeBackup = async (email: string, pin: string, payload: {
  products: any[];
  contacts: any[];
  expenses: any[];
  transactions: any[];
  businessInfo: any;
  purchases?: any[];
  deletedItems?: any[];
}) => {
  const syncId = getPasscodeSyncId(email, pin);
  const cleanEmail = email.trim().toLowerCase();

  const incomingProductsLength = (payload.products || []).length;
  const incomingTransactionsLength = (payload.transactions || []).length;
  const incomingTotal = incomingProductsLength + incomingTransactionsLength;
  const isExplicitReset = payload.businessInfo?.isExplicitReset === true;

  try {
    const docSnap = await getDoc(doc(db, "passcode_syncs", syncId));
    if (docSnap.exists() && !isExplicitReset) {
      const existingSync = docSnap.data();
      const existingProductsCount = (existingSync.products || []).length;
      const existingTransactionsCount = (existingSync.transactions || []).length;
      const existingTotal = existingProductsCount + existingTransactionsCount;

      if (existingTotal > 0) {
        if (incomingTotal === 0) {
          console.warn(`[Sync Guard] Protected empty backup write for ID: ${syncId}`);
          return { success: true, ignored: true };
        }
      }
    }
  } catch (e) {
    console.warn("[Sync Guard] Access integrity checking error:", e);
  }

  // Real-time table synchronizer mapping
  try {
    let activeUserId = firebaseAuth.currentUser?.uid || currentSupabaseUser?.id;
    if (!activeUserId) {
      const profileQ = query(collection(db, "profiles"), where("email", "==", cleanEmail));
      const profileSnap = await getDocs(profileQ);
      if (!profileSnap.empty) {
        activeUserId = profileSnap.docs[0].id;
      }
    }

    if (activeUserId) {
      console.log(`[Direct Sync Engine] Up-syncing collection logs for owner ${activeUserId}`);

      const productsToUpsert = (payload.products || []).map(p => ({
        id: toUUID(p.id, cleanEmail),
        owner_id: activeUserId,
        user_id: activeUserId,
        name: p.name,
        sku: p.sku || null,
        category: p.category || "Electronics",
        buy_price: p.buyPrice || 0.0,
        sell_price: p.sellPrice || 0.0,
        stock: p.stock || 0.0,
        unit: p.unit || "piece",
        image_url: p.imageUrl || null,
        updated_at: new Date().toISOString()
      }));

       const contactsToUpsert = (payload.contacts || []).map(c => ({
        id: toUUID(c.id, cleanEmail),
        owner_id: activeUserId,
        user_id: activeUserId,
        name: c.name,
        phone: c.phone || "",
        address: c.address || null,
        type: c.type || "customer",
        updated_at: new Date().toISOString()
      }));

      const expensesToUpsert = (payload.expenses || []).map(e => ({
        id: toUUID(e.id, cleanEmail),
        owner_id: activeUserId,
        user_id: activeUserId,
        description: e.description || "",
        category: e.category || "Others",
        amount: e.amount || 0.0,
        created_at: e.date || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const transactionsToUpsert: any[] = [];
      const transactionItemsToUpsert: any[] = [];

      (payload.transactions || []).forEach(t => {
        const txUUID = toUUID(t.id, cleanEmail);
        const customerUUID = t.contactId ? toUUID(t.contactId, cleanEmail) : null;

        transactionsToUpsert.push({
          id: txUUID,
          owner_id: activeUserId,
          user_id: activeUserId,
          invoice_no: t.invoiceNo,
          customer_id: customerUUID,
          total_amount: t.total || 0.0,
          discount: t.discount || 0.0,
          vat_rate: t.tax && t.subtotal ? Number(((t.tax / t.subtotal) * 100).toFixed(2)) : 0.0,
          paid_amount: t.paidAmount || 0.0,
          payment_method: t.paymentMethod || "Cash",
          signature_svg: t.customerSignature || null,
          created_at: t.date || new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        (t.items || []).forEach((item: any, idx: number) => {
          const itemUUID = toUUID(item.id || `${t.id}_item_${idx}`, cleanEmail);
          const productUUID = item.productId ? toUUID(item.productId, cleanEmail) : null;

          transactionItemsToUpsert.push({
            id: itemUUID,
            owner_id: activeUserId,
            user_id: activeUserId,
            transaction_id: txUUID,
            product_id: productUUID,
            product_name: item.name || (item.product ? item.product.name : "Product Item"),
            quantity: item.quantity || 0.0,
            sell_price: item.price || 0.0,
            cost_price: item.buyPrice || item.price || 0.0,
            is_negative_sale: item.isNegativeSale || false
          });
        });
      });

      const purchasesToUpsert = (payload.purchases || []).map(pur => ({
        id: toUUID(pur.id, cleanEmail),
        owner_id: activeUserId,
        user_id: activeUserId,
        invoice_no: pur.invoiceNo || "PUR-000",
        product_id: toUUID(pur.productId, cleanEmail),
        quantity: pur.quantity || 0.0,
        buy_price: pur.buyPrice || 0.0,
        created_at: pur.date || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Parallelized Firestore batch-alike writes
      try {
        const upsertPromises: Promise<void>[] = [];

        if (isExplicitReset) {
          console.log("[Direct Sync Engine] Explicit Reset Triggered! Wiping individual firestore tables first...");
          try {
            const [productsRes, customersRes, expensesRes, transactionsRes, purchasesRes, itemsRes] = await Promise.all([
              getDocs(query(collection(db, "products"), where("user_id", "==", activeUserId))),
              getDocs(query(collection(db, "customers"), where("user_id", "==", activeUserId))),
              getDocs(query(collection(db, "expenses"), where("user_id", "==", activeUserId))),
              getDocs(query(collection(db, "transactions"), where("user_id", "==", activeUserId))),
              getDocs(query(collection(db, "purchases"), where("user_id", "==", activeUserId))),
              getDocs(query(collection(db, "transaction_items"), where("user_id", "==", activeUserId)))
            ]);

            const deletePromises: Promise<void>[] = [];
            productsRes.docs.forEach(docSnap => deletePromises.push(deleteDoc(doc(db, "products", docSnap.id))));
            customersRes.docs.forEach(docSnap => deletePromises.push(deleteDoc(doc(db, "customers", docSnap.id))));
            expensesRes.docs.forEach(docSnap => deletePromises.push(deleteDoc(doc(db, "expenses", docSnap.id))));
            transactionsRes.docs.forEach(docSnap => deletePromises.push(deleteDoc(doc(db, "transactions", docSnap.id))));
            purchasesRes.docs.forEach(docSnap => deletePromises.push(deleteDoc(doc(db, "purchases", docSnap.id))));
            itemsRes.docs.forEach(docSnap => deletePromises.push(deleteDoc(doc(db, "transaction_items", docSnap.id))));

            await Promise.all(deletePromises);
            console.log("[Direct Sync Engine] Cloud tables wiped successfully.");
          } catch (wipeErr) {
            console.warn("Direct collections wipe exception:", wipeErr);
          }
        } else {
          // Normal up-sync smart pruning: disabled to maintain 100% data integrity and stability.
          // Documents are only removed explicitly from sub-collections when deleted by an admin to prevent data loss.
          console.log("[Direct Sync Engine] Smart pruning skipped to guarantee absolute data integrity.");
        }

        productsToUpsert.forEach(p => {
          upsertPromises.push(setDoc(doc(db, "products", p.id), p));
        });
        contactsToUpsert.forEach(c => {
          upsertPromises.push(setDoc(doc(db, "customers", c.id), c));
        });
        expensesToUpsert.forEach(e => {
          upsertPromises.push(setDoc(doc(db, "expenses", e.id), e));
        });
        transactionsToUpsert.forEach(tx => {
          upsertPromises.push(setDoc(doc(db, "transactions", tx.id), tx));
        });
        transactionItemsToUpsert.forEach(item => {
          upsertPromises.push(setDoc(doc(db, "transaction_items", item.id), item));
        });
        purchasesToUpsert.forEach(pur => {
          upsertPromises.push(setDoc(doc(db, "purchases", pur.id), pur));
        });

        await Promise.all(upsertPromises);
        console.log("[Direct FirestoreSync Engine] All individual store files successfully saved.");
      } catch (writeErr) {
        console.warn("Direct collections write exception:", writeErr);
      }
    }
  } catch (syncErr) {
    console.warn("[Sync Engine] Failed writing individual records to cloud collections:", syncErr);
  }

  const normalizedProducts = (payload.products || []).map(p => ({ ...p, id: toUUID(p.id, cleanEmail) }));
  const normalizedContacts = (payload.contacts || []).map(c => ({ ...c, id: toUUID(c.id, cleanEmail) }));
  const normalizedExpenses = (payload.expenses || []).map(e => ({ ...e, id: toUUID(e.id, cleanEmail) }));
  const normalizedPurchases = (payload.purchases || []).map(pur => ({ ...pur, id: toUUID(pur.id, cleanEmail), productId: toUUID(pur.productId, cleanEmail) }));
  const normalizedTransactions = (payload.transactions || []).map(t => ({
    ...t,
    id: toUUID(t.id, cleanEmail),
    contactId: t.contactId ? toUUID(t.contactId, cleanEmail) : undefined,
    items: (t.items || []).map((item: any) => ({
      ...item,
      id: toUUID(item.id, cleanEmail),
      productId: item.productId ? toUUID(item.productId, cleanEmail) : undefined
    }))
  }));

  const serializedBusinessInfo = {
    ...(payload.businessInfo || {}),
    purchases: normalizedPurchases
  };

  let mergedProductsArr = normalizedProducts;
  let mergedContactsArr = normalizedContacts;
  let mergedExpensesArr = normalizedExpenses;
  let mergedTransactionsArr = normalizedTransactions;
  let mergedDeletedItemsArr = payload.deletedItems || [];

  try {
    const docSnap = await getDoc(doc(db, "passcode_syncs", syncId));
    if (docSnap.exists() && !isExplicitReset) {
      const existingData = docSnap.data();
      
      // Since incomingTotal > 0 guarantees that the client has loaded its database securely,
      // we can trust empty sub-arrays as intentional user actions rather than accidental empty wipes.
      // However, we merge and keep deleted items (unless incoming is empty under a loaded state).
      const existingDeleted = existingData.deletedItems || existingData.deleted_items || [];
      const incomingDeleted = payload.deletedItems || [];
      
      if (incomingDeleted.length > 0) {
        const mergedMap = new Map();
        existingDeleted.forEach((item: any) => {
          if (item && item.id) mergedMap.set(item.id, item);
        });
        incomingDeleted.forEach((item: any) => {
          if (item && item.id) mergedMap.set(item.id, item);
        });
        mergedDeletedItemsArr = Array.from(mergedMap.values());
      } else {
        if (incomingTotal > 0) {
          mergedDeletedItemsArr = [];
          console.log("[Sync Engine] User successfully emptied the trash folder. Propagating to cloud.");
        } else {
          mergedDeletedItemsArr = existingDeleted;
        }
      }
    }
  } catch (e) {
    console.warn("[Sync Recovery Guard] Error reading existing cloud state:", e);
  }

  const body = {
    id: syncId,
    linked_email: cleanEmail,
    products: mergedProductsArr,
    contacts: mergedContactsArr,
    expenses: mergedExpensesArr,
    transactions: mergedTransactionsArr,
    deletedItems: mergedDeletedItemsArr,
    deleted_items: mergedDeletedItemsArr,
    businessInfo: serializedBusinessInfo,
    business_info: serializedBusinessInfo,
    updated_at: new Date().toISOString()
  };

  // We DO NOT call restoreLocalKeys(body, true) here. Doing so would overwrite the local storage
  // with stale in-flight variables, replacing transactions or contacts and causing silent data deletions!
  console.log("[Sync Engine] Completed secure cloud sync upload.");

  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const historyBody = {
      ...body,
      id: `${syncId}_history_${todayStr}`,
      updated_at: new Date().toISOString()
    };
    setDoc(doc(db, "passcode_syncs", `${syncId}_history_${todayStr}`), historyBody).catch(e => {
      console.warn("daily historical doc backup save exception:", e.message);
    });
  } catch (_) {}

  try {
    await setDoc(doc(db, "passcode_syncs", syncId), body);
    return { success: true };
  } catch (directError: any) {
    console.warn("Direct firestore passcode sync document write backup failed. Retrying Server Route...", directError.message);
  }

  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch("/api/passcode_syncs/upsert", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ payload: body })
    });
    if (response.ok) {
      return { success: true };
    }
    const errText = await response.text();
    return { success: false, error: errText || "Passcode cloud back up transmission error." };
  } catch (err: any) {
    return { success: false, error: err.message || "Cloud connection failure." };
  }
};

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  try {
    const currentUser = firebaseAuth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
      headers["x-user-uid"] = currentUser.uid;
      headers["x-user-email"] = currentUser.email || "";
    } else {
      const cached = localStorage.getItem('barakah_local_active_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.uid) {
          headers["x-user-uid"] = parsed.uid;
          headers["x-user-email"] = parsed.email || "";
        }
      }
    }
  } catch (e) {
    console.warn("Could not get auth headers:", e);
  }
  return headers;
}

export const upsertDocument = async (table: string, id: string, data: any) => {
  let activeUserId = firebaseAuth.currentUser?.uid || currentSupabaseUser?.id;
  if (!activeUserId) {
    try {
      const cached = localStorage.getItem('barakah_local_active_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        activeUserId = parsed?.id || parsed?.uid;
      }
    } catch (_) {}
  }

  const enrichedData = {
    ...data,
    id: id || data.id,
    user_id: data.user_id || activeUserId,
    userId: data.userId || activeUserId
  };

  try {
    await setDoc(doc(db, table, id), enrichedData);
  } catch (e) {
    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/db/upsert", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ table, id, data: enrichedData })
      });
    } catch (err) {
      handleFirestoreError(e, OperationType.WRITE, `${table}/${id}`);
    }
  }
};

export const deleteDocument = async (table: string, id: string) => {
  try {
    await deleteDoc(doc(db, table, id));
  } catch (e) {
    try {
      const authHeaders = await getAuthHeaders();
      await fetch("/api/db/delete", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ table, id })
      });
    } catch (err) {
      handleFirestoreError(e, OperationType.DELETE, `${table}/${id}`);
    }
  }
};

export const fetchUserCollection = async (table: string, ownerEmail: string) => {
  let activeUserId = firebaseAuth.currentUser?.uid || currentSupabaseUser?.id;
  if (!activeUserId) {
    try {
      const cached = localStorage.getItem('barakah_local_active_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        activeUserId = parsed?.id || parsed?.uid;
      }
    } catch (_) {}
  }

  const queryIdentifier = activeUserId || ownerEmail;

  try {
    let q;
    q = query(collection(db, table), where("user_id", "==", queryIdentifier));
    const docsSnap = await getDocs(q);
    if (!docsSnap.empty) {
      return docsSnap.docs.map(docSnapshot => docSnapshot.data());
    }
  } catch (e) {
    console.warn(`Local direct query for table ${table} failed, retrying server fallbacks...`, e);
  }

  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`/api/db/fetch?table=${encodeURIComponent(table)}&owner_email=${encodeURIComponent(ownerEmail)}`, {
      headers: authHeaders
    });
    return await response.json();
  } catch (err) {
    return [];
  }
};

export const subscribeToCollection = (table: string, ownerEmail: string, callback: (data: any[]) => void) => {
  const fetchAll = async () => {
    try {
      const data = await fetchUserCollection(table, ownerEmail);
      callback(data || []);
    } catch (e) {
      console.warn("Real-time fetch collection error:", e);
    }
  };
  fetchAll();
  const sub = setInterval(fetchAll, 12000);
  return () => clearInterval(sub);
};

export const saveBusinessSettings = async (email: string, info: any) => {
  const docId = `settings_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
  let activeUserId = firebaseAuth.currentUser?.uid || currentSupabaseUser?.id;
  if (!activeUserId) {
    try {
      const cached = localStorage.getItem('barakah_local_active_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        activeUserId = parsed?.id || parsed?.uid;
      }
    } catch (_) {}
  }
  await upsertDocument('business_info', docId, { 
    linkedEmail: email, 
    id: docId, 
    user_id: activeUserId || email, 
    userId: activeUserId || email, 
    ...info 
  });
};

export const getBusinessSettings = async (email: string) => {
  const docId = `settings_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
  try {
    const list = await fetchUserCollection('business_info', email);
    return list.find((item: any) => item.id === docId) || null;
  } catch (err) {
    return null;
  }
};
