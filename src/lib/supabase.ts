import { createClient } from '@supabase/supabase-js';
import { 
  cleanDemoProducts, 
  cleanDemoContacts, 
  cleanDemoExpenses, 
  cleanDemoPurchases, 
  cleanDemoTransactions,
  INITIAL_BUSINESS_INFO
} from './mockDB';

const fallbackUrl = 'https://dmgbhwwugdrwbqdzgnqa.supabase.co';
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtZ2Jod3d1Z2Ryd2JxZHpnbnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTE1MDYsImV4cCI6MjA5NTk2NzUwNn0.qo8Itnqd561hvk7Js8IvF4xuF12xjGw8B8u1C7cpTUo';

// Fallback logic inside the client bundle
// @ts-ignore
let rawUrl = import.meta.env.VITE_SUPABASE_URL || fallbackUrl;
// @ts-ignore
let rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackKey;

const supabaseUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabaseAnonKey = rawKey.trim();

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentSupabaseUser: any = null;
const authListeners = new Set<(user: any) => void>();

const updateCurrentUser = (sessionUser: any) => {
  if (sessionUser) {
    currentSupabaseUser = { uid: sessionUser.id, id: sessionUser.id, email: sessionUser.email, ...sessionUser };
  } else {
    currentSupabaseUser = null;
  }
  authListeners.forEach(cb => cb(currentSupabaseUser));
};

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    updateCurrentUser(session.user);
  } else {
    if (_event === 'SIGNED_OUT') {
      updateCurrentUser(null);
    } else {
      // Keep cached user if we have one on app reload to prevent auto-logout
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
    const cleanName = (c.name || "").trim().toLowerCase();

    let matchedIdx = -1;
    if (cleanId) {
      matchedIdx = uniqueList.findIndex(x => (x.id || "").trim() === cleanId);
    }
    if (matchedIdx === -1 && cleanPhone && cleanPhone.length > 5) {
      matchedIdx = uniqueList.findIndex(x => (x.phone || "").trim().toLowerCase().replace(/[-()\s]/g, "") === cleanPhone);
    }
    if (matchedIdx === -1 && cleanName) {
      matchedIdx = uniqueList.findIndex(x => (x.name || "").trim().toLowerCase() === cleanName);
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
    const dateStr = (e.date || "").substring(0, 10);

    let matchedIdx = -1;
    if (cleanId) {
      matchedIdx = uniqueList.findIndex(x => (x.id || "").trim() === cleanId);
    }
    if (matchedIdx === -1 && cleanDesc) {
      matchedIdx = uniqueList.findIndex(x => 
        (x.description || "").trim().toLowerCase() === cleanDesc &&
        Math.abs((Number(x.amount) || 0) - amount) < 0.01 &&
        (x.date || "").substring(0, 10) === dateStr
      );
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
    const invNo = (pur.invoiceNo || "").trim().toLowerCase();
    const qty = Number(pur.quantity) || 0;
    const dateStr = (pur.date || "").substring(0, 10);

    let matchedIdx = -1;
    if (cleanId) {
      matchedIdx = uniqueList.findIndex(x => (x.id || "").trim() === cleanId);
    }
    if (matchedIdx === -1 && productId && invNo) {
      matchedIdx = uniqueList.findIndex(x => 
        (x.productId || "").trim() === productId &&
        (x.invoiceNo || "").trim().toLowerCase() === invNo &&
        Math.abs((Number(x.quantity) || 0) - qty) < 0.001 &&
        (x.date || "").substring(0, 10) === dateStr
      );
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
    const invNo = (t.invoiceNo || "").trim().toLowerCase();

    let matchedIdx = -1;
    if (cleanId) {
      matchedIdx = uniqueList.findIndex(x => (x.id || "").trim() === cleanId);
    }
    if (matchedIdx === -1 && invNo) {
      matchedIdx = uniqueList.findIndex(x => (x.invoiceNo || "").trim().toLowerCase() === invNo);
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

export const selfHealDatabase = (customEmail?: string) => {
  const cached = localStorage.getItem('barakah_local_active_user');
  let email = (customEmail || "").trim().toLowerCase();
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

  const normalizeWithEmail = (id: string) => toUUID(id, email);

  // 1. PRODUCTS DEDUPLICATE
  const rawProducts = localStorage.getItem('barakah_products');
  if (rawProducts) {
    try {
      const products = JSON.parse(rawProducts);
      if (Array.isArray(products)) {
        const normalized = products.map((p: any) => ({ ...p, id: normalizeWithEmail(p.id) }));
        const cleaned = deduplicateProducts(normalized);
        localStorage.setItem('barakah_products', JSON.stringify(cleaned));
      }
    } catch (_) {}
  }

  // 2. CONTACTS DEDUPLICATE
  const rawContacts = localStorage.getItem('barakah_contacts');
  if (rawContacts) {
    try {
      const contacts = JSON.parse(rawContacts);
      if (Array.isArray(contacts)) {
        const normalized = contacts.map((c: any) => ({ ...c, id: normalizeWithEmail(c.id) }));
        const cleaned = deduplicateContacts(normalized);
        localStorage.setItem('barakah_contacts', JSON.stringify(cleaned));
      }
    } catch (_) {}
  }

  // 3. EXPENSES DEDUPLICATE
  const rawExpenses = localStorage.getItem('barakah_expenses');
  if (rawExpenses) {
    try {
      const expenses = JSON.parse(rawExpenses);
      if (Array.isArray(expenses)) {
        const normalized = expenses.map((e: any) => ({ ...e, id: normalizeWithEmail(e.id) }));
        const cleaned = deduplicateExpenses(normalized);
        localStorage.setItem('barakah_expenses', JSON.stringify(cleaned));
      }
    } catch (_) {}
  }

  // 4. PURCHASES DEDUPLICATE
  const rawPurchases = localStorage.getItem('barakah_purchases');
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
        localStorage.setItem('barakah_purchases', JSON.stringify(cleaned));
      }
    } catch (_) {}
  }

  // 5. TRANSACTIONS DEDUPLICATE
  const rawTransactions = localStorage.getItem('barakah_transactions');
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
        localStorage.setItem('barakah_transactions', JSON.stringify(cleaned));
      }
    } catch (_) {}
  }
};

export const restoreLocalKeys = (data: any) => {
  if (!data) return;

  const email = (data.linked_email || data.linkedEmail || currentSupabaseUser?.email || "").trim().toLowerCase();

  // Helper to safely convert IDs and foreign key links using user email salt
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

  // 1. MERGE PRODUCTS
  if (data.products) {
    const rawLocalProducts = localStorage.getItem('barakah_products');
    let localProducts = [];
    if (rawLocalProducts) {
      try {
        localProducts = JSON.parse(rawLocalProducts);
        if (!Array.isArray(localProducts)) localProducts = [];
      } catch (e) {}
    }
    const cleanCloudProducts = cleanDemoProducts(data.products).map(p => normalizeProduct(p));
    const normalizedLocalProducts = localProducts.map(p => normalizeProduct(p));
    const mergedProducts = deduplicateProducts([...cleanCloudProducts, ...normalizedLocalProducts]);
    localStorage.setItem('barakah_products', JSON.stringify(mergedProducts));
  } else {
    const rawLocalProducts = localStorage.getItem('barakah_products');
    if (!rawLocalProducts) {
      localStorage.setItem('barakah_products', JSON.stringify([]));
    }
  }

  // 2. MERGE CONTACTS
  if (data.contacts) {
    const rawLocalContacts = localStorage.getItem('barakah_contacts');
    let localContacts = [];
    if (rawLocalContacts) {
      try {
        localContacts = JSON.parse(rawLocalContacts);
        if (!Array.isArray(localContacts)) localContacts = [];
      } catch (e) {}
    }
    const cleanCloudContacts = cleanDemoContacts(data.contacts).map(c => normalizeContact(c));
    const normalizedLocalContacts = localContacts.map(c => normalizeContact(c));
    const mergedContacts = deduplicateContacts([...cleanCloudContacts, ...normalizedLocalContacts]);
    localStorage.setItem('barakah_contacts', JSON.stringify(mergedContacts));
  } else {
    const rawLocalContacts = localStorage.getItem('barakah_contacts');
    if (!rawLocalContacts) {
      localStorage.setItem('barakah_contacts', JSON.stringify([]));
    }
  }

  // 3. MERGE EXPENSES
  if (data.expenses) {
    const rawLocalExpenses = localStorage.getItem('barakah_expenses');
    let localExpenses = [];
    if (rawLocalExpenses) {
      try {
        localExpenses = JSON.parse(rawLocalExpenses);
        if (!Array.isArray(localExpenses)) localExpenses = [];
      } catch (e) {}
    }
    const cleanCloudExpenses = cleanDemoExpenses(data.expenses).map(e => normalizeExpense(e));
    const normalizedLocalExpenses = localExpenses.map(e => normalizeExpense(e));
    const mergedExpenses = deduplicateExpenses([...cleanCloudExpenses, ...normalizedLocalExpenses]);
    localStorage.setItem('barakah_expenses', JSON.stringify(mergedExpenses));
  } else {
    const rawLocalExpenses = localStorage.getItem('barakah_expenses');
    if (!rawLocalExpenses) {
      localStorage.setItem('barakah_expenses', JSON.stringify([]));
    }
  }

  // 4. MERGE TRANSACTIONS
  if (data.transactions) {
    const rawLocalTransactions = localStorage.getItem('barakah_transactions');
    let localTransactions = [];
    if (rawLocalTransactions) {
      try {
        localTransactions = JSON.parse(rawLocalTransactions);
        if (!Array.isArray(localTransactions)) localTransactions = [];
      } catch (e) {}
    }
    const cleanCloudTransactions = cleanDemoTransactions(data.transactions).map(t => normalizeTransaction(t));
    const normalizedLocalTransactions = localTransactions.map(t => normalizeTransaction(t));
    const mergedTransactions = deduplicateTransactions([...cleanCloudTransactions, ...normalizedLocalTransactions]);
    mergedTransactions.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    localStorage.setItem('barakah_transactions', JSON.stringify(mergedTransactions));
  } else {
    const rawLocalTransactions = localStorage.getItem('barakah_transactions');
    if (!rawLocalTransactions) {
      localStorage.setItem('barakah_transactions', JSON.stringify([]));
    }
  }
  
  const bizData = data.businessInfo || data.business_info || data.businessinfo;
  
  // 5. MERGE PURCHASES
  let p = data.purchases;
  if (!p && bizData && bizData.purchases) {
    p = bizData.purchases;
  }
  if (p) {
    const rawLocalPurchases = localStorage.getItem('barakah_purchases');
    let localPurchases = [];
    if (rawLocalPurchases) {
      try {
        localPurchases = JSON.parse(rawLocalPurchases);
        if (!Array.isArray(localPurchases)) localPurchases = [];
      } catch (e) {}
    }
    const cleanCloudPurchases = cleanDemoPurchases(p).map(pur => normalizePurchase(pur));
    const normalizedLocalPurchases = localPurchases.map(pur => normalizePurchase(pur));
    const mergedPurchases = deduplicatePurchases([...cleanCloudPurchases, ...normalizedLocalPurchases]);
    localStorage.setItem('barakah_purchases', JSON.stringify(mergedPurchases));
  } else {
    const rawLocalPurchases = localStorage.getItem('barakah_purchases');
    if (!rawLocalPurchases) {
      localStorage.setItem('barakah_purchases', JSON.stringify([]));
    }
  }

  // 6. BUSINESS SETTINGS MERGE
  if (bizData) {
    const { purchases: ignore, ...cleanInfo } = bizData;
    const rawLocalBiz = localStorage.getItem('barakah_business_info');
    let mergedBiz = { ...INITIAL_BUSINESS_INFO, ...cleanInfo };
    if (rawLocalBiz) {
      try {
        const localBiz = JSON.parse(rawLocalBiz);
        mergedBiz = { ...localBiz, ...cleanInfo };
      } catch (e) {}
    }
    localStorage.setItem('barakah_business_info', JSON.stringify(mergedBiz));
  }

  try {
    selfHealDatabase(email);
  } catch (_) {}
};

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

export const fetchAndRestoreCloudBackup = async (email: string, pin: string) => {
  const cleanEmail = email.trim().toLowerCase();
  const syncId = getPasscodeSyncId(cleanEmail, pin);
  
  try {
    let finalData: any = null;

    // 1. Smart direct query: retrieve ALL backups created under this email to find the latest active database row
    const { data: directList, error: directError } = await supabase
      .from("passcode_syncs")
      .select("id, linked_email, products, contacts, expenses, transactions, business_info, updated_at")
      .eq("linked_email", cleanEmail);

    if (!directError && directList && directList.length > 0) {
      // Sort by updated_at descending to grab the freshest backup
      directList.sort((a: any, b: any) => {
        const t1 = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const t2 = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return t2 - t1;
      });
      finalData = directList[0];
    } else {
      if (directError) {
        console.warn("Direct linked_email query failed, trying ID query...", directError.message);
      }
      // Fallback: Query directly using the specific syncId in case linked_email isn't mapped
      const { data: idData, error: idError } = await supabase
        .from("passcode_syncs")
        .select("id, linked_email, products, contacts, expenses, transactions, business_info, updated_at")
        .eq("id", syncId)
        .maybeSingle();
      if (!idError && idData) {
        finalData = idData;
      }
    }

    // 2. Express fallback query: ask the proxy server for the latest backup by email or ID
    if (!finalData) {
      finalData = await (async () => {
        try {
          const response = await fetch(`/api/passcode_syncs/get?email=${encodeURIComponent(cleanEmail)}&id=${encodeURIComponent(syncId)}`);
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

    // 3. Replicate direct table records back to laptop to ensure any sync additions on mobile appear on laptop too
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      const activeUserId = profile?.id;
      if (activeUserId) {
        console.log(`[Direct Sync Engine] Replicating direct table records on restore for profile: ${activeUserId}`);

        // Normalize loaded JSON columns to salted UUID format first, so there is never ID mismatch during SQL table merges
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

        const [productsRes, customersRes, expensesRes, transactionsRes, detailRes] = await Promise.all([
          supabase.from("products").select("*").eq("user_id", activeUserId),
          supabase.from("customers").select("*").eq("user_id", activeUserId),
          supabase.from("expenses").select("*").eq("user_id", activeUserId),
          supabase.from("transactions").select("*").eq("user_id", activeUserId).order('created_at', { ascending: false }),
          supabase.from("purchases").select("*").eq("user_id", activeUserId)
        ]);

        if (productsRes.data && productsRes.data.length > 0) {
          const sqlProducts = productsRes.data.map(p => ({
            id: p.id,
            name: p.name,
            sku: p.sku || "",
            stock: Number(p.stock) || 0,
            buyPrice: Number(p.buy_price) || 0,
            sellPrice: Number(p.sell_price) || 0,
            category: p.category || "Electronics",
            unit: p.unit || "piece",
            imageUrl: p.image_url || undefined
          }));
          if (!finalData) finalData = { id: syncId, linked_email: cleanEmail };
          finalData.products = mergeListsById(finalData.products || [], sqlProducts);
        }

        if (customersRes.data && customersRes.data.length > 0) {
          const sqlCustomers = customersRes.data.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address || "",
            type: "customer",
            created_at: c.created_at || new Date().toISOString()
          }));
          if (!finalData) finalData = { id: syncId, linked_email: cleanEmail };
          finalData.contacts = mergeListsById(finalData.contacts || [], sqlCustomers);
        }

        if (expensesRes.data && expensesRes.data.length > 0) {
          const sqlExpenses = expensesRes.data.map(e => ({
            id: e.id,
            category: e.category || "Others",
            amount: Number(e.amount) || 0,
            description: e.description || "",
            date: e.created_at || new Date().toISOString()
          }));
          if (!finalData) finalData = { id: syncId, linked_email: cleanEmail };
          finalData.expenses = mergeListsById(finalData.expenses || [], sqlExpenses);
        }

        if (transactionsRes.data && transactionsRes.data.length > 0) {
          const { data: itemRows } = await supabase
            .from("transaction_items")
            .select("*")
            .eq("user_id", activeUserId);

          const sqlTransactions = transactionsRes.data.map(t => {
            const relatedItems = (itemRows || []).filter((item: any) => item.transaction_id === t.id);
            const mappedItems = relatedItems.map((item: any) => ({
              id: item.id,
              name: item.product_id ? "Product Item" : "Standard Item",
              quantity: Number(item.quantity) || 0,
              price: Number(item.sell_price) || 0,
              total: Number(item.quantity * item.sell_price) || 0,
              productId: item.product_id || undefined
            }));

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

        if (detailRes.data && detailRes.data.length > 0) {
          const sqlPurchases = detailRes.data.map(p => ({
            id: p.id,
            productId: p.product_id,
            productName: "Purchase Item",
            supplierId: "",
            supplierName: "Main Depot",
            quantity: Number(p.quantity) || 0,
            buyPrice: Number(p.buy_price) || 0,
            totalAmount: Number(p.quantity * p.buy_price) || 0,
            date: p.created_at || new Date().toISOString()
          }));
          if (!finalData) finalData = { id: syncId, linked_email: cleanEmail };
          finalData.purchases = mergeListsById(finalData.purchases || [], sqlPurchases);
        }
      }
    } catch (tblErr) {
      console.warn("[Direct Sync Engine] Background tables load failed:", tblErr);
    }

    if (finalData) {
      // Normalize all client IDs in finalData to clean deterministic UUID format to perfectly match SQL relational tables 
      if (finalData.products) {
        finalData.products = finalData.products.map((p: any) => ({
          ...p,
          id: toUUID(p.id, cleanEmail)
        }));
      }
      if (finalData.contacts) {
        finalData.contacts = finalData.contacts.map((c: any) => ({
          ...c,
          id: toUUID(c.id, cleanEmail)
        }));
      }
      if (finalData.expenses) {
        finalData.expenses = finalData.expenses.map((e: any) => ({
          ...e,
          id: toUUID(e.id, cleanEmail)
        }));
      }
      if (finalData.purchases) {
        finalData.purchases = finalData.purchases.map((pur: any) => ({
          ...pur,
          id: toUUID(pur.id, cleanEmail),
          productId: toUUID(pur.productId, cleanEmail)
        }));
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

      restoreLocalKeys(finalData);
      return true;
    }
  } catch (err) {
    console.warn("Failed cloud backup restore:", err);
  }
  return false;
};

export const signUpWithEmail = async (email: string, pass: string) => {
  const cleanEmail = email.trim().toLowerCase();
  try {
    let user: any = null;
    let authError: any = null;

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: pass,
      });
      if (error) {
        authError = error;
      } else {
        user = data.user;
      }
    } catch (directErr: any) {
      console.warn("Direct signup call error, falling back to server route...", directErr);
      authError = directErr;
    }

    if (!user) {
      // If direct signup failed, parse and throw local friendly errors manually
      if (authError && (authError.message?.includes("weak") || authError.message?.includes("at least 6"))) {
        throw new Error("Password must be at least 6 characters long!");
      }
      if (authError && authError.message?.includes("already registered")) {
        throw new Error("This email is already registered! Please log in instead.");
      }

      try {
        // Try backend Express server proxy
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: pass })
        });
        
        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
          const result = await response.json();
          if (result.error) throw new Error(result.error);
          user = result.user;
        } else {
          if (authError) {
            throw authError;
          } else {
            throw new Error("Registration failed. Please try a different email or connection.");
          }
        }
      } catch (fetchErr: any) {
        if (authError) {
          throw new Error(`সুপাবেজ অথেনটিকেশন ব্যর্থ হয়েছে: ${authError.message || authError}. ব্রাউজার অ্যাডব্লকার Supabase ডোমেইন ব্লক করতে পারে অথবা আপনার নতুন সুপাবেজ প্রজেক্টে SQL টেবিল সেটাপ করা দরকার।`);
        } else {
          throw fetchErr;
        }
      }
    }

    if (user) {
      const userObj = { ...user, email: cleanEmail, id: user.id || user.uid, restored: false, isPasscodeUser: false };
      
      // Ensure profile exists in 'profiles' table so mobile apps can log in and reference ID
      try {
        const uId = user.id || user.uid;
        if (uId) {
          const profileData = {
            id: uId,
            email: cleanEmail,
            shop_name: "Barakah Electronics",
            shop_address: "Dhaka, Bangladesh",
            support_phone: "01700-000000",
            vat_reg_id: "VAT-884499"
          };
          await supabase.from("profiles").upsert(profileData);
          console.log("[Auth Engine] Automatically ensured profile row is active in PostgreSQL on signup.");
        }
      } catch (profErr: any) {
        console.warn("[Auth Engine] Profiles table registration warning from signup:", profErr.message);
      }
      
      try {
        const wasRestored = await fetchAndRestoreCloudBackup(cleanEmail, "classic_account_secure");
        userObj.restored = wasRestored;
      } catch (err) {
        console.warn("Restore backup info failed on signup:", err);
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
    let user: any = null;
    let authError: any = null;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });
      if (error) {
        authError = error;
      } else {
        user = data.user;
      }
    } catch (directErr: any) {
      console.warn("Direct signin call error, falling back to server route...", directErr);
      authError = directErr;
    }

    if (!user) {
      // If direct login failed, parse and throw translation
      if (authError) {
        if (authError.message === "Invalid login credentials") {
          throw new Error("Invalid email or password! Please check your credentials and try again.");
        } else if (authError.message === "Email not confirmed") {
          throw new Error("Your email address has not been verified yet. Please click the verification link in your inbox!");
        }
      }

      try {
        // Try backend Express server proxy fallback
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password: pass })
        });
        
        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
          const result = await response.json();
          if (result.error) throw new Error(result.error);
          user = result.user;
        } else {
          if (authError) {
            throw authError;
          } else {
            throw new Error("Invalid signin credentials or server timeout.");
          }
        }
      } catch (fetchErr: any) {
        if (authError) {
          throw new Error(`সুপাবেজ সংযোগ ব্যর্থ হয়েছে: ${authError.message || authError}. অনুগ্রহ করে আপনার ইমেইল/পাসওয়ার্ড যাচাই করুন এবং নিশ্চিত করুন যে ডেটাবেজ সচল রয়েছে।`);
        } else {
          throw fetchErr;
        }
      }
    }

    if (user) {
      const userObj = { ...user, email: cleanEmail, id: user.id || user.uid, restored: false, isPasscodeUser: false };
      
      // Ensure profile exists in 'profiles' table so mobile apps can log in and reference ID
      try {
        const uId = user.id || user.uid;
        if (uId) {
          const profileData = {
            id: uId,
            email: cleanEmail,
            shop_name: "Barakah Electronics",
            shop_address: "Dhaka, Bangladesh",
            support_phone: "01700-000000",
            vat_reg_id: "VAT-884499"
          };
          await supabase.from("profiles").upsert(profileData);
          console.log("[Auth Engine] Automatically ensured profile row is active in PostgreSQL on signin.");
        }
      } catch (profErr: any) {
        console.warn("[Auth Engine] Profiles table registration warning from signin:", profErr.message);
      }
      
      try {
        const wasRestored = await fetchAndRestoreCloudBackup(cleanEmail, "classic_account_secure");
        userObj.restored = wasRestored;
      } catch (err) {
        console.warn("Restore backup info failed on signin:", err);
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
  localStorage.removeItem('barakah_local_active_user');
  currentSupabaseUser = null;
  authListeners.forEach(cb => cb(null));
  await supabase.auth.signOut();
};

export const subscribeToAuthChanges = (callback: (user: any) => void) => {
  authListeners.add(callback);
  callback(currentSupabaseUser);
  return () => { authListeners.delete(callback); };
};

export const auth = {
  get currentUser() { return currentSupabaseUser; }
};

export function getPasscodeSyncId(email: string, pin: string): string {
  const cleanEmail = email.trim().toLowerCase();
  let resolvedPin = pin.trim();

  if (resolvedPin === "classic_account_secure") {
    // Attempt to read custom admin passcode from local business settings
    try {
      const bizInfoStr = localStorage.getItem("barakah_business_info");
      if (bizInfoStr) {
        const bizInfo = JSON.parse(bizInfoStr);
        if (bizInfo && bizInfo.adminPasscode) {
          resolvedPin = String(bizInfo.adminPasscode).trim();
        }
      }
    } catch (_) {}

    // Default fallback to "1234" if no custom passcode is configured
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
  
  const userObj = { email: cleanEmail, uid: syncId, isPasscodeUser: true, restored: false, passcode: pin, id: syncId };
  
  // Attempt background real user authentication inside Supabase Auth to enable RLS-bypassed table sync
  const bgPassword = `PasscodeSecure_${pin}_Barakah_77`;
  try {
    const { data: signInRes, error: signInErr } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: bgPassword
    });
    if (signInErr) {
      if (signInErr.message !== "Invalid login credentials") {
        console.log("[Background Auth] Trying signup for clean credentials...", signInErr.message);
      }
      // If sign in fails, try signing up
      const { data: signUpRes, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password: bgPassword
      });
      if (!signUpErr && signUpRes.user) {
        userObj.id = signUpRes.user.id;
        userObj.uid = signUpRes.user.id;
        // Make sure a profile row is written for them too
        const profileData = {
          id: signUpRes.user.id,
          email: cleanEmail,
          shop_name: "Barakah Electronics",
          shop_address: "Dhaka, Bangladesh",
          support_phone: "01700-000000",
          vat_reg_id: "VAT-884499"
        };
        await supabase.from("profiles").upsert(profileData);
      }
    } else if (signInRes.user) {
      userObj.id = signInRes.user.id;
      userObj.uid = signInRes.user.id;
    }
  } catch (authErr) {
    console.warn("Background auto auth failed for passcode user:", authErr);
  }

  try {
    const wasRestored = await fetchAndRestoreCloudBackup(cleanEmail, pin);
    userObj.restored = wasRestored;
  } catch (err) {
    console.warn("Restore backup info failed on passcode signin:", err);
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
  const syncId = getPasscodeSyncId(email, pin);
  const cleanEmail = email.trim().toLowerCase();

  // Bulletproof Safeguard Protection: Prevent completely blank or degraded states from overwriting non-empty states in the cloud database
  const incomingProductsLength = (payload.products || []).length;
  const incomingTransactionsLength = (payload.transactions || []).length;
  const incomingTotal = incomingProductsLength + incomingTransactionsLength;
  const isExplicitReset = payload.businessInfo?.isExplicitReset === true;

  try {
    // Fetch existing backup from the database to ensure we don't overwrite real data
    const { data: existingSync, error: checkError } = await supabase
      .from("passcode_syncs")
      .select("products, transactions")
      .eq("id", syncId)
      .maybeSingle();
      
    if (!checkError && existingSync && !isExplicitReset) {
      const existingProductsCount = (existingSync.products || []).length;
      const existingTransactionsCount = (existingSync.transactions || []).length;
      const existingTotal = existingProductsCount + existingTransactionsCount;
      
      if (existingTotal > 0) {
        if (incomingTotal === 0) {
          console.warn(`[Sync Guard] Aborted EMPTY database upload payload to protect non-empty existing cloud backup (${existingTotal} items):`, syncId);
          return { success: true, ignored: true }; // Return true to keep frontend healthy without overwriting cloud backup
        }

        // Critical defense 1: If local transactions are fewer than cloud transactions, it means device is out of sync. Preserve cloud!
        if (existingTransactionsCount > incomingTransactionsLength) {
          console.warn(`[Sync Guard] Out of sync transactions detected! Cloud has ${existingTransactionsCount} transactions but incoming has ${incomingTransactionsLength}. Aborted upload to protect transactions.`);
          return { success: true, ignored: true };
        }

        // Critical defense 2: If local state has less data than cloud, check if it's a dramatic reduction (more than 3 items lost and < 90% of existing)
        const itemLoss = existingTotal - incomingTotal;
        if (itemLoss > 3 && incomingTotal < existingTotal * 0.9) {
          console.warn(`[Sync Guard] CRITICAL OVERWRITE PREVENTED! Local state has ${incomingTotal} items, but cloud backup has ${existingTotal} items. Aborted auto-backup to protect the master database from accidental overwrites.`);
          return { success: true, ignored: true }; // Prevents data loss by keeping original high value data
        }
      }
    } else if (checkError) {
      console.warn("[Sync Guard] Cloud check failed, aborting upload to preserve safety of existing backup:", checkError.message);
      return { success: true, ignored: true }; // Avoid pushing degraded state in case of any query error
    }
  } catch (e) {
    console.warn("[Sync Guard] Error during cloud check, aborting upload list to be safe:", e);
    return { success: true, ignored: true }; // Safely abort empty database backup on error
  }

  // --- Real-time Bidirectional Postgres Tables Synchronizer ---
  try {
    const sessionRes = await supabase.auth.getSession();
    const sessionUser = sessionRes?.data?.session?.user;
    let activeUserId = sessionUser?.id || currentSupabaseUser?.id;
    if (!activeUserId) {
      // Find the user ID based on email address
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();
      if (profile && profile.id) {
        activeUserId = profile.id;
      }
    }

    // We only perform background individual table sync if we have a valid, active authenticated session matching activeUserId.
    // If the browser client is unauthenticated (e.g., using an offline-first passcode with no matching database session),
    // any client-side direct table writes will trigger a Row-Level Security (RLS) violation in Postgres.
    // In that case, we skip direct table upsert and rely purely on the `passcode_syncs` JSON backups, which bypass RLS.
    const isSessionReady = !!(sessionUser && sessionUser.id && activeUserId === sessionUser.id);
    if (isSessionReady && activeUserId) {
      console.log(`[Direct Sync Engine] Authenticated session validated. Up-syncing individual tables for User: ${activeUserId}`);
      
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

      // Sequential, reference-safe database synchronization
      try {
        // 1. Independent parent tables first
        if (productsToUpsert.length > 0) {
          const { error } = await supabase.from("products").upsert(productsToUpsert);
          if (error) console.error("[Sync Engine] Products upsert failure:", error.message);
        }
        if (contactsToUpsert.length > 0) {
          const { error } = await supabase.from("customers").upsert(contactsToUpsert);
          if (error) console.error("[Sync Engine] Customers upsert failure:", error.message);
        }
        if (expensesToUpsert.length > 0) {
          const { error } = await supabase.from("expenses").upsert(expensesToUpsert);
          if (error) console.error("[Sync Engine] Expenses upsert failure:", error.message);
        }

        // 2. Dependent tables next (filtered to guarantee foreign key integrity)
        const validProductIds = new Set(productsToUpsert.map(p => p.id));
        const validCustomerIds = new Set(contactsToUpsert.map(c => c.id));

        // Map transactions with verified customer references
        const checkedTransactions = transactionsToUpsert.map(tx => {
          if (tx.customer_id && !validCustomerIds.has(tx.customer_id)) {
            tx.customer_id = null;
          }
          return tx;
        });

        if (checkedTransactions.length > 0) {
          const { error } = await supabase.from("transactions").upsert(checkedTransactions);
          if (error) {
            console.error("[Sync Engine] Transactions upsert failure:", error.message);
          } else {
            // Upsert transaction items only if the transactions succeeded
            const validTransactionIds = new Set(checkedTransactions.map(t => t.id));
            const filteredTransactionItems = transactionItemsToUpsert.filter(item => 
              item.product_id && 
              validProductIds.has(item.product_id) && 
              item.transaction_id && 
              validTransactionIds.has(item.transaction_id)
            );

            if (filteredTransactionItems.length > 0) {
              const { error: tiErr } = await supabase.from("transaction_items").upsert(filteredTransactionItems);
              if (tiErr) console.error("[Sync Engine] Transaction items upsert failure:", tiErr.message);
            }
          }
        }

        // Upsert purchases only with verified products
        const filteredPurchases = purchasesToUpsert.filter(pur => 
          pur.product_id && validProductIds.has(pur.product_id)
        );

        if (filteredPurchases.length > 0) {
          const { error } = await supabase.from("purchases").upsert(filteredPurchases);
          if (error) console.error("[Sync Engine] Purchases upsert failure:", error.message);
        }
      } catch (tableSyncErr: any) {
        console.error("[Sync Engine] Sequenced table upserts crashed:", tableSyncErr);
      }
    }
  } catch (syncErr) {
    console.warn("[Sync Engine] Failed writing to relational database tables:", syncErr);
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

  const body = {
    id: syncId,
    linked_email: cleanEmail,
    products: normalizedProducts,
    contacts: normalizedContacts,
    expenses: normalizedExpenses,
    transactions: normalizedTransactions,
    businessInfo: serializedBusinessInfo,
    business_info: serializedBusinessInfo, // provide snake_case version for Postgres to handle case-folding automatically
    updated_at: new Date().toISOString()
  };

  try {
    // Elevate local state seamlessly in real-time with clean UUID keys 
    const backupObj = {
      id: syncId,
      linked_email: cleanEmail,
      products: normalizedProducts,
      contacts: normalizedContacts,
      expenses: normalizedExpenses,
      transactions: normalizedTransactions,
      businessInfo: serializedBusinessInfo,
      purchases: normalizedPurchases
    };
    restoreLocalKeys(backupObj);
  } catch (err) {
    console.warn("Instant local keys conversion failed:", err);
  }

  // For supreme safety, we also save a daily historical copy
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const historyBody = {
      ...body,
      id: `${syncId}_history_${todayStr}`,
      updated_at: new Date().toISOString()
    };
    supabase.from("passcode_syncs").upsert(historyBody).then(({ error }) => {
      if (error) console.warn("Failed to write daily history backup copy:", error.message);
    });
  } catch (_) {}

  let lastDirectErrorMsg = "";
  try {
    // 1. Direct frontend Supabase upsert (bypasses Express proxy and applies logged-in user context)
    const { error: directError } = await supabase.from("passcode_syncs").upsert(body);
    if (!directError) {
      return { success: true };
    }
    
    // Fallback 1: Retrying with minimalist columns in case the schema in custom DB has missing columns
    if (directError.code === "42703" || directError.message?.toLowerCase().includes("column")) {
      console.warn("Direct upsert failed with missing column/attribute. Retrying with clean snake_case standard columns...");
      const cleanBody = {
        id: body.id,
        linked_email: body.linked_email,
        products: body.products,
        contacts: body.contacts,
        expenses: body.expenses,
        transactions: body.transactions,
        business_info: body.business_info,
        updated_at: body.updated_at
      };
      const { error: retryError } = await supabase.from("passcode_syncs").upsert(cleanBody);
      if (!retryError) {
        return { success: true };
      }
      lastDirectErrorMsg = retryError.message;
    } else {
      lastDirectErrorMsg = directError.message;
    }
    console.warn("Direct supabase upload failed, fallback to Express route...", lastDirectErrorMsg);
  } catch (e: any) {
    lastDirectErrorMsg = e?.message || String(e);
    console.warn("Direct upload error:", e);
  }

  try {
    const response = await fetch("/api/passcode_syncs/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: body })
    });
    if (response.ok) {
      return { success: true };
    }
    const errText = await response.text();
    let errObj;
    try { errObj = JSON.parse(errText); } catch (_) {}
    const errMsg = errObj?.error || errText || "HTTP " + response.status;
    return { success: false, error: errMsg || lastDirectErrorMsg || "Proxy upload failed" };
  } catch (err: any) {
    console.error("Failed cloud backup upload:", err);
    return { success: false, error: err.message || lastDirectErrorMsg || "Connection failed" };
  }
};

export const upsertDocument = async (table: string, id: string, data: any) => {
  await fetch("/api/db/upsert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, id, data })
  });
};

export const deleteDocument = async (table: string, id: string) => {
  await fetch("/api/db/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, id })
  });
};

export const fetchUserCollection = async (table: string, ownerEmail: string) => {
  const response = await fetch(`/api/db/fetch?table=${encodeURIComponent(table)}&owner_email=${encodeURIComponent(ownerEmail)}`);
  return await response.json();
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
  await upsertDocument('business_info', docId, { linkedEmail: email, ...info });
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
