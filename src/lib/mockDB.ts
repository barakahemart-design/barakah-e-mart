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
  name: "Barakah Electronics",
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
  if (!Array.isArray(arr)) return [];
  const demoIds = new Set(["p1", "p2", "p3", "p4", "p5"]);
  const demoNames = new Set([
    "Samsung Split AC 1.5 Ton", 
    "Walton Refrigerator 220L", 
    "Sony Bravia 55' 4K OLED", 
    "Xiaomi Router AX3000", 
    "HP EliteBook 840 G8"
  ]);
  return arr.filter(p => {
    if (!p) return false;
    if (demoIds.has(p.id) || demoNames.has(p.name)) return false;
    return true;
  });
}

export function cleanDemoContacts(arr: any[]): any[] {
  if (!Array.isArray(arr)) return [];
  const demoIds = new Set(["c1", "c2", "c3", "c4"]);
  const demoNames = new Set([
    "Al-Amin Electronics", 
    "Kazi Shafiqul Islam", 
    "Walton Bangladesh Sales Depot", 
    "Mahmudul Hasan (Sumon)"
  ]);
  return arr.filter(c => {
    if (!c) return false;
    if (demoIds.has(c.id) || demoNames.has(c.name)) return false;
    return true;
  });
}

export function cleanDemoExpenses(arr: any[]): any[] {
  if (!Array.isArray(arr)) return [];
  const demoIds = new Set(["e1", "e2", "e3"]);
  const demoCategoriesAndAmounts = [
    { category: "Rent", amount: 18000 },
    { category: "Electricity", amount: 4500 },
    { category: "Salary", amount: 12000 }
  ];
  return arr.filter(e => {
    if (!e) return false;
    if (demoIds.has(e.id)) return false;
    const isDemo = demoCategoriesAndAmounts.some(x => x.category === e.category && x.amount === e.amount);
    if (isDemo) return false;
    return true;
  });
}

export function cleanDemoPurchases(arr: any[]): any[] {
  if (!Array.isArray(arr)) return [];
  const demoIds = new Set(["pur1", "pur2"]);
  return arr.filter(pur => pur && !demoIds.has(pur.id));
}

export function cleanDemoTransactions(arr: any[]): any[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(tx => {
    if (!tx) return false;
    const demoItems = tx.items || [];
    const hasDemoProduct = demoItems.some((item: any) => 
      item && (
        item.productId === "p1" || item.productId === "p2" || item.productId === "p3" || item.productId === "p4" || item.productId === "p5" ||
        item.name === "Samsung Split AC 1.5 Ton" || item.name === "Walton Refrigerator 220L" || item.name === "Sony Bravia 55' 4K OLED" || item.name === "Xiaomi Router AX3000" || item.name === "HP EliteBook 840 G8"
      )
    );
    if (hasDemoProduct) return false;
    return true;
  });
}

export const loadDB = () => {
  try {
    const productsStr = localStorage.getItem(KEYS.PRODUCTS);
    const contactsStr = localStorage.getItem(KEYS.CONTACTS);
    const expensesStr = localStorage.getItem(KEYS.EXPENSES);
    const transactionsStr = localStorage.getItem(KEYS.TRANSACTIONS);
    const businessInfoStr = localStorage.getItem(KEYS.BUSINESS_INFO);
    const purchasesStr = localStorage.getItem(KEYS.PURCHASES);

    const productsRaw = productsStr ? JSON.parse(productsStr) : INITIAL_PRODUCTS;
    const contactsRaw = contactsStr ? JSON.parse(contactsStr) : INITIAL_CONTACTS;
    const expensesRaw = expensesStr ? JSON.parse(expensesStr) : INITIAL_EXPENSES;
    const transactionsRaw = transactionsStr ? JSON.parse(transactionsStr) : [];
    const purchasesRaw = purchasesStr ? JSON.parse(purchasesStr) : INITIAL_PURCHASES;

    const products = cleanDemoProducts(productsRaw);
    const contacts = cleanDemoContacts(contactsRaw);
    const expenses = cleanDemoExpenses(expensesRaw);
    const transactions = cleanDemoTransactions(transactionsRaw);
    const purchases = cleanDemoPurchases(purchasesRaw);

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
  } catch (e) {
    console.error("Failed to save database to localStorage:", e);
  }
};
