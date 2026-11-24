import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  Building2, 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  PiggyBank, 
  Users, 
  Bookmark, 
  Settings, 
  Plus, 
  Type,
  FileSpreadsheet,
  AlertCircle, 
  BarChart3,
  Minus,
  Trash2, 
  Download, 
  Search, 
  Sparkle, 
  AlertTriangle, 
  CheckCircle2, 
  Wallet, 
  LogOut, 
  CloudLightning, 
  CloudUpload, 
  CloudDownload, 
  TrendingDown, 
  PlusCircle, 
  PenTool, 
  Eraser, 
  FileText,
  UserCheck,
  RefreshCw,
  Clock,
  ShieldCheck,
  Tag,
  X,
  Edit3,
  SlidersHorizontal,
  Phone,
  History,
  Calendar,
  DollarSign,
  Coins,
  Check,
  Copy,
  Menu,
  MoreHorizontal,
  ReceiptText,
  LayoutDashboard,
  Sun,
  Moon,
  Layers,
  ShoppingBag,
  Printer,
  Share2,
  Undo2,
  Languages,
  Sparkles,
  ArrowLeft,
  Truck
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart, Pie } from "recharts";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";
import {
  safeDate,
  safeFormat,
  safeIsWithinInterval,
  safeStartOfDay,
  safeEndOfDay,
  safeSubDays
} from "./lib/dateUtils";
import {
  addManualCostLot,
  addPurchaseCostLot,
  allocateFifoCost,
  getAverageCostFromAllocations,
  getCostAllocationsForItem,
  normalizeCostLots,
  removePurchaseCostLot,
  restoreFifoCost,
  returnPurchaseCostLot,
  resizeFifoSaleItem,
  updateAllCostAllocations,
  updateOneCostAllocation,
  updatePurchaseCostLot
} from "./lib/fifoCosting";

import { AuthScreen } from "./components/AuthScreen";
import { PanelGateLock } from "./components/PanelGateLock";
import { LedgerPdfViewer } from "./components/LedgerPdfViewer";
import { DashboardView } from "./components/DashboardView";
import { ReportsView } from "./components/ReportsView";
import { ProductsView } from "./components/ProductsView";
import { NegativeSalesView } from "./components/NegativeSalesView";
import { PurchasesView } from "./components/PurchasesView";
import { ContactRegistrationForm } from "./components/ContactRegistrationForm";
import { CreditorDueView } from "./components/CreditorDueView";
import { Staff, SalaryPayment, StaffManagementView } from "./components/StaffManagementView";
import { DeliveryManagementView } from "./components/DeliveryManagementView";
import { DeliveryDriverView } from "./components/DeliveryDriverView";
import { 
  INITIAL_PRODUCTS,
  INITIAL_CONTACTS,
  INITIAL_EXPENSES,
  INITIAL_BUSINESS_INFO,
  INITIAL_PURCHASES
} from "./lib/mockDB";
import {
  subscribeProducts,
  subscribeCustomers,
  subscribeTransactions,
  subscribeTransactionItems,
  subscribeExpenses,
  subscribePurchases,
  saveProduct,
  saveCustomer,
  saveTransaction,
  saveExpense,
  savePurchase,
  deleteProduct,
  deleteCustomer,
  deleteTransaction,
  deleteExpense,
  deletePurchase,
  handleSave,
  commitInvoiceEditBatch,
  deleteInvoiceAndRestoreBatch
} from "./lib/firestoreService";

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
  warranty?: string;
  warrantyDetails?: string;
  costLots?: any[];
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
  source?: "delivery";
  sourceId?: string;
  recordedAt?: string;
  driverName?: string;
  paymentStatus?: "paid" | "unpaid";
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
  firestoreId?: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  productId?: string;
  buyPrice?: number;
  costAllocations?: any[];
  category?: string;
  isNegativeSale?: boolean;
  warranty?: string;
  warrantyDetails?: string;
}

export interface Transaction {
  id: string;
  firestoreId?: string;
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
  paymentHistory?: Array<{ id: string; amount: number; date: string; recordedAt?: string }>;
}

export interface BusinessInfo {
  name: string;
  address: string;
  phoneNumber: string;
  vatRegNo: string;
  currencySymbol: string;
  email?: string;
  invoiceDisplayEmail?: string;
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
  expenseCategories?: string[];
  salesmanPermissions?: {
    canEditSales: boolean;
    canDeleteSales: boolean;
    canOverridePrices: boolean;
  };
}

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
import { 
  subscribeToAuthChanges, 
  signOut, 
  fetchAndRestoreCloudBackup,
  uploadPasscodeBackup,
  signInOrSignUpWithPasscode,
  signUpWithEmail,
  signInWithEmail,
  getPasscodeSyncId,
  selfHealDatabase,
  toUUID,
  restoreLocalKeys,
  deleteCloudDocument,
  saveBusinessSettings,
} from "./lib/firebase-helpers";
import { doc, setDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { db, auth as firebaseAuth } from "./lib/firebase";
import { createDeliveryOfflineOperation, deliveryStorageKey, isRetryableDeliveryError, readDeliveryLocal, writeDeliveryLocal } from "./lib/deliveryOffline";
import { 
  generateInvoicePDF,
  generateDeliveryChallanPDF
} from "./lib/pdf";
import { 
  generateBusinessInsights, 
  AIInsight 
} from "./services/aiService";

export default function App() {
  // Authentication & Session
  const [activeUser, setActiveUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

   const initialLoadedRef = useRef(false);
   const isReloadToastActiveRef = useRef(
     typeof window !== "undefined" &&
     (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type === "reload" &&
     !!localStorage.getItem("barakah_local_active_user")
   );
   const lastUploadedAtRef = useRef("");
   const isRemoteUpdateActiveRef = useRef(false);
   const remoteTimeoutRef = useRef<any>(null);
   const [settingsHydrated, setSettingsHydrated] = useState(false);
 
   // Active Core Database State (Merged loaded state)
   const [products, setProducts] = useState<Product[]>([]);
   const [contacts, setContacts] = useState<Contact[]>([]);
   const [expenses, setExpenses] = useState<Expense[]>([]);
   // Paid delivery-staff expenses are stored in a separate, store-scoped collection.
   const [deliveryExpenseRecords, setDeliveryExpenseRecords] = useState<any[]>([]);
   const [transactions, setTransactions] = useState<Transaction[]>([]);
   const [purchases, setPurchases] = useState<Purchase[]>([]);
   const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(INITIAL_BUSINESS_INFO);
 

   // Always show the PIN gate after the welcome screen; never restore an old unlocked panel.
  const [currentPanel, setCurrentPanel] = useState<"none" | "admin" | "sales">("none");
  // Keep the verified Admin PIN in memory only for privileged delivery actions.
  // It is never written to localStorage or sessionStorage.
  const [adminActionPin, setAdminActionPin] = useState("");
  const [deliveryStaffProfile, setDeliveryStaffProfile] = useState<any>(null);
  const [deliveryRoleCheckedUid, setDeliveryRoleCheckedUid] = useState("");

  // Resolve the delivery role before rendering either the driver panel or the
  // Admin/Sales PIN gate. This prevents even a one-frame flash of the POS gate.
  useEffect(() => {
    let cancelled = false;
    const checkDeliveryRole = async () => {
      if (!activeUser) {
        setDeliveryStaffProfile(null);
        setDeliveryRoleCheckedUid("");
        return;
      }
      if (activeUser.isGuest) {
        setDeliveryStaffProfile(null);
        setDeliveryRoleCheckedUid(activeUser.uid);
        return;
      }
      try {
        const user = firebaseAuth.currentUser;
        if (!user) throw new Error("Firebase user session unavailable.");
        const token = await user.getIdToken();
        const response = await fetch("/api/delivery/session", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          const failure: any = new Error(result.error || "Could not verify delivery account.");
          failure.status = response.status;
          throw failure;
        }
        if (result.isDeliveryAccount && result.staff?.uid === activeUser.uid && result.staff?.status === "active") {
          // This cached identity is used only to reopen the driver's read-only local
          // workspace during quota/network outages. Every server write still verifies
          // the live Firebase identity and active staff record.
          writeDeliveryLocal(deliveryStorageKey("cache", `driver-profile:${activeUser.uid}`), {
            uid: activeUser.uid, staff: result.staff, verifiedAt: new Date().toISOString()
          });
          setDeliveryStaffProfile(result.staff);
        } else {
          try { localStorage.removeItem(deliveryStorageKey("cache", `driver-profile:${activeUser.uid}`)); } catch (_) {}
          setDeliveryStaffProfile(null);
        }
      } catch (error) {
        if (!cancelled) {
          if (isRetryableDeliveryError(error)) {
            const cachedProfile = readDeliveryLocal<{ uid: string; staff: any } | null>(
              deliveryStorageKey("cache", `driver-profile:${activeUser.uid}`), null
            );
            setDeliveryStaffProfile(cachedProfile?.uid === activeUser.uid && cachedProfile.staff?.uid === activeUser.uid ? cachedProfile.staff : null);
          } else {
            setDeliveryStaffProfile(null);
          }
        }
      } finally {
        if (!cancelled) setDeliveryRoleCheckedUid(activeUser.uid);
      }
    };
    checkDeliveryRole();
    return () => { cancelled = true; };
  }, [activeUser?.uid, activeUser?.email, activeUser?.isGuest]);

  // Show Welcome once per app/browser session. sessionStorage survives a
  // normal refresh, but is cleared when the app tab/window is fully closed.
  // Keep the persistent login in localStorage untouched.
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(() => {
    try { return !sessionStorage.getItem("barakah_app_session_started"); }
    catch (_) { return true; }
  });

  // Warm the authenticated PIN-verification connection while the user is viewing the PIN gate.
  // This moves Firebase token acquisition and the first server connection off the PIN-submit path.
  const pinWarmupRef = useRef<{ uid: string; token: string; warmedAt: number } | null>(null);
  useEffect(() => {
    if (!activeUser || activeUser.isGuest || currentPanel !== "none") return;
    let cancelled = false;
    const warmPinVerification = async () => {
      try {
        const user = firebaseAuth.currentUser;
        const storeId = String(activeUser?.email || "").trim().toLowerCase();
        if (!user || user.uid !== activeUser.uid || !storeId || user.email?.trim().toLowerCase() !== storeId) return;
        const token = await user.getIdToken();
        if (cancelled) return;
        pinWarmupRef.current = { uid: user.uid, token, warmedAt: Date.now() };
        // Warm the same serverless route in the background; PIN verification remains mandatory on submit.
        void fetch("/api/panel-security/pin/warmup", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        }).catch(() => {});
      } catch (_) {
        // The normal submit flow will retrieve a fresh token if prewarming is unavailable.
      }
    };
    warmPinVerification();
    return () => { cancelled = true; };
  }, [activeUser?.uid, activeUser?.email, activeUser?.isGuest, currentPanel]);

  // Current active workspace view tab
  const [activeTab, setActiveTab ] = useState<
    "dashboard" | "pos" | "contacts" | "products" | "negative-sales" | "purchases" | "inventory" | "duelist" | "ledger" | "expenses" | "reports" | "staff" | "delivery" | "settings"
  >(() => {
    const defaultTab = typeof window !== "undefined" && window.innerWidth < 768 ? "dashboard" : "pos";
    try {
      if (localStorage.getItem("barakah_local_active_user")) {
        const savedTab = sessionStorage.getItem("barakah_active_tab");
        const validTabs = ["dashboard", "pos", "contacts", "products", "negative-sales", "purchases", "inventory", "duelist", "ledger", "expenses", "reports", "staff", "delivery", "settings"];
        if (savedTab && validTabs.includes(savedTab)) return savedTab as any;
      }
    } catch (_) {}
    return defaultTab;
  });

  // Staff members state
  const [staffList, setStaffList] = useState<Staff[]>(() => {
    try {
      const savedStr = localStorage.getItem(getDbKey("barakah_staff_list"));
      return savedStr ? JSON.parse(savedStr) : [];
    } catch (_) {
      return [];
    }
  });

  // Notifications State
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Global theme dark/light mode state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(getDbKey("barakah_billing_dark_theme"));
    return saved !== null ? saved === "true" : true; // Default is true (dark mode)
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem(getDbKey("barakah_billing_dark_theme"), String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    try { sessionStorage.setItem("barakah_active_tab", activeTab); } catch (_) {}
  }, [activeTab]);

  // Disable mobile pull-down-to-refresh. Refresh is available only from the
  // dedicated Dashboard button; normal vertical scrolling remains enabled.
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let validStart = false;
    const previousOverscroll = document.documentElement.style.overscrollBehaviorY;
    const previousBodyOverscroll = document.body.style.overscrollBehaviorY;
    document.documentElement.style.overscrollBehaviorY = "none";
    document.body.style.overscrollBehaviorY = "none";

    const canScrollUpFromTarget = (target: EventTarget | null) => {
      let element = target instanceof HTMLElement ? target : null;
      while (element && element !== document.body) {
        const style = window.getComputedStyle(element);
        const scrollableY = /(auto|scroll)/.test(style.overflowY) &&
          element.scrollHeight > element.clientHeight;
        if (scrollableY && element.scrollTop > 0) return true;
        element = element.parentElement;
      }
      const scrollingElement = document.scrollingElement;
      return !!scrollingElement && scrollingElement.scrollTop > 0;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) { validStart = false; return; }
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      validStart = true;
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (!validStart || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const deltaY = touch.clientY - startY;
      const deltaX = Math.abs(touch.clientX - startX);
      if (deltaY > 0 && deltaX < 90 && !canScrollUpFromTarget(event.target)) {
        event.preventDefault();
      }
    };
    const handleTouchEnd = () => { validStart = false; };
    const handleTouchCancel = () => { validStart = false; };
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
      document.documentElement.style.overscrollBehaviorY = previousOverscroll;
      document.body.style.overscrollBehaviorY = previousBodyOverscroll;
    };
  }, []);

  // Cloud backup sync indicator active states
  const [isRestoring, setIsRestoring] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"connecting" | "connected" | "reconciling" | "error" | "offline">("offline");
  const [syncErrorMessage, setSyncErrorMessage] = useState("");
  const firestoreListenerErrorRef = useRef(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Custom dialog state overrides for iframe friendliness
  const [activeConfirm, setActiveConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [ledgerDocumentPreview, setLedgerDocumentPreview] = useState<{ title: string; dataUrl: string } | null>(null);
  const [ledgerPreviewZoom, setLedgerPreviewZoom] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(getDbKey("barakah_ledger_pdf_zoom")));
      return Number.isFinite(saved) && saved >= 0.35 && saved <= 2.5 ? saved : 0.57;
    } catch { return 0.57; }
  });
  const ledgerPreviewFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!ledgerDocumentPreview) return;
    const updatePreviewZoom = () => {
      if (window.matchMedia("(max-width: 767px)").matches) setLedgerPreviewZoom(1);
      else {
        try {
          const saved = Number(localStorage.getItem(getDbKey("barakah_ledger_pdf_zoom")));
          setLedgerPreviewZoom(Number.isFinite(saved) && saved >= 0.35 && saved <= 2.5 ? saved : 0.57);
        } catch { setLedgerPreviewZoom(0.57); }
      }
    };
    updatePreviewZoom();
    window.addEventListener("resize", updatePreviewZoom);
    return () => window.removeEventListener("resize", updatePreviewZoom);
  }, [ledgerDocumentPreview]);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [quickAssignContact, setQuickAssignContact] = useState<Contact | null>(null);
  const [quickAssignInvoices, setQuickAssignInvoices] = useState<Transaction[]>([]);
  const [quickAssignStaff, setQuickAssignStaff] = useState<any[]>([]);
  const [quickAssignInvoiceNo, setQuickAssignInvoiceNo] = useState("");
  const [quickAssignDriverUid, setQuickAssignDriverUid] = useState("");
  const [quickAssignChargeBearer, setQuickAssignChargeBearer] = useState<"showroom" | "customer" | "">("");
  const [quickAssignLoading, setQuickAssignLoading] = useState(false);
  const [quickAssignSaving, setQuickAssignSaving] = useState(false);
  const [collectionTx, setCollectionTx] = useState<Transaction | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [showAdvancedPos, setShowAdvancedPos] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [contactTypeFilter, setContactTypeFilter] = useState<"all" | "customer" | "supplier">(() => {
    try { const v = localStorage.getItem(getDbKey("barakah_contact_type_filter")); return v === "customer" || v === "supplier" ? v : "all"; }
    catch { return "all"; }
  });

  const openCustomerInvoiceAssign = async (contact: Contact, clientInvoices: Transaction[]) => {
    const eligibleInvoices = clientInvoices.filter(tx => String(tx.invoiceNo || "").trim());
    if (!eligibleInvoices.length) { triggerNotification("No sales invoice is available for this customer yet.", "info"); return; }
    setQuickAssignContact(contact); setQuickAssignInvoices(eligibleInvoices); setQuickAssignInvoiceNo(String(eligibleInvoices[0].invoiceNo)); setQuickAssignDriverUid(""); setQuickAssignChargeBearer(""); setQuickAssignLoading(true);
    try {
      const user = firebaseAuth.currentUser;
      if (!user) throw new Error("Your secure login session has expired. Please log in again.");
      const token = await user.getIdToken();
      const panelRole = currentPanel === "admin" ? "admin" : "sales";
      const response = await fetch("/api/delivery/staff/list", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ store_id: String(activeUser?.email || "").trim().toLowerCase(), panel_role: panelRole, ...(panelRole === "admin" ? { admin_pin: adminActionPin } : { sales_pin: String(businessInfo.salesPasscode || "") }) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load delivery staff.");
      const active = (Array.isArray(data.staff) ? data.staff : []).filter((person: any) => person.status === "active");
      setQuickAssignStaff(active); if (active.length) setQuickAssignDriverUid(active[0].uid);
      else triggerNotification("No active delivery staff found. Add or activate staff in Delivery Management first.", "info");
    } catch (error: any) {
      if (isRetryableDeliveryError(error)) {
        const panelRole = currentPanel === "admin" ? "admin" : "sales";
        const cacheKey = deliveryStorageKey("cache", String(activeUser?.email || "").trim().toLowerCase() + ":" + panelRole);
        const cached = readDeliveryLocal<any>(cacheKey, null);
        const active = Array.isArray(cached?.staff) ? cached.staff.filter((person: any) => person.status === "active") : [];
        if (active.length) { setQuickAssignStaff(active); setQuickAssignDriverUid(active[0].uid); triggerNotification("Using delivery staff saved on this device. Assignment will sync when the cloud is available.", "info"); }
        else { setQuickAssignContact(null); triggerNotification("Delivery staff list is not cached on this device yet. Connect to Firebase once, then try again.", "error"); }
      } else { setQuickAssignContact(null); triggerNotification(error?.message || "Could not open invoice assignment.", "error"); }
    }
    finally { setQuickAssignLoading(false); }
  };

  const submitCustomerInvoiceAssign = async () => {
    if (!quickAssignContact || !quickAssignInvoiceNo || !quickAssignDriverUid || !quickAssignChargeBearer || quickAssignSaving) return;
    setQuickAssignSaving(true);
    try {
      const user = firebaseAuth.currentUser;
      if (!user) throw new Error("Your secure login session has expired. Please log in again.");
      const token = await user.getIdToken();
      const panelRole = currentPanel === "admin" ? "admin" : "sales";
      const response = await fetch("/api/delivery/assignments/create", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ store_id: String(activeUser?.email || "").trim().toLowerCase(), panel_role: panelRole, ...(panelRole === "admin" ? { admin_pin: adminActionPin } : { sales_pin: String(businessInfo.salesPasscode || "") }), invoice_no: quickAssignInvoiceNo, driver_uid: quickAssignDriverUid, delivery_charge_bearer: quickAssignChargeBearer }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not assign invoice.");
      const selectedStaff = quickAssignStaff.find(person => person.uid === quickAssignDriverUid);
      triggerNotification("Invoice " + quickAssignInvoiceNo + " assigned to " + (selectedStaff?.name || "delivery staff") + ".", "success");
      setQuickAssignContact(null); setQuickAssignInvoices([]); setQuickAssignStaff([]); setQuickAssignInvoiceNo(""); setQuickAssignDriverUid("");
    } catch (error: any) {
      if (isRetryableDeliveryError(error)) {
        const panelRole = currentPanel === "admin" ? "admin" : "sales";
        const queueKey = deliveryStorageKey("queue", String(activeUser?.email || "").trim().toLowerCase() + ":" + panelRole);
        const queued = readDeliveryLocal<any[]>(queueKey, []);
        const operation = createDeliveryOfflineOperation("/api/delivery/assignments/create", { invoice_no: quickAssignInvoiceNo, driver_uid: quickAssignDriverUid, delivery_charge_bearer: quickAssignChargeBearer });
        writeDeliveryLocal(queueKey, [...queued, operation]);
        triggerNotification("Invoice assignment saved on this device. It will sync when Firebase access returns and Delivery Management reconnects.", "info");
        setQuickAssignContact(null);
      } else triggerNotification(error?.message || "Could not assign invoice.", "error");
    }
    finally { setQuickAssignSaving(false); }
  };
  // Build the CRM directory indexes only when the Customer workspace is opened.
  // This replaces repeated full transaction/contact/product scans inside every card.
  const customerDirectoryData = useMemo(() => {
    if (activeTab !== "contacts") {
      return {
        filteredContacts: [] as Contact[],
        transactionsByContact: new Map<string, Transaction[]>(),
        productsById: new Map<string, Product>(),
        productsByName: new Map<string, Product>(),
        hasMissingPartnerProfiles: false
      };
    }

    const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();
    const contactsById = new Map<string, Contact>();
    const contactsByNormalizedId = new Map<string, Contact[]>();
    const contactsByPhone = new Map<string, Contact[]>();
    const contactIds = new Set<string>();

    contacts.forEach(contact => {
      contactIds.add(contact.id);
      contactsById.set(contact.id, contact);
      const normalizedId = toUUID(contact.id || "", cleanEmail);
      const normalizedMatches = contactsByNormalizedId.get(normalizedId) || [];
      normalizedMatches.push(contact);
      contactsByNormalizedId.set(normalizedId, normalizedMatches);
      const phone = (contact.phone || "").trim();
      if (phone) {
        const phoneMatches = contactsByPhone.get(phone) || [];
        phoneMatches.push(contact);
        contactsByPhone.set(phone, phoneMatches);
      }
    });

    const transactionsByContact = new Map<string, Transaction[]>();
    transactions.forEach(transaction => {
      if (!transaction?.contactId) return;
      const rawId = transaction.contactId;
      const normalizedId = toUUID(rawId, cleanEmail);
      const matchedContacts = new Set<Contact>();
      const exactContact = contactsById.get(rawId);
      if (exactContact) matchedContacts.add(exactContact);
      (contactsByNormalizedId.get(normalizedId) || []).forEach(contact => matchedContacts.add(contact));

      const transactionContact = exactContact || (contactsByNormalizedId.get(normalizedId) || [])[0];
      if (transactionContact?.phone) {
        (contactsByPhone.get(transactionContact.phone.trim()) || []).forEach(contact => matchedContacts.add(contact));
      }

      matchedContacts.forEach(contact => {
        const rows = transactionsByContact.get(contact.id) || [];
        rows.push(transaction);
        transactionsByContact.set(contact.id, rows);
      });
    });

    const productsById = new Map<string, Product>();
    const productsByName = new Map<string, Product>();
    products.forEach(product => {
      productsById.set(product.id, product);
      if (!productsByName.has(product.name)) productsByName.set(product.name, product);
    });

    const search = contactSearchQuery.trim().toLowerCase();
    const filteredContacts = contacts.filter(contact => {
      const matchesSearch = !search ||
        (contact.name || "").toLowerCase().includes(search) ||
        (contact.phone || "").includes(contactSearchQuery) ||
        (contact.address || "").toLowerCase().includes(search);
      const matchesType = contactTypeFilter === "all" || contact.type === contactTypeFilter;
      return matchesSearch && matchesType;
    }).sort((a, b) => {
      const dateA = new Date(a.created_at || (a as any).createdAt || 0).getTime();
      const dateB = new Date(b.created_at || (b as any).createdAt || 0).getTime();
      return dateB - dateA;
    });

    const hasMissingPartnerProfiles =
      transactions.some(transaction => !!transaction.contactId && !contactIds.has(transaction.contactId)) ||
      purchases.some(purchase => !!purchase.supplierId && !contactIds.has(purchase.supplierId));

    return { filteredContacts, transactionsByContact, productsById, productsByName, hasMissingPartnerProfiles };
  }, [activeTab, contacts, transactions, purchases, products, activeUser?.email, contactSearchQuery, contactTypeFilter]);

  // --- DUE LIST STATE DEFINITIONS ---
  const [duelistFilter, setDuelistFilter] = useState<"all" | "today" | "weekly" | "monthly" | "yearly">(() => {
    try { const v = localStorage.getItem(getDbKey("barakah_duelist_filter")); return v === "today" || v === "weekly" || v === "monthly" || v === "yearly" ? v : "all"; }
    catch { return "all"; }
  });
  const [duelistSearch, setDuelistSearch] = useState("");
  const [isAddingDue, setIsAddingDue] = useState(false);
  const [dueSupplierId, setDueSupplierId] = useState("");
  const [dueProductId, setDueProductId] = useState("");
  const [dueQuantity, setDueQuantity] = useState("");
  const [dueBuyRate, setDueBuyRate] = useState("");
  const [duePaid, setDuePaid] = useState("");
  const [dueNote, setDueNote] = useState("");
  const [dueDateStr, setDueDateStr] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueInvoiceNo, setDueInvoiceNo] = useState("");
  const [selectedSupplierReceipt, setSelectedSupplierReceipt] = useState<Purchase | null>(null);
  const [dueSection, setDueSection] = useState<"home" | "creditor-entry" | "creditors" | "creditor-report" | "product-due">("home");

  const hasHealedRef = useRef(false);

  const runAutoRecovery = async () => {
    let updatedContacts = [...contacts];
    let changed = false;
    const recoveredNames: string[] = [];

    // --- PHASE 1: Scan transactions and purchases for missing contact profiles ---
    const activeContactIds = new Set<string>();
    transactions.forEach(t => {
      if (t.contactId) activeContactIds.add(t.contactId);
    });
    purchases.forEach(p => {
      if (p.supplierId) activeContactIds.add(p.supplierId);
    });

    // 1. Try to find missing contacts directly in Firestore "customers" collection (Cloud Recovery)
    if (activeUser && !activeUser.isGuest && activeUser.uid && firebaseAuth.currentUser && firebaseAuth.currentUser.uid === activeUser.uid) {
      try {
        const activeUserId = activeUser.uid;
        const q = query(collection(db, "customers"), where("user_id", "==", activeUserId));
        const querySnap = await getDocs(q);
        
        if (!querySnap.empty) {
          querySnap.docs.forEach(docSnap => {
            const c = docSnap.data();
            const exists = updatedContacts.some(existing => existing.id === c.id);
            if (!exists && activeContactIds.has(c.id)) {
              const restoredContact: Contact = {
                id: c.id,
                name: c.name,
                phone: c.phone || "",
                address: c.address || "",
                type: (c.type as "customer" | "supplier") || "customer",
                created_at: c.updated_at || new Date().toISOString()
              };
              updatedContacts.push(restoredContact);
              recoveredNames.push(restoredContact.name);
              changed = true;
            }
          });
        }
      } catch (cloudErr) {
        console.warn("Could not query cloud customers directly for recovery:", cloudErr);
      }
    }

    // 3. Fallback: Synthesize supplier contacts using supplierName embedded in `purchases`
    purchases.forEach(p => {
      if (p.supplierId) {
        const exists = updatedContacts.some(c => c.id === p.supplierId);
        if (!exists) {
          const synthesizedContact: Contact = {
            id: p.supplierId,
            name: p.supplierName || "Unknown Supplier",
            phone: "",
            address: "",
            type: "supplier",
            created_at: p.date || new Date().toISOString()
          };
          updatedContacts.push(synthesizedContact);
          recoveredNames.push(synthesizedContact.name);
          changed = true;
        }
      }
    });

    if (changed) {
      setContacts(updatedContacts);
      
      const successMsg = recoveredNames.length > 0 
        ? `✨ Successfully recovered ${recoveredNames.length} profile(s) (${recoveredNames.slice(0, 3).join(", ")}${recoveredNames.length > 3 ? "..." : ""}) back to the CRM directory!`
        : "✨ All parent directories and customer profiles completely restored!";
      triggerNotification(successMsg, "success");
    } else {
      triggerNotification("🔍 No profiles found for recovery. Your database is fully synchronized!", "info");
    }
  };

  // Run auto recovery once on database final load
  useEffect(() => {
    if (initialLoadedRef.current && !hasHealedRef.current && (contacts.length > 0 || transactions.length > 0)) {
      hasHealedRef.current = true;
      runAutoRecovery();
    }
  }, [initialLoadedRef.current, contacts.length, transactions.length]);

  // Load Offline initial database state and sync latest from cloud safely
  useEffect(() => {
    try {
      selfHealDatabase();
    } catch (_) {}

    const unsub = subscribeToAuthChanges(async (user) => {
      setActiveUser(user);
      setSettingsHydrated(false);

      if (!user) {
        setIsAuthLoading(false);
        initialLoadedRef.current = true;
        // Cleanse memory state when user session is null to prevent carry-over data leak
        setProducts([]);
        setContacts([]);
        setExpenses([]);
        setTransactions([]);
        setPurchases([]);
        setBusinessInfo(INITIAL_BUSINESS_INFO);
        return;
      }

      // Reload database from custom localStorage storage corresponding to the session mode
      const getStored = (key: string, fallback: any) => {
        try {
          const val = localStorage.getItem(getDbKey(key, undefined, user.uid));
          return val ? JSON.parse(val) : fallback;
        } catch (_) {
          return fallback;
        }
      };

      const storedProducts = getStored("barakah_products", INITIAL_PRODUCTS);
      const storedContacts = getStored("barakah_contacts", INITIAL_CONTACTS);
      const storedExpenses = getStored("barakah_expenses", INITIAL_EXPENSES);
      const storedTransactions = getStored("barakah_transactions", []);
      const storedPurchases = getStored("barakah_purchases", INITIAL_PURCHASES);
      const storedBusinessInfo = getStored("barakah_business_info", INITIAL_BUSINESS_INFO);

      setProducts(storedProducts);
      setContacts(storedContacts);
      setExpenses(storedExpenses);
      setTransactions(storedTransactions);
      setBusinessInfo(storedBusinessInfo);
      setPurchases(storedPurchases);

      if (storedBusinessInfo && (storedBusinessInfo as any).staffList && Array.isArray((storedBusinessInfo as any).staffList)) {
        setStaffList((storedBusinessInfo as any).staffList);
      } else {
        try {
          const lstr = localStorage.getItem(getDbKey("barakah_staff_list"));
          if (lstr) setStaffList(JSON.parse(lstr));
        } catch (_) {}
      }

      // INSTANTLY dismiss loading screen to allow local cached database access!
      setIsAuthLoading(false);
      initialLoadedRef.current = true;

      // The account-scoped Firestore listeners are the source of truth.
      // Their first snapshots load the latest cloud state on every device.
      // Normal login must not run a separate passcode-vault restore.

    });
    return () => unsub();
  }, []);

    const [expenseCategories, setExpenseCategories] = useState<string[]>(["Rent", "Electricity", "Salary", "Marketing", "Others"]);

// Sync state to local storage automatically when changed and auto backup to cloud on changes
  useEffect(() => {
    if (!initialLoadedRef.current) return;
    if (isRemoteUpdateActiveRef.current) {
      console.log("[Auto Backup Guard] Skipping auto-backup of remote-initiated state changes.");
      return;
    }

    if (activeUser) {
      const compiledBusinessInfo = {
        ...businessInfo,
        expenseCategories,
        staffList
      };

      const userKey = getDbKey("barakah_business_info", activeUser.email, activeUser.uid);
      localStorage.setItem(userKey, JSON.stringify(compiledBusinessInfo));
      localStorage.setItem("barakah_business_info", JSON.stringify(compiledBusinessInfo));

      // Persist active core database state to local storage for instant offline & reload resilience
      const activeUserId = activeUser.uid;
      localStorage.setItem(getDbKey("barakah_products", undefined, activeUserId), JSON.stringify(products));
      localStorage.setItem(getDbKey("barakah_contacts", undefined, activeUserId), JSON.stringify(contacts));
      localStorage.setItem(getDbKey("barakah_expenses", undefined, activeUserId), JSON.stringify(expenses));
      localStorage.setItem(getDbKey("barakah_transactions", undefined, activeUserId), JSON.stringify(transactions));
      localStorage.setItem(getDbKey("barakah_purchases", undefined, activeUserId), JSON.stringify(purchases));

      // Also persist separately in localStorage just in case
      localStorage.setItem(getDbKey("barakah_staff_list"), JSON.stringify(staffList));

      // Auto cloud backup with 1.5 seconds debounce for all authenticated users so no data is ever lost
      if (activeUser && !activeUser.isGuest) {
        // Bulletproof sync guard: never auto-backup a completely blank database to the cloud
        const isSettingsModified = businessInfo && (
          businessInfo.name !== INITIAL_BUSINESS_INFO.name ||
          businessInfo.address !== INITIAL_BUSINESS_INFO.address ||
          businessInfo.phoneNumber !== INITIAL_BUSINESS_INFO.phoneNumber ||
          businessInfo.companyLogo !== INITIAL_BUSINESS_INFO.companyLogo
        );

        if (products.length === 0 && contacts.length === 0 && expenses.length === 0 && transactions.length === 0 && purchases.length === 0 && !isSettingsModified) {
          console.warn("[Auto Backup Guard] Local database is completely empty and settings are unmodified. Skipping background auto-backup to protect the cloud database from accidental overwrites.");
          return;
        }

        const passcode = activeUser.isPasscodeUser ? (activeUser.passcode || "1234") : "classic_account_secure";
        const delayDebounceFn = setTimeout(async () => {
          try {
            const res = await uploadPasscodeBackup(activeUser.email, passcode, {
              products,
              contacts,
              expenses,
              transactions,
              businessInfo: compiledBusinessInfo,
              purchases
            });
            if (res && res.success && res.updatedAt) {
              lastUploadedAtRef.current = res.updatedAt;
            }
          } catch (e) {
            console.warn("Auto-backup failed silently in background:", e);
          }
        }, 1500);
        return () => clearTimeout(delayDebounceFn);
      }
    }
  }, [products, contacts, expenses, transactions, businessInfo, purchases, expenseCategories, staffList, activeUser, settingsHydrated]);

  // Save business settings only when settings themselves change.
  // Product, customer, sale, expense and purchase state changes must not
  // trigger an unrelated business_info write.
  const lastBusinessSettingsSaveRef = useRef<string>("");
  useEffect(() => {
    if (!initialLoadedRef.current || !settingsHydrated || !activeUser || activeUser.isGuest || !activeUser.email) return;

    const compiledBusinessInfo = {
      ...businessInfo,
      expenseCategories,
      staffList
    };
    const fingerprint = JSON.stringify(compiledBusinessInfo);
    const saveKey = String(activeUser.uid || activeUser.email) + "::" + fingerprint;
    if (lastBusinessSettingsSaveRef.current === saveKey) return;

    // A settings snapshot arriving from Firestore is already saved remotely.
    // Do not echo it back as another write.
    if (isRemoteUpdateActiveRef.current) {
      lastBusinessSettingsSaveRef.current = saveKey;
      return;
    }

    const timer = window.setTimeout(async () => {
      if (isRemoteUpdateActiveRef.current) {
        lastBusinessSettingsSaveRef.current = saveKey;
        return;
      }
      try {
        await saveBusinessSettings(activeUser.email, compiledBusinessInfo);
        lastBusinessSettingsSaveRef.current = saveKey;
      } catch (err) {
        console.warn("[Auto Save] Business info cloud save failed:", err);
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    businessInfo,
    expenseCategories,
    staffList,
    activeUser?.uid,
    activeUser?.email,
    activeUser?.isGuest,
    settingsHydrated
  ]);

  // Set up granular real-time multi-device cloud collection subscription
  useEffect(() => {
    const handleFirestoreSyncError = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const code = String(detail.code || "");
      const message = String(detail.message || "Firestore connection error");
      firestoreListenerErrorRef.current = true;
      setSyncStatus("error");
      setSyncErrorMessage(code.includes("resource-exhausted")
        ? "Firestore daily usage limit reached. Cloud updates may be unavailable until the quota resets. Your locally saved data remains on this device."
        : `${detail.collection ? `${detail.collection}: ` : ""}${message}`);
    };
    window.addEventListener("barakah-firestore-sync-error", handleFirestoreSyncError);
    return () => window.removeEventListener("barakah-firestore-sync-error", handleFirestoreSyncError);
  }, []);

  useEffect(() => {
    if (!activeUser || activeUser.isGuest) {
      setSyncStatus("offline");
      setSyncErrorMessage("");
      return;
    }

    setSyncStatus("connecting");
    firestoreListenerErrorRef.current = false;
    setSyncErrorMessage("");

    const cleanEmail = (activeUser.email || "").trim().toLowerCase();
    const activeUserId = activeUser.uid || firebaseAuth.currentUser?.uid || cleanEmail;

    const markRemoteUpdateActive = () => {
      isRemoteUpdateActiveRef.current = true;
      if (remoteTimeoutRef.current) {
        clearTimeout(remoteTimeoutRef.current);
      }
      remoteTimeoutRef.current = setTimeout(() => {
        isRemoteUpdateActiveRef.current = false;
        console.log("[Auto Backup Guard] Remote sync quiet period ended. Auto-backup restored.");
      }, 2500);
    };

    console.log(`[Realtime Sync Engine] Subscribing in real-time to granular Firestore collections for user: ${activeUserId} (${cleanEmail})`);

    // Helper to rebuild nested transactions from flat transaction and flat items lists
    const rebuildTransactions = (flatTx: any[], flatItems: any[]) => {
      let localNested: any[] = [];
      try {
        const rawLocal = localStorage.getItem(getDbKey("barakah_transactions", undefined, activeUserId));
        if (rawLocal) {
          localNested = JSON.parse(rawLocal);
          if (!Array.isArray(localNested)) localNested = [];
        }
      } catch (e) {
        console.warn("[rebuildTransactions] Error parsing local nested:", e);
      }

      const rebuiltList: any[] = [];

      flatTx.forEach(t => {
        const relatedItems = flatItems.filter((item: any) => item.transaction_id === t.id);
        let mappedItems: any[] = [];

        if (relatedItems.length > 0) {
          mappedItems = relatedItems.map((item: any) => ({
            id: item.id,
            firestoreId: item.firestoreId,
            name: item.product_name || "Product Item",
            quantity: Number(item.quantity) || 0,
            price: Number(item.sell_price) || 0,
            total: Number(item.quantity * item.sell_price) || 0,
            productId: item.product_id || undefined,
            category: item.category || "",
            buyPrice: item.cost_price !== undefined ? Number(item.cost_price) : undefined,
            costAllocations: item.cost_allocations || item.costAllocations || undefined,
            isNegativeSale: item.is_negative_sale === true || item.isNegativeSale === true,
            isNegativeSaleApproved: item.is_negative_sale_approved === true || item.isNegativeSaleApproved === true,
            negativeSaleUpdated: item.is_negative_sale_approved === true || item.negativeSaleUpdated === true
          }));
        } else {
          // Keep existing items if present locally or in t.items to protect against incomplete collections snapshot
          const existing = localNested.find((x: any) => x.id === t.id);
          if (existing && Array.isArray(existing.items) && existing.items.length > 0) {
            mappedItems = existing.items;
          } else if (Array.isArray(t.items) && t.items.length > 0) {
            mappedItems = t.items;
          }
        }

        const resolvedSubtotal = t.subtotal !== undefined && t.subtotal !== null
          ? Number(t.subtotal) || 0
          : mappedItems.length > 0
            ? mappedItems.reduce((sum: number, item: any) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0)
            : Number(t.total_amount) || 0;
        const resolvedTax = t.tax_amount !== undefined && t.tax_amount !== null
          ? Number(t.tax_amount) || 0
          : t.tax !== undefined && t.tax !== null
            ? Number(t.tax) || 0
            : Math.round(resolvedSubtotal * (Number(t.vat_rate) || 0) / 100);

        rebuiltList.push({
          id: t.id,
          firestoreId: t.firestoreId,
          invoiceNo: t.invoice_no,
          date: t.created_at || new Date().toISOString(),
          items: mappedItems,
          subtotal: resolvedSubtotal,
          tax: resolvedTax,
          discount: Number(t.discount) || 0,
          total: Number(t.total_amount) || 0,
          paymentMethod: t.payment_method || "Cash",
          paymentHistory: Array.isArray(t.payment_history) ? t.payment_history : (Array.isArray(t.paymentHistory) ? t.paymentHistory : []),
          status: t.paid_amount >= t.total_amount ? "paid" : (t.paid_amount > 0 ? "partial" : "due"),
          paidAmount: Number(t.paid_amount) || 0,
          dueBalance: Math.max(0, Number(t.total_amount) - Number(t.paid_amount)) || 0,
          contactId: t.customer_id || undefined,
          customerSignature: t.signature_svg || undefined
        });
      });

      return rebuiltList;
    };

    // 1. PRODUCTS SUBSCRIBER
    const unsubProducts = subscribeProducts(activeUserId, (items) => {
      if (items.length === 0) {
        try {
          const cached = localStorage.getItem(getDbKey("barakah_products", undefined, activeUserId));
          if (cached) { const parsed = JSON.parse(cached); if (Array.isArray(parsed) && parsed.length > 0) return; }
        } catch (_) {}
      }
      markRemoteUpdateActive();

      const updatedList = items.map(docData => ({
        id: docData.id,
        name: docData.name || "Unnamed Product",
        sku: docData.sku || "",
        stock: Number(docData.stock) || 0,
        buyPrice: Number(docData.buyPrice ?? docData.buy_price) || 0,
        sellPrice: Number(docData.sellPrice ?? docData.sell_price) || 0,
        category: docData.category || "Electronics",
        unit: docData.unit || "piece",
        imageUrl: docData.imageUrl || docData.image_url || undefined,
        costLots: Array.isArray(docData.costLots) ? docData.costLots : (Array.isArray(docData.cost_lots) ? docData.cost_lots : undefined)
      }));

      localStorage.setItem(getDbKey("barakah_products", undefined, activeUserId), JSON.stringify(updatedList));
      initialLoadedRef.current = false;
      setProducts(updatedList);
      setTimeout(() => { initialLoadedRef.current = true; }, 100);
      if (!firestoreListenerErrorRef.current) setSyncStatus("connected");
    });

    // 2. CUSTOMERS SUBSCRIBER
    const unsubCustomers = subscribeCustomers(activeUserId, (items) => {
      if (items.length === 0) {
        try {
          const cached = localStorage.getItem(getDbKey("barakah_contacts", undefined, activeUserId));
          if (cached) { const parsed = JSON.parse(cached); if (Array.isArray(parsed) && parsed.length > 0) return; }
        } catch (_) {}
      }
      markRemoteUpdateActive();

      const updatedList = items.map(docData => ({
        id: docData.id,
        firestoreId: docData.firestoreId,
        name: docData.name || "Unnamed Contact",
        phone: docData.phone || "",
        address: docData.address || "",
        type: docData.type || "customer",
        created_at: docData.created_at || docData.updated_at || new Date().toISOString()
      })).sort((a, b) => {
        const dateA = new Date(a.created_at || (a as any).createdAt || 0).getTime();
        const dateB = new Date(b.created_at || (b as any).createdAt || 0).getTime();
        return dateB - dateA;
      });

      localStorage.setItem(getDbKey("barakah_contacts", undefined, activeUserId), JSON.stringify(updatedList));
      initialLoadedRef.current = false;
      setContacts(updatedList);
      setTimeout(() => { initialLoadedRef.current = true; }, 100);
      if (!firestoreListenerErrorRef.current) setSyncStatus("connected");
    });

    // 3. EXPENSES SUBSCRIBER
    const unsubExpenses = subscribeExpenses(activeUserId, (items) => {
      if (items.length === 0) {
        try {
          const cached = localStorage.getItem(getDbKey("barakah_expenses", undefined, activeUserId));
          if (cached) { const parsed = JSON.parse(cached); if (Array.isArray(parsed) && parsed.length > 0) return; }
        } catch (_) {}
      }
      markRemoteUpdateActive();

      const updatedList = items.map(docData => ({
        id: docData.id,
        category: docData.category || "Others",
        amount: Number(docData.amount) || 0,
        description: docData.description || "",
        // The user-selected expense date is authoritative. created_at is only a
        // legacy fallback and must never overwrite the selected ledger date.
        date: docData.date || docData.created_at || new Date().toISOString()
      }));

      localStorage.setItem(getDbKey("barakah_expenses", undefined, activeUserId), JSON.stringify(updatedList));
      initialLoadedRef.current = false;
      setExpenses(updatedList);
      setTimeout(() => { initialLoadedRef.current = true; }, 100);
      if (!firestoreListenerErrorRef.current) setSyncStatus("connected");
    });

    // 4. PURCHASES SUBSCRIBER
    const unsubPurchases = subscribePurchases(activeUserId, (items) => {
      if (items.length === 0) {
        try {
          const cached = localStorage.getItem(getDbKey("barakah_purchases", undefined, activeUserId));
          if (cached) { const parsed = JSON.parse(cached); if (Array.isArray(parsed) && parsed.length > 0) return; }
        } catch (_) {}
      }
      markRemoteUpdateActive();

      const updatedList = items.map(docData => {
        const quantity = Number(docData.quantity) || 0;
        const buyPrice = Number(docData.buyPrice ?? docData.buy_price) || 0;
        return {
          id: docData.id,
          productId: docData.productId || docData.product_id || "",
          productName: docData.productName || docData.product_name || "Purchase Item",
          supplierId: docData.supplierId || docData.supplier_id || "",
          supplierName: docData.supplierName || docData.supplier_name || "Main Depot",
          quantity,
          buyPrice,
          totalAmount: Number(docData.totalAmount ?? docData.total_amount) || quantity * buyPrice,
          date: docData.date || docData.created_at || new Date().toISOString(),
          cashPaid: Number(docData.cashPaid ?? docData.cash_paid) || 0,
          dueAmount: Number(docData.dueAmount ?? docData.due_amount) || 0,
          invoiceNo: docData.invoiceNo || docData.invoice_no || "",
          note: docData.note || ""
        };
      });

      localStorage.setItem(getDbKey("barakah_purchases", undefined, activeUserId), JSON.stringify(updatedList));
      initialLoadedRef.current = false;
      setPurchases(updatedList);
      setTimeout(() => { initialLoadedRef.current = true; }, 100);
      if (!firestoreListenerErrorRef.current) setSyncStatus("connected");
    });

    // Helper to merge and trigger transaction state rebuild
    const handleTransactionsChange = (newFlatTx?: any[], newFlatItems?: any[]) => {
      const rawLocalTx = localStorage.getItem(getDbKey("barakah_flat_transactions", undefined, activeUserId)) || "[]";
      let flatTx = newFlatTx || JSON.parse(rawLocalTx);
      if (!Array.isArray(flatTx)) flatTx = [];

      const rawLocalItems = localStorage.getItem(getDbKey("barakah_flat_transaction_items", undefined, activeUserId)) || "[]";
      let flatItems = newFlatItems || JSON.parse(rawLocalItems);
      if (!Array.isArray(flatItems)) flatItems = [];

      const nestedTx = rebuildTransactions(flatTx, flatItems);
      nestedTx.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      localStorage.setItem(getDbKey("barakah_transactions", undefined, activeUserId), JSON.stringify(nestedTx));

      initialLoadedRef.current = false;
      setTransactions(nestedTx);
      setTimeout(() => { initialLoadedRef.current = true; }, 100);
      if (!firestoreListenerErrorRef.current) setSyncStatus("connected");
    };

    // 5. TRANSACTIONS SUBSCRIBER
    const unsubTransactions = subscribeTransactions(activeUserId, (items) => {
      if (items.length === 0) {
        try {
          const cached = localStorage.getItem(getDbKey("barakah_flat_transactions", undefined, activeUserId));
          if (cached) { const parsed = JSON.parse(cached); if (Array.isArray(parsed) && parsed.length > 0) return; }
        } catch (_) {}
      }
      markRemoteUpdateActive();

      const flatTransactions = items.map(docData => ({
        id: docData.id,
        firestoreId: docData.firestoreId,
        invoice_no: docData.invoice_no,
        customer_id: docData.customer_id || null,
        total_amount: Number(docData.total_amount) || 0,
        subtotal: docData.subtotal !== undefined && docData.subtotal !== null ? Number(docData.subtotal) || 0 : undefined,
        tax_amount: docData.tax_amount !== undefined && docData.tax_amount !== null
          ? Number(docData.tax_amount) || 0
          : docData.tax !== undefined && docData.tax !== null ? Number(docData.tax) || 0 : undefined,
        discount: Number(docData.discount) || 0,
        vat_rate: Number(docData.vat_rate) || 0,
        paid_amount: Number(docData.paid_amount) || 0,
        payment_method: docData.payment_method || "Cash",
        payment_history: Array.isArray(docData.payment_history) ? docData.payment_history : (Array.isArray(docData.paymentHistory) ? docData.paymentHistory : []),
        signature_svg: docData.signature_svg || null,
        created_at: docData.created_at || new Date().toISOString()
      }));

      localStorage.setItem(getDbKey("barakah_flat_transactions", undefined, activeUserId), JSON.stringify(flatTransactions));
      handleTransactionsChange(flatTransactions, undefined);
    });

    // 6. TRANSACTION ITEMS SUBSCRIBER
    // Account-scoped listener: never scan every store's transaction items.
    const unsubItems = subscribeTransactionItems(activeUserId, (items) => {
      markRemoteUpdateActive();

      const flatItems = items.map((docData: any) => ({
        id: docData.id,
        firestoreId: docData.firestoreId,
        transaction_id: docData.transaction_id,
        product_id: docData.product_id || null,
        product_name: docData.product_name || "Product Item",
        quantity: Number(docData.quantity) || 0,
        sell_price: Number(docData.sell_price) || 0,
        cost_price: docData.cost_price !== undefined ? Number(docData.cost_price) : 0,
        cost_allocations: docData.cost_allocations || docData.costAllocations || undefined,
        is_negative_sale: docData.is_negative_sale === true || docData.isNegativeSale === true,
        is_negative_sale_approved: docData.is_negative_sale_approved === true || docData.isNegativeSaleApproved === true
      }));

      localStorage.setItem(getDbKey("barakah_flat_transaction_items", undefined, activeUserId), JSON.stringify(flatItems));
      handleTransactionsChange(undefined, flatItems);
    });

    // 7. BUSINESS INFO / SETTINGS SUBSCRIBER
    let unsubBusinessInfo = () => {};
    if (activeUser.email) {
      const cleanEmail = activeUser.email.trim().toLowerCase();
      const settingsDocId = `settings_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      unsubBusinessInfo = onSnapshot(doc(db, "business_info", settingsDocId), (docSnap) => {
        if (docSnap.exists()) {
          // Treat the settings snapshot as a remote update so it is not echoed
          // back into Firestore by the settings-only autosave effect.
          markRemoteUpdateActive();
          const cloudData = docSnap.data();
          if (cloudData && typeof cloudData === "object") {
            const { id, user_id, userId, linkedEmail, ...cleanInfo } = cloudData;
            if (Object.keys(cleanInfo).length > 0) {
              setBusinessInfo(prev => {
                const merged = { ...prev, ...cleanInfo };
                const userKey = getDbKey("barakah_business_info", activeUser.email, activeUser.uid);
                localStorage.setItem(userKey, JSON.stringify(merged));
                localStorage.setItem("barakah_business_info", JSON.stringify(merged));
                return merged;
              });
            }
          }
        }
        // Only enable settings autosave after Firestore confirms the initial state.
        setSettingsHydrated(true);
      }, (err) => {
        setSettingsHydrated(false);
        console.warn("[Realtime Sync] business_info listener error:", err);
      });
    }

    if (!firestoreListenerErrorRef.current) setSyncStatus("connected");

    return () => {
      unsubProducts();
      unsubCustomers();
      unsubExpenses();
      unsubPurchases();
      unsubTransactions();
      unsubItems();
      unsubBusinessInfo();
      setSyncStatus("offline");
    };
  }, [activeUser]);

  // Load Admin-only paid delivery staff expenses for Dashboard profit calculations.
  // This is fetched from the authenticated, store-scoped API and never shared across accounts.
  useEffect(() => {
    let cancelled = false;
    const loadPaidDeliveryExpenses = async () => {
      if (!activeUser || activeUser.isGuest || currentPanel !== "admin" || !adminActionPin) {
        setDeliveryExpenseRecords([]);
        return;
      }
      const storeId = String(activeUser.email || "").trim().toLowerCase();
      const user = firebaseAuth.currentUser;
      if (!storeId || !user || user.uid !== activeUser.uid) {
        setDeliveryExpenseRecords([]);
        return;
      }
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/delivery/expenses/admin-list", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ store_id: storeId, admin_pin: adminActionPin, payment_status: "" }),
          cache: "no-store"
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not load paid delivery expenses.");
        if (!cancelled) setDeliveryExpenseRecords(Array.isArray(result.expenses) ? result.expenses : []);
      } catch (error) {
        console.warn("[Dashboard] Paid delivery expenses could not be loaded:", error);
        if (!cancelled) setDeliveryExpenseRecords([]);
      }
    };
    loadPaidDeliveryExpenses();
    return () => { cancelled = true; };
  }, [activeUser?.uid, activeUser?.email, activeUser?.isGuest, currentPanel, adminActionPin]);

  // Periodic PWA update check and network status monitoring
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const checkUpdate = async () => {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            console.log("[PWA Update Check] Checking for service worker updates...");
            await reg.update();
          }
        } catch (err) {
          console.warn("[PWA Update Check] Error checking for updates:", err);
        }
      };

      // Check on mount
      checkUpdate();

      // Check every 5 minutes
      const interval = setInterval(checkUpdate, 5 * 60 * 1000);

      // Check when online status returns
      const handleOnline = () => {
        console.log("[Network] Device is back online. Checking for PWA updates & sync refresh...");
        checkUpdate();
      };
      window.addEventListener('online', handleOnline);

      return () => {
        clearInterval(interval);
        window.removeEventListener('online', handleOnline);
      };
    }
  }, []);

  // Synchronize staff list on cloud restore or config resets
  useEffect(() => {
    if (businessInfo && (businessInfo as any).staffList && Array.isArray((businessInfo as any).staffList)) {
      setStaffList((businessInfo as any).staffList);
    }
  }, [businessInfo]);

  const [successTriggerMsg, setSuccessTriggerMsg] = useState<string | null>(null);

  // Show customized temporal workspace notification
  const triggerNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    // Suppress automatic sync/recovery notifications during page reload so
    // the user sees only the dedicated refresh confirmation.
    if (isReloadToastActiveRef.current) return;
    setNotification({ message, type });
    if (type === "success") {
      setSuccessTriggerMsg(message);
      setTimeout(() => setSuccessTriggerMsg(null), 1600);
    }
    setTimeout(() => setNotification(null), 4000);
  };

  // Show exactly one small refresh message; suppress competing sync/recovery
  // notifications and the large "Saved Successfully" overlay on reload.
  useEffect(() => {
    if (!isReloadToastActiveRef.current) return;
    setSuccessTriggerMsg(null);
    setNotification({ message: "Successfully page refreshed", type: "success" });
    const toastTimeout = window.setTimeout(() => setNotification(null), 1300);
    const suppressTimeout = window.setTimeout(() => {
      isReloadToastActiveRef.current = false;
    }, 4500);
    return () => {
      window.clearTimeout(toastTimeout);
      window.clearTimeout(suppressTimeout);
    };
  }, []);

  // Handler for guest login
  const handleGuestLogin = () => {
    initialLoadedRef.current = false;
    const dummyUser = {
      email: "guest@barakah.local",
      isPasscodeUser: false,
      isGuest: true
    };
    setActiveUser(dummyUser);
    
    // Refresh states
    const getStored = (key: string, fallback: any) => {
      try {
        const val = localStorage.getItem(getDbKey(key, undefined, undefined));
        return val ? JSON.parse(val) : fallback;
      } catch (_) {
        return fallback;
      }
    };
    setProducts(getStored("barakah_products", INITIAL_PRODUCTS));
    setContacts(getStored("barakah_contacts", INITIAL_CONTACTS));
    setExpenses(getStored("barakah_expenses", INITIAL_EXPENSES));
    setTransactions(getStored("barakah_transactions", []));
    setBusinessInfo(getStored("barakah_business_info", INITIAL_BUSINESS_INFO));
    setPurchases(getStored("barakah_purchases", INITIAL_PURCHASES));
    triggerNotification("Guest Mode Activated (Welcome to Sandbox Guest Mode!)", "info");
    initialLoadedRef.current = true;
  };

  // Trigger PIN Backup restore/pull
  const triggerCloudBackupRestore = async () => {
    if (!activeUser || activeUser.isGuest) {
      triggerNotification("Cloud restore is only available for registered store members.", "info");
      return;
    }

    const confirmRestore = window.confirm(
      "Are you sure you want to restore your database from the cloud? This will overwrite your current local device data with the latest cloud-synchronized state."
    );
    if (!confirmRestore) return;

    setIsRestoring(true);
    const passcode = activeUser.isPasscodeUser ? (activeUser.passcode || "1234") : "classic_account_secure";
    try {
      const restored = await fetchAndRestoreCloudBackup(activeUser.email, passcode, true);
      if (restored) {
        // Reload states
        const getStored = (key: string, fallback: any) => {
          try {
            const val = localStorage.getItem(getDbKey(key, undefined, activeUser?.uid));
            return val ? JSON.parse(val) : fallback;
          } catch (_) {
            return fallback;
          }
        };
        setProducts(getStored("barakah_products", INITIAL_PRODUCTS));
        setContacts(getStored("barakah_contacts", INITIAL_CONTACTS));
        setExpenses(getStored("barakah_expenses", INITIAL_EXPENSES));
        setTransactions(getStored("barakah_transactions", []));
        setBusinessInfo(getStored("barakah_business_info", INITIAL_BUSINESS_INFO));
        setPurchases(getStored("barakah_purchases", INITIAL_PURCHASES));

        triggerNotification("Cloud backup restored and synchronized successfully! 🎉", "success");
      } else {
        triggerNotification("No cloud backup found or restore failed.", "error");
      }
    } catch (e: any) {
      triggerNotification("Error restoring cloud backup: " + e.message, "error");
    } finally {
      setIsRestoring(false);
    }
  };

  // Handler for importing local JSON data upload/backup file
  const handleDataImport = (data: any) => {
    restoreLocalKeys(data, true, activeUser?.uid);
    // Reload states from newly restored localStorage DB
    const getStored = (key: string, fallback: any) => {
      try {
        const val = localStorage.getItem(getDbKey(key, undefined, activeUser?.uid));
        return val ? JSON.parse(val) : fallback;
      } catch (_) {
        return fallback;
      }
    };
    setProducts(getStored("barakah_products", INITIAL_PRODUCTS));
    setContacts(getStored("barakah_contacts", INITIAL_CONTACTS));
    setExpenses(getStored("barakah_expenses", INITIAL_EXPENSES));
    setTransactions(getStored("barakah_transactions", []));
    setBusinessInfo(getStored("barakah_business_info", INITIAL_BUSINESS_INFO));
    setPurchases(getStored("barakah_purchases", INITIAL_PURCHASES));
  };

  // Handler for custom local auth action signup
  const handleSignUp = async (email: string, pass: string) => {
    initialLoadedRef.current = false;
    const user = await signUpWithEmail(email, pass);
    setActiveUser(user);
    
    // Refresh states
    const getStored = (key: string, fallback: any) => {
      try {
        const val = localStorage.getItem(getDbKey(key, undefined, user?.uid));
        return val ? JSON.parse(val) : fallback;
      } catch (_) {
        return fallback;
      }
    };
    setProducts(getStored("barakah_products", INITIAL_PRODUCTS));
    setContacts(getStored("barakah_contacts", INITIAL_CONTACTS));
    setExpenses(getStored("barakah_expenses", INITIAL_EXPENSES));
    setTransactions(getStored("barakah_transactions", []));
    setBusinessInfo(getStored("barakah_business_info", INITIAL_BUSINESS_INFO));
    setPurchases(getStored("barakah_purchases", INITIAL_PURCHASES));

    if (user.restored) {
      triggerNotification("Cloud backup and database restore completed successfully! 🎉");
    } else {
      triggerNotification("New account created successfully!");
    }
    setTimeout(() => {
      initialLoadedRef.current = true;
    }, 500);
  };

  // Handler for auth action signin
  const handleSignIn = async (email: string, pass: string) => {
    initialLoadedRef.current = false;
    const user = await signInWithEmail(email, pass);
    setActiveUser(user);

    // Refresh states
    const getStored = (key: string, fallback: any) => {
      try {
        const val = localStorage.getItem(getDbKey(key, undefined, user?.uid));
        return val ? JSON.parse(val) : fallback;
      } catch (_) {
        return fallback;
      }
    };
    setProducts(getStored("barakah_products", INITIAL_PRODUCTS));
    setContacts(getStored("barakah_contacts", INITIAL_CONTACTS));
    setExpenses(getStored("barakah_expenses", INITIAL_EXPENSES));
    setTransactions(getStored("barakah_transactions", []));
    setBusinessInfo(getStored("barakah_business_info", INITIAL_BUSINESS_INFO));
    setPurchases(getStored("barakah_purchases", INITIAL_PURCHASES));

    if (user.restored) {
      triggerNotification("Welcome back! Your store data was seamlessly restored from cloud backup. 🎉");
    } else {
      triggerNotification("Welcome back to your store terminal logs!");
    }
    setTimeout(() => {
      initialLoadedRef.current = true;
    }, 500);
  };

  // Handler for PIN passcode flow
  const handlePasscodeLogin = async (email: string, pinCode: string) => {
    initialLoadedRef.current = false;
    const user = await signInOrSignUpWithPasscode(email, pinCode);
    setActiveUser(user);
    
    // Refresh states
    const getStored = (key: string, fallback: any) => {
      try {
        const val = localStorage.getItem(getDbKey(key, undefined, user?.uid));
        return val ? JSON.parse(val) : fallback;
      } catch (_) {
        return fallback;
      }
    };
    setProducts(getStored("barakah_products", INITIAL_PRODUCTS));
    setContacts(getStored("barakah_contacts", INITIAL_CONTACTS));
    setExpenses(getStored("barakah_expenses", INITIAL_EXPENSES));
    setTransactions(getStored("barakah_transactions", []));
    setBusinessInfo(getStored("barakah_business_info", INITIAL_BUSINESS_INFO));
    setPurchases(getStored("barakah_purchases", INITIAL_PURCHASES));

    if (user.restored) {
      triggerNotification("Cloud backup and database restore completed successfully! 🎉");
    } else {
      triggerNotification("New security passcode vault ready. Start managing your accounts!");
    }
    setTimeout(() => {
      initialLoadedRef.current = true;
    }, 500);
  };

  // User Sign out
  const handleLogOut = async () => {
    initialLoadedRef.current = false;
    if (activeUser && !activeUser.isGuest) {
      const passcode = activeUser.isPasscodeUser ? (activeUser.passcode || "1234") : "classic_account_secure";
      // Perform immediate cloud backup before signing out so nothing is ever lost
      try {
        await uploadPasscodeBackup(activeUser.email, passcode, {
          products,
          contacts,
          expenses,
          transactions,
          businessInfo,
          purchases
        });
      } catch (e) {
        console.warn("Express logout backup sync error:", e);
      }
    }
    await signOut();
    setActiveUser(null);
    setCurrentPanel("none");
    setAdminActionPin("");
    triggerNotification("Logged out from terminal successfully.");
  };

  // -----------------------------------------------------------------
  // 1. POS INVOICING WORKSPACE (Cash Memo) STATE
  // -----------------------------------------------------------------
  const [posCart, setPosCart] = useState<{ product: Product; quantity: number; price?: number; warranty?: string }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [cartItemQty, setCartItemQty] = useState<number>(1);
  const [cartItemPrice, setCartItemPrice] = useState<string>("");
  const [cartItemWarranty, setCartItemWarranty] = useState<string>("");
  const [customerDiscount, setCustomerDiscount] = useState<number>(0);
  const [invoiceTaxRate, setInvoiceTaxRate] = useState<number>(0); // default VAT % is now 0
  const [posSelectedContactId, setPosSelectedContactId] = useState<string>("");
  const [posCustomDate, setPosCustomDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [amountPaidPaid, setAmountPaidPaid] = useState<string>("");
  const [showSignaturePad, setShowSignaturePad] = useState<boolean>(true);

  // Local temp states for Settings with individual block saves
  const [activeSettingsSection, setActiveSettingsSection] = useState<"overview" | "shop" | "font" | "invoice" | "sales" | "security" | "danger" | "cloud">("overview");
  const localCoreAvailable = (() => { try { window.localStorage.getItem("barakah_local_active_user"); return true; } catch { return false; } })();
  const isFirestoreQuotaLimited = /daily usage limit|resource[_\s-]?exhausted|quota.{0,40}(?:exceeded|exhausted)|(?:exceeded|exhausted).{0,40}quota/i.test(syncErrorMessage);
  const [tempShopName, setTempShopName] = useState("");
  const [tempShopAddress, setTempShopAddress] = useState("");
  const [tempShopPhone, setTempShopPhone] = useState("");
  const [tempShopEmail, setTempShopEmail] = useState("");
  const [tempInvoiceDisplayEmail, setTempInvoiceDisplayEmail] = useState("");
  const [tempVatRegNo, setTempVatRegNo] = useState("");
  const [tempCurrency, setTempCurrency] = useState("৳");

  const [tempLogoBase64, setTempLogoBase64] = useState("");
  const [tempShowLogo, setTempShowLogo] = useState(true);
  const [tempTerms, setTempTerms] = useState("");
  const [tempShowCustSig, setTempShowCustSig] = useState(true);
  const [tempShowAuthSig, setTempShowAuthSig] = useState(true);
  const [tempShowPartners, setTempShowPartners] = useState(true);
  const [tempPartnerLogos, setTempPartnerLogos] = useState<string[]>([]);
  const [tempPresetBrands, setTempPresetBrands] = useState<string[]>([]);
  const [newCustomBrandName, setNewCustomBrandName] = useState("");
  const [tempFont, setTempFont] = useState("Inter");
  const [tempInvoiceTemplate, setTempInvoiceTemplate] = useState("classic");
  const [tempLogoAlignment, setTempLogoAlignment] = useState<"left" | "center" | "right">("left");
  const [tempStartingInvoiceNumber, setTempStartingInvoiceNumber] = useState<number>(1001);
  const [invoicePreviewDataUrl, setInvoicePreviewDataUrl] = useState<string>("");
  const [invoicePreviewLoading, setInvoicePreviewLoading] = useState(false);
  const [challanPreviewDataUrl, setChallanPreviewDataUrl] = useState<string>("");
  const [challanPreviewLoading, setChallanPreviewLoading] = useState(false);
  const [activeDocumentPreview, setActiveDocumentPreview] = useState<"invoice" | "challan">("invoice");
  
  // Custom states for global font size scaling & inline ledger cost adjustments
  const [fontSizeScale, setFontSizeScale] = useState<"Regular" | "Medium" | "Large">(
    () => (localStorage.getItem("font_size_scale") as "Regular" | "Medium" | "Large") || "Regular"
  );
  const [tempFontSizeScale, setTempFontSizeScale] = useState<"Regular" | "Medium" | "Large">("Regular");
  const [showCostEditId, setShowCostEditId] = useState<string | null>(null);

  const [tempCanEditSales, setTempCanEditSales] = useState(true);
  const [tempCanDeleteSales, setTempCanDeleteSales] = useState(true);
  const [tempCanOverridePrices, setTempCanOverridePrices] = useState(true);

  // States for passcode configuration in Settings
  const [currentAdminPasscode, setCurrentAdminPasscode] = useState("");
  const [tempAdminPasscode, setTempAdminPasscode] = useState("1234");
  const [tempSalesPasscode, setTempSalesPasscode] = useState("5555");

  // Danger zone double-confirmation modal state
  const [dangerAction, setDangerAction] = useState<"delete_transactions" | "delete_customers" | "reset_app" | "delete_account" | null>(null);
  const [dangerConfirmText, setDangerConfirmText] = useState("");

  // Sync state initialization
  useEffect(() => {
    if (businessInfo) {
      setTempShopName(businessInfo.name || "");
      setTempShopAddress(businessInfo.address || "");
      setTempShopPhone(businessInfo.phoneNumber || "");
      setTempShopEmail(businessInfo.email || "");
      setTempInvoiceDisplayEmail(businessInfo.invoiceDisplayEmail || "");
      setTempVatRegNo(businessInfo.vatRegNo || "");
      setTempCurrency(businessInfo.currencySymbol || "৳");

      setTempAdminPasscode(businessInfo.adminPasscode || "1234");
      setTempSalesPasscode(businessInfo.salesPasscode || "5555");

      setTempLogoBase64(businessInfo.companyLogo || "");
      setTempShowLogo(businessInfo.showLogoInInvoice !== false);
      setTempTerms(businessInfo.termsConditions || "");
      setTempShowCustSig(businessInfo.showCustomerSignature !== false);
      setTempShowAuthSig(businessInfo.showAuthorizedSignature !== false);
      setTempShowPartners(businessInfo.showPartnerLogos !== false);
      setTempPartnerLogos(businessInfo.partnerLogos || []);
      setTempPresetBrands(businessInfo.presetBrands || []);
      setTempFont(businessInfo.selectedFont || "Inter");
      setTempInvoiceTemplate("classic");
      setTempLogoAlignment(businessInfo.logoAlignment || "left");
      setTempStartingInvoiceNumber(businessInfo.startingInvoiceNumber || 1001);
      const savedScale = (localStorage.getItem("font_size_scale") as "Regular" | "Medium" | "Large") || "Regular";
      setTempFontSizeScale(savedScale);

      setTempCanEditSales(businessInfo.salesmanPermissions?.canEditSales !== false);
      setTempCanDeleteSales(businessInfo.salesmanPermissions?.canDeleteSales !== false);
      setTempCanOverridePrices(businessInfo.salesmanPermissions?.canOverridePrices !== false);
    }
  }, [businessInfo]);

  // Generate the Settings preview through the exact same A4 PDF renderer used for printed invoices.
  useEffect(() => {
    if (activeSettingsSection !== "invoice") return;
    let cancelled = false;
    setInvoicePreviewLoading(true);
    setInvoicePreviewDataUrl("");

    const previewTotal = 55900;
    const previewTransaction: Transaction = {
      id: "invoice-layout-preview",
      invoiceNo: "PREVIEW-0001",
      date: new Date().toISOString(),
      items: [{
        id: "invoice-preview-item-1",
        name: "Haier 43-inch QLED 4K Google TV",
        quantity: 1,
        price: previewTotal,
        total: previewTotal,
        warranty: "2 Years"
      }],
      subtotal: previewTotal, tax: 0, discount: 0, total: previewTotal,
      paymentMethod: "Cash", status: "paid", paidAmount: previewTotal, dueBalance: 0
    };
    const previewContact: Contact = {
      id: "invoice-layout-preview-customer", name: "Sample Customer",
      phone: "01XXXXXXXXX", address: "Dhaka, Bangladesh",
      type: "customer", created_at: new Date().toISOString()
    };
    const previewBusinessInfo: BusinessInfo = {
      ...businessInfo,
      name: tempShopName || businessInfo.name || "BARAKAH E-MART",
      address: tempShopAddress || businessInfo.address,
      phoneNumber: tempShopPhone || businessInfo.phoneNumber,
      email: tempShopEmail || businessInfo.email,
      invoiceDisplayEmail: tempInvoiceDisplayEmail.trim(),
      vatRegNo: tempVatRegNo || businessInfo.vatRegNo,
      currencySymbol: tempCurrency || businessInfo.currencySymbol,
      companyLogo: tempLogoBase64, showLogoInInvoice: tempShowLogo,
      termsConditions: tempTerms,
      showCustomerSignature: tempShowCustSig, showAuthorizedSignature: tempShowAuthSig,
      selectedFont: tempFont, logoAlignment: tempLogoAlignment,
      showPartnerLogos: tempShowPartners, partnerLogos: tempPartnerLogos, presetBrands: tempPresetBrands
    };

    generateInvoicePDF(previewTransaction, previewContact, previewBusinessInfo, "preview")
      .then((dataUrl) => { if (!cancelled && typeof dataUrl === "string") setInvoicePreviewDataUrl(dataUrl); })
      .catch((error) => {
        console.error("Could not generate the live A4 invoice preview:", error);
        if (!cancelled) setInvoicePreviewDataUrl("");
      })
      .finally(() => { if (!cancelled) setInvoicePreviewLoading(false); });

    setChallanPreviewLoading(true);
    setChallanPreviewDataUrl("");
    generateDeliveryChallanPDF(previewTransaction, previewContact, previewBusinessInfo, "preview")
      .then((dataUrl) => { if (!cancelled && typeof dataUrl === "string") setChallanPreviewDataUrl(dataUrl); })
      .catch((error) => {
        console.error("Could not generate the live A4 delivery challan preview:", error);
        if (!cancelled) setChallanPreviewDataUrl("");
      })
      .finally(() => { if (!cancelled) setChallanPreviewLoading(false); });

    return () => { cancelled = true; };
  }, [
    activeSettingsSection,
    businessInfo.name, businessInfo.address, businessInfo.phoneNumber, businessInfo.email, businessInfo.invoiceDisplayEmail,
    businessInfo.vatRegNo, businessInfo.currencySymbol, businessInfo.companyLogo,
    businessInfo.showLogoInInvoice, businessInfo.termsConditions,
    businessInfo.showCustomerSignature, businessInfo.showAuthorizedSignature,
    businessInfo.selectedFont, businessInfo.logoAlignment,
    businessInfo.showPartnerLogos, businessInfo.partnerLogos, businessInfo.presetBrands,
    tempShopName, tempShopAddress, tempShopPhone, tempShopEmail, tempInvoiceDisplayEmail, tempVatRegNo,
    tempCurrency, tempLogoBase64, tempShowLogo, tempTerms, tempShowCustSig,
    tempShowAuthSig, tempFont, tempLogoAlignment, tempShowPartners, tempPartnerLogos, tempPresetBrands
  ]);
  // Apply selected font globally to document styles
  useEffect(() => {
    const fontName = businessInfo.selectedFont || "Inter";
    document.documentElement.style.setProperty('--selected-font', `'${fontName}', sans-serif`);
  }, [businessInfo.selectedFont]);

  // Dynamically scale font size globally based on font settings
  useEffect(() => {
    let scaleVal = "100%";
    if (fontSizeScale === "Medium") scaleVal = "112.5%";
    if (fontSizeScale === "Large") scaleVal = "125%";
    document.documentElement.style.fontSize = scaleVal;
    localStorage.setItem("font_size_scale", fontSizeScale);
  }, [fontSizeScale]);

  // HTML5 Drawing Canvas Reference for client-side digital signatures
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);

  // Drawing mouse/touch triggers
  const startSignatureDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.strokeStyle = "#34d399"; // emerald-400
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawingSignature(true);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingSignature) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  };

  const stopDrawingSignature = () => {
    setIsDrawingSignature(false);
  };

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const resetPosWorkspace = (contactId?: string) => {
    setPosCart([]);
    setSelectedProductId("");
    setCartItemQty(1);
    setCartItemPrice("");
    setPosSearchQuery("");
    setShowSuggestions(false);
    setCustomerDiscount(0);
    setAmountPaidPaid("");
    setInvoiceTaxRate(0);
    setPosTerminalTab("checkout");
    if (contactId !== undefined) {
      setPosSelectedContactId(contactId);
    }
    setPosCustomDate(new Date().toISOString().split("T")[0]);
    clearSignatureCanvas();
  };

  // Add Specific Item to billing basket cart directly from product catalog view
  const addSpecificProductToCart = (prod: Product, qty: number = 1) => {
    const finalPrice = prod.sellPrice;
    const existingIdx = posCart.findIndex(item => item.product.id === prod.id);
    if (existingIdx > -1) {
      const mergedQty = posCart[existingIdx].quantity + qty;
      const updatedCart = [...posCart];
      updatedCart[existingIdx].quantity = mergedQty;
      updatedCart[existingIdx].price = finalPrice;
      setPosCart(updatedCart);
    } else {
      setPosCart([...posCart, { product: prod, quantity: qty, price: finalPrice, warranty: prod.warranty || "" }]);
    }
    triggerNotification(`${prod.name} added to cart!`);
  };

  // Add Item to Billing Basket Cart
  const addProductToCart = () => {
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) {
      triggerNotification("Please select a product first.", "error");
      return;
    }

    // Capture user edited/custom sale price if any is supplied
    const parsedCustomPrice = parseFloat(cartItemPrice);
    const finalPrice = !isNaN(parsedCustomPrice) && parsedCustomPrice >= 0 ? parsedCustomPrice : prod.sellPrice;

    // Check if product already exists in item cartridge
    const existingIdx = posCart.findIndex(item => item.product.id === prod.id);
    if (existingIdx > -1) {
      const mergedQty = posCart[existingIdx].quantity + cartItemQty;
      const updatedCart = [...posCart];
      updatedCart[existingIdx].quantity = mergedQty;
      updatedCart[existingIdx].price = finalPrice; // assign the updated price
      setPosCart(updatedCart);
    } else {
      setPosCart([...posCart, { product: prod, quantity: cartItemQty, price: finalPrice, warranty: cartItemWarranty.trim() || prod.warranty || "" }]);
    }

    triggerNotification(`${prod.name} added to checkout cart!`);
    setCartItemQty(1);
    setCartItemPrice("");
    setCartItemWarranty("");
    setSelectedProductId("");
    setPosSearchQuery("");
    setShowSuggestions(false);
  };

  const removeProductFromCart = (index: number) => {
    setSelectedProductId("");
    const removedItem = posCart[index];
    setPosCart(posCart.filter((_, idx) => idx !== index));
    triggerNotification(`${removedItem.product.name} removed from cart.`);
  };

  const updateCartQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeProductFromCart(index);
      return;
    }
    const updated = [...posCart];
    updated[index].quantity = newQty;
    setPosCart(updated);
  };

  // Total invoice calculation logic based on edited/custom item unit price
  const cartSubtotal = posCart.reduce((sum, item) => sum + ((item.price !== undefined ? item.price : item.product.sellPrice) * item.quantity), 0);
  const calculatedTaxAmount = Math.round(cartSubtotal * (invoiceTaxRate / 100));
  const invoiceGrandTotal = Math.max(0, cartSubtotal + calculatedTaxAmount - customerDiscount);

  // Auto-calculated due parameters
  const numericalPaid = Number(amountPaidPaid) || 0;
  const computedInvoiceDueBalance = Math.max(0, invoiceGrandTotal - numericalPaid);
  const paymentStatus: "paid" | "partial" | "due" = 
    numericalPaid >= invoiceGrandTotal ? "paid" : 
    numericalPaid > 0 ? "partial" : "due";

  // POS invoice generate
  const handleGenerateInvoice = async () => {
    if (posCart.length === 0) {
      triggerNotification("Your cart is empty! Cannot generate receipt.", "error");
      return;
    }

    // Extract signature png image string from drawing canvas
    let signatureStr: string | undefined = undefined;
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      // Check if signature was actually drawn (not transparent)
      const dataUrl = canvas.toDataURL("image/png");
      signatureStr = dataUrl;
    }

    // DYNAMIC UNIQUE INVOICE SERIAL NUMBER SYSTEM
    const startNum = businessInfo.startingInvoiceNumber || 1001;
    const numbers = (transactions || []).map(t => {
      if (!t || !t.invoiceNo) return 0;
      const match = String(t.invoiceNo).match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = Math.max(startNum, maxNumber + 1);
    const uniqueInvoiceNo = `INV-${nextNum}`;

    const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();
    const uniqueTxId = toUUID(`t_${Date.now()}`, cleanEmail);

    const targetDateStr = posCustomDate 
      ? new Date(posCustomDate + "T" + new Date().toTimeString().split(" ")[0]).toISOString()
      : new Date().toISOString();

    // Allocate each sold unit from the oldest available purchase-cost lot.
    // Legacy stock is represented by an opening lot at the current catalog cost.
    const fifoProductUpdates = new Map<string, any>();
    const costedCartItems = posCart.map((cartItem, idx) => {
      const productId = cartItem.product.id;
      const sourceProduct = fifoProductUpdates.get(productId) || products.find(p => p.id === productId) || cartItem.product;
      const negativeAtSale = Number(sourceProduct.stock) < Number(cartItem.quantity);
      const allocation = allocateFifoCost(sourceProduct, cartItem.quantity, targetDateStr);
      const nextProduct = {
        ...allocation.product,
        hasNegativeSale: negativeAtSale ? true : allocation.product.hasNegativeSale,
        negativeSaleUpdated: negativeAtSale ? false : allocation.product.negativeSaleUpdated
      };
      fifoProductUpdates.set(productId, nextProduct);

      const itemPrice = cartItem.price !== undefined ? cartItem.price : cartItem.product.sellPrice;
      return {
        id: toUUID(`ti_${idx}_${Date.now()}`, cleanEmail),
        name: cartItem.product.name,
        productId: toUUID(cartItem.product.id, cleanEmail),
        category: cartItem.product.category || "Uncategorized",
        quantity: cartItem.quantity,
        price: itemPrice,
        total: itemPrice * cartItem.quantity,
        buyPrice: allocation.averageUnitCost,
        costAllocations: allocation.allocations,
        warranty: cartItem.warranty || "",
        warrantyDetails: cartItem.product.warrantyDetails || "",
        isNegativeSale: negativeAtSale
      };
    });

    const newTransaction: Transaction = {
      id: uniqueTxId,
      invoiceNo: uniqueInvoiceNo,
      date: targetDateStr,
      items: costedCartItems,
      subtotal: cartSubtotal,
      tax: calculatedTaxAmount,
      discount: customerDiscount,
      total: invoiceGrandTotal,
      paymentMethod,
      status: paymentStatus,
      paidAmount: Math.min(invoiceGrandTotal, numericalPaid),
      dueBalance: computedInvoiceDueBalance,
      contactId: posSelectedContactId ? toUUID(posSelectedContactId, cleanEmail) : undefined,
      customerSignature: signatureStr
    };

    const updatedProducts = products.map((product) =>
      fifoProductUpdates.get(product.id) || product
    );

    setProducts(updatedProducts);
    setTransactions([newTransaction, ...transactions]);

    // Regenerate and update local storage keys to immediately refresh dashboard and prevent empty-item filters in subscriptions
    try {
      const activeUserId = activeUser?.uid;

      // 1. Update barakah_transactions
      const updatedTransactions = [newTransaction, ...transactions];
      localStorage.setItem(getDbKey("barakah_transactions", undefined, activeUserId), JSON.stringify(updatedTransactions));

      // 2. Update barakah_flat_transaction_items
      const rawLocalItems = localStorage.getItem(getDbKey("barakah_flat_transaction_items", undefined, activeUserId)) || "[]";
      let flatItems = JSON.parse(rawLocalItems);
      if (!Array.isArray(flatItems)) flatItems = [];

      newTransaction.items.forEach((nestedIt: any, idx: number) => {
        const itemUUID = nestedIt.id || `${newTransaction.id}_item_${idx}`;
        const productUUID = nestedIt.productId || null;

        const flatItem = {
          id: itemUUID,
          transaction_id: newTransaction.id,
          product_id: productUUID,
          product_name: nestedIt.name || "Product Item",
          quantity: Number(nestedIt.quantity) || 0,
          sell_price: Number(nestedIt.price) || 0,
          cost_price: Number(nestedIt.buyPrice) || 0,
          cost_allocations: nestedIt.costAllocations || [],
          is_negative_sale: nestedIt.isNegativeSale === true,
          is_negative_sale_approved: nestedIt.isNegativeSaleApproved === true || nestedIt.negativeSaleUpdated === true,
          warranty: nestedIt.warranty || "",
          warranty_details: nestedIt.warrantyDetails || ""
        };

        const flatIdx = flatItems.findIndex((x: any) => String(x.firestoreId || x.id || "") === String(itemUUID));
        if (flatIdx >= 0) {
          flatItems[flatIdx] = {
            ...flatItems[flatIdx],
            ...flatItem
          };
        } else {
          flatItems.push(flatItem);
        }
      });
      localStorage.setItem(getDbKey("barakah_flat_transaction_items", undefined, activeUserId), JSON.stringify(flatItems));

      // 3. Update barakah_flat_transactions
      const rawLocalTx = localStorage.getItem(getDbKey("barakah_flat_transactions", undefined, activeUserId)) || "[]";
      let flatTxList = JSON.parse(rawLocalTx);
      if (!Array.isArray(flatTxList)) flatTxList = [];

      const flatTxItem = {
        id: newTransaction.id,
        firestoreId: newTransaction.id,
        invoice_no: newTransaction.invoiceNo,
        customer_id: newTransaction.contactId || null,
        total_amount: Number(newTransaction.total) || 0,
        discount: Number(newTransaction.discount) || 0,
        vat_rate: newTransaction.tax && newTransaction.subtotal ? Number(((Number(newTransaction.tax) / Number(newTransaction.subtotal)) * 100).toFixed(2)) : 0.0,
        paid_amount: Number(newTransaction.paidAmount) || 0,
        payment_method: newTransaction.paymentMethod || "Cash",
        signature_svg: newTransaction.customerSignature || null,
        created_at: newTransaction.date || new Date().toISOString()
      };

      const txIdx = flatTxList.findIndex((x: any) => x.id === newTransaction.id);
      if (txIdx >= 0) {
        flatTxList[txIdx] = {
          ...flatTxList[txIdx],
          ...flatTxItem
        };
      } else {
        flatTxList.push(flatTxItem);
      }
      localStorage.setItem(getDbKey("barakah_flat_transactions", undefined, activeUserId), JSON.stringify(flatTxList));

      // 4. Save real-time transaction to Firestore cloud for multi-device sync
      if (activeUser && !activeUser.isGuest) {
        // Main transaction document
        await saveTransaction(activeUserId, flatTxItem);

        // Individual item records
        newTransaction.items.forEach((nestedIt: any, idx: number) => {
          const itemUUID = nestedIt.id || `${newTransaction.id}_item_${idx}`;
          const productUUID = nestedIt.productId || null;

          const flatItem = {
            id: itemUUID,
            transaction_id: newTransaction.id,
            product_id: productUUID,
            product_name: nestedIt.name || "Product Item",
            category: nestedIt.category || "Uncategorized",
            quantity: Number(nestedIt.quantity) || 0,
            sell_price: Number(nestedIt.price) || 0,
            cost_price: Number(nestedIt.buyPrice) || 0,
            cost_allocations: nestedIt.costAllocations || [],
            is_negative_sale: nestedIt.isNegativeSale === true,
            is_negative_sale_approved: nestedIt.isNegativeSaleApproved === true || nestedIt.negativeSaleUpdated === true,
            user_id: activeUserId,
            store_id: (businessInfo?.email || cleanEmail).trim().toLowerCase(),
            storeId: (businessInfo?.email || cleanEmail).trim().toLowerCase(),
            linked_email: (businessInfo?.email || cleanEmail).trim().toLowerCase(),
            email: cleanEmail
          };
          handleSave("transaction_items", activeUserId, flatItem).catch(err => {
            console.error("Cloud save transaction item failed:", err);
          });
        });

        // Updated inventory stock levels
        posCart.forEach(cartItem => {
          const targetProd = updatedProducts.find(p => p.id === cartItem.product.id || (p.sku && cartItem.product.sku === p.sku));
          if (targetProd) {
            saveProduct(activeUserId, targetProd).catch(err => {
              console.error("Cloud save product stock failed:", err);
            });
          }
        });
      }
    } catch (err) {
      console.warn("Failed to update flat items in localStorage during checkout:", err);
    }

    // Delivery assignment is now initiated directly from the Customer Card via Invoice Assign.
    try {
      generateInvoicePDF(newTransaction, contacts.find(c => c.id === newTransaction.contactId || c.id === posSelectedContactId) || undefined, businessInfo).catch(err => {
        console.error("Async error in generateInvoicePDF:", err);
      });
    } catch (pdfErr) {
      console.error("Error triggering PDF creation:", pdfErr);
    }

    // Clean Workspace states
    resetPosWorkspace("");

    triggerNotification(`Invoice ${uniqueInvoiceNo} & Delivery Challan successfully downloaded!`);
  };

  // -----------------------------------------------------------------
  // 2. INVENTORY CATALOG (Product Catalog) STATE
  // -----------------------------------------------------------------
  const [newProdName, setNewProdName] = useState("");
  const [newProdSKU, setNewProdSKU] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Groceries");
  const [newProdBuyPrice, setNewProdBuyPrice] = useState("");
  const [newProdSellPrice, setNewProdSellPrice] = useState("");
  const [newProdStock, setNewProdStock] = useState("");
  const [newProdUnit, setNewProdUnit] = useState("piece");
  const [inventorySearch, setInventorySearch] = useState("");
  const [stockSubTab, setStockSubTab] = useState<"home" | "stock-value" | "sales-value" | "out-of-stock" | "edit-stock">(() => {
    try { const v = localStorage.getItem(getDbKey("barakah_stock_subtab")); return v === "stock-value" || v === "sales-value" || v === "out-of-stock" || v === "edit-stock" ? v : "home"; }
    catch { return "home"; }
  });
  useEffect(() => { try { localStorage.setItem(getDbKey("barakah_contact_type_filter"), contactTypeFilter); } catch (_) {} }, [contactTypeFilter]);
  useEffect(() => { try { localStorage.setItem(getDbKey("barakah_duelist_filter"), duelistFilter); } catch (_) {} }, [duelistFilter]);
  useEffect(() => { try { localStorage.setItem(getDbKey("barakah_stock_subtab"), stockSubTab); } catch (_) {} }, [stockSubTab]);

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName) return;

    const generatedSKU = newProdSKU.trim() || `SKU-${Math.random().toString(36).substring(3, 8).toUpperCase()}`;
    const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();

    const parsedProduct: Product = {
      id: toUUID(`p_${Date.now()}`, cleanEmail),
      name: newProdName,
      sku: generatedSKU,
      category: newProdCategory,
      buyPrice: Number(newProdBuyPrice) || 0,
      sellPrice: Number(newProdSellPrice) || 0,
      stock: Number(newProdStock) || 0,
      unit: newProdUnit
    };
    parsedProduct.costLots = normalizeCostLots(parsedProduct);

    setProducts([...products, parsedProduct]);
    if (activeUser && !activeUser.isGuest) {
      saveProduct(activeUser.uid, parsedProduct).catch(err => {
        console.error("Cloud save product failed:", err);
      });
    }
    setNewProdName("");
    setNewProdSKU("");
    setNewProdBuyPrice("");
    setNewProdSellPrice("");
    setNewProdStock("");
    
    triggerNotification(`${parsedProduct.name} successfully added to the inventory catalog.`);
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (currentPanel !== "admin") {
      triggerNotification("Security block: Only administrators are authorized to delete products! 🛑", "error");
      return;
    }
    const p = products.find(prod => prod.id === id);
    if (!p) return;
    await deleteCloudDocument("products", id);
    if (activeUser && !activeUser.isGuest) {
      deleteProduct(id).catch(err => {});
    }
    setProducts(products.filter(item => item.id !== id));
    triggerNotification(`Product '${name}' has been successfully deleted.`, "success");
  };

  const persistBusinessInfoState = (updatedInfo: BusinessInfo) => {
    setBusinessInfo(updatedInfo);
    const compiled = { ...updatedInfo, staffList };
    const userUid = activeUser?.uid;
    const userEmail = activeUser?.email;
    const userKey = getDbKey("barakah_business_info", userEmail, userUid);
    localStorage.setItem(userKey, JSON.stringify(compiled));
    localStorage.setItem("barakah_business_info", JSON.stringify(compiled));

    if (activeUser && !activeUser.isGuest && activeUser.email) {
      saveBusinessSettings(activeUser.email, compiled).catch(err => {
        console.warn("[Cloud Save] Failed to persist business info settings:", err);
      });
    }
  };

  // Save Shop Information Block
  const handleSaveShopInfo = () => {
    const updated = {
      ...businessInfo,
      name: tempShopName,
      address: tempShopAddress,
      phoneNumber: tempShopPhone,
      email: tempShopEmail,
      vatRegNo: tempVatRegNo,
      currencySymbol: tempCurrency
    };
    persistBusinessInfoState(updated);
    triggerNotification("Shop Information changes saved successfully!", "success");
    setActiveSettingsSection("overview");
  };

  // Save Invoice Customization Config Block
  const handleSaveInvoiceConfig = () => {
    const updated = {
      ...businessInfo,
      companyLogo: tempLogoBase64,
      showLogoInInvoice: tempShowLogo,
      invoiceDisplayEmail: tempInvoiceDisplayEmail.trim(),
      termsConditions: tempTerms,
      showCustomerSignature: tempShowCustSig,
      showAuthorizedSignature: tempShowAuthSig,
      selectedInvoiceTemplate: tempInvoiceTemplate,
      logoAlignment: tempLogoAlignment,
      startingInvoiceNumber: tempStartingInvoiceNumber,
      showPartnerLogos: tempShowPartners,
      partnerLogos: tempPartnerLogos,
      presetBrands: tempPresetBrands
    };
    persistBusinessInfoState(updated);
    triggerNotification("Invoice Customization changes saved successfully!", "success");
    setActiveSettingsSection("overview");
  };

  // Save Font Settings Block
  const handleSaveFontSettings = () => {
    const updated = {
      ...businessInfo,
      selectedFont: tempFont
    };
    persistBusinessInfoState(updated);
    setFontSizeScale(tempFontSizeScale);
    localStorage.setItem("font_size_scale", tempFontSizeScale);
    triggerNotification(`Corporate typography changed to ${tempFont} and scaled to [${tempFontSizeScale}] globally!`, "success");
    setActiveSettingsSection("overview");
  };

  // Save Sales Panel Restrictions Block
  const handleSaveSalesRestrictions = () => {
    const updated = {
      ...businessInfo,
      salesmanPermissions: {
        canEditSales: tempCanEditSales,
        canDeleteSales: tempCanDeleteSales,
        canOverridePrices: tempCanOverridePrices
      }
    };
    persistBusinessInfoState(updated);
    triggerNotification("Sales Panel Restrictions saved successfully!", "success");
    setActiveSettingsSection("overview");
  };

  // Save Security Passcodes settings change
  const handleSaveSecurityPasscodes = async () => {
    const isFourDigits = (value: string) => /^\d{4}$/.test(value);

    if (!isFourDigits(currentAdminPasscode)) {
      triggerNotification("Enter your current Admin PIN to authorize this change.", "error");
      return;
    }
    if (!isFourDigits(tempAdminPasscode) || !isFourDigits(tempSalesPasscode)) {
      triggerNotification("New Admin and Sales PINs must each contain exactly 4 digits.", "error");
      return;
    }
    if (tempAdminPasscode === "1234" || tempSalesPasscode === "5555") {
      triggerNotification("Please replace the known default PINs (Admin 1234 / Sales 5555) with private PINs.", "error");
      return;
    }
    if (tempAdminPasscode === tempSalesPasscode) {
      triggerNotification("Admin PIN and Sales PIN must be different.", "error");
      return;
    }

    try {
      const firebaseUser = firebaseAuth.currentUser;
      const storeId = String(activeUser?.email || "").trim().toLowerCase();
      if (!firebaseUser || !storeId) throw new Error("Secure login session not available.");
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch("/api/panel-security/pin/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          store_id: storeId,
          current_admin_pin: currentAdminPasscode,
          current_sales_pin: String(businessInfo.salesPasscode || "5555"),
          admin_pin: tempAdminPasscode,
          sales_pin: tempSalesPasscode
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not update secure PINs.");
      }

      const updated = {
        ...businessInfo,
        adminPasscode: tempAdminPasscode,
        salesPasscode: tempSalesPasscode
      };
      persistBusinessInfoState(updated);
      setCurrentAdminPasscode("");
      if (currentPanel === "admin") setAdminActionPin(tempAdminPasscode);
      triggerNotification("Admin and Sales PINs saved securely. Use the new PINs next time you open the panels.", "success");
      setActiveSettingsSection("overview");
    } catch (error: any) {
      triggerNotification(error?.message || "PIN update failed. Please try again.", "error");
    }
  };

  // Logo upload processing inside App.tsx with Canvas-level compression and no size limits
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      triggerNotification("Scanning and compressing brand asset for offline cache...", "info");
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Compress the image
          const canvas = document.createElement("canvas");
          const max_size = 400; // Limit sizing for fast rendering and PDF embedding
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // High-quality PNG output
            const compressedBase64 = canvas.toDataURL("image/png");
            setTempLogoBase64(compressedBase64);
            triggerNotification("Logo loaded & optimized! Click 'Save Changes' to commit.", "success");
          } else {
            // fallback if canvas context fails
            setTempLogoBase64(reader.result as string);
            triggerNotification("Logo loaded without compression fallback.", "info");
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setTempLogoBase64("");
    triggerNotification("Logo cleared! Click 'Save Changes' to update.", "info");
  };

  // Execute destruction commands
  const executeDangerAction = () => {
    if (!dangerAction) return;

    if (dangerAction === "delete_transactions") {
      setTransactions([]);
      setPurchases([]);
      setExpenses([]);
      triggerNotification("Wiped all transactions, purchases, and expenses completely.", "success");
    } else if (dangerAction === "delete_customers") {
      setContacts(contacts.filter(c => c.type !== "customer"));
      triggerNotification("Customer profiles database has been completely cleared.", "success");
    } else if (dangerAction === "reset_app") {
      const resetBusiness = {
        ...INITIAL_BUSINESS_INFO,
        isExplicitReset: true
      };
      setProducts(INITIAL_PRODUCTS);
      setContacts(INITIAL_CONTACTS);
      setExpenses(INITIAL_EXPENSES);
      setPurchases(INITIAL_PURCHASES);
      setTransactions([]);
      setBusinessInfo(resetBusiness);

      if (activeUser && !activeUser.isGuest) {
        const passcode = activeUser.isPasscodeUser ? (activeUser.passcode || "1234") : "classic_account_secure";
        triggerNotification("Invalidating database structures. Performing full secure cloud wipe...", "info");
        uploadPasscodeBackup(activeUser.email, passcode, {
          products: INITIAL_PRODUCTS,
          contacts: INITIAL_CONTACTS,
          expenses: INITIAL_EXPENSES,
          transactions: [],
          businessInfo: resetBusiness,
          purchases: INITIAL_PURCHASES
        }).then(() => {
          setTimeout(() => {
            setBusinessInfo(INITIAL_BUSINESS_INFO);
          }, 4000);
          triggerNotification("System database and all paired devices successfully reset! 🟢", "success");
        }).catch(e => {
          console.error("Cloud reset failed:", e);
          triggerNotification("Local database reset, but cloud sync encountered an issue.", "error");
        });
      } else {
        triggerNotification("System reset successful. Restored defaults completely.", "success");
      }
    } else if (dangerAction === "delete_account") {
      if (activeUser) {
        const uid = activeUser.uid;
        const email = activeUser.email?.trim().toLowerCase();

        // 1. Permanently delete from local storage specifically for this user to protect other users on this shared terminal
        const localKeys = Object.keys(localStorage);
        localKeys.forEach((key) => {
          const lowerKey = key.toLowerCase();
          if (
            (uid && key.includes(uid)) ||
            (email && lowerKey.includes(email))
          ) {
            localStorage.removeItem(key);
          }
        });

        // 2. Also wipe cloud backup to adhere to the account deletion promise
        if (!activeUser.isGuest) {
          const passcode = activeUser.isPasscodeUser ? (activeUser.passcode || "1234") : "classic_account_secure";
          uploadPasscodeBackup(activeUser.email, passcode, {
            products: [],
            contacts: [],
            expenses: [],
            transactions: [],
            businessInfo: { isExplicitReset: true, name: "Deleted Account" },
            purchases: []
          }).catch(err => {
            console.warn("[Account Delete] Failed to overwrite cloud backup doc:", err);
          });
        }
      }

      setProducts(INITIAL_PRODUCTS);
      setContacts(INITIAL_CONTACTS);
      setExpenses(INITIAL_EXPENSES);
      setPurchases(INITIAL_PURCHASES);
      setTransactions([]);
      setBusinessInfo(INITIAL_BUSINESS_INFO);
      handleLogOut();
      triggerNotification("User account and database state permanently cleared.", "success");
    }

    setDangerAction(null);
    setDangerConfirmText("");
  };

  // Replenish stock count with an explicit FIFO cost layer at the current catalog cost.
  const incrementProductStock = (id: string) => {
    const lotId = `manual-increment-${id}-${Date.now()}`;
    const updatedProducts = products.map((product) => {
      if (product.id !== id) return product;
      const nextP = addManualCostLot(product, 10, product.buyPrice, lotId);
      if (activeUser && !activeUser.isGuest) {
        saveProduct(activeUser.uid, nextP).catch(err => console.error("Manual stock adjustment sync failed:", err));
      }
      return nextP;
    });
    setProducts(updatedProducts);
    triggerNotification("10 units added to product stock successfully.");
  };

  const handleUpdatePricing = (id: string, buyPrice: number, sellPrice: number, addStock?: number) => {
    const matchedProd = products.find(p => p.id === id);
    const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();
    const targetUid = firebaseAuth.currentUser?.uid || activeUser?.uid;

    let manualPurchase: any = null;
    if (addStock && addStock > 0) {
      const invoiceNo = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
      manualPurchase = {
        id: toUUID(`pur_${Date.now()}`, cleanEmail),
        productId: toUUID(id, cleanEmail),
        productName: matchedProd ? matchedProd.name : "Reconciled Item",
        supplierId: "",
        supplierName: "Manual Adjustment",
        quantity: addStock,
        buyPrice: buyPrice,
        totalAmount: addStock * buyPrice,
        invoiceNo: invoiceNo,
        date: new Date().toISOString()
      };
      setPurchases(prev => [manualPurchase, ...prev]);
      if (activeUser && !activeUser.isGuest && targetUid) {
        savePurchase(targetUid, manualPurchase).catch(err => {
          console.error("Cloud save purchase failed:", err);
        });
      }
    }

    const updatedProds = products.map(p => {
      if (p.id === id) {
        const baseProduct = { ...p, buyPrice, sellPrice };
        const withStock = manualPurchase
          ? addPurchaseCostLot(baseProduct, manualPurchase)
          : { ...baseProduct, stock: p.stock + (addStock || 0) };
        const nextStock = withStock.stock;
        const isStillNegative = nextStock < 0;
        const nextP = {
          ...withStock,
          hasNegativeSale: isStillNegative,
          negativeSaleUpdated: true
        };
        if (activeUser && !activeUser.isGuest && targetUid) {
          saveProduct(targetUid, nextP).catch(err => {
            console.error("Cloud save product stock failed:", err);
          });
        }
        return nextP;
      }
      return p;
    });
    setProducts(updatedProds);
    triggerNotification("Product stock and price configurations successfully updated.");
  };

  const handleClearProductShortage = (id: string) => {
    const productToAdjust = products.find(product => product.id === id);
    if (!productToAdjust || Number(productToAdjust.stock || 0) >= 0) return;

    const updatedProducts = products.map(product => {
      if (product.id !== id) return product;
      const nextProduct = { ...product, stock: 0 };
      if (activeUser && !activeUser.isGuest) {
        const targetUid = firebaseAuth.currentUser?.uid || activeUser.uid;
        saveProduct(targetUid, nextProduct).catch(err => {
          console.error("Failed to clear product stock shortage:", err);
          triggerNotification("Stock update could not be synced. Please refresh and check again.", "error");
        });
      }
      return nextProduct;
    });

    setProducts(updatedProducts);
    triggerNotification(`${productToAdjust.name}: shortage cleared and stock set to 0.`, "success");
  };

  const handleMarkNegativeSaleUpdated = (id: string, updated: boolean) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          hasNegativeSale: true,
          negativeSaleUpdated: updated
        };
      }
      return p;
    }));
    triggerNotification(updated ? "Product negative stock marked as green / updated! 🟢" : "Product negative stock reset to red.", "success");
  };

  const persistTransactionItemCost = async (txId: string, itemIdx: number, updatedTransactions: any[]): Promise<boolean> => {
    const targetTx = updatedTransactions.find(t => t.id === txId);
    const item = targetTx?.items?.[itemIdx];
    if (!item) return false;

    const itemId = item.firestoreId || item.id || `${txId}_item_${itemIdx}`;
    const activeUserId = activeUser?.uid || "";
    const storeEmail = (businessInfo?.email || activeUser?.email || "").trim().toLowerCase();
    const flatItem = {
      id: itemId,
      transaction_id: txId,
      product_id: item.productId || null,
      product_name: item.name || "Product Item",
      quantity: Number(item.quantity) || 0,
      sell_price: Number(item.price) || 0,
      cost_price: Number(item.buyPrice) || 0,
      cost_allocations: item.costAllocations || [],
      is_negative_sale: item.isNegativeSale === true,
      is_negative_sale_approved: item.isNegativeSaleApproved === true || item.negativeSaleUpdated === true,
      ...(activeUserId ? { user_id: activeUserId, owner_id: activeUserId } : {}),
      ...(storeEmail ? { store_id: storeEmail, storeId: storeEmail, linked_email: storeEmail, email: storeEmail } : {})
    };

    try {
      if (activeUser && !activeUser.isGuest) {
        await setDoc(doc(db, "transaction_items", itemId), flatItem, { merge: true });
      }
    } catch (e) {
      console.error("Failed to update transaction item cost in Firestore:", e);
      triggerNotification("Cost update could not be synchronized to the cloud. The local change is retained; please retry sync before relying on the updated report.", "error");
      return false;
    }

    try {
      const rawLocalItems = localStorage.getItem(getDbKey("barakah_flat_transaction_items", undefined, activeUserId)) || "[]";
      let flatItems = JSON.parse(rawLocalItems);
      if (!Array.isArray(flatItems)) flatItems = [];
      const flatIdx = flatItems.findIndex((entry: any) =>
        String(entry.firestoreId || entry.id || "") === String(itemId)
      );
      if (flatIdx >= 0) flatItems[flatIdx] = { ...flatItems[flatIdx], ...flatItem };
      else flatItems.push(flatItem);

      localStorage.setItem(getDbKey("barakah_flat_transaction_items", undefined, activeUserId), JSON.stringify(flatItems));
      localStorage.setItem(getDbKey("barakah_transactions", undefined, activeUserId), JSON.stringify(updatedTransactions));
    } catch (err) {
      console.warn("Failed to update unit cost in localStorage:", err);
    }
    return true;
  };

  const handleUpdateTransactionItemBuyPrice = async (txId: string, itemIdx: number, newBuyPrice: number, isApproved?: boolean, productId?: string) => {
    if (!Number.isFinite(newBuyPrice) || newBuyPrice < 0) return;
    const updatedTransactions = transactions.map(t => {
      if (t.id !== txId) return t;
      const updatedItems = t.items.map((it, idx) => {
        if (idx !== itemIdx) return it;
        return {
          ...updateAllCostAllocations(it, newBuyPrice),
          isNegativeSaleApproved: isApproved !== undefined ? isApproved : it.isNegativeSaleApproved,
          negativeSaleUpdated: isApproved !== undefined ? isApproved : it.negativeSaleUpdated
        };
      });
      return { ...t, items: updatedItems };
    });

    const saved = await persistTransactionItemCost(txId, itemIdx, updatedTransactions);
    setTransactions(updatedTransactions);

    // The negative-stock editor's optional checkbox updates only the catalog
    // default. It never overwrites any other sold unit's saved cost.
    if (productId) {
      const updatedProducts = products.map(product => {
        if (product.id !== productId) return product;
        const nextProduct = { ...product, buyPrice: newBuyPrice };
        if (activeUser && !activeUser.isGuest) {
          saveProduct(activeUser.uid, nextProduct).catch(err =>
            console.error("Failed to update catalog default cost:", err)
          );
        }
        return nextProduct;
      });
      setProducts(updatedProducts);
    }

    if (saved) triggerNotification("Transaction item cost specified and approved! Net profit recalculated instantly.", "success");
  };

  const handleUpdateTransactionItemUnitCost = async (txId: string, itemIdx: number, allocationIdx: number, newUnitCost: number) => {
    if (!Number.isFinite(newUnitCost) || newUnitCost < 0) return;

    const updatedTransactions = transactions.map(t => {
      if (t.id !== txId) return t;
      const updatedItems = t.items.map((it, idx) =>
        idx === itemIdx ? updateOneCostAllocation(it, allocationIdx, newUnitCost) : it
      );
      return { ...t, items: updatedItems };
    });

    const saved = await persistTransactionItemCost(txId, itemIdx, updatedTransactions);
    setTransactions(updatedTransactions);
    if (saved) triggerNotification("Only the selected unit's cost price was updated.", "success");
  };

  const handleNavigateToCustomer = (customerName: string) => {
    setContactSearchQuery(customerName);
    setContactTypeFilter("customer");
    setActiveTab("contacts");
    triggerNotification(`Displaying profile detail file of customer: ${customerName}`, "info");
  };

  const handleNavigateToInvoice = (invoiceNo: string) => {
    setLedgerSearch(invoiceNo);
    setLedgerStatusFilter("all");
    setActiveTab("ledger");
    triggerNotification(`Displaying account transaction details of invoice: ${invoiceNo}`, "info");
  };

  const handleAddPurchase = (pur: any) => {
    const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();
    const prodObj = products.find(p => p.id === pur.productId);
    const supObj = contacts.find(c => c.id === pur.supplierId);
    const targetUid = firebaseAuth.currentUser?.uid || activeUser?.uid;
    
    const newPur: Purchase = {
      id: toUUID(`pur_${Date.now()}`, cleanEmail),
      productId: pur.productId ? toUUID(pur.productId, cleanEmail) : "",
      productName: prodObj ? prodObj.name : "Unknown Product",
      supplierId: pur.supplierId,
      supplierName: supObj ? supObj.name : (pur.supplierId === "walk-in-supplier" ? "Walk-in Supplier" : "Unknown Supplier"),
      quantity: pur.quantity,
      buyPrice: pur.unitPrice,
      totalAmount: pur.totalAmount,
      date: pur.date,
      cashPaid: pur.cashPaid,
      dueAmount: pur.dueAmount,
      invoiceNo: pur.invoiceNo,
      note: pur.note,
      originallyCredit: pur.dueAmount > 0
    };
    setPurchases([newPur, ...purchases]);
    if (activeUser && !activeUser.isGuest && targetUid) {
      savePurchase(targetUid, newPur).catch(err => {
        console.error("Cloud save purchase failed:", err);
      });
    }

    const updatedProds = products.map(p => {
      if (p.id === pur.productId) {
        const updatedSellPrice = pur.updatedSellPrice !== undefined ? Number(pur.updatedSellPrice) : p.sellPrice;
        const withCostLot = addPurchaseCostLot(p, newPur);
        const nextP = {
          ...withCostLot,
          sellPrice: !isNaN(updatedSellPrice) ? updatedSellPrice : p.sellPrice
        };
        if (activeUser && !activeUser.isGuest && targetUid) {
          saveProduct(targetUid, nextP).catch(err => {
            console.error("Cloud save product stock after purchase failed:", err);
          });
        }
        return nextP;
      }
      return p;
    });
    setProducts(updatedProds);
    triggerNotification(`Purchase Order ${pur.invoiceNo} logged. Initial purchase rate updated.`);
  };

  const handleDeletePurchase = async (id: string) => {
    if (currentPanel !== "admin") {
      triggerNotification("Security block: Only administrators are authorized to delete purchases! 🛑", "error");
      return;
    }
    const matchingPur = purchases.find(p => p.id === id);
    if (!matchingPur) return;

    const purchaseProduct = products.find(p => p.id === matchingPur.productId);
    const trackedLot = purchaseProduct?.costLots?.find((lot: any) =>
      lot.id === id || lot.purchaseId === id
    );
    if (trackedLot) {
      const soldFromLot = Math.max(0, Number(trackedLot.receivedQuantity || 0) - Number(trackedLot.remainingQuantity || 0));
      if (soldFromLot > 0.000001) {
        triggerNotification("This purchase batch has already supplied sold units. It cannot be deleted because that would break the sales cost history.", "error");
        return;
      }
    } else {
      const productHasSales = transactions.some(tx =>
        Array.isArray(tx.items) && tx.items.some(item =>
          item.productId === matchingPur.productId && Number(item.quantity) > 0
        )
      );
      if (productHasSales) {
        triggerNotification("This product has historical sales but this purchase has no FIFO lot history. Deletion is blocked to protect stock and past cost records.", "error");
        return;
      }
    }

    const targetUid = firebaseAuth.currentUser?.uid || activeUser?.uid;
    await deleteCloudDocument("purchases", id);
    if (activeUser && !activeUser.isGuest) {
      deletePurchase(id).catch(err => {});
    }
    setPurchases(purchases.filter(p => p.id !== id));

    const updatedProds = products.map(p => {
      if (p.id !== matchingPur.productId) return p;
      const hadTrackedLot = Array.isArray(p.costLots) && p.costLots.some((lot: any) => lot.id === id || lot.purchaseId === id);
      const removedLotProduct = removePurchaseCostLot(p, id);
      if (!removedLotProduct) return p;
      const nextP = hadTrackedLot
        ? removedLotProduct
        : { ...removedLotProduct, stock: Math.max(0, Number(p.stock || 0) - Number(matchingPur.quantity || 0)) };
      if (activeUser && !activeUser.isGuest && targetUid) {
        saveProduct(targetUid, nextP).catch(err => {});
      }
      return nextP;
    });
    setProducts(updatedProds);
    triggerNotification("Purchase record has been successfully deleted and inventory adjusted.", "success");
  };

  const handleEditPurchase = (id: string, updatedFields: any) => {
    const originalPur = purchases.find(p => p.id === id);
    if (!originalPur) return;
    const targetUid = firebaseAuth.currentUser?.uid || activeUser?.uid;
    const updatedPur = {
      ...originalPur,
      ...updatedFields,
      productId: updatedFields.productId ?? originalPur.productId,
      quantity: Number(updatedFields.quantity ?? originalPur.quantity),
      buyPrice: Number(updatedFields.unitPrice ?? updatedFields.buyPrice ?? originalPur.buyPrice),
      totalAmount: Number(updatedFields.totalAmount ?? (Number(updatedFields.quantity ?? originalPur.quantity) * Number(updatedFields.unitPrice ?? originalPur.buyPrice))),
      cashPaid: Number(originalPur.cashPaid ?? 0),
      dueAmount: Math.max(
        0,
        Number(updatedFields.totalAmount ?? (Number(updatedFields.quantity ?? originalPur.quantity) * Number(updatedFields.unitPrice ?? originalPur.buyPrice))) -
          Number(originalPur.cashPaid ?? 0)
      )
    };

    const originalProduct = products.find(prod => prod.id === originalPur.productId);
    const originalLot = originalProduct?.costLots?.find((lot: any) => lot.id === id || lot.purchaseId === id);
    const lotSoldQuantity = originalLot
      ? Math.max(0, Number(originalLot.receivedQuantity || 0) - Number(originalLot.remainingQuantity || 0))
      : 0;

    if (originalLot && updatedPur.productId !== originalPur.productId && lotSoldQuantity > 0.000001) {
      triggerNotification("This purchase batch has already supplied sold units. Its product cannot be changed because that would break FIFO cost history.", "error");
      return;
    }

    if (originalLot && updatedPur.productId === originalPur.productId) {
      const checkedUpdate = updatePurchaseCostLot(originalProduct, id, updatedPur);
      if (!checkedUpdate) {
        triggerNotification("Purchase quantity cannot be reduced below the quantity already sold from this batch.", "error");
        return;
      }
    } else if (!originalLot) {
      const productHasSales = transactions.some(tx =>
        Array.isArray(tx.items) && tx.items.some(item =>
          item.productId === originalPur.productId && Number(item.quantity) > 0
        )
      );
      const changesCostHistory =
        updatedPur.productId !== originalPur.productId ||
        updatedPur.quantity !== Number(originalPur.quantity) ||
        updatedPur.buyPrice !== Number(originalPur.buyPrice);
      if (productHasSales && changesCostHistory) {
        triggerNotification("This product has historical sales but this purchase has no FIFO lot history. Product, quantity, and buy-cost edits are blocked to protect past sale costs.", "error");
        return;
      }
    }

    setPurchases(purchases.map(p => p.id === id ? updatedPur : p));
    if (activeUser && !activeUser.isGuest && targetUid) {
      savePurchase(targetUid, updatedPur).catch(err => {});
    }

    const updatedProds = products.map(prod => {
      if (updatedPur.productId === originalPur.productId && prod.id === originalPur.productId) {
        if (originalLot) {
          const nextP = updatePurchaseCostLot(prod, id, updatedPur) || prod;
          if (activeUser && !activeUser.isGuest && targetUid) saveProduct(targetUid, nextP).catch(err => {});
          return nextP;
        }
        const nextP = {
          ...prod,
          stock: Number(prod.stock || 0) - Number(originalPur.quantity || 0) + Number(updatedPur.quantity || 0),
          buyPrice: updatedPur.buyPrice
        };
        if (activeUser && !activeUser.isGuest && targetUid) saveProduct(targetUid, nextP).catch(err => {});
        return nextP;
      }

      if (updatedPur.productId !== originalPur.productId && prod.id === originalPur.productId) {
        const nextP = originalLot
          ? removePurchaseCostLot(prod, id)
          : { ...prod, stock: Math.max(0, Number(prod.stock || 0) - Number(originalPur.quantity || 0)) };
        if (nextP && activeUser && !activeUser.isGuest && targetUid) saveProduct(targetUid, nextP).catch(err => {});
        return nextP || prod;
      }

      if (updatedPur.productId !== originalPur.productId && prod.id === updatedPur.productId) {
        const nextP = originalLot
          ? addPurchaseCostLot(prod, updatedPur)
          : {
              ...prod,
              stock: Number(prod.stock || 0) + Number(updatedPur.quantity || 0),
              buyPrice: updatedPur.buyPrice
            };
        if (activeUser && !activeUser.isGuest && targetUid) saveProduct(targetUid, nextP).catch(err => {});
        return nextP;
      }
      return prod;
    });
    setProducts(updatedProds);

    triggerNotification("Purchase record corrected and stock level adjusted successfully.");
  };

  const handleReturnPurchase = (id: string, returnQty: number) => {
    const pur = purchases.find(p => p.id === id);
    if (!pur) return;

    const matchedProduct = products.find(p => p.id === pur.productId);
    const availableStock = matchedProduct ? matchedProduct.stock : 0;

    if (returnQty > availableStock) {
      triggerNotification(`Not enough item stock in warehouse! Available stock is ${availableStock} pcs, cannot return ${returnQty} pcs.`, "error");
      return;
    }

    const trackedLot = matchedProduct?.costLots?.find((lot: any) => lot.id === id || lot.purchaseId === id);
    let nextTrackedProduct: any = null;
    if (trackedLot && matchedProduct) {
      nextTrackedProduct = returnPurchaseCostLot(matchedProduct, id, returnQty);
      if (!nextTrackedProduct) {
        triggerNotification("This purchase batch does not have enough unsold units available to return. Already-sold units cannot be returned to the supplier.", "error");
        return;
      }
    }

    const returnVal = parseFloat((returnQty * pur.buyPrice).toFixed(2));
    const oldDue = pur.dueAmount || 0;
    const nextDue = Math.max(0, parseFloat((oldDue - returnVal).toFixed(2)));
    const nextTotal = Math.max(0, parseFloat((pur.totalAmount - returnVal).toFixed(2)));
    const refundCash = Math.max(0, parseFloat((returnVal - oldDue).toFixed(2)));
    const nextCashPaid = Math.max(0, parseFloat(((pur.cashPaid || 0) - refundCash).toFixed(2)));

    const updatedProducts = products.map(product => {
      if (product.id !== pur.productId) return product;
      const nextP = trackedLot && nextTrackedProduct
        ? nextTrackedProduct
        : { ...product, stock: Math.max(0, product.stock - returnQty) };
      if (activeUser && !activeUser.isGuest) {
        saveProduct(activeUser.uid, nextP).catch(err => console.error("Purchase return stock sync failed:", err));
      }
      return nextP;
    });
    setProducts(updatedProducts);

    const updatedPurchases = purchases.map(item => {
      if (item.id !== pur.id) return item;
      const nextQty = Math.max(0, item.quantity - returnQty);
      return {
        ...item,
        quantity: nextQty,
        totalAmount: nextTotal,
        dueAmount: nextDue,
        cashPaid: nextCashPaid,
        note: (item.note || "") + ` [Returned ${returnQty} pcs on ${safeFormat(new Date(), "dd-MM-yyyy")}]`
      };
    });
    setPurchases(updatedPurchases);
    const updatedPurchase = updatedPurchases.find(item => item.id === pur.id);
    if (updatedPurchase && activeUser && !activeUser.isGuest) {
      savePurchase(activeUser.uid, updatedPurchase).catch(err => console.error("Purchase return ledger sync failed:", err));
    }

    triggerNotification(`Successfully returned ${returnQty} units of ${pur.productName}. Purchase/Due balance reduced by ${businessInfo.currencySymbol} ${returnVal.toLocaleString()}!`, "success");
  };

  // -----------------------------------------------------------------
  // 3. LEDGER TRANSACTION ACCOUNTING WORKSPACE STATE
  // -----------------------------------------------------------------
  const [ledgerSearch, setLedgerSearch] = useState(() => {
    try {
      return localStorage.getItem(getDbKey("barakah_ledger_search")) || "";
    } catch {
      return "";
    }
  });
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<string>(() => {
    try {
      return localStorage.getItem(getDbKey("barakah_ledger_status_filter")) || "all";
    } catch {
      return "all";
    }
  });

  const [ledgerDateFilterType, setLedgerDateFilterType] = useState<"all" | "today" | "yesterday" | "weekly" | "monthly" | "yearly" | "custom">(() => {
    try {
      const saved = localStorage.getItem(getDbKey("barakah_ledger_date_filter"));
      return saved === "all" || saved === "today" || saved === "yesterday" || saved === "weekly" || saved === "monthly" || saved === "yearly" || saved === "custom" ? saved : "all";
    } catch { return "all"; }
  });
  const [ledgerStartDate, setLedgerStartDate] = useState(() => {
    try { return localStorage.getItem(getDbKey("barakah_ledger_start_date")) || safeFormat(safeSubDays(new Date(), 30), "yyyy-MM-dd"); }
    catch { return safeFormat(safeSubDays(new Date(), 30), "yyyy-MM-dd"); }
  });
  const [ledgerEndDate, setLedgerEndDate] = useState(() => {
    try { return localStorage.getItem(getDbKey("barakah_ledger_end_date")) || safeFormat(new Date(), "yyyy-MM-dd"); }
    catch { return safeFormat(new Date(), "yyyy-MM-dd"); }
  });
  const [ledgerCurrentPage, setLedgerCurrentPage] = useState(() => {
    try { const saved = Number(localStorage.getItem(getDbKey("barakah_ledger_current_page"))); return Number.isInteger(saved) && saved > 0 ? saved : 1; }
    catch { return 1; }
  });
  const ledgerPageSize = 10;

  useEffect(() => {
    const handler = setTimeout(() => {
      try {
        localStorage.setItem(getDbKey("barakah_ledger_search"), ledgerSearch);
      } catch (e) {
        console.error("Failed to save ledger search to localStorage", e);
      }
    }, 450);
    return () => clearTimeout(handler);
  }, [ledgerSearch]);

  useEffect(() => {
    try { localStorage.setItem(getDbKey("barakah_ledger_status_filter"), ledgerStatusFilter); } catch (_) {}
  }, [ledgerStatusFilter]);

  useEffect(() => {
    try { localStorage.setItem(getDbKey("barakah_ledger_date_filter"), ledgerDateFilterType); } catch (_) {}
  }, [ledgerDateFilterType]);

  useEffect(() => {
    try { localStorage.setItem(getDbKey("barakah_ledger_start_date"), ledgerStartDate); } catch (_) {}
  }, [ledgerStartDate]);

  useEffect(() => {
    try { localStorage.setItem(getDbKey("barakah_ledger_end_date"), ledgerEndDate); } catch (_) {}
  }, [ledgerEndDate]);

  useEffect(() => {
    try { localStorage.setItem(getDbKey("barakah_ledger_current_page"), String(ledgerCurrentPage)); } catch (_) {}
  }, [ledgerCurrentPage]);

  const incrementDuePayment = (invoiceNo: string, collectionAmt: number) => {
    if (!Number.isFinite(collectionAmt) || collectionAmt <= 0) return;

    const targetTx = transactions.find(t => t.invoiceNo === invoiceNo);
    if (!targetTx) return;

    const outstanding = Math.max(0, Number(targetTx.total) - Number(targetTx.paidAmount || 0));
    if (collectionAmt > outstanding) {
      triggerNotification(`Collection amount exceeds the outstanding due of ${businessInfo.currencySymbol} ${outstanding.toLocaleString()}.`, "error");
      return;
    }

    const newPaid = Math.min(Number(targetTx.total) || 0, (Number(targetTx.paidAmount) || 0) + collectionAmt);
    const newDue = Math.max(0, (Number(targetTx.total) || 0) - newPaid);
    const paymentHistory = [
      ...(Array.isArray(targetTx.paymentHistory) ? targetTx.paymentHistory : []),
      {
        id: `pay_${Date.now()}_${targetTx.id}`,
        amount: collectionAmt,
        date: format(new Date(), "yyyy-MM-dd"),
        recordedAt: new Date().toISOString()
      }
    ];

    const updatedTransactions = transactions.map(t => t.id === targetTx.id
      ? {
          ...t,
          paidAmount: newPaid,
          dueBalance: newDue,
          paymentHistory,
          status: newDue === 0 ? "paid" : "partial"
        }
      : t
    );
    setTransactions(updatedTransactions);

    if (activeUser && !activeUser.isGuest) {
      const activeUserId = activeUser.uid;
      const flatTxItem = {
        id: targetTx.id,
        firestoreId: targetTx.firestoreId || targetTx.id,
        invoice_no: targetTx.invoiceNo,
        customer_id: targetTx.contactId || null,
        total_amount: Number(targetTx.total) || 0,
        subtotal: Number(targetTx.subtotal) || 0,
        tax_amount: Number(targetTx.tax) || 0,
        discount: Number(targetTx.discount) || 0,
        vat_rate: targetTx.tax && targetTx.subtotal ? Number(((Number(targetTx.tax) / Number(targetTx.subtotal)) * 100).toFixed(2)) : 0.0,
        paid_amount: Number(newPaid) || 0,
        payment_history: paymentHistory,
        payment_method: targetTx.paymentMethod || "Cash",
        signature_svg: targetTx.customerSignature || null,
        created_at: targetTx.date || new Date().toISOString()
      };
      saveTransaction(activeUserId, flatTxItem).catch(err => {
        console.error("Cloud save increment due payment failed:", err);
        triggerNotification("Payment was added locally but cloud sync failed. Please retry synchronization.", "error");
      });
    }

    triggerNotification(`Invoice ${invoiceNo}: ${collectionAmt.toLocaleString()} ${businessInfo.currencySymbol} received and recorded.`);
  };

  const removeDeliveryAssignmentsForTransactions = async (transactionIds: string[]) => {
    const ids = Array.from(new Set(transactionIds.map(id => String(id || "").trim()).filter(Boolean)));
    const user = firebaseAuth.currentUser;
    if (!ids.length || !user || !activeUser || activeUser.isGuest || !adminActionPin) return;
    const token = await user.getIdToken();
    const response = await fetch("/api/delivery/assignments/remove-ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ store_id: String(activeUser.email || "").trim().toLowerCase(), admin_pin: adminActionPin, transaction_ids: ids })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not remove linked invoice assignments.");
    return result;
  };

  const handleDeleteTransaction = async (id: string) => {
    if (currentPanel !== "admin") {
      triggerNotification("Security block: Only administrators are authorized to delete transactions / sales! 🛑", "error");
      return;
    }
    const t = transactions.find(item => item.id === id);
    if (!t) return;

    await deleteCloudDocument("transactions", t.firestoreId ?? t.id);
    try {
      await removeDeliveryAssignmentsForTransactions([t.firestoreId ?? t.id, t.id]);
    } catch (error) {
      console.warn("[Ledger] Linked delivery assignment cleanup will retry on Delivery Management load:", error);
    }

    if (activeUser && !activeUser.isGuest) {
      deleteTransaction(id).catch(err => {});
      if (Array.isArray(t.items)) {
        t.items.forEach(item => {
          if (item.id) {
            deleteDoc(doc(db, "transaction_items", item.firestoreId || item.id)).catch(err => {});
          }
        });
      }
    }

    // Restore each sold unit to the same FIFO lot it originally came from.
    const restoredProducts = products.map(prod => {
      const soldItems = (Array.isArray(t.items) ? t.items : []).filter(item =>
        item.productId === prod.id || item.id === prod.id
      );
      if (soldItems.length === 0) return prod;

      let nextP: any = prod;
      soldItems.forEach(soldItem => {
        nextP = restoreFifoCost(nextP, soldItem);
      });
      if (activeUser && !activeUser.isGuest) {
        saveProduct(activeUser.uid, nextP).catch(err => {});
      }
      return nextP;
    });

    setProducts(restoredProducts);
    setTransactions(transactions.filter(item => item.id !== id));
    triggerNotification(`Invoice ${t.invoiceNo} has been successfully deleted.`, "success");
  };

  const handleDeleteTransactionItem = (transactionId: string, itemIndex: number) => {
    if (currentPanel !== "admin") {
      triggerNotification("Security block: Only administrators are authorized to delete individual sale items! 🛑", "error");
      return;
    }
    const targetTx = transactions.find(t => t.id === transactionId);
    if (!targetTx || !Array.isArray(targetTx.items) || targetTx.items.length <= 1) {
      triggerNotification("A transaction must keep at least one product line. To remove the whole invoice, use the transaction delete action.", "info");
      return;
    }
    const normalizedItems = targetTx.items.map((entry: any, index: number, allItems: any[]) => {
      const identity = String(entry.firestoreId || entry.id || "");
      const identityCount = allItems.filter((candidate: any) =>
        String(candidate.firestoreId || candidate.id || "") === identity
      ).length;
      return !identity || identityCount > 1
        ? { ...entry, id: `${transactionId}_line_${index}_${Date.now()}` }
        : entry;
    });
    const item = normalizedItems[itemIndex];
    if (!item) return;
    if (!window.confirm("Remove \"" + item.name + "\" from Invoice " + targetTx.invoiceNo + "? Only this product line will be removed; the invoice and other items will remain.")) return;
    const updatedItems = normalizedItems.filter((_, idx) => idx !== itemIndex);
    handleEditTransaction(transactionId, { items: updatedItems });
    setEditingTx(prev => prev && prev.id === transactionId ? { ...prev, items: updatedItems } : prev);
  };

  const handleEditTransaction = async (id: string, updatedFields: Partial<Transaction>) => {
    if (currentPanel !== "admin" && currentPanel !== "sales") {
      triggerNotification("Security block: Unauthorized action! 🛑", "error");
      return;
    }
    const originalTx = transactions.find(t => t.id === id);
    if (!originalTx) return;

    // Give each invoice line a stable identity independent of its product/model ID.
    const ensureUniqueLineIdentities = (sourceItems: any[]) => {
      const seen = new Set<string>();
      return (Array.isArray(sourceItems) ? sourceItems : []).map((sourceItem, index) => {
        const item = { ...sourceItem };
        const identity = String(item.firestoreId || item.id || "");
        if (!identity || seen.has(identity)) {
          item.id = `${id}_line_${index}_${Date.now()}`;
        }
        seen.add(String(item.firestoreId || item.id));
        return item;
      });
    };
    const originalItems = ensureUniqueLineIdentities(originalTx.items || []);
    const requestedItems = ensureUniqueLineIdentities(updatedFields.items || originalItems);
    const workingProducts = products.map(product => ({ ...product }));
    const costedItems: any[] = requestedItems.map(item => ({ ...item }));
    const matchedRequested = new Set<number>();
    const needsAllocation = new Set<number>();
    const findWorkingProduct = (productId?: string) => workingProducts.find(product => product.id === productId);
    const replaceWorkingProduct = (nextProduct: any) => {
      const index = workingProducts.findIndex(product => product.id === nextProduct.id);
      if (index >= 0) workingProducts[index] = nextProduct;
    };

    // Keep unchanged sold units attached to their original purchase lots.
    // Return removed/reduced units to their source lot before allocating any additions.
    originalItems.forEach(oldItem => {
      const oldIdentity = String(oldItem.firestoreId || oldItem.id || "");
      const newIndex = requestedItems.findIndex((candidate: any, index: number) =>
        !matchedRequested.has(index) &&
        oldIdentity !== "" &&
        String(candidate.firestoreId || candidate.id || "") === oldIdentity
      );

      if (newIndex < 0) {
        const oldProduct = findWorkingProduct(oldItem.productId);
        if (oldProduct) replaceWorkingProduct(restoreFifoCost(oldProduct, oldItem));
        return;
      }

      const candidate = requestedItems[newIndex];
      if (candidate.productId !== oldItem.productId) {
        const oldProduct = findWorkingProduct(oldItem.productId);
        if (oldProduct) replaceWorkingProduct(restoreFifoCost(oldProduct, oldItem));
        needsAllocation.add(newIndex);
        return;
      }

      matchedRequested.add(newIndex);
      const sameProduct = findWorkingProduct(oldItem.productId);
      if (sameProduct) {
        const resized = resizeFifoSaleItem(sameProduct, oldItem, candidate, originalTx.date);
        replaceWorkingProduct(resized.product);
        costedItems[newIndex] = resized.item;
      }
    });

    // Allocate newly added lines or product replacements from current FIFO stock.
    requestedItems.forEach((item: any, index: number) => {
      if (matchedRequested.has(index) && !needsAllocation.has(index)) return;
      const product = findWorkingProduct(item.productId);
      if (!product) {
        costedItems[index] = item;
        return;
      }
      const quantity = Number(item.quantity) || 0;
      const negativeAtSale = Number(product.stock) < quantity;
      const allocation = allocateFifoCost(product, quantity, originalTx.date);
      replaceWorkingProduct({
        ...allocation.product,
        hasNegativeSale: negativeAtSale ? true : allocation.product.hasNegativeSale,
        negativeSaleUpdated: negativeAtSale ? false : allocation.product.negativeSaleUpdated
      });
      costedItems[index] = {
        ...item,
        buyPrice: allocation.averageUnitCost,
        costAllocations: allocation.allocations,
        isNegativeSale: negativeAtSale
      };
    });

    const items = costedItems;
    const discount = updatedFields.discount !== undefined ? Math.max(0, Number(updatedFields.discount) || 0) : Math.max(0, Number(originalTx.discount) || 0);
    const originalSubtotal = Number(originalTx.subtotal) || 0;
    const originalTax = Number(originalTx.tax) || 0;
    const taxRate = originalSubtotal > 0 ? (originalTax / originalSubtotal) * 100 : 0;
    const subtotal = items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.price) || 0)), 0);
    const tax = Math.round(subtotal * (taxRate / 100));
    const total = Math.max(subtotal + tax - discount, 0);
    const requestedPaidAmount = updatedFields.paidAmount !== undefined ? Math.max(0, Number(updatedFields.paidAmount) || 0) : Math.max(0, Number(originalTx.paidAmount) || 0);
    const paidAmount = Math.min(total, requestedPaidAmount);
    const dueBalance = Math.max(total - paidAmount, 0);
    const status = dueBalance === 0 ? "paid" : paidAmount > 0 ? "partial" : "due";

    const updatedProductsList = workingProducts;
    const updatedTransactionsList = transactions.map(t => {
      if (t.id === id) {
        return {
          ...t,
          ...updatedFields,
          items,
          subtotal,
          tax,
          total,
          paidAmount,
          dueBalance,
          status
        };
      }
      return t;
    });

    const targetTxForCommit = updatedTransactionsList.find(t => t.id === id);
    const changedProductsForCommit = updatedProductsList.filter((nextProduct, index) => {
      const previousProduct = products[index];
      return !!previousProduct && (
        Number(previousProduct.stock) !== Number(nextProduct.stock) ||
        JSON.stringify(previousProduct.costLots || []) !== JSON.stringify(nextProduct.costLots || []) ||
        Boolean(previousProduct.hasNegativeSale) !== Boolean(nextProduct.hasNegativeSale) ||
        Boolean(previousProduct.negativeSaleUpdated) !== Boolean(nextProduct.negativeSaleUpdated)
      );
    });

    if (activeUser && !activeUser.isGuest && targetTxForCommit) {
      let costOfGoodsSold = 0;
      items.forEach(item => {
        const dbProduct = customerDirectoryData.productsById.get(item.productId || "") ||
          customerDirectoryData.productsById.get(item.id || "") ||
          customerDirectoryData.productsByName.get(item.name || "");
        let buyCost = 0;
        if (Array.isArray(item.costAllocations) && item.costAllocations.length > 0) {
          buyCost = getAverageCostFromAllocations(item, dbProduct?.buyPrice ?? 0);
        } else if (item.buyPrice !== undefined && item.buyPrice !== null && Number.isFinite(Number(item.buyPrice))) {
          buyCost = Number(item.buyPrice);
        } else if (dbProduct?.buyPrice !== undefined && dbProduct?.buyPrice !== null && Number.isFinite(Number(dbProduct.buyPrice))) {
          buyCost = Number(dbProduct.buyPrice);
        } else {
          buyCost = (Number(item.price) || 0) * 0.70;
        }
        costOfGoodsSold += buyCost * (Number(item.quantity) || 0);
      });

      const nestedItems = items.map(item => ({
        id: item.firestoreId || item.id || "",
        firestoreId: item.firestoreId || item.id || "",
        name: item.name || "",
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0,
        total: (Number(item.quantity) || 0) * (Number(item.price) || 0),
        productId: item.productId || "",
        buyPrice: item.buyPrice !== undefined ? Number(item.buyPrice) : 0,
        costAllocations: item.costAllocations || [],
        warranty: item.warranty || "",
        warrantyDetails: item.warrantyDetails || "",
        isNegativeSale: item.isNegativeSale === true,
        isNegativeSaleApproved: item.isNegativeSaleApproved === true,
        negativeSaleUpdated: item.negativeSaleUpdated === true
      }));
      const selectedDate = updatedFields.date || originalTx.date || originalTx.created_at;
      const parsedDate = selectedDate ? new Date(selectedDate as any) : null;
      const createdAt = parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toISOString()
        : (originalTx.created_at || originalTx.date || new Date().toISOString());

      try {
        await commitInvoiceEditBatch({
          transactionDocId: originalTx.firestoreId || originalTx.id,
          transactionData: {
            id: originalTx.id,
            invoice_no: targetTxForCommit.invoiceNo,
            customer_id: targetTxForCommit.contactId || null,
            items: nestedItems,
            subtotal: Number(subtotal) || 0,
            tax: Number(tax) || 0,
            tax_amount: Number(tax) || 0,
            total_amount: Number(total) || 0,
            total: Number(total) || 0,
            profit: Math.round(total - costOfGoodsSold),
            discount: Number(discount) || 0,
            paid_amount: Number(paidAmount) || 0,
            paidAmount: Number(paidAmount) || 0,
            payment_history: originalTx.paymentHistory || [],
            due_balance: Number(dueBalance) || 0,
            dueBalance: Number(dueBalance) || 0,
            status,
            payment_method: targetTxForCommit.paymentMethod || "Cash",
            created_at: createdAt,
            vat_rate: originalSubtotal > 0 ? Number(((originalTax / originalSubtotal) * 100).toFixed(2)) : 0,
            updated_at: new Date().toISOString()
          },
          items: items.map(item => {
            const docId = item.firestoreId || item.id;
            return {
              docId,
              data: {
                transaction_id: originalTx.id,
                product_id: item.productId || null,
                product_name: item.name || "Product Item",
                category: item.category || "Uncategorized",
                quantity: Number(item.quantity) || 0,
                sell_price: Number(item.price) || 0,
                cost_price: item.buyPrice !== undefined ? Number(item.buyPrice) : 0,
                cost_allocations: item.costAllocations || [],
                is_negative_sale: item.isNegativeSale === true,
                is_negative_sale_approved: item.isNegativeSaleApproved === true || item.negativeSaleUpdated === true,
                warranty: item.warranty || "",
                warranty_details: item.warrantyDetails || ""
              }
            };
          }),
          deletedItemIds: originalItems
            .map(item => item.firestoreId || item.id)
            .filter(itemId => !!itemId && !items.some(item => (item.firestoreId || item.id) === itemId)),
          products: changedProductsForCommit.map(product => ({ id: product.id, data: product }))
        });
      } catch (error: any) {
        triggerNotification(error?.message || "Invoice changes could not be saved to the cloud. No stock or invoice changes were applied.", "error");
        return;
      }
    }

    setProducts(updatedProductsList);
    setTransactions(updatedTransactionsList);

    // Regenerate and update local storage keys
    try {
      const activeUserId = activeUser?.uid;

      // 1. Update barakah_flat_transaction_items
      const rawLocalItems = localStorage.getItem(getDbKey("barakah_flat_transaction_items", undefined, activeUserId)) || "[]";
      let flatItems = JSON.parse(rawLocalItems);
      if (!Array.isArray(flatItems)) flatItems = [];

      const targetTx = updatedTransactionsList.find(t => t.id === id);
      if (targetTx && Array.isArray(targetTx.items)) {
        const activeItemKeys = new Set<string>();
        targetTx.items.forEach((nestedIt: any, idx: number) => {
          const itemUUID = nestedIt.firestoreId || nestedIt.id || (id + "_item_" + idx);
          activeItemKeys.add(String(itemUUID));
        });
        // Keep only the exact line IDs still present; product IDs are not unique per invoice.
        flatItems = flatItems.filter((x: any) => {
          if (x.transaction_id !== id) return true;
          return activeItemKeys.has(String(x.firestoreId || x.id || ""));
        });
        targetTx.items.forEach((nestedIt: any, idx: number) => {
          const itemUUID = nestedIt.firestoreId || nestedIt.id || `${id}_item_${idx}`;
          const productUUID = nestedIt.productId || null;

          const flatItem = {
            id: itemUUID,
            transaction_id: id,
            product_id: productUUID,
            product_name: nestedIt.name || "Product Item",
            category: nestedIt.category || "Uncategorized",
            quantity: Number(nestedIt.quantity) || 0,
            sell_price: Number(nestedIt.price) || 0,
            cost_price: nestedIt.buyPrice !== undefined ? Number(nestedIt.buyPrice) : 0,
            cost_allocations: nestedIt.costAllocations || [],
            is_negative_sale: nestedIt.isNegativeSale === true,
            is_negative_sale_approved: nestedIt.isNegativeSaleApproved === true || nestedIt.negativeSaleUpdated === true,
            warranty: nestedIt.warranty || "",
            warranty_details: nestedIt.warrantyDetails || ""
          };

          const flatIdx = flatItems.findIndex((x: any) => String(x.firestoreId || x.id || "") === String(itemUUID));
          if (flatIdx >= 0) {
            flatItems[flatIdx] = {
              ...flatItems[flatIdx],
              ...flatItem
            };
          } else {
            flatItems.push(flatItem);
          }
        });
      }
      localStorage.setItem(getDbKey("barakah_flat_transaction_items", undefined, activeUserId), JSON.stringify(flatItems));

      // 2. Update barakah_flat_transactions
      const rawLocalTx = localStorage.getItem(getDbKey("barakah_flat_transactions", undefined, activeUserId)) || "[]";
      let flatTxList = JSON.parse(rawLocalTx);
      if (!Array.isArray(flatTxList)) flatTxList = [];

      if (targetTx) {
        const flatTxItem = {
          id: targetTx.id,
          firestoreId: targetTx.firestoreId || targetTx.id,
          invoice_no: targetTx.invoiceNo || targetTx.invoice_no,
          customer_id: targetTx.contactId || targetTx.customer_id || null,
          total_amount: Number(total) || 0,
          discount: Number(discount) || 0,
          vat_rate: Number(taxRate.toFixed(2)),
          paid_amount: Number(paidAmount) || 0,
          payment_method: targetTx.paymentMethod || targetTx.payment_method || "Cash",
          payment_history: targetTx.paymentHistory || [],
          signature_svg: targetTx.customerSignature || targetTx.signature_svg || null,
          created_at: targetTx.date || targetTx.created_at || new Date().toISOString()
        };

        const txIdx = flatTxList.findIndex((x: any) => x.id === id);
        if (txIdx >= 0) {
          flatTxList[txIdx] = {
            ...flatTxList[txIdx],
            ...flatTxItem
          };
        } else {
          flatTxList.push(flatTxItem);
        }
        localStorage.setItem(getDbKey("barakah_flat_transactions", undefined, activeUserId), JSON.stringify(flatTxList));
      }

      // 3. Update barakah_transactions
      localStorage.setItem(getDbKey("barakah_transactions", undefined, activeUserId), JSON.stringify(updatedTransactionsList));
    } catch (err) {
      console.warn("Failed to update flat items in localStorage during edit:", err);
    }

    // Directly backup to cloud since auto-backup is disabled/skipped via isRemoteUpdateActiveRef during active sessions
    if (activeUser && !activeUser.isGuest) {
      const passcode = activeUser.isPasscodeUser ? (activeUser.passcode || "1234") : "classic_account_secure";
      const compiledBusinessInfo = {
        ...businessInfo,
        staffList
      };
      uploadPasscodeBackup(activeUser.email, passcode, {
        products: updatedProductsList,
        contacts,
        expenses,
        transactions: updatedTransactionsList,
        businessInfo: compiledBusinessInfo,
        purchases
      }).then((res) => {
        if (res && res.success && res.updatedAt) {
          lastUploadedAtRef.current = res.updatedAt;
        }
      }).catch((e) => {
        console.warn("Manual post-edit cloud backup failed silently:", e);
      });
    }

    triggerNotification(`Invoice ${originalTx.invoiceNo} successfully updated and stock reconciled.`);
  };

  // -----------------------------------------------------------------
  // 4. EXPENSE MANAGER WORKSPACE
  // -----------------------------------------------------------------
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Others");
  const [expenseSection, setExpenseSection] = useState<"home" | "add" | "history" | "categories">("home");
  
  
  useEffect(() => {
    const savedCategories = (businessInfo as any)?.expenseCategories;
    if (Array.isArray(savedCategories) && savedCategories.length > 0) {
      const normalized = Array.from(new Set(savedCategories.map((cat: any) => String(cat).trim()).filter(Boolean)));
      setExpenseCategories(prev => {
        if (prev.length === normalized.length && prev.every((cat, i) => cat === normalized[i])) return prev;
        return normalized;
      });
    }
  }, [businessInfo?.expenseCategories]);
  const [customCategory, setCustomCategory] = useState("");
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [expenseFilterCategory, setExpenseFilterCategory] = useState("All");
  const [posSearchQuery, setPosSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [posTerminalTab, setPosTerminalTab] = useState<"checkout" | "catalog" | "history">("checkout");
  const [posProductsSearch, setPosProductsSearch] = useState("");
  const [posTxSearch, setPosTxSearch] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  // Expense Date Range States
  const [expenseDateFilter, _setExpenseDateFilter] = useState<"today" | "yesterday" | "weekly" | "monthly" | "yearly" | "custom">(() => {
    const saved = localStorage.getItem(getDbKey("barakah_expense_date_filter"));
    if (saved === "today" || saved === "yesterday" || saved === "weekly" || saved === "monthly" || saved === "yearly" || saved === "custom") {
      return saved;
    }
    return "monthly";
  });
  const setExpenseDateFilter = (val: "today" | "yesterday" | "weekly" | "monthly" | "yearly" | "custom") => {
    _setExpenseDateFilter(val);
    localStorage.setItem(getDbKey("barakah_expense_date_filter"), val);
  };
  const [expenseCustomStart, setExpenseCustomStart] = useState(() => {
    const saved = localStorage.getItem(getDbKey("barakah_expense_custom_start"));
    if (saved && saved.length >= 16) return saved.slice(0, 16);
    const now = new Date();
    return new Date(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [expenseCustomEnd, setExpenseCustomEnd] = useState(() => {
    const saved = localStorage.getItem(getDbKey("barakah_expense_custom_end"));
    if (saved && saved.length >= 16) return saved.slice(0, 16);
    const now = new Date();
    return new Date(Date.now() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const updateExpenseCustomStart = (value: string) => {
    setExpenseCustomStart(value);
    localStorage.setItem(getDbKey("barakah_expense_custom_start"), value);
  };
  const updateExpenseCustomEnd = (value: string) => {
    setExpenseCustomEnd(value);
    localStorage.setItem(getDbKey("barakah_expense_custom_end"), value);
  };

  // Edit Expense States
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editExpenseRecordedAt, setEditExpenseRecordedAt] = useState("");
  const [editExpenseDesc, setEditExpenseDesc] = useState("");
  const [editExpenseCategory, setEditExpenseCategory] = useState("Others");
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [editExpenseDate, setEditExpenseDate] = useState("");

  // Category adding state and expanded cards
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryModalTarget, setCategoryModalTarget] = useState<"add" | "edit" | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [expandedExpenseIds, setExpandedExpenseIds] = useState<Record<string, boolean>>({});
  const [categoryToManage, setCategoryToManage] = useState<string | null>(null);

  const checkExpenseDateInFilter = (dateStr: string, includeRecordedTime = false) => {
    try {
      if (!dateStr) return false;
      const rawDate = String(dateStr);
      const targetDate = rawDate.includes("T") ? new Date(rawDate) : new Date(rawDate + "T12:00:00");
      if (Number.isNaN(targetDate.getTime())) return false;
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

      if (expenseDateFilter === "today") {
        return targetDate >= startOfToday && targetDate <= endOfToday;
      }
      if (expenseDateFilter === "yesterday") {
        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);
        const endOfYesterday = new Date(startOfToday.getTime() - 1);
        return targetDate >= yesterday && targetDate <= endOfYesterday;
      }
      if (expenseDateFilter === "weekly") {
        const sevenDaysAgo = new Date(startOfToday);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        return targetDate >= sevenDaysAgo && targetDate <= endOfToday;
      }
      if (expenseDateFilter === "monthly") {
        return targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear();
      }
      if (expenseDateFilter === "yearly") {
        return targetDate.getFullYear() === today.getFullYear();
      }
      if (expenseDateFilter === "custom") {
        if (!expenseCustomStart || !expenseCustomEnd || expenseCustomStart > expenseCustomEnd) return false;
        if (includeRecordedTime && rawDate.includes("T")) {
          const start = new Date(expenseCustomStart);
          const end = new Date(expenseCustomEnd);
          return targetDate >= start && targetDate <= end;
        }
        const expenseDay = rawDate.slice(0, 10);
        return expenseDay >= expenseCustomStart.slice(0, 10) && expenseDay <= expenseCustomEnd.slice(0, 10);
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const toLocalDateTimeInput = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const handleUpdateExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !editExpenseDesc.trim() || !editExpenseAmount) return;

    const updatedExp: Expense = {
      ...editingExpense,
      description: editExpenseDesc.trim(),
      category: editExpenseCategory,
      amount: Number(editExpenseAmount) || 0,
      date: editExpenseDate
    };

    if (editingExpense.source === "delivery" && editingExpense.sourceId) {
      try {
        const user = firebaseAuth.currentUser;
        if (!user || !activeUser || !adminActionPin) throw new Error("Admin session expired. Please unlock the Admin panel again.");
        const selectedRecordedAt = editExpenseRecordedAt ? new Date(editExpenseRecordedAt) : new Date();
        if (Number.isNaN(selectedRecordedAt.getTime())) throw new Error("Please select a valid date and time.");
        const token = await user.getIdToken();
        const response = await fetch("/api/delivery/expenses/admin-update", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            store_id: String(activeUser.email || "").trim().toLowerCase(),
            admin_pin: adminActionPin,
            expense_id: editingExpense.sourceId,
            amount: updatedExp.amount,
            reason: updatedExp.description,
            category: updatedExp.category,
            date: editExpenseRecordedAt.slice(0, 10) || editExpenseDate,
            recorded_at: selectedRecordedAt.toISOString()
          })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not update delivery expense.");
        setDeliveryExpenseRecords(prev => prev.map(item => String(item.id) === editingExpense.sourceId ? { ...item, amount: updatedExp.amount, reason: updatedExp.description, category: updatedExp.category, date: editExpenseRecordedAt.slice(0, 10) || editExpenseDate, dashboard_date: editExpenseRecordedAt.slice(0, 10) || editExpenseDate, recorded_at: selectedRecordedAt.toISOString() } : item));
      } catch (error: any) {
        triggerNotification(error?.message || "Could not update delivery expense.", "error");
        return;
      }
    } else {
      setExpenses(prev => prev.map(item => item.id === editingExpense.id ? updatedExp : item));
      if (activeUser && !activeUser.isGuest) saveExpense(activeUser.uid, updatedExp).catch(err => {});
    }
    setEditingExpense(null);
    setEditExpenseRecordedAt("");
    setEditExpenseDesc("");
    setEditExpenseCategory("Others");
    setEditExpenseAmount("");
    setEditExpenseDate("");
    triggerNotification("Expense item successfully updated!");
  };

  // Combine standard default list alongside any category names extracted from already saved records
  const allCategories = Array.from(new Set([
    ...expenseCategories,
    ...expenses.map(e => e.category).filter(Boolean),
    ...deliveryExpenseRecords.map((e: any) => e.category).filter(Boolean)
  ]));

  const getExpenseMonthKey = (dateStr: string) => {
    const match = String(dateStr || "").match(/^(\d{4})-(\d{2})/);
    return match ? match[1] + "-" + match[2] : "";
  };

  const handleEditExpenseCategory = async (oldCategory: string, newCategory: string) => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      triggerNotification("Category name cannot be empty.", "error");
      return;
    }
    if (oldCategory === trimmed) {
      setCategoryToManage(null);
      setNewCategoryName("");
      return;
    }
    if (allCategories.includes(trimmed)) {
      triggerNotification("That category name already exists.", "error");
      return;
    }

    const affected = expenses.filter(e => e.category === oldCategory);
    const updatedExpenses = expenses.map(e => e.category === oldCategory ? { ...e, category: trimmed } : e);

    setExpenseCategories(prev => prev.map(cat => cat === oldCategory ? trimmed : cat));
    if (affected.length > 0) {
      setExpenses(updatedExpenses);
      if (activeUser && !activeUser.isGuest) {
        await Promise.all(affected.map(e => saveExpense(activeUser.uid, { ...e, category: trimmed })));
      }
    }

    if (expenseFilterCategory === oldCategory) setExpenseFilterCategory(trimmed);
    if (expenseCategory === oldCategory) setExpenseCategory(trimmed);
    if (editExpenseCategory === oldCategory) setEditExpenseCategory(trimmed);
    setCategoryToManage(null);
    setNewCategoryName("");
    triggerNotification(`Category "${oldCategory}" renamed to "${trimmed}" across expense history.`, "success");
  };

  const handleDeleteExpenseCategory = async (category: string) => {
    if (currentPanel !== "admin") {
      triggerNotification("Only administrators can delete expense categories.", "error");
      return;
    }
    if (category === "Others") {
      triggerNotification('The "Others" category cannot be deleted.', "error");
      return;
    }
    const affected = expenses.filter(e => e.category === category);
    const confirmed = window.confirm(
      affected.length > 0
        ? `Delete "${category}"? Its ${affected.length} expense record(s) will be kept and moved to "Others".`
        : `Delete category "${category}"?`
    );
    if (!confirmed) return;

    if (affected.length > 0) {
      const updatedExpenses = expenses.map(e => e.category === category ? { ...e, category: "Others" } : e);
      setExpenses(updatedExpenses);
      if (activeUser && !activeUser.isGuest) {
        await Promise.all(affected.map(e => saveExpense(activeUser.uid, { ...e, category: "Others" })));
      }
    }
    setExpenseCategories(prev => prev.filter(cat => cat !== category));
    if (expenseFilterCategory === category) setExpenseFilterCategory("All");
    if (expenseCategory === category) setExpenseCategory("Others");
    if (editExpenseCategory === category) setEditExpenseCategory("Others");
    setCategoryToManage(null);
    setNewCategoryName("");
    triggerNotification(`Category "${category}" deleted. Previous expense records were preserved under Others.`, "success");
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc || !expenseAmount) return;

    let categoryToUse = expenseCategory;
    if (isAddingCustomCategory && customCategory.trim()) {
      const trimmed = customCategory.trim();
      if (!expenseCategories.includes(trimmed)) {
        setExpenseCategories([...expenseCategories, trimmed]);
      }
      categoryToUse = trimmed;
      setIsAddingCustomCategory(false);
      setCustomCategory("");
    } else if (isAddingCustomCategory && !customCategory.trim()) {
      categoryToUse = "Others";
    }

    const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();
    const newExp: Expense = {
      id: toUUID(`e_${Date.now()}`, cleanEmail),
      category: categoryToUse || "Others",
      amount: Number(expenseAmount) || 0,
      description: expenseDesc,
      date: expenseDate
    };

    setExpenses([newExp, ...expenses]);
    if (activeUser && !activeUser.isGuest) {
      saveExpense(activeUser.uid, newExp).catch(err => {});
    }
    setExpenseDesc("");
    setExpenseCategory("Others");
    setExpenseAmount("");
    triggerNotification("Business expense item added to the ledger.");
  };

  const handlePurchaseAddSupplier = (supplier: { name: string; phone: string; address: string }) => {
    const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();
    const newId = toUUID(`c_${Date.now()}`, cleanEmail);
    const newContact: Contact = {
      id: newId,
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address || "Dhaka, Bangladesh",
      type: "supplier",
      created_at: new Date().toISOString()
    };
    setContacts(prev => [newContact, ...prev]);
    if (activeUser && !activeUser.isGuest) {
      saveCustomer(activeUser.uid, newContact).catch(err => {});
    }
    triggerNotification(`Supplier [${supplier.name}] added successfully!`, "success");
    return newId;
  };

  // -----------------------------------------------------------------
  // 5. CONTACTS CRM WORKSPACE
  // -----------------------------------------------------------------
  const [isTranslatingContact, setIsTranslatingContact] = useState(false);

  const banglaToEnglishDigits = (str: string): string => {
    const map: { [key: string]: string } = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    return str.replace(/[০-৯]/g, (m) => map[m] || m);
  };

  const hasBengaliCharacters = (str: string): boolean => {
    return /[\u0980-\u09FF]/.test(str);
  };

  const translateContactFields = async (customName: string, customPhone: string, customAddress: string): Promise<{ name: string; phone: string; address: string } | null> => {
    const targetName = customName;
    const targetPhone = banglaToEnglishDigits(customPhone).replace(/[^0-9]/g, "");
    const targetAddress = customAddress;

    if (!targetName.trim() && !targetPhone.trim() && !targetAddress.trim()) {
      return null;
    }

    setIsTranslatingContact(true);
    try {
      const res = await fetch("/api/ai/translate-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: targetName, phone: targetPhone, address: targetAddress })
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          return {
            name: data.name || targetName,
            phone: data.phone || targetPhone,
            address: data.address || targetAddress
          };
        }
      }
    } catch (err) {
      console.error("Translation API failed:", err);
    } finally {
      setIsTranslatingContact(false);
    }
    return null;
  };


  // Copy saved customer details for quick reuse in Expenses or other forms.
  const handleCopyContactDetails = async (contact: Contact) => {
    const details = `Customer Name: ${contact.name || ""}
Phone: ${contact.phone || ""}
Address: ${contact.address || ""}`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(details);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch (_) {
      // Compatibility fallback for browsers/devices without Clipboard API access.
      const textarea = document.createElement("textarea");
      textarea.value = details;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!copied) {
        triggerNotification("Could not copy customer details. Please try again.", "error");
        return;
      }
    }

    triggerNotification(`Copied details for ${contact.name}.`, "success");
  };

  const handleAddContact = async (values: { name: string; phone: string; address: string; type: "customer" | "supplier" }) => {
    if (!values.name.trim() || !values.phone.trim()) return;

    const cleanPhone = banglaToEnglishDigits(values.phone).replace(/[^0-9]/g, "");
    if (cleanPhone.length !== 11) {
      triggerNotification("⚠️ Bangladeshi mobile phone numbers must be exactly 11 digits! Yours is " + cleanPhone.length + " digits.", "error");
      return;
    }

    let finalName = values.name.trim();
    let finalPhone = cleanPhone;
    let finalAddress = values.address.trim();
    const contactType = values.type;

    if (hasBengaliCharacters(finalName) || hasBengaliCharacters(finalAddress)) {
      triggerNotification("🔄 Bengali input detected! Automatically transliterating to English...", "info");
      const translated = await translateContactFields(finalName, finalPhone, finalAddress);
      if (translated) {
        finalName = translated.name;
        finalPhone = translated.phone;
        finalAddress = translated.address;
      }
    }

    const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();

    if (editingContact) {
      const updatedContact = {
        id: editingContact.id,
        name: finalName,
        phone: finalPhone,
        address: finalAddress || "Dhaka, Bangladesh",
        type: contactType,
        created_at: editingContact.created_at || new Date().toISOString()
      };
      const updated = contacts.map(c => c.id === editingContact.id ? updatedContact : c);
      setContacts(updated);

      if (activeUser && !activeUser.isGuest) {
        try {
          await saveCustomer(activeUser.uid, updatedContact);
        } catch (err) {
          console.error("Error saving updated contact to Firestore:", err);
        }
      }

      setEditingContact(null);
      triggerNotification(`Contact [${finalName}] updated successfully in proper English!`, "success");
    } else {
      const newContact: Contact = {
        id: toUUID(`c_${Date.now()}`, cleanEmail),
        name: finalName,
        phone: finalPhone,
        address: finalAddress || "Dhaka, Bangladesh",
        type: contactType,
        created_at: new Date().toISOString()
      };

      setContacts(prev => [newContact, ...prev]);

      if (contactType === "customer") {
        resetPosWorkspace(newContact.id);
      }

      if (activeUser && !activeUser.isGuest) {
        try {
          await saveCustomer(activeUser.uid, newContact);
        } catch (err) {
          console.error("Error saving new contact to Firestore:", err);
        }
      }

      triggerNotification(`Contact [${finalName}] successfully registered in standard English!`, "success");
    }
  };

  const handleCopyReceipt = (pur: Purchase) => {
    const due = pur.dueAmount ?? 0;
    const isFullyPaid = due <= 0;
    const statusStr = isFullyPaid ? "[FULLY SETTLED]" : "[OUTSTANDING DUE]";
    
    const text = `
------------------------------------------
   ${businessInfo.name}
   Supplier Due Payment Receipt
------------------------------------------
Date: ${safeFormat(pur.date, "dd MMMM, yyyy", "N/A")}
Voucher No: ${pur.invoiceNo || "N/A"}
Supplier: ${pur.supplierName}

Items: ${pur.productName}
Qty: ${pur.quantity} pcs
Buy Rate: ${businessInfo.currencySymbol} ${(pur.buyPrice || 0).toLocaleString()} /unit
Total: ${businessInfo.currencySymbol} ${pur.totalAmount.toLocaleString()}

------------------------------------------
Ledger Summary:
Net Total: ${businessInfo.currencySymbol} ${pur.totalAmount.toLocaleString()}
Cash Paid: ${businessInfo.currencySymbol} ${(pur.cashPaid || 0).toLocaleString()}
Outstanding Due: ${businessInfo.currencySymbol} ${due.toLocaleString()} 
Status: ${statusStr}

With Best Regards,
${businessInfo.name}
Phone: ${businessInfo.phone || "N/A"}
Address: ${businessInfo.address || "N/A"}
------------------------------------------
`.trim();

    navigator.clipboard.writeText(text);
    triggerNotification("Receipt summary copied successfully!", "success");
  };

  const handleWhatsAppShare = (pur: Purchase) => {
    const due = pur.dueAmount ?? 0;
    const isFullyPaid = due <= 0;
    const statusStr = isFullyPaid ? "✅ FULLY SETTLED" : "⚠️ OUTSTANDING DUE";
    
    const text = `*${businessInfo.name}*
*Supplier Due Payment Receipt*
----------------------------------------
*Date:* ${safeFormat(pur.date, "dd MMMM, yyyy", "N/A")}
*Voucher No:* ${pur.invoiceNo || "N/A"}
*Supplier:* ${pur.supplierName}

*Item:* ${pur.productName}
*Qty:* ${pur.quantity} pcs @ ${businessInfo.currencySymbol}${pur.buyPrice.toLocaleString()}
*Total Amount:* ${businessInfo.currencySymbol}${pur.totalAmount.toLocaleString()}

----------------------------------------
📊 *Ledger Details:*
*Net Total:* ${businessInfo.currencySymbol}${pur.totalAmount.toLocaleString()}
*Cash Paid:* ${businessInfo.currencySymbol}${(pur.cashPaid || 0).toLocaleString()}
*Due Balance:* ${businessInfo.currencySymbol}${due.toLocaleString()}
*Status:* ${statusStr}

Thank you!
_${businessInfo.name}_`;

    const encodedText = encodeURIComponent(text);
    const link = document.createElement('a');
    link.href = `https://api.whatsapp.com/send?text=${encodedText}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const handlePrintReceipt = (pur: Purchase) => {
    const due = pur.dueAmount ?? 0;
    const isFullyPaid = due <= 0;
    const statusStr = isFullyPaid ? "FULLY SETTLED" : "OUTSTANDING DUE";
    
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;
    
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Supplier Receipt - ${pur.invoiceNo || "N/A"}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              padding: 20px;
              color: #000;
              background: #fff;
              max-width: 400px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #000;
              padding-bottom: 15px;
              margin-bottom: 15px;
            }
            .business-name {
              font-size: 20px;
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 5px;
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              margin: 4px 0;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 12px 0;
            }
            .product-title {
              font-weight: bold;
              font-size: 14px;
              margin-bottom: 5px;
            }
            .ledger-row {
              display: flex;
              justify-content: space-between;
              font-size: 14px;
              margin: 6px 0;
            }
            .ledger-row-bold {
              font-weight: bold;
              font-size: 16px;
              border-top: 1px solid #000;
              padding-top: 6px;
              margin-top: 8px;
            }
            .status {
              text-align: center;
              font-size: 14px;
              font-weight: bold;
              border: 1px solid #000;
              padding: 6px;
              margin-top: 15px;
              text-transform: uppercase;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="business-name">${businessInfo.name}</div>
            <div>Phone: ${businessInfo.phone || "N/A"}</div>
            <div>Address: ${businessInfo.address || "N/A"}</div>
            <div style="font-weight: bold; margin-top: 10px; font-size: 14px;">SUPPLIER TRANSACTION RECEIPT</div>
            <div style="font-size: 11px;">Payment & Ledger Balance Receipt</div>
          </div>
          
          <div class="meta-row">
            <span>Date:</span>
            <span>${safeFormat(pur.date, "dd-MM-yyyy HH:mm", "N/A")}</span>
          </div>
          <div class="meta-row">
            <span>Voucher No:</span>
            <span>${pur.invoiceNo || "N/A"}</span>
          </div>
          <div class="meta-row">
            <span>Supplier:</span>
            <span><strong>${pur.supplierName}</strong></span>
          </div>
          
          <div class="divider"></div>
          
          <div class="product-title">Description / Item Details:</div>
          <div class="meta-row font-bold">
            <span>${pur.productName}</span>
            <span>${pur.quantity} pcs</span>
          </div>
          <div class="meta-row" style="font-size: 12px; color: #555;">
            <span>Rate / Cost Price:</span>
            <span>${businessInfo.currencySymbol} ${(pur.buyPrice || 0).toLocaleString()} /unit</span>
          </div>
          
          <div class="divider"></div>
          
          <div class="ledger-row">
            <span>Net Bill Total:</span>
            <span>${businessInfo.currencySymbol} ${pur.totalAmount.toLocaleString()}</span>
          </div>
          <div class="ledger-row">
            <span>Cash Paid:</span>
            <span>${businessInfo.currencySymbol} ${(pur.cashPaid || 0).toLocaleString()}</span>
          </div>
          
          <div class="ledger-row ledger-row-bold">
            <span>Outstanding Due:</span>
            <span>${businessInfo.currencySymbol} ${due.toLocaleString()}</span>
          </div>
          
          <div class="status">
            ${statusStr}
          </div>
          
          <div class="footer">
            <div>Thank you for your business!</div>
            <div style="margin-top: 5px; font-size: 10px;">Generated via Smart Barakah POS</div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.parent.document.body.removeChild(window.frameElement);
              }, 1500);
            }
          </script>
        </body>
      </html>
    `);
    doc.close();
  };

  // -----------------------------------------------------------------
  // 6. INTELLIGENT AI BUSINESS INSIGHTS (GEMINI INSIGHT READER)
  // -----------------------------------------------------------------
  const [aiInsightsList, setAiInsightsList] = useState<AIInsight[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  const fetchStrategicInsights = async () => {
    setIsGeneratingInsights(true);
    try {
      const data = await generateBusinessInsights(transactions, expenses, products);
      setAiInsightsList(data);
      triggerNotification("Real-time AI Business Report generated!");
    } catch (e) {
      triggerNotification("AI insight scanner temporarily sleeping.", "error");
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  // Execute strategic analytical load once on mount if data exists
  useEffect(() => {
    if (transactions.length > 0) {
      fetchStrategicInsights();
    }
  }, [transactions.length]);

  // -----------------------------------------------------------------
  // DATE RANGE FILTER ENGINE
  // -----------------------------------------------------------------
  const [dashboardFilter, _setDashboardFilter] = useState<"today" | "yesterday" | "weekly" | "monthly" | "yearly" | "all" | "custom">(() => {
    const saved = localStorage.getItem(getDbKey("barakah_dashboard_filter"));
    if (saved === "today" || saved === "yesterday" || saved === "weekly" || saved === "monthly" || saved === "yearly" || saved === "all" || saved === "custom") {
      return saved as any;
    }
    return "all";
  });
  const setDashboardFilter = (val: "today" | "yesterday" | "weekly" | "monthly" | "yearly" | "all" | "custom") => {
    _setDashboardFilter(val);
    localStorage.setItem(getDbKey("barakah_dashboard_filter"), val);
  };

  const [customStart, _setCustomStart] = useState<string>(() => {
    return localStorage.getItem(getDbKey("barakah_custom_start")) || "2026-05-01";
  });
  const setCustomStart = (val: string) => {
    _setCustomStart(val);
    localStorage.setItem(getDbKey("barakah_custom_start"), val);
  };

  const [customEnd, _setCustomEnd] = useState<string>(() => {
    return localStorage.getItem(getDbKey("barakah_custom_end")) || "2026-05-31";
  });
  const setCustomEnd = (val: string) => {
    _setCustomEnd(val);
    localStorage.setItem(getDbKey("barakah_custom_end"), val);
  };

  const checkDateInFilter = (dateStr: string) => {
    try {
      if (!dateStr) return false;
      const parsedDate = new Date(dateStr);
      if (Number.isNaN(parsedDate.getTime())) return false;

      // Compare calendar days in the device's local timezone. This also handles
      // date-only values and payment timestamps consistently across month/year edges.
      const targetDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (dashboardFilter === "all") return true;

      if (dashboardFilter === "yearly") {
        return targetDate.getFullYear() === todayStart.getFullYear();
      }
      if (dashboardFilter === "custom") {
        if (!customStart || !customEnd || customStart > customEnd) return false;
        const start = new Date(`${customStart}T00:00:00`);
        const end = new Date(`${customEnd}T23:59:59.999`);
        return targetDate >= start && targetDate <= end;
      }
      if (dashboardFilter === "monthly") {
        return targetDate.getMonth() === todayStart.getMonth() &&
          targetDate.getFullYear() === todayStart.getFullYear();
      }
      if (dashboardFilter === "today") {
        return targetDate.getTime() === todayStart.getTime();
      }
      if (dashboardFilter === "yesterday") {
        const yesterday = new Date(todayStart);
        yesterday.setDate(yesterday.getDate() - 1);
        return targetDate.getTime() === yesterday.getTime();
      }
      if (dashboardFilter === "weekly") {
        const sevenDayStart = new Date(todayStart);
        sevenDayStart.setDate(sevenDayStart.getDate() - 6);
        return targetDate >= sevenDayStart && targetDate <= todayStart;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const paidDeliveryExpenses = useMemo(() => deliveryExpenseRecords
    .filter((expense: any) => String(expense.payment_status || "").toLowerCase() === "paid")
    .map((expense: any) => ({
      id: `delivery_staff_expense_${expense.id}`,
      category: expense.category || "Delivery Staff Expense",
      amount: Number(expense.amount) || 0,
      description: expense.reason || expense.description || "Delivery staff expense",
      // An Admin edit in Expenses History overrides the Dashboard date; otherwise retain paid-date accounting.
      date: expense.dashboard_date || expense.payment_date || expense.paid_at || expense.reviewed_at || expense.date
    })), [deliveryExpenseRecords]);

  const dashboardMetrics = useMemo(() => {
    const filteredDashboardTx = transactions.filter(t => checkDateInFilter(t.date));
    const allDashboardExpenses = [...expenses, ...paidDeliveryExpenses];
    const filteredDashboardExpenses = allDashboardExpenses.filter(e => checkDateInFilter(e.date));
    const filteredDashboardPurchases = purchases.filter(p => checkDateInFilter(p.date));

    const totalSalesTk = filteredDashboardTx.reduce((sum, t) => sum + t.total, 0);
    const totalOutstandingDueTk = filteredDashboardTx.reduce((sum, t) => sum + t.dueBalance, 0);
    const totalExpensesTk = filteredDashboardExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPurchasesTk = filteredDashboardPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalUnitsSold = filteredDashboardTx.reduce((sum, t) => {
      const itemQty = t.items ? t.items.reduce((innerSum, item) => innerSum + Number(item.quantity ?? 0), 0) : 0;
      return sum + itemQty;
    }, 0);

    let totalCostOfGoodsSold = 0;
    filteredDashboardTx.forEach(t => {
      t.items.forEach(item => {
        const dbProduct = products.find(p => p.id === item.productId || p.id === item.id || p.name === item.name);
        let buyCost = 0;
        if (Array.isArray(item.costAllocations) && item.costAllocations.length > 0) {
          buyCost = getAverageCostFromAllocations(item, dbProduct?.buyPrice ?? 0);
        } else if (item.buyPrice !== undefined && item.buyPrice !== null && Number.isFinite(Number(item.buyPrice))) {
          buyCost = Number(item.buyPrice);
        } else if (dbProduct?.buyPrice !== undefined && dbProduct?.buyPrice !== null && Number.isFinite(Number(dbProduct.buyPrice))) {
          buyCost = Number(dbProduct.buyPrice);
        } else {
          buyCost = (Number(item.price) || 0) * 0.70;
        }
        const quantity = Number(item.quantity ?? 0);
        totalCostOfGoodsSold += buyCost * (Number.isFinite(quantity) ? quantity : 0);
      });
    });

    return {
      filteredDashboardTx,
      filteredDashboardExpenses,
      filteredDashboardPurchases,
      totalSalesTk,
      totalOutstandingDueTk,
      totalExpensesTk,
      totalPurchasesTk,
      totalUnitsSold,
      totalCostOfGoodsSold
    };
  }, [transactions, expenses, paidDeliveryExpenses, purchases, products, dashboardFilter, customStart, customEnd]);

  const {
    filteredDashboardTx,
    filteredDashboardExpenses,
    filteredDashboardPurchases,
    totalSalesTk,
    totalOutstandingDueTk,
    totalExpensesTk,
    totalPurchasesTk,
    totalUnitsSold,
    totalCostOfGoodsSold
  } = dashboardMetrics;

  const totalDuesActiveState = totalOutstandingDueTk;
  const netEarningsReceived = totalSalesTk - totalOutstandingDueTk;
  const netProfitAmt = Math.round(totalSalesTk - totalCostOfGoodsSold - totalExpensesTk);
  
  // Backward compatibility variables for render blocks
  const projectedProductSellTotal = totalSalesTk;
  const projectedProductProfit = totalSalesTk - totalCostOfGoodsSold;
  const projectedNetTerminalProfit = netProfitAmt;

  // Filter lists dynamically
  const purchasedProductIds = useMemo(() => new Set(
    purchases.filter(pur => (pur.quantity || 0) > 0).map(pur => pur.productId).filter(Boolean)
  ), [purchases]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const query = inventorySearch.toLowerCase().trim();
      if (!query) return true;
      const searchTerms = query.split(/\s+/);
      const targetString = (p.name + " " + p.sku + " " + p.category).toLowerCase();
      return searchTerms.every(term => targetString.includes(term));
    });
  }, [products, inventorySearch]);

  // All Stock views are derived from the live Product catalogue; no separate stock store.
  const currentStockProducts = useMemo(() => filteredProducts.filter(p => Number(p.stock) > 0), [filteredProducts]);
  const outOfStockProducts = useMemo(() => filteredProducts.filter(p => Number(p.stock) <= 0), [filteredProducts]);
  const currentStockUnits = useMemo(() => currentStockProducts.reduce((total, product) => total + Number(product.stock || 0), 0), [currentStockProducts]);
  const stockValueTotal = useMemo(() => currentStockProducts.reduce((total, product) => total + Number(product.stock) * Number(product.buyPrice || 0), 0), [currentStockProducts]);
  const salesValueTotal = useMemo(() => currentStockProducts.reduce((total, product) => total + Number(product.stock || 0) * Number(product.sellPrice || 0), 0), [currentStockProducts]);
  const outOfStockValueTotal = useMemo(() => outOfStockProducts.reduce((total, product) => total + Math.max(0, -Number(product.stock || 0)) * Number(product.buyPrice || 0), 0), [outOfStockProducts]);
  const outOfStockMissingUnits = useMemo(() => outOfStockProducts.reduce((total, product) => total + Math.max(0, -Number(product.stock || 0)), 0), [outOfStockProducts]);
  const negativeStockProducts = useMemo(() => products.filter(product => Number(product.stock || 0) < 0), [products]);
  const totalNegativeStockUnits = useMemo(() => negativeStockProducts.reduce((total, product) => total + Math.abs(Number(product.stock || 0)), 0), [negativeStockProducts]);

  const filteredTransactions = useMemo(() => transactions.filter(t => {
    // 1. Date filter check
    let matchesDate = false;
    try {
      if (ledgerDateFilterType === "all") {
        matchesDate = true;
      } else {
        const dateStr = t.date;
        if (dateStr) {
          const date = safeDate(dateStr);
          if (!date) return false;
          
          const now = new Date();
          const today = safeStartOfDay(now);
          if (!today) return false;

          if (ledgerDateFilterType === "yearly") {
            matchesDate = date.getFullYear() === now.getFullYear();
          } else if (ledgerDateFilterType === "custom") {
            const start = safeStartOfDay(safeDate(ledgerStartDate));
            const end = safeEndOfDay(safeDate(ledgerEndDate));
            matchesDate = safeIsWithinInterval(date, { start, end });
          } else {
            // Restrict today, yesterday, weekly, monthly to the current month
            const isCurrentMonth = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            if (!isCurrentMonth) {
              matchesDate = false;
            } else if (ledgerDateFilterType === "monthly") {
              matchesDate = true;
            } else if (ledgerDateFilterType === "today") {
              matchesDate = safeIsWithinInterval(date, { start: safeStartOfDay(today), end: safeEndOfDay(today) });
            } else if (ledgerDateFilterType === "yesterday") {
              const yesterday = safeSubDays(now, 1);
              matchesDate = safeIsWithinInterval(date, { start: safeStartOfDay(yesterday), end: safeEndOfDay(yesterday) });
            } else if (ledgerDateFilterType === "weekly") {
              matchesDate = safeIsWithinInterval(date, { start: safeStartOfDay(safeSubDays(now, 7)), end: safeEndOfDay(now) });
            }
          }
        }
      }
    } catch (e) {
      matchesDate = false;
    }

    if (!matchesDate) return false;

    // 2. Existing search & status check
    const term = ledgerSearch.toLowerCase().trim();
    const contactName = contacts.find(c => c.id === t.contactId)?.name || "Walk-In Customer";
    if (!term) {
      if (ledgerStatusFilter === "all") return true;
      return t.status === ledgerStatusFilter;
    }
    const searchTerms = term.split(/\s+/);
    const targetString = `${t.invoiceNo} ${contactName}`.toLowerCase();
    const matchesSearch = searchTerms.every(word => targetString.includes(word));
    
    if (ledgerStatusFilter === "all") return matchesSearch;
    return matchesSearch && t.status === ledgerStatusFilter;
  }), [transactions, contacts, ledgerDateFilterType, ledgerStartDate, ledgerEndDate, ledgerSearch, ledgerStatusFilter]);

  const ledgerTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / ledgerPageSize));
  const safeLedgerPage = Math.min(ledgerCurrentPage, ledgerTotalPages);
  const paginatedLedgerTransactions = filteredTransactions.slice(
    (safeLedgerPage - 1) * ledgerPageSize,
    safeLedgerPage * ledgerPageSize
  );
  useEffect(() => {
    if (ledgerCurrentPage !== safeLedgerPage) setLedgerCurrentPage(safeLedgerPage);
  }, [ledgerCurrentPage, safeLedgerPage]);
  useEffect(() => {
    setLedgerCurrentPage(1);
  }, [ledgerSearch, ledgerStatusFilter, ledgerDateFilterType, ledgerStartDate, ledgerEndDate]);

  // Recharts analytic plot models 
  const ledgerTrendsPlotData = useMemo(() => transactions.slice().reverse().map(t => {
    try {
      const parsed = safeDate(t.date);
      const dStr = parsed ? safeFormat(parsed, "dd MMM", "Slip Date") : "Slip Date";
      return {
        date: dStr,
        "Sales Value": t.total,
        "Cash Received": t.paidAmount
      };
    } catch (e) {
      return { date: "Slip Date", "Sales Value": t.total, "Cash Received": t.paidAmount };
    }
  }), [transactions]);

  const expenseCategoryPlotData = useMemo(() => Object.entries(
    [...expenses, ...paidDeliveryExpenses].reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount || 0);
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value })), [expenses, paidDeliveryExpenses]);

  const COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];

  const welcomeHour = Number(new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Dhaka"
  }).format(new Date()));
  const welcomeGreeting =
    welcomeHour >= 5 && welcomeHour < 12 ? "Good Morning" :
    welcomeHour >= 12 && welcomeHour < 16 ? "Good Afternoon" :
    welcomeHour >= 16 && welcomeHour < 20 ? "Good Evening" : "Good Night";
  const welcomeClock = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka"
  }).format(new Date());

  if (showWelcomeScreen) {
    return (
      <main className="fixed inset-0 flex h-[100dvh] min-h-0 w-full items-center justify-center overflow-hidden bg-[#050505] px-3 py-3 text-white sm:px-5 sm:py-5">
        <div className="pointer-events-none absolute -left-32 top-[-8rem] h-80 w-80 rounded-full bg-emerald-500/[0.08] blur-[110px]" />
        <div className="pointer-events-none absolute -right-28 bottom-[-8rem] h-96 w-96 rounded-full bg-amber-400/[0.07] blur-[120px]" />
        <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-gradient-to-b from-[#151515] via-[#0c0c0c] to-[#080808] px-4 py-4 text-center shadow-[0_30px_100px_rgba(0,0,0,0.65)] sm:rounded-[2rem] sm:px-10 sm:py-8 md:rounded-[2.5rem] md:px-12 md:py-10">
          <p
            dir="rtl"
            lang="ar"
            className="mb-3 text-xl font-semibold leading-relaxed tracking-normal text-amber-200 sm:mb-6 sm:text-3xl md:text-4xl"
            style={{ fontFamily: "'Noto Naskh Arabic', 'Amiri', 'Traditional Arabic', serif" }}
          >
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>
          <p className="mb-1 text-xs font-medium tracking-[0.22em] text-slate-400 sm:mb-2 sm:text-base">
            {welcomeGreeting}
          </p>
          <p className="mb-4 font-mono text-[10px] tracking-[0.2em] text-slate-600 sm:mb-7 sm:text-xs">{welcomeClock} · DHAKA</p>
          <h1 className="text-2xl font-black tracking-[0.07em] text-white sm:text-5xl md:text-6xl">
            BARAKAH <span className="text-emerald-400">e</span>-MART
          </h1>
          <div className="my-4 flex w-full max-w-md items-center gap-4 sm:my-8">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/20" />
            <span className="h-1.5 w-1.5 rotate-45 border border-amber-300/70" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/20" />
          </div>
          <p className="max-w-xl text-base font-medium leading-relaxed text-slate-200 sm:text-2xl">
            “I believe patience is never wasted.”
          </p>
          <p className="mt-2 max-w-lg text-[10px] leading-5 text-slate-500 sm:mt-3 sm:text-sm sm:leading-6">
            Every sincere effort, made with patience and purpose, brings its own time of success.
          </p>
          <button
            type="button"
            onClick={() => {
              try { sessionStorage.setItem("barakah_app_session_started", "true"); } catch (_) {}
              setShowWelcomeScreen(false);
            }}
            className="mt-6 inline-flex min-h-11 min-w-44 shrink-0 items-center justify-center gap-3 rounded-xl border border-white bg-[#f8fafc] px-7 py-3 text-xs font-black tracking-[0.22em] !text-[#050505] shadow-[0_10px_35px_rgba(255,255,255,0.14)] transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_40px_rgba(255,255,255,0.22)] active:translate-y-0 sm:mt-10 sm:min-h-14 sm:px-8 sm:py-4"
          >
            <span className="!text-[#050505]">{(() => {
              try { return localStorage.getItem("barakah_local_active_user") ? "CONTINUE" : "LOGIN"; }
              catch (_) { return "LOGIN"; }
            })()}</span> <ArrowLeft className="h-4 w-4 rotate-180 !text-[#050505]" />
          </button>
          <p className="mt-4 shrink-0 text-[8px] font-medium tracking-[0.2em] text-slate-700 sm:mt-7 sm:text-[9px] sm:tracking-[0.28em]">WELCOME TO YOUR NEXT SUCCESSFUL DAY</p>
        </div>
      </main>
    );
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#070b13] flex flex-col items-center justify-center text-white font-mono gap-3">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="text-sm">Secure terminal gateway loading...</span>
      </div>
    );
  }

  if (!activeUser) {
    return (
      <AuthScreen 
        onSignUp={handleSignUp} 
        onSignIn={handleSignIn} 
        onGuestLogin={handleGuestLogin}
        isDarkMode={isDarkMode}
      />
    );
  }

  // Wait for server-side role resolution so a Delivery Staff login never
  // flashes the Admin/Sales PIN screen, even for a single frame.
  if (deliveryRoleCheckedUid !== activeUser.uid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#080d18] text-white">
        <RefreshCw className="h-7 w-7 animate-spin text-emerald-400" />
        <p className="text-xs font-semibold text-slate-400">Opening your secure workspace…</p>
      </div>
    );
  }

  if (deliveryStaffProfile && deliveryStaffProfile.status !== "active") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080d18] p-5 text-white">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-rose-500/20 bg-slate-900 p-6 text-center">
          <Truck className="mx-auto h-10 w-10 text-rose-400" />
          <h1 className="text-xl font-black">Delivery Access Disabled</h1>
          <p className="text-sm leading-relaxed text-slate-400">This delivery account has been disabled by the Admin. You cannot access deliveries or the POS workspace. Please contact your Admin.</p>
          <button
            onClick={async () => {
              await signOut();
              setActiveUser(null);
              setDeliveryStaffProfile(null);
              setCurrentPanel("none");
              setAdminActionPin("");
            }}
            className="w-full rounded-xl bg-rose-500 px-4 py-3 text-sm font-black text-white"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (deliveryStaffProfile) {
    return (
      <DeliveryDriverView
        key={String(activeUser?.uid || "delivery-driver")}
        staff={deliveryStaffProfile}
        currencySymbol={businessInfo.currencySymbol || "৳"}
        onLogout={async () => {
          await signOut();
          setActiveUser(null);
          setDeliveryStaffProfile(null);
          setCurrentPanel("none");
          setAdminActionPin("");
        }}
      />
    );
  }

  const handlePanelUnlock = async (panel: "admin" | "sales", pin: string) => {
    if (activeUser?.isGuest) {
      // Guest mode is an isolated sandbox and does not expose authenticated store data.
      setCurrentPanel(panel);
      setAdminActionPin("");
      setActiveTab(panel === "sales" ? "pos" : "dashboard");
      triggerNotification(`${panel === "admin" ? "Admin Panel" : "Sales Panel"} sandbox opened.`, "success");
      return;
    }

    const firebaseUser = firebaseAuth.currentUser;
    const storeId = String(activeUser?.email || "").trim().toLowerCase();
    if (!firebaseUser || !storeId || firebaseUser.email?.trim().toLowerCase() !== storeId) {
      throw new Error("Your secure login session is not ready. Please log out and sign in again.");
    }

    // A previously authenticated device must remain usable when Firestore is
    // temporarily unavailable. Only use the PIN already cached for this exact
    // Firebase UID/store; never use a shared/global PIN or another account's data.
    const unlockFromThisDeviceCache = () => {
      const cachedPin = String(panel === "admin" ? businessInfo.adminPasscode || "" : businessInfo.salesPasscode || "");
      if (!/^[0-9]{4}$/.test(cachedPin) || cachedPin !== pin) return false;
      setCurrentPanel(panel);
      setAdminActionPin(panel === "admin" ? pin : "");
      setActiveTab(panel === "sales" ? "pos" : "dashboard");
      triggerNotification("Offline access: this device's saved PIN was verified. Cloud sync will resume when available.", "info");
      return true;
    };

    // When the app has already detected Firestore daily quota exhaustion, use
    // the matching PIN cached for this exact signed-in UID/store immediately.
    // This is the previous offline-entry behavior; no cross-account/global PIN is used.
    if (isFirestoreQuotaLimited && unlockFromThisDeviceCache()) return;

    const isQuotaExhaustion = (payload: any) => /resource[_\s-]?exhausted|daily usage limit|quota.{0,40}(?:exceeded|exhausted)|(?:exceeded|exhausted).{0,40}quota/i.test(JSON.stringify(payload ?? {}).toLowerCase());
    let cloudTemporarilyUnavailable = false;
    const verificationController = new AbortController();
    const verificationTimeout = window.setTimeout(() => verificationController.abort(), 10000);
    try {
      const warmToken = pinWarmupRef.current;
      const idToken = warmToken && warmToken.uid === firebaseUser.uid && Date.now() - warmToken.warmedAt < 45 * 60 * 1000
        ? warmToken.token
        : await Promise.race([
        firebaseUser.getIdToken(),
        new Promise<string>((_, reject) => {
          verificationController.signal.addEventListener(
            "abort",
            () => reject(new DOMException("PIN verification timed out.", "AbortError")),
            { once: true }
          );
        })
      ]);
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      };

      // Fast path: verify the entered PIN with one server request.
      // Only run legacy migration when the server confirms credentials are not initialized.
      let verifyResponse = await fetch("/api/panel-security/pin/verify", {
        method: "POST",
        headers,
        body: JSON.stringify({ store_id: storeId, role: panel, pin }),
        signal: verificationController.signal
      });
      let verifyData = await verifyResponse.json().catch(() => ({}));
      if (isQuotaExhaustion(verifyData)) cloudTemporarilyUnavailable = true;

      if (!cloudTemporarilyUnavailable && verifyResponse.status === 401) {
        const statusResponse = await fetch(`/api/panel-security/pin/status?store_id=${encodeURIComponent(storeId)}`, { headers, signal: verificationController.signal });
        const statusData = await statusResponse.json().catch(() => ({}));
        if (!statusResponse.ok) {
          if (statusResponse.status >= 500 || isQuotaExhaustion(statusData)) cloudTemporarilyUnavailable = true;
          else throw new Error(statusData.error || "Could not check secure PIN settings.");
        } else if (!statusData.configured) {
          if (!settingsHydrated) {
            throw new Error("PIN setup is still syncing. Please try again in a moment.");
          }
          const migrationResponse = await fetch("/api/panel-security/pin/migrate", {
            method: "POST",
            headers,
            body: JSON.stringify({
              store_id: storeId,
              admin_pin: String(businessInfo.adminPasscode || ""),
              sales_pin: String(businessInfo.salesPasscode || "")
            }),
            signal: verificationController.signal
          });
          const migrationData = await migrationResponse.json().catch(() => ({}));
          if (!migrationResponse.ok || !migrationData.success) {
            if (migrationResponse.status >= 500 || isQuotaExhaustion(migrationData)) cloudTemporarilyUnavailable = true;
            else throw new Error(migrationData.error || "Could not initialize secure panel PINs.");
          } else {
            verifyResponse = await fetch("/api/panel-security/pin/verify", {
              method: "POST",
              headers,
              body: JSON.stringify({ store_id: storeId, role: panel, pin }),
              signal: verificationController.signal
            });
            verifyData = await verifyResponse.json().catch(() => ({}));
            if (isQuotaExhaustion(verifyData)) cloudTemporarilyUnavailable = true;
          }
        }
      }

      if (!cloudTemporarilyUnavailable) {
        if (!verifyResponse.ok || !verifyData.valid) {
          if (verifyResponse.status >= 500) cloudTemporarilyUnavailable = true;
          else throw new Error(verifyData.error || "Incorrect PIN. Please try again.");
        }
      }
    } catch (error: any) {
      // Network failures and service/Firestore outages may use the local cache.
      // Explicit 401/403/429 responses are thrown above and are not bypassed.
      if (!cloudTemporarilyUnavailable && error?.name !== "TypeError" && error?.name !== "AbortError") {
        window.clearTimeout(verificationTimeout);
        throw error;
      }
      cloudTemporarilyUnavailable = true;
    } finally {
      window.clearTimeout(verificationTimeout);
    }

    if (cloudTemporarilyUnavailable) {
      if (unlockFromThisDeviceCache()) return;
      throw new Error("Cloud PIN verification is unavailable, and this device has no matching saved PIN. Please reconnect and try again.");
    }

    setCurrentPanel(panel);
    setAdminActionPin(panel === "admin" ? pin : "");
    setActiveTab(panel === "sales" ? "pos" : "dashboard");
    triggerNotification(`${panel === "admin" ? "Admin Panel" : "Sales Panel"} unlocked successfully.`, "success");
  };

  if (currentPanel === "none") {
    return (
      <PanelGateLock
        isGuest={!!activeUser?.isGuest}
        isDarkMode={isDarkMode}
        onUnlock={handlePanelUnlock}
        onLogout={handleLogOut}
      />
    );
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-[#121214] text-white font-sans flex flex-col md:flex-row" id="terminal-layout">
      
      {/* -------------------- SIDE NAVIGATION RAIL -------------------- */}
      <aside className="hidden md:flex md:w-64 md:h-screen md:sticky md:top-0 bg-[#1E1E24] border-r border-[#2A2A32] p-5 flex flex-col justify-between shrink-0 shadow-xl z-30" id="sidebar">
        
        <div className="flex-1 overflow-y-auto pr-1 space-y-6" id="sidebar-top-container" style={{ scrollbarWidth: "thin" }}>
          {/* Main Logo Card */}
          <div className="flex items-center gap-3 pb-4 border-b border-[#2D2D35]" id="sidebar-logo">
            <div className="w-10 h-10 flex items-center justify-center bg-[#00E676]/10 rounded-xl text-[#00E676] border border-[#00E676]/20 overflow-hidden shrink-0">
              {businessInfo.companyLogo && (businessInfo.companyLogo.startsWith("data:") || businessInfo.companyLogo.startsWith("http")) ? (
                <img src={businessInfo.companyLogo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="font-extrabold text-sm truncate">{businessInfo.companyLogo || "⚡"}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-extrabold text-xs text-white tracking-wide uppercase font-display leading-tight truncate">{businessInfo.name}</h2>
              <span className="text-[10px] text-[#00E676] font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse inline-block" />
                <span className="truncate">{currentPanel === 'admin' ? 'Admin Mode' : 'Sales Mode'}</span>
              </span>
            </div>
          </div>

          {/* Core Navigation Links */}
          <nav className="space-y-1.5" id="sidebar-navigation">
            <p className="text-[10px] uppercase font-mono tracking-widest text-[#A0A0A5] pl-1.5 mb-2 font-bold">
              {currentPanel === "admin" ? "Admin Controls" : "Sales Terminal"}
            </p>
            
            {currentPanel === "admin" ? (
              <>
                {([
                  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
                  { id: "pos", label: "Sales POS", Icon: ShoppingCart },
                  { id: "contacts", label: "Customers", Icon: Users },
                  { id: "ledger", label: "Ledger Box", Icon: FileText },
                  { id: "products", label: "Products", Icon: Package },
                  { id: "expenses", label: "Expenses", Icon: ReceiptText },

                  { id: "purchases", label: "Purchases", Icon: PlusCircle },
                  { id: "inventory", label: "All Stock", Icon: Bookmark },
                  { id: "duelist", label: "All Due List", Icon: History },
                  { id: "reports", label: "Reports", Icon: BarChart3 },
                  { id: "staff", label: "Staff Hub", Icon: UserCheck },
                  { id: "delivery", label: "Delivery Management", Icon: Truck },
                  { id: "settings", label: "Settings", Icon: Settings },
                ] as const)
                .map((item) => {
                  const Icon = item.Icon;
                  const isActive = activeTab === item.id;
                  const hasAlert = "alert" in item && Boolean((item as any).alert);
                  return (
                    <button
                      key={item.id}
                      id={`tab-${item.id}-btn`}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${hasAlert
                        ? (isActive ? 'bg-[#FF5252]/10 text-[#FF5252] border border-[#FF5252]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent')
                        : (isActive ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent')}`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${hasAlert ? 'text-[#FF5252]' : ''}`} />
                      <span className="text-xs font-semibold leading-none">{item.label}</span>
                    </button>
                  );
                })}
              </>
            ) : (
              <>
                <button
                  id="tab-pos-btn"
                  onClick={() => setActiveTab("pos")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'pos' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Sales
                </button>

                <button
                  id="tab-contacts-btn"
                  onClick={() => setActiveTab("contacts")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'contacts' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <Users className="w-4 h-4" />
                  Add Customer
                </button>

                <button
                  id="tab-products-btn"
                  onClick={() => setActiveTab("products")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'products' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <Package className="w-4 h-4" />
                  Products
                </button>

                <button
                  id="tab-ledger-btn"
                  onClick={() => setActiveTab("ledger")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'ledger' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <FileText className="w-4 h-4" />
                  Ledger
                </button>

                <button
                  id="tab-delivery-btn"
                  onClick={() => setActiveTab("delivery")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'delivery' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <Truck className="w-4 h-4" />
                  Delivery Management
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Panel Switch & User Footer Block */}
        <div className="pt-4 border-t border-[#2D2D35] space-y-3" id="sidebar-user-footer">
          
          {/* Active Mode indicator badge as requested */}
          <div className="bg-[#121214] border border-[#2D2D35] p-3 rounded-xl space-y-1.5 text-center flex flex-col items-center" id="user-info-badge">
            <span className="text-[9px] uppercase tracking-wider font-mono text-[#A0A0A5] block font-bold">Terminal Mode</span>
            
            {activeUser?.isGuest ? (
              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold font-sans">
                Guest Mode
              </span>
            ) : (
              <div className="space-y-1">
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/10 font-bold font-sans">
                  User Mode
                </span>
                <span className="text-[10px] text-[#A0A0A5] font-mono truncate block max-w-[180px]" title={activeUser?.email}>
                  {activeUser?.email}
                </span>
              </div>
            )}
          </div>

          {/* Quick Switch Button from Admin -> Sales, and secure transition back to Admin */}
          {currentPanel === "admin" ? (
            <button
              type="button"
              onClick={() => {
                setCurrentPanel("sales");
                setAdminActionPin("");
                setActiveTab("pos");
                triggerNotification("Switched to Sales Panel", "info");
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-750 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-605 border border-blue-600 dark:border-blue-600 cursor-pointer transition-all shadow-sm"
            >
              Go to Sales Terminal &rarr;
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCurrentPanel("none");
                setAdminActionPin("");
                triggerNotification("Enter passcode to unlock admin controls", "info");
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-[#00E676] bg-[#00E676]/10 hover:bg-[#00E676]/20 border border-[#00E676]/20 cursor-pointer transition-all"
            >
              &larr; Admin Access
            </button>
          )}

          <button
            id="signout-session-btn"
            onClick={handleLogOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 cursor-pointer transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log Out
          </button>
        </div>

      </aside>

      {/* -------------------- MAIN WORKSPACE VIEWPORT -------------------- */}
      <main className="flex-1 min-w-0 bg-[#070b13] flex flex-col md:h-screen md:overflow-hidden pb-20 md:pb-0" id="viewport-workspace">
        
        {/* TOP STATUS BAR */}
        <header className="bg-[#0a101f]/90 backdrop-blur border-b border-slate-800/80 px-4 py-3 md:px-6 md:py-4 flex items-center justify-between gap-2 z-40 sticky top-0 animate-fadeIn" id="top-navbar">
          
          <div id="active-tab-title-display" className="min-w-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/10" />
              <h1 className="text-sm md:text-lg font-bold text-white tracking-wide font-display truncate">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'reports' && 'Reports'}
                {activeTab === 'products' && 'Product Settings'}
                {activeTab === 'negative-sales' && 'Stock Alert'}
                {activeTab === 'purchases' && 'Purchases Ledger'}
                {activeTab === "pos" && "Counter Cash Memo"}
                {activeTab === 'inventory' && (stockSubTab === "home" ? "All Stock" : stockSubTab === "stock-value" ? "Stock Value" : stockSubTab === "sales-value" ? "Sales Value" : stockSubTab === "edit-stock" ? "Edit Stock" : "Out of Stock")}
                {activeTab === 'ledger' && 'Ledger Account'}
                {activeTab === 'expenses' && 'Expenses'}
                {activeTab === 'contacts' && 'Customers Directory'}
                {activeTab === 'duelist' && 'All Due List'}
                {activeTab === 'staff' && 'Staff Hub'}
                {activeTab === 'settings' && 'System Settings'}
              </h1>
            </div>
            <p className="hidden md:block text-xs text-slate-400 pl-4.5 mt-0.5 max-w-xl truncate">
              {activeTab === 'dashboard' && 'Real-time profit margins, revenue trackers and diagnostic charts.'}
              {activeTab === 'reports' && 'P&L, Gross Margin and comprehensive financial ledger.'}
              {activeTab === 'products' && 'Configure unit prices and options. Cost parameters are locked.'}
              {activeTab === 'negative-sales' && 'Adjust purchase rate on negative quantity sales to reflect correct net income metrics.'}
              {activeTab === 'purchases' && 'Log fresh supplier purchases, add bulk stocks, and assign actual values.'}
              {activeTab === "pos" && "Point-of-Sale Checkout terminal. Easily add items to cart and print receipt."}
              {activeTab === 'inventory' && 'Track physical stocks, inventory valuations, and supplier purchases/credit accounts.'}
              {activeTab === 'ledger' && 'Acknowledge transactions, review accounts receivable and enter payments due.'}
              {activeTab === 'expenses' && 'Record administrative costs, electricity bills, and monthly outlays.'}
              {activeTab === 'contacts' && 'CRM and suppliers contact list.'}
              {activeTab === 'settings' && 'Configure printed receipt company address, contact phone, and variables.'}
            </p>
          </div>



        </header>

        {/* -------------------- MAIN SCROLLABLE VIEWPORT CONTENT -------------------- */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6" id="scrollable-content-area">

          {/* DYNAMIC SUCCESS POPUP ANIMATION OVERLAY */}
          {successTriggerMsg && (
            <div 
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[99999] flex items-center justify-center animate-fade-in"
              id="success-pulse-overlay"
            >
              <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl shadow-emerald-500/15 transform animate-scale-up-bounce" id="success-pulse-card">
                <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 relative animate-ping-once">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-base font-extrabold text-white tracking-tight mb-1">
                  Saved Successfully!
                </h3>
                <p className="text-[11px] text-slate-300 bg-slate-950/50 py-2 px-3.5 rounded-xl font-medium max-w-xs mx-auto border border-slate-800/80">
                  {successTriggerMsg}
                </p>
                <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden mt-5">
                  <div className="bg-emerald-500 h-full w-full rounded-full animate-shrink-bar" style={{ animationDuration: "1600ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC GENERAL TEMPORAL NOTIFICATION */}
          {notification && (
            <div 
              className={`mx-auto w-fit max-w-[calc(100vw-2rem)] px-3 py-2 rounded-lg shadow-lg border animate-slideIn flex items-center justify-between text-[11px] font-medium relative overflow-hidden ${
                notification.type === "success" 
                  ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-400" 
                  : notification.type === "error" 
                    ? "bg-rose-950/40 border-rose-500/20 text-rose-400" 
                    : "bg-slate-900 border-slate-800 text-slate-300"
              }`}
              id="dynamic-toast-message"
            >
              <div className="flex items-center gap-2">
                {notification.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                <span>{notification.message}</span>
              </div>
            </div>
          )}

          {/* -------------------- VIEW 0: BUSINESS DASHBOARD & PERIOD FILTERS -------------------- */}
          {activeTab === "dashboard" && (
            <DashboardView
              products={products}
              transactions={transactions}
              storeEmail={activeUser?.email || firebaseAuth.currentUser?.email || ""}
              businessInfo={businessInfo}
              onRefresh={() => window.location.reload()}
              onDataImport={handleDataImport}
              onNavigate={(tab) => {
                setActiveTab(tab);
                triggerNotification(`${tab} view initialized`, "info");
              }}
              dashboardFilter={dashboardFilter}
              setDashboardFilter={setDashboardFilter}
              customStart={customStart}
              setCustomStart={setCustomStart}
              customEnd={customEnd}
              setCustomEnd={setCustomEnd}
              totalSalesTk={totalSalesTk}
              totalExpensesTk={totalExpensesTk}
              totalOutstandingDueTk={totalOutstandingDueTk}
              totalPurchasesTk={totalPurchasesTk}
              totalUnitsSold={totalUnitsSold}
              netProfitAmt={netProfitAmt}
              ledgerTrendsPlotData={ledgerTrendsPlotData}
              expenseCategoryPlotData={expenseCategoryPlotData}
            />
          )}

          {/* -------------------- VIEW REPORTS: ELITE REPORTING SYSTEMS -------------------- */}
          {activeTab === "reports" && (
            <ReportsView
              products={products}
              transactions={transactions}
              expenses={expenses}
              additionalExpenses={paidDeliveryExpenses}
              purchases={purchases}
              contacts={contacts}
              businessInfo={businessInfo}
              currencySymbol={businessInfo?.currencySymbol || "৳"}
            />
          )}

          {/* -----------------------------------------------------------------
              VIEW 1: POS BILLING WORKSPACE & LIVE INVOICE CARTRIDGE
              ----------------------------------------------------------------- */}
          {activeTab === "pos" && (
            <div className="space-y-6 w-full animate-slideDown" id="view-pos-container-wrapper">
              
              {/* POS Terminal Sub-Tab Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl" id="pos-terminal-tab-selector-bar">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                    <ShoppingCart className="w-5 h-5 shrink-0" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5 font-display">
                      POS Terminal
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/10 font-mono font-medium normal-case">Sales Desk</span>
                    </h2>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-sans">Counter billing, available catalog lookup and receipt reprinting list</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 font-sans text-xs">
                  <button
                    onClick={() => {
                      resetPosWorkspace(posSelectedContactId);
                      setPosTerminalTab("checkout");
                    }}
                    className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      posTerminalTab === "checkout"
                        ? "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/35 shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-900 border-transparent"
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>New Checkout</span>
                  </button>

                  <button
                    onClick={() => {
                      setPosTerminalTab("catalog");
                      setPosProductsSearch("");
                    }}
                    className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      posTerminalTab === "catalog"
                        ? "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/35 shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-900 border-transparent"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Products List</span>
                  </button>

                  <button
                    onClick={() => {
                      setPosTerminalTab("history");
                      setPosTxSearch("");
                    }}
                    className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      posTerminalTab === "history"
                        ? "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/35 shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-slate-900 border-transparent"
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Sales History</span>
                  </button>
                </div>
              </div>

              {posTerminalTab === "checkout" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="view-pos-container">
              
              {/* POS Billing Basket Configuration (8 Cols) */}
              <div className="col-span-1 lg:col-span-8 space-y-6" id="pos-billing-basket-column">
                
                {/* Product picker */}
                <div className="relative z-[1005] bg-[#1E1E24] border border-[#2D2D35] p-6 rounded-2xl space-y-4 shadow-lg" id="pos-product-picker-pnl">
                  <div className="flex items-center gap-2 border-b border-[#2D2D35] pb-3">
                    <span className="w-5 h-5 rounded-lg bg-[#00E676]/10 text-[#00E676] flex items-center justify-center font-bold text-xs">1</span>
                    <h3 className="text-sm font-bold text-white tracking-wide">Select Item & Add to Basket</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end" id="product-picker-inputs">
                    
                     <div className="col-span-1 md:col-span-5 space-y-1.5 relative z-[1001] text-left" id="pos-select-wrap">
                      <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Search & Select Product</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Type product name, SKU, category..."
                          value={posSearchQuery}
                          onChange={(e) => {
                            setPosSearchQuery(e.target.value);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => setShowSuggestions(true)}
                          className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-slate-100 text-xs outline-none focus:border-[#00E676] transition-all font-sans focus:ring-1 focus:ring-[#00E676]/30"
                        />
                        {selectedProductId && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProductId("");
                              setCartItemPrice("");
                              setPosSearchQuery("");
                            }}
                            className="absolute right-3 top-2.5 text-[9px] font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/25 px-1.5 py-1 rounded border border-rose-500/20 transition-all"
                          >
                            Clear Selection
                          </button>
                        )}
                      </div>

                      {/* Floating suggestions dropdown with auto-filtering */}
                      {showSuggestions && (
                        <>
                          <div className="fixed inset-0 z-0" onClick={() => setShowSuggestions(false)} />
                          <div className="pos-product-suggestions absolute top-full left-0 right-0 z-10 mt-1.5 max-h-[min(65vh,520px)] overflow-y-auto overscroll-contain touch-pan-y bg-[#101722]/[0.98] border border-slate-600/70 rounded-xl shadow-[0_24px_70px_rgba(0,0,0,0.82)] p-1.5 divide-y divide-slate-600/30 scrollbar-thin scrollbar-thumb-slate-600 font-sans">
                            {(() => {
                              const term = posSearchQuery.toLowerCase().trim();
                              const filtered = products.filter(p => {
                                if (!term) return true;
                                const target = `${p.name || ""} ${p.sku || ""} ${p.category || ""}`.toLowerCase();
                                // Match any typed substring anywhere in the product name, SKU, or category.
                                // For multi-word searches, every word may match independently.
                                const searchWords = term.split(/\s+/).filter(Boolean);
                                return target.includes(term) || searchWords.every(word => target.includes(word));
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-3 text-xs text-[#A0A0A5] italic text-center">
                                    No products found matching "{posSearchQuery}"
                                  </div>
                                );
                              }

                              return filtered.map(p => {
                                const isSelected = p.id === selectedProductId;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedProductId(p.id);
                                      setCartItemPrice(p.sellPrice.toString());
                                      setPosSearchQuery(p.name);
                                      setShowSuggestions(false);
                                      triggerNotification(`Selected product: ${p.name}`, "info");
                                    }}
                                    className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between text-xs hover:bg-[#00E676]/15 hover:text-white transition-all cursor-pointer ${isSelected ? "bg-[#00E676]/10 text-[#00E676] font-bold" : "text-slate-300"}`}
                                  >
                                    <div className="min-w-0 pr-2">
                                      <div className="font-bold truncate text-white">{p.name}</div>
                                      <div className="text-[9px] text-[#A0A0A5] font-mono mt-0.5">
                                        SKU: {p.sku || "N/A"} <span className="text-slate-600">|</span> Stock: {p.stock} {p.unit}
                                      </div>
                                    </div>
                                    <div className="shrink-0 text-right font-mono font-bold text-[#00E676] bg-[#00E676]/5 px-2 py-0.5 rounded border border-[#00E676]/10">
                                      {businessInfo.currencySymbol}{p.sellPrice}
                                    </div>
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="col-span-1 md:col-span-2 space-y-1.5" id="pos-qty-wrap">
                      <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Quantity</label>
                      <input
                        type="number"
                        min={1}
                        id="pos-qty-input"
                        value={cartItemQty}
                        onChange={(e) => setCartItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white text-xs outline-none focus:border-[#00E676] text-center font-mono focus:ring-1 focus:ring-[#00E676]/30"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2 space-y-1.5" id="pos-price-wrap">
                      <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Unit Price ({businessInfo.currencySymbol})</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        id="pos-price-input"
                        value={cartItemPrice}
                        onChange={(e) => setCartItemPrice(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white text-xs outline-none focus:border-[#00E676] text-center font-mono font-bold focus:ring-1 focus:ring-[#00E676]/30"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-1.5" id="pos-warranty-wrap">
                      <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Warranty (Optional)</label>
                      <input type="text" id="pos-warranty-input" value={cartItemWarranty} onChange={(e) => setCartItemWarranty(e.target.value)} placeholder="e.g. 3 Months / 1 Year" className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white text-xs outline-none focus:border-[#00E676] text-center font-mono focus:ring-1 focus:ring-[#00E676]/30" />
                    </div>

                    <button
                      type="button"
                      id="pos-add-to-cart-btn"
                      onClick={addProductToCart}
                      className="col-span-1 md:col-span-3 w-full py-2.5 px-4 bg-[#00E676] hover:bg-[#00D065] text-[#121214] font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-[#00E676]/15 self-end h-[38px] md:h-auto"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      Add to Basket
                    </button>

                  </div>
                </div>

                {/* Checkout Basket Cart List - Styled as elegant modern card stacks */}
                <div className="relative z-0 bg-[#1E1E24] border border-[#2D2D35] rounded-2xl overflow-hidden shadow-lg" id="pos-cart-list-pnl">
                  <div className="p-4 bg-[#121214]/50 border-b border-[#2D2D35] flex items-center justify-between" id="pos-cart-header">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-lg bg-[#00E676]/10 text-[#00E676] flex items-center justify-center font-bold text-xs">2</span>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Active Cart Items</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#00E676] font-bold bg-[#00E676]/10 px-2.5 py-1 rounded-full border border-[#00E676]/20">
                        {posCart.length} item lines
                      </span>
                      {posCart.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            resetPosWorkspace(posSelectedContactId);
                            triggerNotification("Cart and product search selection cleared", "info");
                          }}
                          className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline font-mono cursor-pointer flex items-center gap-1 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20 transition-all"
                          title="Reset cart items"
                        >
                          <Trash2 className="w-3 h-3" /> Clear Cart
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-5 space-y-3.5" id="pos-cart-items-stack">
                    {posCart.length === 0 ? (
                      <div className="py-16 text-center flex flex-col items-center justify-center space-y-3 text-[#A0A0A5]">
                        <div className="p-4 bg-white/5 rounded-full text-slate-600 border border-[#2D2D35] animate-pulse">
                          <ShoppingCart className="w-8 h-8 text-[#A0A0A5]/40" />
                        </div>
                        <p className="text-xs italic">
                          Your checkout tray is currently empty. Choose products from above to load.
                        </p>
                      </div>
                    ) : (
                      posCart.map((item, index) => (
                        <div 
                          key={index} 
                          className="bg-[#121214] p-4 rounded-xl border border-[#2D2D35] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-[#00E676]/20 group"
                          id={`cart-item-card-${index}`}
                        >
                          {/* Left Details block */}
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-[#00E676]/10 text-[#00E676] flex items-center justify-center shrink-0 border border-[#00E676]/10 overflow-hidden">
                              {item.product.imageUrl ? (
                                <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <Package className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-white group-hover:text-[#00E676] transition-colors">{item.product.name}</div>
                              {item.warranty && <div className="text-[10px] text-amber-400 font-semibold mt-0.5">Warranty: {item.warranty}</div>}
                              <div className="text-[10px] font-mono text-[#A0A0A5] mt-0.5">
                                SKU: {item.product.sku} <span className="mx-1 text-[#2D2D35]">•</span> Stock: {item.product.stock} {item.product.unit}
                              </div>
                            </div>
                          </div>

                          {/* Middle Interactive soft +/- counters as requested */}
                          <div className="flex items-center gap-3 bg-[#1E1E24] px-2.5 py-1.5 rounded-lg border border-[#2D2D35] self-start sm:self-center">
                            <button
                              type="button"
                              onClick={() => updateCartQty(index, item.quantity - 1)}
                              className="w-6 h-6 flex items-center justify-center rounded bg-white/5 text-[#A0A0A5] hover:bg-rose-500/10 hover:text-[#FF5252] border border-[#2D2D35] cursor-pointer transition-colors"
                              title="Decrease Qty"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-bold text-xs text-white w-6 text-center font-mono">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(index, item.quantity + 1)}
                              className="w-6 h-6 flex items-center justify-center rounded bg-white/5 text-[#A0A0A5] hover:bg-[#00E676]/15 hover:text-[#00E676] border border-[#2D2D35] cursor-pointer transition-colors"
                              title="Increase Qty"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[9px] text-[#A0A0A5] font-mono uppercase bg-[#121214] px-1 rounded-sm border border-[#2D2D35] ml-1">
                              {item.product.unit}
                            </span>
                          </div>

                          {/* Right side Total & Delete options */}
                          <div className="flex items-center justify-between sm:justify-end gap-5 border-t border-[#2D2D35]/55 pt-2 sm:pt-0 sm:border-0 font-mono">
                            <div className="text-left sm:text-right flex flex-col items-start sm:items-end">
                              <span className="text-xs text-[#00E676] font-bold">
                                {businessInfo.currencySymbol} {(((item.price !== undefined ? item.price : item.product.sellPrice) ?? 0) * (item.quantity ?? 0)).toLocaleString()}
                              </span>
                              
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-[#A0A0A5]">
                                <span className="font-sans text-[9px]">Rate:</span>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.price !== undefined ? item.price : item.product.sellPrice}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    const updated = [...posCart];
                                    updated[index] = {
                                      ...updated[index],
                                      price: isNaN(val) ? 0 : val
                                    };
                                    setPosCart(updated);
                                  }}
                                  className="w-16 px-1.5 py-0.5 bg-[#121214] border border-[#3A3A42] focus:border-[#00E676] rounded text-[10px] text-white font-mono text-center outline-none transition-all font-bold focus:ring-1 focus:ring-[#00E676]/20"
                                  title="Edit unit price of this item"
                                />
                                <span className="font-sans text-[9px]">each</span>
                              </div>
                            </div>

                            <button
                              id={`remove-cart-item-btn-${index}`}
                              onClick={() => removeProductFromCart(index)}
                              className="p-1.5 bg-white/5 hover:bg-[#FF5252]/10 rounded-lg transition-all text-[#FF5252]/70 hover:text-[#FF5252] cursor-pointer border border-transparent hover:border-[#FF5252]/20"
                              title="Remove line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                        </div>
                      ))
                    )}
                  </div>

                  {/* Cart financial metrics footer */}
                  {posCart.length > 0 && (
                    <div className="bg-[#121214]/60 px-6 py-4 border-t border-[#2D2D35] text-right" id="cart-quick-calc">
                      <p className="text-xs text-[#A0A0A5] font-mono">
                        Subtotal Accumulation: <span className="text-white ml-2 font-bold font-sans text-sm">{businessInfo.currencySymbol} {(cartSubtotal ?? 0).toLocaleString()}</span>
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* POS Summary Drawer, Customer Pairing, Signature, Checkout (4 Cols) */}
              <div className="col-span-1 lg:col-span-4 space-y-6" id="pos-summary-checkout-column">
                
                <div className="bg-[#1E1E24] border border-[#2D2D35] p-6 rounded-2xl space-y-5 shadow-lg" id="pos-checkout-pnl">
                  <div className="flex items-center gap-2 border-b border-[#2D2D35] pb-3">
                    <span className="w-5 h-5 rounded-lg bg-[#00E676]/10 text-[#00E676] flex items-center justify-center font-bold text-xs">3</span>
                    <h3 className="text-sm font-bold text-white tracking-wide uppercase">Checkout Summary</h3>
                  </div>

                  {/* Custom invoice date picker option */}
                  <div className="space-y-1.5" id="pos-billing-date-wrapper">
                    <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Invoice / Transaction Date</label>
                    <input
                      type="date"
                      value={posCustomDate}
                      onChange={(e) => setPosCustomDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white text-xs outline-none focus:border-[#00E676] font-mono focus:ring-1 focus:ring-[#00E676]/30 cursor-pointer"
                    />
                  </div>

                  {/* Customer dropdown map */}
                  <div className="space-y-1.5" id="pos-contact-link">
                    <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Link Directory Customer</label>
                    <select
                      id="pos-customer-select"
                      value={posSelectedContactId}
                      onChange={(e) => {
                        const newCId = e.target.value;
                        if (posCart.length > 0) {
                          resetPosWorkspace(newCId);
                          triggerNotification("Started fresh cart for selected customer", "info");
                        } else {
                          setPosSelectedContactId(newCId);
                        }
                      }}
                      className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-slate-200 text-xs outline-none focus:border-[#00E676] transition-all font-sans cursor-pointer focus:ring-1 focus:ring-[#00E676]/30"
                    >
                      <option value="">-- Regular Walk-in Customer --</option>
                      {contacts.filter(c => c.type === "customer").map((c) => (
                        <option key={c.id} value={c.id} className="bg-[#1E1E24]">
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dynamic payment options */}
                  <div className="grid grid-cols-2 gap-3" id="pos-payments-and-amounts">
                    <div className="space-y-1.5" id="pos-pay-method-wrap">
                      <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1 block">Payment Method</label>
                      <select
                        id="pos-pay-method-select"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-slate-200 text-xs outline-none focus:border-[#00E676] font-sans cursor-pointer"
                      >
                        <option value="Cash" className="bg-[#1E1E24]">Cash</option>
                        <option value="bKash" className="bg-[#1E1E24]">bKash (MFS)</option>
                        <option value="Nagad" className="bg-[#1E1E24]">Nagad (MFS)</option>
                        <option value="Card" className="bg-[#1E1E24]">Card Payment</option>
                        <option value="Due" className="bg-[#1E1E24]">Due Ledger</option>
                      </select>
                    </div>

                    <div className="space-y-1.5" id="pos-pay-amount-wrap">
                      <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1 block">Amount Received</label>
                      <input
                        type="number"
                        min={0}
                        id="pos-pay-amount-input"
                        placeholder="0"
                        value={amountPaidPaid}
                        onChange={(e) => setAmountPaidPaid(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white text-xs outline-none focus:border-[#00E676] font-mono focus:ring-1 focus:ring-[#00E676]/30"
                      />
                    </div>
                  </div>

                  {/* Prominent advanced settings trigger popover toggle */}
                  <div className="pt-1.5" id="advanced-settings-toggle">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedPos(!showAdvancedPos)}
                      className="w-full text-xs font-bold py-2 px-3 border border-[#2D2D35] bg-[#121214]/40 hover:bg-[#121214]/90 rounded-xl flex items-center justify-center gap-1.5 transition-colors text-[#A0A0A5] hover:text-white cursor-pointer select-none"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#00E676]" />
                      {showAdvancedPos ? "Hide Adjustments Menu" : "More Actions & Adjustments"}
                    </button>
                  </div>

                  {/* Advanced settings area - collapsible as requested */}
                  {showAdvancedPos && (
                    <div className="space-y-4 pt-3 border-t border-[#2D2D35] animate-fade-in" id="pos-advanced-inputs-panel">
                      
                      {/* Discount input */}
                      <div className="space-y-1.5" id="pos-discount-link">
                        <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Discount/Reduction (Amount)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-[#A0A0A5] text-xs font-mono font-bold">{businessInfo.currencySymbol}</span>
                          <input
                            type="number"
                            min={0}
                            id="pos-discount-input"
                            placeholder="0"
                            value={customerDiscount || ""}
                            onChange={(e) => setCustomerDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full px-3 py-2.5 pl-7 bg-[#121214] border border-[#2D2D35] rounded-xl text-white text-xs outline-none focus:border-[#00E676] font-mono focus:ring-1 focus:ring-[#00E676]/30"
                          />
                        </div>
                      </div>

                      {/* VAT percentage slider removed per user request (kono lenden % thakbe na) */}

                      {/* Interactive digital Signature Board */}
                      <div className="border border-[#2D2D35] rounded-xl p-3 bg-[#121214] font-mono space-y-2 relative" id="signature-canvas-container">
                        <div className="flex items-center justify-between border-b border-[#2D2D35]/60 pb-1.5">
                          <span className="text-[10px] font-bold text-[#A0A0A5] tracking-wider flex items-center gap-1">
                            <PenTool className="w-3 h-3 text-[#00E676]" />
                            Capture Sign
                          </span>
                          <button
                            type="button"
                            id="clear-signature-btn"
                            onClick={clearSignatureCanvas}
                            className="text-[9px] hover:text-white text-slate-500 font-semibold cursor-pointer underline flex items-center gap-0.5"
                          >
                            <Eraser className="w-2.5 h-2.5" />
                            Remove
                          </button>
                        </div>

                        <canvas
                          ref={signatureCanvasRef}
                          width={300}
                          height={90}
                          onMouseDown={startSignatureDrawing}
                          onMouseMove={drawSignature}
                          onMouseUp={stopDrawingSignature}
                          onMouseLeave={stopDrawingSignature}
                          onTouchStart={startSignatureDrawing}
                          onTouchMove={drawSignature}
                          onTouchEnd={stopDrawingSignature}
                          className="w-full bg-[#0a101f]/3 w-full rounded-lg border border-[#2D2D35] cursor-crosshair focus:outline-none"
                        />
                      </div>

                    </div>
                  )}

                  {/* Calculations breakdown and bill button */}
                  <div className="border-t border-[#2D2D35] pt-4 space-y-2.5 font-mono text-xs text-[#A0A0A5]" id="pos-final-calculation-summary">
                    <div className="flex justify-between items-center">
                      <span>Receipt Subtotal:</span>
                      <span className="text-white font-bold">{businessInfo.currencySymbol} {(cartSubtotal ?? 0).toLocaleString()}</span>
                    </div>

                    {invoiceTaxRate > 0 && (
                      <div className="flex justify-between items-center">
                        <span>Vat Tax Liability:</span>
                        <span className="text-[#00B0FF]">+{businessInfo.currencySymbol} {calculatedTaxAmount}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span>Subtotal Rebates:</span>
                      <span className="text-[#FF5252]">-{businessInfo.currencySymbol} {customerDiscount}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm font-sans pt-3.5 border-t border-[#2D2D35]">
                      <span className="text-white font-extrabold text-xs uppercase tracking-wide">Final Grand Total:</span>
                      <span className="text-[#00E676] text-xl font-extrabold">{businessInfo.currencySymbol} {(invoiceGrandTotal ?? 0).toLocaleString()}</span>
                    </div>

                    {computedInvoiceDueBalance > 0 && (
                      <div className="p-2.5 bg-[#FF5252]/10 rounded-xl border border-[#FF5252]/20 flex justify-between items-center text-[10px] text-[#FF5252] font-bold">
                        <span>Account Outstanding due:</span>
                        <span>{businessInfo.currencySymbol} {computedInvoiceDueBalance}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    id="submit-billing-btn"
                    onClick={handleGenerateInvoice}
                    disabled={posCart.length === 0}
                    className="w-full py-4 text-xs font-bold uppercase tracking-widest bg-gradient-to-r from-[#00E676] to-[#00B0FF] text-[#121214] hover:from-[#00FF85] hover:to-[#00D0FF] rounded-xl transition-all shadow-lg shadow-[#00E676]/15 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-display"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    Confirm & Print Receipt
                  </button>

                  <p className="text-[10px] text-center text-[#A0A0A5] leading-normal pt-1">
                    System instantly commits values, opens digital invoice print, and deducts catalog inventory stock.
                  </p>

                </div>

              </div>

            </div>
          )}

          {/* BRAND NEW SALESMAN VIEW: AVAILABLE PRODUCTS CATALOG */}
          {posTerminalTab === "catalog" && (
            <div className="space-y-6 animate-slideDown" id="pos-catalog-view-panel">
              {/* Search and filter toolbar */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-[#0a101f]/80 border border-slate-800 rounded-2xl shadow-xl">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    Available Products Catalog
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Quickly view and query products to sell. Click "Add to Basket" to add items with 1-click.
                  </p>
                </div>

                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="Search products by name or SKU..."
                    value={posProductsSearch}
                    onChange={(e) => setPosProductsSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#050912] border border-slate-800 rounded-xl text-slate-200 text-xs outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Grid layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" id="pos-catalog-cards-grid">
                {(() => {
                  const filteredList = products.filter(p => {
                    const term = posProductsSearch.toLowerCase().trim();
                    if (!term) return true;
                    return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term);
                  });

                  if (filteredList.length === 0) {
                    return (
                      <div className="col-span-full py-16 text-center text-slate-500 font-sans">
                        No matching products found. Check your search query.
                      </div>
                    );
                  }

                  return filteredList.map((p) => {
                    const isInStock = p.stock > 0;
                    const cartOccurrences = posCart.find(item => item.product.id === p.id)?.quantity || 0;

                    return (
                      <div 
                        key={p.id}
                        className={`bg-[#1E1E24] border rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 ${
                          cartOccurrences > 0 
                            ? 'border-[#00E676] bg-[#00E676]/5 shadow-md shadow-[#00E676]/5' 
                            : 'border-slate-800 hover:border-slate-700 hover:bg-[#1f1f28]'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Stock status indicator */}
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800/80">
                              {p.category}
                            </span>
                            <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                              isInStock 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-455 border border-rose-500/20'
                            }`}>
                              {p.stock} {p.unit}
                            </span>
                          </div>

                          {/* Product Image preview or placeholder icon */}
                          <div className="h-28 w-full bg-[#121214] rounded-xl flex items-center justify-center overflow-hidden border border-slate-800/80">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Package className="w-8 h-8 text-slate-600/50" />
                            )}
                          </div>

                          {/* Title / Info */}
                          <div>
                            <h4 className="text-xs font-black text-white tracking-wide truncate" title={p.name}>{p.name}</h4>
                            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">SKU: {p.sku}</span>
                          </div>

                          {/* Pricing */}
                          <div className="flex items-baseline justify-between pt-1 font-mono">
                            <span className="text-[9px] text-slate-500 font-sans uppercase">Sale Rate:</span>
                            <span className="text-xs font-black text-[#00E676]">
                              {businessInfo.currencySymbol} {p.sellPrice.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions block */}
                        <div className="pt-4 mt-4 border-t border-slate-800 flex flex-col gap-2">
                          {cartOccurrences > 0 ? (
                            <div className="flex items-center justify-between text-[10px] font-sans font-semibold text-[#00E676] bg-[#00E676]/10 px-3 py-1 rounded-lg border border-[#00E676]/25">
                              <span>Added to Basket</span>
                              <span className="font-mono font-bold">Qty: {cartOccurrences}</span>
                            </div>
                          ) : (
                            <div className="h-5" />
                          )}
                          <button
                            type="button"
                            onClick={() => addSpecificProductToCart(p, 1)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer w-full ${
                              isInStock 
                                ? 'bg-[#00E676] hover:bg-[#00D065] text-slate-950 font-black' 
                                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 border border-rose-500/15'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            {isInStock ? "Add to Basket" : "Force Add Out-of-Stock"}
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* BRAND NEW SALESMAN VIEW: COMPLETED SALES REGISTRY & DIRECT REPRINTING */}
          {posTerminalTab === "history" && (
            <div className="space-y-6 animate-slideDown" id="pos-history-view-panel">
              {/* Search and control bar */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-[#0a101f]/80 border border-slate-800 rounded-2xl shadow-xl">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-400" />
                    Sales Registry & Receipt Dispatch
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    View transactions, trace user memo records, and reprint or download delivery receipts anytime.
                  </p>
                </div>

                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="Search invoice number, client info..."
                    value={posTxSearch}
                    onChange={(e) => setPosTxSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#050912] border border-slate-800 rounded-xl text-slate-200 text-xs outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Desktop / responsive sales log table */}
              <div className="w-full bg-[#0a101f]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg" id="pos-history-table-wrapper">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 font-mono">
                    <thead>
                      <tr className="bg-slate-950/40 border-b border-slate-800 text-[10px] uppercase font-mono tracking-wider text-slate-400">
                        <th className="py-3.5 px-4">Invoice No</th>
                        <th className="py-3.5 px-4">Date & Time</th>
                        <th className="py-3.5 px-4 font-sans">Customer Reference</th>
                        <th className="py-3.5 px-4 text-center">Items Count</th>
                        <th className="py-3.5 px-4 text-right">Invoice Total</th>
                        <th className="py-3.5 px-4 text-right">Cash Received</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {(() => {
                        const filteredInvoices = transactions.filter(t => {
                          const term = posTxSearch.toLowerCase().trim();
                          if (!term) return true;
                          const contact = contacts.find(c => c.id === t.contactId);
                          const contactName = contact ? contact.name.toLowerCase() : "";
                          return t.invoiceNo.toLowerCase().includes(term) || contactName.includes(term);
                        });

                        if (filteredInvoices.length === 0) {
                          return (
                            <tr>
                              <td colSpan={8} className="py-16 text-center text-slate-500 font-sans">
                                No completed sales transactions logged. Start selling in "New Checkout" tab to record transaction invoices.
                              </td>
                            </tr>
                          );
                        }

                        return filteredInvoices.map((t) => {
                          const transDate = new Date(t.date);
                          const isPaid = t.status === "paid";
                          const listContact = contacts.find(c => c.id === t.contactId);

                          return (
                            <tr key={t.id} className="hover:bg-slate-900/10 text-slate-300">
                              <td className="py-4 px-4 font-bold text-emerald-450">{t.invoiceNo}</td>
                              <td className="py-4 px-4 text-slate-400 text-[10px]">
                                {transDate.toLocaleDateString()} {transDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="py-4 px-4 font-sans font-semibold text-white">
                                {listContact ? (
                                  <div>
                                    <span>{listContact.name}</span>
                                    <span className="block text-[9px] font-mono text-slate-500 font-normal mt-0.5">{listContact.phone}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">Walk-in Customer</span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-center font-bold text-white">
                                {t.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} units
                              </td>
                              <td className="py-4 px-4 text-right text-slate-200 font-bold">
                                {businessInfo.currencySymbol} {t.total.toLocaleString()}
                              </td>
                              <td className="py-4 px-4 text-right text-emerald-400 font-bold">
                                {businessInfo.currencySymbol} {t.paidAmount.toLocaleString()}
                              </td>
                              <td className="py-4 px-4 text-center font-sans">
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/35 px-2.5 py-0.5 rounded-full text-[9px] font-bold text-emerald-400">
                                    Paid
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/35 px-2.5 py-0.5 rounded-full text-[9px] font-bold text-amber-500">
                                    {t.status === "partial" ? "Partial" : "Due"}
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-center font-sans">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      generateInvoicePDF(t, listContact, businessInfo)
                                        .then(() => {
                                          triggerNotification(`Receipt reprinted & downloaded for ${t.invoiceNo}!`, "success");
                                        })
                                        .catch(err => {
                                          console.error(err);
                                          triggerNotification("Failed to reprint receipt", "error");
                                        });
                                    }}
                                    className="px-3 py-1.5 bg-[#00E676] hover:bg-[#00D065] text-slate-950 font-black text-[10px] rounded-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-md shadow-[#00E676]/5 duration-150 flex items-center gap-1.5 font-sans"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    Reprint Receipt
                                  </button>
                                  {currentPanel === "admin" && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingTx(t);
                                      }}
                                      className="px-3 py-1.5 bg-[#00B0FF] hover:bg-[#0091EA] text-slate-950 font-black text-[10px] rounded-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-md shadow-[#00B0FF]/15 duration-150 flex items-center gap-1.5 font-sans"
                                      title="Edit sale details, item rates, quantity, and cash metrics"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      Edit Sale
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

          {/* -------------------- VIEW 1.1: MODULAR CATALOGS -------------------- */}
          {activeTab === "products" && (
            <ProductsView
              products={products}
              onAddProduct={(prod) => {
                const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();
                const parsedProduct: Product = {
                  id: toUUID(`p_${Date.now()}`, cleanEmail),
                  ...prod
                };
                setProducts([...products, parsedProduct]);
                if (activeUser && !activeUser.isGuest) {
                  const targetUid = firebaseAuth.currentUser?.uid || activeUser.uid;
                  saveProduct(targetUid, parsedProduct).catch(err => {
                    console.error("Cloud save product failed:", err);
                  });
                }
                triggerNotification(`${parsedProduct.name} added to the inventory catalog successfully.`);
              }}
              onUpdateProduct={(updatedProd) => {
                setProducts(products.map(p => p.id === updatedProd.id ? { ...p, ...updatedProd } : p));
                if (activeUser && !activeUser.isGuest) {
                  const targetUid = firebaseAuth.currentUser?.uid || activeUser.uid;
                  saveProduct(targetUid, updatedProd).catch(err => {
                    console.error("Cloud update product failed:", err);
                  });
                }
                triggerNotification(`${updatedProd.name} updated inside catalog index successfully.`);
              }}
              onDeleteProduct={handleDeleteProduct}
              currencySymbol={businessInfo.currencySymbol}
              isSalesRole={currentPanel === "sales"}
            />
          )}

          {/* -------------------- VIEW 1.2: NEGATIVE SALES ADJUSTER -------------------- */}
          {activeTab === "negative-sales" && (
            <NegativeSalesView
              products={products}
              onUpdatePricing={handleUpdatePricing}
              onMarkUpdated={handleMarkNegativeSaleUpdated}
              currencySymbol={businessInfo.currencySymbol}
              transactions={transactions || []}
              contacts={contacts || []}
              onNavigateToCustomer={handleNavigateToCustomer}
              onNavigateToInvoice={handleNavigateToInvoice}
              onUpdateTransactionItemPrice={handleUpdateTransactionItemBuyPrice}
            />
          )}

          {/* -------------------- VIEW 1.3: PURCHASES SHEET -------------------- */}
          {activeTab === "purchases" && (
            <PurchasesView
              purchases={purchases || []}
              products={products}
              contacts={contacts}
              onAddPurchase={handleAddPurchase}
              onDeletePurchase={handleDeletePurchase}
              onEditPurchase={handleEditPurchase}
              onAddSupplier={handlePurchaseAddSupplier}
              currencySymbol={businessInfo.currencySymbol}
            />
          )}

          {/* -----------------------------------------------------------------
              VIEW 2: STOCK MANAGEMENT & VALUATIONS (UPGRADED, NO REGISTRATION, ENGLISH ONLY)
              ----------------------------------------------------------------- */}
          {activeTab === "inventory" && (
            <div className="space-y-5 animate-fadeIn" id="view-inventory-container">
              {stockSubTab === "home" ? (
                <div className="space-y-4" id="all-stock-home">
                  <div className="border-b border-white/10 pb-4">
                    <h2 className="text-xl font-black text-white">All Stock</h2>
                    <p className="mt-1 text-xs text-slate-400">Live stock overview and inventory sections.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="all-stock-overview">
                    <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stock Value</p>
                      <p className="mt-2 text-xl font-black font-mono text-white">{businessInfo.currencySymbol} {stockValueTotal.toLocaleString()}</p>
                      <p className="mt-1 text-xs text-slate-400">{currentStockProducts.length.toLocaleString()} Available Products</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sales Value</p>
                      <p className="mt-2 text-xl font-black font-mono text-white">{businessInfo.currencySymbol} {salesValueTotal.toLocaleString()}</p>
                      <p className="mt-1 text-xs text-slate-400">{currentStockProducts.length.toLocaleString()} Available Products</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Out of Stock</p>
                      <p className="mt-2 text-xl font-black font-mono text-white">{outOfStockProducts.length.toLocaleString()} Products</p>
                      <p className="mt-1 text-xs text-slate-400">Shortage Value: {businessInfo.currencySymbol} {outOfStockValueTotal.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => { setInventorySearch(""); setStockSubTab("stock-value"); }}
                      className="group w-full rounded-2xl border border-white/15 bg-[#111116] p-5 text-left transition-all hover:border-white/35 hover:bg-[#17171d] active:scale-[0.99]"
                      id="open-stock-value-page"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white">
                          <Coins className="h-6 w-6" />
                        </div>
                        <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">View page</span>
                      </div>
                      <h3 className="mt-5 text-lg font-black text-white">Stock Value</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">See available stock quantity and current purchase value.</p>
                      <div className="mt-5 border-t border-white/10 pt-3 text-xs font-bold text-white">
                        <span>{currentStockProducts.length.toLocaleString()} Available Products · {businessInfo.currencySymbol} {stockValueTotal.toLocaleString()}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setInventorySearch(""); setStockSubTab("sales-value"); }}
                      className="group w-full rounded-2xl border border-white/15 bg-[#111116] p-5 text-left transition-all hover:border-white/35 hover:bg-[#17171d] active:scale-[0.99]"
                      id="open-sales-value-page"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white">
                          <TrendingUp className="h-6 w-6" />
                        </div>
                        <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">View page</span>
                      </div>
                      <h3 className="mt-5 text-lg font-black text-white">Sales Value</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">See potential selling value of available products.</p>
                      <div className="mt-5 border-t border-white/10 pt-3 text-xs font-bold text-white">
                        <span>{currentStockProducts.length.toLocaleString()} Available Products · {businessInfo.currencySymbol} {salesValueTotal.toLocaleString()}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setInventorySearch(""); setStockSubTab("out-of-stock"); }}
                      className="group w-full rounded-2xl border border-white/15 bg-[#111116] p-5 text-left transition-all hover:border-white/35 hover:bg-[#17171d] active:scale-[0.99]"
                      id="open-out-of-stock-page"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white">
                          <AlertCircle className="h-6 w-6" />
                        </div>
                        <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">View page</span>
                      </div>
                      <h3 className="mt-5 text-lg font-black text-white">Out of Stock</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">See out-of-stock product count and shortage value.</p>
                      <div className="mt-5 border-t border-white/10 pt-3 text-xs font-bold text-white">
                        <span>{outOfStockProducts.length.toLocaleString()} Products · {businessInfo.currencySymbol} {outOfStockValueTotal.toLocaleString()} Shortage Value</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setInventorySearch(""); setStockSubTab("edit-stock"); }}
                      className="group w-full rounded-2xl border border-white/15 bg-[#111116] p-5 text-left transition-all hover:border-white/35 hover:bg-[#17171d] active:scale-[0.99]"
                      id="open-edit-stock-page"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white">
                          <SlidersHorizontal className="h-6 w-6" />
                        </div>
                        <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">Edit page</span>
                      </div>
                      <h3 className="mt-5 text-lg font-black text-white">Edit Stock</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">Clear negative stock shortages by setting selected products back to zero.</p>
                      <div className="mt-5 border-t border-white/10 pt-3 text-xs font-bold text-white">
                        <span>{totalNegativeStockUnits.toLocaleString()} pcs Shortage · {negativeStockProducts.length.toLocaleString()} Products</span>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4" id={stockSubTab === "stock-value" ? "stock-value-page" : stockSubTab === "sales-value" ? "sales-value-page" : stockSubTab === "edit-stock" ? "edit-stock-page" : "out-of-stock-page"}>
                  <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-4">
                    <button
                      type="button"
                      onClick={() => { setStockSubTab("home"); setInventorySearch(""); }}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10"
                      id="all-stock-back-button"
                    >
                      <ArrowLeft className="h-4 w-4" /> All Stock
                    </button>
                    <div>
                      <h2 className="text-lg font-black text-white">{stockSubTab === "stock-value" ? "Stock Value" : stockSubTab === "sales-value" ? "Sales Value" : stockSubTab === "edit-stock" ? "Edit Stock" : "Out of Stock"}</h2>
                      <p className="text-[10px] text-slate-400">Live figures based on current Product stock, buy price, and sell price.</p>
                    </div>
                  </div>

                  {stockSubTab === "stock-value" ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="stock-value-summary">
                        <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Available Quantity</p>
                          <p className="mt-2 text-2xl font-black font-mono text-white">{currentStockUnits.toLocaleString()} <span className="text-xs font-semibold text-slate-400">pcs / units</span></p>
                        </div>
                        <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Stock Value</p>
                          <p className="mt-2 text-2xl font-black font-mono text-white">{businessInfo.currencySymbol} {stockValueTotal.toLocaleString()}</p>
                          <p className="mt-1 text-[10px] text-slate-500">Current quantity × Product buy price</p>
                        </div>
                        <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Products Available</p>
                          <p className="mt-2 text-2xl font-black font-mono text-white">{currentStockProducts.length.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#111116] px-3 py-3">
                        <Search className="h-4 w-4 text-slate-500" />
                        <input type="text" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} placeholder="Search product name, SKU or category..." className="w-full bg-transparent text-xs text-slate-200 outline-none" />
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111116]">
                        <div className="border-b border-white/10 px-4 py-3 text-xs font-bold text-white">Products Currently in Stock</div>
                        <table className="w-full text-xs text-slate-300">
                          <thead className="bg-white/[0.04] text-[10px] uppercase text-slate-400"><tr><th className="px-4 py-3 text-left">SKU</th><th className="px-4 py-3 text-left">Product</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">Available Stock</th><th className="px-4 py-3 text-right">Stock Value</th></tr></thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {currentStockProducts.length === 0 ? <tr><td colSpan={5} className="py-10 text-center text-slate-500">No products currently in stock.</td></tr> : currentStockProducts.map(product => (
                              <tr key={product.id} className="hover:bg-white/[0.025]">
                                <td className="px-4 py-3 font-mono text-slate-500">{product.sku || "—"}</td>
                                <td className="px-4 py-3 font-semibold text-white">{product.name}</td>
                                <td className="px-4 py-3 text-slate-400">{product.category || "—"}</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-white">{Number(product.stock || 0).toLocaleString()} {product.unit}</td>
                                <td className="px-4 py-3 text-right font-mono text-slate-200">{businessInfo.currencySymbol} {(Number(product.stock || 0) * Number(product.buyPrice || 0)).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : stockSubTab === "sales-value" ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="sales-value-summary">
                        <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Available Quantity</p>
                          <p className="mt-2 text-2xl font-black font-mono text-white">{currentStockUnits.toLocaleString()} <span className="text-xs font-semibold text-slate-400">pcs / units</span></p>
                        </div>
                        <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Sales Value</p>
                          <p className="mt-2 text-2xl font-black font-mono text-white">{businessInfo.currencySymbol} {salesValueTotal.toLocaleString()}</p>
                          <p className="mt-1 text-[10px] text-slate-500">Current quantity × Product sell price</p>
                        </div>
                        <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Products Available</p>
                          <p className="mt-2 text-2xl font-black font-mono text-white">{currentStockProducts.length.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#111116] px-3 py-3">
                        <Search className="h-4 w-4 text-slate-500" />
                        <input type="text" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} placeholder="Search product name, SKU or category..." className="w-full bg-transparent text-xs text-slate-200 outline-none" />
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111116]">
                        <div className="border-b border-white/10 px-4 py-3 text-xs font-bold text-white">Products Currently Available for Sale</div>
                        <table className="w-full text-xs text-slate-300">
                          <thead className="bg-white/[0.04] text-[10px] uppercase text-slate-400"><tr><th className="px-4 py-3 text-left">SKU</th><th className="px-4 py-3 text-left">Product</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">Available Stock</th><th className="px-4 py-3 text-right">Sell Price</th><th className="px-4 py-3 text-right">Sales Value</th></tr></thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {currentStockProducts.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-500">No products currently in stock.</td></tr> : currentStockProducts.map(product => (
                              <tr key={product.id} className="hover:bg-white/[0.025]">
                                <td className="px-4 py-3 font-mono text-slate-500">{product.sku || "—"}</td>
                                <td className="px-4 py-3 font-semibold text-white">{product.name}</td>
                                <td className="px-4 py-3 text-slate-400">{product.category || "—"}</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-white">{Number(product.stock || 0).toLocaleString()} {product.unit}</td>
                                <td className="px-4 py-3 text-right font-mono text-slate-300">{businessInfo.currencySymbol} {Number(product.sellPrice || 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-mono text-white">{businessInfo.currencySymbol} {(Number(product.stock || 0) * Number(product.sellPrice || 0)).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : stockSubTab === "edit-stock" ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="edit-stock-summary">
                        <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Shortage Quantity</p>
                          <p className="mt-2 text-2xl font-black font-mono text-white">{totalNegativeStockUnits.toLocaleString()} <span className="text-xs font-semibold text-slate-400">pcs / units</span></p>
                        </div>
                        <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Products in Shortage</p>
                          <p className="mt-2 text-2xl font-black font-mono text-white">{negativeStockProducts.length.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#111116] px-3 py-3">
                        <Search className="h-4 w-4 text-slate-500" />
                        <input type="text" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} placeholder="Search product name, SKU or category..." className="w-full bg-transparent text-xs text-slate-200 outline-none" />
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111116]">
                        <div className="border-b border-white/10 px-4 py-3 text-xs font-bold text-white">Products with Negative Stock</div>
                        <table className="w-full text-xs text-slate-300">
                          <thead className="bg-white/[0.04] text-[10px] uppercase text-slate-400"><tr><th className="px-4 py-3 text-left">SKU</th><th className="px-4 py-3 text-left">Product</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">Shortage</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {negativeStockProducts.length === 0 ? <tr><td colSpan={5} className="py-10 text-center text-slate-500">No negative stock shortages. All product stock levels are zero or above.</td></tr> : negativeStockProducts.filter(product => {
                              const terms = inventorySearch.toLowerCase().trim().split(/\s+/).filter(Boolean);
                              const target = `${product.name || ""} ${product.sku || ""} ${product.category || ""}`.toLowerCase();
                              return terms.every(term => target.includes(term));
                            }).map(product => (
                              <tr key={product.id} className="hover:bg-white/[0.025]">
                                <td className="px-4 py-3 font-mono text-slate-500">{product.sku || "—"}</td>
                                <td className="px-4 py-3 font-semibold text-white">{product.name}</td>
                                <td className="px-4 py-3 text-slate-400">{product.category || "—"}</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-white">{Number(product.stock || 0).toLocaleString()} {product.unit}</td>
                                <td className="px-4 py-3 text-right">
                                  <button type="button" onClick={() => handleClearProductShortage(product.id)} className="inline-flex items-center justify-center rounded-lg border border-slate-200 !bg-white px-3 py-2 text-[10px] font-extrabold !text-black shadow-sm transition-colors hover:!bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white/60" id={`clear-shortage-${product.id}`}>
                                    Set Stock to 0
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="out-of-stock-summary">
                        <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Out-of-Stock Products</p>
                          <p className="mt-2 text-2xl font-black font-mono text-white">{outOfStockProducts.length.toLocaleString()}</p>
                        </div>
                        <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shortage Quantity</p>
                          <p className="mt-2 text-2xl font-black font-mono text-white">{outOfStockMissingUnits.toLocaleString()} <span className="text-xs font-semibold text-slate-400">pcs / units</span></p>
                        </div>
                        <div className="rounded-2xl border border-white/15 bg-[#111116] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shortage Value (Buy Price)</p>
                          <p className="mt-2 text-2xl font-black font-mono text-white">{businessInfo.currencySymbol} {outOfStockValueTotal.toLocaleString()}</p>
                          <p className="mt-1 text-[10px] text-slate-500">Negative stock quantity × current Product buy price; zero stock = ৳0</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#111116] px-3 py-3">
                        <Search className="h-4 w-4 text-slate-500" />
                        <input type="text" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} placeholder="Search product name, SKU or category..." className="w-full bg-transparent text-xs text-slate-200 outline-none" />
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111116]">
                        <div className="border-b border-white/10 px-4 py-3 text-xs font-bold text-white">Out-of-Stock Products</div>
                        <table className="w-full text-xs text-slate-300">
                          <thead className="bg-white/[0.04] text-[10px] uppercase text-slate-400"><tr><th className="px-4 py-3 text-left">SKU</th><th className="px-4 py-3 text-left">Product</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">Current Stock</th><th className="px-4 py-3 text-right">Shortage Value</th></tr></thead>
                          <tbody className="divide-y divide-white/[0.06]">
                            {outOfStockProducts.length === 0 ? <tr><td colSpan={5} className="py-10 text-center text-slate-500">No out-of-stock products found.</td></tr> : outOfStockProducts.map(product => (
                              <tr key={product.id} className="hover:bg-white/[0.025]">
                                <td className="px-4 py-3 font-mono text-slate-500">{product.sku || "—"}</td>
                                <td className="px-4 py-3 font-semibold text-white">{product.name}</td>
                                <td className="px-4 py-3 text-slate-400">{product.category || "—"}</td>
                                <td className="px-4 py-3 text-right font-mono text-white">{Number(product.stock || 0).toLocaleString()} {product.unit}</td>
                                <td className="px-4 py-3 text-right font-mono text-slate-200">{businessInfo.currencySymbol} {(Math.max(0, -Number(product.stock || 0)) * Number(product.buyPrice || 0)).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "duelist" && (
            <div className="space-y-6 animate-fadeIn" id="view-duelist-container">
              {/* 1. HEADER BANNER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10" id="duelist-header-block">
                <div className="flex items-center gap-3">
                  {dueSection !== "home" && (
                    <button type="button" onClick={() => setDueSection("home")}
                      className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 backdrop-blur-xl transition-all hover:border-white/30 hover:bg-white/[0.13] active:scale-95">
                      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                      <span>Back</span>
                    </button>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] shrink-0" />
                      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">Due Management</h1>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-slate-400 font-medium font-sans">
                      Manage creditor balances separately from product procurement dues.
                    </p>
                  </div>
                </div>
                {dueSection !== "home" && <span className="self-start sm:self-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 backdrop-blur-xl">Due Workspace</span>}
              </div>

              {dueSection === "home" && (
                <div className="relative isolate grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 sm:gap-5" id="due-management-sections">
                  {([
                    { id: "creditor-entry", title: "Add Due & Paid", subtitle: "Record a new due, payment, or both", detail: "TRANSACTION ENTRY", icon: PlusCircle },
                    { id: "creditors", title: "Creditor Management", subtitle: "Manage people and business accounts", detail: "ACCOUNT DIRECTORY", icon: Users },
                    { id: "creditor-report", title: "Due Report", subtitle: "Review balances and payment history", detail: "REPORTS & INSIGHTS", icon: BarChart3 },
                    { id: "product-due", title: "Product Due", subtitle: "Open the existing supplier due tracker", detail: "PROCUREMENT LEDGER", icon: Package }
                  ] as const).map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <button key={item.id} type="button" onClick={() => setDueSection(item.id)}
                        className="group relative min-h-[190px] sm:min-h-[220px] overflow-hidden rounded-[26px] border border-white/18 bg-white/[0.075] p-5 sm:p-6 text-left text-white shadow-[0_18px_55px_rgba(0,0,0,0.48)] backdrop-blur-[32px] transition-all duration-300 hover:-translate-y-1 hover:border-white/28 hover:bg-white/[0.10] hover:shadow-[0_24px_65px_rgba(0,0,0,0.58)] active:scale-[0.985]">
                        <div className="pointer-events-none absolute inset-0 bg-white/[0.025] opacity-90 transition-opacity duration-300 group-hover:bg-white/[0.045]" />
                        <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/[0.025] blur-[48px] transition-all duration-500 group-hover:scale-125" />
                        <div className="relative flex h-full min-h-[145px] flex-col justify-between gap-7">
                          <div className="flex items-start justify-between gap-3">
                            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/18 bg-white/[0.075] text-white shadow-inner backdrop-blur-2xl">
                              <Icon className="h-6 w-6 text-white" strokeWidth={1.8} />
                            </span>
                            <span className="rounded-full border border-white/12 bg-white/[0.045] px-3 py-1.5 text-[9px] font-bold tracking-[0.16em] text-white/55 backdrop-blur-2xl">0{index + 1}</span>
                          </div>
                          <div>
                            <p className="mb-2 text-[9px] font-bold tracking-[0.2em] text-white/70">{item.detail}</p>
                            <div className="flex items-center justify-between gap-3">
                              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">{item.title}</h2>
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/70 transition-all group-hover:translate-x-1 group-hover:border-white/25 group-hover:bg-white/[0.10] group-hover:text-white">→</span>
                            </div>
                            <p className="mt-2 max-w-[28rem] text-xs leading-relaxed text-white/65">{item.subtitle}</p>
                          </div>
                        </div>
                        <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      </button>
                    );
                  })}
                </div>
              )}

              {dueSection === "product-due" ? (
                <>
              {/* 2. DATE HORIZON FILTERS */}
              <div className="bg-[#0b0f19] border border-slate-800/80 p-3 rounded-2xl flex flex-col md:flex-row items-center gap-4 justify-between" id="duelist-period-menu-container">
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <span className="text-[10px] text-[#00E676] font-bold uppercase tracking-wider font-mono">Date Horizon Presets:</span>
                  <div className="flex flex-wrap gap-1.5 font-sans" id="duelist-horizontal-pills">
                    {[
                      { id: "all", label: "All" },
                      { id: "today", label: "Today" },
                      { id: "weekly", label: "7 Days" },
                      { id: "monthly", label: "This Month" },
                      { id: "yearly", label: "This Year" }
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setDuelistFilter(preset.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                          duelistFilter === preset.id
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold shadow-md"
                            : "text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent"
                        }`}
                        id={`duelist-preset-key-${preset.id}`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-mono self-end">
                  Due invoices are dynamically compiled according to the chosen timeline preset.
                </div>
              </div>

              {/* Helper to calculate values */}
              {(() => {
                const isPurchaseInDateFilter = (purDateStr: string, filter: "all" | "today" | "weekly" | "monthly" | "yearly") => {
                  if (filter === "all") return true;
                  try {
                    const pDate = new Date(purDateStr);
                    const now = new Date();

                    if (filter === "yearly") {
                      return pDate.getFullYear() === now.getFullYear();
                    }

                    const isCurrentMonth = pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
                    if (!isCurrentMonth) return false;

                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                    
                    if (filter === "monthly") {
                      return true;
                    }
                    if (filter === "today") {
                      return pDate >= todayStart && pDate <= todayEnd;
                    }
                    if (filter === "weekly") {
                      const weeklyStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
                      return pDate >= weeklyStart && pDate <= todayEnd;
                    }
                  } catch (e) {
                    console.error("Duelist Date match error:", e);
                  }
                  return true;
                };

                const dueInvoices = purchases.filter(p => {
                  const isCredit = p.originallyCredit || (p.dueAmount || 0) > 0 || (p.totalAmount > (p.cashPaid || 0));
                  return isCredit && isPurchaseInDateFilter(p.date, duelistFilter);
                });

                // Calculate total metrics
                const totalIn = dueInvoices.reduce((acc, p) => acc + p.totalAmount, 0);
                const totalOut = dueInvoices.reduce((acc, p) => acc + (p.cashPaid || 0), 0);
                const totalRemaining = dueInvoices.reduce((acc, p) => acc + (p.dueAmount || 0), 0);

                const finalFilteredInvoices = dueInvoices.filter(pur => {
                  if (!duelistSearch.trim()) return true;
                  const searchLower = duelistSearch.toLowerCase().trim();
                  const supName = (pur.supplierName || "").toLowerCase();
                  const prodName = (pur.productName || "").toLowerCase();
                  return supName.includes(searchLower) || prodName.includes(searchLower);
                });

                return (
                  <>
                    {/* STATS SUMMARY CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="duelist-stats-deck">
                      {/* CARD 1: IN */}
                      <div className="bg-gradient-to-br from-[#0c142c] to-[#0a101f] border border-amber-500/25 p-5 rounded-2xl relative overflow-hidden shadow-lg flex flex-col justify-between" id="card-duelist-in">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono">Procured Credit (Total In)</span>
                          <TrendingUp className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black font-mono text-white tracking-tight">
                            {businessInfo.currencySymbol} {totalIn.toLocaleString()}
                          </h3>
                          <p className="text-[10px] text-slate-400 mt-1 font-sans leading-relaxed">
                            Cumulative invoice value of inventory procured from vendors on credit.
                          </p>
                        </div>
                      </div>

                      {/* CARD 2: OUT */}
                      <div className="bg-gradient-to-br from-[#0c142c] to-[#0a101f] border border-[#00E676]/20 p-5 rounded-2xl relative overflow-hidden shadow-lg flex flex-col justify-between" id="card-duelist-out">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00E676]/5 rounded-full blur-3xl -mr-10 -mt-10" />
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">Cash Disbursed (Total Out)</span>
                          <TrendingDown className="w-4 h-4 text-[#00E676]" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black font-mono text-[#00E676] tracking-tight">
                            {businessInfo.currencySymbol} {totalOut.toLocaleString()}
                          </h3>
                          <p className="text-[10px] text-slate-400 mt-1 font-sans leading-relaxed">
                            Total cumulative cash payments processed and cleared to suppliers.
                          </p>
                        </div>
                      </div>

                      {/* CARD 3: REMAINING */}
                      <div className="bg-gradient-to-br from-[#0c142c] to-[#0a101f] border border-rose-500/25 p-5 rounded-2xl relative overflow-hidden shadow-lg flex flex-col justify-between" id="card-duelist-remaining">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 font-mono">Outstanding Balance (Remaining Due)</span>
                          <Bookmark className="w-4 h-4 text-rose-400" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black font-mono text-rose-400 tracking-tight">
                            {businessInfo.currencySymbol} {totalRemaining.toLocaleString()}
                          </h3>
                          <p className="text-[10px] text-slate-400 mt-1 font-sans leading-relaxed">
                            Active outstanding unpaid balance due to your suppliers.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ACTIONS & CONTROLS TOOLBAR */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#0a101f]/80 border border-slate-800 rounded-2xl" id="duelist-toolbar">
                      <div className="relative w-full sm:w-80 font-sans" id="duelist-search-wrap">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Search by supplier or product name..."
                          value={duelistSearch}
                          onChange={(e) => setDuelistSearch(e.target.value)}
                          className="w-full px-3 py-2 pl-9 bg-[#050912] border border-slate-800 rounded-xl text-slate-200 text-xs outline-none focus:border-amber-500 font-sans"
                        />
                      </div>

                      <button
                        onClick={() => {
                          setIsAddingDue(!isAddingDue);
                          setDueInvoiceNo(`REC-${Math.floor(1000 + Math.random() * 9000)}`);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                      >
                        <PlusCircle className="w-4 h-4 text-slate-950" />
                        <span>+ Add Due Procurement Entry</span>
                      </button>
                    </div>

                    {/* inline due purchase logging drawer/panel */}
                    {isAddingDue && (
                      <div className="p-5 bg-[#050912] border border-amber-500/20 rounded-2xl space-y-4 animate-slideDown" id="add-duelist-entry-drawer">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                            <PlusCircle className="w-3.5 h-3.5 text-amber-500" />
                            New Supplier Credit Purchase Ledger Form
                          </span>
                          <button 
                            onClick={() => setIsAddingDue(false)}
                            className="text-[11px] text-slate-500 hover:text-white px-2.5 py-1 rounded bg-[#0c142c] border border-slate-850 hover:bg-slate-900 transition-colors font-sans cursor-pointer"
                          >
                            Close ✕
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans text-xs">
                          {/* 1. Date */}
                          <div className="space-y-1">
                            <label className="text-slate-400 font-medium block">Purchase Date:</label>
                            <input
                              type="date"
                              value={dueDateStr}
                              onChange={(e) => setDueDateStr(e.target.value)}
                              className="w-full px-3 py-2 bg-[#0a101f] border border-slate-800 rounded-lg text-white font-mono text-xs focus:border-amber-500 outline-none"
                            />
                          </div>

                          {/* 2. Voucher Invoice ID */}
                          <div className="space-y-1">
                            <label className="text-slate-400 font-medium block">Supplier Voucher Track No:</label>
                            <input
                              type="text"
                              placeholder="e.g. REC-5847"
                              value={dueInvoiceNo}
                              onChange={(e) => setDueInvoiceNo(e.target.value)}
                              className="w-full px-3 py-2 bg-[#0a101f] border border-slate-800 rounded-lg text-white font-mono text-xs focus:border-amber-500 outline-none"
                            />
                          </div>

                          {/* 3. Supplier list */}
                          <div className="space-y-1">
                            <label className="text-slate-400 font-medium block">Supplier / Vendor Account:</label>
                            <select
                              value={dueSupplierId}
                              onChange={(e) => setDueSupplierId(e.target.value)}
                              className="w-full px-3 py-2 bg-[#0a101f] border border-slate-800 rounded-lg text-white text-xs focus:border-amber-500 outline-none"
                            >
                              <option value="">-- Choose Supplier --</option>
                              {contacts.filter(c => c.type === "supplier").map(sup => (
                                <option key={sup.id} value={sup.id}>{sup.name} ({sup.phone || 'no phone'})</option>
                              ))}
                              <option value="walk-in-supplier">Walk-in General Supplier</option>
                            </select>
                          </div>

                          {/* 4. Products list */}
                          <div className="space-y-1">
                            <label className="text-slate-400 font-medium block">Stock Product Purchased:</label>
                            <select
                              value={dueProductId}
                              onChange={(e) => setDueProductId(e.target.value)}
                              className="w-full px-3 py-2 bg-[#0a101f] border border-slate-800 rounded-lg text-white text-xs focus:border-amber-500 outline-none"
                            >
                              <option value="">-- Select Registered Product --</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} [{p.sku || 'No SKU'}] (Stock: {p.stock} pcs)</option>
                              ))}
                            </select>
                          </div>

                          {/* 5. Quantity */}
                          <div className="space-y-1">
                            <label className="text-slate-400 font-medium block">Purchased Quantity (Pcs):</label>
                            <input
                              type="number"
                              placeholder="e.g. 50"
                              value={dueQuantity}
                              onChange={(e) => setDueQuantity(e.target.value)}
                              className="w-full px-3 py-2 bg-[#0a101f] border border-slate-800 rounded-lg text-white font-mono text-xs focus:border-amber-500 outline-none"
                            />
                          </div>

                          {/* 6. Buy Rate */}
                          <div className="space-y-1">
                            <label className="text-slate-400 font-medium block">Procurement Buy Unit Price:</label>
                            <input
                              type="number"
                              placeholder="e.g. 150"
                              value={dueBuyRate}
                              onChange={(e) => setDueBuyRate(e.target.value)}
                              className="w-full px-3 py-2 bg-[#0a101f] border border-slate-800 rounded-lg text-white font-mono text-xs focus:border-amber-500 outline-none"
                            />
                          </div>

                          {/* 7. Total debit */}
                          <div className="space-y-1">
                            <label className="text-slate-400 font-medium block">Total Invoice Purchase Price (Auto):</label>
                            <div className="w-full px-3 py-2.5 bg-[#0a101f] border border-slate-800 rounded-lg text-amber-400 font-bold font-mono text-xs">
                              {businessInfo.currencySymbol} {( (parseFloat(dueQuantity) || 0) * (parseFloat(dueBuyRate) || 0) ).toLocaleString()}
                            </div>
                          </div>

                          {/* 8. Initial Payment */}
                          <div className="space-y-1">
                            <label className="text-slate-400 font-medium block">Cash Settled Out (Paid Now):</label>
                            <input
                              type="number"
                              placeholder="0"
                              value={duePaid}
                              onChange={(e) => setDuePaid(e.target.value)}
                              className="w-full px-3 py-2 bg-[#0a101f] border border-slate-800 rounded-lg text-white font-mono text-xs focus:border-amber-500 outline-none"
                            />
                          </div>

                          {/* 9. Remaining balance to pay */}
                          <div className="space-y-1">
                            <label className="text-slate-400 font-medium block">Remaining Balance Unpaid (Due Amount - Auto):</label>
                            <div className="w-full px-3 py-2.5 bg-[#0a101f] border border-slate-800 rounded-lg text-rose-455 font-bold font-mono text-xs">
                              {businessInfo.currencySymbol} {Math.max(0, ( (parseFloat(dueQuantity) || 0) * (parseFloat(dueBuyRate) || 0) ) - (parseFloat(duePaid) || 0)).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {/* Note area */}
                        <div className="space-y-1 font-sans text-xs">
                          <label className="text-slate-400 font-medium block">Optional Transaction Notes:</label>
                          <input
                            type="text"
                            placeholder="Enter transaction remarks or comments..."
                            value={dueNote}
                            onChange={(e) => setDueNote(e.target.value)}
                            className="w-full px-3 py-2 bg-[#0a101f] border border-slate-800 rounded-lg text-white text-xs focus:border-amber-500 outline-none"
                          />
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end gap-3 font-sans">
                          <button
                            onClick={() => {
                              if (!dueSupplierId) {
                                triggerNotification("Please select a valid supplier!", "error");
                                return;
                              }
                              if (!dueProductId) {
                                triggerNotification("Please choose a product to log!", "error");
                                return;
                              }
                              const qty = parseFloat(dueQuantity);
                              const rate = parseFloat(dueBuyRate);
                              if (isNaN(qty) || qty <= 0 || isNaN(rate) || rate <= 0) {
                                triggerNotification("Please enter valid quantities and purchase prices!", "error");
                                return;
                              }

                              const paid = parseFloat(duePaid) || 0;
                              const total = qty * rate;
                              if (paid > total) {
                                triggerNotification("Paid cash cannot exceed the total purchase price!", "error");
                                return;
                              }

                              const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();
                              const prodObj = products.find(p => p.id === dueProductId);
                              const supObj = contacts.find(c => c.id === dueSupplierId);

                              // Build newly recorded Purchase
                              const newPur: Purchase = {
                                id: toUUID(`pur_${Date.now()}`, cleanEmail),
                                productId: dueProductId,
                                productName: prodObj ? prodObj.name : "Selected Product",
                                supplierId: dueSupplierId,
                                supplierName: supObj ? supObj.name : (dueSupplierId === "walk-in-supplier" ? "Walk-in Supplier" : "Unknown Supplier"),
                                quantity: qty,
                                buyPrice: rate,
                                totalAmount: total,
                                date: new Date(dueDateStr).toISOString(),
                                cashPaid: paid,
                                dueAmount: Math.max(0, total - paid),
                                invoiceNo: dueInvoiceNo || `REC-${Math.floor(1000 + Math.random() * 9000)}`,
                                note: dueNote || "Supplier Credit Entry Logs",
                                originallyCredit: true
                              };

                              setPurchases([newPur, ...purchases]);
                              if (activeUser && !activeUser.isGuest) {
                                savePurchase(activeUser.uid, newPur).catch(err => console.error("Supplier credit purchase sync failed:", err));
                              }
                              const updatedDueProducts = products.map(p => {
                                if (p.id === dueProductId) {
                                  const nextP = addPurchaseCostLot(p, newPur);
                                  if (activeUser && !activeUser.isGuest) {
                                    saveProduct(activeUser.uid, nextP).catch(err => console.error("Supplier credit stock sync failed:", err));
                                  }
                                  return nextP;
                                }
                                return p;
                              });
                              setProducts(updatedDueProducts);

                              // Reset input fields
                              setDueQuantity("");
                              setDueBuyRate("");
                              setDuePaid("");
                              setDueNote("");
                              setDueProductId("");
                              setIsAddingDue(false);

                              triggerNotification("Success! New supplier procurement record registered and asset stock updated. 🟢", "success");
                            }}
                            className="px-5 py-2.5 bg-[#00E676] hover:bg-[#00c853] text-[#050912] font-black text-xs rounded-xl shadow-lg transition-all hover:scale-[1.02] cursor-pointer font-sans"
                          >
                            Save Due Entry
                          </button>
                        </div>
                      </div>
                    )}

                    {/* TABLE LAYOUT */}
                    <div className="w-full bg-[#0a101f]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl" id="due-items-registry-wrapper">
                      <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between" id="due-table-header">
                        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                          <History className="w-3.5 h-3.5 text-amber-500" />
                          Active Supplier Procurement Due Ledger
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Total Records: {finalFilteredInvoices.length} Invoices</span>
                      </div>

                      <div className="overflow-x-auto" id="duelist-table-scroll">
                        <table className="w-full text-left text-xs text-slate-300 font-sans">
                          <thead>
                            <tr className="bg-slate-950/40 border-b border-slate-800 text-[10px] uppercase font-mono tracking-wider text-slate-400">
                              <th className="py-3 px-4 text-left">Date & Invoice</th>
                              <th className="py-3 px-4 text-left">Supplier Name</th>
                              <th className="py-3 px-4 text-right">Amount Procured (In)</th>
                              <th className="py-3 px-4 text-right">Cash Paid (Out)</th>
                              <th className="py-3 px-4 text-right">Outstanding Due</th>
                              <th className="py-3 px-4">Inventory Specifications & Stock Audit Breakdown</th>
                              <th className="py-3 px-4 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850/50 font-mono text-xs">
                            {finalFilteredInvoices.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="py-16 text-center text-slate-500 font-sans">
                                    No supplier credit records matching the current parameters were found in the local database.
                                  </td>
                                </tr>
                            ) : (
                              finalFilteredInvoices.map((pur) => {
                                const due = pur.dueAmount || 0;
                                const isFullyPaid = due <= 0;
                                const matchedProduct = products.find(p => p.id === pur.productId);

                                // calculate coverage pieces
                                const qty = pur.quantity || 1;
                                const unitCost = pur.buyPrice || 1;
                                const eqPaidQty = Math.min(qty, parseFloat(((pur.cashPaid || 0) / unitCost).toFixed(2)));
                                const eqDueQty = Math.max(0, parseFloat((qty - eqPaidQty).toFixed(2)));

                                return (
                                  <tr key={pur.id} className={`hover:bg-slate-900/10 text-slate-300 ${isFullyPaid ? 'bg-emerald-950/5' : ''}`}>
                                    {/* 1. Date */}
                                    <td className="py-4 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                                      {safeFormat(pur.date, "dd MMMM, yyyy", "N/A")}
                                      <span className="block text-[9px] text-[#A0A0A5] font-mono mt-0.5">Voucher No: {pur.invoiceNo || "N/A"}</span>
                                    </td>

                                    {/* 2. Supplier Name */}
                                    <td className="py-4 px-4 font-sans text-white font-semibold">
                                      {pur.supplierName || "Walk-In Supplier"}
                                    </td>

                                    {/* 3. In value */}
                                    <td className="py-4 px-4 text-right text-slate-400 font-mono">
                                      {businessInfo.currencySymbol} {pur.totalAmount.toLocaleString()}
                                    </td>

                                    {/* 4. Out value */}
                                    <td className="py-4 px-4 text-right text-emerald-400 font-bold font-mono">
                                      {businessInfo.currencySymbol} {(pur.cashPaid || 0).toLocaleString()}
                                    </td>

                                    {/* 5. Remaining value */}
                                    <td className="py-4 px-4 text-right text-rose-455 font-extrabold font-mono">
                                      {businessInfo.currencySymbol} {due.toLocaleString()}
                                    </td>

                                    {/* 6. Product breakdowns and stocks */}
                                    <td className="py-4 px-4 font-sans text-[11px] text-slate-200">
                                      <div className="bg-slate-950/60 p-2.5 border border-slate-800/80 rounded-xl space-y-1.5" id={`prod-breakdown-box-${pur.id}`}>
                                        <div className="flex justify-between items-center text-white">
                                          <span className="font-bold underline text-amber-300">{pur.productName || "Unknown Item"}</span>
                                          <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-[#00E676]">Supplied: {qty} pcs</span>
                                        </div>

                                        <div className="flex select-none gap-2 text-[10px] text-slate-400 font-mono leading-tight">
                                          <span>Equivalent Paid: <strong className="text-emerald-400">{eqPaidQty} pcs</strong></span>
                                          <span>Equivalent Due: <strong className="text-rose-400">{eqDueQty} pcs</strong></span>
                                        </div>

                                        <div className="pt-1.5 text-[10px] border-t border-slate-900 leading-relaxed font-sans text-slate-350 space-y-0.5">
                                          <div className="flex justify-between items-center text-rose-300 font-mono">
                                            <span>Unpaid Stock Portion:</span>
                                            <span className="font-bold text-rose-455">{(pur.dueAmount / pur.buyPrice).toFixed(1)} pcs</span>
                                          </div>
                                          <div className="flex justify-between items-center text-indigo-300 font-mono">
                                            <span>Product Warehouse Stock:</span>
                                            <span className="font-bold text-[#00E676]">{matchedProduct ? matchedProduct.stock : 0} {matchedProduct?.unit || 'pcs'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* 7. Action button for repaying & dynamic receipt generation */}
                                    <td className="py-4 px-4 text-center font-sans whitespace-nowrap min-w-[200px]">
                                      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 font-sans">
                                        <button
                                          onClick={() => setSelectedSupplierReceipt(pur)}
                                          className="w-full sm:w-auto px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-lg transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md flex items-center gap-1 mt-1 sm:mt-0"
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                          <span>Voucher Receipt</span>
                                        </button>

                                        {isFullyPaid ? (
                                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1.5 rounded-full text-[10px] font-bold text-emerald-400">
                                            Fully Settled ✔
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => {
                                              const customInput = prompt(`Enter cash disbursement payment to clear supplier outstanding debt (Outstanding: ${businessInfo.currencySymbol}${due}):`);
                                              if (customInput === null) return;
                                              const repayAmt = parseFloat(customInput);
                                              if (isNaN(repayAmt) || repayAmt <= 0) {
                                                triggerNotification("Please enter a valid monetary amount!", "error");
                                                return;
                                              }
                                              const finalPaidAmt = Math.min(due, repayAmt);
                                              const nextCashPaid = parseFloat(((pur.cashPaid || 0) + finalPaidAmt).toFixed(2));
                                              const nextDueAmount = Math.max(0, pur.totalAmount - nextCashPaid);
                                              
                                              const updatedPur = {
                                                ...pur,
                                                cashPaid: nextCashPaid,
                                                dueAmount: nextDueAmount
                                              };

                                              setPurchases(prev => prev.map(item => {
                                                if (item.id === pur.id) {
                                                  return updatedPur;
                                                }
                                                return item;
                                              }));

                                              // Set as currently active receipt to immediately show the updated receipt modal to copy/print
                                              setSelectedSupplierReceipt(updatedPur);
                                              triggerNotification(`Success! Payment processed and supplier due balance calibrated!`, "success");
                                            }}
                                            className="w-full sm:w-auto px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-md shadow-amber-500/5 duration-150 flex items-center gap-1 justify-center"
                                          >
                                            <TrendingDown className="w-3.5 h-3.5" />
                                            <span>Repay</span>
                                          </button>
                                        )}

                                        {qty > 0 && (
                                          <button
                                            onClick={() => {
                                              const maxReturnQty = Math.min(qty, matchedProduct ? matchedProduct.stock : 0);
                                              if (maxReturnQty <= 0) {
                                                triggerNotification("Cannot return: No remaining warehouse stock left for this product!", "error");
                                                return;
                                              }

                                              const promptVal = prompt(
                                                `Enter quantity of ${pur.productName} you want to return to ${pur.supplierName || 'supplier'}.\n` +
                                                `• Purchased quantity in this batch: ${pur.quantity} pcs\n` +
                                                `• Available physical stock: ${matchedProduct ? matchedProduct.stock : 0} pcs\n` +
                                                `• Maximum returnable quantity: ${maxReturnQty} pcs`
                                              );
                                              if (promptVal === null) return;
                                              const qtyToReturn = parseInt(promptVal);
                                              if (isNaN(qtyToReturn) || qtyToReturn <= 0) {
                                                triggerNotification("Please enter a valid positive number for returned items!", "error");
                                                return;
                                              }
                                              if (qtyToReturn > maxReturnQty) {
                                                triggerNotification(`Cannot return ${qtyToReturn} units. Maximum allowed is ${maxReturnQty} units!`, "error");
                                                return;
                                              }
                                              handleReturnPurchase(pur.id, qtyToReturn);
                                            }}
                                            className="w-full sm:w-auto px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded-lg transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md flex items-center justify-center gap-1 mt-1 sm:mt-0"
                                            title="Return items back to supplier"
                                          >
                                            <Undo2 className="w-3.5 h-3.5" />
                                            <span>Return</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* DYNAMIC SUPPLIER DUE RECEIPT INTERACTIVE POPUP / MODAL */}
              {selectedSupplierReceipt && (() => {
                const pur = selectedSupplierReceipt;
                const due = pur.dueAmount ?? 0;
                const isFullyPaid = due <= 0;
                
                // Match with contacts to fetch any stored phone numbers/address for this supplier
                const supContact = contacts.find(c => c.id === pur.supplierId || c.name === pur.supplierName);
                
                return (
                  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" id="supplier-receipt-modal-overlay">
                    <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col" id="supplier-receipt-modal-body">
                      
                      {/* Modal Header */}
                      <div className="p-5 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between" id="receipt-modal-titlebar">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-white text-sm tracking-tight">Supplier Transaction Voucher</h3>
                            <p className="text-[10px] text-slate-400 font-medium">Supplier Due Payment Receipt (Voucher Memo)</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedSupplierReceipt(null)}
                          className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
                          title="Close receipt popup"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Scrollable Receipt Body */}
                      <div className="p-6 overflow-y-auto space-y-6 max-h-[70vh] text-slate-300 font-sans" id="receipt-modal-content-scroll">
                        
                        {/* Visual Stamp / Paid Badge */}
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <h4 className="text-xl font-bold text-white tracking-tight">{businessInfo.name}</h4>
                            <p className="text-xs text-slate-400 font-medium">{businessInfo.address || "No Address Saved"}</p>
                            <p className="text-xs text-slate-400 font-medium">Phone: {businessInfo.phone || "No Phone Saved"}</p>
                          </div>
                          <div>
                            {isFullyPaid ? (
                              <span className="inline-flex flex-col items-center justify-center bg-emerald-500/10 border border-emerald-500/40 px-4 py-2 rounded-2xl text-[11px] font-extrabold text-emerald-400 tracking-wider">
                                <span className="text-base">✔</span> FULLY SETTLED
                                <span className="text-[9px] font-normal text-emerald-400/80">FULLY PAID</span>
                              </span>
                            ) : (
                              <span className="inline-flex flex-col items-center justify-center bg-amber-500/10 border border-amber-500/40 px-4 py-2 rounded-2xl text-[11px] font-extrabold text-amber-400 tracking-wider">
                                <span>⚠️</span> ACTIVE CREDIT
                                <span className="text-[9px] font-normal text-amber-400/80">HAS OUTSTANDING DUE</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="border-t border-dashed border-slate-850 my-4" />

                        {/* Voucher Metadata Grid */}
                        <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950/40 p-4 border border-slate-800/80 rounded-2xl" id="receipt-meta-grid">
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-mono tracking-wider">Voucher No</span>
                            <strong className="text-white text-sm font-mono">{pur.invoiceNo || "N/A"}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-mono tracking-wider">Date</span>
                            <strong className="text-white text-sm">{safeFormat(pur.date, "dd MMMM, yyyy", "N/A")}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-mono tracking-wider">Supplier Name</span>
                            <strong className="text-amber-400 text-sm font-semibold">{pur.supplierName}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-mono tracking-wider">Supplier Phone</span>
                            <strong className="text-slate-300 text-sm font-mono">{supContact?.phone || "N/A"}</strong>
                          </div>
                        </div>

                        {/* Item details */}
                        <div>
                          <h5 className="text-[11px] uppercase font-mono font-bold text-slate-400 tracking-wider mb-2">Purchase & Product Breakdown</h5>
                          <div className="bg-[#050912] border border-slate-800/50 rounded-2xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                                  <th className="py-2 px-4 font-semibold">Product Name</th>
                                  <th className="py-2 px-4 text-right font-semibold">Qty</th>
                                  <th className="py-2 px-4 text-right font-semibold">Buy Rate</th>
                                  <th className="py-2 px-4 text-right font-semibold">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="text-slate-300">
                                  <td className="py-3 px-4 font-medium text-white">{pur.productName || "Unknown Item"}</td>
                                  <td className="py-3 px-4 text-right font-mono">{pur.quantity} pcs</td>
                                  <td className="py-3 px-4 text-right font-mono">{businessInfo.currencySymbol} {(pur.buyPrice || 0).toLocaleString()}</td>
                                  <td className="py-3 px-4 text-right font-mono font-bold text-white">{businessInfo.currencySymbol} {pur.totalAmount.toLocaleString()}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Outstanding Balance Ledger Summary */}
                        <div className="bg-[#050912] border border-slate-800 rounded-2xl p-4 space-y-2.5 font-sans" id="receipt-financials-ledger">
                          <div className="flex justify-between items-center text-xs text-slate-400">
                            <span>Original Purchase Total:</span>
                            <span className="font-mono text-white text-sm font-semibold">{businessInfo.currencySymbol} {pur.totalAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-slate-400">
                            <span>Total Disbursed Paid:</span>
                            <span className="font-mono text-emerald-400 text-sm font-black">{businessInfo.currencySymbol} {(pur.cashPaid || 0).toLocaleString()}</span>
                          </div>
                          
                          <div className="border-t border-slate-800/80 pt-2.5 flex justify-between items-center">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-xs text-white block">Outstanding Due:</span>
                              <span className="text-[9px] text-slate-400 block font-normal">Remaining outstanding due balance</span>
                            </div>
                            <span className={`font-mono text-lg font-black ${due <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {businessInfo.currencySymbol} {due.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 text-center font-normal italic">
                          Use the buttons below to print or share this receipt with the supplier for your business record.
                        </p>
                      </div>

                      {/* Modal Footer / Share and Actions Sheet */}
                      <div className="p-5 border-t border-slate-800 bg-slate-950/70 grid grid-cols-1 sm:grid-cols-3 gap-2.5" id="receipt-actions-footer">
                        <button
                          onClick={() => handlePrintReceipt(pur)}
                          className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all hover:scale-102 active:scale-98 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-500/10"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Print / PDF</span>
                        </button>

                        <button
                          onClick={() => handleWhatsAppShare(pur)}
                          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all hover:scale-102 active:scale-98 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10"
                        >
                          <Phone className="w-4 h-4" />
                          <span>Send WhatsApp</span>
                        </button>

                        <button
                          onClick={() => handleCopyReceipt(pur)}
                          className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all hover:scale-102 active:scale-98 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>Copy Text</span>
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })()}
                </>
              ) : dueSection === "home" ? null : (
                <CreditorDueView
                  activeSection={dueSection}
                  businessInfo={businessInfo}
                  setBusinessInfo={setBusinessInfo}
                  triggerNotification={triggerNotification}
                  toUUID={toUUID}
                  activeUser={activeUser}
                />
              )}
            </div>
          )}


          {/* -----------------------------------------------------------------
              VIEW 3: LEDGER INVOICING ACCOUNTING & DUE COLLECTOR
              ----------------------------------------------------------------- */}
          {activeTab === "ledger" && (
            <div className="space-y-6 animate-fadeIn" id="view-ledger-container">
              <div id="ledger-sticky-mobile-header" className="hidden">
                <span className="dashboard-sticky-live-dot" aria-hidden="true" />
                <span>Account Balance</span>
              </div>
              {/* Filtering Controls */}
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-4 bg-[#1E1E24] border border-slate-800/80 rounded-2xl shadow-xl" id="ledger-filter-bar">
                
                <div className="relative w-full lg:w-96" id="ledger-search-wrap">
                  <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    id="ledger-search-input"
                    placeholder="Search invoice number, buyer profile, mobile tag..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="w-full px-4 py-3 pl-10 bg-[#121214] border border-slate-805 rounded-xl text-slate-200 text-xs outline-none focus:border-emerald-500 font-sans transition-all"
                  />
                  {ledgerSearch && (
                    <button onClick={() => setLedgerSearch("")} className="absolute right-3 top-3 text-slate-500 hover:text-white transition-all">✕</button>
                  )}
                </div>

                <div className="grid w-full grid-cols-4 items-stretch gap-2 md:flex md:w-auto md:flex-wrap md:items-center" id="ledger-filter-tabs">
                  <span className="col-span-4 text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wide select-none md:col-span-1 md:mr-1">Reciprocal Filter:</span>
                  {["all", "paid", "partial", "due"].map((status) => (
                    <button
                      key={status}
                      id={`ledger-filter-${status}`}
                      onClick={() => setLedgerStatusFilter(status)}
                      className={`w-full min-w-0 whitespace-normal break-words px-1.5 py-2 text-center text-[9px] leading-tight md:w-auto md:px-4 md:text-xs rounded-xl font-mono font-bold capitalize cursor-pointer transition-all border ${ledgerStatusFilter === status ? "bg-white text-[#111111] border-white shadow-md shadow-white/10 md:bg-gradient-to-r md:from-[#00E676] md:to-[#00B0FF] md:text-slate-950 md:border-emerald-400 md:shadow-lg md:scale-102" : "bg-white/[0.035] text-slate-400 border-white/[0.10] hover:text-white hover:bg-white/[0.08] md:bg-[#121214] md:border-[#2D2D35] md:hover:bg-slate-900"}`}
                    >
                      {status === 'all' ? 'All Transactions' : status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Due Balance'}
                    </button>
                  ))}
                </div>

              </div>

              {/* Date Preset Filter Bar */}
              <div className="flex flex-col lg:flex-row items-center justify-between gap-5 p-5 bg-[#1E1E24] border border-[#2D2D35] rounded-2xl shadow-lg relative overflow-hidden mt-4" id="ledger-date-filter-bar">
                <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:gap-2" id="ledger-date-presets">
                  <span className="w-full text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wide select-none md:w-auto md:mr-1">Date Range:</span>
                  {(["all", "today", "yesterday", "weekly", "monthly", "yearly", "custom"] as const).map((preset) => (
                    <button
                      key={preset}
                      id={`ledger-date-filter-${preset}`}
                      onClick={() => setLedgerDateFilterType(preset)}
                      className={`min-w-[68px] min-h-[42px] flex-[1_1_calc(25%-0.5rem)] whitespace-nowrap px-2 py-2 text-center text-[10px] leading-none md:min-h-0 md:w-auto md:flex-none md:px-3.5 md:py-2 md:text-[11px] rounded-xl font-bold tracking-wide transition-all border cursor-pointer uppercase font-mono ${
                        ledgerDateFilterType === preset
                          ? "bg-white text-[#111111] border-white shadow-md shadow-white/10 md:bg-gradient-to-r md:from-[#00E676] md:to-[#00B0FF] md:text-slate-950 md:border-emerald-400 md:shadow-lg md:scale-102"
                          : "bg-white/[0.035] text-slate-400 border-white/[0.10] hover:text-white hover:bg-white/[0.08] md:bg-[#121214] md:border-[#2D2D35] md:hover:bg-slate-900"
                      }`}
                    >
                      {preset === "all" && "All"}
                      {preset === "today" && "Today"}
                      {preset === "yesterday" && "Yesterday"}
                      {preset === "weekly" && "7 Days"}
                      {preset === "monthly" && "This Month"}
                      {preset === "yearly" && "This Year"}
                      {preset === "custom" && "Custom"}
                    </button>
                  ))}
                </div>

                {ledgerDateFilterType === "custom" && (
                  <div className="flex items-center gap-2.5 bg-[#121214] border border-[#2D2D35] p-1.5 rounded-xl" id="ledger-custom-date-inputs">
                    <input
                      type="date"
                      value={ledgerStartDate}
                      onChange={(e) => setLedgerStartDate(e.target.value)}
                      className="bg-transparent border-none text-white font-mono text-xs outline-none"
                    />
                    <span className="text-slate-600 text-xs font-bold shrink-0">to</span>
                    <input
                      type="date"
                      value={ledgerEndDate}
                      onChange={(e) => setLedgerEndDate(e.target.value)}
                      className="bg-transparent border-none text-white font-mono text-xs outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Transactions Timeline List Feed */}
              <div className="space-y-4" id="ledger-timeline-feed">
                {filteredTransactions.length === 0 ? (
                  <div className="py-16 text-center text-slate-450 italic bg-[#1E1E24] border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
                    <span className="text-4xl text-slate-600">🗄️</span>
                    <p className="text-xs font-mono leading-normal">No custom entries or receipt files found in active filter catalog.</p>
                  </div>
                ) : (
                  paginatedLedgerTransactions.map((t) => {
                    const associatedContact = contacts.find(c => c.id === t.contactId);
                    const customerLabel = associatedContact ? associatedContact.name : "Walk-in Showroom Client";
                    const customerPhone = associatedContact ? associatedContact.phone : null;
                    const storedDue = t.dueBalance ?? t.due_balance;
                    const calculatedDue = (Number(t.total ?? t.grandTotal ?? t.grand_total) || 0) -
                      (Number(t.paidAmount ?? t.paid_amount) || 0);
                    // Determine card color from the real remaining balance, not a stale status label.
                    const outstandingDue = Math.max(0, Number(storedDue) || 0, calculatedDue);
                    const hasOutstandingDue = outstandingDue > 0;

                    return (
                      <div
                        key={t.id}
                        data-customer-payment-status={hasOutstandingDue ? "due" : "cleared"}
                        className="mx-auto w-full max-w-5xl rounded-2xl border-[1.5px] bg-[#1E1E24]/95 p-3 shadow-lg transition-all sm:p-4"
                        style={{
                          borderColor: hasOutstandingDue ? "#FF304F" : "#00E676",
                          borderWidth: "1.5px",
                          borderStyle: "solid",
                          boxShadow: hasOutstandingDue
                            ? "inset 0 0 0 1px rgba(255,48,79,0.10), 0 0 8px rgba(255,48,79,0.12)"
                            : "inset 0 0 0 1px rgba(0,230,118,0.10), 0 0 8px rgba(0,230,118,0.12)"
                        }}
                      >
                        {/* Centered invoice identity */}
                        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center">
                          <span className="rounded-md border border-slate-700 bg-black/35 px-2.5 py-1 text-[11px] font-black tracking-wide text-white">
                            {t.invoiceNo}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                            <Calendar className="h-3 w-3" />
                            {new Date(t.date).toLocaleDateString()} · {new Date(t.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${
                            t.status === "paid"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : t.status === "partial"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                          }`}>
                            {t.status === "due" ? "Due Status" : t.status === "partial" ? "Partially Settled" : "Fully Settled"}
                          </span>
                        </div>

                        {/* Compact centered customer details */}
                        <div className="mx-auto mt-2 grid w-full max-w-4xl grid-cols-1 items-center gap-2 text-center lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-5">
                          <div className="hidden items-center justify-center gap-2.5 lg:flex">
                            <span className="h-px w-10 bg-gradient-to-r from-transparent to-slate-500/50" />
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.045] text-[11px] text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">✦</span>
                            <span className="flex flex-col items-start gap-0.5 text-left">
                              <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400">Customer</span>
                              <span className="text-[7px] font-mono tracking-[0.16em] text-slate-600">PROFILE</span>
                            </span>
                          </div>
                          <div className="min-w-0 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                            <strong className="text-[12px] font-semibold text-white">{customerLabel}</strong>
                            {customerPhone && (
                              <span className="text-[10px] font-mono text-slate-400">{customerPhone}</span>
                            )}
                          </div>
                          {associatedContact?.address && (
                            <p className="mx-auto mt-1 max-w-2xl break-words text-[10px] leading-relaxed text-slate-500">
                              {associatedContact.address}
                            </p>
                          )}
                          </div>
                          <div className="hidden items-center justify-center gap-2.5 lg:flex">
                            <span className="flex flex-col items-end gap-0.5 text-right">
                              <span className="text-[8px] font-bold tracking-[0.12em] text-slate-300">BARAKAH e-MART</span>
                              <span className="text-[7px] font-mono tracking-[0.16em] text-slate-600">CUSTOMER LEDGER</span>
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.045] text-[10px] font-black tracking-tighter text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">B</span>
                            <span className="h-px w-10 bg-gradient-to-l from-transparent to-slate-500/50" />
                          </div>
                        </div>

                        <div className="my-3 border-t border-slate-700/80" />

                        {/* Products grouped by model with visible total quantity; unit-cost allocations remain individually editable */}
                        <div className="space-y-2" id={`ledger-items-${t.invoiceNo}`}>
                          <div className="flex items-center justify-center gap-3 py-1.5">
                            <div className="hidden h-px flex-1 bg-gradient-to-r from-transparent via-slate-500/35 to-slate-500/35 sm:block" />
                            <div className="flex items-center gap-2 rounded-full border border-slate-500/25 bg-slate-400/[0.06] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                              <Package className="h-3 w-3 text-slate-400" />
                              <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-slate-300">Product Details</span>
                            </div>
                            <div className="hidden h-px flex-1 bg-gradient-to-l from-transparent via-slate-500/35 to-slate-500/35 sm:block" />
                          </div>
                          {(() => {
                            const groupedItems = t.items.reduce((groups: any[], item, itemIdx) => {
                              const dbProduct = products.find(p => p.id === item.productId || p.id === item.id || p.name === item.name);
                              const productName = dbProduct ? dbProduct.name : (item.name || "Product Item");
                              const groupKey = String(item.productId || productName).trim().toLowerCase();
                              let group = groups.find(entry => entry.key === groupKey);
                              if (!group) {
                                group = { key: groupKey, name: productName, quantity: 0, entries: [] };
                                groups.push(group);
                              }
                              const buyCost = getAverageCostFromAllocations(item, dbProduct?.buyPrice ?? 0);
                              group.quantity += Math.max(0, Number(item.quantity) || 0);
                              group.entries.push({ item, itemIdx, unitCosts: getCostAllocationsForItem(item, buyCost) });
                              return groups;
                            }, []);

                            return groupedItems.map((group) => {
                              const editorKey = `${t.id}-${group.key}`;
                              const showEdit = showCostEditId === editorKey;
                              return (
                                <div key={group.key} className="rounded-lg px-1 py-1.5">
                                  <p className="flex flex-wrap items-center justify-center gap-x-2 text-center text-[11px] font-semibold leading-snug text-white">
                                    <span>{group.name}</span>
                                    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-bold text-white">
                                      {group.quantity} {group.quantity === 1 ? "Pc" : "Pcs"}
                                    </span>
                                  </p>
                                  {currentPanel === "admin" && (
                                    <div className="mt-1 flex justify-center">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowCostEditId(showEdit ? null : editorKey);
                                        }}
                                        className="min-w-[150px] rounded-full border border-slate-300/40 bg-gradient-to-b from-slate-300/20 via-slate-400/10 to-slate-500/15 px-5 py-1 text-[9px] font-semibold tracking-wide text-white shadow-[0_3px_14px_rgba(148,163,184,0.12),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-2xl transition-all hover:border-slate-200/60 hover:from-slate-300/25 hover:to-slate-500/20 active:scale-[0.98]"
                                        title="Edit the cost of each purchased unit independently"
                                      >
                                        {showEdit ? "Close Unit Cost" : "Edit Unit Cost"}
                                      </button>
                                    </div>
                                  )}

                                  {currentPanel === "admin" && showEdit && (
                                    <div className="mx-auto mt-2 w-full max-w-2xl rounded-xl border border-white/15 bg-white/[0.06] p-3 shadow-inner backdrop-blur-xl">
                                      <div className="flex flex-wrap justify-center gap-2">
                                        {group.entries.flatMap((entry: any) =>
                                          entry.unitCosts.map((allocation: any, allocationIdx: number) => (
                                            <div key={`${entry.itemIdx}-${allocation.id || allocationIdx}`} className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/35 px-2.5 py-2">
                                              <label className="whitespace-nowrap text-[9px] text-slate-300">
                                                Unit {allocationIdx + 1 + group.entries.slice(0, group.entries.indexOf(entry)).reduce((sum: number, previous: any) => sum + previous.unitCosts.length, 0)}
                                              </label>
                                              <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                defaultValue={allocation.unitCost}
                                                id={`buy-cost-${t.id}-${entry.itemIdx}-${allocationIdx}`}
                                                className="w-24 rounded-md border border-white/20 bg-black/70 px-2 py-1.5 text-[10px] text-white outline-none focus:border-white/60"
                                                onClick={(e) => e.stopPropagation()}
                                              />
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const val = parseFloat((document.getElementById(`buy-cost-${t.id}-${entry.itemIdx}-${allocationIdx}`) as HTMLInputElement)?.value);
                                                  if (!isNaN(val) && val >= 0) {
                                                    handleUpdateTransactionItemUnitCost(t.id, entry.itemIdx, allocationIdx, val);
                                                  }
                                                }}
                                                className="rounded-full border border-white/55 !bg-white/10 px-4 py-1.5 text-[9px] font-bold !text-white shadow-[0_2px_12px_rgba(255,255,255,0.12)] backdrop-blur-xl transition-all hover:!bg-white/20 hover:border-white/80 active:scale-[0.98]"
                                              >
                                                Save
                                              </button>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>

                        <div className="my-3 border-t border-slate-700/80" />

                        {/* Compact one-line financial summary */}
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] font-mono sm:gap-x-6">
                          <span className="font-bold text-white">
                            Grand Total: {businessInfo.currencySymbol} {t.total.toLocaleString()}
                          </span>
                          <span className="text-emerald-400">
                            Collected: {businessInfo.currencySymbol} {t.paidAmount.toLocaleString()}
                          </span>
                          {t.dueBalance > 0 ? (
                            <span className="font-bold text-rose-400">
                              Outstanding Due: {businessInfo.currencySymbol} {t.dueBalance.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-500">No Outstanding Due</span>
                          )}
                        </div>

                        {/* All transaction actions stay on one horizontal row */}
                        <div id={`ledger-actions-${t.invoiceNo}`} className="mt-3 border-t border-slate-800/80 pt-3">
                          <div className="mb-2 flex items-center justify-center gap-3">
                            <div className="hidden h-px flex-1 bg-gradient-to-r from-transparent via-slate-500/30 to-slate-500/30 sm:block" />
                            <span className="rounded-full border border-slate-500/20 bg-white/[0.035] px-3 py-1 text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400">Documents & Actions</span>
                            <div className="hidden h-px flex-1 bg-gradient-to-l from-transparent via-slate-500/30 to-slate-500/30 sm:block" />
                          </div>
                          <div className="grid grid-cols-2 items-stretch justify-center gap-2 sm:flex sm:flex-wrap sm:items-center">
                          <button
                            id={`download-pdf-${t.invoiceNo}`}
                            onClick={async () => {
                              try {
                                const dataUrl = await generateInvoicePDF(t, associatedContact, businessInfo, "preview");
                                if (typeof dataUrl === "string") setLedgerDocumentPreview({ title: `Invoice ${t.invoiceNo}`, dataUrl });
                              } catch (error) {
                                console.error("Could not prepare invoice preview:", error);
                                triggerNotification("Invoice preview could not be opened. Please try again.", "error");
                              }
                            }}
                            className="inline-flex h-10 w-full min-w-0 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/[0.08] px-3 text-[11px] font-bold text-white shadow-sm transition-all hover:border-white/60 hover:bg-white/[0.14] active:scale-[0.98] sm:w-auto sm:min-w-[104px] sm:px-4"
                            title="Preview customer invoice"
                          >
                            <FileText className="h-4 w-4" /> Invoice
                          </button>
                          <button
                            id={`download-challan-${t.invoiceNo}`}
                            onClick={async () => {
                              try {
                                const dataUrl = await generateDeliveryChallanPDF(t, associatedContact, businessInfo, "preview");
                                if (typeof dataUrl === "string") setLedgerDocumentPreview({ title: `Delivery Challan ${t.invoiceNo}`, dataUrl });
                              } catch (error) {
                                console.error("Could not prepare delivery challan preview:", error);
                                triggerNotification("Delivery challan preview could not be opened. Please try again.", "error");
                              }
                            }}
                            className="inline-flex h-10 w-full min-w-0 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/[0.08] px-3 text-[11px] font-bold text-white shadow-sm transition-all hover:border-white/60 hover:bg-white/[0.14] active:scale-[0.98] sm:w-auto sm:min-w-[104px] sm:px-4"
                            title="Preview delivery challan"
                          >
                            <Printer className="h-4 w-4" /> Challan
                          </button>
                          {t.dueBalance > 0 ? (
                            <button
                              onClick={() => {
                                setCollectionTx(t);
                                setCollectAmount(t.dueBalance.toString());
                              }}
                              className="inline-flex h-10 w-full min-w-0 shrink-0 items-center justify-center rounded-xl border border-rose-400/45 bg-rose-500/12 px-3 text-[11px] font-bold text-rose-200 shadow-sm transition-all hover:bg-rose-500/20 active:scale-[0.98] sm:w-auto sm:min-w-[104px] sm:px-4"
                            >
                              Collect Due
                            </button>
                          ) : (
                            <span className="inline-flex h-10 w-full min-w-0 shrink-0 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 text-[11px] font-bold text-emerald-300 sm:w-auto sm:min-w-[104px] sm:px-4">
                              Paid
                            </span>
                          )}
                          <button
                            onClick={() => setEditingTx(t)}
                            className="inline-flex h-10 w-full min-w-0 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-400/10 px-3 text-[11px] font-bold text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:border-emerald-300/60 hover:bg-emerald-400/15 active:scale-[0.98] sm:w-auto sm:min-w-[104px] sm:px-4"
                            title="Edit Sale Details & Selling Price"
                          >
                            <Edit3 className="h-4 w-4" /> Edit
                          </button>

                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination is available for every date range, not only All Time. */}
              {filteredTransactions.length > ledgerPageSize && (
                <div id="ledger-pagination" className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3">
                  <span className="text-[11px] font-medium text-slate-300">
                    Showing {(safeLedgerPage - 1) * ledgerPageSize + 1}–{Math.min(safeLedgerPage * ledgerPageSize, filteredTransactions.length)} of {filteredTransactions.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" disabled={safeLedgerPage <= 1} onClick={() => setLedgerCurrentPage(1)} className="rounded-lg border border-white/15 px-2.5 py-2 text-[11px] font-bold text-white disabled:opacity-35">First</button>
                    <button type="button" disabled={safeLedgerPage <= 1} onClick={() => setLedgerCurrentPage(p => Math.max(1, p - 1))} className="rounded-lg border border-white/15 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-35">Prev</button>
                    <span className="min-w-[58px] text-center text-[11px] font-bold text-white">{safeLedgerPage} / {ledgerTotalPages}</span>
                    <button type="button" disabled={safeLedgerPage >= ledgerTotalPages} onClick={() => setLedgerCurrentPage(p => Math.min(ledgerTotalPages, p + 1))} className="rounded-lg border border-white/15 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-35">Next</button>
                    <button type="button" disabled={safeLedgerPage >= ledgerTotalPages} onClick={() => setLedgerCurrentPage(ledgerTotalPages)} className="rounded-lg border border-white/15 px-2.5 py-2 text-[11px] font-bold text-white disabled:opacity-35">Last</button>
                  </div>
                </div>
              )}

              {/* Sticky Top Metrics Summary Pane */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="ledger-sticky-metrics">
                
                <div className="bg-[#1E1E24] border border-slate-800/85 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 block">Total Memos</span>
                    <span className="text-xl font-black text-white font-mono">{filteredTransactions.length}</span>
                  </div>
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#1E1E24] border border-slate-800/85 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 block">Total Booked Sales</span>
                    <span className="text-xl font-black text-white font-mono">{businessInfo.currencySymbol} {filteredTransactions.reduce((sum, t) => sum + t.total, 0).toLocaleString()}</span>
                  </div>
                  <div className="p-2.5 bg-[#00B0FF]/10 rounded-xl text-[#00B0FF]">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#1E1E24] border border-slate-800/85 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 block">Total Settled Cash</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">{businessInfo.currencySymbol} {filteredTransactions.reduce((sum, t) => sum + t.paidAmount, 0).toLocaleString()}</span>
                  </div>
                  <div className="p-2.5 bg-[#00E676]/10 rounded-xl text-emerald-400">
                    <PiggyBank className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#1E1E24] border border-slate-800/85 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider font-mono text-rose-450 block">Outstanding Due</span>
                    <span className="text-xl font-black text-rose-400 font-mono">{businessInfo.currencySymbol} {filteredTransactions.reduce((sum, t) => sum + t.dueBalance, 0).toLocaleString()}</span>
                  </div>
                  <div className="p-2.5 bg-red-500/10 rounded-xl text-rose-400">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                </div>

              </div>

            </div>
          )}



          {/* -----------------------------------------------------------------
              VIEW 5: EXPENSES LEDGER WITH AI CATEGORY INFERENCE
              ----------------------------------------------------------------- */}
          {/* -----------------------------------------------------------------
              VIEW 5: EXPENSES LEDGER WITH AI CATEGORY INFERENCE
              ----------------------------------------------------------------- */}
          {activeTab === "expenses" && (() => {
            const monthKey = getExpenseMonthKey(new Date().toISOString().slice(0, 10));
            const monthExpenses = expenses.filter(e => getExpenseMonthKey(e.date) === monthKey);
            const monthTotal = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            const categoryTotals = allCategories.map(category => ({
              category,
              total: monthExpenses.filter(e => e.category === category).reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
              count: monthExpenses.filter(e => e.category === category).length
            })).filter(item => item.total > 0).sort((a, b) => b.total - a.total);
            const maxCategoryTotal = Math.max(1, ...categoryTotals.map(item => item.total));
            const selectedPeriodExpenses = expenses.filter(e => checkExpenseDateInFilter(e.date));
            const selectedPeriodTotal = selectedPeriodExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            const selectedPeriodCategoryTotals = allCategories.map(category => ({
              category,
              total: selectedPeriodExpenses.filter(e => e.category === category).reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
            })).filter(item => item.total > 0).sort((a, b) => b.total - a.total);
            const deliveryHistoryExpenses: Expense[] = deliveryExpenseRecords.map((expense: any) => ({
              id: `delivery_staff_expense_${expense.id}`,
              source: "delivery",
              sourceId: String(expense.id),
              category: expense.category || "Delivery Staff Expense",
              amount: Number(expense.amount) || 0,
              description: expense.reason || expense.description || "Delivery staff expense",
              date: String(expense.recorded_at || expense.created_at || expense.date || "").slice(0, 10),
              recordedAt: expense.recorded_at || expense.created_at || expense.date || "",
              driverName: expense.driver_name || "",
              paymentStatus: expense.payment_status === "paid" ? "paid" : "unpaid"
            }));
            const historyRecords = [...expenses, ...deliveryHistoryExpenses];
            const sortedHistory = historyRecords
              .filter(e => (expenseFilterCategory === "All" || e.category === expenseFilterCategory) && checkExpenseDateInFilter(e.source === "delivery" ? String(e.recordedAt || e.date) : e.date, e.source === "delivery"))
              .slice()
              .sort((a, b) => new Date(b.recordedAt || b.date).getTime() - new Date(a.recordedAt || a.date).getTime());
            const money = (amount: number) => `${businessInfo.currencySymbol || "৳"} ${(Number(amount) || 0).toLocaleString()}`;

            const renderExpenseDateFilters = () => (
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Date &amp; Time Filter</div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2" id="expense-date-presets">
                    {[
                      { id: "today", label: "Today" },
                      { id: "yesterday", label: "Yesterday" },
                      { id: "weekly", label: "7 Days" },
                      { id: "monthly", label: "This Month" },
                      { id: "yearly", label: "This Year" },
                      { id: "custom", label: "Custom Date / Range" }
                    ].map(preset => (
                      <button key={preset.id} type="button" onClick={() => setExpenseDateFilter(preset.id as any)}
                        className={`px-3 py-2 rounded-xl border text-[10px] sm:text-xs font-bold transition-all ${expenseDateFilter === preset.id ? "bg-white/[0.14] border-white/[0.28] text-white shadow-sm" : "bg-white/[0.035] border-white/[0.09] text-slate-400 hover:text-white hover:border-white/[0.20]"}`}>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {expenseDateFilter === "custom" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-white/[0.10] bg-white/[0.045] p-3" id="expense-custom-date-range">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">From Date</label>
                        <input type="date" value={expenseCustomStart} max={expenseCustomEnd || undefined} onChange={e => updateExpenseCustomStart(e.target.value)} className="w-full px-3 py-2.5 bg-black/25 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-white/40" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">To Date</label>
                        <input type="date" value={expenseCustomEnd} min={expenseCustomStart || undefined} onChange={e => updateExpenseCustomEnd(e.target.value)} className="w-full px-3 py-2.5 bg-black/25 border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-white/40" />
                      </div>
                      <p className="sm:col-span-2 text-[10px] text-slate-500">Select the same start and end date to view expenses for one specific day.</p>
                      {expenseCustomStart && expenseCustomEnd && expenseCustomStart > expenseCustomEnd && <p className="sm:col-span-2 text-[10px] text-white">Start date/time cannot be later than end date/time.</p>}
                    </div>
                  )}
                </div>
              );

              return (
              <div className="relative isolate space-y-5 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#040508] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.42)] animate-fade-in sm:p-5 lg:p-6" id="view-expenses-outer-container">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80" style={{ backgroundImage: "radial-gradient(ellipse at 12% 5%, rgba(255,255,255,0.035), transparent 42%), radial-gradient(ellipse at 90% 90%, rgba(255,255,255,0.025), transparent 40%)" }} />
                <div className="relative z-10 space-y-5">
                {expenseSection === "home" ? (
                  <section
                    className="relative isolate min-h-[68vh] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#040508] shadow-[0_24px_80px_rgba(0,0,0,0.42)]"
                    aria-label="Expenses workspaces"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-90"
                      style={{
                        backgroundImage: "radial-gradient(ellipse at 14% 8%, rgba(255,255,255,0.035), transparent 40%), radial-gradient(ellipse at 88% 88%, rgba(255,255,255,0.025), transparent 38%)"
                      }}
                    />
                    <div aria-hidden="true" className="pointer-events-none absolute -top-28 right-[-5rem] h-72 w-72 rounded-full bg-white/[0.035] blur-3xl" />
                    <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-[-4rem] h-80 w-80 rounded-full bg-white/[0.025] blur-3xl" />

                    <div className="relative z-10 flex min-h-[68vh] flex-col justify-center px-5 py-9 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
                      <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-2xl">
                          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.045] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/75 shadow-inner shadow-white/[0.025] backdrop-blur-xl">
                            <span className="h-1.5 w-1.5 rounded-full bg-white/75" />
                            Finance Workspace
                          </div>
                          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-[2.6rem]">Expenses Management</h2>
                          <p className="mt-3 max-w-xl text-xs leading-6 text-slate-400 sm:text-sm">
                            Manage business expenses in one place. Choose a workspace below to get started.
                          </p>
                        </div>
                        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.035] px-3.5 py-2.5 text-[10px] font-semibold tracking-wide text-white/75 shadow-lg shadow-black/20 backdrop-blur-xl">
                          <Layers className="h-4 w-4 text-white/75" />
                          3 Dedicated Workspaces
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
                        {[
                          { id: "add", label: "Add Expenses", description: "Record a new business expense with date, category and details.", detail: "Create expense", Icon: PlusCircle },
                          { id: "history", label: "Expenses History", description: "Review saved expenses, filter records and manage entries.", detail: "View records", Icon: History },
                          { id: "categories", label: "Add Category", description: "Organize your spending with custom expense categories.", detail: "Manage categories", Icon: Tag }
                        ].map(item => {
                          const Icon = item.Icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setExpenseSection(item.id as any)}
                              className="group relative flex min-h-[205px] flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0f121d]/85 p-5 text-left shadow-[0_12px_36px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.20] hover:bg-[#151925]/95 hover:shadow-[0_20px_48px_rgba(0,0,0,0.42)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:p-6"
                            >
                              <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/[0.035] opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
                              <div className="relative flex w-full items-start justify-between">
                                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.10] bg-white/[0.055] text-white/90 shadow-inner shadow-white/[0.04]">
                                  <Icon className="h-5 w-5" />
                                </span>
                                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.025] text-white/55 transition-all group-hover:translate-x-1 group-hover:border-white/20 group-hover:text-white">
                                  <span aria-hidden="true">↗</span>
                                </span>
                              </div>
                              <span className="relative mt-8 block text-base font-extrabold tracking-tight text-white sm:text-lg">{item.label}</span>
                              <span className="relative mt-2 block max-w-xs text-[11px] leading-5 text-slate-400 sm:text-xs">{item.description}</span>
                              <span className="relative mt-auto flex items-center gap-2 pt-5 text-[10px] font-bold tracking-wide text-white/75">
                                {item.detail}<span aria-hidden="true">→</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <section
                        className="relative mt-8 overflow-hidden rounded-[26px] border border-white/[0.10] bg-white/[0.035] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:mt-10 sm:p-6 lg:p-7"
                        aria-label="This month expenses breakdown"
                      >
                        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.035] blur-3xl" />
                        <div className="relative z-10">
                          <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.06] text-white/90 shadow-inner shadow-white/[0.04]">
                                <BarChart3 className="h-5 w-5" />
                              </span>
                              <div>
                                <h3 className="text-base font-black tracking-tight text-white sm:text-lg">Expenses Breakdown</h3>
                                <p className="mt-0.5 text-[10px] text-slate-400 sm:text-xs">A clear view of where your money went this month</p>
                              </div>
                            </div>
                            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.045] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/70">
                              <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                              {format(new Date(), "MMMM yyyy")}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                            <div className="rounded-2xl border border-white/[0.09] bg-black/25 p-4">
                              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">Total Expenses</p>
                              <p className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">{money(monthTotal)}</p>
                              <p className="mt-1 text-[10px] text-slate-500">Spent this month</p>
                            </div>
                            <div className="rounded-2xl border border-white/[0.09] bg-black/25 p-4">
                              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">Expense Entries</p>
                              <p className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">{monthExpenses.length.toLocaleString()}</p>
                              <p className="mt-1 text-[10px] text-slate-500">Recorded this month</p>
                            </div>
                            <div className="rounded-2xl border border-white/[0.09] bg-black/25 p-4">
                              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">Top Spending Category</p>
                              <p className="mt-2 truncate text-lg font-black tracking-tight text-white sm:text-xl">{categoryTotals[0]?.category || "—"}</p>
                              <p className="mt-1 text-[10px] text-slate-500">{categoryTotals[0] ? money(categoryTotals[0].total) : "No expenses yet"}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[0.85fr_1.5fr] lg:gap-5">
                            <div className="relative overflow-hidden rounded-2xl border border-white/[0.10] bg-gradient-to-br from-white/[0.075] to-white/[0.015] p-5">
                              <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -right-8 h-36 w-36 rounded-full bg-white/[0.045] blur-2xl" />
                              <div className="relative">
                                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Highest Monthly Spend</p>
                                {categoryTotals.length > 0 ? (
                                  <>
                                    <h4 className="mt-3 text-xl font-black tracking-tight text-white sm:text-2xl">{categoryTotals[0].category}</h4>
                                    <p className="mt-2 text-2xl font-black tracking-tight text-white">{money(categoryTotals[0].total)}</p>
                                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                                      <div className="h-full rounded-full bg-gradient-to-r from-white/45 to-white/90" style={{ width: `${Math.min(100, (categoryTotals[0].total / Math.max(1, monthTotal)) * 100)}%` }} />
                                    </div>
                                    <p className="mt-2 text-[10px] text-slate-400">{Math.round((categoryTotals[0].total / Math.max(1, monthTotal)) * 100)}% of this month's expenses</p>
                                  </>
                                ) : (
                                  <div className="mt-5">
                                    <p className="text-lg font-bold text-white">No spending recorded</p>
                                    <p className="mt-2 text-xs leading-5 text-slate-400">Your category breakdown will appear here when expenses are added.</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/[0.09] bg-black/20 p-4 sm:p-5">
                              <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                  <h4 className="text-xs font-extrabold text-white sm:text-sm">Category-wise Spending</h4>
                                  <p className="mt-1 text-[9px] text-slate-500 sm:text-[10px]">Monthly expense distribution</p>
                                </div>
                                <span className="text-[9px] font-semibold text-slate-500">{categoryTotals.length} {categoryTotals.length === 1 ? "category" : "categories"}</span>
                              </div>
                              {categoryTotals.length > 0 ? (
                                <div className="space-y-4">
                                  {categoryTotals.map((item, index) => {
                                    const share = Math.round((item.total / Math.max(1, monthTotal)) * 100);
                                    return (
                                      <div key={item.category} className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-3 text-[10px] sm:text-xs">
                                          <span className="min-w-0 truncate font-semibold text-slate-200">{item.category}</span>
                                          <span className="shrink-0 font-bold tabular-nums text-white">{money(item.total)} <span className="ml-1 text-slate-500">{share}%</span></span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                                          <div className="h-full rounded-full bg-gradient-to-r from-white/35 via-white/65 to-white/90 transition-all duration-500" style={{ width: `${Math.max(2, (item.total / Math.max(1, maxCategoryTotal)) * 100)}%`, opacity: Math.max(0.48, 1 - index * 0.09) }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex min-h-36 flex-col items-center justify-center text-center">
                                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-white/55"><BarChart3 className="h-4 w-4" /></span>
                                  <p className="mt-3 text-xs font-semibold text-slate-300">No category data yet</p>
                                  <p className="mt-1 text-[10px] text-slate-500">Add an expense to see the monthly breakdown.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>
                      <p className="mt-7 text-center text-[9px] font-medium tracking-wide text-slate-500">
                        Select a workspace to continue · Your saved expense data remains unchanged
                      </p>
                    </div>
                  </section>
                ) : (
                  <div className="relative z-10 rounded-2xl border border-white/[0.10] bg-white/[0.035] p-3 shadow-lg shadow-black/20 backdrop-blur-2xl space-y-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setExpenseSection("home")} className="shrink-0 px-3 py-2 rounded-xl border border-white/[0.12] bg-white/[0.045] text-slate-200 hover:bg-white/[0.09] hover:text-white text-xs font-bold transition-colors">← Back</button>
                      <div className="min-w-0">
                        <h2 className="text-base sm:text-lg font-black text-white">{expenseSection === "add" ? "Add Expenses" : expenseSection === "history" ? "Expenses History" : "Add Category"}</h2>
                        <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{expenseSection === "add" ? "Record and review expenses for the selected period." : expenseSection === "history" ? "Search and manage saved expense records." : "Create and manage your expense categories."}</p>
                      </div>
                    </div>
                    {(expenseSection === "add" || expenseSection === "history") && renderExpenseDateFilters()}
                  </div>
                )}

                {expenseSection === "add" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    <div className="lg:col-span-7 rounded-2xl border border-white/[0.10] bg-white/[0.035] p-4 shadow-xl shadow-black/20 backdrop-blur-2xl space-y-5 sm:p-6">
                      <div>
                        <h3 className="text-sm font-bold text-white">Add New Expense</h3>
                        <p className="text-[10px] text-slate-400 mt-1">Enter the date, category, amount and reason for the expense.</p>
                      </div>
                      <form onSubmit={handleAddExpense} className="space-y-4" id="outgoing-add-form">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expense Date *</label>
                            <input type="date" required value={expenseDate} onChange={e => setExpenseDate(e.target.value)}
                              className="w-full px-3 py-3 bg-black/25 border border-slate-800 rounded-xl text-white text-sm outline-none focus:border-white/40" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expense Category *</label>
                            <select required value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}
                              className="w-full px-3 py-3 bg-black/25 border border-slate-800 rounded-xl text-white text-sm outline-none focus:border-white/40">
                              {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount ({businessInfo.currencySymbol || "৳"}) *</label>
                          <input type="number" min="0.01" step="0.01" required value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)}
                            placeholder="Enter expense amount" className="w-full px-3 py-3 bg-black/25 border border-slate-800 rounded-xl text-white text-sm outline-none focus:border-white/40 font-mono" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expense Details / Reason *</label>
                          <textarea required value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)}
                            placeholder="Write why this expense was made. Example: showroom electricity bill for November."
                            rows={5} className="w-full px-3 py-3 bg-black/25 border border-slate-800 rounded-xl text-white text-sm outline-none focus:border-white/40 resize-y" />
                        </div>
                        <button type="submit" className="w-full py-3.5 bg-white hover:bg-slate-200 text-[#08090d] font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2">
                          <PlusCircle className="w-4 h-4" /> Save Expense
                        </button>
                      </form>
                    </div>
                    <div className="lg:col-span-5 rounded-2xl border border-white/[0.10] bg-white/[0.035] p-4 shadow-xl shadow-black/20 backdrop-blur-2xl space-y-3 sm:p-5">
                      <h3 className="text-sm font-bold text-white">Quick Overview</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/[0.045] rounded-xl p-3 border border-slate-800"><span className="text-[9px] text-slate-500 uppercase block">Selected Period</span><strong className="text-sm text-white font-mono">{money(selectedPeriodTotal)}</strong></div>
                        <div className="bg-white/[0.045] rounded-xl p-3 border border-slate-800"><span className="text-[9px] text-slate-500 uppercase block">Entries</span><strong className="text-sm text-white font-mono">{selectedPeriodExpenses.length}</strong></div>
                      </div>
                      <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-bold pt-2">Highest Expense Categories</h4>
                      {selectedPeriodCategoryTotals.slice(0, 5).length ? selectedPeriodCategoryTotals.slice(0, 5).map(item => (
                        <div key={item.category} className="flex items-center justify-between gap-2 border-b border-slate-800/70 pb-2 text-xs">
                          <span className="text-slate-300 truncate">{item.category}</span><strong className="text-white/85 font-mono shrink-0">{money(item.total)}</strong>
                        </div>
                      )) : <p className="text-xs text-slate-500">No category totals yet.</p>}
                      <button type="button" onClick={() => setExpenseSection("history")} className="w-full mt-2 py-2.5 border border-slate-700 hover:border-white/30 rounded-xl text-xs font-bold text-slate-300 hover:text-white">View Expenses History</button>
                    </div>
                  </div>
                )}

                {expenseSection === "history" && (
                  <div className="rounded-2xl border border-white/[0.10] bg-transparent overflow-hidden" id="expenses-list-panel">
                    <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div><h3 className="text-sm font-bold text-white">Expenses History</h3><p className="text-[10px] text-slate-400 mt-1">Review every saved expense and its reason.</p></div>
                      <div className="sm:text-right"><span className="block text-[9px] text-slate-500 uppercase">Filtered Total</span><strong className="text-sm text-white font-mono">{money(sortedHistory.reduce((sum,e)=>sum+(Number(e.amount)||0),0))}</strong></div>
                    </div>
                    <div className="p-3 sm:p-4 border-b border-slate-800">
                      <select value={expenseFilterCategory} onChange={e => setExpenseFilterCategory(e.target.value)} className="w-full sm:w-64 px-3 py-2.5 bg-black/25 border border-slate-800 rounded-xl text-xs text-white">
                        {["All", ...allCategories].map(cat => <option key={cat} value={cat}>{cat === "All" ? "All Categories" : cat}</option>)}
                      </select>
                    </div>
                    <div className="p-3 sm:p-4 space-y-3 max-h-[720px] overflow-y-auto">
                      {sortedHistory.length ? sortedHistory.map(e => (
                        <article key={e.id} className="border-b border-white/[0.09] bg-transparent rounded-none p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 last:border-b-0 hover:bg-white/[0.025] transition-colors">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2"><span className="px-2 py-1 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white/85 text-[10px] font-bold">{e.category}</span><span className="text-[10px] text-slate-500">{e.source === "delivery" && e.recordedAt ? new Date(e.recordedAt).toLocaleString() : e.date}</span>{e.source === "delivery" && <span className={`px-2 py-1 rounded-lg text-[9px] font-bold ${e.paymentStatus === "paid" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{e.paymentStatus === "paid" ? "Paid" : "Unpaid"} · Delivery</span>}</div>
                            <p className="text-xs text-slate-200 whitespace-pre-line break-words">{e.description}{e.source === "delivery" && e.driverName ? ` · Driver: ${e.driverName}` : ""}</p>
                          </div>
                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 sm:shrink-0">
                            <strong className="text-sm text-white/85 font-mono">{money(e.amount)}</strong>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { setEditingExpense(e); setEditExpenseDesc(e.description); setEditExpenseCategory(e.category); setEditExpenseAmount(String(e.amount)); setEditExpenseDate(e.date); setEditExpenseRecordedAt(e.source === "delivery" ? toLocalDateTimeInput(e.recordedAt || e.date) : ""); }}
                                className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-slate-200 text-[10px] font-bold flex items-center gap-1"><Edit3 className="w-3 h-3" /> Edit</button>
                              <button type="button" onClick={() => setDeleteExpenseId(e.id)} className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/85 text-[10px] font-bold flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
                            </div>
                          </div>
                        </article>
                      )) : <div className="py-14 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">No expense records found for this filter.</div>}
                    </div>
                  </div>
                )}

                {expenseSection === "categories" && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    <div className="lg:col-span-5 rounded-2xl border border-white/[0.10] bg-white/[0.035] p-4 shadow-xl shadow-black/20 backdrop-blur-2xl space-y-4 sm:p-5">
                      <div><h3 className="text-sm font-bold text-white">Add Expense Category</h3><p className="text-[10px] text-slate-400 mt-1">Create a category to organize future expenses.</p></div>
                      <form onSubmit={e => {
                        e.preventDefault();
                        const name = newCategoryName.trim();
                        if (!name) return;
                        if (allCategories.some(cat => cat.toLowerCase() === name.toLowerCase())) { triggerNotification("This category already exists.", "error"); return; }
                        setExpenseCategories(prev => [...prev, name]);
                        setExpenseCategory(name);
                        setNewCategoryName("");
                        triggerNotification("Expense category added successfully.", "success");
                      }} className="space-y-3">
                        <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="e.g. Internet Bill, Transport, Repair" required
                          className="w-full px-3 py-3 bg-black/25 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-white/40" />
                        <button type="submit" className="w-full py-3 rounded-xl bg-white hover:bg-slate-200 text-[#08090d] text-xs font-extrabold flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add Category</button>
                      </form>
                    </div>
                    <div className="lg:col-span-7 rounded-2xl border border-white/[0.10] bg-white/[0.035] p-4 shadow-xl shadow-black/20 backdrop-blur-2xl space-y-3 sm:p-5">
                      <div><h3 className="text-sm font-bold text-white">Manage Expense Categories</h3><p className="text-[10px] text-slate-400 mt-1">Edit or delete a category. Existing expense records will be preserved.</p></div>
                      {allCategories.map(cat => (
                        <div key={cat} className="border-b border-white/[0.09] bg-transparent rounded-none p-3 flex flex-col sm:flex-row sm:items-center gap-2 last:border-b-0 hover:bg-white/[0.025] transition-colors">
                          {categoryToManage === cat ? (
                            <>
                              <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="flex-1 min-w-0 px-3 py-2 bg-black/25 border border-slate-700 rounded-lg text-xs text-white" autoFocus />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => handleEditExpenseCategory(cat,newCategoryName)} className="px-3 py-2 rounded-lg bg-white text-[#08090d] text-[10px] font-bold">Save</button>
                                <button type="button" onClick={() => {setCategoryToManage(null);setNewCategoryName("");}} className="px-3 py-2 rounded-lg bg-white/[0.06] text-slate-300 text-[10px] font-bold">Cancel</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-xs font-semibold text-slate-200">{cat}</span>
                              <span className="text-[10px] text-slate-500">{expenses.filter(e=>e.category===cat).length} records · {money(expenses.filter(e=>e.category===cat).reduce((sum,e)=>sum+(Number(e.amount)||0),0))} total</span>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => {setCategoryToManage(cat);setNewCategoryName(cat);}} className="px-3 py-2 rounded-lg bg-white/[0.06] text-slate-300 text-[10px] font-bold flex items-center gap-1"><Edit3 className="w-3 h-3" /> Edit</button>
                                <button type="button" disabled={cat === "Others"} onClick={() => handleDeleteExpenseCategory(cat)} className="px-3 py-2 rounded-lg bg-white/[0.06] text-white/85 text-[10px] font-bold flex items-center gap-1 disabled:opacity-30"><Trash2 className="w-3 h-3" /> Delete</button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}



                </div>
              </div>
            );
          })()}
          {/* -----------------------------------------------------------------
              VIEW 6: CONTACTS CRM WORKSPACE (CREDIT CUSTOMERS & DEALERS)
              ----------------------------------------------------------------- */}
          {activeTab === "contacts" && (() => {
            const getInitials = (name: string) => {
              return name
                .split(" ")
                .map(p => p[0])
                .filter(Boolean)
                .join("")
                .toUpperCase()
                .slice(0, 2) || "C";
            };

            const getContactStatus = (c: any) => {
              if (c.type === "supplier") {
                return { label: "Dealer / Supplier Lots", color: "bg-[#00B0FF]/10 text-[#00B0FF] border border-[#00B0FF]/25 font-semibold text-[10px]" };
              }
              
              const clientTxs = customerDirectoryData.transactionsByContact.get(c.id) || [];
              const totalOutstandingDue = clientTxs.reduce((sum, t) => {
                const due = t.dueBalance || 0;
                return sum + due;
              }, 0);
              
              if (totalOutstandingDue > 0) {
                return { label: `Due Ledger: ৳${totalOutstandingDue.toLocaleString()}`, color: "bg-[#FF5252]/10 text-[#FF5252] border border-[#FF5252]/20 font-bold text-[10px]" };
              }
              
              if (clientTxs.length >= 2) {
                return { label: "Loyal Shopper", color: "bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold text-[10px]" };
              }
              
              return null;
            };

            const filteredContacts = customerDirectoryData.filteredContacts;

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in" id="view-contacts-container">
                
                {/* Isolated registration form: typing stays local and does not re-render the full POS workspace. */}
                <ContactRegistrationForm
                  editingContact={editingContact}
                  onSubmit={handleAddContact}
                  onCancel={() => setEditingContact(null)}
                  onDelete={async (contact) => {
                    if (currentPanel !== "admin") {
                      triggerNotification("Only administrators can delete a customer ledger.", "error");
                      return;
                    }
                    const linkedTransactions = transactions.filter(tx => tx.contactId === contact.id);
                    try {
                      await Promise.all(linkedTransactions.map(tx => deleteCloudDocument("transactions", tx.firestoreId ?? tx.id)));
                      try {
                        await removeDeliveryAssignmentsForTransactions(linkedTransactions.flatMap(tx => [tx.firestoreId ?? tx.id, tx.id]));
                      } catch (cleanupError) {
                        console.warn("[Ledger] Linked delivery assignment cleanup will retry on Delivery Management load:", cleanupError);
                      }
                      await deleteCloudDocument("customers", contact.id);
                      setTransactions(prev => prev.filter(tx => tx.contactId !== contact.id));
                      setContacts(prev => prev.filter(item => item.id !== contact.id));
                      setEditingContact(null);
                      triggerNotification(`Customer ledger for '${contact.name}' and ${linkedTransactions.length} linked invoice(s) deleted.`, "success");
                    } catch (error) {
                      console.error("Customer ledger deletion failed:", error);
                      triggerNotification("Could not fully delete this customer ledger. Please try again.", "error");
                    }
                  }}
                />

                {/* Contacts directory table representation (8 Cols) */}
                <div className="lg:col-span-8 space-y-4" id="contacts-list-panel">
                  
                  {/* Premium top-bar with search inputs as requested */}
                  <div className="bg-[#1E1E24] p-4 rounded-2xl border border-[#2D2D35] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 text-[#A0A0A5] w-3.5 h-3.5" />
                      <input
                        type="text"
                        placeholder="Search contact profiles by name, mobile, address..."
                        value={contactSearchQuery}
                        onChange={(e) => setContactSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-xs text-white outline-none focus:border-[#00E676] transition-all font-sans"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 md:pb-0">
                      <button
                        onClick={() => setContactTypeFilter("all")}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border cursor-pointer transition-colors ${contactTypeFilter === "all" ? "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20" : "bg-transparent text-[#A0A0A5] border-transparent hover:text-white"}`}
                      >
                        All ({contacts.length})
                      </button>
                      <button
                        onClick={() => setContactTypeFilter("customer")}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border cursor-pointer transition-colors ${contactTypeFilter === "customer" ? "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20" : "bg-transparent text-[#A0A0A5] border-transparent hover:text-white"}`}
                      >
                        Customers ({contacts.filter(c => c.type === "customer").length})
                      </button>
                      <button
                        onClick={() => setContactTypeFilter("supplier")}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border cursor-pointer transition-colors ${contactTypeFilter === "supplier" ? "bg-[#00B0FF]/10 text-[#00B0FF] border-[#00B0FF]/25" : "bg-transparent text-[#A0A0A5] border-transparent hover:text-white"}`}
                      >
                        Suppliers ({contacts.filter(c => c.type === "supplier").length})
                      </button>
                    </div>
                  </div>

                  {/* Highly polished active Self-Healing & Data Recovery banner */}
                  {customerDirectoryData.hasMissingPartnerProfiles && (
                    <details className="rounded-2xl border border-white/12 bg-black/45 shadow-lg backdrop-blur-2xl" id="crm-recovery-banner">
                    <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold text-white/80 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2"><Undo2 className="w-4 h-4 text-sky-400" /> Restore Lost Partner Profiles</span>
                      <span className="text-[10px] text-white/45">Optional recovery tool · Tap to expand</span>
                    </summary>
                    <div className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-500/20 text-[#00E676] rounded-xl border border-emerald-500/30 shrink-0 mt-0.5">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                            Customer & Supplier Data Recovery Center (Self-Healing Active)
                          </h4>
                          <p className="text-[11px] text-slate-350 leading-relaxed font-sans select-none">
                            We detected some customer/supplier profiles were deleted from the CRM directory, but their entries remain secure in the transaction ledger. Click the button below to restore them instantly.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pl-1 md:pl-12 pt-0.5">
                        <button
                          type="button"
                          onClick={runAutoRecovery}
                          className="px-4 py-2.5 bg-[#00E676] hover:bg-[#00D065] text-slate-950 font-extrabold text-[10px] uppercase tracking-wider rounded-xl cursor-pointer active:scale-95 transition-all shadow-lg shadow-emerald-500/15 flex items-center gap-1.5 font-sans"
                        >
                          <Undo2 className="w-3.5 h-3.5 text-slate-950" />
                          Restore Lost Partner Profiles
                        </button>
                      </div>
                    </div>
                  </details>
                  )}

                  {/* Responsive grid of Customer Cards */}
                  {filteredContacts.length === 0 ? (
                    <div className="bg-[#1E1E24] border border-[#2D2D35] rounded-2xl p-16 text-center text-[#A0A0A5] flex flex-col items-center justify-center space-y-3">
                      <div className="p-3 bg-white/5 rounded-full border border-[#2D2D35]/50 text-slate-500">
                        <Users className="w-8 h-8 opacity-40" />
                      </div>
                      <p className="text-xs italic">
                        No contact profiles map your active filters. Use form to sign a new partner.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="contacts-bento-grid">
                      {filteredContacts.map((c) => {
                        const status = getContactStatus(c);
                        const initials = getInitials(c.name);
                        
                        // Resolve client transactions with extremely robust fallback and normalization checks
                        const clientTxs = customerDirectoryData.transactionsByContact.get(c.id) || [];
                        const totalOutstandingDue = clientTxs.reduce((sum, tx) => sum + Math.max(0, Number(tx.dueBalance) || 0), 0);
                        
                        // Aggregate products bought by customer
                        const purchasedProductsMap: { [productName: string]: { quantity: number; total: number; price: number } } = {};
                        clientTxs.forEach(t => {
                          if (t.items && Array.isArray(t.items)) {
                            t.items.forEach(item => {
                              const dbProduct = products.find(p => p.id === item.productId || p.id === item.id || p.name === item.name);
                              const pName = dbProduct?.name || item.name || "Product Item";
                              if (!purchasedProductsMap[pName]) {
                                purchasedProductsMap[pName] = { quantity: 0, total: 0, price: item.price || 0 };
                              }
                              purchasedProductsMap[pName].quantity += (item.quantity || 0);
                              purchasedProductsMap[pName].total += (item.total || 0);
                              if (item.price && item.price > 0) {
                                purchasedProductsMap[pName].price = item.price;
                              }
                            });
                          }
                        });
                        const purchasedProductsList = Object.entries(purchasedProductsMap).map(([name, data]) => ({
                          name,
                          quantity: data.quantity,
                          total: data.total,
                          price: data.price
                        }));

                        // Find the latest transaction date for this customer
                        const latestTx = clientTxs.reduce((latest: any, current: any) => {
                          const latestDate = new Date(latest.date || latest.created_at || 0);
                          const currentDate = new Date(current.date || current.created_at || 0);
                          return currentDate > latestDate ? current : latest;
                        }, clientTxs[0] || null);

                        const formattedLatestDate = latestTx 
                          ? new Date(latestTx.date || latestTx.created_at).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })
                          : null;

                        return (
                          <div 
                            key={c.id} 
                            className="bg-[#1E1E24] border border-[#2D2D35] p-3.5 sm:p-5 rounded-2xl shadow-md transition-all hover:border-[#00E676]/20 flex flex-col justify-between gap-3 sm:gap-4 group relative overflow-hidden"
                            id={`contact-profile-card-${c.id}`}
                          >
                            {/* Unregistered or Empty Purchases Indicator Badge */}
                            {c.type === "customer" && clientTxs.length === 0 && (
                              <div 
                                className="absolute top-3 right-3 flex items-center justify-center bg-rose-500/15 border border-rose-500/30 text-rose-500 rounded-full p-1.5 animate-pulse z-10" 
                                title="No active purchases mapped to this customer profile"
                                id={`no-purchase-alert-${c.id}`}
                              >
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              </div>
                            )}

                            {/* Card Header Profile block */}
                            <div className="flex gap-4">
                              {/* Initials circular placeholder layout with subtle glow */}
                              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#121214] to-[#2D2D35] border border-[#2D2D35] flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-inner group-hover:border-[#00E676]/30 group-hover:from-emerald-500/10 transition-colors">
                                {initials}
                              </div>
                              <div className="space-y-1 min-w-0 pr-6">
                                <div className="text-xs font-bold text-white truncate font-sans tracking-wide group-hover:text-[#00E676] transition-colors">{c.name}</div>
                                <div className="text-[10px] font-mono text-[#A0A0A5] flex items-center gap-1.5">
                                  <Phone className="w-2.5 h-2.5 text-[#00E676]/70" />
                                  {c.phone}
                                </div>
                                <div className="text-[10px] text-slate-400 font-sans truncate" title={c.address || "Address details unspecified"}>
                                  {c.address || "Address unspecified"}
                                </div>
                                {formattedLatestDate && (
                                  <div className="text-[9px] text-[#00E676] font-mono flex items-center gap-1 mt-1 bg-[#121214]/60 p-1 px-1.5 rounded border border-[#00E676]/10 w-fit" title="Last transaction date/time">
                                    <Clock className="w-2.5 h-2.5 shrink-0" />
                                    <span>Last Bought: {formattedLatestDate}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Purchased Products Details Section */}
                            {c.type === "customer" && (
                              <div className="bg-[#121214]/60 border border-[#2D2D35]/30 rounded-xl p-3 space-y-1.5" id={`purchased-products-box-${c.id}`}>
                                <div className="text-[10px] font-bold text-[#A0A0A5] font-mono tracking-wider flex items-center justify-between gap-2 border-b border-[#2D2D35]/50 pb-1 uppercase">
                                  <span className="flex min-w-0 items-center gap-1.5"><Package className="w-3.5 h-3.5 text-[#00E676]" />Purchased Items:</span>
                                  {totalOutstandingDue > 0 && purchasedProductsList.length !== 1 && (
                                    <span className="shrink-0 rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-black normal-case tracking-normal text-rose-400">Due: {businessInfo.currencySymbol || "৳"}{totalOutstandingDue.toLocaleString()}</span>
                                  )}
                                </div>
                                {purchasedProductsList.length > 0 ? (
                                  <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar scrollbar-thin">
                                    {purchasedProductsList.map((prod, idx) => (
                                      <div key={idx} className="flex flex-col text-[10px] py-1.5 border-b border-[#2D2D35]/15 last:border-0 font-mono">
                                        <div className="flex justify-between items-start gap-2">
                                          <span className="text-slate-200 font-semibold text-wrap text-left" title={prod.name}>
                                            • {prod.name} <span className="text-slate-400 font-normal text-[9px]">(@ {businessInfo.currencySymbol || "৳"}{prod.price.toLocaleString()}/unit)</span>
                                          </span>
                                          <div className="flex shrink-0 items-center gap-1">
                                            <span className="text-[#00E676] font-bold bg-[#1e1e24] px-1.5 py-0.5 rounded border border-[#2D2D35] text-[9px]">{prod.quantity} {prod.quantity === 1 ? "Unit" : "Units"}</span>
                                            {totalOutstandingDue > 0 && purchasedProductsList.length === 1 && <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-black text-rose-400">Due: {businessInfo.currencySymbol || "৳"}{totalOutstandingDue.toLocaleString()}</span>}
                                          </div>
                                        </div>
                                        {prod.quantity > 1 && (
                                          <div className="text-[9px] text-slate-500 pl-2.5 mt-0.5">
                                            Total for {prod.name}: <span className="text-[#00E676] font-semibold">{businessInfo.currencySymbol || "৳"}{prod.total.toLocaleString()}</span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[10px] italic text-rose-500 flex items-center gap-1.5 font-mono py-0.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                    No purchases logged yet.
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Three equal, responsive action cells: customer tools, invoice assignment, direct sale. */}
                            <div className="mt-3 grid w-full min-w-0 grid-cols-[1.7fr_0.65fr_0.65fr] items-stretch gap-1.5 border-t border-[#2D2D35]/50 pt-3">
                              <div className="flex h-11 min-w-0 items-center justify-around gap-0.5 rounded-lg border border-[#2D2D35] bg-[#121214] px-1.5">
                                {c.type === "customer" && <>
                                  <button type="button" onClick={() => handleCopyContactDetails(c)} className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300" title="Copy Customer Details" aria-label={`Copy details for ${c.name}`}><Copy className="h-3.5 w-3.5" /></button>
                                  <button type="button" onClick={() => triggerNotification(`Showroom line connecting: ${c.name} (${c.phone})...`, "info")} className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300" title="Call Client" aria-label="Call Client"><Phone className="h-3.5 w-3.5" /></button>
                                  <button type="button" onClick={() => { setActiveTab("ledger"); triggerNotification(`Ledger catalog loaded for filtering: ${c.name}`, "info"); }} className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-sky-500/10 hover:text-sky-300" title="Ledger History" aria-label="Ledger History"><History className="h-3.5 w-3.5" /></button>
                                  <button type="button" onClick={() => { setEditingContact(c); triggerNotification(`Editing profile for: ${c.name}`, "info"); }} className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300" title="Edit Profile" aria-label="Edit Profile"><Edit3 className="h-3.5 w-3.5" /></button>
                                  {deleteContactId === c.id ? <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5"><button onClick={async () => { if (currentPanel !== "admin") { triggerNotification("Security block: Only administrators are authorized to delete contact profiles! 🛑", "error"); setDeleteContactId(null); return; } await deleteCloudDocument("customers", c.firestoreId ?? c.id); if (activeUser && !activeUser.isGuest) deleteCustomer(c.id).catch(err => {}); setContacts(contacts.filter(item => item.id !== c.id)); triggerNotification(`Partner profile '${c.name}' has been successfully deleted.`, "success"); setDeleteContactId(null); }} className="rounded bg-rose-600 px-1 py-1 text-[8px] font-extrabold text-white">Yes</button><button onClick={() => setDeleteContactId(null)} className="rounded px-1 py-1 text-[8px] text-slate-300">No</button></div> : <button onClick={() => setDeleteContactId(c.id)} className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-rose-500/10 hover:text-rose-300" title="Unregister Profile" aria-label="Delete Customer"><Trash2 className="h-3.5 w-3.5" /></button>}
                                </>}
                                {c.type !== "customer" && !(totalOutstandingDue > 0) && status && <span className={`truncate px-1 text-[9px] font-bold uppercase ${status.color}`}>{status.label}</span>}
                              </div>
                              {c.type === "customer" ? <button type="button" onClick={() => void openCustomerInvoiceAssign(c, clientTxs)} className="flex h-11 min-w-0 items-center justify-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/10 px-1 text-center text-[9px] font-black uppercase leading-tight text-sky-200 transition-colors hover:border-sky-300/60 hover:bg-sky-500/20" title="Assign a sales invoice directly to delivery staff"><Truck className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0">Invoice Assign</span></button> : <div className="flex h-11 min-w-0 items-center justify-center">{!(totalOutstandingDue > 0) && status && <span className={`truncate text-[9px] uppercase ${status.color}`}>{status.label}</span>}</div>}
                              {c.type === "customer" ? <button type="button" onClick={() => { resetPosWorkspace(c.id); setActiveTab("pos"); triggerNotification(`POS Cash Memo loaded. Customer context: ${c.name}`, "success"); }} className="flex h-11 min-w-0 items-center justify-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-1 text-center text-[9px] font-black uppercase leading-tight text-emerald-300 transition-colors hover:bg-emerald-500/20" title="Direct Sale POS Checkout"><ShoppingCart className="h-3.5 w-3.5 shrink-0" /><span>Direct Sale</span></button> : <div />}
                            </div>

                            {quickAssignContact?.id === c.id && (() => {
                              const selectedInvoice = quickAssignInvoices.find(tx => String(tx.invoiceNo) === String(quickAssignInvoiceNo));
                              const selectedDriver = quickAssignStaff.find(person => person.uid === quickAssignDriverUid);
                              return createPortal(<div className="fixed inset-0 z-[9999] h-[100dvh] w-screen overflow-y-auto overscroll-contain bg-slate-950 text-white" role="dialog" aria-modal="true" aria-label="Invoice assignment full page">
                                <div className="min-h-full w-full bg-gradient-to-br from-slate-950 via-[#101827] to-slate-950">
                                  <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-4 shadow-xl backdrop-blur-xl sm:px-8">
                                    <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-300/25 bg-sky-400/10 text-sky-200"><Truck className="h-5 w-5" /></div><div className="min-w-0"><h3 className="text-base font-black tracking-wide text-white sm:text-lg">Invoice Assignment</h3><p className="mt-1 truncate text-xs text-slate-400">Customer: {quickAssignContact.name}</p></div></div>
                                      <button type="button" onClick={() => setQuickAssignContact(null)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close invoice assignment"><X className="h-4 w-4" /></button>
                                    </div>
                                  </div>
                                  <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
                                    {quickAssignLoading ? <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm text-slate-300">Loading active delivery staff…</div> : <>
                                      <div className="space-y-2 rounded-2xl border border-sky-300/25 bg-sky-400/[0.07] p-4 sm:p-5"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-200">Selected Customer Invoice</p><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xl font-black text-white">Invoice #{quickAssignInvoiceNo}</p><p className="mt-1 text-xs text-slate-400">Customer: {quickAssignContact.name}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-wider text-slate-500">Invoice Total</p><p className="text-lg font-black text-emerald-300">{businessInfo.currencySymbol || "৳"}{Number(selectedInvoice?.total || 0).toLocaleString("en-BD")}</p></div></div></div>
                                      {selectedInvoice && <div className="space-y-3 rounded-2xl border border-sky-300/20 bg-sky-400/[0.06] p-4">
                                        <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-200">Invoice Summary</span><span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-[10px] font-bold text-sky-100">#{selectedInvoice.invoiceNo}</span></div>
                                        <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-slate-500">Customer</p><p className="truncate text-sm font-bold text-white">{quickAssignContact.name}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-wider text-slate-500">Invoice Total</p><p className="text-sm font-black text-emerald-300">{businessInfo.currencySymbol || "৳"}{Number(selectedInvoice.total || 0).toLocaleString("en-BD")}</p></div></div>
                                        <div className="border-t border-white/10 pt-2"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Purchased Products</p><div className="max-h-32 space-y-1.5 overflow-y-auto pr-1">{(Array.isArray(selectedInvoice.items) ? selectedInvoice.items : []).map((item: any, index: number) => <div key={item.id || index} className="flex items-start justify-between gap-3 text-xs"><span className="min-w-0 text-slate-200">{item.name || item.productName || "Product"}</span><span className="shrink-0 font-bold text-sky-200">× {Number(item.quantity) || 0}</span></div>)}{(!selectedInvoice.items || selectedInvoice.items.length === 0) && <p className="text-xs text-slate-500">No product details available for this invoice.</p>}</div></div>
                                      </div>}
                                      <label className="block space-y-2 text-xs font-bold text-slate-300">Assign Delivery Staff
                                        <select value={quickAssignDriverUid} onChange={e => setQuickAssignDriverUid(e.target.value)} className="w-full rounded-xl border border-slate-600/80 bg-slate-950/80 px-3.5 py-3 text-sm font-semibold text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"><option value="">Select active delivery staff</option>{quickAssignStaff.map(person => <option key={person.uid} value={person.uid}>{person.name} · {person.phone || person.email}</option>)}</select>
                                      </label>
                                      <div className="space-y-3 rounded-2xl border border-violet-300/20 bg-violet-400/[0.05] p-4 sm:p-5"><div><p className="text-sm font-black text-white">Who will bear the delivery charge?</p><p className="mt-1 text-xs text-slate-400">This choice controls whether delivery cost is included in showroom Net Profit expenses.</p></div><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setQuickAssignChargeBearer("showroom")} className={`rounded-xl border p-4 text-left transition ${quickAssignChargeBearer === "showroom" ? "border-amber-300 bg-amber-400/15 ring-2 ring-amber-300/20" : "border-white/10 bg-slate-950/50 hover:border-amber-300/50"}`}><span className="block text-sm font-black text-white">Showroom bears the cost</span><span className="mt-1 block text-xs text-slate-400">Count as showroom expense; Net Profit will decrease.</span></button><button type="button" onClick={() => setQuickAssignChargeBearer("customer")} className={`rounded-xl border p-4 text-left transition ${quickAssignChargeBearer === "customer" ? "border-emerald-300 bg-emerald-400/15 ring-2 ring-emerald-300/20" : "border-white/10 bg-slate-950/50 hover:border-emerald-300/50"}`}><span className="block text-sm font-black text-white">Customer bears the cost</span><span className="mt-1 block text-xs text-slate-400">Do not count as showroom expense; Net Profit stays unchanged.</span></button></div></div>
                                      {selectedDriver && <div className="flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.06] px-3 py-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300"><Truck className="h-4 w-4" /></div><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Assigned Delivery Person</p><p className="truncate text-xs font-bold text-white">{selectedDriver.name}</p></div></div>}
                                      {quickAssignStaff.length === 0 && <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-[11px] text-amber-200">No active delivery staff available. Please activate a staff member first.</p>}
                                      <div className="flex flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setQuickAssignContact(null)} className="rounded-xl border border-white/15 px-5 py-3 text-xs font-bold text-slate-300 transition-colors hover:bg-white/5">Cancel</button><button type="button" disabled={!quickAssignInvoiceNo || !quickAssignDriverUid || !quickAssignChargeBearer || quickAssignSaving || quickAssignLoading} onClick={() => void submitCustomerInvoiceAssign()} className="rounded-xl border border-sky-300/30 bg-gradient-to-r from-sky-500 to-blue-500 px-5 py-3 text-xs font-black tracking-wide text-white shadow-lg shadow-sky-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{quickAssignSaving ? "Assigning…" : "Assign Invoice"}</button></div>
                                    </>}
                                  </div>
                                </div>
                              </div>, document.body);
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>

              </div>
            );
          })()}

          {/* -----------------------------------------------------------------
              VIEW: STAFF & STORE PAYROLL MANAGEMENT
              ----------------------------------------------------------------- */}
          {activeTab === "delivery" && (
            <DeliveryManagementView
              key={`${String(activeUser?.uid || "")}:${currentPanel}:${String(activeUser?.email || "").trim().toLowerCase()}`}
              adminPin={currentPanel === "admin" ? adminActionPin : ""}
              salesPin={String(businessInfo.salesPasscode || "")}
              panelRole={currentPanel === "admin" ? "admin" : "sales"}
              storeId={String(activeUser?.email || "").trim().toLowerCase()}
              transactions={transactions}
              contacts={contacts}
              currencySymbol={businessInfo.currencySymbol || "৳"}
              triggerNotification={triggerNotification}
            />
          )}

          {activeTab === "staff" && (
            <div className="animate-fadeIn max-w-7xl mx-auto space-y-6" id="view-staff-container">
              <StaffManagementView
                staffList={staffList}
                onAddStaff={(newStaff) => {
                  const item: Staff = {
                    ...newStaff,
                    id: "staff_" + Date.now(),
                    salaryPayments: []
                  };
                  setStaffList((prev) => [...prev, item]);
                  triggerNotification("Enlisted new staff member successfully", "success");
                }}
                onUpdateStaff={(updated) => {
                  setStaffList((prev) => prev.map((item) => item.id === updated.id ? updated : item));
                }}
                onDeleteStaff={(id, name) => {
                  setStaffList((prev) => prev.filter((item) => item.id !== id));
                }}
                currencySymbol={businessInfo.currencySymbol || "৳"}
                businessInfo={businessInfo}
                triggerNotification={triggerNotification}
              />
            </div>
          )}

          {/* -----------------------------------------------------------------
              VIEW 7: GENERAL BUSINESS SETUP & BILLING RULES
              ----------------------------------------------------------------- */}
          {activeTab === "settings" && (
            <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn" id="view-settings-container">
              
              {/* Settings Overview */}
              <div className="border-b border-white/10 pb-5" id="settings-heading-intro">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white shadow-lg">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white font-display tracking-tight">Settings & Configuration</h3>
                    <p className="text-xs text-slate-400 mt-1">Manage your store profile, appearance, invoices, access controls and system safety.</p>
                  </div>
                </div>
              </div>

              {activeSettingsSection === "overview" && (
                <div className="space-y-4 animate-fadeIn" id="settings-workspace-overview">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">Settings Workspace</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Select a section to view and update its settings.</p>
                    </div>
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 border border-white/10 rounded-full px-3 py-1">7 Sections</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {[
                      { id: "shop" as const, title: "Registered Shop Information", desc: "Business name, address, contact, VAT and currency", Icon: Building2, meta: "Business profile" },
                      { id: "font" as const, title: "Font Customization & Settings", desc: "System font, display scale and typography preview", Icon: Type, meta: "Appearance" },
                      { id: "invoice" as const, title: "Invoice & PDF Layout", desc: "Invoice templates, logo, signatures and print details", Icon: FileText, meta: "Print customization" },
                      { id: "sales" as const, title: "Sales Panel & Assistant Restrictions", desc: "Control editing, deleting and price override permissions", Icon: SlidersHorizontal, meta: "Access permissions" },
                      { id: "security" as const, title: "Security & Panel Passcodes", desc: "Manage Admin and Sales panel access PINs", Icon: ShieldCheck, meta: "Account security" },
                      { id: "cloud" as const, title: "Data & Cloud Management", desc: "Cloud connection, local device status, backup and appearance controls", Icon: CloudLightning, meta: "System status" },
                      { id: "danger" as const, title: "Danger Zone", desc: "Review high-risk reset and deletion actions", Icon: AlertTriangle, meta: "Advanced actions" }
                    ].map((item) => {
                      const Icon = item.Icon;
                      const isDanger = item.id === "danger";
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveSettingsSection(item.id)}
                          className="group w-full min-h-[142px] text-left rounded-2xl border border-white/10 bg-[#101319]/95 hover:bg-[#171b23] hover:border-white/20 p-4 sm:p-5 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white/20"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${isDanger ? "bg-rose-500/5 border-rose-500/20 text-rose-300" : "bg-white/5 border-white/10 text-slate-100"}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className="text-slate-400 group-hover:text-white transition-colors text-lg leading-none">↗</span>
                          </div>
                          <div className="mt-4">
                            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold">{item.meta}</span>
                            <h5 className="text-sm font-bold text-white mt-1 leading-snug">{item.title}</h5>
                            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">{item.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#101319]/70 px-4 py-3 flex items-start gap-3">
                    <ShieldCheck className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
                    <p className="text-[10px] leading-relaxed text-slate-400">Each section has its own save action. Changes are saved through the existing settings and database workflow; unrelated POS modules are not part of this workspace.</p>
                  </div>
                </div>
              )}

              {activeSettingsSection !== "overview" && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#101319]/90 p-3 sm:p-4 animate-fadeIn" id="settings-workspace-toolbar">
                  <div className="flex items-center gap-3 min-w-0">
                    <button type="button" onClick={() => setActiveSettingsSection("overview")} className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-bold text-white transition-colors">
                      <Undo2 className="w-4 h-4" /> Back
                    </button>
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-widest text-slate-400">Settings Workspace</p>
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {({ shop: "Registered Shop Information", font: "Font Customization & Settings", invoice: "Invoice & PDF Layout Customization", sales: "Sales Panel & Assistant Restrictions", security: "Security & Panel Passcodes", danger: "Danger Zone", cloud: "Data & Cloud Management" } as Record<string, string>)[activeSettingsSection]}
                      </p>
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 border border-white/10 rounded-full px-3 py-1">Changes are saved per section</span>
                </div>
              )}
              {activeSettingsSection === "cloud" && (
                <div className="space-y-4 animate-fadeIn" id="settings-cloud-management">
                  <div className="rounded-2xl border border-white/10 bg-[#101319]/95 p-4 sm:p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-400/10 border border-sky-400/30 flex items-center justify-center shadow-[0_0_18px_rgba(56,189,248,0.16)]"><CloudLightning className="w-5 h-5 text-sky-300 drop-shadow-[0_0_5px_rgba(56,189,248,0.75)]" /></div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Live Cloud Connection</h4>
                        <p className="text-[10px] text-slate-400">Status is based on the existing Firestore listeners; this panel does not run extra database checks.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[9px] uppercase tracking-widest text-slate-400">Firestore</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span aria-label={syncStatus === "connected" ? "Live Firestore connection active" : "Firestore connection status"} className={`w-2.5 h-2.5 rounded-full ${syncStatus === "connected" ? "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.78)] animate-pulse" : syncStatus === "error" ? "bg-rose-400 shadow-[0_0_6px_2px_rgba(251,113,133,0.45)]" : syncStatus === "connecting" || syncStatus === "reconciling" ? "bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.4)] animate-pulse" : "bg-slate-400"}`} />
                          <span className="text-xs font-bold text-white">{syncStatus === "connected" ? "Connected — latest listener snapshot received" : syncStatus === "connecting" ? "Connecting…" : syncStatus === "reconciling" ? "Updating local data…" : syncStatus === "error" ? "Connection error" : "Offline / not connected"}</span>
                        </div>
                        {syncErrorMessage && <p className="mt-2 text-[10px] leading-relaxed text-rose-300">{syncErrorMessage}</p>}
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[9px] uppercase tracking-widest text-slate-400">Offline Core / Local Storage</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${localCoreAvailable ? "bg-emerald-400" : "bg-rose-400"}`} />
                          <span className="text-xs font-bold text-white">{localCoreAvailable ? "Available on this device" : "Unavailable — local storage access failed"}</span>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-400">Local data remains separate from Firestore and may still be available when the cloud quota is exhausted.</p>
                      </div>
                    </div>
                    {isFirestoreQuotaLimited && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200">
                        Firestore daily quota is currently exhausted. To avoid more failed requests, do not force cloud restore or repeated sync attempts until the quota resets. Continue using the locally available data carefully.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#101319]/95 p-4 sm:p-5 space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-white">Cloud Backup & Restore</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Manual controls are kept here instead of the Dashboard and top bar.</p>
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="text-xs font-bold text-amber-200">Cloud backup upload is not available</p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">The current backup-upload function is disabled in this app version. The old button could show a false success message, so it has been removed until a real backup implementation is ready.</p>
                    </div>
                    <button
                      type="button"
                      id="settings-restore-cloud-btn"
                      onClick={triggerCloudBackupRestore}
                      disabled={!activeUser || activeUser.isGuest || isRestoring || isFirestoreQuotaLimited || syncStatus === "error"}
                      className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-xs font-bold text-sky-300 hover:bg-sky-500/15 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isRestoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                      {isRestoring ? "Restoring…" : "Restore Cloud Backup"}
                    </button>
                    <p className="text-[10px] text-slate-500">Restore may replace this device’s local data. It is disabled while Firestore’s daily quota error is active.</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#101319]/95 p-4 sm:p-5">
                    <h4 className="text-sm font-bold text-white">Appearance</h4>
                    <p className="text-[10px] text-slate-400 mt-1">Change the app theme from this settings panel.</p>
                    <button type="button" id="settings-theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-white hover:bg-white/10">
                      {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-emerald-400" />}
                      {isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    </button>
                  </div>
                </div>
              )}

              {activeSettingsSection === "shop" && (
                <>
              {/* 1. Shop Information Card Block */}
              <div className="bg-[#101319]/95 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl" id="settings-shop-info-block">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="p-2 bg-white/5 rounded-lg text-slate-100">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Registered Shop Information</h4>
                    <p className="text-[10px] text-slate-400">Configure standard receipt metadata and store contact details.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5" id="settings-shop-name">
                    <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Registered Shop / Business Name</label>
                    <input
                      type="text"
                      value={tempShopName}
                      onChange={(e) => setTempShopName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 font-sans font-bold transition-all placeholder:text-slate-400 focus:ring-1 focus:ring-white/10"
                    />
                  </div>

                  <div className="space-y-1.5" id="settings-shop-address">
                    <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Showroom Print Address Headline</label>
                    <input
                      type="text"
                      value={tempShopAddress}
                      onChange={(e) => setTempShopAddress(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 font-sans transition-all placeholder:text-slate-400 focus:ring-1 focus:ring-white/10"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Shop Mobile / Support Hotline</label>
                      <input
                        type="text"
                        value={tempShopPhone}
                        onChange={(e) => setTempShopPhone(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 font-mono transition-all placeholder:text-slate-400 focus:ring-1 focus:ring-white/10"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Business Support Email Account</label>
                      <input
                        type="email"
                        value={tempShopEmail}
                        onChange={(e) => setTempShopEmail(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 font-mono transition-all placeholder:text-slate-400 focus:ring-1 focus:ring-white/10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">VAT Registration Identification</label>
                      <input
                        type="text"
                        value={tempVatRegNo}
                        onChange={(e) => setTempVatRegNo(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 font-mono transition-all placeholder:text-slate-400 focus:ring-1 focus:ring-white/10"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 block">Primary Currency Symbol</label>
                      <select
                        value={tempCurrency}
                        onChange={(e) => setTempCurrency(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 font-mono transition-all focus:ring-1 focus:ring-white/10"
                      >
                        <option value="৳">৳ (BDT Taka - TK)</option>
                        <option value="$">$ (USD Dollar)</option>
                        <option value="₹">₹ (INR Rupee)</option>
                        <option value="SR">SR (Saudi Riyal)</option>
                        <option value="AED">AED (Dirham)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-850 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveShopInfo}
                    className="min-h-11 px-5 py-2.5 bg-[#F4F4F5] text-[#111318] border border-white/80 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-[0_4px_18px_rgba(255,255,255,0.16)] hover:bg-white hover:shadow-[0_6px_22px_rgba(255,255,255,0.24)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101319] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" />
                    Save Shop Details
                  </button>
                </div>
              </div>

                </>
              )}

              {activeSettingsSection === "font" && (
                <>
              {/* 1.1 Premium Corporate Font Settings Card Block */}
              <div className="bg-[#101319]/95 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl animate-fadeIn" id="settings-font-settings-block">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="p-2 bg-white/5 rounded-lg text-slate-100">
                    <Type className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Font Customization & Settings</h4>
                    <p className="text-[10px] text-slate-400">Select standard corporate typography. Instantly changes the entire system look & invoice layout.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-4">
                    <div className="space-y-1.5" id="settings-font-select-field">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 block">Corporate Professional Font</label>
                      <select
                        value={tempFont}
                        onChange={(e) => setTempFont(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 font-sans transition-all focus:ring-1 focus:ring-white/10 font-bold"
                      >
                        <option value="Inter">Inter (Default Modern & Clean)</option>
                        <option value="Roboto">Roboto (Standard Professional)</option>
                        <option value="Poppins">Poppins (Premium Geometry)</option>
                        <option value="Open Sans">Open Sans (Classic Business)</option>
                        <option value="Modern Sans">Modern Sans (Plus Jakarta Sans)</option>
                        <option value="Lato">Lato (Warm & Professional)</option>
                        <option value="Montserrat">Montserrat (Geometric Tech)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5" id="settings-scale-select-field">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 block">Global UI & Print Font Scale</label>
                      <div className="grid grid-cols-3 gap-2 bg-[#171A20] p-1.5 border border-slate-600 rounded-xl">
                        {(["Regular", "Medium", "Large"] as const).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setTempFontSizeScale(sz)}
                            aria-pressed={tempFontSizeScale === sz}
                            className={`py-2 text-[10px] font-bold rounded-lg border transition-all duration-200 cursor-pointer ${
                              tempFontSizeScale === sz
                                ? "bg-[#F4F4F5] text-[#111318] border-white/80 shadow-[0_4px_18px_rgba(255,255,255,0.16)]"
                                : "bg-[#252A33] border-slate-600 text-slate-200 hover:text-white hover:bg-[#343B46] hover:border-slate-400"
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] text-slate-400 italic pl-1 leading-normal block">
                        Adjusts system-wide display text density and PDF invoice sizes dynamically.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#121214] border border-slate-800 rounded-xl space-y-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Selected Font Preview:</span>
                    <div style={{ fontFamily: `'${tempFont}', sans-serif` }} className="text-white space-y-1.5">
                      <p className="text-base font-black leading-tight font-sans">Barakah E-Mart</p>
                      <p className="text-xs text-slate-400">Invoicing, Ledger, CRM & POS Terminal.</p>
                      <div className="flex gap-2 items-center pt-2 border-t border-slate-800/60 font-mono text-[10px] text-slate-400">
                        <span>Font: {tempFont}</span>
                        <span>•</span>
                        <span>Scale: {tempFontSizeScale}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-850 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveFontSettings}
                    className="min-h-11 px-5 py-2.5 bg-[#F4F4F5] text-[#111318] border border-white/80 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-[0_4px_18px_rgba(255,255,255,0.16)] hover:bg-white hover:shadow-[0_6px_22px_rgba(255,255,255,0.24)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101319] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" />
                    Save Font
                  </button>
                </div>
              </div>

                </>
              )}

              {activeSettingsSection === "invoice" && (
                <>
              {/* 2. Invoice Customization Card Block */}
              <div className="bg-[#101319]/95 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl" id="settings-invoice-customization-block">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="p-2 bg-white/5 rounded-lg text-slate-100">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Invoice & PDF Layout Customization</h4>
                    <p className="text-[10px] text-slate-400">Manage digital logos, default terms, and signature requirements.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  
                  {/* BRAND NEW: SEPARATE FIELD FOR INVOICES - SEVEN PREMIUM TEMPLATE SELECTION CARD GRID */}
                  <div className="space-y-3 pt-2" id="settings-invoice-template-selection-container">
                    <label className="text-[10px] font-black uppercase tracking-widest font-mono text-slate-400 pl-1 block flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-200" />
                      SELECT INVOICE DESIGN & LAYOUT TEMPLATE
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" id="invoice-templates-grid">
                      
                      {/* Template 1: Classic Retail */}
                      <div 
                        onClick={() => setTempInvoiceTemplate("classic")}
                        className={`flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left select-none ${
                          tempInvoiceTemplate === "classic"
                            ? "bg-white/5 border-white/50 shadow shadow-white/5"
                            : "bg-[#121214] border-slate-800 hover:border-slate-700 hover:bg-slate-900/45"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-400">Template 01</span>
                            <span className="text-[9px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded uppercase font-mono">Retail Default</span>
                          </div>
                          <h5 className="text-xs font-black text-white">Classic Retail Standard</h5>
                          <p className="text-[10px] text-slate-400 leading-normal font-sans">
                            Double-bordered structural layout with solid deep charcoal headers. Standard format ideal for retail showrooms.
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                            tempInvoiceTemplate === "classic" ? "border-white" : "border-slate-700"
                          }`}>
                            {tempInvoiceTemplate === "classic" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-[10px] font-bold font-mono text-slate-400">
                            {tempInvoiceTemplate === "classic" ? "Activated" : "Select Style"}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Exact A4 PDF output generated by the same renderer used for printing */}
                  <div className="space-y-3 p-4 bg-[#121214] border border-slate-800 rounded-xl" id="invoice-template-live-demo-preview">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-slate-200 shrink-0" />
                        <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={() => setActiveDocumentPreview("invoice")} className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all ${activeDocumentPreview === "invoice" ? "bg-white text-black border-white" : "bg-transparent text-slate-300 border-slate-600"}`}>Invoice Preview</button>
                        <button type="button" onClick={() => setActiveDocumentPreview("challan")} className={`px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all ${activeDocumentPreview === "challan" ? "bg-white text-black border-white" : "bg-transparent text-slate-300 border-slate-600"}`}>Delivery Challan</button>
                      </div>
                      </div>
                      <span className="text-[8px] font-mono text-slate-400 uppercase shrink-0">A4 · 210 × 297 mm</span>
                    </div>
                    <div className="relative mx-auto flex w-full max-w-[460px] items-start justify-center aspect-[210/297] overflow-hidden bg-white border border-slate-300 shadow-xl">
                      {activeDocumentPreview === "invoice" ? (
                        invoicePreviewDataUrl ? (
                          <>
                            <iframe src={invoicePreviewDataUrl + "#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit"} title="A4 invoice PDF preview" className="hidden sm:block w-full h-full border-0 bg-white" />
                            <iframe src={invoicePreviewDataUrl + "#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit"} title="Mobile A4 invoice PDF preview" className="block sm:hidden absolute left-0 top-0 border-0 bg-white" style={{ width: "142.86%", height: "142.86%", transform: "scale(0.7)", transformOrigin: "top left" }} />
                          </>
                        ) : <div className="w-full h-full flex items-center justify-center text-center p-6 text-slate-600 text-xs font-bold">{invoicePreviewLoading ? "Generating invoice preview…" : "Invoice preview could not be generated."}</div>
                      ) : challanPreviewDataUrl ? (
                        <>
                          <iframe src={challanPreviewDataUrl + "#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit"} title="A4 delivery challan PDF preview" className="hidden sm:block w-full h-full border-0 bg-white" />
                          <iframe src={challanPreviewDataUrl + "#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit"} title="Mobile A4 delivery challan PDF preview" className="block sm:hidden absolute left-0 top-0 border-0 bg-white" style={{ width: "142.86%", height: "142.86%", transform: "scale(0.7)", transformOrigin: "top left" }} />
                        </>
                      ) : <div className="w-full h-full flex items-center justify-center text-center p-6 text-slate-600 text-xs font-bold">{challanPreviewLoading ? "Generating delivery challan preview…" : "Delivery challan preview could not be generated."}</div>}
                    </div>
                    <p className="text-[9px] text-slate-400 text-center">This is the real A4 PDF output—not a separately recreated sample. Unsaved logo, shop and invoice settings are reflected here.</p>
                  </div>

                  <hr className="border-slate-850 my-4" />

                  {/* File Upload / Image Picker */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 block">Showroom Branding Logo</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      
                      <div className="md:col-span-2">
                        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-850 hover:border-[#00B0FF]/40 bg-[#121214] rounded-xl cursor-pointer hover:bg-slate-900/30 transition-all text-center">
                          <CloudUpload className="w-7 h-7 text-[#00B0FF] mb-2" />
                          <span className="text-[11px] font-bold text-white">Select Brand PNG/JPG Logo</span>
                          <span className="text-[9px] text-[#A0A0A5] mt-0.5">Drag-and-drop or click to browse (Max 2MB)</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div className="flex flex-col items-center justify-center p-3 bg-slate-900/20 border border-slate-850 rounded-xl min-h-[110px] text-center">
                        {tempLogoBase64 ? (
                          <div className="relative group">
                            <img
                              src={tempLogoBase64}
                              alt="Logo Preview"
                              className="w-16 h-16 object-contain rounded bg-white p-1 border border-slate-700"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              type="button"
                              onClick={handleRemoveLogo}
                              className="absolute -top-2 -right-2 p-1 bg-rose-600 hover:bg-rose-500 tag-remove-custom rounded-full transition-all cursor-pointer shadow shadow-rose-600/30"
                              title="Delete Logo"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-center space-y-1">
                            <span className="text-2xl block">🧩</span>
                            <span className="text-[10px] text-slate-400 block">No Custom Logo</span>
                          </div>
                        )}
                        <span className="text-[8px] font-mono text-[#A0A0A5] mt-2 uppercase tracking-tight">LOGO CORE CACHE</span>
                      </div>

                    </div>
                  </div>

                  {/* Logo Visibility Switch */}
                  <div className="flex items-center justify-between p-3 bg-[#121214] border border-slate-850 rounded-xl">
                    <div className="space-y-0.5 max-w-[80%] pr-2">
                      <span className="text-xs font-bold text-white block">Render Business Logo on Receipt PDFs</span>
                      <span className="text-[10px] text-slate-400 leading-normal block font-sans">Toggle off to hide the branding logo image on generated invoice memos.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input 
                        type="checkbox"
                        checked={tempShowLogo}
                        onChange={(e) => setTempShowLogo(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-600 border border-slate-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white peer-checked:after:bg-slate-950"></div>
                    </label>
                  </div>

                  {/* Invoice Terms conditions */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Dynamic Terms & Conditions (One per line)</label>
                    <textarea
                      rows={4}
                      value={tempTerms}
                      onChange={(e) => setTempTerms(e.target.value)}
                      placeholder="Enter legal specifications, warranty policies, or return rules..."
                      className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 font-sans leading-relaxed transition-all placeholder:text-slate-400 focus:ring-1 focus:ring-white/10"
                    />
                  </div>

                  {/* Signature Toggles */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <div className="flex items-center justify-between p-3 bg-[#121214] border border-slate-850 rounded-xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">Customer Signature Space</span>
                        <span className="text-[9px] text-[#A0A0A5] block">Render left client signing line.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input 
                          type="checkbox"
                          checked={tempShowCustSig}
                          onChange={(e) => setTempShowCustSig(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white peer-checked:after:bg-slate-950"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-[#121214] border border-slate-850 rounded-xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">Authorized Representative Sign</span>
                        <span className="text-[9px] text-[#A0A0A5] block">Render right official signing line.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input 
                          type="checkbox"
                          checked={tempShowAuthSig}
                          onChange={(e) => setTempShowAuthSig(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white peer-checked:after:bg-slate-950"></div>
                      </label>
                    </div>

                  </div>

                  {/* Dedicated email shown only on customer invoices; never falls back to account email. */}
                  <div className="space-y-1.5 pt-4 border-t border-slate-800/60" id="settings-invoice-display-email">
                    <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 block">Invoice Display Email</label>
                    <input
                      type="email"
                      value={tempInvoiceDisplayEmail}
                      onChange={(e) => setTempInvoiceDisplayEmail(e.target.value)}
                      placeholder="Enter the email to show on customer invoices"
                      className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 font-mono transition-all placeholder:text-slate-500"
                    />
                    <p className="text-[9px] text-slate-400 italic pl-1 leading-normal">Only this email will appear on customer invoices. Your login/account email and Business Support Email will not be used here. Leave blank to hide the email from invoices.</p>
                  </div>

                  {/* Logo Alignment and Invoice Counter settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800/60">
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 block">Logo Alignment on PDF Invoice</label>
                      <div className="grid grid-cols-3 gap-2 bg-[#171A20] p-1.5 border border-slate-600 rounded-xl">
                        {(["left", "center", "right"] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => setTempLogoAlignment(align)}
                            aria-pressed={tempLogoAlignment === align}
                            className={`py-2 text-[10px] font-bold rounded-lg border transition-all duration-200 cursor-pointer uppercase font-mono ${
                              tempLogoAlignment === align
                                ? "bg-[#F4F4F5] text-[#111318] border-white/80 shadow-[0_4px_18px_rgba(255,255,255,0.16)]"
                                : "bg-[#252A33] border-slate-600 text-slate-200 hover:text-white hover:bg-[#343B46] hover:border-slate-400"
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] text-slate-400 italic pl-1 leading-normal block font-sans">
                        Determines the company logo positioning relative to page margins.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 block">Starting Invoice Number</label>
                      <input
                        type="number"
                        min={1}
                        value={tempStartingInvoiceNumber}
                        onChange={(e) => setTempStartingInvoiceNumber(parseInt(e.target.value) || 1001)}
                        className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 font-mono transition-all placeholder:text-slate-400 focus:ring-1 focus:ring-white/10"
                        placeholder="e.g. 1001 or 50001"
                      />
                      <p className="text-[9px] text-slate-400 italic pl-1 leading-normal block font-sans">
                        Initial serial key offset. Successive invoices increment chronologically from here.
                      </p>
                    </div>

                  </div>

                  {/* Partner Brands & Logos Option Section */}
                  <div className="pt-5 mt-4 border-t border-slate-800/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">Display Authorized Partner & Brand Logos</span>
                        <span className="text-[10px] text-[#A0A0A5] block font-sans">Render partner/brand badges horizontally at the very bottom of the invoice.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input 
                          type="checkbox"
                          checked={tempShowPartners}
                          onChange={(e) => setTempShowPartners(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white peer-checked:after:bg-slate-950"></div>
                      </label>
                    </div>

                    {tempShowPartners && (
                      <div className="p-4 bg-[#121214] border border-slate-850 rounded-xl space-y-4">
                        
                        {/* Preset Brand selection */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 block">Toggle Built-in Brands Showcase</label>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {["Samsung", "Sony", "Xiaomi", "Walton", "HP", "LG", "Haier", "Gree", "Hisense", "TCL", "Asus", "Intel"].map((brand) => {
                              const isSelected = tempPresetBrands.includes(brand);
                              return (
                                <button
                                  type="button"
                                  key={brand}
                                  onClick={() => {
                                    if (isSelected) {
                                      setTempPresetBrands(tempPresetBrands.filter(b => b !== brand));
                                    } else {
                                      setTempPresetBrands([...tempPresetBrands, brand]);
                                    }
                                  }}
                                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg cursor-pointer transition-all border ${
                                    isSelected 
                                      ? "bg-emerald-500/10 border-slate-400/80 text-slate-200 font-sans" 
                                      : "bg-[#1E1E24] border-slate-800 text-slate-400 hover:text-white"
                                  }`}
                                >
                                  {brand} {isSelected ? "✓" : "+"}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Add Custom Text-Based Brand */}
                        <div className="space-y-2 pt-3 border-t border-slate-800/40">
                          <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 block">Add Custom Brand Name Badge</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newCustomBrandName}
                              onChange={(e) => setNewCustomBrandName(e.target.value)}
                              placeholder="e.g. APPLE or DELL"
                              className="w-full px-3 py-2 bg-[#1E1E24] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const trimmed = newCustomBrandName.trim();
                                if (trimmed) {
                                  if (!tempPresetBrands.includes(trimmed)) {
                                    setTempPresetBrands([...tempPresetBrands, trimmed]);
                                  }
                                  setNewCustomBrandName("");
                                }
                              }}
                              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all select-none cursor-pointer"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {/* Custom Image-Based Partner Logo Upload */}
                        <div className="space-y-2 pt-3 border-t border-slate-800/40">
                          <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 block">Upload Brand Partner Logo Images</label>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <label className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 select-none shrink-0 self-start">
                              <span>Choose Brand Image...</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      const base64 = event.target?.result as string;
                                      if (base64) {
                                        setTempPartnerLogos([...tempPartnerLogos, base64]);
                                        triggerNotification("Brand logo image added successfully. Remember to Save Customizations!", "success");
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }} 
                                className="hidden" 
                              />
                            </label>
                            <span className="text-[9px] text-slate-400 italic leading-normal">
                              Supports PNG, JPG, or JPEG formats. Transparent landscape icons display beautifully on receipts.
                            </span>
                          </div>

                          {/* Display uploaded custom logos list with trash triggers */}
                          {tempPartnerLogos.length > 0 && (
                            <div className="space-y-2 pt-2">
                              <span className="text-[9px] text-[#A0A0A5] font-semibold uppercase tracking-wider block">Currently Loaded Partner Logos:</span>
                              <div className="flex flex-wrap gap-3">
                                {tempPartnerLogos.map((logoPic, idx) => (
                                  <div key={idx} className="relative p-2 bg-[#1E1E24] border border-slate-800 rounded-xl flex items-center justify-center w-24 h-12">
                                    <img src={logoPic} alt={`Partner custom brand logo ${idx + 1}`} className="max-h-8 max-w-full object-contain" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTempPartnerLogos(tempPartnerLogos.filter((_, i) => i !== idx));
                                      }}
                                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 rounded-full flex items-center justify-center text-[10px] text-white hover:bg-rose-500 font-bold shadow cursor-pointer select-none"
                                      title="Delete Logo"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>

                </div>

                <div className="pt-3 border-t border-slate-850 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveInvoiceConfig}
                    className="min-h-11 px-5 py-2.5 bg-[#F4F4F5] text-[#111318] border border-white/80 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-[0_4px_18px_rgba(255,255,255,0.16)] hover:bg-white hover:shadow-[0_6px_22px_rgba(255,255,255,0.24)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101319] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" />
                    Save Customizations
                  </button>
                </div>
              </div>

                </>
              )}

              {activeSettingsSection === "sales" && (
                <>
              {/* 3. Sales Panel Restrictions Block */}
              <div className="bg-[#101319]/95 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl" id="settings-sales-restrictions-block">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="p-2 bg-white/5 rounded-lg text-slate-100">
                    <SlidersHorizontal className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Sales Panel & Assistant Restrictions</h4>
                    <p className="text-[10px] text-slate-400">Define write-access safety toggles for ordinary salesmen terminals.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  
                  <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-200 ${tempCanEditSales ? "bg-sky-500/[0.09] border-sky-400/40 shadow-[inset_3px_0_0_rgba(56,189,248,0.9)]" : "bg-amber-500/[0.07] border-amber-400/35 shadow-[inset_3px_0_0_rgba(251,191,36,0.85)]"}`}>
                    <div className="space-y-1 max-w-[80%] pr-2">
                      <span className="text-xs font-bold text-white block">Allow salesman to edit historical Sales</span>
                      <span className="text-[10px] text-slate-300/80 leading-normal block">When OFF, edits on existing memos are locked to admin authority view.</span>
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-[9px] font-black tracking-widest ${tempCanEditSales ? "bg-sky-400/15 text-sky-300" : "bg-amber-400/15 text-amber-300"}`}>{tempCanEditSales ? "ON · ACCESS ALLOWED" : "OFF · ADMIN ONLY"}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input type="checkbox" checked={tempCanEditSales} onChange={(e) => setTempCanEditSales(e.target.checked)} className="sr-only peer" />
                      <div className="w-12 h-7 rounded-full border border-amber-300/50 bg-amber-500/30 peer-checked:bg-sky-500/70 peer-checked:border-sky-300/70 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-sky-300/60 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 shadow-inner"></div>
                    </label>
                  </div>

                  <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-200 ${tempCanDeleteSales ? "bg-rose-500/[0.09] border-rose-400/40 shadow-[inset_3px_0_0_rgba(251,113,133,0.9)]" : "bg-amber-500/[0.07] border-amber-400/35 shadow-[inset_3px_0_0_rgba(251,191,36,0.85)]"}`}>
                    <div className="space-y-1 max-w-[80%] pr-2">
                      <span className="text-xs font-bold text-white block">Allow salesman to delete transactions</span>
                      <span className="text-[10px] text-slate-300/80 leading-normal block">When OFF, transaction erasures remain restricted to the core admin.</span>
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-[9px] font-black tracking-widest ${tempCanDeleteSales ? "bg-rose-400/15 text-rose-300" : "bg-amber-400/15 text-amber-300"}`}>{tempCanDeleteSales ? "ON · DELETE ACCESS" : "OFF · ADMIN ONLY"}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input type="checkbox" checked={tempCanDeleteSales} onChange={(e) => setTempCanDeleteSales(e.target.checked)} className="sr-only peer" />
                      <div className="w-12 h-7 rounded-full border border-amber-300/50 bg-amber-500/30 peer-checked:bg-rose-500/70 peer-checked:border-rose-300/70 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-rose-300/60 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 shadow-inner"></div>
                    </label>
                  </div>

                  <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all duration-200 ${tempCanOverridePrices ? "bg-violet-500/[0.09] border-violet-400/40 shadow-[inset_3px_0_0_rgba(167,139,250,0.9)]" : "bg-amber-500/[0.07] border-amber-400/35 shadow-[inset_3px_0_0_rgba(251,191,36,0.85)]"}`}>
                    <div className="space-y-1 max-w-[80%] pr-2">
                      <span className="text-xs font-bold text-white block">Allow salesman to override unit prices inside Cart</span>
                      <span className="text-[10px] text-slate-300/80 leading-normal block">When OFF, salesmen cannot change retail pricing inside the cart.</span>
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-[9px] font-black tracking-widest ${tempCanOverridePrices ? "bg-violet-400/15 text-violet-300" : "bg-amber-400/15 text-amber-300"}`}>{tempCanOverridePrices ? "ON · PRICE ACCESS" : "OFF · PRICE LOCKED"}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input type="checkbox" checked={tempCanOverridePrices} onChange={(e) => setTempCanOverridePrices(e.target.checked)} className="sr-only peer" />
                      <div className="w-12 h-7 rounded-full border border-amber-300/50 bg-amber-500/30 peer-checked:bg-violet-500/70 peer-checked:border-violet-300/70 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-violet-300/60 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 shadow-inner"></div>
                    </label>
                  </div>

                </div>

                <div className="pt-3 border-t border-slate-850 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveSalesRestrictions}
                    className="min-h-11 px-5 py-2.5 bg-[#F4F4F5] text-[#111318] border border-white/80 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-[0_4px_18px_rgba(255,255,255,0.16)] hover:bg-white hover:shadow-[0_6px_22px_rgba(255,255,255,0.24)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101319] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" />
                    Save Restrictions
                  </button>
                </div>
              </div>

                </>
              )}

              {activeSettingsSection === "security" && (
                <>
              {/* 3. Panel Passcodes & Account Security Settings */}
              <div className="bg-[#101319]/95 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl animate-fadeIn" id="settings-panel-passcode-block">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="p-2 bg-white/5 rounded-lg text-slate-100">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Security Locks & Panel Passcodes</h4>
                    <p className="text-[10px] text-slate-400">Set standard 4-digit code pins to protect Admin capabilities and restrict ordinary Cashier/Salesman terminals.</p>
                  </div>
                </div>

                <div className="space-y-2 pb-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400 pl-1 block">
                    Current Admin PIN (authorization)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    maxLength={4}
                    value={currentAdminPasscode}
                    onChange={(e) => setCurrentAdminPasscode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter current 4-digit Admin PIN"
                    className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white font-mono font-bold"
                  />
                  <span className="text-[9px] text-slate-400 pl-1">Required to confirm that the account owner is changing security credentials.</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400 pl-1 block">
                      New Admin Panel PIN (Owner Key)
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        maxLength={4}
                        value={tempAdminPasscode}
                        onChange={(e) => setTempAdminPasscode(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 1234"
                        className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 font-mono font-bold transition-all placeholder:text-slate-400 focus:ring-1 focus:ring-white/10"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 font-sans block pl-1 leading-normal">
                      Required PIN to access Admin dashboard, purchases ledger, expenses ledger, and critical settings.
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400 pl-1 block">
                      New Sales Panel PIN (Cashier Key)
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        maxLength={4}
                        value={tempSalesPasscode}
                        onChange={(e) => setTempSalesPasscode(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 5555"
                        className="w-full px-4 py-2.5 bg-[#171A20] border border-slate-600 rounded-xl text-white text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/20 font-mono font-bold transition-all placeholder:text-slate-400 focus:ring-1 focus:ring-cyan-500/20"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 font-sans block pl-1 leading-normal">
                      Required PIN for salesmen to lock admin view or operate standard checkout registers.
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-850 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveSecurityPasscodes}
                    disabled={!/^\d{4}$/.test(currentAdminPasscode) || !/^\d{4}$/.test(tempAdminPasscode) || !/^\d{4}$/.test(tempSalesPasscode)}
                    className="min-h-11 px-5 py-2.5 bg-[#F4F4F5] text-[#111318] border border-white/80 font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-[0_4px_18px_rgba(255,255,255,0.16)] hover:bg-white hover:shadow-[0_6px_22px_rgba(255,255,255,0.24)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101319] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" />
                    Save Passcodes
                  </button>
                </div>
              </div>

              {/* 3.1 Local Storage Diagnostic Specs Banner */}
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 space-y-2 text-xs font-mono text-slate-400" id="settings-metadata-status">
                <p className="flex justify-between">
                  <span>Billing Engine core database version:</span>
                  <span className="text-slate-200 font-bold">BarakahBillPro v2.4.5 (Premium)</span>
                </p>
                <p className="flex justify-between">
                  <span>Pin encryption level:</span>
                  <span className="text-sky-400">AES-256 Cloud Backup Sync OK</span>
                </p>
              </div>

                </>
              )}

              {activeSettingsSection === "danger" && (
                <>
              {/* 4. Danger Zone (Modular destruction actions) */}
              <div className="border-[#FF5252]/30 border-2 bg-[#121214] rounded-2xl p-6 space-y-5 shadow-2xl" id="settings-danger-zone-block">
                <div className="flex items-center gap-3 border-b border-rose-950 pb-3">
                  <AlertTriangle className="w-6 h-6 text-[#FF5252] animate-pulse" />
                  <div>
                    <h4 className="text-sm font-extrabold text-[#FF5252] uppercase tracking-wider font-display">Danger Zone</h4>
                    <p className="text-[10px] text-slate-400">Irreversible, high-risk administrative operations.</p>
                  </div>
                </div>

                <div className="divide-y divide-slate-900 text-xs text-slate-300 space-y-4">
                  
                  {/* Delete All Transactions Action Row */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-4 first:pt-0">
                    <div className="space-y-0.5 max-w-[70%]">
                      <span className="font-bold text-white block">Delete All Transactions</span>
                      <span className="text-[10px] text-slate-400 leading-normal block">Purges historical sales invoices, purchase logs, credit memos, and showroom expense sheets. Keeps product catalogs and customer directories intact.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDangerAction("delete_transactions");
                        setDangerConfirmText("");
                      }}
                      className="px-4 py-2 bg-rose-950/30 hover:bg-rose-900 border border-rose-500/30 text-rose-400 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer hover:border-rose-500 hover:text-white shrink-0"
                    >
                      Wipe Sales History
                    </button>
                  </div>

                  {/* Delete All Customers Action Row */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-4">
                    <div className="space-y-0.5 max-w-[70%]">
                      <span className="font-bold text-white block">Delete All Customers</span>
                      <span className="text-[10px] text-slate-400 leading-normal block">Erases customer communication profiles and records from local registry completely.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDangerAction("delete_customers");
                        setDangerConfirmText("");
                      }}
                      className="px-4 py-2 bg-rose-950/30 hover:bg-rose-900 border border-rose-500/30 text-rose-400 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer hover:border-rose-500 hover:text-white shrink-0"
                    >
                      Clear Customers
                    </button>
                  </div>

                  {/* Reset Entire App Action Row */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-4">
                    <div className="space-y-0.5 max-w-[70%]">
                      <span className="font-bold text-white block">Reset Entire App</span>
                      <span className="text-[10px] text-slate-400 leading-normal block">Wipes all custom logs, sales transactions, expense charts, and custom settings, restoring standard factory product catalogs.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDangerAction("reset_app");
                        setDangerConfirmText("");
                      }}
                      className="px-4 py-2 bg-rose-950/30 hover:bg-rose-900 border border-rose-500/30 text-rose-400 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer hover:border-rose-500 hover:text-white shrink-0"
                    >
                      Reset System Database
                    </button>
                  </div>

                  {/* Delete Account Action Row */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-4">
                    <div className="space-y-0.5 max-w-[70%]">
                      <span className="font-bold text-white block text-rose-450">Delete Account</span>
                      <span className="text-[10px] text-slate-400 leading-normal block">Permanently signs out this session, clears all offline cookies/caches, and defaults the workspace database.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDangerAction("delete_account");
                        setDangerConfirmText("");
                      }}
                      className="px-4 py-2 bg-[#FF5252] hover:bg-rose-500 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-[#FF5252]/10 shrink-0"
                    >
                      Permanently Delete Account
                    </button>
                  </div>

                </div>
              </div>
                </>
              )}


            </div>
          )}

        </div>

        {/* WORKSPACE COMPREHENSIVE TERMINAL FOOTER */}
        <footer className="bg-white border-t border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between text-[10px] text-slate-400 font-mono" id="terminal-footer">
          <span>Logged in: {activeUser?.email}</span>
          <span className="hidden sm:inline">Designed for Barakah Stores | Enterprise POS Platform</span>
          <span>© 2026 Barakah Bill Pro</span>
        </footer>

      </main>

      {/* -------------------- DYNAMIC MODALS OVERLAYS -------------------- */}
      {collectionTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-w-md w-full p-6 space-y-4 text-slate-700 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold uppercase text-slate-800 flex items-center gap-2 font-sans">
                <PiggyBank className="w-5 h-5 text-amber-500" />
                Collect Received Cash
              </h3>
              <button onClick={() => setCollectionTx(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs font-sans">
              <p className="leading-relaxed">
                Receive outstanding cash for <strong>Invoice {collectionTx.invoiceNo}</strong>.
              </p>
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Grand Total</span>
                  <span className="font-extrabold text-slate-800">{businessInfo.currencySymbol} {collectionTx.total}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Outstanding Debt</span>
                  <span className="font-extrabold text-rose-600">{businessInfo.currencySymbol} {collectionTx.dueBalance}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">Collection Amount ({businessInfo.currencySymbol})</label>
                <input
                  type="number"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm outline-none focus:border-amber-500 font-bold text-emerald-600"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2 font-sans">
              <button
                onClick={() => {
                  incrementDuePayment(collectionTx.invoiceNo, parseFloat(collectAmount) || 0);
                  setCollectionTx(null);
                }}
                className="flex-1 py-1 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl h-10 transition-all cursor-pointer shadow-sm text-center"
              >
                Post Received cash
              </button>
              <button
                onClick={() => setCollectionTx(null)}
                className="flex-1 py-1 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl h-10 transition-all cursor-pointer text-center"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-w-lg w-full p-6 space-y-4 text-slate-700 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold uppercase text-slate-800 flex items-center gap-2 font-sans">
                <Edit3 className="w-5 h-5 text-emerald-500" />
                Modify Invoice {editingTx.invoiceNo} & Stock
              </h3>
              <button onClick={() => setEditingTx(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">Invoice Date / Time</label>
                  <input
                    type="datetime-local"
                    value={safeFormat(editingTx.date, "yyyy-MM-dd'T'HH:mm", "")}
                    onChange={(e) => {
                      const selectedDate = e.target.value;
                      if (selectedDate) {
                        setEditingTx({
                          ...editingTx,
                          date: new Date(selectedDate).toISOString()
                        });
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">Set Customer contact</label>
                  <select
                    value={editingTx.contactId || ""}
                    onChange={(e) => setEditingTx({ ...editingTx, contactId: e.target.value || undefined })}
                    className="w-full px-3 py-2 bg-slate-55 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500"
                  >
                    <option value="">Walk-in Customer</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border border-slate-150 rounded-xl overflow-hidden">
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 font-bold text-[10px] uppercase text-slate-400 font-mono">Invoice items</div>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {editingTx.items.map((item, idx) => {
                    const matchedProd = products.find(p => p.id === item.productId || p.id === item.id || p.name === item.name);
                    return (
                      <div key={idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                        <div className="space-y-0.5 font-sans min-w-[140px]">
                          <strong className="font-bold text-slate-800 block text-xs">{matchedProd ? matchedProd.name : (item.name || "Unknown Item")}</strong>
                          <span className="text-[9px] text-slate-400 font-mono block">
                            Catalog rate: {businessInfo.currencySymbol || "৳"}{(matchedProd ? matchedProd.sellPrice : (item.price ?? 0)).toLocaleString()}/unit
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteTransactionItem(editingTx.id, idx)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-bold text-[9px] rounded-lg flex items-center gap-1 cursor-pointer"
                              title="Delete only this product line"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                            <span className="text-[10px] text-slate-450 font-bold font-mono">Price</span>
                            <div className="relative">
                              <span className="absolute left-1.5 top-1 text-slate-400 font-mono text-[10px]">{businessInfo.currencySymbol || "৳"}</span>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={item.price}
                                onChange={(e) => {
                                  const updatedItems = [...editingTx.items];
                                  const newPrice = Math.max(0, parseFloat(e.target.value) || 0);
                                  updatedItems[idx] = {
                                    ...item,
                                    price: newPrice,
                                    total: (item.quantity || 1) * newPrice
                                  };
                                  setEditingTx({
                                    ...editingTx,
                                    items: updatedItems
                                  });
                                }}
                                className="w-20 pl-4 pr-1 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-left font-mono focus:border-emerald-500 outline-none text-[11px]"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-450 font-bold font-mono">Qty</span>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => {
                                const updatedItems = [...editingTx.items];
                                const newQty = Math.max(1, parseInt(e.target.value) || 1);
                                updatedItems[idx] = {
                                  ...item,
                                  quantity: newQty,
                                  total: newQty * (item.price || 0)
                                };
                                setEditingTx({
                                  ...editingTx,
                                  items: updatedItems
                                });
                              }}
                              className="w-14 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono focus:border-emerald-500 outline-none text-[11px]"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">Invoice Discount ({businessInfo.currencySymbol})</label>
                  <input
                    type="number"
                    value={editingTx.discount}
                    onChange={(e) => setEditingTx({ ...editingTx, discount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-705 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">Amount Paid ({businessInfo.currencySymbol})</label>
                  <input
                    type="number"
                    value={editingTx.paidAmount}
                    onChange={(e) => setEditingTx({ ...editingTx, paidAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-705 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 font-sans">
              {currentPanel === "admin" && (
                deleteTxId === editingTx.id ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-2">
                    <span className="min-w-0 flex-1 text-[10px] font-semibold text-rose-200">Delete this complete customer ledger memo?</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleDeleteTransaction(editingTx.id);
                        setDeleteTxId(null);
                        setEditingTx(null);
                      }}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-[10px] font-bold text-white"
                    >Yes, Delete</button>
                    <button type="button" onClick={() => setDeleteTxId(null)} className="rounded-lg bg-white/10 px-3 py-2 text-[10px] font-semibold text-white">Cancel</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteTxId(editingTx.id)}
                    className="w-full rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-2.5 text-[11px] font-bold text-rose-300 transition-colors hover:bg-rose-500/20"
                  >
                    <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Delete Customer Ledger Box
                  </button>
                )
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    handleEditTransaction(editingTx.id, editingTx);
                    setEditingTx(null);
                  }}
                  className="flex-1 py-1 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl h-10 transition-all cursor-pointer shadow-sm text-center"
                >
                  Commit invoice edit
                </button>
                <button
                  onClick={() => { setDeleteTxId(null); setEditingTx(null); }}
                  className="flex-1 py-1 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl h-10 transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(() => {
        const deliveryExpenseIdToDelete = deleteExpenseId?.startsWith("delivery_staff_expense_") ? deleteExpenseId.slice("delivery_staff_expense_".length) : "";
        const deliveryExpenseToDelete = deliveryExpenseIdToDelete ? deliveryExpenseRecords.find((item: any) => String(item.id) === deliveryExpenseIdToDelete) : null;
        const expenseToDelete: Expense | null = deleteExpenseId
          ? expenses.find(e => e.id === deleteExpenseId) || (deliveryExpenseToDelete ? {
              id: deleteExpenseId,
              source: "delivery",
              sourceId: deliveryExpenseIdToDelete,
              category: deliveryExpenseToDelete.category || "Delivery Staff Expense",
              amount: Number(deliveryExpenseToDelete.amount) || 0,
              description: deliveryExpenseToDelete.reason || deliveryExpenseToDelete.description || "Delivery staff expense",
              date: String(deliveryExpenseToDelete.recorded_at || deliveryExpenseToDelete.created_at || deliveryExpenseToDelete.date || "").slice(0, 10),
              recordedAt: deliveryExpenseToDelete.recorded_at || deliveryExpenseToDelete.created_at || deliveryExpenseToDelete.date || "",
              driverName: deliveryExpenseToDelete.driver_name || "",
              paymentStatus: deliveryExpenseToDelete.payment_status === "paid" ? "paid" : "unpaid"
            } : null)
          : null;
        if (!expenseToDelete) return null;
        return (
          <div className="fixed inset-0 z-50 bg-[#0c0c0e]/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1E1E24] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden max-w-md w-full p-6 space-y-4 text-slate-200 animate-scaleIn" id="modal-delete-expense">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-xs font-extrabold uppercase text-[#FF5252] flex items-center gap-2 font-display">
                  <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                  Confirm Expense Deletion
                </h3>
                <button 
                  onClick={() => setDeleteExpenseId(null)} 
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <p className="font-sans text-slate-300">
                  Are you sure you want to delete this expense entry? This action is permanent and cannot be undone.
                </p>

                <div className="bg-[#121214] p-4 rounded-xl border border-slate-800 space-y-2 font-mono">
                  <div className="flex justify-between border-b border-slate-800/40 pb-1.5">
                    <span className="text-[10px] text-slate-400">Date</span>
                    <span className="text-slate-200 text-right">{expenseToDelete.date}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/40 pb-1.5">
                    <span className="text-[10px] text-slate-400">Description</span>
                    <span className="text-slate-200 font-sans font-semibold text-right break-words max-w-[200px]">{expenseToDelete.description}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/40 pb-1.5">
                    <span className="text-[10px] text-slate-400">Category</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#050912] border border-slate-800 text-purple-400 inline-block text-right">
                      {expenseToDelete.category}
                    </span>
                  </div>
                  <div className="flex justify-between pt-0.5">
                    <span className="text-[10px] text-slate-400">Amount</span>
                    <span className="text-rose-400 font-bold">{businessInfo.currencySymbol} {(expenseToDelete.amount ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 font-sans">
                <button
                  onClick={async () => {
                    if (currentPanel !== "admin") {
                      triggerNotification("Security block: Only administrators are authorized to delete expense vouchers! 🛑", "error");
                      setDeleteExpenseId(null);
                      return;
                    }
                    if (expenseToDelete.source === "delivery" && expenseToDelete.sourceId) {
                      const user = firebaseAuth.currentUser;
                      if (!user || !activeUser || !adminActionPin) {
                        triggerNotification("Admin session expired. Please unlock the Admin panel again.", "error");
                        return;
                      }
                      const token = await user.getIdToken();
                      const response = await fetch("/api/delivery/expenses/admin-delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ store_id: String(activeUser.email || "").trim().toLowerCase(), admin_pin: adminActionPin, expense_id: expenseToDelete.sourceId })
                      });
                      const result = await response.json().catch(() => ({}));
                      if (!response.ok) throw new Error(result.error || "Could not delete delivery expense.");
                      setDeliveryExpenseRecords(prev => prev.filter((item: any) => String(item.id) !== expenseToDelete.sourceId));
                    } else {
                      await deleteCloudDocument("expenses", expenseToDelete.id);
                      if (activeUser && !activeUser.isGuest) deleteExpense(expenseToDelete.id).catch(err => {});
                      setExpenses(prev => prev.filter(item => item.id !== expenseToDelete.id));
                    }
                    triggerNotification("Expense entry has been successfully deleted.", "success");
                    setDeleteExpenseId(null);
                  }}
                  className="flex-1 py-1 px-4 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl h-10 transition-all cursor-pointer shadow-lg shadow-rose-600/10 text-center uppercase tracking-wider"
                >
                  Yes, Delete Entry
                </button>
                <button
                  onClick={() => setDeleteExpenseId(null)}
                  className="flex-1 py-1 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl h-10 transition-all cursor-pointer text-center uppercase tracking-wider"
                >
                  No, Keep It
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EDIT EXPENSE MODAL */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 bg-[#0c0c0e]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E24] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden max-w-md w-full p-6 space-y-4 text-slate-200 animate-scaleIn" id="modal-edit-expense">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-xs font-extrabold uppercase text-[#00E676] flex items-center gap-2 font-display">
                <Edit3 className="w-5 h-5 text-emerald-400" />
                Edit Expense Voucher
              </h3>
              <button 
                onClick={() => setEditingExpense(null)} 
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateExpenseSubmit} className="space-y-4 text-xs font-sans">
              
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">
                  Voucher Description *
                </label>
                <textarea
                  required
                  value={editExpenseDesc}
                  onChange={(e) => {
                    setEditExpenseDesc(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  onFocus={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 font-sans min-h-[80px] overflow-hidden resize-none leading-normal"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryModalTarget("edit");
                      setCategoryModalOpen(true);
                    }}
                    className="text-[10px] font-bold text-emerald-400 hover:text-[#00E676] transition-colors cursor-pointer select-none flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-emerald-400 shrink-0" /> + Add Category
                  </button>
                </div>
                <select
                  value={editExpenseCategory}
                  onChange={(e) => setEditExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-slate-200 outline-none focus:border-emerald-500 font-mono cursor-pointer"
                >
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">
                    {editingExpense.source === "delivery" ? "Recorded Date & Time *" : "Date *"}
                  </label>
                  {editingExpense.source === "delivery" ? (
                    <input
                      type="datetime-local"
                      required
                      value={editExpenseRecordedAt}
                      onChange={(e) => { setEditExpenseRecordedAt(e.target.value); setEditExpenseDate(e.target.value.slice(0, 10)); }}
                      className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
                    />
                  ) : (
                    <input
                      type="date"
                      required
                      value={editExpenseDate}
                      onChange={(e) => setEditExpenseDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">
                    Amount (৳) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={editExpenseAmount}
                    onChange={(e) => setEditExpenseAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 font-sans">
                <button
                  type="submit"
                  className="flex-1 py-1 px-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-xs rounded-xl h-10 transition-all cursor-pointer shadow-lg shadow-emerald-600/10 text-center uppercase tracking-wider"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="flex-1 py-1 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl h-10 transition-all cursor-pointer text-center uppercase tracking-wider"
                >
                  Close
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* EDIT EXPENSE CATEGORY MODAL */}
      {categoryToManage && (
        <div className="fixed inset-0 z-[65] bg-[#0c0c0e]/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E24] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden max-w-sm w-full p-5 space-y-4 text-slate-200 animate-scaleIn">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-extrabold uppercase text-[#00E676] flex items-center gap-2 font-display">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                Edit Category
              </h3>
              <button
                onClick={() => { setCategoryToManage(null); setNewCategoryName(""); }}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">Category Name</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 font-mono text-xs"
                autoFocus
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => categoryToManage && handleEditExpenseCategory(categoryToManage, newCategoryName)}
                  className="flex-1 py-2 bg-[#00E676] hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => { setCategoryToManage(null); setNewCategoryName(""); }}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW CATEGORY MODAL */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-[60] bg-[#0c0c0e]/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E24] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden max-w-sm w-full p-5 space-y-4 text-slate-200 animate-scaleIn" id="modal-add-category">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-extrabold uppercase text-[#00E676] flex items-center gap-2 font-display">
                <Plus className="w-4 h-4 text-emerald-400" />
                Add New Category
              </h3>
              <button 
                onClick={() => {
                  setCategoryModalOpen(false);
                  setCategoryModalTarget(null);
                  setNewCategoryName("");
                }} 
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">
                  Category Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Internet, Office Tea"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 font-mono text-xs"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = newCategoryName.trim();
                    if (!trimmed) {
                      triggerNotification("Category name cannot be empty.", "error");
                      return;
                    }
                    if (!allCategories.includes(trimmed)) {
                      setExpenseCategories([...expenseCategories, trimmed]);
                    }
                    
                    if (categoryModalTarget === "add") {
                      setExpenseCategory(trimmed);
                    } else if (categoryModalTarget === "edit") {
                      setEditExpenseCategory(trimmed);
                    }
                    
                    triggerNotification(`Category "${trimmed}" successfully mapped!`);
                    setCategoryModalOpen(false);
                    setCategoryModalTarget(null);
                    setNewCategoryName("");
                  }}
                  className="flex-1 py-2 bg-[#00E676] hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center"
                >
                  Save Category
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryModalOpen(false);
                    setCategoryModalTarget(null);
                    setNewCategoryName("");
                  }}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dangerAction && (
        <div className="fixed inset-0 z-50 bg-[#0c0c0e]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E24] rounded-2xl border-2 border-rose-500/30 shadow-2xl overflow-hidden max-w-md w-full p-6 space-y-4 text-slate-200 animate-scaleIn">
            <div className="flex justify-between items-center border-b border-slate-850 pb-3">
              <h3 className="text-xs font-extrabold uppercase text-[#FF5252] flex items-center gap-2 font-display">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
                Administrative Confirmation Required
              </h3>
              <button 
                onClick={() => {
                  setDangerAction(null);
                  setDangerConfirmText("");
                }} 
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3 text-xs leading-relaxed">
              <p className="font-sans text-slate-300">
                You are about to execute a destructive, irreversible action:
              </p>
              <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl text-rose-400 font-extrabold text-center uppercase tracking-wide text-[10px] font-mono">
                {dangerAction === "delete_transactions" && "Wipe All Sales & Transactions History"}
                {dangerAction === "delete_customers" && "Delete All Customer Profiles"}
                {dangerAction === "reset_app" && "Factory Reset Application Database"}
                {dangerAction === "delete_account" && "Permanently Delete Account State"}
              </div>
              <p className="font-sans text-[#A0A0A5]">
                Once processed, this data cannot be recovered. To verify your authorization, type the exact word <strong className="text-white bg-slate-905 px-1.5 py-0.5 rounded font-mono border border-slate-800 uppercase pl-1 pr-1">CONFIRM</strong> in the field below:
              </p>
              
              <div className="space-y-1.5 pt-1">
                <input
                  type="text"
                  placeholder="Type CONFIRM here..."
                  value={dangerConfirmText}
                  onChange={(e) => setDangerConfirmText(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#121214] border border-slate-800 focus:border-rose-500 rounded-xl font-mono text-center text-xs outline-none font-extrabold text-white uppercase tracking-wider focus:ring-1 focus:ring-rose-500/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 font-sans">
              <button
                disabled={dangerConfirmText !== "CONFIRM"}
                onClick={executeDangerAction}
                className="flex-1 py-1 px-4 bg-[#FF5252] hover:bg-rose-500 disabled:opacity-30 disabled:hover:bg-[#FF5252] text-slate-950 disabled:hover:text-slate-950 hover:text-white font-extrabold text-xs rounded-xl h-10 transition-all cursor-pointer shadow-lg shadow-[#FF5252]/10 text-center uppercase tracking-wider disabled:cursor-not-allowed"
              >
                Execute Operation
              </button>
              <button
                onClick={() => {
                  setDangerAction(null);
                  setDangerConfirmText("");
                }}
                className="flex-1 py-1 px-4 bg-slate-800 hover:bg-slate-705 text-white text-xs font-bold rounded-xl h-10 transition-all cursor-pointer text-center uppercase tracking-wider"
              >
                Abort Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MOBILE BOTTOM NAVIGATION BAR -------------------- */}
      {/* -------------------- MOBILE BOTTOM NAVIGATION BAR -------------------- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0d14]/95 backdrop-blur-xl border-t border-[#1e293b]/70 pb-safe grid grid-cols-5 h-16 shadow-[0_-10px_35px_rgba(0,0,0,0.6)]" id="mobile-bottom-navbar">
        {/* More menu - first shortcut on the far left */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`w-full min-w-0 justify-self-stretch flex flex-col items-center justify-center text-center h-full transition-all duration-200 relative ${
            isMobileMenuOpen ? "text-white font-bold" : "text-[#94a3b8] hover:text-white"
          }`}
          aria-label="Open all menu options"
        >
          <MoreHorizontal className="block mx-auto w-5 h-5 mb-1" />
          <span className="text-[9px] font-semibold tracking-wide font-sans">More</span>
          {isMobileMenuOpen && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />}
        </button>

        {/* Sales shortcut */}
        <button
          onClick={() => {
            setActiveTab("pos");
            setIsMobileMenuOpen(false);
          }}
          className={`w-full min-w-0 justify-self-stretch flex flex-col items-center justify-center text-center h-full transition-all duration-200 relative ${
            activeTab === "pos" ? "text-white font-bold" : "text-[#94a3b8] hover:text-white"
          }`}
          aria-label="Sales POS"
        >
          <ShoppingCart className="block mx-auto w-[18px] h-[18px] mb-1" />
          <span className="text-[9px] font-semibold tracking-wide">Sales</span>
          {activeTab === "pos" && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />}
        </button>

        {/* Dashboard shortcut */}
        <button
          onClick={() => {
            setActiveTab("dashboard");
            setIsMobileMenuOpen(false);
          }}
          className={`w-full min-w-0 justify-self-stretch flex flex-col items-center justify-center text-center h-full transition-all duration-200 relative ${
            activeTab === "dashboard" ? "text-white font-bold" : "text-[#94a3b8] hover:text-white"
          }`}
          aria-label="Dashboard"
        >
          <LayoutDashboard className="block mx-auto w-[18px] h-[18px] mb-1" />
          <span className="text-[9px] font-semibold tracking-wide font-sans">Dashboard</span>
          {activeTab === "dashboard" && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />}
        </button>

        {/* Ledger shortcut */}
        <button
          onClick={() => {
            setActiveTab("ledger");
            setIsMobileMenuOpen(false);
          }}
          className={`w-full min-w-0 justify-self-stretch flex flex-col items-center justify-center text-center h-full transition-all duration-200 relative ${
            activeTab === "ledger" ? "text-white font-bold" : "text-[#94a3b8] hover:text-white"
          }`}
          aria-label="Ledger Box"
        >
          <FileText className="block mx-auto w-[18px] h-[18px] mb-1" />
          <span className="text-[9px] font-semibold tracking-wide font-sans">Ledger</span>
          {activeTab === "ledger" && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />}
        </button>

        {/* Expenses shortcut */}
        <button
          onClick={() => {
            if (currentPanel === "admin") {
              setActiveTab("expenses");
              setIsMobileMenuOpen(false);
            } else {
              triggerNotification("Please log in as Admin to access Expenses", "info");
            }
          }}
          className={`w-full min-w-0 justify-self-stretch flex flex-col items-center justify-center text-center h-full transition-all duration-200 relative ${
            activeTab === "expenses" ? "text-white font-bold" : "text-[#94a3b8] hover:text-white"
          }`}
          aria-label="Expenses"
        >
          <ReceiptText className="block mx-auto w-[18px] h-[18px] mb-1" />
          <span className="text-[9px] font-semibold tracking-wide font-sans">Expenses</span>
          {activeTab === "expenses" && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />}
        </button>
      </nav>

      {/* -------------------- MOBILE DRAWER OVERLAY -------------------- */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex animate-fadeIn" id="mobile-drawer-container">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)}
            id="mobile-drawer-backdrop"
          />

          {/* Side Drawer Body */}
          <div 
            className="relative mr-auto w-72 max-w-[85vw] h-full bg-[#1E1E24] shadow-2xl flex flex-col justify-between border-r border-[#2A2A32] z-50 transition-all duration-300"
            id="mobile-drawer-panel"
          >
            
            {/* Top Header of Drawer */}
            <div className="p-4 border-b border-[#2D2D35] flex items-center justify-between" id="mobile-drawer-header">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center bg-[#00E676]/10 rounded-lg text-[#00E676] border border-[#00E676]/20 overflow-hidden shrink-0">
                  {businessInfo.companyLogo && (businessInfo.companyLogo.startsWith("data:") || businessInfo.companyLogo.startsWith("http")) ? (
                    <img src={businessInfo.companyLogo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="font-extrabold text-[10px] truncate">{businessInfo.companyLogo || "⚡"}</span>
                  )}
                </div>
                <span className="font-extrabold text-xs text-white uppercase tracking-wide font-display truncate max-w-[150px]">
                  {businessInfo.name}
                </span>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)} 
                className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 cursor-pointer"
                id="close-mobile-drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Drawer Links (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#17171d]" id="mobile-drawer-scroll-body">
              <p className="text-[10px] uppercase font-mono tracking-widest text-[#00E676] pl-1 font-bold mb-3">
                {currentPanel === "admin" ? "⚡ Administrator Controls" : "🛒 Cashier Controls"}
              </p>

              <div className="space-y-4">
                {currentPanel === "admin" ? (
                  <div className="space-y-1.5">
                    {([
                      { id: "dashboard", label: "Dashboard", desc: "Overview and business summary", Icon: LayoutDashboard },
                      { id: "pos", label: "Sales POS", desc: "Create sales and checkout", Icon: ShoppingCart },
                      { id: "contacts", label: "Customers", desc: "Customer and supplier directory", Icon: Users },
                      { id: "ledger", label: "Ledger Box", desc: "Cashflow and account history", Icon: FileText },
                      { id: "products", label: "Products", desc: "Product catalogue and stock", Icon: Package },
                      { id: "expenses", label: "Expenses", desc: "Business costs and payments", Icon: ReceiptText },

                      { id: "purchases", label: "Purchases", desc: "Purchase and supplier records", Icon: PlusCircle },
                      { id: "inventory", label: "All Stock", desc: "Complete inventory overview", Icon: Bookmark },
                      { id: "duelist", label: "All Due List", desc: "Due, creditor and product due records", Icon: History },
                      { id: "reports", label: "Reports", desc: "Business reports and statements", Icon: BarChart3 },
                      { id: "staff", label: "Staff Hub", desc: "Staff and salary management", Icon: UserCheck },
                      { id: "delivery", label: "Delivery Management", desc: "Delivery staff, invoice assignments and payments", Icon: Truck },
                      { id: "settings", label: "Settings", desc: "Business and app settings", Icon: Settings },
                    ] as const).map((item) => {
                      const Icon = item.Icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          id={`mobile-tab-${item.id}-btn`}
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isActive
                              ? 'bg-white/[0.10] text-white border-white/25 shadow-inner font-bold'
                              : 'bg-[#131317] text-slate-300 border-[#2b2b35] hover:bg-white/[0.06] hover:border-white/15'
                          }`}
                        >
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-white/10 text-white' : 'bg-[#24242b] text-slate-300'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold leading-tight">{item.label}</span>
                            <span className="block text-[9px] text-slate-400 mt-1">{item.desc}</span>
                          </span>
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {[
                      { id: "pos", label: "Sales", desc: "Build shopping baskets & print bills", Icon: ShoppingCart },
                      { id: "contacts", label: "Customers", desc: "Due balances & contact logs", Icon: Users },
                      { id: "products", label: "Products", desc: "Real-time standard stock index", Icon: Package },
                      { id: "ledger", label: "Ledger", desc: "Sales history, edit selling price & print challan", Icon: FileText },
                      { id: "delivery", label: "Delivery Management", desc: "Assign invoices to delivery staff", Icon: Truck },
                    ].map((item) => {
                      const Icon = item.Icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer bg-[#212127] ${
                            isActive 
                              ? 'text-[#00E676] border-[#00E676]/40 shadow-sm font-bold' 
                              : 'text-slate-300 border-[#2b2b35] hover:bg-slate-800'
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg shrink-0 ${isActive ? 'bg-[#00E676]/20' : 'bg-[#131317]'}`}>
                            <Icon className="w-4 h-4 text-[#00E676]" />
                          </div>
                          <div>
                            <span className="text-xs font-black block leading-tight">{item.label}</span>
                            <span className="text-[9px] text-slate-400 font-normal mt-0.5 block">{item.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Bottom Actions Footer */}
            <div className="p-4 border-t border-[#2D2D35] bg-[#16161C] space-y-3" id="mobile-drawer-footer">
              {/* User Info */}
              <div className="bg-[#121214] border border-[#2D2D35] p-2.5 rounded-xl text-center flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider font-mono text-[#A0A0A5] font-bold block">Terminal Profile</span>
                {activeUser?.isGuest ? (
                  <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold font-sans">
                    Guest Mode
                  </span>
                ) : (
                  <div className="space-y-0.5">
                    <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/10 font-bold font-sans">
                      Active Staff Member
                    </span>
                    <span className="text-[10px] text-[#A0A0A5] font-mono block truncate max-w-[200px]" title={activeUser?.email}>
                      {activeUser?.email}
                    </span>
                  </div>
                )}
              </div>

              {/* Access panel switch buttons */}
              {currentPanel === "admin" ? (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPanel("sales");
                    setAdminActionPin("");
                    setActiveTab("pos");
                    setIsMobileMenuOpen(false);
                    triggerNotification("Switched to Sales Panel", "info");
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white bg-blue-750 dark:bg-blue-700 hover:bg-blue-800 dark:hover:bg-blue-605 border border-blue-600 dark:border-blue-600 cursor-pointer transition-colors shadow-sm"
                >
                  Go to Sales Terminal &rarr;
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPanel("none");
                    setAdminActionPin("");
                    setIsMobileMenuOpen(false);
                    triggerNotification("Enter passcode to unlock admin controls", "info");
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#00E676] bg-[#00E676]/10 hover:bg-[#00E676]/20 border border-[#00E676]/20 cursor-pointer transition-colors"
                >
                  &larr; Admin Access
                </button>
              )}

              {/* Logout */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogOut();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                Logout From Store
              </button>
            </div>

          </div>
        </div>
      )}

      {ledgerDocumentPreview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={ledgerDocumentPreview.title}>
          <div className="flex h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#17171D] shadow-2xl">
            <div className="flex shrink-0 flex-col items-center justify-center gap-3 border-b border-white/10 bg-[#202027] px-3 py-3 sm:flex-row sm:justify-between sm:px-5">
              <div className="flex w-full min-w-0 items-center justify-center gap-3 text-center sm:w-auto sm:justify-start sm:text-left">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-white">{ledgerDocumentPreview.title}</h3>
                  <p className="text-[10px] text-slate-400">Document preview</p>
                </div>
              </div>
              <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const frame = ledgerPreviewFrameRef.current;
                    if (frame?.contentWindow) {
                      frame.contentWindow.focus();
                      frame.contentWindow.print();
                    }
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border !border-white !bg-white px-4 text-[11px] font-bold !text-black shadow-sm transition-all hover:!bg-slate-200 active:scale-[0.98]"
                >
                  <Printer className="h-4 w-4 !text-black" /> <span className="!text-black">Print</span>
                </button>
                <a
                  href={ledgerDocumentPreview.dataUrl}
                  download={`${ledgerDocumentPreview.title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\\s+/g, "_")}.pdf`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.08] px-4 text-[11px] font-bold text-white transition-all hover:bg-white/[0.15]"
                >
                  <Download className="h-4 w-4" /> Download
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const response = await fetch(ledgerDocumentPreview.dataUrl);
                      const blob = await response.blob();
                      const safeFileName = `${ledgerDocumentPreview.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().replace(/\\s+/g, "_") || "BARAKAH_Document"}.pdf`;
                      const file = new File([blob], safeFileName, { type: "application/pdf" });
                      if (navigator.share && navigator.canShare?.({ files: [file] })) {
                        await navigator.share({
                          files: [file],
                          title: ledgerDocumentPreview.title,
                          text: `${ledgerDocumentPreview.title} - BARAKAH e-MART`
                        });
                      } else {
                        triggerNotification("এই ডিভাইস বা ব্রাউজারে PDF ফাইল সরাসরি Share করা যাচ্ছে না। Download করে WhatsApp বা imo-তে সংযুক্ত করুন।", "info");
                      }
                    } catch (error: any) {
                      if (error?.name !== "AbortError") {
                        console.error("Could not share PDF document:", error);
                        triggerNotification("PDF শেয়ার করা যায়নি। আবার চেষ্টা করুন অথবা Download করে শেয়ার করুন।", "error");
                      }
                    }
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.08] px-4 text-[11px] font-bold text-white transition-all hover:border-white/40 hover:bg-white/[0.15] active:scale-[0.98]"
                >
                  <Share2 className="h-4 w-4" /> Share
                </button>

                <button
                  type="button"
                  onClick={() => setLedgerDocumentPreview(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-slate-300 transition-all hover:bg-white/15 hover:text-white"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <iframe
              ref={ledgerPreviewFrameRef}
              src={ledgerDocumentPreview.dataUrl}
              title={ledgerDocumentPreview.title}
              className="hidden"
              aria-hidden="true"
            />
            <LedgerPdfViewer
              dataUrl={ledgerDocumentPreview.dataUrl}
              title={ledgerDocumentPreview.title}
              initialZoom={ledgerPreviewZoom}
              fitToWidth={window.matchMedia("(max-width: 767px)").matches}
              onZoomChange={(zoom) => {
                setLedgerPreviewZoom(zoom);
                if (!window.matchMedia("(max-width: 767px)").matches) {
                  try { localStorage.setItem(getDbKey("barakah_ledger_pdf_zoom"), String(zoom)); } catch {}
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
