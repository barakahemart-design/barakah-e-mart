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
import { db, handleFirestoreError, OperationType } from './firebase';

// Helper function to create standard user-filtered collections subscriptions
function createSubscription(collName: string) {
  return (userId: string, callback: (items: any[]) => void) => {
    const q = query(collection(db, collName), where("user_id", "==", userId));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, collName);
    });
  };
}

// Helper function to perform save operations (add/update)
async function handleSave(collName: string, arg1: any, arg2?: any): Promise<string> {
  const userId = typeof arg1 === 'string' ? arg1 : (arg1.user_id || arg1.userId);
  const data = typeof arg1 === 'string' ? arg2 : arg1;
  const { id, ...dataWithoutId } = data;
  const docData = { ...dataWithoutId, user_id: userId };

  try {
    if (id) {
      if (collName === "customers") {
        console.log("ACTIVE USER:", userId);
        console.log("CUSTOMER OBJECT:", data);
        console.log("DOCUMENT ID:", id);
        console.log("DOCUMENT PATH:", `customers/${id}`);
      }
      await setDoc(doc(db, collName, id), docData, { merge: true });
      if (collName === "customers") {
        console.log("SAVE SUCCESS");
      }
      return id;
    } else {
      const docRef = await addDoc(collection(db, collName), docData);
      return docRef.id;
    }
  } catch (error) {
    if (collName === "customers") {
      console.error("Firestore saveCustomer ERROR:", error);
    }
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
