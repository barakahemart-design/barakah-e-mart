import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  setDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

export function getActiveStoreEmail(): string {
  try {
    const cached = localStorage.getItem('barakah_local_active_user');
    if (cached) {
      const parsed = JSON.parse(cached);
      return (parsed?.email || '').trim().toLowerCase();
    }
  } catch (_) {}
  return (auth.currentUser?.email || '').trim().toLowerCase();
}

// Known store UIDs mapping
export function isDocMatchingStore(docData: any, cleanEmail: string, activeUid: string): boolean {
  if (!cleanEmail && !activeUid) return true;
  const docStore = (docData.store_id || docData.storeId || docData.email || docData.linked_email || docData.linkedEmail || '').trim().toLowerCase();
  if (cleanEmail && docStore === cleanEmail) return true;
  
  const docUid = String(docData.user_id || docData.userId || docData.owner_id || '');
  if (activeUid && docUid === activeUid) return true;
  if (cleanEmail && docUid === cleanEmail) return true;
  
  if (cleanEmail === 'barakahemart@gmail.com') {
    const known = ['1d4ce803-cbf5-44f1-9ec5-56642de068a1', 'DGeDhFzjTDaYCeLZiMSvm8TY4sc2', 'vault_a2vflc', 'xrTguetUZqSbZOxUKRiUNJV3X1M2', 'C5eOR2R8WEMegF53NA5eItMWDrr2', 'Lzk64vTQcRPy0MWwQK6t0echMmq1', '1ys9dKJ3fKOKIVOl0GIbuIiHeB73'];
    if (known.includes(docUid)) return true;
  } else if (cleanEmail === 'barakahbillpro@gmail.com') {
    const known = ['xckXTyRn5AbsrU1paXbmj9dR6HX2'];
    if (known.includes(docUid)) return true;
  } else if (cleanEmail === 'tendabangladesh72@gmail.com') {
    const known = ['yVAiT3KAHnMYGX2D1hSxWGiZETw1', 'rb0SFawVFSTANoZhNwYokmJOFyP2'];
    if (known.includes(docUid)) return true;
  }
  return false;
}

// Helper function to create standard user-filtered collections subscriptions
function createSubscription(collName: string) {
  return (userIdentifier: string, callback: (items: any[]) => void) => {
    const cleanEmail = getActiveStoreEmail();
    const activeUid = userIdentifier || auth.currentUser?.uid || cleanEmail;
    
    return onSnapshot(collection(db, collName), (snapshot) => {
      const matchedDocs = snapshot.docs.filter(d => isDocMatchingStore(d.data(), cleanEmail, activeUid));
      callback(matchedDocs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: data.id || d.id,
          firestoreId: d.id
        };
      }));
    }, (error) => {
      console.warn(`[firestoreService] Snapshot listener for ${collName} notice:`, error);
    });
  };
}

// Helper function to perform save operations (add/update)
export async function handleSave(collName: string, arg1: any, arg2?: any): Promise<string> {
  const userId = typeof arg1 === 'string' ? arg1 : (arg1.user_id || arg1.userId);
  const data = typeof arg1 === 'string' ? arg2 : arg1;
  const { id, ...dataWithoutId } = data;
  const cleanEmail = (data.email || data.linked_email || data.store_id || getActiveStoreEmail()).trim().toLowerCase();

  const docData: any = {
    id,
    ...dataWithoutId,
    user_id: userId || cleanEmail,
    userId: userId || cleanEmail,
    owner_id: userId || cleanEmail,
    store_id: cleanEmail,
    storeId: cleanEmail,
    email: cleanEmail,
    linked_email: cleanEmail,
    linkedEmail: cleanEmail,
    updated_at: data.updated_at || new Date().toISOString()
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

  // Attempt direct Firestore setDoc first
  let directSuccess = false;
  try {
    if (id) {
      await setDoc(doc(db, collName, id), docData, { merge: true });
    } else {
      const docRef = await addDoc(collection(db, collName), docData);
      docData.id = docRef.id;
    }
    directSuccess = true;
  } catch (error) {
    console.warn(`[firestoreService] Direct Firestore write to ${collName} failed, utilizing server sync proxy...`, error);
  }

  // Always propagate to /api/db/upsert for multi-device server synchronization
  try {
    const authHeaders = {
      "Content-Type": "application/json",
      "x-user-uid": userId || auth.currentUser?.uid || cleanEmail,
      "x-user-email": cleanEmail || auth.currentUser?.email || ""
    };
    const res = await fetch("/api/db/upsert", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ table: collName, id: id || docData.id, data: docData })
    });
    if (res.ok) {
      return id || docData.id;
    }
  } catch (syncErr) {
    console.warn(`[firestoreService] Server upsert proxy notification error:`, syncErr);
  }

  if (directSuccess) {
    return id || docData.id;
  }

  return id || docData.id;
}

// Helper function to perform delete operations
async function handleDelete(collName: string, id: string): Promise<void> {
  const cleanEmail = getActiveStoreEmail();
  try {
    await deleteDoc(doc(db, collName, id));
  } catch (error) {
    console.warn(`[firestoreService] Direct delete for ${collName}/${id} error:`, error);
  }

  try {
    const authHeaders = {
      "Content-Type": "application/json",
      "x-user-uid": auth.currentUser?.uid || cleanEmail,
      "x-user-email": cleanEmail
    };
    await fetch("/api/db/delete", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ table: collName, id })
    });
  } catch (_) {}
}

// Exported subscribe functions
export const subscribeProducts = createSubscription("products");
export const subscribeCustomers = createSubscription("customers");
export const subscribeTransactions = createSubscription("transactions");
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
