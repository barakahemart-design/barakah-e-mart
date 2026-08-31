import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  setDoc,
  query,
  where
} from 'firebase/firestore';
import { db, auth } from './firebase';

/** Firebase Auth is the authoritative account identity on every device. */
export function getActiveStoreEmail(): string {
  return (auth.currentUser?.email || '').trim().toLowerCase();
}

export function isDocMatchingStore(docData: any, cleanEmail: string, activeUid: string): boolean {
  const targetEmail = (cleanEmail || '').trim().toLowerCase();
  const targetUid = (activeUid || '').trim();
  if (!targetEmail && !targetUid) return false;

  const docStore = String(
    docData?.store_id || docData?.storeId || docData?.email ||
    docData?.linked_email || docData?.linkedEmail || ''
  ).trim().toLowerCase();

  if (targetEmail && docStore === targetEmail) return true;

  const docUid = String(
    docData?.user_id || docData?.userId || docData?.owner_id || ''
  ).trim();

  return !!targetUid && docUid === targetUid;
}

function createSubscription(collName: string) {
  return (userIdentifier: string, callback: (items: any[]) => void) => {
    const currentUser = auth.currentUser;
    const storeId = getActiveStoreEmail();
    const activeUid = currentUser?.uid || userIdentifier || '';

    if (!currentUser || !storeId) {
      console.warn(`[Realtime Listener] No authenticated Firebase account for ${collName}`);
      callback([]);
      return () => {};
    }

    console.log('[Realtime Listener Setup]', {
      collection: collName,
      activeFirebaseUid: activeUid,
      resolvedStoreId: storeId,
      status: 'subscribing'
    });

    const q = query(collection(db, collName), where('store_id', '==', storeId));

    return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const items = snapshot.docs
        .filter((d) => isDocMatchingStore(d.data(), storeId, activeUid))
        .map((d) => ({
          ...d.data(),
          id: d.data().id || d.id,
          firestoreId: d.id
        }));

      console.log('[Realtime Snapshot Success]', {
        collection: collName,
        docCount: items.length,
        resolvedStoreId: storeId,
        activeFirebaseUid: activeUid,
        hasPendingWrites: snapshot.metadata?.hasPendingWrites
      });

      callback(items);
    }, (error) => {
      console.error(`[Realtime Listener Error] ${collName}`, error);
      callback([]);
    });
  };
}

/** Save directly to Firestore. A failed write must fail the operation. */
export async function handleSave(collName: string, arg1: any, arg2?: any): Promise<string> {
  const data = typeof arg1 === 'string' ? arg2 : arg1;
  const currentUser = auth.currentUser;

  if (!currentUser?.uid || !currentUser.email) {
    throw new Error('You must be signed in with Firebase before saving data.');
  }

  const targetId = data?.id || doc(collection(db, collName)).id;
  const cleanEmail = currentUser.email.trim().toLowerCase();
  const activeUid = currentUser.uid;
  const { id, ...dataWithoutId } = data || {};

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

  if (collName === 'products') {
    const bPrice = docData.buyPrice ?? docData.buy_price ?? 0;
    const sPrice = docData.sellPrice ?? docData.sell_price ?? 0;
    const imgUrl = docData.imageUrl || docData.image_url || '';
    docData.buyPrice = Number(bPrice) || 0;
    docData.buy_price = Number(bPrice) || 0;
    docData.sellPrice = Number(sPrice) || 0;
    docData.sell_price = Number(sPrice) || 0;
    docData.imageUrl = imgUrl;
    docData.image_url = imgUrl;
  }

  await setDoc(doc(db, collName, targetId), docData, { merge: true });
  return targetId;
}

async function handleDelete(collName: string, id: string): Promise<void> {
  if (!auth.currentUser?.uid) {
    throw new Error('You must be signed in with Firebase before deleting data.');
  }
  await deleteDoc(doc(db, collName, id));
}

export const subscribeProducts = createSubscription('products');
export const subscribeCustomers = createSubscription('customers');
export const subscribeTransactions = createSubscription('transactions');
export const subscribeTransactionItems = createSubscription('transaction_items');
export const subscribeExpenses = createSubscription('expenses');
export const subscribePurchases = createSubscription('purchases');

export async function saveProduct(userId: string, product: any): Promise<string>;
export async function saveProduct(product: any): Promise<string>;
export async function saveProduct(arg1: any, arg2?: any): Promise<string> { return handleSave('products', arg1, arg2); }

export async function saveCustomer(userId: string, customer: any): Promise<string>;
export async function saveCustomer(customer: any): Promise<string>;
export async function saveCustomer(arg1: any, arg2?: any): Promise<string> { return handleSave('customers', arg1, arg2); }

export async function saveTransaction(userId: string, transaction: any): Promise<string>;
export async function saveTransaction(transaction: any): Promise<string>;
export async function saveTransaction(arg1: any, arg2?: any): Promise<string> { return handleSave('transactions', arg1, arg2); }

export async function saveExpense(userId: string, expense: any): Promise<string>;
export async function saveExpense(expense: any): Promise<string>;
export async function saveExpense(arg1: any, arg2?: any): Promise<string> { return handleSave('expenses', arg1, arg2); }

export async function savePurchase(userId: string, purchase: any): Promise<string>;
export async function savePurchase(purchase: any): Promise<string>;
export async function savePurchase(arg1: any, arg2?: any): Promise<string> { return handleSave('purchases', arg1, arg2); }

export async function deleteProduct(productId: string): Promise<void> { return handleDelete('products', productId); }
export async function deleteCustomer(customerId: string): Promise<void> { return handleDelete('customers', customerId); }
export async function deleteTransaction(transactionId: string): Promise<void> { return handleDelete('transactions', transactionId); }
export async function deleteExpense(expenseId: string): Promise<void> { return handleDelete('expenses', expenseId); }
export async function deletePurchase(purchaseId: string): Promise<void> { return handleDelete('purchases', purchaseId); }
