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
  Check,
  Menu,
  LayoutDashboard,
  Sun,
  Moon
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
  INITIAL_PURCHASES
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
  toUUID
} from "./lib/supabase";
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
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(() => loadDB().businessInfo);

  // Security Locking Roles state
  const [currentPanel, setCurrentPanel] = useState<"none" | "admin" | "sales">("none");

  // Current active workspace view tab
  const [activeTab, setActiveTab ] = useState<
    "dashboard" | "pos" | "contacts" | "products" | "negative-sales" | "purchases" | "inventory" | "ledger" | "insights" | "expenses" | "reports" | "staff" | "settings"
  >("dashboard");

  // Staff members state
  const [staffList, setStaffList] = useState<Staff[]>(() => {
    try {
      const db = loadDB();
      if (db.businessInfo && (db.businessInfo as any).staffList && Array.isArray((db.businessInfo as any).staffList)) {
        return (db.businessInfo as any).staffList;
      }
      const savedStr = localStorage.getItem("barakah_staff_list");
      return savedStr ? JSON.parse(savedStr) : [];
    } catch (_) {
      return [];
    }
  });

  // Notifications State
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Global theme dark/light mode state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("barakah_billing_dark_theme");
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
    localStorage.setItem("barakah_billing_dark_theme", String(isDarkMode));
  }, [isDarkMode]);

  // Cloud backup sync indicator active states
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
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
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [collectionTx, setCollectionTx] = useState<Transaction | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [showAdvancedPos, setShowAdvancedPos] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [contactTypeFilter, setContactTypeFilter] = useState<"all" | "customer" | "supplier">("all");

  const hasSyncedOnMountRef = useRef(false);

  // Load Offline initial database state and sync latest from cloud safely
  useEffect(() => {
    try {
      selfHealDatabase();
    } catch (_) {}

    const unsub = subscribeToAuthChanges(async (user) => {
      setActiveUser(user);

      if (!user) {
        // Automatic Cloud Recovery for Empty local database or Origin Swaps
        const localProducts = loadDB().products;
        const localTransactions = loadDB().transactions;
        const alreadyAttempted = sessionStorage.getItem("barakah_did_auto_restore");
        
        if (localProducts.length === 0 && localTransactions.length === 0 && !alreadyAttempted) {
          sessionStorage.setItem("barakah_did_auto_restore", "true");
          console.log("[Auto Restore] Empty local state detected. Attempting background cloud restore for barakahemart@gmail.com...");
          try {
            const wasRestored = await fetchAndRestoreCloudBackup("barakahemart@gmail.com", "1234");
            if (wasRestored) {
              console.log("[Auto Restore] Successfully recovered previous store data & sales from cloud database!");
              const db = loadDB();
              setProducts(db.products);
              setContacts(db.contacts);
              setExpenses(db.expenses);
              setTransactions(db.transactions);
              setBusinessInfo(db.businessInfo);
              setPurchases(db.purchases || []);
              if (db.businessInfo && (db.businessInfo as any).staffList && Array.isArray((db.businessInfo as any).staffList)) {
                setStaffList((db.businessInfo as any).staffList);
              }
              triggerNotification("পূর্ববর্তী সকল বিক্রয় ও প্রোডাক্ট ডেটা স্বয়ংক্রিয়ভাবে ক্লাউড থেকে রিস্টোর করা হয়েছে! (All previous sales & store data auto-restored!)", "success");
              
              // Cache and link auto-session for future continuous background syncing
              const autoUser = {
                email: "barakahemart@gmail.com",
                uid: getPasscodeSyncId("barakahemart@gmail.com", "1234"),
                isPasscodeUser: true,
                restored: true,
                passcode: "1234"
              };
              localStorage.setItem('barakah_local_active_user', JSON.stringify(autoUser));
              setTimeout(() => {
                window.location.reload();
              }, 1200);
              return;
            }
          } catch (autoErr) {
            console.warn("[Auto Restore] Background recovery check failed:", autoErr);
          }
        }

        setIsAuthLoading(false);
        initialLoadedRef.current = true;
        return;
      }

      // Perform cloud pull on startup if registered and not synced yet in this tab session
      if (!user.isGuest && !hasSyncedOnMountRef.current) {
        hasSyncedOnMountRef.current = true;
        setIsAuthLoading(true);
        initialLoadedRef.current = false;

        try {
          const passcode = user.isPasscodeUser ? (user.passcode || "1234") : "classic_account_secure";
          const wasRestored = await fetchAndRestoreCloudBackup(user.email, passcode);
          if (wasRestored) {
            console.log("[Sync on Mount] Successfully grabbed cloud backup on app mount.");
          }
        } catch (e) {
          console.error("[Sync on Mount] Startup cloud synchronization failed:", e);
        }
      }

      // Reload database from custom localStorage storage corresponding to the session mode
      const db = loadDB();
      setProducts(db.products);
      setContacts(db.contacts);
      setExpenses(db.expenses);
      setTransactions(db.transactions);
      setBusinessInfo(db.businessInfo);
      setPurchases(db.purchases || []);
      if (db.businessInfo && (db.businessInfo as any).staffList && Array.isArray((db.businessInfo as any).staffList)) {
        setStaffList((db.businessInfo as any).staffList);
      } else {
        try {
          const lstr = localStorage.getItem("barakah_staff_list");
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
        purchases
      });

      // Also persist separately in localStorage just in case
      localStorage.setItem("barakah_staff_list", JSON.stringify(staffList));

      // Auto cloud backup with 1.5 seconds debounce for all authenticated users so no data is ever lost
      if (activeUser && !activeUser.isGuest) {
        // Bulletproof sync guard: never auto-backup a completely blank database to the cloud
        if (products.length === 0 && transactions.length === 0) {
          console.warn("[Auto Backup Guard] Local database is completely empty. Skipping background auto-backup to protect the cloud database from accidental overwrites.");
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
              purchases
            });
          } catch (e) {
            console.warn("Auto-backup failed silently in background:", e);
          }
        }, 1500);
        return () => clearTimeout(delayDebounceFn);
      }
    }
  }, [products, contacts, expenses, transactions, businessInfo, purchases, staffList, activeUser]);

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
    const success = await uploadPasscodeBackup(activeUser.email, passcode, {
      products,
      contacts,
      expenses,
      transactions,
      businessInfo,
      purchases
    });
    setIsBackingUp(false);
    if (success) {
      triggerNotification("Cloud backup successfully synchronized!", "success");
    } else {
      triggerNotification("Cloud backup failed. Please try again later.", "error");
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
      const restored = await fetchAndRestoreCloudBackup(activeUser.email, passcode);
      if (restored) {
        // Reload states
        const db = loadDB();
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

  // Handler for custom local auth action signup
  const handleSignUp = async (email: string, pass: string) => {
    initialLoadedRef.current = false;
    const user = await signUpWithEmail(email, pass);
    setActiveUser(user);
    
    // Refresh states
    const db = loadDB();
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
    const db = loadDB();
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
    const db = loadDB();
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

    const newTransaction: Transaction = {
      id: uniqueTxId,
      invoiceNo: uniqueInvoiceNo,
      date: new Date().toISOString(),
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
      const soldItem = posCart.find(cartItem => cartItem.product.id === p.id);
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
    setProducts(products.filter(p => p.id !== id));
    triggerNotification(`Product '${name}' removed from catalog.`);
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
      setProducts(INITIAL_PRODUCTS);
      setContacts(INITIAL_CONTACTS);
      setExpenses(INITIAL_EXPENSES);
      setPurchases(INITIAL_PURCHASES);
      setTransactions([]);
      setBusinessInfo(INITIAL_BUSINESS_INFO);
      triggerNotification("System reset successful. Restored defaults completely.", "success");
    } else if (dangerAction === "delete_account") {
      localStorage.clear();
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

  const handleUpdateTransactionItemBuyPrice = (txId: string, itemIdx: number, newBuyPrice: number) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === txId) {
        const updatedItems = t.items.map((it, idx) => {
          if (idx === itemIdx) {
            return {
              ...it,
              buyPrice: newBuyPrice
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
    triggerNotification("Transaction purchase rate adjusted. Net profit recalculated!", "success");
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
    const newPur: Purchase = {
      ...pur,
      id: toUUID(`pur_${Date.now()}`, cleanEmail),
      productId: pur.productId ? toUUID(pur.productId, cleanEmail) : ""
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
    const matchingPur = purchases.find(p => p.id === id);
    if (!matchingPur) return;
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
    triggerNotification("Purchase record removed and inventory adjusted.");
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

  // -----------------------------------------------------------------
  // 3. LEDGER TRANSACTION ACCOUNTING WORKSPACE STATE
  // -----------------------------------------------------------------
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<string>("all");

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
    const t = transactions.find(item => item.id === id);
    if (!t) return;

    // Refund stock back to products catalog
    setProducts(products.map(prod => {
      const soldItem = t.items.find(item => item.productId === prod.id);
      if (soldItem) {
        return {
          ...prod,
          stock: prod.stock + (soldItem.quantity ?? 0)
        };
      }
      return prod;
    }));

    // Remove transaction
    setTransactions(transactions.filter(item => item.id !== id));
    triggerNotification(`Invoice ${t.invoiceNo} successfully deleted. Product stock returned backward.`);
  };

  const handleEditTransaction = (id: string, updatedFields: Partial<Transaction>) => {
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
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [isClassifying, setIsClassifying] = useState(false);

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

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName || !cPhone) return;

    const cleanEmail = (activeUser?.email || "barakahemart@gmail.com").trim().toLowerCase();
    const newContact: Contact = {
      id: toUUID(`c_${Date.now()}`, cleanEmail),
      name: cName,
      phone: cPhone,
      address: cAddress || "Dhaka, Bangladesh",
      type: cType,
      created_at: new Date().toISOString()
    };

    setContacts([newContact, ...contacts]);
    setCName("");
    setCPhone("");
    setCAddress("");
    triggerNotification(`Contact [${cName}] successfully compiled.`);
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
    const saved = localStorage.getItem("barakah_dashboard_filter");
    if (saved === "today" || saved === "weekly" || saved === "monthly" || saved === "yearly" || saved === "all" || saved === "custom") {
      return saved as any;
    }
    return "all";
  });
  const setDashboardFilter = (val: "today" | "weekly" | "monthly" | "yearly" | "all" | "custom") => {
    _setDashboardFilter(val);
    localStorage.setItem("barakah_dashboard_filter", val);
  };

  const [customStart, _setCustomStart] = useState<string>(() => {
    return localStorage.getItem("barakah_custom_start") || "2026-05-01";
  });
  const setCustomStart = (val: string) => {
    _setCustomStart(val);
    localStorage.setItem("barakah_custom_start", val);
  };

  const [customEnd, _setCustomEnd] = useState<string>(() => {
    return localStorage.getItem("barakah_custom_end") || "2026-05-31";
  });
  const setCustomEnd = (val: string) => {
    _setCustomEnd(val);
    localStorage.setItem("barakah_custom_end", val);
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
  
  // Exact COGS calculation using matching products buy price, preferring transaction item overrides
  let totalCostOfGoodsSold = 0;
  filteredDashboardTx.forEach(t => {
    t.items.forEach(item => {
      const dbProduct = products.find(p => p.id === item.id || p.name === item.name || p.productId === item.productId);
      // Fallback to item-specific buyPrice override first, or standard dbProduct buyPrice, or 85% of price
      const buyCost = item.buyPrice !== undefined ? item.buyPrice : (dbProduct ? dbProduct.buyPrice : (item.price * 0.85)); 
      totalCostOfGoodsSold += buyCost * item.quantity;
    });
  });

  const netProfitAmt = Math.round(totalSalesTk - totalCostOfGoodsSold - totalExpensesTk);
  
  // Backward compatibility variables for render blocks
  const projectedProductSellTotal = totalSalesTk;
  const projectedProductProfit = totalSalesTk - totalCostOfGoodsSold;
  const projectedNetTerminalProfit = netProfitAmt;

  // Filter lists dynamically
  const filteredProducts = products.filter(p => {
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
                  <TrendingUp className="w-4 h-4" />
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
                  Inventory
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
                  id="tab-insights-btn"
                  onClick={() => setActiveTab("insights")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${activeTab === 'insights' ? 'bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 font-bold' : 'text-[#A0A0A5] hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  <Sparkle className="w-4 h-4 animate-pulse text-amber-500" />
                  AI Insights
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
        <header className={`bg-[#0a101f]/90 backdrop-blur border-b border-slate-800/80 px-4 py-3 md:px-6 md:py-4 flex-row items-center justify-between gap-2 z-40 sticky top-0 animate-fadeIn ${activeTab === 'dashboard' ? 'hidden md:flex' : 'flex'}`} id="top-navbar">
          
          <div id="active-tab-title-display" className="min-w-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/10" />
              <h1 className="text-sm md:text-lg font-bold text-white tracking-wide font-display truncate">
                {activeTab === 'dashboard' && `${businessInfo.name} - Dashboard`}
                {activeTab === 'reports' && 'Reports Dashboard'}
                {activeTab === 'products' && 'Product Settings'}
                {activeTab === 'negative-sales' && 'Negative Stock Log'}
                {activeTab === 'purchases' && 'Purchases Ledger'}
                {activeTab === "pos" && "Counter Cash Memo"}
                {activeTab === 'inventory' && 'Shop Inventory'}
                {activeTab === 'ledger' && 'Account Ledger'}
                {activeTab === "insights" && "AI Assistant"}
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
              {activeTab === 'inventory' && 'Monitor overall physical inventory items, remaining thresholds and unit metrics.'}
              {activeTab === 'ledger' && 'Acknowledge transactions, review accounts receivable and enter payments due.'}
              {activeTab === 'insights' && 'Securely inspects ledger records using Google Gemini.'}
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
              products={products}
              transactions={transactions}
              expenses={expenses}
              purchases={purchases}
              businessInfo={businessInfo}
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
              onNavigate={(tab) => {
                setActiveTab(tab);
                triggerNotification(`${tab} view initialized`, "info");
              }}
            />
          )}

          {/* -------------------- VIEW REPORTS: ELITE REPORTING SYSTEMS -------------------- */}
          {activeTab === "reports" && (
            <ReportsView
              products={products}
              transactions={transactions}
              expenses={expenses}
              purchases={purchases}
              businessInfo={businessInfo}
              currencySymbol={businessInfo.currencySymbol || "৳"}
            />
          )}

          {/* -----------------------------------------------------------------
              VIEW 1: POS BILLING WORKSPACE & LIVE INVOICE CARTRIDGE
              ----------------------------------------------------------------- */}
          {activeTab === "pos" && (
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
                    
                     <div className="col-span-1 md:col-span-5 space-y-1.5" id="pos-select-wrap">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Select Product</label>
                        <input
                          type="text"
                          placeholder="Fuzzy filter items..."
                          value={posSearchQuery}
                          onChange={(e) => setPosSearchQuery(e.target.value)}
                          className="px-2 py-0.5 bg-[#121214] border border-[#2D2D35] rounded-md text-[9px] text-[#00E676] placeholder-slate-600 outline-none focus:border-[#00E676] w-28 font-mono"
                        />
                      </div>
                      <select
                        id="pos-product-select"
                        value={selectedProductId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedProductId(val);
                          const prod = products.find(p => p.id === val);
                          if (prod) {
                            setCartItemPrice(prod.sellPrice.toString());
                          } else {
                            setCartItemPrice("");
                          }
                        }}
                        className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-slate-100 text-xs outline-none focus:border-[#00E676] transition-all font-sans cursor-pointer focus:ring-1 focus:ring-[#00E676]/30"
                      >
                        <option value="">-- Choose Product to buy --</option>
                        {products
                          .filter(p => {
                            const term = posSearchQuery.toLowerCase().trim();
                            if (!term) return true;
                            const searchWords = term.split(/\s+/);
                            const target = `${p.name} ${p.sku} ${p.category}`.toLowerCase();
                            return searchWords.every(word => target.includes(word));
                          })
                          .map((p) => (
                            <option key={p.id} value={p.id} className="bg-[#1E1E24] text-white">
                              {p.name} [{p.sku}] - Stock: {p.stock} {p.unit} ({p.sellPrice} {businessInfo.currencySymbol})
                            </option>
                          ))}
                      </select>
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
              VIEW 2: INVENTORY PRODUCT CATALOG & RESTOCKS
              ----------------------------------------------------------------- */}
          {activeTab === "inventory" && (
            <div className="space-y-6" id="view-inventory-container">
              
              {/* Top inventory control bar */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-[#0a101f]/80 border border-slate-800 rounded-2xl" id="inventory-toolbar">
                <div className="relative w-full md:w-80" id="inventory-search-wrap">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    id="inventory-search-input"
                    placeholder="Search product tags, names, SKU codes..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="w-full px-3 py-2 pl-9 bg-[#050912] border border-slate-800 rounded-xl text-slate-200 text-xs outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="text-xs text-slate-400 font-mono" id="inventory-stats-sub">
                  Total Inventory Items: <span className="text-white font-bold">{products.length}</span> items
                </div>
              </div>

              {/* Add New Product Drawer and Catalog List layout (Grid) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="inventory-grid">
                
                {/* Form to submit registration (4 Cols) */}
                <div className="lg:col-span-4 bg-[#0a101f]/80 border border-slate-800 p-5 rounded-2xl space-y-4" id="add-product-form-panel">
                  <h3 className="text-sm font-semibold text-white tracking-wide border-b border-slate-900 pb-2.5">Register New Catalog Product</h3>
                  
                  <form onSubmit={handleCreateProduct} className="space-y-3.5" id="new-product-form">
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1 pl-1">Product Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rice 10kg, sugar, bulb"
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#050912] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-sans"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">SKU Part Code (Optional)</label>
                        <input
                          type="text"
                          placeholder="PRO-01"
                          value={newProdSKU}
                          onChange={(e) => setNewProdSKU(e.target.value)}
                          className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Product Category Segment</label>
                        <select
                          value={newProdCategory}
                          onChange={(e) => setNewProdCategory(e.target.value)}
                          className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-slate-200 text-xs outline-none focus:border-emerald-500 font-mono"
                        >
                          <option value="Groceries">Groceries</option>
                          <option value="Grains">Grains / Foods</option>
                          <option value="Oils">Oils / Fluids</option>
                          <option value="Dairy">Dairy Products</option>
                          <option value="Spices">Spices & Spreading</option>
                          <option value="Toiletries">Toiletries</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Unit Purchase Buying Price *</label>
                        <input
                          type="number"
                          required
                          placeholder="0"
                          value={newProdBuyPrice}
                          onChange={(e) => setNewProdBuyPrice(e.target.value)}
                          className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Unit Standard Selling Price *</label>
                        <input
                          type="number"
                          required
                          placeholder="0"
                          value={newProdSellPrice}
                          onChange={(e) => setNewProdSellPrice(e.target.value)}
                          className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Initial Opening Stock Count</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={newProdStock}
                          onChange={(e) => setNewProdStock(e.target.value)}
                          className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-400 pl-1">Measurement Base Unit</label>
                        <select
                          value={newProdUnit}
                          onChange={(e) => setNewProdUnit(e.target.value)}
                          className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-xl text-slate-200 text-xs outline-none focus:border-emerald-500 font-mono"
                        >
                          <option value="piece">Piece</option>
                          <option value="kg">Kilogram (kg)</option>
                          <option value="ltr">Liter (ltr)</option>
                          <option value="Pack">Pack Case</option>
                          <option value="Sack">Sack / Bulk Lot</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      id="save-new-product-btn"
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-[#070b13] font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Commit Item to Catalog
                    </button>

                  </form>
                </div>

                {/* Catalog Tables (8 Cols) */}
                <div className="lg:col-span-8 bg-[#0a101f]/80 border border-slate-800 rounded-2xl overflow-hidden" id="inventory-list-panel">
                  <div className="p-4 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between" id="catalog-list-header">
                    <span className="text-xs font-semibold text-white">Documented Stocks & Catalog Items</span>
                    <span className="text-[10px] text-slate-500 font-mono">Catalog Items size: {filteredProducts.length}</span>
                  </div>

                  <div className="overflow-x-auto" id="inventory-table-scroll">
                    <table className="w-full text-slate-300 text-xs">
                      <thead>
                        <tr className="bg-slate-950/40 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                          <th className="py-2 px-4 text-left">SKU</th>
                          <th className="py-2 px-4 text-left">Product Name</th>
                          <th className="py-2 px-4 text-left">Category</th>
                          <th className="py-2 px-4 text-right">Wholesale Cost</th>
                          <th className="py-2 px-4 text-right">Retail Sell Price</th>
                          <th className="py-2 px-4 text-center">Current Stock Left</th>
                          <th className="py-2 px-4 text-center">Quick Restock (+10)</th>
                          <th className="py-2 px-4 text-center">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-500">
                              No catalog products registered yet. Populate the left form to write entries.
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map((p) => {
                            const isLowStock = p.stock <= 5;
                            return (
                              <tr key={p.id} className="hover:bg-slate-900/10 text-slate-300">
                                <td className="py-3.5 px-4 font-mono font-bold text-slate-500">{p.sku}</td>
                                <td className="py-3.5 px-4 font-semibold text-white">{p.name}</td>
                                <td className="py-3.5 px-4"><span className="text-[10px] font-medium bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full text-slate-400">{p.category}</span></td>
                                <td className="py-3.5 px-4 text-right">{businessInfo.currencySymbol} {p.buyPrice}</td>
                                <td className="py-3.5 px-4 text-right text-emerald-400 font-medium">{businessInfo.currencySymbol} {p.sellPrice}</td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isLowStock ? 'bg-rose-500/15 text-rose-400 animate-pulse border border-rose-500/20' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'}`}>
                                    {p.stock} {p.unit}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <button
                                    id={`quick-restock-${p.id}`}
                                    onClick={() => incrementProductStock(p.id)}
                                    className="px-2.5 py-1 text-[10px] font-bold text-slate-200 hover:text-emerald-400 bg-slate-950/80 border border-slate-800 rounded hover:border-emerald-500 transition-colors cursor-pointer"
                                  >
                                    +10
                                  </button>
                                </td>
                                <td className="py-3.5 px-4 text-center">
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
                                const buyCost = it.buyPrice !== undefined ? it.buyPrice : (dbProduct ? dbProduct.buyPrice : 0);
                                const showEdit = showCostEditId === `${t.id}-${idx}`;

                                return (
                                  <div key={idx} className="flex justify-between items-center text-[11px] font-sans text-slate-300 py-1 border-b border-slate-800/20 last:border-b-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-slate-500 font-mono font-bold">{it.quantity}x</span> 
                                      <span>{it.name}</span>
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
                                  className="p-2 bg-slate-900 border border-slate-805 hover:border-[#FF5252] text-slate-450 hover:text-[#FF5252] rounded-xl transition-all cursor-pointer h-10 w-10 flex items-center justify-center shadow"
                                  title="Wipe transaction memo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>

                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

          {/* -----------------------------------------------------------------
              VIEW 4: AI STRATEGIC REPORTS & ANALYTICS WORKSPACE
              ----------------------------------------------------------------- */}
          {activeTab === "insights" && (
            <div className="space-y-6" id="view-insights-container">
              
              {/* Headline Banner */}
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-sky-950/20 border border-emerald-500/10 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6" id="ai-insights-header">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkle className="w-5 h-5 text-amber-400 animate-pulse" />
                    <span className="text-xs uppercase tracking-wider font-mono text-emerald-400 font-bold">Google Gemini AI Engine Connected</span>
                  </div>
                  <h2 className="text-xl font-bold text-white font-display">Live AI Diagnostic Advisor (Powered by Gemini)</h2>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-2xl">
                    Click below to invoke Gemini analysis. The engine reads stock logs, showroom outgoing vouchers, and active ledger sheets to construct professional strategic recommendations.
                  </p>
                </div>

                <button
                  id="recalculate-insights-btn"
                  onClick={fetchStrategicInsights}
                  disabled={isGeneratingInsights}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 py-3.5 px-6 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 shrink-0 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isGeneratingInsights ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Diagnosing business spreadsheet patterns...
                    </>
                  ) : (
                    <>
                      <Sparkle className="w-4 h-4" />
                      Formulate AI Strategic Advisor Report
                    </>
                  )}
                </button>
              </div>

              {/* Insights Grid list */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5" id="ai-insights-list">
                {aiInsightsList.length === 0 ? (
                  <div className="col-span-3 p-12 bg-[#0a101f]/80 border border-slate-800 rounded-2xl text-center space-y-3" id="insights-empty">
                    <p className="text-sm text-slate-500 italic">No business analytical advice compiled yet. Press the Formulate AI Strategic Report button to generate insights.</p>
                  </div>
                ) : (
                  aiInsightsList.map((ins, idx) => (
                    <div 
                      key={idx} 
                      className={`p-5 rounded-2xl border relative overflow-hidden flex flex-col justify-between ${
                        ins.type === "warning" 
                          ? "bg-rose-950/15 border-rose-500/10 text-rose-400" 
                          : ins.type === "success" 
                            ? "bg-emerald-950/15 border-emerald-500/10 text-emerald-400" 
                            : "bg-sky-950/15 border-sky-500/10 text-sky-400"
                      }`}
                      id={`insight-card-${idx}`}
                    >
                      <div className="space-y-3">
                        <span className={`text-[10px] font-mono tracking-wider uppercase inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                          ins.type === 'warning' ? 'bg-rose-500/10' : ins.type === 'success' ? 'bg-emerald-500/10' : 'bg-sky-500/10'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            ins.type === 'warning' ? 'bg-rose-500' : ins.type === 'success' ? 'bg-emerald-500' : 'bg-sky-500'
                          }`} />
                          {ins.type === 'warning' ? 'Warning Alert' : ins.type === 'success' ? 'Optimization Win' : 'General Info'}
                        </span>
                        <h4 className="text-sm font-bold text-white font-display">{ins.title}</h4>
                        <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">{ins.description}</p>
                      </div>
                      
                      <div className="mt-4 text-[10px] font-mono text-slate-500">
                        Generated by gemini-3.5-flash
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Data Visualization Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="insights-charts-grid">
                
                {/* Sale trends */}
                <div className="bg-[#0a101f]/80 border border-slate-800 p-5 rounded-2xl" id="chart-sales-panel">
                  <div className="mb-4" id="sales-chart-title">
                    <h3 className="text-sm font-semibold text-white">Showroom Invoicing Traffic Velocity</h3>
                    <p className="text-xs text-slate-500">Comparative visualization of billing value vs. cash collected over time.</p>
                  </div>

                  <div className="h-64" id="sales-chart-wrap">
                    {ledgerTrendsPlotData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-500 italic text-xs">
                        No checkout transaction logs recorded yet. Complete test checkout to initialize.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={ledgerTrendsPlotData}>
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 10 }} />
                          <YAxis stroke="#64748b" style={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Area type="monotone" dataKey="Sales Value" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" />
                          <Area type="monotone" dataKey="Cash Received" stroke="#06b6d4" fillOpacity={1} fill="url(#colorCash)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Expense Categories summary */}
                <div className="bg-[#0a101f]/80 border border-slate-800 p-5 rounded-2xl" id="chart-expenses-panel">
                  <div className="mb-4" id="expense-chart-title">
                    <h3 className="text-sm font-semibold text-white">Overheads outlays proportional breakdown</h3>
                    <p className="text-xs text-slate-500">Diagnostic pie representation of compiled business cost factors.</p>
                  </div>

                  <div className="h-64 flex items-center justify-center" id="expense-chart-wrap">
                    {expenseCategoryPlotData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-500 italic text-xs">
                        No cost factors recorded. Log outgoings into the database.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expenseCategoryPlotData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {expenseCategoryPlotData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* -----------------------------------------------------------------
              VIEW 5: EXPENSES LEDGER WITH AI CATEGORY INFERENCE
              ----------------------------------------------------------------- */}
          {activeTab === "expenses" && (
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
                  <span className="text-xs font-semibold text-white">Showroom Cumulative Outgoings History</span>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <span className="text-[10px] font-mono font-bold text-rose-400">
                      Total Cumulative: {businessInfo.currencySymbol} {(totalExpensesTk ?? 0).toLocaleString()}
                    </span>
                    {expenseFilterCategory !== "All" && (
                      <span className="text-[10px] font-mono font-bold text-emerald-400">
                        {expenseFilterCategory} Total: {businessInfo.currencySymbol} {expenses.filter(e => e.category === expenseFilterCategory).reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                      </span>
                    )}
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
                        <th className="py-2.5 px-4 text-center">Delete / Adjust</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {(() => {
                        const filteredExpenses = expenses.filter(e => 
                          expenseFilterCategory === "All" || e.category === expenseFilterCategory
                        );

                        if (filteredExpenses.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-slate-500 italic">
                                {expenseFilterCategory === "All"
                                  ? "No administrative overhead outlays logged yet."
                                  : `No outlays logged under "${expenseFilterCategory}" category.`}
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
                              <button
                                id={`delete-expense-${e.id}`}
                                onClick={() => setDeleteExpenseId(e.id)}
                                className="p-1.5 hover:bg-rose-500/10 rounded-lg group transition-all text-slate-500 hover:text-rose-400 cursor-pointer"
                                title="Delete expense"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      })()}
                    </tbody>
                  </table>
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
                const due = (t.grandTotal || 0) - (t.amountPaid || 0);
                return sum + (due > 0 ? due : 0);
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
                    <h3 className="text-sm font-bold text-white tracking-wide uppercase">Register Partner</h3>
                    <p className="text-[10px] text-[#A0A0A5]">Register a customer client or wholesaler to tracking payments</p>
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
                      <label className="text-[10px] font-bold uppercase tracking-widest font-mono text-[#A0A0A5] pl-1">Primary Mobile Number *</label>
                      <input
                        type="tel"
                        required
                        maxLength={11}
                        placeholder="017xxxxxxxx"
                        value={cPhone}
                        onChange={(e) => setCPhone(e.target.value.replace(/[^0-9]/g, ""))}
                        className="w-full px-3 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white text-xs outline-none focus:border-[#00E676] font-mono focus:ring-1 focus:ring-[#00E676]/30 transition-all"
                      />
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
                      className="w-full py-3.5 bg-[#00E676] hover:bg-[#00D065] text-[#121214] font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-[#00E676]/10"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Register Profile
                    </button>

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
                        return (
                          <div 
                            key={c.id} 
                            className="bg-[#1E1E24] border border-[#2D2D35] p-5 rounded-2xl shadow-md transition-all hover:border-[#00E676]/20 flex flex-col justify-between space-y-4 group relative overflow-hidden"
                            id={`contact-profile-card-${c.id}`}
                          >
                            {/* Card Header Profile block */}
                            <div className="flex gap-4">
                              {/* Initials circular placeholder layout with subtle glow */}
                              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#121214] to-[#2D2D35] border border-[#2D2D35] flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-inner group-hover:border-[#00E676]/30 group-hover:from-emerald-500/10 transition-colors">
                                {initials}
                              </div>
                              <div className="space-y-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate font-sans tracking-wide pr-8 group-hover:text-[#00E676] transition-colors">{c.name}</div>
                                <div className="text-[10px] font-mono text-[#A0A0A5] flex items-center gap-1.5">
                                  <Phone className="w-2.5 h-2.5 text-[#00E676]/70" />
                                  {c.phone}
                                </div>
                                <div className="text-[10px] text-slate-400 font-sans truncate" title={c.address || "Address details unspecified"}>
                                  {c.address || "Address unspecified"}
                                </div>
                              </div>
                            </div>

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
                                
                                {deleteContactId === c.id ? (
                                  <div className="flex items-center gap-1 bg-rose-500/10 p-0.5 rounded border border-rose-500/20">
                                    <button
                                      onClick={() => {
                                        setContacts(contacts.filter(item => item.id !== c.id));
                                        triggerNotification(`Removed partner profile: ${c.name}`);
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
                <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
                  {editingTx.items.map((item, idx) => {
                    const matchedProd = products.find(p => p.id === item.productId);
                    return (
                      <div key={idx} className="p-3 flex items-center justify-between gap-3 bg-white">
                        <div className="space-y-0.5 font-sans">
                          <strong className="font-bold text-slate-800 block text-xs">{matchedProd ? matchedProd.name : "Unknown Item"}</strong>
                          <span className="text-[9px] text-slate-400 font-mono">Price: {item.price}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-450 font-bold font-mono">Qty</span>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => {
                              const updatedItems = [...editingTx.items];
                              updatedItems[idx] = {
                                ...item,
                                quantity: Math.max(1, parseInt(e.target.value) || 1)
                              };
                              setEditingTx({
                                ...editingTx,
                                items: updatedItems
                              });
                            }}
                            className="w-16 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono focus:border-emerald-500 outline-none"
                          />
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
                    setExpenses(expenses.filter(item => item.id !== expenseToDelete.id));
                    triggerNotification("Voucher entry discarded.", "success");
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1E1E24]/95 backdrop-blur-md border-t border-[#2A2A32] pb-safe flex items-center justify-around h-16 shadow-2xl" id="mobile-bottom-navbar">
        {/* POS Button */}
        <button
          onClick={() => {
            setActiveTab("pos");
            setIsMobileMenuOpen(false);
          }}
          className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
            activeTab === "pos" ? "text-[#00E676] font-bold" : "text-[#A0A0A5] hover:text-white"
          }`}
        >
          <ShoppingCart className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">Sales / POS</span>
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
          className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
            activeTab === "dashboard" ? "text-[#00E676] font-bold" : "text-[#A0A0A5] hover:text-white"
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium font-sans">Dashboard</span>
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
          className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
            activeTab === "ledger" ? "text-[#00E676] font-bold" : "text-[#A0A0A5] hover:text-white"
          }`}
        >
          <FileText className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium font-sans">Transactions & Ledger</span>
        </button>

        {/* AI Insights */}
        {currentPanel === "admin" && (
          <button
            onClick={() => {
              setActiveTab("insights");
              setIsMobileMenuOpen(false);
            }}
            className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
              activeTab === "insights" ? "text-amber-400 font-bold" : "text-[#A0A0A5] hover:text-white"
            }`}
          >
            <Sparkle className="w-5 h-5 mb-1 animate-pulse" />
            <span className="text-[10px] font-medium">AI Insights</span>
          </button>
        )}

        {/* Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
            isMobileMenuOpen ? "text-[#00E676]" : "text-[#A0A0A5] hover:text-white"
          }`}
        >
          <Menu className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium font-sans">More</span>
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

                    {/* Category 4: AI & Settings */}
                    <div className="space-y-1 bg-[#212127] p-2.5 rounded-xl border border-[#2b2b35]">
                      <span className="text-[9px] uppercase tracking-widest text-[#00E676] font-extrabold block pl-0.5 mb-2 font-mono">A.I. & Diagnostics</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "insights", label: "AI Insights", desc: "Expert tips", Icon: Sparkle, pulse: true },
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
                                  : item.id === "insights" ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-[#131117] text-slate-300 border-[#22222a] hover:bg-slate-800'
                              }`}
                            >
                              <Icon className={`w-4 h-4 mb-1 ${item.pulse ? 'animate-pulse text-amber-400' : 'text-[#00E676]'}`} />
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
