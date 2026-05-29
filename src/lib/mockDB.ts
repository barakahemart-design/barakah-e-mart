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
  PURCHASES: "barakah_purchases"
};

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

export const loadDB = () => {
  try {
    const productsStr = localStorage.getItem(KEYS.PRODUCTS);
    const contactsStr = localStorage.getItem(KEYS.CONTACTS);
    const expensesStr = localStorage.getItem(KEYS.EXPENSES);
    const transactionsStr = localStorage.getItem(KEYS.TRANSACTIONS);
    const businessInfoStr = localStorage.getItem(KEYS.BUSINESS_INFO);
    const purchasesStr = localStorage.getItem(KEYS.PURCHASES);

    let productsRaw = productsStr ? JSON.parse(productsStr) : null;
    let contactsRaw = contactsStr ? JSON.parse(contactsStr) : null;
    let expensesRaw = expensesStr ? JSON.parse(expensesStr) : null;
    let transactionsRaw = transactionsStr ? JSON.parse(transactionsStr) : null;
    let purchasesRaw = purchasesStr ? JSON.parse(purchasesStr) : null;

    // Local Fail-safe backup check: if all data arrays are empty, but we have a non-empty fail-safe copy, load from the fail-safe!
    const localProductsCount = Array.isArray(productsRaw) ? productsRaw.length : 0;
    const localTransactionsCount = Array.isArray(transactionsRaw) ? transactionsRaw.length : 0;
    const localTotal = localProductsCount + localTransactionsCount;

    if (localTotal === 0) {
      const failSafeStr = localStorage.getItem("barakah_fail_safe_backup");
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
            
            // Re-write back to standards instantly to stabilize system
            localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(productsRaw));
            localStorage.setItem(KEYS.CONTACTS, JSON.stringify(contactsRaw));
            localStorage.setItem(KEYS.EXPENSES, JSON.stringify(expensesRaw));
            localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactionsRaw));
            if (purchasesRaw) localStorage.setItem(KEYS.PURCHASES, JSON.stringify(purchasesRaw));
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

    const businessInfo = businessInfoStr ? { ...INITIAL_BUSINESS_INFO, ...JSON.parse(businessInfoStr) } : INITIAL_BUSINESS_INFO;

    return {
      products,
      contacts,
      expenses,
      transactions,
      businessInfo,
      purchases
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

export const saveDB = (data: {
  products: Product[];
  contacts: Contact[];
  expenses: Expense[];
  transactions: Transaction[];
  businessInfo: BusinessInfo;
  purchases: Purchase[];
}) => {
  try {
    localStorage.setItem(KEYS.PRODUCTS, JSON.stringify(data.products));
    localStorage.setItem(KEYS.CONTACTS, JSON.stringify(data.contacts));
    localStorage.setItem(KEYS.EXPENSES, JSON.stringify(data.expenses));
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
    localStorage.setItem(KEYS.BUSINESS_INFO, JSON.stringify(data.businessInfo));
    localStorage.setItem(KEYS.PURCHASES, JSON.stringify(data.purchases));

    // Update the local fail-safe backup key only if the data has actual items, to prevent overwriting with blank states
    const totalItems = data.products.length + data.transactions.length;
    if (totalItems > 0) {
      localStorage.setItem("barakah_fail_safe_backup", JSON.stringify({
        products: data.products,
        contacts: data.contacts,
        expenses: data.expenses,
        transactions: data.transactions,
        purchases: data.purchases
      }));
    }
  } catch (e) {
    console.error("Failed to save database to localStorage:", e);
  }
};
