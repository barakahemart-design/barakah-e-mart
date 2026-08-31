import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  setDoc,
  query,
  where
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

export function getActiveStoreEmail(): string {
  try {
    const cached = localStorage.getItem('barakah_local_active_user');
    if (cached) {
      const parsed = JSON.parse(cached);
      const email = (parsed?.email || parsed?.linked_email || parsed?.linkedEmail || '').trim().toLowerCase();
      if (email) return email;
    }
  } catch (_) {}
  return (auth.currentUser?.email || '').trim().toLowerCase();
}

// Known store UIDs mapping and store validation
export function isDocMatchingStore(docData: any, cleanEmail: string, activeUid: string): boolean {
  if (!cleanEmail && !activeUid) return true;
  const targetEmail = (cleanEmail || '').trim().toLowerCase();
  const targetUid = (activeUid || '').trim();

  const docStore = String(docData.store_id || docData.storeId || docData.email || docData.linked_email || docData.linkedEmail || '').trim().toLowerCase();
  if (targetEmail && docStore && (docStore === targetEmail || docStore.includes(targetEmail) || targetEmail.includes(docStore))) return true;

  const docUid = String(docData.user_id || docData.userId || docData.owner_id || '').trim();
  if (targetEmail && docUid.toLowerCase() === targetEmail) return true;
  if (targetUid && docUid === targetUid) return true;
  
  // Also if docData has no store_id or user_id (global or legacy), include it
  if (!docStore && !docUid) return true;

  if (targetEmail === 'barakahemart@gmail.com') {
    const known = ['1d4ce803-cbf5-44f1-9ec5-56642de068a1', 'DGeDhFzjTDaYCeLZiMSvm8TY4sc2', 'vault_a2vflc', 'xrTguetUZqSbZOxUKRiUNJV3X1M2', 'C5eOR2R8WEMegF53NA5eItMWDrr2', 'Lzk64vTQcRPy0MWwQK6t0echMmq1', '1ys9dKJ3fKOKIVOl0GIbuIiHeB73'];
    if (known.includes(docUid)) return true;
  } else if (targetEmail === 'barakahbillpro@gmail.com') {
    const known = ['xckXTyRn5AbsrU1paXbmj9dR6HX2'];
    if (known.includes(docUid)) return true;
  } else if (targetEmail === 'tendabangladesh72@gmail.com') {
    const known = ['yVAiT3KAHnMYGX2D1hSxWGiZETw1', 'rb0SFawVFSTANoZhNwYokmJOFyP2'];
    if (known.includes(docUid)) return true;
  }
  return false;
}

// Helper function to create standard store_id-partitioned collections subscriptions
function createSubscription(collName: string) {
  return (userIdentifier: string, callback: (items: any[]) => void) => {
    const storeId = getActiveStoreEmail();
    const activeFirebaseUid = auth.currentUser?.uid || "null";
    const activeUid = userIdentifier || auth.currentUser?.uid || storeId;

    console.log(`[Realtime Listener Setup]`, {
      activeFirebaseUid,
      activeUserId: activeUid,
      resolvedStoreId: storeId,
      listenerCollection: collName,
      partitionKey: "store_id",
      status: "subscribing"
    });

    let q: any;
    try {
      if (storeId) {
        q = query(collection(db, collName), where("store_id", "==", storeId));
      } else {
        q = collection(db, collName);
      }
    } catch (_) {
      q = collection(db, collName);
    }

    const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snapshot: any) => {
      console.log(`[Realtime Snapshot Success]`, {
        collection: collName,
        docCount: snapshot.docs.length,
        resolvedStoreId: storeId,
        activeFirebaseUid,
        hasPendingWrites: snapshot.metadata?.hasPendingWrites
      });

      const matchedDocs = snapshot.docs.filter((d: any) => isDocMatchingStore(d.data(), storeId, activeUid));
      callback(matchedDocs.map((d: any) => {
        const data = d.data();
        return {
          ...data,
          id: data.id || d.id,
          firestoreId: d.id
        };
      }));
    }, (error: any) => {
      console.warn(`[Realtime Listener Error] Collection: ${collName}, StoreId: ${storeId}:`, error);
      // Fallback: try raw collection listener if query with where clause encounters an index/permission issue
      if (q !== collection(db, collName)) {
        return onSnapshot(collection(db, collName), (fallbackSnap) => {
          const matchedDocs = fallbackSnap.docs.filter(d => isDocMatchingStore(d.data(), storeId, activeUid));
          callback(matchedDocs.map(d => {
            const data = d.data();
            return {
              ...data,
              id: data.id || d.id,
              firestoreId: d.id
            };
          }));
        }, (fbErr) => {
          console.warn(`[Realtime Listener Fallback Error] Collection: ${collName}:`, fbErr);
        });
      }
    });

    return unsub;
  };
}

// Helper function to perform save operations (add/update)
export async function handleSave(collName: string, arg1: any, arg2?: any): Promise<string> {
  const data = typeof arg1 === 'string' ? arg2 : arg1;
  const targetId = data?.id || (typeof arg1 === 'string' && !arg2 ? arg1 : '') || doc(collection(db, collName)).id;

  const userId = typeof arg1 === 'string' ? arg1 : (arg1?.user_id || arg1?.userId);
  const { id, ...dataWithoutId } = data || {};
  const cleanEmail = (data?.email || data?.linked_email || data?.store_id || getActiveStoreEmail()).trim().toLowerCase();
  const activeUid = auth.currentUser?.uid || userId || cleanEmail || 'store_owner';

  const docData: any = {
    id: targetId,
    ...dataWithoutId,
    user_id: activeUid,
    userId: activeUid,
    owner_id: activeUid,
    store_id: cleanEmail,
    storeId: cleanEmail,
    email: cleanEmail,
    linked_email: cleanEmail,
    linkedEmail: cleanEmail,
    updated_at: data?.updated_at || new Date().toISOString()
  };

  if (collName === "products") {
    const bPrice = docData.buyPrice ?? docData.buy_price ?? 0;
    const sPrice = docData.sellPrice ?? docData.sell_price ?? 0;
    const imgUrl = docData.imageUrl || docData.image_url || "";
    docData.buyPrice = Number(bPrice) || 0;
    docData.buy_price = Number(bPrice) || 0;
    docData.sellPrice = Number(sPrice) || 0;
    docData.sell_price = Number(sPrice) || 0;
    docData.imageUrl = imgUrl;
    docData.image_url = imgUrl;
  }

  // Direct Firestore write using the client SDK
  try {
    await setDoc(doc(db, collName, targetId), docData, { merge: true });
  } catch (err) {
    console.warn(`[Firestore write warning] ${collName}/${targetId}:`, err);
  }

  // Background broadcast notification to sync proxy for immediate multi-device SSE (< 10ms)
  try {
    const authHeaders: any = {
      "Content-Type": "application/json",
      "x-user-uid": activeUid,
      "x-user-email": cleanEmail
    };
    fetch("/api/db/upsert", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ table: collName, id: targetId, data: docData })
    }).catch(() => {});
  } catch (_) {}

  return targetId;
}

// Helper function to perform delete operations
async function handleDelete(collName: string, id: string): Promise<void> {
  const cleanEmail = getActiveStoreEmail();
  const activeUid = auth.currentUser?.uid || cleanEmail || 'store_owner';

  // Direct Firestore deletion
  try {
    await deleteDoc(doc(db, collName, id));
  } catch (err) {
    console.warn(`[Firestore delete warning] ${collName}/${id}:`, err);
  }

  // Background broadcast notification to sync proxy for immediate multi-device SSE (< 10ms)
  try {
    const authHeaders: any = {
      "Content-Type": "application/json",
      "x-user-uid": activeUid,
      "x-user-email": cleanEmail
    };
    fetch("/api/db/delete", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ table: collName, id })
    }).catch(() => {});
  } catch (_) {}
}

// Exported subscribe functions
export const subscribeProducts = createSubscription("products");
export const subscribeCustomers = createSubscription("customers");
export const subscribeTransactions = createSubscription("transactions");
export const subscribeTransactionItems = createSubscription("transaction_items");
export const subscribeExpenses = createSubscription("expenses");
export const subscribePurchases = createSubscription("purchases");

// Exported save functions with overloads
export async function saveProduct(userId: string, product: any): Promise<string>;
export async function saveProduct(product: any): Promise<string>;
export async function saveProduct(arg1: any, arg2?: any): Promise<string> {
  return handleSave("products", arg1, arg2);
}

export async function saveCustomer(userId: string, customer: any): Promise<string>;
export async function saveCustomer(customer: any): Promise<string>;
export async function saveCustomer(arg1: any, arg2?: any): Promise<string> {
  return handleSave("customers", arg1, arg2);
}

export async function saveTransaction(userId: string, transaction: any): Promise<string>;
export async function saveTransaction(transaction: any): Promise<string>;
export async function saveTransaction(arg1: any, arg2?: any): Promise<string> {
  return handleSave("transactions", arg1, arg2);
}

export async function saveExpense(userId: string, expense: any): Promise<string>;
export async function saveExpense(expense: any): Promise<string>;
export async function saveExpense(arg1: any, arg2?: any): Promise<string> {
  return handleSave("expenses", arg1, arg2);
}

export async function savePurchase(userId: string, purchase: any): Promise<string>;
export async function savePurchase(purchase: any): Promise<string>;
export async function savePurchase(arg1: any, arg2?: any): Promise<string> {
  return handleSave("purchases", arg1, arg2);
}

// Exported delete functions
export async function deleteProduct(productId: string): Promise<void> {
  return handleDelete("products", productId);
}

export async function deleteCustomer(customerId: string): Promise<void> {
  return handleDelete("customers", customerId);
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  return handleDelete("transactions", transactionId);
}

export async function deleteExpense(expenseId: string): Promise<void> {
  return handleDelete("expenses", expenseId);
}

export async function deletePurchase(purchaseId: string): Promise<void> {
  return handleDelete("purchases", purchaseId);
}
