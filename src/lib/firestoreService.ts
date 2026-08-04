import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  setDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';

// Helper function to create standard user-filtered collections subscriptions
function createSubscription(collName: string) {
  return (userId: string, callback: (items: any[]) => void) => {
    if (!userId || !auth.currentUser || auth.currentUser.uid !== userId) {
      console.warn(`[firestoreService] Subscription for ${collName} skipped: user not authenticated in Firebase Auth.`);
      return () => {};
    }
    const q = query(collection(db, collName), where("user_id", "==", userId));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => {
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
async function handleSave(collName: string, arg1: any, arg2?: any): Promise<string> {
  const userId = typeof arg1 === 'string' ? arg1 : (arg1.user_id || arg1.userId);
  const data = typeof arg1 === 'string' ? arg2 : arg1;
  const { id, ...dataWithoutId } = data;
  const docData: any = {
    id,
    ...dataWithoutId,
    user_id: userId
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

  try {
    if (id) {
      await setDoc(doc(db, collName, id), docData, { merge: true });
      return id;
    } else {
      const docRef = await addDoc(collection(db, collName), docData);
      return docRef.id;
    }
  } catch (error) {
    try {
      const authHeaders = {
        "Content-Type": "application/json",
        "x-user-uid": userId || auth.currentUser?.uid || "",
        "x-user-email": auth.currentUser?.email || ""
      };
      const res = await fetch("/api/db/upsert", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ table: collName, id: id || docData.id, data: docData })
      });
      if (res.ok) return id || docData.id;
    } catch (_) {}
    handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, `${collName}/${id || 'new'}`);
    throw error;
  }
}

// Helper function to perform delete operations
async function handleDelete(collName: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, collName, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${collName}/${id}`);
    throw error;
  }
}

// Exported subscribe functions
export const subscribeProducts = createSubscription("products");

export function subscribeCustomers(userId: string, callback: (items: any[]) => void) {
  if (!userId || !auth.currentUser || auth.currentUser.uid !== userId) {
    console.warn(`[firestoreService] Subscription for customers skipped: user not authenticated in Firebase Auth.`);
    return () => {};
  }
  const q = query(collection(db, "customers"), where("user_id", "==", userId));
  return onSnapshot(q, (snapshot) => {
    const docsData = snapshot.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: data.id || d.id,
        firestoreId: d.id
      };
    });
    callback(docsData);
  }, (error) => {
    console.warn(`[firestoreService] Snapshot listener for customers notice:`, error);
  });
}

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
