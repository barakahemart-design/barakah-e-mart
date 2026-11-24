import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  or,
  writeBatch
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

  const storeIdentities = [
    docData?.store_id,
    docData?.storeId,
    docData?.email,
    docData?.linked_email,
    docData?.linkedEmail
  ].filter((value: any) => typeof value === 'string' && value.trim() !== '')
    .map((value: string) => value.trim().toLowerCase());

  // A present store-email identity takes precedence. Do not fall back to a UID
  // match if the record is explicitly assigned to a different business email.
  if (storeIdentities.length > 0) {
    return !!targetEmail && storeIdentities.every((value: string) => value === targetEmail);
  }

  const uidIdentities = [
    docData?.user_id,
    docData?.userId,
    docData?.owner_id
  ].filter((value: any) => typeof value === 'string' && value.trim() !== '');
  return !!targetUid && uidIdentities.length > 0 &&
    uidIdentities.every((value: string) => value === targetUid);
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

    // One account-scoped realtime listener. The OR query preserves compatibility
    // with legacy identity fields without opening eight separate listeners.
    const accountQuery = query(
      collection(db, collName),
      or(
        where('store_id', '==', storeId),
        where('storeId', '==', storeId),
        where('email', '==', storeId),
        where('linked_email', '==', storeId),
        where('linkedEmail', '==', storeId),
        where('user_id', '==', activeUid),
        where('userId', '==', activeUid),
        where('owner_id', '==', activeUid)
      )
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
          firstSnapshot
        });
        firstSnapshot = false;
        callback(items);
      },
      (error) => {
        console.error(`[Realtime Listener Error] ${collName}`, error);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("barakah-firestore-sync-error", {
            detail: { code: (error as any)?.code || "", message: (error as any)?.message || String(error), collection: collName }
          }));
        }
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

  const targetId = data?.firestoreId || data?.id || doc(collection(db, collName)).id;
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

  const physicalIds = new Set<string>([String(id)]);
  try {
    // The ID equality query is selective and was already part of the legacy
    // delete path. Keep it as a single lookup; do not scan the store's documents.
    const identityQuery = query(collection(db, collName), where('id', '==', String(id)));
    const snapshots = [await getDocs(identityQuery)];
    for (const snap of snapshots) {
      snap.docs.forEach((d: any) => {
        const data = d.data() || {};
        if (String(data.id || d.id) === String(id) &&
            isDocMatchingStore(data, cleanEmail, currentUser.uid)) {
          physicalIds.add(d.id);
        }
      });
    }
  } catch (lookupErr) {
    console.warn('[Delete] Legacy physical-id lookup failed:', lookupErr);
  }

  await Promise.all(Array.from(physicalIds).map((physicalId) =>
    deleteDoc(doc(db, collName, physicalId))
  ));
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


type InvoiceBatchInput = {
  transactionDocId: string;
  transactionData: Record<string, any>;
  items: Array<{ docId: string; data: Record<string, any> }>;
  deletedItemIds?: string[];
  products?: Array<{ id: string; data: Record<string, any> }>;
};

function currentStoreWriteIdentity() {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid || !currentUser.email) {
    throw new Error("You must be signed in with Firebase before saving invoice changes.");
  }
  const email = currentUser.email.trim().toLowerCase();
  return {
    user_id: currentUser.uid,
    userId: currentUser.uid,
    owner_id: currentUser.uid,
    store_id: email,
    storeId: email,
    email,
    linked_email: email,
    linkedEmail: email,
    deleted: false,
    isDeleted: false,
    updated_at: new Date().toISOString()
  };
}

/**
 * Commits an invoice, its line items and only the stock records affected by
 * the edit in one Firestore batch. No collection scans or new listeners.
 */
export async function commitInvoiceEditBatch(input: InvoiceBatchInput): Promise<void> {
  const identity = currentStoreWriteIdentity();
  const batch = writeBatch(db);
  let operationCount = 0;

  batch.set(doc(db, "transactions", input.transactionDocId), {
    ...input.transactionData,
    ...identity
  }, { merge: true });
  operationCount += 1;

  for (const item of input.items) {
    if (!item.docId) continue;
    batch.set(doc(db, "transaction_items", item.docId), {
      ...item.data,
      id: item.docId,
      ...identity
    }, { merge: true });
    operationCount += 1;
  }

  for (const itemId of new Set(input.deletedItemIds || [])) {
    if (!itemId) continue;
    batch.delete(doc(db, "transaction_items", itemId));
    operationCount += 1;
  }

  for (const product of input.products || []) {
    if (!product.id) continue;
    const data: Record<string, any> = { ...product.data, id: product.id, ...identity };
    const buyPrice = Number(data.buyPrice ?? data.buy_price) || 0;
    const sellPrice = Number(data.sellPrice ?? data.sell_price) || 0;
    data.buyPrice = buyPrice;
    data.buy_price = buyPrice;
    data.sellPrice = sellPrice;
    data.sell_price = sellPrice;
    data.imageUrl = data.imageUrl || data.image_url || "";
    data.image_url = data.imageUrl;
    batch.set(doc(db, "products", product.id), data, { merge: true });
    operationCount += 1;
  }

  if (operationCount > 500) {
    throw new Error("This invoice edit affects too many records for one safe atomic save. No cloud changes were made.");
  }
  await batch.commit();
}

/** Atomically tombstones/deletes an invoice and its lines while restoring stock. */
export async function deleteInvoiceAndRestoreBatch(input: {
  transactionId: string;
  transactionDocId: string;
  itemIds: string[];
  products: Array<{ id: string; data: Record<string, any> }>;
}): Promise<void> {
  const identity = currentStoreWriteIdentity();
  const batch = writeBatch(db);
  let operationCount = 0;
  const addDelete = (collectionName: string, recordId: string, physicalId: string) => {
    if (!recordId || !physicalId) return;
    // Preserve the app's existing deletion tombstone contract so older backup
    // restores cannot resurrect an invoice or one of its line items.
    batch.set(doc(db, "deleted_records", `${collectionName}__${recordId}`), {
      id: recordId,
      collection: collectionName,
      record_id: recordId,
      ...identity,
      deleted_at: new Date().toISOString()
    }, { merge: true });
    batch.delete(doc(db, collectionName, physicalId));
    operationCount += 2;
  };

  addDelete("transactions", input.transactionId, input.transactionDocId);
  for (const itemId of new Set(input.itemIds || [])) {
    addDelete("transaction_items", itemId, itemId);
  }
  for (const product of input.products || []) {
    if (!product.id) continue;
    const data: Record<string, any> = { ...product.data, id: product.id, ...identity };
    const buyPrice = Number(data.buyPrice ?? data.buy_price) || 0;
    const sellPrice = Number(data.sellPrice ?? data.sell_price) || 0;
    data.buyPrice = buyPrice;
    data.buy_price = buyPrice;
    data.sellPrice = sellPrice;
    data.sell_price = sellPrice;
    data.imageUrl = data.imageUrl || data.image_url || "";
    data.image_url = data.imageUrl;
    batch.set(doc(db, "products", product.id), data, { merge: true });
    operationCount += 1;
  }
  if (operationCount > 500) {
    throw new Error("This invoice deletion affects too many records for one safe atomic save. No cloud changes were made.");
  }
  await batch.commit();
}
