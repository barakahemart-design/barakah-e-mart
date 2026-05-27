import { createClient } from '@supabase/supabase-js';
import { 
  cleanDemoProducts, 
  cleanDemoContacts, 
  cleanDemoExpenses, 
  cleanDemoPurchases, 
  cleanDemoTransactions 
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
  if (data.products) localStorage.setItem('barakah_products', JSON.stringify(cleanDemoProducts(data.products)));
  if (data.contacts) localStorage.setItem('barakah_contacts', JSON.stringify(cleanDemoContacts(data.contacts)));
  if (data.expenses) localStorage.setItem('barakah_expenses', JSON.stringify(cleanDemoExpenses(data.expenses)));
  if (data.transactions) localStorage.setItem('barakah_transactions', JSON.stringify(cleanDemoTransactions(data.transactions)));
  if (data.businessInfo) localStorage.setItem('barakah_business_info', JSON.stringify(data.businessInfo));
  if (data.purchases) localStorage.setItem('barakah_purchases', JSON.stringify(cleanDemoPurchases(data.purchases)));
};

export const fetchAndRestoreCloudBackup = async (email: string, pin: string) => {
  const cleanEmail = email.trim().toLowerCase();
  const syncId = getPasscodeSyncId(cleanEmail, pin);
  
  try {
    // 1. Direct frontend query using the user session token/JWT (bypasses RLS)
    const { data: directData, error: directError } = await supabase
      .from("passcode_syncs")
      .select("*")
      .eq("id", syncId)
      .maybeSingle();

    if (directError) {
      console.warn("Direct supabase query failed, trying Express proxy backup fallback...", directError.message);
    }

    const finalData = (!directError && directData) 
      ? directData 
      : await (async () => {
          try {
            const response = await fetch(`/api/passcode_syncs/get?id=${encodeURIComponent(syncId)}`);
            if (response.ok) {
              const contentType = response.headers.get("content-type");
              if (contentType && contentType.includes("application/json")) {
                return await response.json();
              }
            }
          } catch (e) {
            console.warn("Express fallback fetch failed:", e);
          }
          return null;
        })();

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
        throw new Error("পাসওয়ার্ডটি কমপক্ষে ৬ অক্ষরের হতে হবে!");
      }
      if (authError && authError.message.includes("already registered")) {
        throw new Error("এই ইমেইল দিয়ে ইতঃপূর্বেই অ্যাকাউন্ট তৈরি করা হয়েছে! অনুগ্রহ করে লগইন করুন।");
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
      const restored = await fetchAndRestoreCloudBackup(cleanEmail, "classic_account_secure");
      const userObj = { ...user, email: cleanEmail, id: user.id || user.uid, restored, isPasscodeUser: false };
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
          throw new Error("ভুল পাসওয়ার্ড বা জিমেইল! অনুগ্রহ করে পুনরায় চেক করুন অথবা 'Signup' করুন!");
        } else if (authError.message === "Email not confirmed") {
          throw new Error("আপনার ইমেইল ভেরিফিকেশন সম্পন্ন হয়নি। দয়া করে ইনবক্স চেক করুন!");
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
      const restored = await fetchAndRestoreCloudBackup(cleanEmail, "classic_account_secure");
      const userObj = { ...user, email: cleanEmail, id: user.id || user.uid, restored, isPasscodeUser: false };
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
  const rawKey = `${cleanEmail}_${pin.trim()}_smart_v1`;
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
  
  const restored = await fetchAndRestoreCloudBackup(cleanEmail, pin);
  const userObj = { email: cleanEmail, uid: syncId, isPasscodeUser: true, restored, passcode: pin };
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

  const body = {
    id: syncId,
    linked_email: cleanEmail,
    products: payload.products,
    contacts: payload.contacts,
    expenses: payload.expenses,
    transactions: payload.transactions,
    businessInfo: payload.businessInfo,
    purchases: payload.purchases || [],
    updated_at: new Date().toISOString()
  };

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
