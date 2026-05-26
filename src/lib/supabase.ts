import { createClient } from '@supabase/supabase-js';

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

export const signUpWithEmail = async (email: string, pass: string) => {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password: pass })
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error);
    if (result.user) {
      updateCurrentUser(result.user);
      localStorage.setItem('barakah_local_active_user', JSON.stringify(result.user));
      return result.user;
    }
  } catch (err: any) {
    throw err;
  }
};

export const signInWithEmail = async (email: string, pass: string) => {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password: pass })
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error);
    if (result.user) {
      updateCurrentUser(result.user);
      localStorage.setItem('barakah_local_active_user', JSON.stringify(result.user));
      return result.user;
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
  
  try {
    const response = await fetch(`/api/passcode_syncs/get?id=${encodeURIComponent(syncId)}`);
    if (response.ok) {
      const data = await response.json();
      if (data) {
        if (data.products) localStorage.setItem('barakah_products', JSON.stringify(data.products));
        if (data.contacts) localStorage.setItem('barakah_contacts', JSON.stringify(data.contacts));
        if (data.expenses) localStorage.setItem('barakah_expenses', JSON.stringify(data.expenses));
        if (data.transactions) localStorage.setItem('barakah_transactions', JSON.stringify(data.transactions));
        if (data.businessInfo) localStorage.setItem('barakah_business_info', JSON.stringify(data.businessInfo));
        
        const userObj = { email: cleanEmail, uid: syncId, isPasscodeUser: true, restored: true };
        updateCurrentUser(userObj);
        localStorage.setItem('barakah_local_active_user', JSON.stringify(userObj));
        return userObj;
      }
    }
  } catch (err) {
    console.warn("Failed passcode vault sync check, continuing as default clean instance", err);
  }

  const userObj = { email: cleanEmail, uid: syncId, isPasscodeUser: true, restored: false };
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
}) => {
  const syncId = getPasscodeSyncId(email, pin);
  try {
    const response = await fetch("/api/passcode_syncs/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: {
          id: syncId,
          linked_email: email.trim().toLowerCase(),
          products: payload.products,
          contacts: payload.contacts,
          expenses: payload.expenses,
          transactions: payload.transactions,
          businessInfo: payload.businessInfo,
          updated_at: new Date().toISOString()
        }
      })
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
