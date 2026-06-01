import { createClient } from '@supabase/supabase-js';
import { 
  cleanDemoProducts, 
  cleanDemoContacts, 
  cleanDemoExpenses, 
  cleanDemoPurchases, 
  cleanDemoTransactions,
  INITIAL_BUSINESS_INFO
} from './mockDB';

const fallbackUrl = 'https://cmanayslirpenaruncwr.supabase.co';
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtYW5heXNsaXJwZW5hcnVuY3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTQwNDQsImV4cCI6MjA5NTI5MDA0NH0.f4-DddnnqnknJ_X-4rVjes7a32QlI59cdEW1eyQkads';

// Fallback logic inside the client bundle
let rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || fallbackUrl;
let rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || fallbackKey;

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

export const restoreLocalKeys = (data: any) => {
  if (!data) return;

  // 1. MERGE PRODUCTS
  if (data.products) {
    const rawLocalProducts = localStorage.getItem('barakah_products');
    let localProducts = [];
    if (rawLocalProducts) {
      try { localProducts = JSON.parse(rawLocalProducts); } catch (e) {}
    }
    const cleanCloudProducts = cleanDemoProducts(data.products);
    const mergedProducts = [...cleanCloudProducts];
    if (Array.isArray(localProducts)) {
      for (const lp of localProducts) {
        if (!mergedProducts.some(p => p.id === lp.id)) {
          mergedProducts.push(lp);
        }
      }
    }
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
      try { localContacts = JSON.parse(rawLocalContacts); } catch (e) {}
    }
    const cleanCloudContacts = cleanDemoContacts(data.contacts);
    const mergedContacts = [...cleanCloudContacts];
    if (Array.isArray(localContacts)) {
      for (const lc of localContacts) {
        if (!mergedContacts.some(c => c.id === lc.id)) {
          mergedContacts.push(lc);
        }
      }
    }
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
      try { localExpenses = JSON.parse(rawLocalExpenses); } catch (e) {}
    }
    const cleanCloudExpenses = cleanDemoExpenses(data.expenses);
    const mergedExpenses = [...cleanCloudExpenses];
    if (Array.isArray(localExpenses)) {
      for (const le of localExpenses) {
        if (!mergedExpenses.some(ex => ex.id === le.id)) {
          mergedExpenses.push(le);
        }
      }
    }
    localStorage.setItem('barakah_expenses', JSON.stringify(mergedExpenses));
  } else {
    const rawLocalExpenses = localStorage.getItem('barakah_expenses');
    if (!rawLocalExpenses) {
      localStorage.setItem('barakah_expenses', JSON.stringify([]));
    }
  }

  // 4. MERGE TRANSACTIONS (CRITICAL - UNION BY ID AND INVOICENO)
  if (data.transactions) {
    const rawLocalTransactions = localStorage.getItem('barakah_transactions');
    let localTransactions = [];
    if (rawLocalTransactions) {
      try { localTransactions = JSON.parse(rawLocalTransactions); } catch (e) {}
    }
    const cleanCloudTransactions = cleanDemoTransactions(data.transactions);
    const mergedTransactions = [...cleanCloudTransactions];
    if (Array.isArray(localTransactions)) {
      for (const lt of localTransactions) {
        const alreadyExists = mergedTransactions.some(t => t.id === lt.id || (lt.invoiceNo && t.invoiceNo === lt.invoiceNo));
        if (!alreadyExists) {
          mergedTransactions.push(lt);
        }
      }
    }
    // Sort transactions by date descending so the newest are first
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
      try { localPurchases = JSON.parse(rawLocalPurchases); } catch (e) {}
    }
    const cleanCloudPurchases = cleanDemoPurchases(p);
    const mergedPurchases = [...cleanCloudPurchases];
    if (Array.isArray(localPurchases)) {
      for (const lp of localPurchases) {
        if (!mergedPurchases.some(pur => pur.id === lp.id)) {
          mergedPurchases.push(lp);
        }
      }
    }
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
};

export const fetchAndRestoreCloudBackup = async (email: string, pin: string) => {
  const cleanEmail = email.trim().toLowerCase();
  const syncId = getPasscodeSyncId(cleanEmail, pin);
  
  try {
    let finalData = null;

    // 1. Smart direct query: retrieve ALL backups created under this email to find the latest active database row
    const { data: directList, error: directError } = await supabase
      .from("passcode_syncs")
      .select("*")
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
        .select("*")
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

    if (finalData) {
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
    } catch (directErr) {
      console.warn("Direct signup call error, falling back to server route...", directErr);
    }

    if (!user) {
      // If direct signup failed, parse and throw local friendly errors manually
      if (authError && (authError.message.includes("weak") || authError.message.includes("at least 6"))) {
        throw new Error("Password must be at least 6 characters long!");
      }
      if (authError && authError.message.includes("already registered")) {
        throw new Error("This email is already registered! Please log in instead.");
      }

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
    }

    if (user) {
      const userObj = { ...user, email: cleanEmail, id: user.id || user.uid, restored: false, isPasscodeUser: false };
      
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
    } catch (directErr) {
      console.warn("Direct signin call error, falling back to server route...", directErr);
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
    }

    if (user) {
      const userObj = { ...user, email: cleanEmail, id: user.id || user.uid, restored: false, isPasscodeUser: false };
      
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
  
  const userObj = { email: cleanEmail, uid: syncId, isPasscodeUser: true, restored: false, passcode: pin };
  
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
          return true; // Return true to keep frontend healthy without overwriting cloud backup
        }

        // Critical defense 1: If local transactions are fewer than cloud transactions, it means device is out of sync. Preserve cloud!
        if (existingTransactionsCount > incomingTransactionsLength) {
          console.warn(`[Sync Guard] Out of sync transactions detected! Cloud has ${existingTransactionsCount} transactions but incoming has ${incomingTransactionsLength}. Aborted upload to protect transactions.`);
          return true;
        }

        // Critical defense 2: If local state has less data than cloud, check if it's a dramatic reduction (more than 3 items lost and < 90% of existing)
        const itemLoss = existingTotal - incomingTotal;
        if (itemLoss > 3 && incomingTotal < existingTotal * 0.9) {
          console.warn(`[Sync Guard] CRITICAL OVERWRITE PREVENTED! Local state has ${incomingTotal} items, but cloud backup has ${existingTotal} items. Aborted auto-backup to protect the master database from accidental overwrites.`);
          return true; // Prevents data loss by keeping original high value data
        }
      }
    } else if (checkError) {
      console.warn("[Sync Guard] Cloud check failed, aborting upload to preserve safety of existing backup:", checkError.message);
      return true; // Avoid pushing degraded state in case of any query error
    }
  } catch (e) {
    console.warn("[Sync Guard] Error during cloud check, aborting upload list to be safe:", e);
    return true; // Safely abort empty database backup on error
  }

  const serializedBusinessInfo = {
    ...(payload.businessInfo || {}),
    purchases: payload.purchases || []
  };

  const body = {
    id: syncId,
    linked_email: cleanEmail,
    products: payload.products,
    contacts: payload.contacts,
    expenses: payload.expenses,
    transactions: payload.transactions,
    businessInfo: serializedBusinessInfo,
    business_info: serializedBusinessInfo, // provide snake_case version for Postgres to handle case-folding automatically
    updated_at: new Date().toISOString()
  };

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

  try {
    // 1. Direct frontend Supabase upsert (bypasses Express proxy and applies logged-in user context)
    const { error: directError } = await supabase.from("passcode_syncs").upsert(body);
    if (!directError) {
      return true;
    }
    console.warn("Direct supabase upload failed, fallback to Express route...", directError.message);
  } catch (e) {
    console.warn("Direct upload error:", e);
  }

  try {
    const response = await fetch("/api/passcode_syncs/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: body })
    });
    return response.ok;
  } catch (err) {
    console.error("Failed cloud backup upload:", err);
    return false;
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
