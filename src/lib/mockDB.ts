export interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  buyPrice: number;
  sellPrice: number;
  category: string;
  unit: string;
  imageUrl?: string;
}

export interface Purchase {
  id: string;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  quantity: number;
  buyPrice: number;
  totalAmount: number;
  date: string;
  cashPaid?: number;
  dueAmount?: number;
  invoiceNo?: string;
  note?: string;
  originallyCredit?: boolean;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  address: string;
  type: "customer" | "supplier";
  created_at: string;
}

export interface TransactionItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  productId?: string;
  buyPrice?: number;
  isNegativeSale?: boolean;
}

export interface Transaction {
  id: string;
  invoiceNo: string;
  date: string;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  status: "paid" | "partial" | "due";
  paidAmount: number;
  dueBalance: number;
  contactId?: string;
  customerSignature?: string;
}

export interface BusinessInfo {
  name: string;
  address: string;
  phoneNumber: string;
  vatRegNo: string;
  currencySymbol: string;
  email?: string;
  adminPasscode?: string;
  salesPasscode?: string;
  companyLogo?: string;
  showLogoInInvoice?: boolean;
  logoAlignment?: "left" | "center" | "right";
  startingInvoiceNumber?: number;
  showCustomerSignature?: boolean;
  showAuthorizedSignature?: boolean;
  termsConditions?: string;
  selectedFont?: string;
  selectedInvoiceTemplate?: string;
  showPartnerLogos?: boolean;
  partnerLogos?: string[];
  presetBrands?: string[];
  salesmanPermissions?: {
    canEditSales: boolean;
    canDeleteSales: boolean;
    canOverridePrices: boolean;
  };
}

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_CONTACTS: Contact[] = [];

export const INITIAL_EXPENSES: Expense[] = [];

export const INITIAL_BUSINESS_INFO: BusinessInfo = {
  name: "Barakah E-Mart",
  address: "Shop #104, Level-2, Multiplan Computer Center, Elephant Road, Dhaka-1205",
  phoneNumber: "01700-112233",
  vatRegNo: "VAT-BG-88449921",
  currencySymbol: "৳",
  email: "barakahemart@gmail.com",
  adminPasscode: "1234",
  salesPasscode: "5555",
  companyLogo: "⚡",
  showLogoInInvoice: true,
  logoAlignment: "left",
  startingInvoiceNumber: 1001,
  showCustomerSignature: true,
  showAuthorizedSignature: true,
  selectedInvoiceTemplate: "classic",
  showPartnerLogos: true,
  partnerLogos: [],
  presetBrands: ["Samsung", "Sony", "Xiaomi", "Walton", "HP", "Haier", "Gree", "Hisense", "TCL"],
  termsConditions: "1. Warranty claims require original invoice receipt.\n2. Goods sold are not refundable, but replacement is allowed within 7 days if unused.\n3. Damage by physical abuse or power fluctuation voids warranty.",
  salesmanPermissions: {
    canEditSales: true,
    canDeleteSales: true,
    canOverridePrices: true
  }
};

export const INITIAL_PURCHASES: Purchase[] = [];

// Local storage helper keys
const KEYS = {
  PRODUCTS: "barakah_products",
  CONTACTS: "barakah_contacts",
  EXPENSES: "barakah_expenses",
  TRANSACTIONS: "barakah_transactions",
  BUSINESS_INFO: "barakah_business_info",
  PURCHASES: "barakah_purchases",
  DELETED_ITEMS: "barakah_deleted_items"
};

export function getDbKey(baseKey: string, customEmail?: string, uid?: string): string {
  let finalUid = uid;
  let email = customEmail;

  if (!email && !finalUid) {
    try {
      const cached = localStorage.getItem('barakah_local_active_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        email = parsed?.email;
        finalUid = parsed?.uid;
      }
    } catch (_) {}
  } else if (email && !finalUid) {
    try {
      const cached = localStorage.getItem('barakah_local_active_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.email?.trim().toLowerCase() === email.trim().toLowerCase()) {
          finalUid = parsed?.uid;
        }
      }
    } catch (_) {}
  }

  // Use user-specific prefix BARAKAH_DB_${uid} if uid is available
  if (finalUid) {
    const cleanKeyName = baseKey.replace(/^barakah_/, "");
    return `BARAKAH_DB_${finalUid}_${cleanKeyName}`;
  }

  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail) {
      return `${baseKey}_${cleanEmail}`;
    }
  }
  return baseKey;
}

// Demo cleaner helpers to ensure old demo entries never persist or load
export function cleanDemoProducts(arr: any[]): any[] {
  return Array.isArray(arr) ? arr : [];
}

export function cleanDemoContacts(arr: any[]): any[] {
  return Array.isArray(arr) ? arr : [];
}

export function cleanDemoExpenses(arr: any[]): any[] {
  return Array.isArray(arr) ? arr : [];
}

export function cleanDemoPurchases(arr: any[]): any[] {
  return Array.isArray(arr) ? arr : [];
}

export function cleanDemoTransactions(arr: any[]): any[] {
  return Array.isArray(arr) ? arr : [];
}

export const loadDB = (uid?: string) => {
  try {
    const productsStr = localStorage.getItem(getDbKey(KEYS.PRODUCTS, undefined, uid));
    const contactsStr = localStorage.getItem(getDbKey(KEYS.CONTACTS, undefined, uid));
    const expensesStr = localStorage.getItem(getDbKey(KEYS.EXPENSES, undefined, uid));
    const transactionsStr = localStorage.getItem(getDbKey(KEYS.TRANSACTIONS, undefined, uid));
    const businessInfoStr = localStorage.getItem(getDbKey(KEYS.BUSINESS_INFO, undefined, uid));
    const purchasesStr = localStorage.getItem(getDbKey(KEYS.PURCHASES, undefined, uid));
    const deletedItemsStr = localStorage.getItem(getDbKey(KEYS.DELETED_ITEMS, undefined, uid));

    let productsRaw = productsStr ? JSON.parse(productsStr) : null;
    let contactsRaw = contactsStr ? JSON.parse(contactsStr) : null;
    let expensesRaw = expensesStr ? JSON.parse(expensesStr) : null;
    let transactionsRaw = transactionsStr ? JSON.parse(transactionsStr) : null;
    let purchasesRaw = purchasesStr ? JSON.parse(purchasesStr) : null;
    let deletedItemsRaw = deletedItemsStr ? JSON.parse(deletedItemsStr) : [];

    // Local Fail-safe backup check: if local storage keys are completely missing, self-heal from the fail-safe!
    if (productsStr === null && transactionsStr === null) {
      const failSafeStr = localStorage.getItem(getDbKey("barakah_fail_safe_backup", undefined, uid));
      if (failSafeStr) {
        try {
          const fs = JSON.parse(failSafeStr);
          if (fs && ((Array.isArray(fs.products) && fs.products.length > 0) || (Array.isArray(fs.transactions) && fs.transactions.length > 0))) {
            console.log("[Fail-safe Recovery] Standard database keys are empty, self-healing from local fail-safe copy...");
            productsRaw = fs.products || [];
            contactsRaw = fs.contacts || [];
            expensesRaw = fs.expenses || [];
            transactionsRaw = fs.transactions || [];
            purchasesRaw = fs.purchases || [];
            if (fs.deletedItems) deletedItemsRaw = fs.deletedItems;
            
            // Re-write back to standards instantly to stabilize system
            localStorage.setItem(getDbKey(KEYS.PRODUCTS, undefined, uid), JSON.stringify(productsRaw));
            localStorage.setItem(getDbKey(KEYS.CONTACTS, undefined, uid), JSON.stringify(contactsRaw));
            localStorage.setItem(getDbKey(KEYS.EXPENSES, undefined, uid), JSON.stringify(expensesRaw));
            localStorage.setItem(getDbKey(KEYS.TRANSACTIONS, undefined, uid), JSON.stringify(transactionsRaw));
            if (purchasesRaw) localStorage.setItem(getDbKey(KEYS.PURCHASES, undefined, uid), JSON.stringify(purchasesRaw));
            localStorage.setItem(getDbKey(KEYS.DELETED_ITEMS, undefined, uid), JSON.stringify(deletedItemsRaw));
          }
        } catch (err) {
          console.warn("[Fail-safe Recovery] Error loading from local fail-safe backup copy:", err);
        }
      }
    }

    const products = cleanDemoProducts(productsRaw || INITIAL_PRODUCTS);
    const contacts = cleanDemoContacts(contactsRaw || INITIAL_CONTACTS);
    const expenses = cleanDemoExpenses(expensesRaw || INITIAL_EXPENSES);
    const transactions = cleanDemoTransactions(transactionsRaw || []);
    const purchases = cleanDemoPurchases(purchasesRaw || INITIAL_PURCHASES);
    const deletedItems = Array.isArray(deletedItemsRaw) ? deletedItemsRaw : [];

    const businessInfo = businessInfoStr ? { ...INITIAL_BUSINESS_INFO, ...JSON.parse(businessInfoStr) } : INITIAL_BUSINESS_INFO;

    return {
      products,
      contacts,
      expenses,
      transactions,
      businessInfo,
      purchases,
      deletedItems
    };
  } catch (e) {
    console.error("Failed to load offline database:", e);
    return {
      products: INITIAL_PRODUCTS,
      contacts: INITIAL_CONTACTS,
      expenses: INITIAL_EXPENSES,
      transactions: [],
      businessInfo: INITIAL_BUSINESS_INFO,
      purchases: INITIAL_PURCHASES
    };
  }
};

export const saveDB = (
  data: {
    products: Product[];
    contacts: Contact[];
    expenses: Expense[];
    transactions: Transaction[];
    businessInfo: BusinessInfo;
    purchases: Purchase[];
    deletedItems?: any[];
  },
  uid?: string
) => {
  try {
    localStorage.setItem(getDbKey(KEYS.PRODUCTS, undefined, uid), JSON.stringify(data.products));
    localStorage.setItem(getDbKey(KEYS.CONTACTS, undefined, uid), JSON.stringify(data.contacts));
    localStorage.setItem(getDbKey(KEYS.EXPENSES, undefined, uid), JSON.stringify(data.expenses));
    localStorage.setItem(getDbKey(KEYS.TRANSACTIONS, undefined, uid), JSON.stringify(data.transactions));
    localStorage.setItem(getDbKey(KEYS.BUSINESS_INFO, undefined, uid), JSON.stringify(data.businessInfo));
    localStorage.setItem(getDbKey(KEYS.PURCHASES, undefined, uid), JSON.stringify(data.purchases));
    localStorage.setItem(getDbKey(KEYS.DELETED_ITEMS, undefined, uid), JSON.stringify(data.deletedItems || []));

    // Update the local fail-safe backup key only if the data has actual items, to prevent overwriting with blank states
    const totalItems = data.products.length + data.transactions.length;
    if (totalItems > 0) {
      localStorage.setItem(getDbKey("barakah_fail_safe_backup", undefined, uid), JSON.stringify({
        products: data.products,
        contacts: data.contacts,
        expenses: data.expenses,
        transactions: data.transactions,
        purchases: data.purchases,
        deletedItems: data.deletedItems || []
      }));
    }
  } catch (e) {
    console.error("Failed to save database to localStorage:", e);
  }
};
