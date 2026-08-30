import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentSingleTabManager,
  memoryLocalCache,
  doc, 
  getDocFromServer, 
  setLogLevel 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

try {
  setLogLevel("silent");
} catch (e) {
  console.warn("Could not set client Firestore log level:", e);
}

// Safe localStorage setItem patch to prevent uncaught QuotaExceededError in browser
if (typeof window !== 'undefined' && window.Storage) {
  try {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key: string, value: string) {
      try {
        originalSetItem.apply(this, [key, value]);
      } catch (err: any) {
        if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014) {
          console.warn(`[Storage Quota Warning] LocalStorage quota exceeded on key "${key}". Pruning stale keys...`);
          try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < this.length; i++) {
              const k = this.key(i);
              if (k && (k.startsWith('firestore_') || k.includes('fail_safe_backup') || k.startsWith('barakah_flat_'))) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.forEach(k => this.removeItem(k));
            originalSetItem.apply(this, [key, value]);
          } catch (retryErr) {
            console.warn(`[Storage Quota Warning] Could not save key "${key}" even after pruning.`);
          }
        } else {
          throw err;
        }
      }
    };
  } catch (e) {
    console.warn("Could not patch Storage.prototype.setItem:", e);
  }
}

// Clean up stale WebStorage Firestore keys from localStorage to prevent QuotaExceededError
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith('firestore_mutations_') || k.startsWith('firestore_clients_') || k.startsWith('firestore_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => window.localStorage.removeItem(k));
  } catch (err) {
    console.warn("Could not clean stale Firestore localStorage keys:", err);
  }
}

const app = initializeApp(firebaseConfig);

// Use in-memory Firestore cache to eliminate WebStorageSharedClientState localStorage quota issues
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (operationType !== OperationType.GET && operationType !== OperationType.LIST) {
    throw new Error(JSON.stringify(errInfo));
  }
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

testConnection();
