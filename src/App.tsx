import React, { useState, useEffect, useRef } from "react";
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
  Menu,
  LayoutDashboard,
  Sun,
  Moon,
  Layers,
  ShoppingBag,
  Printer,
  Share2,
  Undo2,
  Languages,
  Sparkles
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart, Pie } from "recharts";
import { format } from "date-fns";

import { AuthScreen } from "./components/AuthScreen";
import { PanelGateLock } from "./components/PanelGateLock";
import { DashboardView } from "./components/DashboardView";
import { ReportsView } from "./components/ReportsView";
import { ProductsView } from "./components/ProductsView";
import { NegativeSalesView } from "./components/NegativeSalesView";
import { PurchasesView } from "./components/PurchasesView";
import { Staff, SalaryPayment, StaffManagementView } from "./components/StaffManagementView";
import { 
  Product, 
  Expense, 
  Contact, 
  Transaction, 
  TransactionItem, 
  BusinessInfo, 
  Purchase,
  loadDB, 
  saveDB,
  INITIAL_PRODUCTS,
  INITIAL_CONTACTS,
  INITIAL_EXPENSES,
  INITIAL_BUSINESS_INFO,
  INITIAL_PURCHASES,
  getDbKey
} from "./lib/mockDB";
import { 
  subscribeToAuthChanges, 
  signOut, 
  uploadPasscodeBackup, 
  fetchAndRestoreCloudBackup,
  signInOrSignUpWithPasscode,
  signUpWithEmail,
  signInWithEmail,
  getPasscodeSyncId,
  selfHealDatabase,
  toUUID,
  restoreLocalKeys,
  deleteCloudDocument
} from "./lib/supabase";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./lib/firebase";
import { 
  generateInvoicePDF,
  generateDeliveryChallanPDF
} from "./lib/pdf";
import { 
  generateBusinessInsights, 
  suggestExpenseCategory, 
  AIInsight 
} from "./services/aiService";

export default function App() {
  // Authentication & Session
  const [activeUser, setActiveUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

   const initialLoadedRef = useRef(false);
 
   // Active Core Database State (Merged loaded state)
   const [products, setProducts] = useState<Product[]>(() => loadDB().products);
   const [contacts, setContacts] = useState<Contact[]>(() => loadDB().contacts);
   const [expenses, setExpenses] = useState<Expense[]>(() => loadDB().expenses);
   const [transactions, setTransactions] = useState<Transaction[]>(() => loadDB().transactions);
   const [purchases, setPurchases] = useState<Purchase[]>(() => loadDB().purchases || []);
   const [deletedItems, setDeletedItems] = useState<any[]>(() => loadDB().deletedItems || []);
   const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(() => loadDB().businessInfo);
 
   const softDeleteItem = (type: 'sale' | 'customer' | 'expense' | 'purchase' | 'product', originalId: string, itemData: any, label: string) => {
     const newItem = {
       id: `${type}_deleted_${originalId || Math.random().toString(36).substring(7)}`,
       originalId,
       type,
       deletedAt: new Date().toISOString(),
       data: itemData,
       label
     };
     setDeletedItems(prev => [newItem, ...prev]);
   };
 
   // Security Locking Roles state
   const [currentPanel, setCurrentPanel] = useState<"none" | "admin" | "sales">("none");

  // Current active workspace view tab
  const [activeTab, setActiveTab ] = useState<
    "dashboard" | "pos" | "contacts" | "products" | "negative-sales" | "purchases" | "inventory" | "duelist" | "ledger" | "expenses" | "reports" | "staff" | "settings"
  >(() => {
    return typeof window !== "undefined" && window.innerWidth < 768 ? "dashboard" : "pos";
  });

  // Staff members state
  const [staffList, setStaffList] = useState<Staff[]>(() => {
    try {
      const db = loadDB();
      if (db.businessInfo && (db.businessInfo as any).staffList && Array.isArray((db.businessInfo as any).staffList)) {
        return (db.businessInfo as any).staffList;
      }
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

  // Cloud backup sync indicator active states
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"connecting" | "connected" | "reconciling" | "error" | "offline">("offline");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Custom dialog state overrides for iframe friendliness
  const [activeConfirm, setActiveConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<string | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [collectionTx, setCollectionTx] = useState<Transaction | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [showAdvancedPos, setShowAdvancedPos] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [contactTypeFilter, setContactTypeFilter] = useState<"all" | "customer" | "supplier">("all");

  // --- DUE LIST STATE DEFINITIONS ---
  const [duelistFilter, setDuelistFilter] = useState<"all" | "today" | "weekly" | "monthly" | "yearly">("all");
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

  const hasSyncedOnMountRef = useRef(false);

  // Load Offline initial database state and sync latest from cloud safely
  useEffect(() => {
    try {
      selfHealDatabase();
    } catch (_) {}

    const unsub = subscribeToAuthChanges(async (user) => {
      setActiveUser(user);

      if (!user) {
        hasSyncedOnMountRef.current = false; // Reset sync status so the next user can pull their own data on mount
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

      // Perform cloud pull on startup if registered and not synced yet in this tab session
      if (!user.isGuest && !hasSyncedOnMountRef.current) {
        hasSyncedOnMountRef.current = true;
        setIsAuthLoading(true);
        initialLoadedRef.current = false;

        try {
          const passcode = user.isPasscodeUser ? (user.passcode || "1234") : "classic_account_secure";
          const wasRestored = await fetchAndRestoreCloudBackup(user.email, passcode, true);
          if (wasRestored) {
            console.log("[Sync on Mount] Successfully grabbed cloud backup on app mount.");
          }
        } catch (e) {
          console.error("[Sync on Mount] Startup cloud synchronization failed:", e);
        }
      }

      // Reload database from custom localStorage storage corresponding to the session mode
      const db = loadDB(user.uid);
      setProducts(db.products);
      setContacts(db.contacts);
      setExpenses(db.expenses);
      setTransactions(db.transactions);
      setBusinessInfo(db.businessInfo);
      setPurchases(db.purchases || []);
      setDeletedItems(db.deletedItems || []);
      if (db.businessInfo && (db.businessInfo as any).staffList && Array.isArray((db.businessInfo as any).staffList)) {
        setStaffList((db.businessInfo as any).staffList);
      } else {
        try {
          const lstr = localStorage.getItem(getDbKey("barakah_staff_list"));
          if (lstr) setStaffList(JSON.parse(lstr));
        } catch (_) {}
      }

      setIsAuthLoading(false);
      // Unlock saving/autosync safely now that validation is fully robust!
      setTimeout(() => {
        initialLoadedRef.current = true;
      }, 500);
    });
    return () => unsub();
  }, []);

  // Sync state to local storage automatically when changed and auto backup to cloud on changes
  useEffect(() => {
    if (!initialLoadedRef.current) return;

    if (activeUser) {
      const compiledBusinessInfo = {
        ...businessInfo,
        staffList
      };

      saveDB({
        products,
        contacts,
        expenses,
        transactions,
        businessInfo: compiledBusinessInfo,
        purchases,
        deletedItems
      }, activeUser.uid);

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

        if (products.length === 0 && transactions.length === 0 && !isSettingsModified) {
          console.warn("[Auto Backup Guard] Local database is completely empty and settings are unmodified. Skipping background auto-backup to protect the cloud database from accidental overwrites.");
          return;
        }

        const passcode = activeUser.isPasscodeUser ? (activeUser.passcode || "1234") : "classic_account_secure";
        const delayDebounceFn = setTimeout(async () => {
          try {
            await uploadPasscodeBackup(activeUser.email, passcode, {
              products,
              contacts,
              expenses,
              transactions,
              businessInfo: compiledBusinessInfo,
              purchases,
              deletedItems
            });
          } catch (e) {
            console.warn("Auto-backup failed silently in background:", e);
          }
        }, 1500);
        return () => clearTimeout(delayDebounceFn);
      }
    }
  }, [products, contacts, expenses, transactions, businessInfo, purchases, deletedItems, staffList, activeUser]);

  // Set up real-time multi-device cloud subscription
  useEffect(() => {
    if (!activeUser || activeUser.isGuest) {
      setSyncStatus("offline");
      return;
    }

    setSyncStatus("connecting");

    const passcode = activeUser.isPasscodeUser ? (activeUser.passcode || "1234") : "classic_account_secure";
    const syncId = getPasscodeSyncId(activeUser.email, passcode);

    console.log(`[Realtime Sync] Subscribing to cloud document: passcode_syncs/${syncId}`);

    let lastUpdatedAt = "";

    const unsub = onSnapshot(doc(db, "passcode_syncs", syncId), (docSnap) => {
      // Document may not exist yet, but subscription connected successfully
      if (!docSnap.exists()) {
        setSyncStatus("connected");
        return;
      }

      const cloudData = docSnap.data();
      const cloudUpdatedAt = cloudData.updated_at || "";

      // Avoid self-refresh loops or stale values
      if (cloudUpdatedAt === lastUpdatedAt) {
        setSyncStatus("connected");
        return;
      }

      const cloudProducts = cloudData.products || [];
      const cloudTransactions = cloudData.transactions || [];

      // Protect local state if cloud data has not been initialized
      if (cloudProducts.length === 0 && cloudTransactions.length === 0) {
        setSyncStatus("connected");
        return;
      }

      try {
        console.log(`[Realtime Sync] Remote database updated at ${cloudUpdatedAt}. Synchronizing...`);
        lastUpdatedAt = cloudUpdatedAt;
        setSyncStatus("reconciling");

        // Restore to localStorage
        restoreLocalKeys(cloudData, false);

        // Load the new values from localStorage
        const refreshedDB = loadDB(activeUser?.uid);

        // Momentarily pause backup triggers during React state updates
        initialLoadedRef.current = false;

        setProducts(refreshedDB.products);
        setContacts(refreshedDB.contacts);
        setExpenses(refreshedDB.expenses);
        setTransactions(refreshedDB.transactions);
        setBusinessInfo(refreshedDB.businessInfo);
        setPurchases(refreshedDB.purchases || []);
        setDeletedItems(refreshedDB.deletedItems || []);

        if (refreshedDB.businessInfo && refreshedDB.businessInfo.staffList && Array.isArray(refreshedDB.businessInfo.staffList)) {
          setStaffList(refreshedDB.businessInfo.staffList);
        }

        setTimeout(() => {
          initialLoadedRef.current = true;
          setSyncStatus("connected");
          console.log("[Realtime Sync] Complete database and store settings synchronized in real-time.");
        }, 300);

      } catch (err) {
        console.error("[Realtime Sync] Error syncing cloud snapshot locally:", err);
        setSyncStatus("error");
      }
    }, (error) => {
      console.warn("[Realtime Sync] Firestore snapshot subscription failed:", error);
      setSyncStatus("error");
    });

    return () => {
      unsub();
      setSyncStatus("offline");
    };
  }, [activeUser]);

  // Synchronize staff list on cloud restore or config resets
  useEffect(() => {
    if (businessInfo && (businessInfo as any).staffList && Array.isArray((businessInfo as any).staffList)) {
      setStaffList((businessInfo as any).staffList);
    }
  }, [businessInfo]);

  const [successTriggerMsg, setSuccessTriggerMsg] = useState<string | null>(null);

  // Show customized temporal workspace notification
  const triggerNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ message, type });
    if (type === "success") {
      setSuccessTriggerMsg(message);
      setTimeout(() => setSuccessTriggerMsg(null), 1600);
    }
    setTimeout(() => setNotification(null), 4000);
  };

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
    const db = loadDB();
    setProducts(db.products);
    setContacts(db.contacts);
    setExpenses(db.expenses);
    setTransactions(db.transactions);
    setBusinessInfo(db.businessInfo);
    setPurchases(db.purchases || []);
    triggerNotification("Guest Mode Activated (Welcome to Sandbox Guest Mode!)", "info");
    initialLoadedRef.current = true;
  };

  // Trigger PIN Backup upload
  const triggerCloudBackupSync = async () => {
    if (!activeUser || activeUser.isGuest) {
      triggerNotification("Cloud backup is only available for registered store members.", "info");
      return;
    }
    setIsBackingUp(true);
    const passcode = activeUser.isPasscodeUser ? (activeUser.passcode || "1234") : "classic_account_secure";
    const res = await uploadPasscodeBackup(activeUser.email, passcode, {
      products,
      contacts,
      expenses,
      transactions,
      businessInfo,
      purchases
    });
    setIsBackingUp(false);
    const isSuccess = !!(res && (res as any).success);
    if (isSuccess) {
      triggerNotification("Cloud backup successfully synchronized!", "success");
    } else {
      const errorMsg = (res && typeof res === 'object' && (res as any).error) ? (res as any).error : "Please check your network and credentials";
      triggerNotification(`Cloud backup failed: ${errorMsg}`, "error");
    }
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
        const db = loadDB(activeUser?.uid);
        setProducts(db.products);
        setContacts(db.contacts);
        setExpenses(db.expenses);
        setTransactions(db.transactions);
        setBusinessInfo(db.businessInfo);
        setPurchases(db.purchases || []);

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
    restoreLocalKeys(data, true);
    // Reload states from newly restored localStorage DB
    const dbData = loadDB(activeUser?.uid);
    setProducts(dbData.products);
    setContacts(dbData.contacts);
    setExpenses(dbData.expenses);
    setTransactions(dbData.transactions);
    setBusinessInfo(dbData.businessInfo);
    setPurchases(dbData.purchases || []);
  };

  // Handler for custom local auth action signup
  const handleSignUp = async (email: string, pass: string) => {
    initialLoadedRef.current = false;
    const user = await signUpWithEmail(email, pass);
    setActiveUser(user);
    
    // Refresh states
    const db = loadDB(user?.uid);
    setProducts(db.products);
    setContacts(db.contacts);
    setExpenses(db.expenses);
    setTransactions(db.transactions);
    setBusinessInfo(db.businessInfo);
    setPurchases(db.purchases || []);

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
    const db = loadDB(user?.uid);
    setProducts(db.products);
    setContacts(db.contacts);
    setExpenses(db.expenses);
    setTransactions(db.transactions);
    setBusinessInfo(db.businessInfo);
    setPurchases(db.purchases || []);

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
    const db = loadDB(user?.uid);
    setProducts(db.products);
    setContacts(db.contacts);
    setExpenses(db.expenses);
    setTransactions(db.transactions);
    setBusinessInfo(db.businessInfo);
    setPurchases(db.purchases || []);

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
    hasSyncedOnMountRef.current = false; // Reset the cloud sync status completely to allow the next login session to sync fresh
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
    triggerNotification("Logged out from terminal successfully.");
  };

  // -----------------------------------------------------------------
  // 1. POS INVOICING WORKSPACE (Cash Memo) STATE
  // -----------------------------------------------------------------
  const [posCart, setPosCart] = useState<{ product: Product; quantity: number; price?: number }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [cartItemQty, setCartItemQty] = useState<number>(1);
  const [cartItemPrice, setCartItemPrice] = useState<string>("");
  const [customerDiscount, setCustomerDiscount] = useState<number>(0);
  const [invoiceTaxRate, setInvoiceTaxRate] = useState<number>(0); // default VAT % is now 0
  const [posSelectedContactId, setPosSelectedContactId] = useState<string>("");
  const [posCustomDate, setPosCustomDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [amountPaidPaid, setAmountPaidPaid] = useState<string>("");
  const [showSignaturePad, setShowSignaturePad] = useState<boolean>(true);

  // Local temp states for Settings with individual block saves
  const [tempShopName, setTempShopName] = useState("");
  const [tempShopAddress, setTempShopAddress] = useState("");
  const [tempShopPhone, setTempShopPhone] = useState("");
  const [tempShopEmail, setTempShopEmail] = useState("");
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
      setTempInvoiceTemplate(businessInfo.selectedInvoiceTemplate || "classic");
      setTempLogoAlignment(businessInfo.logoAlignment || "left");
      setTempStartingInvoiceNumber(businessInfo.startingInvoiceNumber || 1001);
      const savedScale = (localStorage.getItem("font_size_scale") as "Regular" | "Medium" | "Large") || "Regular";
      setTempFontSizeScale(savedScale);

      setTempCanEditSales(businessInfo.salesmanPermissions?.canEditSales !== false);
      setTempCanDeleteSales(businessInfo.salesmanPermissions?.canDeleteSales !== false);
      setTempCanOverridePrices(businessInfo.salesmanPermissions?.canOverridePrices !== false);
    }
  }, [businessInfo]);

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
      setPosCart([...posCart, { product: prod, quantity: qty, price: finalPrice }]);
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
      setPosCart([...posCart, { product: prod, quantity: cartItemQty, price: finalPrice }]);
    }

    triggerNotification(`${prod.name} added to checkout cart!`);
    setCartItemQty(1);
    setCartItemPrice("");
    setSelectedProductId("");
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
  const handleGenerateInvoice = () => {
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

    const newTransaction: Transaction = {
      id: uniqueTxId,
      invoiceNo: uniqueInvoiceNo,
      date: targetDateStr,
      items: posCart.map((cartItem, idx) => {
        const itemPrice = cartItem.price !== undefined ? cartItem.price : cartItem.product.sellPrice;
        return {
          id: toUUID(`ti_${idx}_${Date.now()}`, cleanEmail),
          name: cartItem.product.name,
          productId: toUUID(cartItem.product.id, cleanEmail),
          quantity: cartItem.quantity,
          price: itemPrice,
          total: itemPrice * cartItem.quantity,
          buyPrice: cartItem.product.buyPrice || 0,
          isNegativeSale: cartItem.product.stock < cartItem.quantity
        };
      }),
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

    // Deduct stock levels corresponding to invoice (allowing negative stock per requirements)
    const updatedProducts = products.map((p) => {
      const soldItem = posCart.find(cartItem => 
        cartItem.product.id === p.id || 
        (p.sku && cartItem.product.sku === p.sku) || 
        (cartItem.product.name && cartItem.product.name.trim().toLowerCase() === p.name.trim().toLowerCase())
      );
      if (soldItem) {
        const nextStock = p.stock - soldItem.quantity;
        if (nextStock < 0) {
          return {
            ...p,
            stock: nextStock,
            hasNegativeSale: true,
            negativeSaleUpdated: false
          };
        }
        return { ...p, stock: nextStock };
      }
      return p;
    });

    setProducts(updatedProducts);
    setTransactions([newTransaction, ...transactions]);

    // Export PDF on successful checkout (Only actual Customer Invoice is generated, not delivery challan)
    const pairedContact = contacts.find(c => c.id === posSelectedContactId);
    try {
      generateInvoicePDF(newTransaction, pairedContact, businessInfo).catch(err => {
        console.error("Async error in generateInvoicePDF:", err);
      });
    } catch (pdfErr) {
      console.error("Error triggering PDF creation:", pdfErr);
    }

    // Clean Workspace states
    setPosCart([]);
    setCustomerDiscount(0);
    setAmountPaidPaid("");
    setPosSelectedContactId("");
    setPosCustomDate(new Date().toISOString().split("T")[0]);
    clearSignatureCanvas();

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
  const [stockSubTab, setStockSubTab] = useState<"catalog" | "supplier-bills" | "due-list">("catalog");

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

    setProducts([...products, parsedProduct]);
    setNewProdName("");
    setNewProdSKU("");
    setNewProdBuyPrice("");
    setNewProdSellPrice("");
    setNewProdStock("");
    
    triggerNotification(`${parsedProduct.name} successfully added to the inventory catalog.`);
  };

  const handleDeleteProduct = (id: string, name: string) => {
    if (currentPanel !== "admin") {
      triggerNotification("Security block: Only administrators are authorized to delete products! 🛑", "error");
      return;
    }
    const p = products.find(prod => prod.id === id);
    if (!p) return;
    softDeleteItem("product", id, p, `Product: ${p.name} (SKU: ${p.sku || "N/A"}, Stock: ${p.stock})`);
    setProducts(products.filter(item => item.id !== id));
    triggerNotification(`Product '${name}' moved to Settings -> Deleted Filter.`);
  };

  // Save Shop Information Block
  const handleSaveShopInfo = () => {
    setBusinessInfo(prev => ({
      ...prev,
      name: tempShopName,
      address: tempShopAddress,
      phoneNumber: tempShopPhone,
      email: tempShopEmail,
      vatRegNo: tempVatRegNo,
      currencySymbol: tempCurrency
    }));
    triggerNotification("Shop Information changes saved successfully!", "success");
  };

  // Save Invoice Customization Config Block
  const handleSaveInvoiceConfig = () => {
    setBusinessInfo(prev => ({
      ...prev,
      companyLogo: tempLogoBase64,
      showLogoInInvoice: tempShowLogo,
      termsConditions: tempTerms,
      showCustomerSignature: tempShowCustSig,
      showAuthorizedSignature: tempShowAuthSig,
      selectedInvoiceTemplate: tempInvoiceTemplate,
      logoAlignment: tempLogoAlignment,
      startingInvoiceNumber: tempStartingInvoiceNumber,
      showPartnerLogos: tempShowPartners,
      partnerLogos: tempPartnerLogos,
      presetBrands: tempPresetBrands
    }));
    triggerNotification("Invoice Customization changes saved successfully!", "success");
  };

  // Save Font Settings Block
  const handleSaveFontSettings = () => {
    setBusinessInfo(prev => ({
      ...prev,
      selectedFont: tempFont
    }));
    setFontSizeScale(tempFontSizeScale);
    triggerNotification(`Corporate typography changed to ${tempFont} and scaled to [${tempFontSizeScale}] globally!`, "success");
  };

  // Save Sales Panel Restrictions Block
  const handleSaveSalesRestrictions = () => {
    setBusinessInfo(prev => ({
      ...prev,
      salesmanPermissions: {
        canEditSales: tempCanEditSales,
        canDeleteSales: tempCanDeleteSales,
        canOverridePrices: tempCanOverridePrices
      }
    }));
    triggerNotification("Sales Panel Restrictions saved successfully!", "success");
  };

  // Save Security Passcodes settings change
  const handleSaveSecurityPasscodes = () => {
    const isNumeric = (str: string) => /^\d+$/.test(str);
    
    if (tempAdminPasscode.length < 4 || tempSalesPasscode.length < 4) {
      triggerNotification("Password/Passcode must be at least 4 digits long!", "error");
      return;
    }
    if (!isNumeric(tempAdminPasscode) || !isNumeric(tempSalesPasscode)) {
      triggerNotification("Password/Passcode must only contain numeric digits (0-9)!", "error");
      return;
    }
    if (tempAdminPasscode === tempSalesPasscode) {
      triggerNotification("Admin passcode and Sales panel passcode must be distinct!", "error");
      return;
    }
    
    setBusinessInfo(prev => ({
      ...prev,
      adminPasscode: tempAdminPasscode,
      salesPasscode: tempSalesPasscode
    }));
    triggerNotification("Admin and Sales security passcodes updated successfully!", "success");
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

  // Replenish stock count
  const incrementProductStock = (id: string) => {
    setProducts(products.map((p) => {
      if (p.id === id) {
        return { ...p, stock: p.stock + 10 };
      }
      return p;
    }));
    triggerNotification("10 units added to product stock successfully.");
  };

  const handleUpdatePricing = (id: string, buyPrice: number, sellPrice: number, addStock?: number) => {
    const matchedProd = products.find(p => p.id === id);
    const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();

    if (addStock && addStock > 0) {
      const invoiceNo = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
      const newPurchase = {
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
      setPurchases(prev => [newPurchase, ...prev]);
    }

    setProducts(products.map(p => {
      if (p.id === id) {
        const nextStock = p.stock + (addStock || 0);
        const isStillNegative = nextStock < 0;
        return {
          ...p,
          buyPrice,
          sellPrice,
          stock: nextStock,
          hasNegativeSale: isStillNegative,
          negativeSaleUpdated: true
        };
      }
      return p;
    }));
    triggerNotification("Product stock and price configurations successfully updated.");
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

  const handleUpdateTransactionItemBuyPrice = (txId: string, itemIdx: number, newBuyPrice: number, isApproved?: boolean, productId?: string) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === txId) {
        const updatedItems = t.items.map((it, idx) => {
          if (idx === itemIdx) {
            return {
              ...it,
              buyPrice: newBuyPrice,
              isNegativeSaleApproved: isApproved !== undefined ? isApproved : it.isNegativeSaleApproved,
              negativeSaleUpdated: isApproved !== undefined ? isApproved : it.negativeSaleUpdated
            };
          }
          return it;
        });
        return {
          ...t,
          items: updatedItems
        };
      }
      return t;
    }));

    if (productId && newBuyPrice > 0) {
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          return {
            ...p,
            buyPrice: newBuyPrice
          };
        }
        return p;
      }));
    }

    triggerNotification("Transaction item cost specified and approved! Net profit recalculated instantly.", "success");
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
    setProducts(products.map(p => {
      if (p.id === pur.productId) {
        const updatedSellPrice = pur.updatedSellPrice !== undefined ? Number(pur.updatedSellPrice) : p.sellPrice;
        return {
          ...p,
          stock: p.stock + pur.quantity,
          buyPrice: pur.unitPrice, // New purchase price instantly updates P&L basis
          sellPrice: !isNaN(updatedSellPrice) ? updatedSellPrice : p.sellPrice
        };
      }
      return p;
    }));
    triggerNotification(`Purchase Order ${pur.invoiceNo} logged. Initial purchase rate updated.`);
  };

  const handleDeletePurchase = (id: string) => {
    if (currentPanel !== "admin") {
      triggerNotification("Security block: Only administrators are authorized to delete purchases! 🛑", "error");
      return;
    }
    const matchingPur = purchases.find(p => p.id === id);
    if (!matchingPur) return;
    softDeleteItem("purchase", id, matchingPur, `Purchase Order: Invoice #${matchingPur.invoiceNo} (Qty: ${matchingPur.quantity}, Unit Price: ${businessInfo.currencySymbol || "৳"}${matchingPur.unitPrice})`);
    setPurchases(purchases.filter(p => p.id !== id));
    setProducts(products.map(p => {
      if (p.id === matchingPur.productId) {
        return {
          ...p,
          stock: Math.max(p.stock - matchingPur.quantity, 0)
        };
      }
      return p;
    }));
    triggerNotification("Purchase record moved to Settings -> Deleted Filter and inventory adjusted.");
  };

  const handleEditPurchase = (id: string, updatedFields: any) => {
    const originalPur = purchases.find(p => p.id === id);
    if (!originalPur) return;

    setPurchases(purchases.map(p => p.id === id ? { ...p, ...updatedFields } : p));
    setProducts(products.map(prod => {
      let updatedStock = prod.stock;
      let updatedBuyPrice = prod.buyPrice;

      if (prod.id === originalPur.productId) {
        updatedStock -= originalPur.quantity;
      }
      if (prod.id === updatedFields.productId) {
        updatedStock += updatedFields.quantity;
        updatedBuyPrice = updatedFields.unitPrice;
      }

      return {
        ...prod,
        stock: updatedStock,
        buyPrice: updatedBuyPrice
      };
    }));

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

    const returnVal = parseFloat((returnQty * pur.buyPrice).toFixed(2));
    const oldDue = pur.dueAmount || 0;
    const nextDue = Math.max(0, parseFloat((oldDue - returnVal).toFixed(2)));
    const nextTotal = Math.max(0, parseFloat((pur.totalAmount - returnVal).toFixed(2)));
    
    // If return value exceeds outstanding credit debt, decrease cashPaid (representing a supplier refund)
    const refundCash = Math.max(0, parseFloat((returnVal - oldDue).toFixed(2)));
    const nextCashPaid = Math.max(0, parseFloat(((pur.cashPaid || 0) - refundCash).toFixed(2)));

    // Update product stock
    setProducts(products.map(p => {
      if (p.id === pur.productId) {
        return {
          ...p,
          stock: Math.max(0, p.stock - returnQty)
        };
      }
      return p;
    }));

    // Update purchase logs
    setPurchases(purchases.map(item => {
      if (item.id === pur.id) {
        const nextQty = Math.max(0, item.quantity - returnQty);
        return {
          ...item,
          quantity: nextQty,
          totalAmount: nextTotal,
          dueAmount: nextDue,
          cashPaid: nextCashPaid,
          note: (item.note || "") + ` [Returned ${returnQty} pcs on ${format(new Date(), "dd-MM-yyyy")}]`
        };
      }
      return item;
    }));

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
    const handler = setTimeout(() => {
      try {
        localStorage.setItem(getDbKey("barakah_ledger_status_filter"), ledgerStatusFilter);
      } catch (e) {
        console.error("Failed to save ledger status filter to localStorage", e);
      }
    }, 450);
    return () => clearTimeout(handler);
  }, [ledgerStatusFilter]);

  const incrementDuePayment = (invoiceNo: string, collectionAmt: number) => {
    if (!collectionAmt || collectionAmt <= 0) return;

    setTransactions(transactions.map((t) => {
      if (t.invoiceNo === invoiceNo) {
        const newPaid = Math.min(t.total, t.paidAmount + collectionAmt);
        const newDue = Math.max(0, t.total - newPaid);
        return {
          ...t,
          paidAmount: newPaid,
          dueBalance: newDue,
          status: newDue === 0 ? "paid" : "partial"
        };
      }
      return t;
    }));
    triggerNotification(`Invoice ${invoiceNo}: ${collectionAmt} BDT received & recorded.`);
  };

  const handleDeleteTransaction = (id: string) => {
    if (currentPanel !== "admin") {
      triggerNotification("Security block: Only administrators are authorized to delete transactions / sales! 🛑", "error");
      return;
    }
    const t = transactions.find(item => item.id === id);
    if (!t) return;

    // Refund stock back to products catalog
    setProducts(products.map(prod => {
      const soldItem = t.items.find(item => item.productId === prod.id || item.id === prod.id);
      if (soldItem) {
        return {
          ...prod,
          stock: prod.stock + (soldItem.quantity ?? 0)
        };
      }
      return prod;
    }));

    // Soft delete transaction
    const relatedCustomer = contacts.find(co => co.id === t.contactId);
    const deleteCustName = relatedCustomer ? relatedCustomer.name : "Walk-in";
    softDeleteItem(
      "sale", 
      id, 
      t, 
      `Invoice #${t.invoiceNo} (Amount: ${businessInfo.currencySymbol || "৳"}${t.total?.toLocaleString() || "0"}, Customer: ${deleteCustName})`
    );
    setTransactions(transactions.filter(item => item.id !== id));
    triggerNotification(`Invoice ${t.invoiceNo} moved to Settings -> Deleted Filter.`);
  };

  const handleEditTransaction = (id: string, updatedFields: Partial<Transaction>) => {
    if (currentPanel !== "admin") {
      triggerNotification("Security block: Only administrators are authorized to edit sales transactions! 🛑", "error");
      return;
    }
    const originalTx = transactions.find(t => t.id === id);
    if (!originalTx) return;

    const items = updatedFields.items || originalTx.items;
    const discount = updatedFields.discount !== undefined ? updatedFields.discount : originalTx.discount;
    const paidAmount = updatedFields.paidAmount !== undefined ? updatedFields.paidAmount : originalTx.paidAmount;

    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const total = Math.max(subtotal - discount, 0);
    const dueBalance = Math.max(total - paidAmount, 0);
    const status = dueBalance === 0 ? "paid" : paidAmount > 0 ? "partial" : "due";

    // Adjust catalog stock levels dynamically: revert old items sold, apply new items sold!
    setProducts(products.map(prod => {
      let updatedStock = prod.stock;

      const oldItem = originalTx.items.find(item => item.productId === prod.id);
      if (oldItem) {
        updatedStock += oldItem.quantity;
      }

      const newItem = items.find(item => item.productId === prod.id);
      if (newItem) {
        updatedStock -= newItem.quantity;
      }

      return {
        ...prod,
        stock: updatedStock
      };
    }));

    setTransactions(transactions.map(t => {
      if (t.id === id) {
        return {
          ...t,
          ...updatedFields,
          total,
          dueBalance,
          status
        };
      }
      return t;
    }));

    triggerNotification(`Invoice ${originalTx.invoiceNo} successfully updated and stock reconciled.`);
  };

  // -----------------------------------------------------------------
  // 4. EXPENSE MANAGER WORKSPACE
  // -----------------------------------------------------------------
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Others");
  const [expenseCategories, setExpenseCategories] = useState<string[]>(["Rent", "Electricity", "Salary", "Marketing", "Others"]);
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
  const [isClassifying, setIsClassifying] = useState(false);

  // Expense Date Range States
  const [expenseDateFilter, _setExpenseDateFilter] = useState<"today" | "weekly" | "monthly" | "yearly" | "all" | "custom">(() => {
    const saved = localStorage.getItem(getDbKey("barakah_expense_date_filter"));
    if (saved === "today" || saved === "weekly" || saved === "monthly" || saved === "yearly" || saved === "all" || saved === "custom") {
      return saved as any;
    }
    return "all";
  });
  const setExpenseDateFilter = (val: "today" | "weekly" | "monthly" | "yearly" | "all" | "custom") => {
    _setExpenseDateFilter(val);
    localStorage.setItem(getDbKey("barakah_expense_date_filter"), val);
  };

  const [expenseCustomStart, _setExpenseCustomStart] = useState<string>(() => {
    return localStorage.getItem(getDbKey("barakah_expense_custom_start")) || new Date().toISOString().split("T")[0];
  });
  const setExpenseCustomStart = (val: string) => {
    _setExpenseCustomStart(val);
    localStorage.setItem(getDbKey("barakah_expense_custom_start"), val);
  };

  const [expenseCustomEnd, _setExpenseCustomEnd] = useState<string>(() => {
    return localStorage.getItem(getDbKey("barakah_expense_custom_end")) || new Date().toISOString().split("T")[0];
  });
  const setExpenseCustomEnd = (val: string) => {
    _setExpenseCustomEnd(val);
    localStorage.setItem(getDbKey("barakah_expense_custom_end"), val);
  };

  // Edit Expense States
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editExpenseDesc, setEditExpenseDesc] = useState("");
  const [editExpenseCategory, setEditExpenseCategory] = useState("Others");
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [editExpenseDate, setEditExpenseDate] = useState("");

  const checkExpenseDateInFilter = (dateStr: string) => {
    try {
      if (!dateStr) return false;
      const targetDate = new Date(dateStr);
      const targetTime = targetDate.getTime();
      
      const today = new Date();
      if (expenseDateFilter === "all") return true;
      if (expenseDateFilter === "today") {
        return targetDate.toDateString() === today.toDateString();
      }
      if (expenseDateFilter === "weekly") {
        const check7DaysAgo = new Date();
        check7DaysAgo.setDate(today.getDate() - 7);
        const tDate = new Date(dateStr + "T00:00:00");
        const midnightToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7, 0, 0, 0);
        return tDate.getTime() >= sevenDaysAgo.getTime() && tDate.getTime() <= midnightToday.getTime();
      }
      if (expenseDateFilter === "monthly") {
        return targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear();
      }
      if (expenseDateFilter === "yearly") {
        return targetDate.getFullYear() === today.getFullYear();
      }
      if (expenseDateFilter === "custom") {
        const start = new Date(expenseCustomStart + "T00:00:00");
        const end = new Date(expenseCustomEnd + "T23:59:59");
        const currentTarget = new Date(dateStr + "T12:00:00");
        return currentTarget.getTime() >= start.getTime() && currentTarget.getTime() <= end.getTime();
      }
      return true;
    } catch (e) {
      return true;
    }
  };

  const handleUpdateExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !editExpenseDesc || !editExpenseAmount) return;

    const updatedExp: Expense = {
      ...editingExpense,
      description: editExpenseDesc.trim(),
      category: editExpenseCategory,
      amount: Number(editExpenseAmount) || 0,
      date: editExpenseDate
    };

    setExpenses(prev => prev.map(item => item.id === editingExpense.id ? updatedExp : item));
    setEditingExpense(null);
    setEditExpenseDesc("");
    setEditExpenseCategory("Others");
    setEditExpenseAmount("");
    setEditExpenseDate("");
    triggerNotification("Business expense item successfully updated!");
  };

  // Combine standard default list alongside any category names extracted from already saved records
  const allCategories = Array.from(new Set([
    ...expenseCategories,
    ...expenses.map(e => e.category).filter(Boolean)
  ]));

  // Suggest expense category intelligently using AI proxy pipeline
  const fetchAISuggestedCategory = async () => {
    if (!expenseDesc.trim()) {
      triggerNotification("Please enter expense description.", "info");
      return;
    }
    setIsClassifying(true);
    const result = await suggestExpenseCategory(expenseDesc);
    setIsClassifying(false);
    if (result) {
      if (!allCategories.includes(result)) {
        setExpenseCategories(prev => [...prev, result]);
      }
      setExpenseCategory(result);
      setIsAddingCustomCategory(false);
      triggerNotification(`AI categorized expense as: ${result}`);
    } else {
      setExpenseCategory("Others");
      triggerNotification("AI mapping complete");
    }
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
    triggerNotification(`Supplier [${supplier.name}] added successfully!`, "success");
    return newId;
  };

  // -----------------------------------------------------------------
  // 5. CONTACTS CRM WORKSPACE
  // -----------------------------------------------------------------
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cAddress, setCAddress] = useState("");
  const [cType, setCType] = useState<"customer" | "supplier">("customer");
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

  const translateContactFields = async (customName?: string, customPhone?: string, customAddress?: string): Promise<{ name: string; phone: string; address: string } | null> => {
    const targetName = customName ?? cName;
    const targetPhone = banglaToEnglishDigits(customPhone ?? cPhone).replace(/[^0-9]/g, "");
    const targetAddress = customAddress ?? cAddress;

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

  const runTranslationForUI = async () => {
    const result = await translateContactFields();
    if (result) {
      setCName(result.name);
      setCPhone(result.phone);
      setCAddress(result.address);
      triggerNotification("✨ সফলভাবে বাংলায় লিখিত কাস্টমার কার্ড English-এ নির্ভুল অনুবাদ করা হয়েছে!", "success");
    } else {
      triggerNotification("অনুবাদ সম্পন্ন করা যায়নি। অনুগ্রহ করে ম্যানুয়ালি চেক করুন।", "error");
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName || !cPhone) return;
    
    // Convert any Bangla digits in the phone input
    let cleanPhone = banglaToEnglishDigits(cPhone).replace(/[^0-9]/g, "");
    
    // Enforce Bangladeshi mobile phone number: must be exactly 11 digits
    if (cleanPhone.length !== 11) {
      triggerNotification("⚠️ বাংলাদেশের মোবাইল ফোন নাম্বার অবশ্যই ১১ ডিজিটের হতে হবে! আপনারটি " + cleanPhone.length + " ডিজিট।", "error");
      return;
    }

    let finalName = cName.trim();
    let finalPhone = cleanPhone;
    let finalAddress = cAddress.trim();

    // If there is any Bengali character input in Name or Address, automatically translate it perfectly using Gemini!
    if (hasBengaliCharacters(finalName) || hasBengaliCharacters(finalAddress)) {
      triggerNotification("🔄 বাংলা লেখা সনাক্ত হয়েছে! নিখুঁত ও প্রপার ইংরেজি অনুবাদ করা হচ্ছে...", "info");
      const translated = await translateContactFields(finalName, finalPhone, finalAddress);
      if (translated) {
        finalName = translated.name;
        finalPhone = translated.phone;
        finalAddress = translated.address;
      }
    }

    const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();

    if (editingContact) {
      // Inline update of current client profile
      const updated = contacts.map(c => {
        if (c.id === editingContact.id) {
          return {
            ...c,
            name: finalName,
            phone: finalPhone,
            address: finalAddress || "Dhaka, Bangladesh",
            type: cType
          };
        }
        return c;
      });
      setContacts(updated);
      setEditingContact(null);
      setCName("");
      setCPhone("");
      setCAddress("");
      triggerNotification(`Contact [${finalName}] updated successfully in proper English!`, "success");
    } else {
      // Create new profile record
      const newContact: Contact = {
        id: toUUID(`c_${Date.now()}`, cleanEmail),
        name: finalName,
        phone: finalPhone,
        address: finalAddress || "Dhaka, Bangladesh",
        type: cType,
        created_at: new Date().toISOString()
      };

      setContacts([newContact, ...contacts]);
      setCName("");
      setCPhone("");
      setCAddress("");
      triggerNotification(`Contact [${finalName}] successfully registered in standard English!`, "success");
    }
  };

  const handleCopyReceipt = (pur: Purchase) => {
    const due = pur.dueAmount ?? 0;
    const isFullyPaid = due <= 0;
    const statusStr = isFullyPaid ? "[পরিশোধিত / FULLY SETTLED]" : "[আংশিক বকেয়া / OUTSTANDING DUE]";
    
    const text = `
------------------------------------------
   ${businessInfo.name}
   সাপ্লায়ার বকেয়া পরিশোধ রসিদ
   Supplier Due Payment Receipt
------------------------------------------
তারিখ / Date: ${format(new Date(pur.date), "dd MMMM, yyyy")}
মেমো নং / Voucher No: ${pur.invoiceNo || "N/A"}
সাপ্লায়ার / Supplier: ${pur.supplierName}

পণ্য / Items: ${pur.productName}
পরিমাণ / Qty: ${pur.quantity} pcs
ক্রয়মূল্য / Buy Rate: ${businessInfo.currencySymbol} ${(pur.buyPrice || 0).toLocaleString()} /unit
মোট ক্রয়ের পরিমাণ / Total: ${businessInfo.currencySymbol} ${pur.totalAmount.toLocaleString()}

------------------------------------------
লেনদেন সারাংশ (Ledger Summary):
মোট বিল / Net Total: ${businessInfo.currencySymbol} ${pur.totalAmount.toLocaleString()}
পরিশোধিত / Cash Paid: ${businessInfo.currencySymbol} ${(pur.cashPaid || 0).toLocaleString()}
বকেয়া / Outstanding Due: ${businessInfo.currencySymbol} ${due.toLocaleString()} 
অবস্থা / Status : ${statusStr}

ধন্যবাদান্তে,
${businessInfo.name}
ফোন: ${businessInfo.phone || "N/A"}
ঠিকানা: ${businessInfo.address || "N/A"}
------------------------------------------
`.trim();

    navigator.clipboard.writeText(text);
    triggerNotification("Receipt summary copied successfully!", "success");
  };

  const handleWhatsAppShare = (pur: Purchase) => {
    const due = pur.dueAmount ?? 0;
    const isFullyPaid = due <= 0;
    const statusStr = isFullyPaid ? "✅ পরিশোধিত / FULLY SETTLED" : "⚠️ বকেয়া / OUTSTANDING DUE";
    
    const text = `*${businessInfo.name}*
*সাপ্লায়ার বকেয়া পরিশোধ রসিদ / Supplier Receipt*
----------------------------------------
*তারিখ/Date:* ${format(new Date(pur.date), "dd MMMM, yyyy")}
*মেমো নং/Voucher:* ${pur.invoiceNo || "N/A"}
*সাপ্লায়ার/Supplier:* ${pur.supplierName}

*আইটেম/Item:* ${pur.productName}
*পরিমাণ/Qty:* ${pur.quantity} pcs @ ${businessInfo.currencySymbol}${pur.buyPrice.toLocaleString()}
*মোট মূল্য/Total Amount:* ${businessInfo.currencySymbol}${pur.totalAmount.toLocaleString()}

----------------------------------------
📊 *লেনদেন বিবরণী (Ledger):*
*মোট বিল/Net Total:* ${businessInfo.currencySymbol}${pur.totalAmount.toLocaleString()}
*পরিশোধিত/Cash Paid:* ${businessInfo.currencySymbol}${(pur.cashPaid || 0).toLocaleString()}
*বকেয়া/Due Balance:* ${businessInfo.currencySymbol}${due.toLocaleString()}
*অবস্থা/Status:* ${statusStr}

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
    const statusStr = isFullyPaid ? "FULLY SETTLED (পরিশোধিত)" : "OUTSTANDING DUE (বকেয়া)";
    
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
            <div style="font-size: 11px;">সরবরাহকারী পেমেন্ট ও বকেয়া রসিদ</div>
          </div>
          
          <div class="meta-row">
            <span>Date / তারিখ:</span>
            <span>${format(new Date(pur.date), "dd-MM-yyyy HH:mm")}</span>
          </div>
          <div class="meta-row">
            <span>Voucher / মেমো নং:</span>
            <span>${pur.invoiceNo || "N/A"}</span>
          </div>
          <div class="meta-row">
            <span>Supplier / সরবরাহকারী:</span>
            <span><strong>${pur.supplierName}</strong></span>
          </div>
          
          <div class="divider"></div>
          
          <div class="product-title">Item Details / বিবরণ:</div>
          <div class="meta-row font-bold">
            <span>${pur.productName}</span>
            <span>${pur.quantity} pcs</span>
          </div>
          <div class="meta-row" style="font-size: 12px; color: #555;">
            <span>Rate / ক্রয়মূল্য:</span>
            <span>${businessInfo.currencySymbol} ${(pur.buyPrice || 0).toLocaleString()} /unit</span>
          </div>
          
          <div class="divider"></div>
          
          <div class="ledger-row">
            <span>Net Total Amount / মোট বিল:</span>
            <span>${businessInfo.currencySymbol} ${pur.totalAmount.toLocaleString()}</span>
          </div>
          <div class="ledger-row">
            <span>Cash Paid / মোট পরিশোধ:</span>
            <span>${businessInfo.currencySymbol} ${(pur.cashPaid || 0).toLocaleString()}</span>
          </div>
          
          <div class="ledger-row ledger-row-bold">
            <span>Outstanding Due / বকেয়া:</span>
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
  const [dashboardFilter, _setDashboardFilter] = useState<"today" | "weekly" | "monthly" | "yearly" | "all" | "custom">(() => {
    const saved = localStorage.getItem(getDbKey("barakah_dashboard_filter"));
    if (saved === "today" || saved === "weekly" || saved === "monthly" || saved === "yearly" || saved === "all" || saved === "custom") {
      return saved as any;
    }
    return "all";
  });
  const setDashboardFilter = (val: "today" | "weekly" | "monthly" | "yearly" | "all" | "custom") => {
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
      const targetDate = new Date(dateStr);
      const targetTime = targetDate.getTime();
      
      const today = new Date();
      if (dashboardFilter === "all") return true;
      if (dashboardFilter === "today") {
        return targetDate.toDateString() === today.toDateString();
      }
      if (dashboardFilter === "weekly") {
        const check7DaysAgo = new Date();
        check7DaysAgo.setDate(today.getDate() - 7);
        return targetTime >= check7DaysAgo.getTime() && targetTime <= today.getTime();
      }
      if (dashboardFilter === "monthly") {
        return targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear();
      }
      if (dashboardFilter === "yearly") {
        return targetDate.getFullYear() === today.getFullYear();
      }
      if (dashboardFilter === "custom") {
        const start = new Date(customStart + "T00:00:00");
        const end = new Date(customEnd + "T23:59:59");
        return targetTime >= start.getTime() && targetTime <= end.getTime();
      }
      return true;
    } catch (e) {
      return true;
    }
  };

  const filteredDashboardTx = transactions.filter(t => checkDateInFilter(t.date));
  const filteredDashboardExpenses = expenses.filter(e => checkDateInFilter(e.date));
  const filteredDashboardPurchases = purchases.filter(p => checkDateInFilter(p.date));

  // Calculations for financial dashboard
  const totalSalesTk = filteredDashboardTx.reduce((sum, t) => sum + t.total, 0);
  const totalOutstandingDueTk = filteredDashboardTx.reduce((sum, t) => sum + t.dueBalance, 0);
  const totalExpensesTk = filteredDashboardExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPurchasesTk = filteredDashboardPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
  
  // Calculate total individual units of products sold
  const totalUnitsSold = filteredDashboardTx.reduce((sum, t) => {
    const itemQty = t.items ? t.items.reduce((innerSum, item) => innerSum + Number(item.quantity ?? 0), 0) : 0;
    return sum + itemQty;
  }, 0);
  
  // Calculate total costs of items checkout to plot pure visual profit margins
  const totalDuesActiveState = totalOutstandingDueTk;
  const netEarningsReceived = totalSalesTk - totalOutstandingDueTk;
  
  // Exact COGS calculation using matching products buy price, preferring actual catalog prices
  let totalCostOfGoodsSold = 0;
  filteredDashboardTx.forEach(t => {
    t.items.forEach(item => {
      const dbProduct = products.find(p => p.id === item.productId || p.id === item.id || p.name === item.name);
      let buyCost = 0;
      if (dbProduct && dbProduct.buyPrice > 0) {
        buyCost = dbProduct.buyPrice;
      } else if (item.buyPrice && item.buyPrice > 0) {
        buyCost = item.buyPrice;
      } else if (dbProduct) {
        buyCost = dbProduct.buyPrice;
      } else if (item.buyPrice !== undefined) {
        buyCost = item.buyPrice;
      } else {
        buyCost = item.price * 0.70;
      }
      totalCostOfGoodsSold += buyCost * item.quantity;
    });
  });

  const netProfitAmt = Math.round(totalSalesTk - totalCostOfGoodsSold - totalExpensesTk);
  
  // Backward compatibility variables for render blocks
  const projectedProductSellTotal = totalSalesTk;
  const projectedProductProfit = totalSalesTk - totalCostOfGoodsSold;
  const projectedNetTerminalProfit = netProfitAmt;

  // Filter lists dynamically
  const purchasedProductIds = new Set(purchases.filter(pur => (pur.quantity || 0) > 0).map(pur => pur.productId).filter(Boolean));

  const filteredProducts = products.filter(p => {
    // Only display products bought from a supplier (exists in purchases with qty > 0)
    if (!purchasedProductIds.has(p.id)) return false;

    const query = inventorySearch.toLowerCase().trim();
    if (!query) return true;
    const searchTerms = query.split(/\s+/);
    const targetString = `${p.name} ${p.sku} ${p.category}`.toLowerCase();
    return searchTerms.every(term => targetString.includes(term));
  });

  const filteredTransactions = transactions.filter(t => {
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
  });

  // Recharts analytic plot models 
  const ledgerTrendsPlotData = transactions.slice().reverse().map(t => {
    try {
      return {
        date: format(new Date(t.date), "dd MMM"),
        "Sales Value": t.total,
        "Cash Received": t.paidAmount
      };
    } catch (e) {
      return { date: "Slip Date", "Sales Value": t.total, "Cash Received": t.paidAmount };
    }
  });

  const expenseCategoryPlotData = Object.entries(
    expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];

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

  if (currentPanel === "none") {
    return (
      <PanelGateLock
        adminPasscode={businessInfo.adminPasscode || "1234"}
        salesPasscode={businessInfo.salesPasscode || "5555"}
        isGuest={!!activeUser?.isGuest}
        isDarkMode={isDarkMode}
        onUnlock={(panel) => {
          setCurrentPanel(panel);
          setActiveTab(panel === "sales" ? "pos" : "dashboard");
          triggerNotification(`${panel === 'admin' ? 'Admin Panel' : 'Sales Panel'} accessible successfully`, "success");
        }}
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
                <button
                  id="tab-dashboard-btn"
                  onClick={() => setActiveTab("dashboard")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'dashboard' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </button>

                <button
                  id="tab-pos-btn"
                  onClick={() => setActiveTab("pos")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'pos' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Sales / POS
                </button>

                <button
                  id="tab-contacts-btn"
                  onClick={() => setActiveTab("contacts")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'contacts' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <Users className="w-4 h-4" />
                  Customers & CRM
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
                  id="tab-negative-sales-btn"
                  onClick={() => setActiveTab("negative-sales")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'negative-sales' ? 'bg-[#FF5252]/10 text-[#FF5252] border border-[#FF5252]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <TrendingDown className="w-4 h-4" />
                  Negative Stock Log
                </button>

                <button
                  id="tab-purchases-btn"
                  onClick={() => setActiveTab("purchases")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'purchases' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <PlusCircle className="w-4 h-4" />
                  Purchases
                </button>

                <button
                  id="tab-inventory-btn"
                  onClick={() => setActiveTab("inventory")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'inventory' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <Bookmark className="w-4 h-4" />
                  Stock Management
                </button>

                <button
                  id="tab-duelist-btn"
                  onClick={() => setActiveTab("duelist")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'duelist' ? 'bg-amber-500/10 text-amber-400 border border-amber-550/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <History className="w-4 h-4" />
                  Due List
                </button>

                <button
                  id="tab-ledger-btn"
                  onClick={() => setActiveTab("ledger")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'ledger' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <FileText className="w-4 h-4" />
                  Transactions & Ledger
                </button>

                <button
                  id="tab-expenses-btn"
                  onClick={() => setActiveTab("expenses")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'expenses' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <PiggyBank className="w-4 h-4" />
                  Expenses Ledger
                </button>

                <button
                  id="tab-reports-btn"
                  onClick={() => setActiveTab("reports")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'reports' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Reports Dashboard
                </button>

                <button
                  id="tab-staff-btn"
                  onClick={() => setActiveTab("staff")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'staff' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <UserCheck className="w-4 h-4" />
                  Staff Management
                </button>

                <p className="text-[10px] uppercase font-mono tracking-widest text-[#A0A0A5] pl-1.5 mt-4 mb-2 font-bold">Configs</p>

                <button
                  id="tab-settings-btn"
                  onClick={() => setActiveTab("settings")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'settings' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              </>
            ) : (
              <>
                <button
                  id="tab-pos-btn"
                  onClick={() => setActiveTab("pos")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'pos' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  Sales / POS
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
                  View Products
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
                {activeTab === 'dashboard' && <span className="hidden md:inline">Dashboard</span>}
                {activeTab === 'reports' && 'Reports Dashboard'}
                {activeTab === 'products' && 'Product Settings'}
                {activeTab === 'negative-sales' && 'Negative Stock Log'}
                {activeTab === 'purchases' && 'Purchases Ledger'}
                {activeTab === "pos" && "Counter Cash Memo"}
                {activeTab === 'inventory' && 'Stock Management'}
                {activeTab === 'ledger' && 'Account Ledger'}
                {activeTab === 'expenses' && 'Expenses Ledger'}
                {activeTab === 'contacts' && 'Customers Directory'}
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

          <div className="flex items-center gap-2 md:gap-3 shrink-0" id="top-navbar-actions">
            
             {/* Sync Cloud Button (For registered users) */}
             {activeUser && !activeUser.isGuest && (
               <div className="flex gap-1 bg-[#121214]/60 p-1 border border-slate-800/80 rounded-xl">
                 <button
                   id="manual-backup-cloud-btn"
                   onClick={triggerCloudBackupSync}
                   disabled={isBackingUp || isRestoring}
                   className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:bg-slate-900 rounded-lg text-[10px] md:text-xs font-mono font-bold tracking-wide transition-colors cursor-pointer"
                   title="Sync local data up to cloud"
                 >
                   {isBackingUp ? (
                     <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                   ) : (
                     <>
                       <CloudUpload className="w-3.5 h-3.5 text-emerald-400" />
                       <span className="hidden lg:inline">{activeUser.isPasscodeUser ? "Sync PIN" : "Sync Cloud"}</span>
                     </>
                   )}
                 </button>

                 <button
                   id="manual-restore-cloud-btn"
                   onClick={triggerCloudBackupRestore}
                   disabled={isBackingUp || isRestoring}
                   className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 disabled:bg-slate-900 rounded-lg text-[10px] md:text-xs font-mono font-bold tracking-wide transition-colors cursor-pointer"
                   title="Restore backup down from cloud"
                 >
                   {isRestoring ? (
                     <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                   ) : (
                     <>
                       <CloudDownload className="w-3.5 h-3.5 text-sky-400" />
                       <span className="hidden lg:inline">{activeUser.isPasscodeUser ? "Restore PIN" : "Restore Cloud"}</span>
                     </>
                   )}
                 </button>
               </div>
             )}

            {/* Offline Engine status dot indicator */}
            {/* Global theme dark/light toggle button */}
            <button
              id="global-theme-toggle"
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="flex items-center justify-center p-2.5 bg-[#050912]/80 hover:bg-slate-800/80 text-white rounded-xl border border-slate-800 hover:border-slate-700 hover:text-emerald-400 transition-all cursor-pointer shadow-sm h-8.5 w-8.5"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[#00E676]" />
              )}
            </button>

            {activeUser && !activeUser.isGuest && (
              <div 
                id="cloud-sync-status-indicator"
                className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[9px] md:text-[10px] font-mono font-bold shadow-sm transition-all duration-300 ${
                  syncStatus === "connected" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                  syncStatus === "reconciling" ? "bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse" :
                  syncStatus === "connecting" ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400 animate-pulse" :
                  syncStatus === "error" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                  "bg-slate-500/10 border-slate-800 text-slate-400"
                }`}
                title={
                  syncStatus === "connected" ? "Your local device is connected and up-to-date with cloud" :
                  syncStatus === "reconciling" ? "Reconciling live data with cloud document..." :
                  syncStatus === "connecting" ? "Connecting to secure live cloud stream..." :
                  syncStatus === "error" ? "Cloud connection interrupted / unauthorized" :
                  "Cloud sync is offline"
                }
              >
                {syncStatus === "connected" && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="hidden sm:inline">CLOUD: SYNCED</span>
                    <span className="sm:hidden">CLOUD: OK</span>
                  </>
                )}
                {syncStatus === "reconciling" && (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-500" />
                    <span className="hidden sm:inline">CLOUD: RECONCILING</span>
                    <span className="sm:hidden">CLOUD: SYNC</span>
                  </>
                )}
                {syncStatus === "connecting" && (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-yellow-400" />
                    <span className="hidden sm:inline">CLOUD: CONNECTING</span>
                    <span className="sm:hidden">CLOUD: CONN</span>
                  </>
                )}
                {syncStatus === "error" && (
                  <>
                    <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                    <span className="hidden sm:inline">CLOUD: ERR</span>
                    <span className="sm:hidden">CLOUD: ERR</span>
                  </>
                )}
                {syncStatus === "offline" && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    <span>CLOUD: OFFLINE</span>
                  </>
                )}
              </div>
            )}

            <div className="bg-[#050912]/80 border border-slate-800 rounded-xl px-2 py-1 flex items-center gap-1.5 font-mono text-[9px] md:text-[10px]" id="engine-status">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-400 font-mono hidden md:inline">OFFLINE CORE: OK</span>
              <span className="text-emerald-400 font-mono md:hidden font-bold">OK</span>
            </div>

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
              className={`p-4 rounded-xl shadow-lg border animate-slideIn flex items-center justify-between text-xs font-medium relative overflow-hidden ${
                notification.type === "success" 
                  ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-400" 
                  : notification.type === "error" 
                    ? "bg-rose-950/40 border-rose-500/20 text-rose-400" 
                    : "bg-slate-900 border-slate-800 text-slate-300"
              }`}
              id="dynamic-toast-message"
            >
              <div className="flex items-center gap-2.5">
                {notification.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                <span>{notification.message}</span>
              </div>
            </div>
          )}

          {/* -------------------- VIEW 0: BUSINESS DASHBOARD & PERIOD FILTERS -------------------- */}
          {activeTab === "dashboard" && (
            <DashboardView
              businessInfo={businessInfo}
              isBackingUp={isBackingUp}
              isRestoring={isRestoring}
              triggerCloudBackupSync={triggerCloudBackupSync}
              triggerCloudBackupRestore={triggerCloudBackupRestore}
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
              purchases={purchases}
              contacts={contacts}
              businessInfo={businessInfo}
              currencySymbol={businessInfo.currencySymbol || "৳"}
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
                    onClick={() => setPosTerminalTab("checkout")}
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
                <div className="bg-[#1E1E24] border border-[#2D2D35] p-6 rounded-2xl space-y-4 shadow-lg" id="pos-product-picker-pnl">
                  <div className="flex items-center gap-2 border-b border-[#2D2D35] pb-3">
                    <span className="w-5 h-5 rounded-lg bg-[#00E676]/10 text-[#00E676] flex items-center justify-center font-bold text-xs">1</span>
                    <h3 className="text-sm font-bold text-white tracking-wide">Select Item & Add to Basket</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end" id="product-picker-inputs">
                    
                     <div className="col-span-1 md:col-span-5 space-y-1.5 relative text-left" id="pos-select-wrap">
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
                          <div className="fixed inset-0 z-40" onClick={() => setShowSuggestions(false)} />
                          <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto bg-[#1E1E24] border border-[#2D2D35] rounded-xl shadow-2xl p-1.5 divide-y divide-[#2D2D35]/30 scrollbar-thin scrollbar-thumb-slate-700 font-sans">
                            {(() => {
                              const term = posSearchQuery.toLowerCase().trim();
                              const filtered = products.filter(p => {
                                if (!term) return true;
                                const searchWords = term.split(/\s+/);
                                const target = `${p.name} ${p.sku} ${p.category}`.toLowerCase();
                                return searchWords.every(word => target.includes(word));
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
                <div className="bg-[#1E1E24] border border-[#2D2D35] rounded-2xl overflow-hidden shadow-lg" id="pos-cart-list-pnl">
                  <div className="p-4 bg-[#121214]/50 border-b border-[#2D2D35] flex items-center justify-between" id="pos-cart-header">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-lg bg-[#00E676]/10 text-[#00E676] flex items-center justify-center font-bold text-xs">2</span>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Active Cart Items</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#00E676] font-bold bg-[#00E676]/10 px-2.5 py-1 rounded-full border border-[#00E676]/20">
                      {posCart.length} item lines
                    </span>
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
                      onChange={(e) => setPosSelectedContactId(e.target.value)}
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
                triggerNotification(`${parsedProduct.name} added to the inventory catalog successfully.`);
              }}
              onUpdateProduct={(updatedProd) => {
                setProducts(products.map(p => p.id === updatedProd.id ? { ...p, ...updatedProd } : p));
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
            <div className="space-y-6 animate-fadeIn" id="view-inventory-container">
              
              {/* STOCKS STATS / KPI OVERVIEW DETAILS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="stock-valuation-summary-cards">
                
                {/* CARD 1: TOTAL STOCK VALUE VALUATION */}
                <div className="bg-gradient-to-br from-[#0c142c] to-[#0a101f] border border-emerald-500/20 p-5 rounded-2xl relative overflow-hidden shadow-lg flex flex-col justify-between" id="card-total-stock-asset">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono">Stock Asset Valuation</span>
                    <Coins className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black font-mono text-white tracking-tight">
                      {businessInfo.currencySymbol} {products.filter(p => purchasedProductIds.has(p.id)).reduce((acc, p) => acc + (p.stock > 0 ? (p.stock * p.buyPrice) : 0), 0).toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 font-sans leading-relaxed">
                      Total cost basis of remaining physical inventory stocks. Selling items dynamically reduces both physical count and asset value automatically on the database server.
                    </p>
                  </div>
                </div>

                {/* CARD 2: ACTIVE STOCKS */}
                <div className="bg-gradient-to-br from-[#0c142c] to-[#0a101f] border border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-lg flex flex-col justify-between" id="card-stock-quantity-tracker">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Active Stocks</span>
                    <Layers className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black font-mono text-white tracking-tight flex items-baseline gap-2">
                      <span>{products.filter(p => purchasedProductIds.has(p.id) && p.stock > 0).length}</span>
                      <span className="text-xs text-slate-500 font-medium font-sans">In-Stock Products</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1.5 font-sans leading-relaxed">
                      Total quantity: <span className="font-bold text-white font-mono">{products.filter(p => purchasedProductIds.has(p.id)).reduce((acc, p) => acc + (p.stock > 0 ? p.stock : 0), 0)}</span> units currently across stock items.
                    </p>
                  </div>
                </div>

                {/* CARD 3: SUPPLIER UNPAID BILLS DUES TRACKER */}
                <div className="bg-gradient-to-br from-[#0c142c] to-[#0a101f] border border-amber-500/20 p-5 rounded-2xl relative overflow-hidden shadow-lg flex flex-col justify-between" id="card-supplier-dues-tracker">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/15 rounded-full blur-3xl -mr-10 -mt-10" />
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 font-mono">Supplier Credit Owed</span>
                    <ShoppingBag className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black font-mono text-amber-400 tracking-tight">
                      {businessInfo.currencySymbol} {purchases.reduce((acc, pur) => acc + (pur.dueAmount || 0), 0).toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 font-sans leading-relaxed">
                      Outstanding balance remaining for credit-based purchase invoices. Handled easily by clicking the "Settle Due" buttons on the Supplier ledger.
                    </p>
                  </div>
                </div>

              </div>

              {/* TRI-MODULE TAB SELECTOR BAR */}
              <div className="flex gap-2 border-b border-slate-900 pb-1" id="stock-inner-tab-header">
                <button 
                  onClick={() => setStockSubTab("catalog")}
                  className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${stockSubTab === 'catalog' ? 'bg-[#00E676]/10 text-[#00E676] border-t-2 border-l border-r border-slate-800 border-t-[#00E676]' : 'text-slate-400 hover:text-white hover:bg-slate-900 border-t-2 border-transparent'}`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Stock Inventory Catalog & Valuations</span>
                </button>
                <button 
                  onClick={() => setStockSubTab("supplier-bills")}
                  className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${stockSubTab === 'supplier-bills' ? 'bg-[#00E676]/10 text-[#00E676] border-t-2 border-l border-r border-slate-800 border-t-[#00E676]' : 'text-slate-400 hover:text-white hover:bg-slate-900 border-t-2 border-transparent'}`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Supplier Cash & Credit Ledger</span>
                </button>
                <button 
                  onClick={() => setStockSubTab("due-list")}
                  className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${stockSubTab === 'due-list' ? 'bg-[#00E676]/10 text-[#00E676] border-t-2 border-l border-r border-[#00E676]/20 border-t-[#00E676]' : 'text-slate-400 hover:text-white hover:bg-slate-900 border-t-2 border-transparent'}`}
                >
                  <FileText className="w-3.5 h-3.5 text-rose-450 animate-pulse" />
                  <span>Supplier Items Due List</span>
                </button>
              </div>

              {stockSubTab === "catalog" && (
                <div className="space-y-6 animate-slideDown" id="stock-catalog-rendered-view">
                  {/* Top inventory control search bar */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-[#0a101f]/80 border border-slate-800 rounded-2xl" id="inventory-toolbar">
                    <div className="relative w-full md:w-80" id="inventory-search-wrap">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                      <input
                        type="text"
                        id="inventory-search-input"
                        placeholder="Filter stock by product name or SKU..."
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        className="w-full px-3 py-2 pl-9 bg-[#050912] border border-slate-800 rounded-xl text-slate-200 text-xs outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div className="text-xs text-slate-400 font-mono" id="inventory-stats-sub">
                      Total Catalog Stock Items: <span className="text-white font-bold">{filteredProducts.length}</span> items
                    </div>
                  </div>

                  {/* Catalog Tables layout (Now Full Width - w-full, no registration forms) */}
                  <div className="w-full bg-[#0a101f]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-md font-sans" id="inventory-list-panel">
                    <div className="p-4 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between" id="catalog-list-header">
                      <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        Physical Stock Inventory Catalog & Real-Time Rates
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Total Recorded Products: {filteredProducts.length}</span>
                    </div>

                    <div className="overflow-x-auto" id="inventory-table-scroll">
                      <table className="w-full text-[#A0A0A5] text-xs">
                        <thead>
                          <tr className="bg-slate-955/40 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                            <th className="py-2.5 px-4 text-left">SKU</th>
                            <th className="py-2.5 px-4 text-left">Product Name</th>
                            <th className="py-2.5 px-4 text-left">Category</th>
                            <th className="py-2.5 px-4 text-right">Cost Rate (Buy)</th>
                            <th className="py-2.5 px-4 text-right">Selling Price (Sell)</th>
                            <th className="py-2.5 px-4 text-center">In-Stock Quantity</th>
                            <th className="py-2.5 px-4 text-right border-l border-slate-850">Stock Valuation</th>
                            <th className="py-2.5 px-4 text-center">Restock (+10)</th>
                            <th className="py-2.5 px-4 text-center">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                          {filteredProducts.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                                No catalog stock items registered. Log new purchases or register items in the "Products" control screen.
                              </td>
                            </tr>
                          ) : (
                            filteredProducts.map((p) => {
                              const stockWorth = p.stock > 0 ? (p.stock * p.buyPrice) : 0;
                              return (
                                <tr key={p.id} className="hover:bg-slate-900/10 text-slate-300">
                                  <td className="py-3 px-4 font-mono font-bold text-slate-500 text-[10px]">{p.sku}</td>
                                  <td className="py-3 px-4 font-semibold text-white font-sans truncate max-w-[150px]" title={p.name}>{p.name}</td>
                                  <td className="py-3 px-4 font-sans"><span className="text-[9px] font-medium bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full text-slate-400">{p.category}</span></td>
                                  <td className="py-3 px-4 text-right">{businessInfo.currencySymbol} {p.buyPrice}</td>
                                  <td className="py-3 px-4 text-right text-emerald-400 font-medium">{businessInfo.currencySymbol} {p.sellPrice}</td>
                                  <td className="py-3 px-4 text-center">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                      {p.stock} {p.unit}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right text-white font-bold bg-slate-950/10 border-l border-slate-850">
                                    {businessInfo.currencySymbol} {stockWorth.toLocaleString()}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <button
                                      id={`quick-restock-${p.id}`}
                                      onClick={() => incrementProductStock(p.id)}
                                      className="px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-emerald-450 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded hover:border-emerald-500 transition-colors cursor-pointer"
                                    >
                                      +10
                                    </button>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <button
                                      id={`delete-product-${p.id}`}
                                      onClick={() => handleDeleteProduct(p.id, p.name)}
                                      className="p-1 hover:bg-slate-900 rounded text-rose-400 hover:text-white transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                  </div>
                </div>
              )}

              {stockSubTab === "supplier-bills" && (
                /* SUPPLIER PURCHASES LEDGER WITH CASH CODE & DUE BILL TRACKING */
                <div className="bg-[#0a101f]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg animate-slideDown" id="supplier-purchases-subtab-rendered">
                  <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2" id="supplier-bills-ledger-top flex">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Supplier Purchase & Credit Ledger</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Total Transaction Vouchers: {purchases.length}</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead>
                        <tr className="bg-slate-955/40 border-b border-slate-800 text-[10px] uppercase font-mono tracking-wider text-slate-400">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Invoice No.</th>
                          <th className="py-3 px-4">Supplier</th>
                          <th className="py-3 px-4">Purchased Product</th>
                          <th className="py-3 px-4 text-right">Quantity (Qty)</th>
                          <th className="py-3 px-4 text-right">Unit Price</th>
                          <th className="py-3 px-4 text-right">Total Cost</th>
                          <th className="py-3 px-4 text-center">Payment Status</th>
                          <th className="py-3 px-4 text-center">Balance Settlement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50 font-mono">
                        {purchases.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                              No supplier purchase vouchers found. Log a new product batch with custom payment terms inside the "Purchases" view tab.
                            </td>
                          </tr>
                        ) : (
                          purchases.map((pur) => {
                            const isDue = (pur.dueAmount || 0) > 0;
                            const isCash = !isDue;
                            return (
                              <tr key={pur.id} className="hover:bg-slate-900/10 text-slate-300">
                                <td className="py-3.5 px-4 text-slate-400 text-[11px] font-mono">{pur.date}</td>
                                <td className="py-3.5 px-4 font-bold text-emerald-400">{pur.invoiceNo || "N/A"}</td>
                                <td className="py-3.5 px-4 font-sans text-white">{pur.supplierName || "Walk-in Supplier"}</td>
                                <td className="py-3.5 px-4 font-sans text-slate-200">{pur.productName || "Unknown Product"}</td>
                                <td className="py-3.5 px-4 text-right text-slate-400">{pur.quantity}</td>
                                <td className="py-3.5 px-4 text-right">{businessInfo.currencySymbol} {pur.buyPrice}</td>
                                <td className="py-3.5 px-4 text-right text-white font-bold">{businessInfo.currencySymbol} {pur.totalAmount.toLocaleString()}</td>
                                <td className="py-3.5 px-4 text-center">
                                  {isCash ? (
                                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full text-[9px] font-sans font-bold text-emerald-400">
                                      <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                                      Paid Cash
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-full text-[9px] font-sans font-bold text-amber-400">
                                      <span className="w-1 h-1 bg-amber-400 rounded-full" />
                                      Credit Due (Due: {businessInfo.currencySymbol} {pur.dueAmount})
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-center font-sans">
                                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                                    {isDue ? (
                                      <button
                                        onClick={() => {
                                          setPurchases(prev => prev.map(item => item.id === pur.id ? { ...item, cashPaid: item.totalAmount, dueAmount: 0 } : item));
                                          triggerNotification("Supplier due bill paid & fully settled in cash successfully! 🟢", "success");
                                        }}
                                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black rounded-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-md shadow-amber-500/5 duration-205"
                                      >
                                        Settle Due
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-slate-500 font-sans italic">Fully Settled</span>
                                    )}
                                    {pur.quantity > 0 && (
                                      <button
                                        onClick={() => {
                                          const matchedProduct = products.find(p => p.id === pur.productId);
                                          const availableStock = matchedProduct ? matchedProduct.stock : 0;
                                          const maxReturnQty = Math.min(pur.quantity, availableStock);
                                          
                                          if (maxReturnQty <= 0) {
                                            triggerNotification("Cannot return: No remaining warehouse stock left for this product!", "error");
                                            return;
                                          }
                                          
                                          const promptVal = prompt(
                                            `Enter quantity of ${pur.productName} you want to return to ${pur.supplierName || 'supplier'}.\n` +
                                            `• Purchased quantity in this batch: ${pur.quantity} pcs\n` +
                                            `• Available physical stock: ${availableStock} pcs\n` +
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
                                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-md duration-205 flex items-center gap-1 shrink-0"
                                      >
                                        <Undo2 className="w-3 h-3" />
                                        <span>ফেরত (Return)</span>
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
              )}

              {/* BRAND NEW SUPPLIER ITEMS DUE LIST & STEPWISE REPAYMENT */}
              {stockSubTab === "due-list" && (
                <div className="space-y-6 animate-slideDown" id="credit-due-list-sec">
                  <div className="p-5 bg-gradient-to-r from-slate-955 to-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4 text-rose-550" />
                        Credit-Based Purchases Due List
                      </h4>
                      <p className="text-[10px] text-slate-400 max-w-xl">
                        Tracks items purchased on credit. When a portion of the debt is repaid, the due list reflects the exact paid versus remaining quantities alongside settled visual colors.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2.5 text-xs font-mono">
                      <div className="bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl text-rose-400 flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                        <span>Unsettled: {purchases.filter(p => (p.dueAmount || 0) > 0).length}</span>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-emerald-400 flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-450" />
                        <span>Fully Paid: {purchases.filter(p => (p.originallyCredit || p.dueAmount > 0 || (p.totalAmount > (p.cashPaid || 0))) && (p.dueAmount || 0) === 0).length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full bg-[#0a101f]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg" id="due-items-registry-wrapper">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300 font-mono">
                        <thead>
                          <tr className="bg-slate-955/40 border-b border-slate-800 text-[10px] uppercase font-mono tracking-wider text-slate-400">
                            <th className="py-3 px-4">Invoice No</th>
                            <th className="py-3 px-4">Product Name</th>
                            <th className="py-3 px-4">Supplier / Vendor</th>
                            <th className="py-3 px-4 text-center">Batch Bought</th>
                            <th className="py-3 px-4 text-center">Stepwise Units Paid Progress</th>
                            <th className="py-3 px-4 text-right">Unit Price</th>
                            <th className="py-3 px-4 text-right">Total Debit</th>
                            <th className="py-3 px-4 text-right">Cash Unpaid</th>
                            <th className="py-3 px-4 text-center">Outstanding Status</th>
                            <th className="py-3 px-4 text-center">Dues Repay Adjustment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {(() => {
                            const creditPurchases = purchases.filter(p => p.originallyCredit || (p.dueAmount || 0) > 0 || (p.totalAmount > (p.cashPaid || 0)));
                            if (creditPurchases.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={10} className="py-16 text-center text-slate-500 font-sans">
                                    No recorded credit-based purchases. Start logging purchase orders under credit payments on "Purchases" to monitor outstanding items.
                                  </td>
                                </tr>
                              );
                            }

                            return creditPurchases.map((pur) => {
                              const due = pur.dueAmount || 0;
                              const isFullyPaid = due <= 0;
                              const qty = pur.quantity || 1;
                              const unitCost = pur.buyPrice || 0;

                              // Calculate equivalent paid and due items Qty
                              const paidAmt = pur.cashPaid || 0;
                              const eqPaidQty = Math.min(qty, parseFloat((paidAmt / unitCost).toFixed(2)));
                              const eqDueQty = Math.max(0, parseFloat((qty - eqPaidQty).toFixed(2)));

                              return (
                                <tr key={pur.id} className={`hover:bg-slate-900/10 text-slate-300 ${isFullyPaid ? 'bg-emerald-950/5' : ''}`}>
                                  <td className="py-4 px-4 text-emerald-400 font-bold">{pur.invoiceNo || "N/A"}</td>
                                  <td className="py-4 px-4 font-sans text-white font-semibold">
                                    {pur.productName || "Unknown Product"}
                                    <span className="block text-[9px] font-mono text-slate-500 font-normal mt-0.5">Date: {pur.date}</span>
                                  </td>
                                  <td className="py-4 px-4 font-sans text-slate-300">{pur.supplierName || "Walk-in Supplier"}</td>
                                  <td className="py-4 px-4 text-center text-slate-400 font-black">{qty} units</td>
                                  <td className="py-4 px-4 text-center font-sans mr-2">
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="flex justify-between w-28 text-[9px] text-slate-400 font-mono font-bold">
                                        <span className="text-emerald-400">Paid: {eqPaidQty}</span>
                                        <span className="text-rose-455">Due: {eqDueQty}</span>
                                      </div>
                                      <div className="w-28 h-2 bg-slate-950/80 rounded-full overflow-hidden border border-slate-900 flex">
                                        <div className="bg-emerald-500 h-full" style={{ width: `${(eqPaidQty / qty) * 100}%` }} />
                                        <div className="bg-rose-500 h-full animate-pulse" style={{ width: `${(eqDueQty / qty) * 100}%` }} />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-4 px-4 text-right text-slate-400">{businessInfo.currencySymbol} {unitCost}</td>
                                  <td className="py-4 px-4 text-right text-slate-300">{businessInfo.currencySymbol} {pur.totalAmount.toLocaleString()}</td>
                                  <td className="py-4 px-4 text-right font-bold text-rose-455">{businessInfo.currencySymbol} {due.toLocaleString()}</td>
                                  <td className="py-4 px-4 text-center font-sans">
                                    {isFullyPaid ? (
                                      <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full text-[9px] font-bold text-emerald-400 transition-colors">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full absolute" />
                                        <span>Settled Green</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/25 px-2.5 py-1 rounded-full text-[9px] font-bold text-rose-455 transition-colors animate-pulse">
                                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
                                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full absolute" />
                                        <span>Outstanding Red</span>
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-4 px-4 text-center font-sans lg:min-w-[190px]">
                                    <div className="flex flex-col gap-1.5 items-center justify-center">
                                      {isFullyPaid ? (
                                        <span className="text-[10px] text-emerald-500 font-bold font-mono">Completed Settlement &nbsp;✔</span>
                                      ) : (
                                        <div className="flex items-center justify-center gap-1.5 w-full">
                                          <button
                                            onClick={() => {
                                              const payAmt = Math.min(due, unitCost);
                                              setPurchases(prev => prev.map(item => {
                                                if (item.id === pur.id) {
                                                  const nextPaid = parseFloat((item.cashPaid + payAmt).toFixed(2));
                                                  return {
                                                    ...item,
                                                    cashPaid: nextPaid,
                                                    dueAmount: Math.max(0, item.totalAmount - nextPaid)
                                                  };
                                                }
                                                return item;
                                              }));
                                              triggerNotification(`Settled cost for 1 Unit (${businessInfo.currencySymbol} ${payAmt}) toward ${pur.productName}!`, "success");
                                            }}
                                            className="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[9px] rounded-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-md shadow-emerald-500/5 duration-150 font-sans"
                                            title="Repay cost of exactly 1 item"
                                          >
                                            +1 Unit
                                          </button>
                                          <button
                                            onClick={() => {
                                              const customInput = prompt(`Enter cash repayment in ${businessInfo.currencySymbol} (Active Debt: ${businessInfo.currencySymbol}${due}):`);
                                              if (customInput === null) return;
                                              const amt = parseFloat(customInput);
                                              if (isNaN(amt) || amt <= 0) {
                                                triggerNotification("Please enter a valid monetary amount!", "error");
                                                return;
                                              }
                                              const payAmt = Math.min(due, amt);
                                              setPurchases(prev => prev.map(item => {
                                                if (item.id === pur.id) {
                                                  const nextPaid = parseFloat((item.cashPaid + payAmt).toFixed(2));
                                                  return {
                                                    ...item,
                                                    cashPaid: nextPaid,
                                                    dueAmount: Math.max(0, item.totalAmount - nextPaid)
                                                  };
                                                }
                                                return item;
                                              }));
                                              triggerNotification(`Stepwise repayment of ${businessInfo.currencySymbol} ${payAmt} recorded successfully!`, "success");
                                            }}
                                            className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[9px] rounded-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-md shadow-amber-500/5 duration-150 font-sans"
                                            title="Enter custom money amount"
                                          >
                                            Repay
                                          </button>
                                        </div>
                                      )}
                                      {qty > 0 && (
                                        <button
                                          onClick={() => {
                                            const matchedProduct = products.find(p => p.id === pur.productId);
                                            const availableStock = matchedProduct ? matchedProduct.stock : 0;
                                            const maxReturnQty = Math.min(qty, availableStock);
                                            
                                            if (maxReturnQty <= 0) {
                                              triggerNotification("Cannot return: No remaining warehouse stock left for this product!", "error");
                                              return;
                                            }
                                            
                                            const promptVal = prompt(
                                              `Enter quantity of ${pur.productName} you want to return to ${pur.supplierName || 'supplier'}.\n` +
                                              `• Purchased quantity in this batch: ${pur.quantity} pcs\n` +
                                              `• Available physical stock: ${availableStock} pcs\n` +
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
                                          className="px-2.5 py-1 bg-rose-650 hover:bg-rose-500 text-white font-bold text-[9px] rounded-lg transition-all hover:scale-105 cursor-pointer shadow-md flex items-center gap-1 justify-center w-full"
                                        >
                                          <Undo2 className="w-3 h-3" />
                                          <span>ফেরত (Return)</span>
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
                    {/* -----------------------------------------------------------------
              VIEW 2.5: BRAND NEW SUPPLIER DUE RECORD SHEET (Due List Tracker)
              ----------------------------------------------------------------- */}
          {activeTab === "duelist" && (
            <div className="space-y-6 animate-fadeIn" id="view-duelist-container">
              {/* 1. HEADER BANNER */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/40" id="duelist-header-block">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping shrink-0" />
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
                      Supplier Due List Tracker
                    </h1>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-medium font-sans">
                    Real-time ledger tracking of credit procurement from suppliers. Monitor credit balance incoming (In), cash payment settlements outgoing (Out), and outstanding liabilities (Remaining).
                  </p>
                </div>
              </div>

              {/* 2. DATE HORIZON FILTERS */}
              <div className="bg-[#0b0f19] border border-slate-800/80 p-3 rounded-2xl flex flex-col md:flex-row items-center gap-4 justify-between" id="duelist-period-menu-container">
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <span className="text-[10px] text-[#00E676] font-bold uppercase tracking-wider font-mono">Date Horizon Presets:</span>
                  <div className="flex flex-wrap gap-1.5 font-sans" id="duelist-horizontal-pills">
                    {[
                      { id: "all", label: "All Time" },
                      { id: "today", label: "Today" },
                      { id: "weekly", label: "Last 7 Days" },
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
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                    
                    if (filter === "today") {
                      return pDate >= todayStart && pDate <= todayEnd;
                    }
                    if (filter === "weekly") {
                      const weeklyStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
                      return pDate >= weeklyStart && pDate <= todayEnd;
                    }
                    if (filter === "monthly") {
                      const monthlyStart = new Date(now.getFullYear(), now.getMonth(), 1);
                      return pDate >= monthlyStart && pDate <= todayEnd;
                    }
                    if (filter === "yearly") {
                      const yearlyStart = new Date(now.getFullYear(), 0, 1);
                      return pDate >= yearlyStart && pDate <= todayEnd;
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
                              setProducts(products.map(p => {
                                if (p.id === dueProductId) {
                                  return {
                                    ...p,
                                    stock: p.stock + qty,
                                    buyPrice: rate
                                  };
                                }
                                return p;
                              }));

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
                                      {format(new Date(pur.date), "dd MMMM, yyyy")}
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
                                            <span>ফেরত (Return)</span>
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
                            <p className="text-[10px] text-slate-400 font-medium">সাপ্লায়ার পেমেন্ট ও বকেয়া রসিদ (মেমো)</p>
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
                                <span className="text-[9px] font-normal text-emerald-400/80">সম্পূর্ণ পরিশোধিত</span>
                              </span>
                            ) : (
                              <span className="inline-flex flex-col items-center justify-center bg-amber-500/10 border border-amber-500/40 px-4 py-2 rounded-2xl text-[11px] font-extrabold text-amber-400 tracking-wider">
                                <span>⚠️</span> ACTIVE CREDIT
                                <span className="text-[9px] font-normal text-amber-400/80">বকেয়া রয়েছে</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="border-t border-dashed border-slate-850 my-4" />

                        {/* Voucher Metadata Grid */}
                        <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950/40 p-4 border border-slate-800/80 rounded-2xl" id="receipt-meta-grid">
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-mono tracking-wider">Voucher No / মেমো নং</span>
                            <strong className="text-white text-sm font-mono">{pur.invoiceNo || "N/A"}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-mono tracking-wider">Date / তারিখ</span>
                            <strong className="text-white text-sm">{format(new Date(pur.date), "dd MMMM, yyyy")}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-mono tracking-wider">Supplier Name / সরবরাহকারী</span>
                            <strong className="text-amber-400 text-sm font-semibold">{pur.supplierName}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-mono tracking-wider">Supplier Phone / ফোন নম্বর</span>
                            <strong className="text-slate-300 text-sm font-mono">{supContact?.phone || "N/A"}</strong>
                          </div>
                        </div>

                        {/* Item details */}
                        <div>
                          <h5 className="text-[11px] uppercase font-mono font-bold text-slate-400 tracking-wider mb-2">Purchase & Product Breakdown / পণ্যের বিবরণ</h5>
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
                            <span>Original Purchase Total / মোট বিল:</span>
                            <span className="font-mono text-white text-sm font-semibold">{businessInfo.currencySymbol} {pur.totalAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-slate-400">
                            <span>Disbursed Paid / এ পর্যন্ত পরিশোধিত:</span>
                            <span className="font-mono text-emerald-400 text-sm font-black">{businessInfo.currencySymbol} {(pur.cashPaid || 0).toLocaleString()}</span>
                          </div>
                          
                          <div className="border-t border-slate-800/80 pt-2.5 flex justify-between items-center">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-xs text-white block">Outstanding Due / বর্তমান বকেয়া:</span>
                              <span className="text-[9px] text-slate-400 block font-normal">Remaining outstanding due balance</span>
                            </div>
                            <span className={`font-mono text-lg font-black ${due <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {businessInfo.currencySymbol} {due.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 text-center font-normal italic">
                          রসিদটি আপনার রেকর্ড হিসেবে সংরক্ষণ অথবা সাপ্লায়ারকে শেয়ার করতে নিচের বাটনগুলো ব্যবহার করুন।
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
            </div>
          )}


          {/* -----------------------------------------------------------------
              VIEW 3: LEDGER INVOICING ACCOUNTING & DUE COLLECTOR
              ----------------------------------------------------------------- */}
          {activeTab === "ledger" && (
            <div className="space-y-6 animate-fadeIn" id="view-ledger-container">
              
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

                <div className="flex flex-wrap items-center gap-2" id="ledger-filter-tabs">
                  <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wide mr-1 select-none">Reciprocal Filter:</span>
                  {["all", "paid", "partial", "due"].map((status) => (
                    <button
                      key={status}
                      id={`ledger-filter-${status}`}
                      onClick={() => setLedgerStatusFilter(status)}
                      className={`px-4 py-2 rounded-xl text-xs font-mono font-bold capitalize cursor-pointer transition-all ${ledgerStatusFilter === status ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-500/10' : 'bg-[#121214] border border-slate-800 text-slate-400 hover:text-white'}`}
                    >
                      {status === 'all' ? 'All Transactions' : status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Due Balance'}
                    </button>
                  ))}
                </div>

              </div>

              {/* Transactions Timeline List Feed */}
              <div className="space-y-4" id="ledger-timeline-feed">
                {filteredTransactions.length === 0 ? (
                  <div className="py-16 text-center text-slate-450 italic bg-[#1E1E24] border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
                    <span className="text-4xl text-slate-600">🗄️</span>
                    <p className="text-xs font-mono leading-normal">No custom entries or receipt files found in active filter catalog.</p>
                  </div>
                ) : (
                  filteredTransactions.map((t) => {
                    const associatedContact = contacts.find(c => c.id === t.contactId);
                    const customerLabel = associatedContact ? associatedContact.name : "Walk-in Showroom Client";
                    const customerPhone = associatedContact ? associatedContact.phone : null;
                    
                    return (
                      <div 
                        key={t.id} 
                        className={`bg-[#1E1E24]/90 hover:bg-[#1E1E24] border border-slate-800/70 hover:border-slate-800 rounded-2xl p-5 shadow-lg transition-all flex flex-col md:flex-row justify-between gap-4 relative overflow-hidden ${
                          t.status === "paid" 
                            ? "border-l-4 border-l-emerald-500" 
                            : t.status === "partial" 
                              ? "border-l-4 border-l-amber-500 animate-pulse-subtle" 
                              : "border-l-4 border-l-[#FF5252]"
                        }`}
                      >
                        {/* Transaction Core info column */}
                        <div className="space-y-3 flex-1">
                          
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-white rounded-lg text-xs font-mono font-black uppercase tracking-wider block">
                              {t.invoiceNo}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                              {new Date(t.date).toLocaleDateString()} {new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                            
                            {/* Color-coded Dynamic Badge */}
                            <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-black tracking-wide border font-mono shrink-0 select-none ${
                              t.status === "paid" 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : t.status === "partial" 
                                  ? "bg-amber-500/15 text-amber-400 border-amber-500/20" 
                                  : "bg-red-500/10 text-rose-455 border-red-500/20 text-[#FF5252]"
                            }`}>
                              {t.status === 'due' ? 'Due Status' : t.status === 'partial' ? 'Partial Paid' : 'Fully Settled'}
                            </span>
                          </div>

                          {/* Client Profile Box */}
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-xs text-emerald-400 uppercase select-none">
                              {customerLabel.slice(0,2)}
                            </div>
                            <div>
                              <strong className="text-white text-xs block leading-tight">{customerLabel}</strong>
                              {customerPhone && (
                                <span className="text-[10px] text-slate-450 font-mono font-medium block mt-0.5">Mobile: {customerPhone}</span>
                              )}
                            </div>
                                          {/* Invoice Items Sub-Drawer */}
                          <div className="bg-[#121214] border border-slate-850/65 rounded-xl p-3 space-y-1.5" id={`ledger-items-${t.invoiceNo}`}>
                            <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-wider block">Invoice Line Items ({t.items.length})</span>
                            <div className="space-y-1">
                              {t.items.map((it, idx) => {
                                const dbProduct = products.find(p => p.id === it.productId || p.id === it.id || p.name === it.name);
                                let buyCost = 0;
                                if (dbProduct && dbProduct.buyPrice > 0) {
                                  buyCost = dbProduct.buyPrice;
                                } else if (it.buyPrice && it.buyPrice > 0) {
                                  buyCost = it.buyPrice;
                                } else if (dbProduct) {
                                  buyCost = dbProduct.buyPrice;
                                } else if (it.buyPrice !== undefined) {
                                  buyCost = it.buyPrice;
                                } else {
                                  buyCost = 0;
                                }
                                const showEdit = showCostEditId === `${t.id}-${idx}`;

                                return (
                                  <div key={idx} className="flex justify-between items-center text-[11px] font-sans text-slate-300 py-1 border-b border-slate-800/20 last:border-b-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-slate-500 font-mono font-bold">{it.quantity}x</span> 
                                      <span className="text-white font-semibold">{dbProduct ? dbProduct.name : (it.name || "Product Item")}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        (@ {businessInfo.currencySymbol || "৳"}{(it.price ?? 0).toLocaleString()}/unit)
                                      </span>
                                      {buyCost > 0 && (
                                        <span className="text-[9px] text-slate-500 font-mono">
                                          (Cost: {businessInfo.currencySymbol}{buyCost})
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {showEdit ? (
                                        <div className="flex items-center gap-1 animate-fadeIn">
                                          <input
                                            type="number"
                                            defaultValue={buyCost}
                                            id={`buy-cost-${t.id}-${idx}`}
                                            className="w-16 px-1.5 py-0.5 bg-black border border-slate-800 text-[#00E676] font-mono text-[9px] outline-none rounded"
                                            onClick={(e) => e.stopPropagation()}
                                          />
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const val = parseFloat((document.getElementById(`buy-cost-${t.id}-${idx}`) as HTMLInputElement)?.value);
                                              if (!isNaN(val)) {
                                                handleUpdateTransactionItemBuyPrice(t.id, idx, val);
                                                setShowCostEditId(null);
                                              }
                                            }}
                                            className="bg-[#00E676] hover:bg-emerald-400 text-slate-950 font-black px-1.5 py-0.5 text-[8px] rounded cursor-pointer"
                                          >
                                            Set
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setShowCostEditId(null);
                                            }}
                                            className="text-slate-400 hover:text-white text-[9px] px-1 cursor-pointer"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowCostEditId(`${t.id}-${idx}`);
                                          }}
                                          className="text-[9px] text-[#00E676]/90 hover:text-[#00E676] hover:underline font-mono cursor-pointer flex items-center gap-0.5 bg-transparent border-0 p-0"
                                          title="Override or edit purchase cost rate for this item"
                                        >
                                          Edit Cost: {businessInfo.currencySymbol}{buyCost} ✏️
                                        </button>
                                      )}
                                      <span className="font-mono text-[10px] text-slate-400">
                                        {businessInfo.currencySymbol} {it.total.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>             </div>

                        </div>

                        {/* Transaction Accounting Column & Cash Math */}
                        <div className="flex flex-row md:flex-col justify-between md:justify-center md:items-end gap-x-6 gap-y-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-850/80 shrink-0 font-mono text-right text-xs">
                          
                          <div className="space-y-1 text-left md:text-right">
                            <span className="text-[9px] uppercase text-slate-550 font-semibold block">Price Calculations:</span>
                            <div className="grid grid-cols-2 md:block gap-x-4">
                              <p className="text-slate-400 text-[11px]">
                                Discount: <span className="text-[#FF5252]">-{businessInfo.currencySymbol} {t.discount.toLocaleString()}</span>
                              </p>
                              <p className="text-white font-black text-sm mt-0.5">
                                Grand Total: {businessInfo.currencySymbol} {t.total.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1 text-right">
                            <span className="text-[9px] uppercase text-slate-550 font-semibold block">Collected vs Outstanding:</span>
                            <div className="grid grid-cols-2 md:block gap-x-4">
                              <p className="text-emerald-400 font-bold">
                                Received: {businessInfo.currencySymbol} {t.paidAmount.toLocaleString()}
                              </p>
                              {t.dueBalance > 0 ? (
                                <p className="text-rose-455 text-[#FF5252] font-black animate-pulse">
                                  Due Balance: {businessInfo.currencySymbol} {t.dueBalance.toLocaleString()}
                                </p>
                              ) : (
                                <p className="text-slate-500 text-[10px]">Accounts Settled ✓</p>
                              )}
                            </div>
                          </div>

                        </div>

                        {/* Interactive Admin Tool Belt */}
                        <div className="flex flex-row md:flex-col items-center justify-end gap-2 shrink-0 md:pl-3 border-t md:border-t-0 border-slate-850/80 pt-3 md:pt-0">
                          
                          {/* Reprint Invoice PDF */}
                          <button
                            id={`download-pdf-${t.invoiceNo}`}
                            onClick={() => generateInvoicePDF(t, associatedContact, businessInfo)}
                            className="p-2 bg-slate-900 border border-slate-800 hover:border-emerald-500 text-slate-300 hover:text-emerald-400 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold text-[10px] uppercase tracking-wide shrink-0 h-10 w-24 shadow"
                            title="Reprint Customer Cash Memo"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF reprint
                          </button>

                          {/* Reprint Delivery Challan */}
                          <button
                            id={`download-challan-${t.invoiceNo}`}
                            onClick={() => generateDeliveryChallanPDF(t, associatedContact, businessInfo)}
                            className="p-2 bg-slate-900 border border-slate-800 hover:border-[#00E676] text-slate-[#A0A0A5] hover:text-[#00E676] rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold text-[10px] uppercase tracking-wide shrink-0 h-10 w-24 shadow"
                            title="Download Delivery Challan"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Challan
                          </button>

                          {/* Collect Remaining Debt */}
                          {t.dueBalance > 0 && (
                            <button
                              onClick={() => {
                                setCollectionTx(t);
                                setCollectAmount(t.dueBalance.toString());
                              }}
                              className="p-2 bg-[#00E676] hover:bg-emerald-400 text-slate-950 rounded-xl hover:scale-[1.02] active:scale-95 transition-all text-[10px] font-bold uppercase tracking-wider shrink-0 h-10 w-24 font-sans block shadow-md shadow-[#00E676]/15 cursor-pointer text-center"
                            >
                              Collect Due
                            </button>
                          )}

                          {/* Modify and Erase buttons */}
                          {currentPanel === "admin" && (
                            <div className="flex items-center gap-1">
                              {deleteTxId === t.id ? (
                                <div className="flex items-center gap-1 justify-end bg-slate-900 p-1 border border-slate-800 rounded-xl h-10 animate-scaleIn">
                                  <span className="text-[8px] text-slate-400 font-mono uppercase px-1">Erase?</span>
                                  <button
                                    onClick={() => {
                                      handleDeleteTransaction(t.id);
                                      setDeleteTxId(null);
                                    }}
                                    className="bg-[#FF5252] hover:bg-rose-500 text-[#121214] font-black p-1 px-2.5 rounded-lg text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setDeleteTxId(null)}
                                    className="bg-slate-800 hover:bg-slate-700 text-white p-1 px-2.5 rounded-lg text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => setEditingTx(t)}
                                    className="p-2 bg-slate-900 border border-slate-805 hover:border-[#00B0FF] text-slate-400 hover:text-[#00B0FF] rounded-xl transition-all cursor-pointer h-10 w-10 flex items-center justify-center shadow"
                                    title="Edit Sale Details & Units"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  
                                  <button
                                    onClick={() => setDeleteTxId(t.id)}
                                    className="p-2 bg-slate-900 border border-slate-805 hover:border-[#FF5252] text-slate-455 hover:text-[#FF5252] rounded-xl transition-all cursor-pointer h-10 w-10 flex items-center justify-center shadow"
                                    title="Wipe transaction memo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}



          {/* -----------------------------------------------------------------
              VIEW 5: EXPENSES LEDGER WITH AI CATEGORY INFERENCE
              ----------------------------------------------------------------- */}
          {/* -----------------------------------------------------------------
              VIEW 5: EXPENSES LEDGER WITH AI CATEGORY INFERENCE
              ----------------------------------------------------------------- */}
          {activeTab === "expenses" && (
            <div className="space-y-6" id="view-expenses-outer-container">
              
              {/* DATE RANGE FILTER FOR EXPENSES LEDGER */}
              <div className="bg-[#0b0f19]/90 border border-slate-800 p-4 rounded-2xl shadow-lg" id="expense-period-menu-container">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-1.5" id="preset-expense-pills">
                    {[
                      { id: "all", label: "All Time" },
                      { id: "today", label: "Today" },
                      { id: "weekly", label: "7 Days" },
                      { id: "monthly", label: "This Month" },
                      { id: "yearly", label: "This Year" },
                      { id: "custom", label: "Custom Range" }
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setExpenseDateFilter(preset.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap border ${
                          expenseDateFilter === preset.id
                            ? "bg-[#181d2f] text-[#00E676] border-[#2b3558] font-bold shadow-md"
                            : "text-slate-400 hover:text-white hover:bg-slate-800/40 border-transparent bg-transparent"
                        }`}
                        id={`expense-preset-key-${preset.id}`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  
                  {/* Summary of expense for current range */}
                  {(() => {
                    const filteredRangeExpenses = expenses.filter(e => checkExpenseDateInFilter(e.date));
                    const rangeTotal = filteredRangeExpenses.reduce((sum, e) => sum + e.amount, 0);
                    return (
                      <div className="bg-[#121214]/60 border border-slate-800 rounded-xl px-4 py-2 font-mono text-center shrink-0">
                        <span className="text-[9px] text-slate-400 uppercase block tracking-wider font-bold">Selected Range Total</span>
                        <span className="text-xs font-semibold text-rose-400 font-sans">
                          {businessInfo.currencySymbol} {rangeTotal.toLocaleString()}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Custom Date Inputs if "custom" range is chosen */}
                {expenseDateFilter === "custom" && (
                  <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800/50 mt-1" id="expense-custom-limits-deck">
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase block font-mono">Start Date</span>
                      <input
                        type="date"
                        value={expenseCustomStart}
                        onChange={(e) => setExpenseCustomStart(e.target.value)}
                        className="bg-[#050912] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase focus:ring-1 focus:ring-rose-500/50 outline-none font-mono"
                      />
                    </div>
                    <span className="text-slate-600 text-xs font-mono self-end pb-2">to</span>
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase block font-mono">End Date</span>
                      <input
                        type="date"
                        value={expenseCustomEnd}
                        onChange={(e) => setExpenseCustomEnd(e.target.value)}
                        className="bg-[#050912] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase focus:ring-1 focus:ring-rose-500/50 outline-none font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="view-expenses-container">
                
                {/* Form panel to entry outgoings (4 Cols) */}
                <div className="lg:col-span-4 bg-[#0a101f]/80 border border-slate-800 p-5 rounded-2xl space-y-4" id="add-expense-panel">
                  <h3 className="text-sm font-semibold text-white tracking-wide border-b border-slate-900 pb-2.5">Log Administrative Showroom Outgoings</h3>
                  
                  <form onSubmit={handleAddExpense} className="space-y-4" id="outgoing-add-form">
                    
                    <div className="space-y-1.5" id="expense-desc-wrap">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Voucher Description / Pay Reason *</label>
                      <textarea
                        required
                        placeholder="e.g. Warehouse monthly lease, electric bills, courier postage"
                        value={expenseDesc}
                        onChange={(e) => setExpenseDesc(e.target.value)}
                        className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-sans h-20 resize-none leading-normal"
                      />
                    </div>

                    <div className="flex items-center gap-2" id="ai-classify-outgoing">
                      <button
                        type="button"
                        id="ai-suggest-category-btn"
                        onClick={fetchAISuggestedCategory}
                        disabled={isClassifying}
                        className="text-[11px] font-bold text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {isClassifying ? "AI Categorizing..." : "✨ Predict Category with AI"}
                      </button>
                      <span className="text-[9px] text-slate-500 font-mono">Gemini automatically scans outgo’s category</span>
                    </div>

                    <div className="space-y-3 p-3.5 bg-[#050912]/85 border border-slate-800/80 rounded-xl" id="outgoing-category-selection-container">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Expense Category Type *</label>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingCustomCategory(!isAddingCustomCategory);
                              if (!isAddingCustomCategory) {
                                setExpenseCategory("");
                              } else {
                                setExpenseCategory("Others");
                              }
                            }}
                            className="text-[9px] font-bold text-emerald-400 hover:text-[#00E676] transition-colors cursor-pointer select-none"
                          >
                            {isAddingCustomCategory ? "← Select Preset Category" : "⊕ Add Custom Category"}
                          </button>
                        </div>

                        {!isAddingCustomCategory ? (
                          <select
                            required
                            value={expenseCategory}
                            onChange={(e) => setExpenseCategory(e.target.value)}
                            className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-slate-200 text-xs outline-none focus:border-emerald-500 font-mono"
                          >
                            {allCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              required
                              placeholder="Type new category (e.g. Internet, Office Tea)"
                              value={customCategory}
                              onChange={(e) => setCustomCategory(e.target.value)}
                              className="w-full px-3 py-2 bg-[#050912] border border-emerald-500/40 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const trimmed = customCategory.trim();
                                if (trimmed) {
                                  if (!expenseCategories.includes(trimmed)) {
                                    setExpenseCategories([...expenseCategories, trimmed]);
                                  }
                                  setExpenseCategory(trimmed);
                                  setIsAddingCustomCategory(false);
                                  setCustomCategory("");
                                  triggerNotification(`Category "${trimmed}" successfully mapped!`);
                                }
                              }}
                              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shrink-0 uppercase tracking-wider select-none font-sans"
                            >
                              Add
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Voucher Amount (৳) *</label>
                          <input
                            type="number"
                            required
                            placeholder="0"
                            value={expenseAmount}
                            onChange={(e) => setExpenseAmount(e.target.value)}
                            className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Created Date</label>
                          <input
                            type="date"
                            value={expenseDate}
                            onChange={(e) => setExpenseDate(e.target.value)}
                            className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      id="save-expense-btn"
                      className="w-full py-3 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <PlusCircle className="w-4 h-4 shrink-0" />
                      Log Expense Voucher
                    </button>

                  </form>

                </div>

                {/* Expense entries list table (8 Cols) */}
                <div className="lg:col-span-8 bg-[#0a101f]/80 border border-slate-800 rounded-2xl overflow-hidden" id="expenses-list-panel">
                  <div className="p-4 bg-slate-950/50 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3" id="expenses-header">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-white block">Expenses History & Vouchers</span>
                      <span className="text-[10px] text-slate-400">Track and filter logged cash flows</span>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="text-[10px] font-mono font-bold text-rose-400">
                        Total Cumulative: {businessInfo.currencySymbol} {(expenses.reduce((sum, e) => sum + e.amount, 0)).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-amber-400">
                        Filtered Period Total: {businessInfo.currencySymbol} {expenses.filter(e => (expenseFilterCategory === "All" || e.category === expenseFilterCategory) && checkExpenseDateInFilter(e.date)).reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Filter chip tab bar */}
                  <div className="px-4 py-3 bg-slate-950/25 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto" id="expenses-category-filters">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-500 mr-1 select-none">Filter:</span>
                    {["All", ...allCategories].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setExpenseFilterCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wider font-mono cursor-pointer transition-all border shrink-0 ${
                          expenseFilterCategory === cat
                            ? "bg-rose-500/10 border-rose-500 text-rose-400 font-bold"
                            : "bg-[#050912] border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {cat.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <div className="overflow-x-auto" id="expenses-table-scroll">
                    <table className="w-full text-slate-300 text-xs">
                      <thead>
                        <tr className="bg-slate-950/40 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                          <th className="py-2.5 px-4 text-left">Created Date</th>
                          <th className="py-2.5 px-4 text-left">Voucher details</th>
                          <th className="py-2.5 px-4 text-left">Category</th>
                          <th className="py-2.5 px-4 text-right">Paid Amount</th>
                          <th className="py-2.5 px-4 text-center">Actions / Adjust</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {(() => {
                          const filteredExpenses = expenses.filter(e => 
                            (expenseFilterCategory === "All" || e.category === expenseFilterCategory) &&
                            checkExpenseDateInFilter(e.date)
                          );

                          if (filteredExpenses.length === 0) {
                            return (
                              <tr>
                                <td colSpan={5} className="py-12 text-center text-slate-500 italic">
                                  {expenseFilterCategory === "All"
                                    ? "No administrative overhead outlays logged yet for selected dates."
                                    : `No outlays logged under "${expenseFilterCategory}" category for selected dates.`}
                                </td>
                              </tr>
                            );
                          }

                          return filteredExpenses.map((e) => (
                            <tr key={e.id} className="hover:bg-slate-900/10 text-slate-300">
                              <td className="py-3 px-4 font-mono text-slate-400">{e.date}</td>
                              <td className="py-3 px-4 text-slate-100 font-semibold">{e.description}</td>
                              <td className="py-3 px-4">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#050912] border border-slate-800 text-purple-400 font-mono inline-block">
                                  {e.category}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right text-rose-400 font-bold font-mono">{businessInfo.currencySymbol} {(e.amount ?? 0).toLocaleString()}</td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    id={`edit-expense-btn-${e.id}`}
                                    onClick={() => {
                                      setEditingExpense(e);
                                      setEditExpenseDesc(e.description);
                                      setEditExpenseCategory(e.category);
                                      setEditExpenseAmount(String(e.amount));
                                      setEditExpenseDate(e.date);
                                    }}
                                    className="p-1.5 hover:bg-emerald-500/10 rounded-lg group transition-all text-slate-500 hover:text-emerald-400 cursor-pointer"
                                    title="Edit expense"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    id={`delete-expense-${e.id}`}
                                    onClick={() => setDeleteExpenseId(e.id)}
                                    className="p-1.5 hover:bg-rose-500/10 rounded-lg group transition-all text-slate-500 hover:text-rose-400 cursor-pointer"
                                    title="Delete expense"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        })()}
                      </tbody>
                    </table>
                  </div>

                </div>

              </div>
            </div>
          )}

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
              
              const clientTxs = transactions.filter(t => t.contactId === c.id);
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
              
              return { label: "Regular Client", color: "bg-[#A0A0A5]/10 text-[#A0A0A5] border border-slate-700/50 text-[10px]" };
            };

            const filteredContacts = contacts.filter(c => {
              const matchesSearch = c.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) || 
                                    c.phone.includes(contactSearchQuery) || 
                                    (c.address && c.address.toLowerCase().includes(contactSearchQuery.toLowerCase()));
              const matchesType = contactTypeFilter === "all" ? true : c.type === contactTypeFilter;
              return matchesSearch && matchesType;
            });

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in" id="view-contacts-container">
                
                {/* Add contact form (4 Cols) */}
                <div className="lg:col-span-4 bg-[#1E1E24] border border-[#2D2D35] p-6 rounded-2xl space-y-4 shadow-lg" id="add-contact-panel">
                  <div className="border-b border-[#2D2D35] pb-3">
                    <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                      {editingContact ? "Edit Active Partner" : "Register Partner"}
                    </h3>
                    <p className="text-[10px] text-[#A0A0A5]">
                      {editingContact ? "Modify contact information for this client account" : "Register a customer client or wholesaler to tracking payments"}
                    </p>
                  </div>
                  
                  <form onSubmit={handleAddContact} className="space-y-4" id="contacts-form">
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Legal Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe, Mohammad Habib"
                        value={cName}
                        onChange={(e) => setCName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white text-xs outline-none focus:border-[#00E676] font-sans focus:ring-1 focus:ring-[#00E676]/30 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center pr-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Primary Mobile Number *</label>
                        {cPhone.length > 0 && (
                          <span className={`text-[10px] font-mono font-bold ${cPhone.length === 11 ? "text-emerald-400" : "text-rose-500 animate-pulse"}`}>
                            {cPhone.length}/11 Digits
                          </span>
                        )}
                      </div>
                      <input
                        type="tel"
                        required
                        maxLength={11}
                        placeholder="017xxxxxxxx"
                        value={cPhone}
                        onChange={(e) => {
                          const converted = banglaToEnglishDigits(e.target.value);
                          const numericOnly = converted.replace(/[^0-9]/g, "");
                          setCPhone(numericOnly);
                        }}
                        className={`w-full px-3 py-2.5 bg-[#121214] border rounded-xl text-white text-xs outline-none focus:ring-1 transition-all font-mono ${
                          cPhone.length > 0 && cPhone.length !== 11
                            ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30 text-rose-300"
                            : "border-[#2D2D35] focus:border-[#00E676] focus:ring-[#00E676]/30"
                        }`}
                      />
                      {cPhone.length > 0 && cPhone.length !== 11 && (
                        <p className="text-[10px] text-rose-500 font-bold pl-1 mt-0.5 min-h-[14px]">
                          ⚠️ বাংলাদেশের মোবাইল নাম্বার অবশ্যই ১১ ডিজিট হতে হবে! (বর্তমানে {cPhone.length} ডিজিট)
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Address Details (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Block C, Gulshan-2, Dhaka"
                        value={cAddress}
                        onChange={(e) => setCAddress(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white text-xs outline-none focus:border-[#00E676] font-sans focus:ring-1 focus:ring-[#00E676]/30 transition-all"
                      />
                    </div>

                    {/* Highly polished AI translation alert container for Bangla Inputs */}
                    {(hasBengaliCharacters(cName) || hasBengaliCharacters(cAddress)) && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2 text-xs text-amber-200 animate-fade-in">
                        <div className="flex items-start gap-2">
                          <Languages className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-extrabold text-amber-400 tracking-wide">বাংলা লেখা সনাক্ত করা হয়েছে!</p>
                            <p className="text-[10px] text-amber-300/90 leading-relaxed font-sans">
                              নাম বা ঠিকানায় বাংলা ইনপুট করা হয়েছে। ব্যবসার হিসাব-নিকাশ পরিষ্কার রাখতে Gemini AI ব্যবহার করে নিমিষেই সঠিক এবং নির্ভুল ইংরেজি রূপান্তর (Transliteration) করে নিন।
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={runTranslationForUI}
                          disabled={isTranslatingContact}
                          className="w-full flex items-center justify-center gap-1.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-lg cursor-pointer transition-all duration-150 active:scale-95 disabled:opacity-50"
                        >
                          {isTranslatingContact ? (
                            <>
                              <span className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                              <span>অনুবাদ হচ্ছে (AI Translating)...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-slate-950" />
                              <span>ইংরেজিতে রূপান্তর করুন (Translate to English)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1 block">Profile Relationship Type</label>
                      <div className="flex gap-4 pt-1" id="type-radio-group">
                        <label className="flex items-center gap-2 text-xs text-slate-300 font-sans cursor-pointer select-none">
                          <input
                            type="radio"
                            name="contactType"
                            checked={cType === "customer"}
                            onChange={() => setCType("customer")}
                            className="accent-[#00E676] scale-110 cursor-pointer"
                          />
                          Customer Line
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-300 font-sans cursor-pointer select-none">
                          <input
                            type="radio"
                            name="contactType"
                            checked={cType === "supplier"}
                            onChange={() => setCType("supplier")}
                            className="accent-[#00E676] scale-110 cursor-pointer"
                          />
                          Supplier Dealer
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      id="save-contact-btn"
                      disabled={cPhone.length !== 11 || !cName.trim() || isTranslatingContact}
                      className={`w-full py-3.5 text-[#121214] font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg ${
                        cPhone.length !== 11 || !cName.trim() || isTranslatingContact
                          ? "bg-slate-700/50 text-slate-400 cursor-not-allowed border border-slate-700/30 shadow-none hover:scale-100"
                          : "bg-[#00E676] hover:bg-[#00D065] hover:scale-[1.02] active:scale-[0.98] shadow-[#00E676]/10"
                      }`}
                    >
                      <PlusCircle className="w-4 h-4" />
                      {editingContact ? "Save Profile Changes" : "Register Profile"}
                    </button>

                    {editingContact && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingContact(null);
                          setCName("");
                          setCPhone("");
                          setCAddress("");
                        }}
                        className="w-full py-2 bg-[#2D2D35]/50 hover:bg-[#2D2D35] text-[#A0A0A5] hover:text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-[#2D2D35]"
                      >
                        Cancel Editing
                      </button>
                    )}

                  </form>
                </div>

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
                        const clientTxs = transactions.filter(t => {
                          if (!t) return false;
                          if (t.contactId === c.id) return true;
                          
                          const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();
                          const tIdNorm = toUUID(t.contactId || "", cleanEmail);
                          const cIdNorm = toUUID(c.id || "", cleanEmail);
                          if (tIdNorm === cIdNorm) return true;
                          if (t.contactId === cIdNorm) return true;
                          if (tIdNorm === c.id) return true;

                          if (c.phone && t.contactId) {
                            const txContact = contacts.find(co => co.id === t.contactId || toUUID(co.id, cleanEmail) === tIdNorm);
                            if (txContact && txContact.phone && txContact.phone.trim() === c.phone.trim()) {
                              return true;
                            }
                          }
                          return false;
                        });
                        
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
                            className="bg-[#1E1E24] border border-[#2D2D35] p-5 rounded-2xl shadow-md transition-all hover:border-[#00E676]/20 flex flex-col justify-between space-y-4 group relative overflow-hidden"
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
                                <div className="text-[10px] font-bold text-[#A0A0A5] font-mono tracking-wider flex items-center gap-1.5 border-b border-[#2D2D35]/50 pb-1 uppercase">
                                  <Package className="w-3.5 h-3.5 text-[#00E676]" />
                                  Purchased Items:
                                </div>
                                {purchasedProductsList.length > 0 ? (
                                  <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar scrollbar-thin">
                                    {purchasedProductsList.map((prod, idx) => (
                                      <div key={idx} className="flex flex-col text-[10px] py-1.5 border-b border-[#2D2D35]/15 last:border-0 font-mono">
                                        <div className="flex justify-between items-start gap-2">
                                          <span className="text-slate-200 font-semibold text-wrap text-left" title={prod.name}>
                                            • {prod.name} <span className="text-slate-400 font-normal text-[9px]">(@ {businessInfo.currencySymbol || "৳"}{prod.price.toLocaleString()}/unit)</span>
                                          </span>
                                          <span className="text-[#00E676] font-bold shrink-0 bg-[#1e1e24] px-1.5 py-0.5 rounded border border-[#2D2D35] text-[9px]">
                                            {prod.quantity} {prod.quantity === 1 ? "Unit" : "Units"}
                                          </span>
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

                            {/* Status and Action bar */}
                            <div className="pt-3 border-t border-[#2D2D35]/50 flex flex-wrap items-center justify-between gap-2.5">
                              {/* Status badge & Direct Sale shortcut */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-1 rounded-full text-[9px] uppercase tracking-wider ${status.color}`}>
                                  {status.label}
                                </span>
                                {c.type === "customer" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPosSelectedContactId(c.id);
                                      setActiveTab("pos");
                                      triggerNotification(`POS Cash Memo loaded. Customer context: ${c.name}`, "success");
                                    }}
                                    className="px-2 py-1 text-[9px] font-black text-[#00E676] bg-[#00E676]/10 hover:bg-[#00E676]/25 border border-[#00E676]/25 rounded-lg flex items-center gap-1 transition-all uppercase cursor-pointer"
                                    title="Direct Sale POS Checkout"
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5 text-[#00E676]" />
                                    Direct Sale
                                  </button>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1 bg-[#121214] p-1 rounded-lg border border-[#2D2D35]">
                                <button
                                  type="button"
                                  onClick={() => triggerNotification(`Showroom line connecting: ${c.name} (${c.phone})...`, "info")}
                                  className="p-1.5 hover:bg-[#00E676]/10 text-[#A0A0A5] hover:text-[#00E676] rounded transition-colors cursor-pointer"
                                  title="Call Client"
                                >
                                  <Phone className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab("ledger");
                                    triggerNotification(`Ledger catalog loaded for filtering: ${c.name}`, "info");
                                  }}
                                  className="p-1.5 hover:bg-[#00B0FF]/10 text-[#A0A0A5] hover:text-[#00B0FF] rounded transition-colors cursor-pointer"
                                  title="Ledger History"
                                >
                                  <History className="w-3 h-3" />
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingContact(c);
                                    setCName(c.name);
                                    setCPhone(c.phone);
                                    setCAddress(c.address || "");
                                    setCType(c.type || "customer");
                                    triggerNotification(`Editing profile for: ${c.name}`, "info");
                                  }}
                                  className="p-1.5 hover:bg-[#00E676]/10 text-[#A0A0A5] hover:text-[#00E676] rounded transition-colors cursor-pointer"
                                  title="Edit Profile"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>

                                {deleteContactId === c.id ? (
                                  <div className="flex items-center gap-1 bg-rose-500/10 p-0.5 rounded border border-rose-500/20">
                                    <button
                                      onClick={() => {
                                        if (currentPanel !== "admin") {
                                          triggerNotification("Security block: Only administrators are authorized to delete contact profiles! 🛑", "error");
                                          setDeleteContactId(null);
                                          return;
                                        }
                                        softDeleteItem("customer", c.id, c, `Partner: ${c.name} (${c.type === "supplier" ? "Supplier" : "Customer"}, Phone: ${c.phone || "N/A"})`);
                                        setContacts(contacts.filter(item => item.id !== c.id));
                                        triggerNotification(`Partner profile '${c.name}' moved to Settings -> Deleted Filter.`);
                                        setDeleteContactId(null);
                                      }}
                                      className="text-[8px] bg-rose-600 hover:bg-rose-500 text-white font-extrabold px-1.5 py-0.5 rounded transition-all cursor-pointer"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      onClick={() => setDeleteContactId(null)}
                                      className="text-[8px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteContactId(c.id)}
                                    className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-[#FF5252] rounded transition-colors cursor-pointer"
                                    title="Unregister Profile"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

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
              
              {/* Introduction Banner */}
              <div className="border-b border-slate-800 pb-4" id="settings-heading-intro">
                <h3 className="text-lg font-bold text-white font-display tracking-tight">System Configuration & Customization</h3>
                <p className="text-xs text-slate-400 mt-1">Refine transaction profiles, layout options, dynamic PDF printouts, and system storage nodes.</p>
              </div>

              {/* 1. Shop Information Card Block */}
              <div className="bg-[#1E1E24]/95 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl" id="settings-shop-info-block">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
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
                      className="w-full px-4 py-2.5 bg-[#121214] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-sans font-bold transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-1.5" id="settings-shop-address">
                    <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Showroom Print Address Headline</label>
                    <input
                      type="text"
                      value={tempShopAddress}
                      onChange={(e) => setTempShopAddress(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#121214] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-sans transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Shop Mobile / Support Hotline</label>
                      <input
                        type="text"
                        value={tempShopPhone}
                        onChange={(e) => setTempShopPhone(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#121214] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Business Support Email Account</label>
                      <input
                        type="email"
                        value={tempShopEmail}
                        onChange={(e) => setTempShopEmail(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#121214] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500/20"
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
                        className="w-full px-4 py-2.5 bg-[#121214] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 block">Primary Currency Symbol</label>
                      <select
                        value={tempCurrency}
                        onChange={(e) => setTempCurrency(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#121214] border border-slate-800 rounded-xl text-slate-200 text-xs outline-none focus:border-emerald-500 font-mono transition-all focus:ring-1 focus:ring-emerald-500/20"
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
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow shadow-emerald-500/10 hover:from-emerald-400 hover:to-emerald-300 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    Save Shop Details
                  </button>
                </div>
              </div>

              {/* 1.1 Premium Corporate Font Settings Card Block */}
              <div className="bg-[#1E1E24]/95 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl animate-fadeIn" id="settings-font-settings-block">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
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
                        className="w-full px-4 py-2.5 bg-[#121214] border border-slate-800 rounded-xl text-slate-200 text-xs outline-none focus:border-emerald-500 font-sans transition-all focus:ring-1 focus:ring-emerald-500/20 font-bold"
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
                      <div className="grid grid-cols-3 gap-2 bg-[#121214] p-1.5 border border-slate-800 rounded-xl">
                        {(["Regular", "Medium", "Large"] as const).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setTempFontSizeScale(sz)}
                            className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                              tempFontSizeScale === sz
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 shadow"
                                : "text-slate-450 hover:text-white hover:bg-slate-800/10"
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] text-slate-500 italic pl-1 leading-normal block">
                        Adjusts system-wide display text density and PDF invoice sizes dynamically.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-[#121214] border border-slate-800 rounded-xl space-y-3">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono block">Selected Font Preview:</span>
                    <div style={{ fontFamily: `'${tempFont}', sans-serif` }} className="text-white space-y-1.5">
                      <p className="text-base font-black leading-tight font-sans">Barakah E-Mart</p>
                      <p className="text-xs text-slate-400">Invoicing, Ledger, CRM & POS Terminal.</p>
                      <div className="flex gap-2 items-center pt-2 border-t border-slate-800/60 font-mono text-[10px] text-slate-500">
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
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow shadow-emerald-500/10 hover:from-emerald-400 hover:to-emerald-300 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    Save Font
                  </button>
                </div>
              </div>

              {/* 2. Invoice Customization Card Block */}
              <div className="bg-[#1E1E24]/95 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl" id="settings-invoice-customization-block">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
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
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      SELECT INVOICE DESIGN & LAYOUT TEMPLATE (Choose 1 of 7 Designs)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" id="invoice-templates-grid">
                      
                      {/* Template 1: Classic Retail */}
                      <div 
                        onClick={() => setTempInvoiceTemplate("classic")}
                        className={`flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left select-none ${
                          tempInvoiceTemplate === "classic"
                            ? "bg-[#00E676]/5 border-[#00E676] shadow shadow-[#00E676]/10"
                            : "bg-[#121214] border-slate-800 hover:border-slate-700 hover:bg-slate-900/45"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-500">Template 01</span>
                            <span className="text-[9px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded uppercase font-mono">Retail Default</span>
                          </div>
                          <h5 className="text-xs font-black text-white">Classic Retail Standard</h5>
                          <p className="text-[10px] text-slate-400 leading-normal font-sans">
                            Double-bordered structural layout with solid deep charcoal headers. Standard format ideal for retail showrooms.
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                            tempInvoiceTemplate === "classic" ? "border-[#00E676]" : "border-slate-700"
                          }`}>
                            {tempInvoiceTemplate === "classic" && <div className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />}
                          </div>
                          <span className="text-[10px] font-bold font-mono text-slate-400">
                            {tempInvoiceTemplate === "classic" ? "Activated" : "Select Style"}
                          </span>
                        </div>
                      </div>

                      {/* Template 2: Modern Minimalist */}
                      <div 
                        onClick={() => setTempInvoiceTemplate("modern_minimal")}
                        className={`flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left select-none ${
                          tempInvoiceTemplate === "modern_minimal"
                            ? "bg-[#00E676]/5 border-[#00E676] shadow shadow-[#00E676]/10"
                            : "bg-[#121214] border-slate-800 hover:border-slate-700 hover:bg-slate-900/45"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-500">Template 02</span>
                            <span className="text-[9px] bg-[#00E676]/10 text-emerald-400 font-bold px-2 py-0.5 rounded uppercase font-mono">Clean Space</span>
                          </div>
                          <h5 className="text-xs font-black text-white">Clean Tech Minimalist</h5>
                          <p className="text-[10px] text-slate-400 leading-normal font-sans">
                            Sophisticated layout emphasizing clean margins, light teal separators, plenty of white space, and zero bulky boxes.
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                            tempInvoiceTemplate === "modern_minimal" ? "border-[#00E676]" : "border-slate-700"
                          }`}>
                            {tempInvoiceTemplate === "modern_minimal" && <div className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />}
                          </div>
                          <span className="text-[10px] font-bold font-mono text-slate-400">
                            {tempInvoiceTemplate === "modern_minimal" ? "Activated" : "Select Style"}
                          </span>
                        </div>
                      </div>

                      {/* Template 3: Executive Premium Navy */}
                      <div 
                        onClick={() => setTempInvoiceTemplate("premium_navy")}
                        className={`flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left select-none ${
                          tempInvoiceTemplate === "premium_navy"
                            ? "bg-[#00E676]/5 border-[#00E676] shadow shadow-[#00E676]/10"
                            : "bg-[#121214] border-slate-800 hover:border-slate-700 hover:bg-slate-900/45"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-500">Template 03</span>
                            <span className="text-[9px] bg-blue-500/10 text-blue-400 font-bold px-2 py-0.5 rounded uppercase font-mono">Executive</span>
                          </div>
                          <h5 className="text-xs font-black text-white">Premium Navy Executive</h5>
                          <p className="text-[10px] text-slate-400 leading-normal font-sans">
                            Solid Deep Navy blue head bars, elegant subtle underline ribbons, and clean grid separators. Promotes unmatched corporate prestige.
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                            tempInvoiceTemplate === "premium_navy" ? "border-[#00E676]" : "border-slate-700"
                          }`}>
                            {tempInvoiceTemplate === "premium_navy" && <div className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />}
                          </div>
                          <span className="text-[10px] font-bold font-mono text-slate-400">
                            {tempInvoiceTemplate === "premium_navy" ? "Activated" : "Select Style"}
                          </span>
                        </div>
                      </div>

                      {/* Template 4: Cosmic Dark Elite */}
                      <div 
                        onClick={() => setTempInvoiceTemplate("cosmic_dark")}
                        className={`flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left select-none ${
                          tempInvoiceTemplate === "cosmic_dark"
                            ? "bg-[#00E676]/5 border-[#00E676] shadow shadow-[#00E676]/10"
                            : "bg-[#121214] border-slate-800 hover:border-slate-700 hover:bg-slate-900/45"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-500">Template 04</span>
                            <span className="text-[9px] bg-purple-500/10 text-purple-400 font-bold px-2 py-0.5 rounded uppercase font-mono">Sci-Fi Bold</span>
                          </div>
                          <h5 className="text-xs font-black text-white">Cosmic Dark Elite</h5>
                          <p className="text-[10px] text-slate-400 leading-normal font-sans">
                            Futuristic high-contrast tech look. Features bold dark-graphite background boxes and bright lime-accent inline borders.
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                            tempInvoiceTemplate === "cosmic_dark" ? "border-[#00E676]" : "border-slate-700"
                          }`}>
                            {tempInvoiceTemplate === "cosmic_dark" && <div className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />}
                          </div>
                          <span className="text-[10px] font-bold font-mono text-slate-400">
                            {tempInvoiceTemplate === "cosmic_dark" ? "Activated" : "Select Style"}
                          </span>
                        </div>
                      </div>

                      {/* Template 5: Vintage Editorial */}
                      <div 
                        onClick={() => setTempInvoiceTemplate("vintage_editorial")}
                        className={`flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left select-none ${
                          tempInvoiceTemplate === "vintage_editorial"
                            ? "bg-[#00E676]/5 border-[#00E676] shadow shadow-[#00E676]/10"
                            : "bg-[#121214] border-slate-800 hover:border-slate-700 hover:bg-slate-900/45"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-500">Template 05</span>
                            <span className="text-[9px] bg-amber-500/10 text-amber-550 font-bold px-2 py-0.5 rounded uppercase font-mono">Luxury Serif</span>
                          </div>
                          <h5 className="text-xs font-black text-white">Vintage Editorial Serif</h5>
                          <p className="text-[10px] text-slate-400 leading-normal font-sans">
                            Warm literary slate tones. Features beautiful thin rules, double dashed spacers, and elegant classic serif headings.
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                            tempInvoiceTemplate === "vintage_editorial" ? "border-[#00E676]" : "border-slate-700"
                          }`}>
                            {tempInvoiceTemplate === "vintage_editorial" && <div className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />}
                          </div>
                          <span className="text-[10px] font-bold font-mono text-slate-400">
                            {tempInvoiceTemplate === "vintage_editorial" ? "Activated" : "Select Style"}
                          </span>
                        </div>
                      </div>

                      {/* Template 6: Bold Accent Emerald */}
                      <div 
                        onClick={() => setTempInvoiceTemplate("bold_emerald")}
                        className={`flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left select-none ${
                          tempInvoiceTemplate === "bold_emerald"
                            ? "bg-[#00E676]/5 border-[#00E676] shadow shadow-[#00E676]/10"
                            : "bg-[#121214] border-slate-800 hover:border-slate-700 hover:bg-slate-900/45"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-500">Template 06</span>
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded uppercase font-mono">Fresh Green</span>
                          </div>
                          <h5 className="text-xs font-black text-white">Vibrant Emerald Accent</h5>
                          <p className="text-[10px] text-slate-400 leading-normal font-sans">
                            Fresh, striking, and energetic. Framed by a thick emerald top band and matching green table headers & payment status pills.
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                            tempInvoiceTemplate === "bold_emerald" ? "border-[#00E676]" : "border-slate-700"
                          }`}>
                            {tempInvoiceTemplate === "bold_emerald" && <div className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />}
                          </div>
                          <span className="text-[10px] font-bold font-mono text-slate-400">
                            {tempInvoiceTemplate === "bold_emerald" ? "Activated" : "Select Style"}
                          </span>
                        </div>
                      </div>

                      {/* Template 7: Compact POS Receipt */}
                      <div 
                        onClick={() => setTempInvoiceTemplate("compact_pos")}
                        className={`flex flex-col justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left select-none ${
                          tempInvoiceTemplate === "compact_pos"
                            ? "bg-[#00E676]/5 border-[#00E676] shadow shadow-[#00E676]/10"
                            : "bg-[#121214] border-slate-800 hover:border-slate-700 hover:bg-slate-900/45"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-500">Template 07</span>
                            <span className="text-[9px] bg-yellow-500/10 text-yellow-500 font-bold px-2 py-0.5 rounded uppercase font-mono">Thermal POS</span>
                          </div>
                          <h5 className="text-xs font-black text-white">Compact Thermal Ticket</h5>
                          <p className="text-[10px] text-slate-400 leading-normal font-sans">
                            Narrow receipts format optimized with high-density spacing. Compact font sizes and light dashed separators. Perfect for thermal desk rolls.
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                            tempInvoiceTemplate === "compact_pos" ? "border-[#00E676]" : "border-slate-700"
                          }`}>
                            {tempInvoiceTemplate === "compact_pos" && <div className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />}
                          </div>
                          <span className="text-[10px] font-bold font-mono text-slate-400">
                            {tempInvoiceTemplate === "compact_pos" ? "Activated" : "Select Style"}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* INVOICE TEMPLATE LIVE DEMO LAYOUT REPRESENTATION */}
                  <div className="space-y-4 p-5 bg-[#121214] border border-slate-800 rounded-xl" id="invoice-template-live-demo-preview">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-[11px] font-black uppercase tracking-widest font-mono text-slate-200">
                          Live PDF Design Blueprint Preview (Demo Mockup)
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase font-black">
                        Simulated Document Display
                      </span>
                    </div>

                    {/* DYNAMIC DESIGN CONTAINER */}
                    {(() => {
                      const styles = (() => {
                        switch (tempInvoiceTemplate) {
                          case "modern_minimal":
                            return {
                              container: "bg-white text-slate-900 border-2 border-teal-500/20 rounded-xl font-sans",
                              topAccent: "h-1 bg-gradient-to-r from-emerald-400 to-teal-500",
                              header: "pb-4 border-b border-teal-100",
                              primaryText: "text-teal-600 font-sans font-bold",
                              secondaryText: "text-slate-500 text-xs",
                              accentLine: "border-teal-100",
                              tableHeader: "bg-teal-50 text-teal-900 text-xs font-bold",
                              tableRow: "border-b border-slate-100 text-slate-700",
                              statusBadge: "border border-emerald-500 text-emerald-600 font-bold text-[10px] uppercase rounded-full px-2 py-0.5",
                              totalsBox: "border border-teal-200/60 bg-teal-50/20 text-slate-800 p-3 rounded-lg",
                              sigLine: "border-teal-200",
                              fontFamily: "font-sans",
                              sigColor: "text-slate-500"
                            };
                          case "premium_navy":
                            return {
                              container: "bg-[#FAFCFF] text-slate-1000 border border-blue-200 rounded-xl font-sans",
                              topAccent: "h-2 bg-blue-900",
                              header: "pb-4 border-b border-blue-100 bg-blue-50/50 p-4 rounded-t-lg",
                              primaryText: "text-blue-900 font-sans font-black tracking-normal",
                              secondaryText: "text-slate-500 text-xs",
                              accentLine: "border-blue-200",
                              tableHeader: "bg-blue-900 text-white text-xs font-bold",
                              tableRow: "border-b border-blue-50 text-slate-700",
                              statusBadge: "bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase rounded-lg px-2.5 py-0.5",
                              totalsBox: "border-2 border-blue-900 bg-blue-50/30 text-slate-800 p-3",
                              sigLine: "border-blue-900",
                              fontFamily: "font-sans",
                              sigColor: "text-slate-650"
                            };
                          case "cosmic_dark":
                            return {
                              container: "bg-[#18181B] text-zinc-300 border border-zinc-800 rounded-xl font-mono",
                              topAccent: "h-1 bg-[#00E676]",
                              header: "pb-3 border-b border-zinc-800 p-3 bg-zinc-900/60",
                              primaryText: "text-[#00E676] font-mono font-bold tracking-widest",
                              secondaryText: "text-zinc-500 text-[11px]",
                              accentLine: "border-[#00E676]/35",
                              tableHeader: "bg-zinc-800 text-zinc-100 text-xs font-mono tracking-tight",
                              tableRow: "border-b border-zinc-900 text-zinc-300",
                              statusBadge: "border border-[#00E676] text-[#00E676] text-[10px] font-bold rounded px-1.5 py-0.5 bg-[#00E676]/5",
                              totalsBox: "border border-zinc-800 bg-zinc-900/80 text-zinc-300 p-3",
                              sigLine: "border-zinc-750",
                              fontFamily: "font-mono",
                              sigColor: "text-zinc-500"
                            };
                          case "vintage_editorial":
                            return {
                              container: "bg-[#FEFBF6] text-amber-950 border border-amber-200 rounded-xl font-serif",
                              topAccent: "h-0.5 bg-amber-800 border-b border-amber-800",
                              header: "pb-4 border-b-2 border-double border-amber-300",
                              primaryText: "text-amber-800 font-serif font-black italic tracking-wide text-lg",
                              secondaryText: "text-amber-900/60 text-xs",
                              accentLine: "border-amber-305",
                              tableHeader: "bg-[#FEF3C7] text-amber-900 text-xs font-serif font-bold italic border-b border-amber-300",
                              tableRow: "border-b border-amber-100 text-amber-950",
                              statusBadge: "border border-amber-800 text-amber-800 font-serif font-black text-[10px] uppercase px-2 py-0.5 whitespace-nowrap",
                              totalsBox: "border border-amber-300 bg-amber-50/50 text-amber-900 p-3",
                              sigLine: "border-amber-800",
                              fontFamily: "font-serif",
                              sigColor: "text-amber-800"
                            };
                          case "bold_emerald":
                            return {
                              container: "bg-white text-slate-900 border border-emerald-500 rounded-xl font-sans",
                              topAccent: "h-2.5 bg-emerald-700",
                              header: "pb-4 border-b border-emerald-100 bg-emerald-50/20 p-3",
                              primaryText: "text-emerald-700 font-sans font-black tracking-tight",
                              secondaryText: "text-slate-600 text-xs",
                              accentLine: "border-emerald-200",
                              tableHeader: "bg-emerald-700 text-white text-xs font-bold",
                              tableRow: "border-b border-slate-100 text-slate-800",
                              statusBadge: "bg-emerald-600 text-white font-bold text-[10px] uppercase rounded px-2 py-0.5",
                              totalsBox: "border-l-4 border-emerald-700 bg-slate-50 text-slate-800 p-3 rounded-r-lg",
                              sigLine: "border-emerald-700",
                              fontFamily: "font-sans",
                              sigColor: "text-emerald-800"
                            };
                          case "compact_pos":
                            return {
                              container: "bg-white text-slate-950 border border-dashed border-slate-400 p-3 rounded font-mono max-w-sm mx-auto shadow-sm",
                              topAccent: "border-t border-dashed border-slate-400",
                              header: "text-center pb-3 border-b border-dashed border-slate-300",
                              primaryText: "text-slate-900 font-mono font-bold tracking-tighter text-medium uppercase",
                              secondaryText: "text-slate-500 text-[10px]",
                              accentLine: "border-dashed border-b border-slate-300",
                              tableHeader: "bg-slate-100 text-slate-800 text-[10px] font-bold border-y border-dashed border-slate-400 py-1",
                              tableRow: "border-b border-dashed border-slate-200 text-slate-800 text-[10px]",
                              statusBadge: "border border-slate-950 text-slate-950 text-[9px] font-mono font-semibold uppercase px-1 py-0.5",
                              totalsBox: "border border-dashed border-slate-400 bg-slate-50 p-2.5",
                              sigLine: "border-dashed border-slate-400",
                              fontFamily: "font-mono",
                              sigColor: "text-slate-600"
                            };
                          default: // classic
                            return {
                              container: "bg-slate-50 text-slate-900 border border-slate-200 rounded-xl font-sans",
                              topAccent: "h-1 bg-slate-800",
                              header: "pb-4 border-b border-slate-200 p-3",
                              primaryText: "text-slate-900 font-sans font-extrabold tracking-tight",
                              secondaryText: "text-slate-500 text-xs",
                              accentLine: "border-slate-200",
                              tableHeader: "bg-slate-900 text-white text-xs font-bold",
                              tableRow: "border-b border-slate-200 text-slate-800",
                              statusBadge: "bg-slate-900 text-white font-bold text-[10px] uppercase rounded px-2.5 py-0.5",
                              totalsBox: "border border-slate-900 bg-slate-100 text-slate-900 p-3",
                              sigLine: "border-slate-900",
                              fontFamily: "font-sans",
                              sigColor: "text-slate-900"
                            };
                        }
                      })();

                      return (
                        <div className={`p-4 border rounded-xl overflow-hidden transition-all duration-300 ${styles.container}`}>
                          {/* Top Accent line strip */}
                          <div className={styles.topAccent} />

                          {/* Inner Content spacing */}
                          <div className="space-y-4 pt-3 text-left">
                            
                            {/* Brand and Metadata Header block */}
                            <div className={`flex flex-row items-center justify-center text-left gap-6 w-full border-b pb-4 ${styles.header}`}>
                              {tempShowLogo && tempLogoBase64 && (
                                <div className="flex-shrink-0 self-center">
                                  {tempLogoBase64.startsWith("data:") || tempLogoBase64.startsWith("http") ? (
                                    <img
                                      src={tempLogoBase64}
                                      alt="Company Logo"
                                      className="h-24 w-auto object-contain max-w-[160px] self-center"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-24 h-24 rounded-full bg-slate-500/15 flex items-center justify-center text-3xl font-black text-slate-750 dark:text-zinc-250 border border-slate-500/20 self-center shadow-sm">
                                      {tempLogoBase64.substring(0, 3)}
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="flex-initial flex flex-col items-start justify-center self-center space-y-1">
                                <h4 className={`text-xl sm:text-2xl md:text-3xl font-black tracking-tight ${styles.primaryText}`}>
                                  {businessInfo?.name || "BARAKAH E-MART"}
                                </h4>
                                <p className={`${styles.secondaryText} text-xs sm:text-sm mt-1 max-w-xl font-medium text-left`}>
                                  {businessInfo?.address || "Mirpur Showroom Complex, Dhaka, Bangladesh"}
                                </p>
                                <p className={`${styles.secondaryText} text-xs sm:text-sm mt-0.5 max-w-xl font-medium text-left`}>
                                  Phone: {businessInfo?.phoneNumber || "+880 1987-654321"} {businessInfo?.email ? ` | Email: ${businessInfo.email}` : ""} {businessInfo?.vatRegNo ? ` | VAT: ${businessInfo.vatRegNo}` : ""}
                                </p>
                              </div>
                            </div>

                            {/* Client particulars bill to container */}
                            <div className={`p-4 bg-opacity-70 border rounded-xl ${styles.accentLine} bg-neutral-200/5`}>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Left Column: INVOICE DETAILS */}
                                <div className="space-y-1">
                                  <div className="text-[9px] font-mono tracking-wider text-slate-400 uppercase font-bold">
                                    INVOICE METADATA DETAILS:
                                  </div>
                                  <div className={`text-xs font-bold ${styles.primaryText.split(" ")[0]}`}>
                                    INVOICE #: INV-2026-6202
                                  </div>
                                  <p className={styles.secondaryText}>Issue Date: 03/06/2026</p>
                                  <p className={styles.secondaryText}>Issue Time: 02:45 PM</p>
                                  <p className={styles.secondaryText}>Sales Agent: Showroom Account Executive</p>
                                  <p className={styles.secondaryText}>Payment Mode: CASH / MOB-PAY</p>
                                </div>

                                {/* Right Column: CUSTOMER BIOGRAPHY & SHIPPING ADDRESS */}
                                <div className="space-y-1">
                                  <div className="text-[9px] font-mono tracking-wider text-slate-400 uppercase font-bold">
                                    CUSTOMER & SHIPPING DETAILS:
                                  </div>
                                  <div className="text-xs font-black text-slate-900 dark:text-zinc-100">Mst. Sabrina Rahman</div>
                                  <div className={styles.secondaryText}>Phone: +880 1712-345678</div>
                                  <div className={styles.secondaryText}>Address: House 12, Sector 10, Uttara, Dhaka</div>
                                </div>
                              </div>
                            </div>

                            {/* Itemized list of values */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className={styles.tableHeader}>
                                    <th className="p-1 px-2 text-[10px] w-8">SL</th>
                                    <th className="p-1 px-2 text-[10px]">Item Details / SKU</th>
                                    <th className="p-1 px-2 text-[10px] text-center w-12">Qty</th>
                                    <th className="p-1 px-2 text-[10px] text-right w-24">Unit Rate</th>
                                    <th className="p-1 px-2 text-[10px] text-right w-28">Total BDT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className={styles.tableRow}>
                                    <td className="p-1.5 px-2 text-xs font-mono">01</td>
                                    <td className="p-1.5 px-2 text-xs font-bold text-slate-850 dark:text-zinc-100">
                                      Walton Primo H10 (Elite Black, 8/128)
                                    </td>
                                    <td className="p-1.5 px-2 text-xs text-center font-mono">1</td>
                                    <td className="p-1.5 px-2 text-xs text-right font-mono">14,500.00</td>
                                    <td className="p-1.5 px-2 text-xs text-right font-mono">14,500.00</td>
                                  </tr>
                                  <tr className={styles.tableRow}>
                                    <td className="p-1.5 px-2 text-xs font-mono">02</td>
                                    <td className="p-1.5 px-2 text-xs font-bold text-slate-850 dark:text-zinc-100">
                                      Gree 1.5 Ton Split AC (Inverter-Extreme)
                                    </td>
                                    <td className="p-1.5 px-2 text-xs text-center font-mono">1</td>
                                    <td className="p-1.5 px-2 text-xs text-right font-mono">65,000.00</td>
                                    <td className="p-1.5 px-2 text-xs text-right font-mono">65,000.00</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* Summary Calculations and Signatures */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                              {/* Left column declaration wordings - FLUSHED AND CLEAN ALIGNMENT */}
                              <div className="space-y-4 pl-0 text-left">
                                <div className="pl-0">
                                  <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider font-mono">
                                    TOTAL BILL IN WORDS:
                                  </span>
                                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block mt-0.5 pl-0">
                                    Seventy-Seven Thousand BDT Only.
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-550 dark:text-zinc-400 space-y-1 pl-0 font-sans leading-relaxed">
                                  <strong className="block text-slate-705 dark:text-zinc-300 uppercase text-[9px] tracking-wider">OFFICIAL WARRANTY, TERMS & CONDITIONS:</strong>
                                  <div>1. Original cash receipt/invoice is strictly required for any warranty or replacement registration claims.</div>
                                  <div>2. Warranty is void if products display physical damage, burned ICs, power surge trails, or fluid exposure.</div>
                                  <div>3. Discrepancies if any must be brought to notice of the showroom management within 3 days of product issue.</div>
                                   {/* Right column calculated totals - REDESIGNED PREMIUM & STRUCTURED PANEL */}
                              <div className="pl-0">
                                <div className={`space-y-2.5 rounded-xl p-4 border border-slate-200/80 dark:border-zinc-805/40 bg-slate-50/50 dark:bg-zinc-900/30 backdrop-blur-sm`}>
                                  <div className="flex justify-between items-center text-xs text-slate-600 dark:text-zinc-400">
                                    <span className="font-sans font-medium">Gross Subtotal:</span>
                                    <span className="font-mono font-bold text-right">79,500.00 BDT</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs text-slate-600 dark:text-zinc-400">
                                    <span className="font-sans font-medium">VAT Surcharges (0.00%):</span>
                                    <span className="font-mono font-bold text-right">0.00 BDT</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs text-rose-500 font-medium pb-0.5">
                                    <span className="font-sans font-bold">Special Discount:</span>
                                    <span className="font-mono font-bold text-right">-2,500.00 BDT</span>
                                  </div>
                                  
                                  <div className="border-t border-slate-250 dark:border-zinc-800 my-1 pb-1" />
                                  
                                  <div className="flex justify-between items-center bg-slate-900/5 dark:bg-white/5 p-2 rounded-lg border border-slate-900/10 dark:border-white/10">
                                    <span className="text-xs font-black text-slate-1000 dark:text-white uppercase tracking-wider font-sans">
                                      GRAND BILL TOTAL:
                                    </span>
                                    <span className="font-mono text-sm font-black text-slate-900 dark:text-white text-right">
                                      77,000.00 BDT
                                    </span>
                                  </div>
                                  
                                  <div className="flex justify-between items-center text-xs text-emerald-600 font-bold px-1">
                                    <span>Total Cash Received:</span>
                                    <span className="font-mono text-right">77,000.00 BDT</span>
                                  </div>
 
                                  <div className="border-t border-slate-250 dark:border-zinc-800 my-1 pb-1" />
 
                                  {/* CONDITIONAL STATUS STYLING BADGES */}
                                  <div className="space-y-2 pt-1">
                                    {/* Demo state for Paid - Centered badge/stamp highlight, hiding plain text */}
                                    <div className="flex justify-center items-center bg-emerald-100 dark:bg-emerald-950/40 border-2 border-dashed border-emerald-500/50 px-4 py-2 rounded-xl shadow-inner">
                                      <span className="text-xs font-black text-emerald-850 dark:text-emerald-400 uppercase tracking-widest font-sans flex items-center gap-1.5 font-bold">
                                        ★ FULL PAID ★
                                      </span>
                                    </div>
                                    
                                    {/* Demo state for Due (to fulfill the conditional DUE styling preview beautifully) */}
                                    <div className="flex justify-between items-center bg-rose-50 dark:bg-rose-950/25 border border-rose-200/50 dark:border-rose-800/30 px-3 py-1.5 rounded-lg">
                                      <span className="text-[10px] font-bold text-rose-800 dark:text-rose-450 uppercase tracking-wider font-sans">
                                        Dues Outstanding:
                                      </span>
                                      <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 font-mono text-right font-bold">
                                        15,500.00 BDT
                                      </span>
                                    </div>
                                  </div>
 
                                </div>
                              </div>                             </div>
                              </div>
                            </div>

                            {/* Stamp and Authorization Sigs */}
                            <div className="grid grid-cols-2 gap-4 pt-6 text-center">
                              <div className="space-y-1">
                                <span className="border-b border-slate-300 block w-full mx-auto max-w-[140px] pt-4" />
                                <span className={`text-[9px] font-extrabold uppercase tracking-widest block font-mono ${styles.sigColor}`}>
                                  CUSTOMER SIGN-OFF
                                </span>
                              </div>
                              <div className="space-y-1">
                                <span className={`border-b block w-full mx-auto max-w-[140px] pt-3 ${styles.sigLine}`} />
                                <span className={`text-[9px] font-extrabold uppercase tracking-widest block font-mono ${styles.sigColor}`}>
                                  AUTHORIZED BRAND SIGN
                                </span>
                              </div>
                            </div>

                          </div>
                        </div>
                      );
                    })()}
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
                            <span className="text-[10px] text-slate-500 block">No Custom Logo</span>
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
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-slate-950"></div>
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
                      className="w-full px-4 py-2.5 bg-[#121214] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-sans leading-relaxed transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500/20"
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
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-slate-950"></div>
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
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-slate-950"></div>
                      </label>
                    </div>

                  </div>

                  {/* Logo Alignment and Invoice Counter settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800/60">
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 block">Logo Alignment on PDF Invoice</label>
                      <div className="grid grid-cols-3 gap-2 bg-[#121214] p-1.5 border border-slate-800 rounded-xl">
                        {(["left", "center", "right"] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => setTempLogoAlignment(align)}
                            className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer uppercase font-mono ${
                              tempLogoAlignment === align
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 shadow"
                                : "text-slate-400 hover:text-white hover:bg-slate-800/10"
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                      <p className="text-[9px] text-slate-500 italic pl-1 leading-normal block font-sans">
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
                        className="w-full px-4 py-2.5 bg-[#121214] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500/20"
                        placeholder="e.g. 1001 or 50001"
                      />
                      <p className="text-[9px] text-slate-500 italic pl-1 leading-normal block font-sans">
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
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-slate-950"></div>
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
                                      ? "bg-emerald-500/10 border-emerald-500/80 text-emerald-400 font-sans" 
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
                              className="w-full px-3 py-2 bg-[#1E1E24] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 transition-all"
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
                            <span className="text-[9px] text-slate-500 italic leading-normal">
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
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow shadow-emerald-500/10 hover:from-emerald-400 hover:to-emerald-300 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    Save Customizations
                  </button>
                </div>
              </div>

              {/* 3. Sales Panel Restrictions Block */}
              <div className="bg-[#1E1E24]/95 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl" id="settings-sales-restrictions-block">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                    <SlidersHorizontal className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Sales Panel & Assistant Restrictions</h4>
                    <p className="text-[10px] text-slate-400">Define write-access safety toggles for ordinary salesmen terminals.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  
                  <div className="flex items-center justify-between p-3 bg-[#121214] border border-slate-850 rounded-xl">
                    <div className="space-y-0.5 max-w-[80%] pr-2">
                      <span className="text-xs font-bold text-white block">Allow salesman to edit historical Sales</span>
                      <span className="text-[10px] text-[#A0A0A5] leading-normal block">If disabled, edits on existing memos are locked to admin authority view.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input 
                        type="checkbox"
                        checked={tempCanEditSales}
                        onChange={(e) => setTempCanEditSales(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-slate-950"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#121214] border border-slate-850 rounded-xl">
                    <div className="space-y-0.5 max-w-[80%] pr-2">
                      <span className="text-xs font-bold text-white block">Allow salesman to delete transactions</span>
                      <span className="text-[10px] text-[#A0A0A5] leading-normal block">If disabled, transaction erasures are securely locked to the core admin.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input 
                        type="checkbox"
                        checked={tempCanDeleteSales}
                        onChange={(e) => setTempCanDeleteSales(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-slate-950"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#121214] border border-slate-850 rounded-xl">
                    <div className="space-y-0.5 max-w-[80%] pr-2">
                      <span className="text-xs font-bold text-white block">Allow salesman to override unit prices inside Cart</span>
                      <span className="text-[10px] text-[#A0A0A5] leading-normal block">If disabled, salesmen cannot manipulate retail pricing blocks for custom invoice outputs.</span>
                    </div>
                    <label className="relative inline-flex inline-flex items-center cursor-pointer select-none shrink-0">
                      <input 
                        type="checkbox"
                        checked={tempCanOverridePrices}
                        onChange={(e) => setTempCanOverridePrices(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-slate-950"></div>
                    </label>
                  </div>

                </div>

                <div className="pt-3 border-t border-slate-850 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveSalesRestrictions}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow shadow-emerald-500/10 hover:from-emerald-400 hover:to-emerald-300 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    Save Restrictions
                  </button>
                </div>
              </div>

              {/* 3. Panel Passcodes & Account Security Settings */}
              <div className="bg-[#1E1E24]/95 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl animate-fadeIn" id="settings-panel-passcode-block">
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Security Locks & Panel Passcodes</h4>
                    <p className="text-[10px] text-slate-400">Set standard 4-digit code pins to protect Admin capabilities and restrict ordinary Cashier/Salesman terminals.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400 pl-1 block">
                      Admin Panel Passcode (Owner Key)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={8}
                        value={tempAdminPasscode}
                        onChange={(e) => setTempAdminPasscode(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 1234"
                        className="w-full px-4 py-2.5 bg-[#121214] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono font-bold transition-all placeholder:text-slate-700 focus:ring-1 focus:ring-emerald-500/20"
                      />
                    </div>
                    <span className="text-[9px] text-slate-500 font-sans block pl-1 leading-normal">
                      Required PIN to access Admin dashboard, purchases ledger, expenses ledger, and critical settings.
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400 pl-1 block">
                      Sales Panel Passcode (Cashier Key)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={8}
                        value={tempSalesPasscode}
                        onChange={(e) => setTempSalesPasscode(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 5555"
                        className="w-full px-4 py-2.5 bg-[#121214] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-cyan-500 font-mono font-bold transition-all placeholder:text-slate-700 focus:ring-1 focus:ring-cyan-500/20"
                      />
                    </div>
                    <span className="text-[9px] text-slate-500 font-sans block pl-1 leading-normal">
                      Required PIN for salesmen to lock admin view or operate standard checkout registers.
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-850 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveSecurityPasscodes}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow shadow-emerald-500/10 hover:from-emerald-400 hover:to-emerald-300 active:scale-95"
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
                  <span className="text-emerald-400 font-bold">BarakahBillPro v2.4.5 (Premium)</span>
                </p>
                <p className="flex justify-between">
                  <span>Pin encryption level:</span>
                  <span className="text-sky-400">AES-256 Cloud Backup Sync OK</span>
                </p>
              </div>

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

              {/* 5. Deleted Items Management - Soft Deletion / "Trash Window" */}
              <div className="bg-[#1E1E24]/95 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl animate-fadeIn" id="settings-deleted-filter-block">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                      <Trash2 className="w-5 h-5 flex-shrink-0" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white font-sans">Deleted Items Trash Filter</h4>
                      <p className="text-[10px] text-slate-400 leading-normal font-sans">Soft-deleted sales, customer profiles, purchases, and expenses are protected here before permanent cloud wipeout.</p>
                    </div>
                  </div>
                  {deletedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (currentPanel !== "admin") {
                          triggerNotification("Restricted Action: Only administrators can empty the trash! 🛑", "error");
                          return;
                        }
                        if (confirm("Are you sure you want to permanently delete all items in the trash? This physical deletion cannot be undone! ⚠️")) {
                          deletedItems.forEach(item => {
                            let cloudCol = "transactions";
                            if (item.type === "customer") cloudCol = "customers";
                            if (item.type === "expense") cloudCol = "expenses";
                            if (item.type === "product") cloudCol = "products";
                            if (item.type === "purchase") cloudCol = "purchases";
                            deleteCloudDocument(cloudCol, item.originalId).catch(err => console.warn("Permanent purge fail:", err));
                          });
                          setDeletedItems([]);
                          triggerNotification("Trash cleared completely and deleted permanently. 🤝", "success");
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-950/20 hover:bg-rose-900/40 border border-rose-500/30 hover:border-rose-500 text-rose-450 hover:text-white font-mono text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                    >
                      Empty Trash ({deletedItems.length})
                    </button>
                  )}
                </div>

                {deletedItems.length === 0 ? (
                  <div className="py-6 text-center space-y-2">
                    <p className="text-slate-500 text-xs font-sans">No deleted logs or pending trash database items found.</p>
                    <p className="text-[10px] text-slate-600 max-w-lg mx-auto font-sans leading-relaxed">
                      Customers, sales transactions, purchases, or expenses that you delete from primary panels are stored here in this safety buffer. You can choose to restore them back to active list or permanently delete them.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {deletedItems.map((item) => {
                      let typeLabel = "Sale";
                      let typeColor = "text-emerald-400 bg-emerald-500/5 border-emerald-500/10";
                      if (item.type === "customer") {
                        typeLabel = "Partner";
                        typeColor = "text-sky-400 bg-sky-500/5 border-sky-500/10";
                      } else if (item.type === "expense") {
                        typeLabel = "Expense";
                        typeColor = "text-purple-400 bg-purple-500/5 border-purple-500/10";
                      } else if (item.type === "product") {
                        typeLabel = "Product";
                        typeColor = "text-amber-400 bg-amber-500/5 border-amber-500/10";
                      } else if (item.type === "purchase") {
                        typeLabel = "Purchase";
                        typeColor = "text-pink-400 bg-pink-500/5 border-pink-500/10";
                      }

                      return (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#121214] border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-mono border font-semibold ${typeColor}`}>
                                {typeLabel}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono">
                                {new Date(item.deletedAt).toLocaleString()}
                              </span>
                            </div>
                            <h5 className="text-xs font-semibold text-slate-200 font-sans">{item.label}</h5>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.type === "sale") {
                                  if (!transactions.some(t => t.id === item.originalId)) {
                                    setTransactions(prev => [item.data, ...prev]);
                                  }
                                } else if (item.type === "customer") {
                                  if (!contacts.some(c => c.id === item.originalId)) {
                                    setContacts(prev => [item.data, ...prev]);
                                  }
                                } else if (item.type === "expense") {
                                  if (!expenses.some(e => e.id === item.originalId)) {
                                    setExpenses(prev => [item.data, ...prev]);
                                  }
                                } else if (item.type === "product") {
                                  if (!products.some(p => p.id === item.originalId)) {
                                    setProducts(prev => [item.data, ...prev]);
                                  }
                                } else if (item.type === "purchase") {
                                  if (!purchases.some(p => p.id === item.originalId)) {
                                    setPurchases(prev => [item.data, ...prev]);
                                  }
                                }
                                setDeletedItems(prev => prev.filter(x => x.id !== item.id));
                                triggerNotification("Item successfully restored back to main list! 🚀", "success");
                              }}
                              className="px-2.5 py-1 text-[9px] bg-emerald-500/10 hover:bg-[#00E676] text-[#00E676] hover:text-slate-950 font-bold uppercase rounded-lg border border-[#00E676]/20 transition-all cursor-pointer font-sans"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (currentPanel !== "admin") {
                                  triggerNotification("Restricted Action: Only administrators can delete permanently! 🛑", "error");
                                  return;
                                }
                                if (confirm("Execute permanent cloud wipeout on this item? This physical deletion cannot be undone! 😡")) {
                                  let cloudCol = "transactions";
                                  if (item.type === "customer") cloudCol = "customers";
                                  if (item.type === "expense") cloudCol = "expenses";
                                  if (item.type === "product") cloudCol = "products";
                                  if (item.type === "purchase") cloudCol = "purchases";

                                  deleteCloudDocument(cloudCol, item.originalId)
                                    .then(() => {
                                      setDeletedItems(prev => prev.filter(x => x.id !== item.id));
                                      triggerNotification("Item permanently erased from record.", "success");
                                    })
                                    .catch(err => {
                                      console.warn("Permanent erase failed:", err);
                                      setDeletedItems(prev => prev.filter(x => x.id !== item.id));
                                      triggerNotification("Item discarded.", "success");
                                    });
                                }
                              }}
                              className="px-2.5 py-1 text-[9px] bg-rose-500/10 hover:bg-rose-550 text-rose-450 hover:text-white font-bold uppercase rounded-lg border border-rose-500/20 transition-all cursor-pointer font-sans"
                            >
                              Wipe Permanent
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* WORKSPACE COMPREHENSIVE TERMINAL FOOTER */}
        <footer className="bg-white border-t border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between text-[10px] text-slate-500 font-mono" id="terminal-footer">
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
                <label className="text-[10px] uppercase font-mono tracking-wide text-slate-500 font-bold block">Collection Amount ({businessInfo.currencySymbol})</label>
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
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-500 font-bold block">Invoice Date / Time</label>
                  <input
                    type="datetime-local"
                    value={format(new Date(editingTx.date), "yyyy-MM-dd'T'HH:mm")}
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
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-500 font-bold block">Set Customer contact</label>
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
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 font-bold text-[10px] uppercase text-slate-500 font-mono">Invoice items</div>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {editingTx.items.map((item, idx) => {
                    const matchedProd = products.find(p => p.id === item.productId || p.id === item.id || p.name === item.name);
                    return (
                      <div key={idx} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                        <div className="space-y-0.5 font-sans min-w-[140px]">
                          <strong className="font-bold text-slate-800 block text-xs">{matchedProd ? matchedProd.name : (item.name || "Unknown Item")}</strong>
                          <span className="text-[9px] text-slate-500 font-mono block">
                            Catalog rate: {businessInfo.currencySymbol || "৳"}{(matchedProd ? matchedProd.sellPrice : (item.price ?? 0)).toLocaleString()}/unit
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5">
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
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-500 font-bold block">Invoice Discount ({businessInfo.currencySymbol})</label>
                  <input
                    type="number"
                    value={editingTx.discount}
                    onChange={(e) => setEditingTx({ ...editingTx, discount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-705 outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-500 font-bold block">Amount Paid ({businessInfo.currencySymbol})</label>
                  <input
                    type="number"
                    value={editingTx.paidAmount}
                    onChange={(e) => setEditingTx({ ...editingTx, paidAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-705 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 font-sans">
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
                onClick={() => setEditingTx(null)}
                className="flex-1 py-1 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl h-10 transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {(() => {
        const expenseToDelete = deleteExpenseId ? expenses.find(e => e.id === deleteExpenseId) : null;
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
                  onClick={() => {
                    if (currentPanel !== "admin") {
                      triggerNotification("Security block: Only administrators are authorized to delete expense vouchers! 🛑", "error");
                      setDeleteExpenseId(null);
                      return;
                    }
                    softDeleteItem("expense", expenseToDelete.id, expenseToDelete, `Expense Voucher: ${expenseToDelete.category} - ${expenseToDelete.description || "No info"} (${businessInfo.currencySymbol || "৳"}${expenseToDelete.amount})`);
                    setExpenses(expenses.filter(item => item.id !== expenseToDelete.id));
                    triggerNotification("Expense voucher moved to Settings -> Deleted Filter.", "success");
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
                  rows={3}
                  value={editExpenseDesc}
                  onChange={(e) => setEditExpenseDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 font-sans leading-normal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">
                    Category
                  </label>
                  <select
                    value={editExpenseCategory}
                    onChange={(e) => setEditExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-slate-200 outline-none focus:border-emerald-500 font-mono"
                  >
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono tracking-wide text-slate-400 font-bold block">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editExpenseDate}
                    onChange={(e) => setEditExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0d14]/90 backdrop-blur-xl border-t border-[#1e293b]/70 pb-safe flex items-center justify-around h-16 shadow-[0_-10px_35px_rgba(0,0,0,0.6)]" id="mobile-bottom-navbar">
        {/* POS Button */}
        <button
          onClick={() => {
            setActiveTab("pos");
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 relative ${
            activeTab === "pos" ? "text-[#00E676] scale-105 font-bold" : "text-[#94a3b8] hover:text-white"
          }`}
        >
          <ShoppingCart className="w-[18px] h-[18px] mb-1" />
          <span className="text-[9px] font-semibold tracking-wide">POS</span>
          {activeTab === "pos" && (
            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#00E676] animate-pulse" />
          )}
        </button>

        {/* Dashboard Button */}
        <button
          onClick={() => {
            if (currentPanel === "admin") {
              setActiveTab("dashboard");
            } else {
              triggerNotification("Please log in as Admin to see dashboard", "info");
            }
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 relative ${
            activeTab === "dashboard" ? "text-[#00E676] scale-105 font-bold" : "text-[#94a3b8] hover:text-white"
          }`}
        >
          <LayoutDashboard className="w-[18px] h-[18px] mb-1" />
          {/* Label word Dashboard removed for clean mobile design */}
          {activeTab === "dashboard" && (
            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#00E676] animate-pulse" />
          )}
        </button>

        {/* Transactions & Ledger */}
        <button
          onClick={() => {
            if (currentPanel === "admin") {
              setActiveTab("ledger");
            } else {
              triggerNotification("Please log in as Admin to see Ledger", "info");
            }
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 relative ${
            activeTab === "ledger" ? "text-[#00E676] scale-105 font-bold" : "text-[#94a3b8] hover:text-white"
          }`}
        >
          <FileText className="w-[18px] h-[18px] mb-1" />
          <span className="text-[9px] font-semibold tracking-wide font-sans">Ledger</span>
          {activeTab === "ledger" && (
            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#00E676] animate-pulse" />
          )}
        </button>

        {/* Menu/More Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 relative ${
            isMobileMenuOpen ? "text-[#00E676] scale-105" : "text-[#94a3b8] hover:text-white"
          }`}
        >
          <Menu className="w-[18px] h-[18px] mb-1" />
          <span className="text-[9px] font-semibold tracking-wide font-sans">More</span>
          {isMobileMenuOpen && (
            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#00E676]" />
          )}
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
            className="relative ml-auto w-72 max-w-[85vw] h-full bg-[#1E1E24] shadow-2xl flex flex-col justify-between border-l border-[#2A2A32] z-50 transition-all duration-300"
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
                  <>
                    {/* Category 1: Core Operations */}
                    <div className="space-y-1 bg-[#212127] p-2.5 rounded-xl border border-[#2b2b35] mb-2.5">
                      <span className="text-[9px] uppercase tracking-widest text-[#00E676] font-extrabold block pl-0.5 mb-2 font-mono">Core Operations</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "pos", label: "Sales / POS", desc: "Checkout desk", Icon: ShoppingCart },
                          { id: "dashboard", label: "Dashboard", desc: "Live report stats", Icon: LayoutDashboard },
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
                              className={`flex flex-col text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                                isActive 
                                  ? 'bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30 font-bold' 
                                  : 'bg-[#131117] text-slate-300 border-[#22222a] hover:bg-slate-800'
                              }`}
                            >
                              <Icon className="w-4 h-4 mb-1 text-[#00E676]" />
                              <span className="text-[11px] font-black leading-tight">{item.label}</span>
                              <span className="text-[8px] text-slate-400 font-normal mt-0.5">{item.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Category 2: Stocks & Catalog */}
                    <div className="space-y-1 bg-[#212127] p-2.5 rounded-xl border border-[#2b2b35] mb-2.5">
                      <span className="text-[9px] uppercase tracking-widest text-[#00E676] font-extrabold block pl-0.5 mb-2 font-mono">Stocks & Catalog</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "products", label: "Products", desc: "Current stock", Icon: Package },
                          { id: "purchases", label: "Purchases", desc: "Supplier lot", Icon: PlusCircle },
                          { id: "inventory", label: "Inventory", desc: "Below threshold", Icon: Bookmark },
                          { id: "negative-sales", label: "Negative Stock Log", desc: "Overdraft list", Icon: TrendingDown, color: "text-rose-450", activeBg: "bg-rose-500/10 text-rose-405 border-rose-500/30" },
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
                              className={`flex flex-col text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                                isActive 
                                  ? item.activeBg ? item.activeBg : 'bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30 font-bold' 
                                  : 'bg-[#131117] text-slate-300 border-[#22222a] hover:bg-slate-800'
                              }`}
                            >
                              <Icon className={`w-4 h-4 mb-1 ${item.color || 'text-slate-300'}`} />
                              <span className="text-[11px] font-black leading-tight">{item.label}</span>
                              <span className="text-[8px] text-slate-400 font-normal mt-0.5">{item.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Category 3: Financial Ledger */}
                    <div className="space-y-1 bg-[#212127] p-2.5 rounded-xl border border-[#2b2b35] mb-2.5">
                      <span className="text-[9px] uppercase tracking-widest text-[#00E676] font-extrabold block pl-0.5 mb-2 font-mono">Ledgers & Accounts</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "ledger", label: "Transactions & Ledger", desc: "All cashflows", Icon: FileText },
                          { id: "expenses", label: "Expenses Ledger", desc: "Bills & costs", Icon: PiggyBank },
                          { id: "contacts", label: "Customers & CRM", desc: "CRM profiles", Icon: Users },
                          { id: "reports", label: "Reports Dashboard", desc: "Daily statement", Icon: BarChart3 },
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
                              className={`flex flex-col text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                                isActive 
                                  ? 'bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30 font-bold' 
                                  : 'bg-[#131117] text-slate-300 border-[#22222a] hover:bg-slate-800'
                              }`}
                            >
                              <Icon className="w-4 h-4 mb-1 text-[#00E676]" />
                              <span className="text-[11px] font-black leading-tight">{item.label}</span>
                              <span className="text-[8px] text-slate-400 font-normal mt-0.5">{item.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Category 4: Management & System */}
                    <div className="space-y-1 bg-[#212127] p-2.5 rounded-xl border border-[#2b2b35]">
                      <span className="text-[9px] uppercase tracking-widest text-[#00E676] font-extrabold block pl-0.5 mb-2 font-mono">Management & System</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "staff", label: "Staff Management", desc: "Salary sheets", Icon: UserCheck },
                          { id: "settings", label: "Settings", desc: "Cloud backup", Icon: Settings },
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
                              className={`flex flex-col text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                                isActive 
                                  ? 'bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30 font-bold' 
                                  : 'bg-[#131117] text-slate-300 border-[#22222a] hover:bg-slate-800'
                              }`}
                            >
                              <Icon className={`w-4 h-4 mb-1 text-[#00E676]`} />
                              <span className="text-[11px] font-black leading-tight">{item.label}</span>
                              <span className="text-[8px] text-slate-400 font-normal mt-0.5">{item.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {[
                      { id: "pos", label: "Sales / POS", desc: "Build shopping baskets & print bills", Icon: ShoppingCart },
                      { id: "contacts", label: "Customers & CRM", desc: "Due balances & contact logs", Icon: Users },
                      { id: "products", label: "Products", desc: "Real-time standard stock index", Icon: Package },
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

    </div>
  );
}
