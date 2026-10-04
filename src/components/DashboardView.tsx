import React, { useState, useEffect } from "react";
import { 
  CloudUpload, 
  CloudDownload, 
  RefreshCw, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  ShoppingBag, 
  Bookmark,
  Package,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";

interface DashboardViewProps {
  businessInfo: any;
  isBackingUp: boolean;
  isRestoring: boolean;
  triggerCloudBackupSync: () => Promise<void>;
  triggerCloudBackupRestore: () => Promise<void>;
  onDataImport: (importedData: any) => void;
  onNavigate: (tab: any) => void;
  
  // Interactive Live Filter State and Calculations
  dashboardFilter: string;
  setDashboardFilter: (filter: string) => void;
  customStart: string;
  setCustomStart: (start: string) => void;
  customEnd: string;
  setCustomEnd: (end: string) => void;
  
  totalSalesTk: number;
  totalExpensesTk: number;
  totalOutstandingDueTk: number;
  totalPurchasesTk: number;
  totalUnitsSold: number;
  netProfitAmt: number;

  ledgerTrendsPlotData?: any[];
  expenseCategoryPlotData?: any[];
}

const COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899"];

export function DashboardView({
  businessInfo,
  isBackingUp,
  isRestoring,
  triggerCloudBackupSync,
  triggerCloudBackupRestore,
  onDataImport,
  onNavigate,
  
  dashboardFilter,
  setDashboardFilter,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  
  totalSalesTk,
  totalExpensesTk,
  totalOutstandingDueTk,
  totalPurchasesTk,
  totalUnitsSold,
  netProfitAmt,

  ledgerTrendsPlotData,
  expenseCategoryPlotData
}: DashboardViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);

  // Live clock updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format date parts
  const formattedTime = format(currentTime, "hh:mm:ss a");
  const formattedDay = format(currentTime, "EEEE");
  const formattedDate = format(currentTime, "dd MMMM, yyyy");

  // Format currency with safe visual auto-fallbacks
  const currencySymbol = businessInfo?.currencySymbol || "৳";

  // Helper to safely format currency amount with zero-cutoff guarantee
  const formatMoney = (amount: number) => {
    try {
      return Number(amount || 0).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    } catch (_) {
      return String(Math.round(amount || 0));
    }
  };

  // Safe chart data fetching (returns empty or user's active ledger plot data)
  const getActivePlotData = () => {
    if (ledgerTrendsPlotData && ledgerTrendsPlotData.length > 0) {
      return ledgerTrendsPlotData;
    }
    return [];
  };

  const getActiveExpensesData = () => {
    if (expenseCategoryPlotData && expenseCategoryPlotData.length > 0) {
      return expenseCategoryPlotData;
    }
    return [];
  };

  const activeExpenses = getActiveExpensesData();
  const activePlotData = getActivePlotData();

  // Dynamically calculate sum of slice
  const displayedExpensesTotal = expenseCategoryPlotData && expenseCategoryPlotData.length > 0 
    ? totalExpensesTk 
    : activeExpenses.reduce((sum, item) => sum + item.value, 0);

  // Handle local JSON file import/upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(false);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = event.target?.result as string;
        const parsed = JSON.parse(rawJson);
        
        // Basic validation check to confirm it contains correct business or lists
        if (
          parsed && 
          typeof parsed === "object" && 
          (parsed.products || parsed.transactions || parsed.contacts || parsed.expenses || parsed.businessInfo)
        ) {
          onDataImport(parsed);
          setUploadSuccess(true);
          setTimeout(() => setUploadSuccess(false), 3000);
        } else {
          setUploadError("Invalid backup file format. Missing data arrays.");
        }
      } catch (err: any) {
        setUploadError("Could not parse file. Ensure it is a valid JSON database backup.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6 text-slate-200" id="premium-dashboard-panel">
      
      {/* 1. HEADER HERO BANNER (Title with real-time indicators and Sync actions) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/40" id="dashboard-header-block">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
              Dashboard
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Real-time profit margins, revenue trackers and diagnostic charts.
          </p>
        </div>
        
        {/* Right Action buttons mimicking the screenshot */}
        <div className="flex flex-wrap items-center gap-2.5" id="dashboard-cloud-actions-row">
          <div className="flex items-center gap-2 bg-[#0d1222]/90 px-3 py-1.5 rounded-xl border border-slate-800/80 text-xs font-semibold">
            <button
              onClick={triggerCloudBackupSync}
              disabled={isBackingUp || isRestoring}
              className="flex items-center gap-1.5 hover:text-[#00E676] text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
              id="sync-cloud-lbl-btn"
            >
              <CloudUpload className="w-4 h-4 text-[#00E676]" />
              <span>Sync Cloud</span>
            </button>
            <span className="text-slate-700 font-normal">|</span>
            <button
              onClick={triggerCloudBackupRestore}
              disabled={isBackingUp || isRestoring}
              className="flex items-center gap-1.5 hover:text-sky-400 text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
              id="restore-cloud-lbl-btn"
            >
              <CloudDownload className="w-4 h-4 text-sky-400" />
              <span>Restore Cloud</span>
            </button>
          </div>

          <div className="flex items-center gap-2 bg-[#090d16]/80 px-2.5 py-1.5 rounded-lg border border-slate-900 text-[10px] font-mono uppercase tracking-wider text-slate-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Cloud: Synced</span>
          </div>

          <div className="flex items-center gap-2 bg-[#090d16]/80 px-2.5 py-1.5 rounded-lg border border-slate-900 text-[10px] font-mono uppercase tracking-wider text-slate-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span>Offline Core: OK</span>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC HORIZON FILTERS (Styled exactly like the pills in the screenshot) */}
      <div className="bg-[#0b0f19] border border-slate-800/80 p-2 sm:p-2.5 rounded-2xl flex flex-wrap items-center gap-3 justify-between" id="dashboard-period-menu-container">
        <div className="flex flex-wrap gap-1.5" id="preset-horizontal-pills">
          {[
            { id: "all", label: "All" },
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "weekly", label: "7 Days" },
            { id: "monthly", label: "This Month" },
            { id: "yearly", label: "This Year" },
            { id: "custom", label: "Custom" }
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setDashboardFilter(preset.id)}
              className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                dashboardFilter === preset.id
                  ? "bg-[#181d2f] text-white border border-[#2b3558] font-bold shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
              }`}
              id={`preset-key-${preset.id}`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom Range Range Slider Inputs */}
        {dashboardFilter === "custom" && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800 py-1" id="custom-limits-deck">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-[#0d1222]/90 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white uppercase focus:ring-1 focus:ring-indigo-500/50 outline-none"
            />
            <span className="text-slate-600 text-xs font-mono">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-[#0d1222]/90 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white uppercase focus:ring-1 focus:ring-indigo-500/50 outline-none"
            />
          </div>
        )}
      </div>

      {/* 3. FOUR CORE METRIC CARDS (With absolute layouts, flexible font bounds to eliminate mobile truncation) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="premium-metrics-grid">
        
        {/* GROSS SALES */}
        <div className="bg-[#0e111a]/95 border border-slate-800/90 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 relative overflow-hidden group hover:border-[#00E676]/35 transition-all shadow-lg" id="fin-gross-sales-card">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block leading-tight">
              Gross Sales
            </span>
            <div className="mt-2.5 flex items-baseline gap-1 overflow-hidden" id="gross-display-num">
              <span className="text-sm font-bold text-[#00E676] shrink-0">{currencySymbol}</span>
              <span className="text-xl sm:text-2xl font-black text-white tracking-normal font-sans truncate pr-1">
                {formatMoney(totalSalesTk)}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Invoiced amounts</span>
          </div>
          
          {/* Circular Graphic Icon block */}
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-500/5 text-[#00E676] rounded-xl flex items-center justify-center shrink-0 border border-[#00E676]/10 shadow-sm transition-transform group-hover:scale-105">
            <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5" />
          </div>
        </div>

        {/* TOTAL UNITS SOLD */}
        <div className="bg-[#0e111a]/95 border border-slate-800/90 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 relative overflow-hidden group hover:border-indigo-500/35 transition-all shadow-lg" id="fin-units-sold-card">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block leading-tight">
              Total Units Sold
            </span>
            <div className="mt-2.5 flex items-baseline gap-1 overflow-hidden" id="units-display-num">
              <span className="text-xl sm:text-2xl font-black text-indigo-400 tracking-normal font-sans truncate pr-1">
                {totalUnitsSold}
              </span>
              <span className="text-xs font-semibold text-slate-500">units</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Sold in active period</span>
          </div>

          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-indigo-500/5 text-indigo-400 rounded-xl flex items-center justify-center shrink-0 border border-indigo-500/10 shadow-sm transition-transform group-hover:scale-105">
            <ShoppingBag className="w-4 sm:w-5 h-4 sm:h-5" />
          </div>
        </div>

        {/* TOTAL EXPENSES */}
        <div className="bg-[#0e111a]/95 border border-slate-800/90 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 relative overflow-hidden group hover:border-amber-500/35 transition-all shadow-lg" id="fin-total-expenses-card">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block leading-tight">
              Total Expenses
            </span>
            <div className="mt-2.5 flex items-baseline gap-1 overflow-hidden" id="expenses-display-num">
              <span className="text-sm font-bold text-amber-500 shrink-0">{currencySymbol}</span>
              <span className="text-xl sm:text-2xl font-black text-white tracking-normal font-sans truncate pr-1">
                {formatMoney(totalExpensesTk)}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Operations & Bills</span>
          </div>

          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-amber-500/5 text-amber-500 rounded-xl flex items-center justify-center shrink-0 border border-amber-500/10 shadow-sm transition-transform group-hover:scale-105">
            <TrendingDown className="w-4 sm:w-5 h-4 sm:h-5" />
          </div>
        </div>

        {/* TRUE NET PROFIT */}
        <div className="bg-[#0e111a]/95 border border-slate-800/90 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 relative overflow-hidden group hover:border-sky-500/35 transition-all shadow-lg" id="fin-total-profit-card">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block leading-tight">
              True Net Profit
            </span>
            <div className="mt-2.5 flex items-baseline gap-1 overflow-hidden" id="profit-display-num">
              <span className="text-sm font-bold text-sky-400 shrink-0">{currencySymbol}</span>
              <span className="text-xl sm:text-2xl font-black text-sky-400 tracking-normal font-sans truncate pr-1">
                {formatMoney(netProfitAmt)}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Net income after COGS</span>
          </div>

          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-sky-500/5 text-sky-400 rounded-xl flex items-center justify-center shrink-0 border border-sky-500/10 shadow-sm transition-transform group-hover:scale-105">
            <Bookmark className="w-4 sm:w-5 h-4 sm:h-5" />
          </div>
        </div>

      </div>


    </div>
  );
}
