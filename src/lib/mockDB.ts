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

export const INITIAL_PRODUCTS: Product[] = [
  { id: "p1", name: "Samsung Split AC 1.5 Ton", sku: "S-AC-15T", stock: 12, buyPrice: 50000, sellPrice: 55000, category: "Air Conditioners", unit: "unit" },
  { id: "p2", name: "Walton Refrigerator 220L", sku: "W-REF-220", stock: 8, buyPrice: 32000, sellPrice: 35500, category: "Refrigerators", unit: "unit" },
  { id: "p3", name: "Sony Bravia 55' 4K OLED", sku: "SNY-55-4K", stock: 5, buyPrice: 95000, sellPrice: 112000, category: "Televisions", unit: "unit" },
  { id: "p4", name: "Xiaomi Router AX3000", sku: "XI-RT-AX3000", stock: 25, buyPrice: 3500, sellPrice: 4200, category: "Networking", unit: "unit" },
  { id: "p5", name: "HP EliteBook 840 G8", sku: "HP-EB-840", stock: 0, buyPrice: 62000, sellPrice: 68000, category: "Computers", unit: "unit" }
];

export const INITIAL_CONTACTS: Contact[] = [
  { id: "c1", name: "Al-Amin Electronics", phone: "01822114455", address: "Stadium Market, Dhaka", type: "supplier", created_at: "2026-05-20T10:00:00Z" },
  { id: "c2", name: "Kazi Shafiqul Islam", phone: "01715998877", address: "Mirpur-1, Dhaka", type: "customer", created_at: "2026-05-18T12:30:00Z" },
  { id: "c3", name: "Walton Bangladesh Sales Depot", phone: "01911333444", address: "Gazipur, Dhaka", type: "supplier", created_at: "2026-05-21T15:10:00Z" },
  { id: "c4", name: "Mahmudul Hasan (Sumon)", phone: "01552887766", address: "Uttara Sector 11, Dhaka", type: "customer", created_at: "2026-05-22T09:15:00Z" }
];

export const INITIAL_EXPENSES: Expense[] = [
  { id: "e1", category: "Rent", amount: 18000, description: "Monthly Showroom Rent", date: "2026-05-01" },
  { id: "e2", category: "Electricity", amount: 4500, description: "DPDC Bill May 2026", date: "2026-05-12" },
  { id: "e3", category: "Salary", amount: 12000, description: "Showroom Helper Salary", date: "2026-05-15" }
];

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

export const INITIAL_PURCHASES: Purchase[] = [
  { id: "pur1", productId: "p1", productName: "Samsung Split AC 1.5 Ton", supplierId: "c1", supplierName: "Al-Amin Electronics", quantity: 10, buyPrice: 50000, totalAmount: 500000, date: "2026-05-10" },
  { id: "pur2", productId: "p4", productName: "Xiaomi Router AX3000", supplierId: "c3", supplierName: "Walton Bangladesh Sales Depot", quantity: 20, buyPrice: 3500, totalAmount: 70000, date: "2026-05-14" }
];

// Local storage helper keys
const KEYS = {
  PRODUCTS: "barakah_products",
  CONTACTS: "barakah_contacts",
  EXPENSES: "barakah_expenses",
  TRANSACTIONS: "barakah_transactions",
  BUSINESS_INFO: "barakah_business_info",
  PURCHASES: "barakah_purchases"
};

export const loadDB = () => {
  try {
    const products = localStorage.getItem(KEYS.PRODUCTS);
    const contacts = localStorage.getItem(KEYS.CONTACTS);
    const expenses = localStorage.getItem(KEYS.EXPENSES);
    const transactions = localStorage.getItem(KEYS.TRANSACTIONS);
    const businessInfo = localStorage.getItem(KEYS.BUSINESS_INFO);
    const purchases = localStorage.getItem(KEYS.PURCHASES);

    return {
      products: products ? JSON.parse(products) : INITIAL_PRODUCTS,
      contacts: contacts ? JSON.parse(contacts) : INITIAL_CONTACTS,
      expenses: expenses ? JSON.parse(expenses) : INITIAL_EXPENSES,
      transactions: transactions ? JSON.parse(transactions) : [],
      businessInfo: businessInfo ? { ...INITIAL_BUSINESS_INFO, ...JSON.parse(businessInfo) } : INITIAL_BUSINESS_INFO,
      purchases: purchases ? JSON.parse(purchases) : INITIAL_PURCHASES
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
