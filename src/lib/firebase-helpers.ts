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
  signInAnonymously,
  User as FirebaseUser
} from 'firebase/auth';

import { 
  doc, 
  getDoc, 
  getDocs, 
  getDocFromServer,
  getDocsFromServer,
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where 
} from 'firebase/firestore';

export async function fetchDocFresh(docRef: any): Promise<any> {
  try {
    return await getDocFromServer(docRef);
  } catch (err) {
    console.log("[Firestore fresh-fetch] getDocFromServer failed, using cached fallback:", err);
    return await getDoc(docRef);
  }
}

export async function fetchDocsFresh(q: any): Promise<any> {
  try {
    return await getDocsFromServer(q);
  } catch (err) {
    console.log("[Firestore fresh-fetch] getDocsFromServer failed, using cached fallback:", err);
    return await getDocs(q);
  }
}

export const isFirebaseConfigured = true;

let currentFirebaseUser: any = null;
const authListeners = new Set<(user: any) => void>();

const updateCurrentUser = (sessionUser: any) => {
  if (sessionUser) {
    currentFirebaseUser = { 
      uid: sessionUser.id || sessionUser.uid, 
      id: sessionUser.id || sessionUser.uid, 
      email: sessionUser.email, 
      ...sessionUser 
    };
  } else {
    currentFirebaseUser = null;
  }
  authListeners.forEach(cb => cb(currentFirebaseUser));
};

// Listen for firebase auth state alterations
onAuthStateChanged(firebaseAuth, (user: FirebaseUser | null) => {
  if (user) {
    let cachedData: any = {};
    const cached = localStorage.getItem('barakah_local_active_user');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.uid === user.uid || parsed.id === user.uid || parsed.email?.trim().toLowerCase() === user.email?.trim().toLowerCase())) {
          cachedData = parsed;
        }
      } catch (e) {}
    }
    updateCurrentUser({
      id: user.uid,
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      ...cachedData
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
    currentFirebaseUser = JSON.parse(cachedUser);
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
  if (!email && currentFirebaseUser?.email) {
    email = currentFirebaseUser.email.trim().toLowerCase();
  }
  if (!finalUid && cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.uid || parsed.id)) {
        finalUid = parsed.uid || parsed.id;
      }
    } catch (_) {}
  }
  if (!finalUid && currentFirebaseUser?.id) {
    finalUid = currentFirebaseUser.id;
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
  // Phase 1: Disabled restoreLocalKeys merge logic
  return;
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
    
    if (id !== idUUID) {
      const legacyDocRef = doc(db, collectionName, id);
      await deleteDoc(legacyDocRef);
      console.log(`[Cloud Deletion] Cleanly deleted legacy ${id} from Firestore collection: ${collectionName}`);
    }
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
  
  // Custom prefix protection for clean cross-device synchronization:
  // If the ID already has a clean custom prefix, preserve it to prevent duplicates
  const lower = str.toLowerCase();
  if (
    lower.startsWith("cust_") ||
    lower.startsWith("prod_") ||
    lower.startsWith("exp_") ||
    lower.startsWith("pur_") ||
    lower.startsWith("tx_") ||
    lower.startsWith("txi_") ||
    lower.startsWith("gen_") ||
    lower.startsWith("c_") ||
    lower.startsWith("p_") ||
    lower.startsWith("e_") ||
    lower.startsWith("t_") ||
    lower.startsWith("ti_")
  ) {
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
      if (cleanEmail && typeof cleanEmail === "string") {
        const passcodeRef = collection(db, "passcode_syncs");
        const q = query(passcodeRef, where("linked_email", "==", cleanEmail));
        const querySnap = await fetchDocsFresh(q);
        
        if (!querySnap.empty) {
          const docs = querySnap.docs.map(docSnap => docSnap.data());
          docs.sort((a: any, b: any) => {
            const t1 = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const t2 = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return t2 - t1;
          });
          
          // Fail-safe check: If the latest document is completely empty of products and transactions,
          // search sorted docs to find the most recent non-empty candidate backup so we don't restore blank/wiped states.
          let selectedCandidate = docs[0];
          for (const candidate of docs) {
            const prodCount = (candidate.products || []).length;
            const transCount = (candidate.transactions || []).length;
            if (prodCount > 0 || transCount > 0) {
              selectedCandidate = candidate;
              break;
            }
          }
          finalData = selectedCandidate;
        } else {
          const docSnap = await fetchDocFresh(doc(db, "passcode_syncs", syncId));
          if (docSnap.exists()) {
            finalData = docSnap.data();
          }
        }
      } else {
        const docSnap = await fetchDocFresh(doc(db, "passcode_syncs", syncId));
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
          const profileSnap = await fetchDocFresh(doc(db, "profiles", syncId));
          if (profileSnap.exists()) {
            activeUserId = profileSnap.id;
          } else if (cleanEmail && typeof cleanEmail === "string") {
            const profileQ = query(collection(db, "profiles"), where("email", "==", cleanEmail));
            const profileSnapQ = await fetchDocsFresh(profileQ);
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

        let productsRes: any = { empty: true, docs: [] };
        let customersRes: any = { empty: true, docs: [] };
        let expensesRes: any = { empty: true, docs: [] };
        let transactionsRes: any = { empty: true, docs: [] };
        let purchasesRes: any = { empty: true, docs: [] };

        if (firebaseAuth.currentUser && activeUserId === firebaseAuth.currentUser.uid) {
          try {
            const results = await Promise.all([
              fetchDocsFresh(query(collection(db, "products"), where("user_id", "==", activeUserId))),
              fetchDocsFresh(query(collection(db, "customers"), where("user_id", "==", activeUserId))),
              fetchDocsFresh(query(collection(db, "expenses"), where("user_id", "==", activeUserId))),
              fetchDocsFresh(query(collection(db, "transactions"), where("user_id", "==", activeUserId))),
              fetchDocsFresh(query(collection(db, "purchases"), where("user_id", "==", activeUserId)))
            ]);
            productsRes = results[0];
            customersRes = results[1];
            expensesRes = results[2];
            transactionsRes = results[3];
            purchasesRes = results[4];
          } catch (colErr) {
            console.warn("Direct collection query skipped due to auth/permission status:", colErr);
          }
        }

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
              id: c.id || docSnapshot.id,
              firestoreId: docSnapshot.id,
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
          const itemsRes = await fetchDocsFresh(query(collection(db, "transaction_items"), where("user_id", "==", activeUserId)));
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

      const localTargetUid = currentFirebaseUser?.uid || activeUserId;
      restoreLocalKeys(finalData, overwrite, localTargetUid);

      try {
        const bizSettings = await getBusinessSettings(cleanEmail);
        if (bizSettings) {
          const { id, user_id, userId, linkedEmail, ...cleanBiz } = bizSettings;
          if (Object.keys(cleanBiz).length > 0) {
            const bizKey = getDbKey("barakah_business_info", cleanEmail, localTargetUid);
            localStorage.setItem(bizKey, JSON.stringify(cleanBiz));
            localStorage.setItem("barakah_business_info", JSON.stringify(cleanBiz));
          }
        }
      } catch (_) {}

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
        isPasscodeUser: false,
        password: pass
      };

      try {
        const uId = authUser.uid || authUser.id;
        if (uId) {
          const profileData = {
            id: uId,
            email: cleanEmail
          };
          await setDoc(doc(db, "profiles", uId), profileData, { merge: true });
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
        isPasscodeUser: false,
        password: pass
      };

      try {
        const uId = authUser.uid || authUser.id;
        if (uId) {
          const profileData = {
            id: uId,
            email: cleanEmail
          };
          await setDoc(doc(db, "profiles", uId), profileData, { merge: true });
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
  currentFirebaseUser = null;
  authListeners.forEach(cb => cb(null));
};

export const subscribeToAuthChanges = (callback: (user: any) => void) => {
  authListeners.add(callback);
  callback(currentFirebaseUser);
  return () => {
    authListeners.delete(callback);
  };
};

export const auth = {
  get currentUser() {
    return currentFirebaseUser;
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

    if (!authUser && !firebaseAuth.currentUser) {
      try {
        const anonCreds = await signInAnonymously(firebaseAuth);
        authUser = anonCreds.user;
      } catch (anonErr) {
        console.warn("Anonymous background auth fallback failed:", anonErr);
      }
    }

    const activeFbUser = authUser || firebaseAuth.currentUser;
    if (activeFbUser) {
      userObj.id = activeFbUser.uid;
      userObj.uid = activeFbUser.uid;

      const profileData = {
        id: activeFbUser.uid,
        email: cleanEmail
      };
      await setDoc(doc(db, "profiles", activeFbUser.uid), profileData, { merge: true });
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
}) => {
  // Phase 1: Disabled uploadPasscodeBackup
  return { success: true, message: "Passcode backup disabled in Phase 1", updatedAt: new Date().toISOString() };
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
  let activeUserId = firebaseAuth.currentUser?.uid || currentFirebaseUser?.id;
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
  let activeUserId = firebaseAuth.currentUser?.uid || currentFirebaseUser?.id;
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
    if (firebaseAuth.currentUser && queryIdentifier && typeof queryIdentifier === "string" && firebaseAuth.currentUser.uid === queryIdentifier) {
      q = query(collection(db, table), where("user_id", "==", queryIdentifier));
      const docsSnap = await fetchDocsFresh(q);
      if (!docsSnap.empty) {
        return docsSnap.docs.map(docSnapshot => docSnapshot.data());
      }
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
  let activeUserId = firebaseAuth.currentUser?.uid || currentFirebaseUser?.id;
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
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  const docId = `settings_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
  try {
    const docRef = doc(db, 'business_info', docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    const list = await fetchUserCollection('business_info', cleanEmail);
    return list.find((item: any) => item.id === docId) || list[0] || null;
  } catch (err) {
    return null;
  }
};
