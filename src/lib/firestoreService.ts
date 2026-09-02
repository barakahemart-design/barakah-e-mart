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

/**
 * Realtime source of truth. Each account gets one filtered listener per
 * collection, keeping Firebase reads low while making add/edit/delete
 * snapshots deterministic.
 */
function createSubscription(collName: string) {
  return (userIdentifier: string, callback: (items: any[]) => void) => {
    const currentUser = auth.currentUser;
    const storeId = getActiveStoreEmail();
    const activeUid = currentUser?.uid || userIdentifier || '';

    if (!currentUser || !storeId) {
      console.warn(`[Realtime Listener] Waiting for authenticated account: ${collName}`);
      return () => {};
    }

    const accountQuery = query(
      collection(db, collName),
      where('store_id', '==', storeId)
    );

    let stopped = false;
    let firstSnapshot = true;

    const unsubscribe = onSnapshot(
      accountQuery,
      (snapshot) => {
        if (stopped) return;

        const items = snapshot.docs
          .map((snapshotDoc: any) => {
            const data = snapshotDoc.data() || {};
            return {
              ...data,
              id: data.id || snapshotDoc.id,
              firestoreId: snapshotDoc.id
            };
          })
          .filter((item: any) => item.deleted !== true && item.isDeleted !== true)
          .filter((item: any) => isDocMatchingStore(item, storeId, activeUid));

        console.log('[Realtime Snapshot]', {
          collection: collName,
          docCount: items.length,
          account: storeId,
          fromCache: snapshot.metadata?.fromCache === true,
          firstSnapshot
        });
        firstSnapshot = false;
        callback(items);
      },
      (error) => {
        console.error(`[Realtime Listener Error] ${collName}`, error);
      }
    );

    return () => {
      stopped = true;
      unsubscribe();
    };
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
    deleted: false,
    isDeleted: false,
    updated_at: new Date().toISOString()
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

  if (collName === 'transactions') {
    // Keep both naming conventions so every reader/recovery path sees the
    // same payment state after a collection-due update and browser reload.
    const total = Number(docData.total ?? docData.total_amount) || 0;
    const paid = Number(docData.paidAmount ?? docData.paid_amount) || 0;
    const due = Math.max(0, total - paid);
    docData.total = total;
    docData.total_amount = total;
    docData.paidAmount = paid;
    docData.paid_amount = paid;
    docData.dueBalance = due;
    docData.due_balance = due;
    docData.status = paid >= total ? 'paid' : (paid > 0 ? 'partial' : 'due');
  }

  await setDoc(doc(db, collName, targetId), docData, { merge: true });
  return targetId;
}

/**
 * A hard delete is paired with a tiny permanent tombstone. The original
 * business document is physically deleted, while the tombstone prevents old
 * vault/local recovery copies from resurrecting it later.
 */
async function handleDelete(collName: string, id: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid || !currentUser.email) {
    throw new Error('You must be signed in with Firebase before deleting data.');
  }

  const cleanEmail = currentUser.email.trim().toLowerCase();
  const tombstoneId = `${collName}__${String(id)}`;
  await setDoc(doc(db, 'deleted_records', tombstoneId), {
    id: String(id),
    collection: collName,
    record_id: String(id),
    user_id: currentUser.uid,
    userId: currentUser.uid,
    owner_id: currentUser.uid,
    store_id: cleanEmail,
    storeId: cleanEmail,
    email: cleanEmail,
    linked_email: cleanEmail,
    deleted_at: new Date().toISOString()
  }, { merge: true });

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
