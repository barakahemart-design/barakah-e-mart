import React, { useState, useEffect } from "react";
import { ProductSalesBreakdown } from "./ProductSalesBreakdown";
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

interface DashboardViewProps {
  products: any[];
  transactions: any[];
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


export function DashboardView({
  products,
  transactions,
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
      
      {/* 1. Premium Bismillah & Brand Welcome Banner */}
      <section
        id="dashboard-welcome-banner"
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#111827]/95 via-[#0b1220]/95 to-[#080d17]/95 px-5 py-8 sm:px-8 sm:py-10 text-center shadow-[0_22px_65px_rgba(0,0,0,0.38)]"
      >
        <div className="pointer-events-none absolute -top-20 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-amber-400/10 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-48 w-48 rounded-full bg-sky-500/10 blur-[80px]" />
        <div className="relative z-10 mx-auto max-w-3xl">
          <p
            lang="ar"
            dir="rtl"
            className="font-serif text-2xl sm:text-3xl md:text-4xl leading-relaxed tracking-wide text-amber-200 drop-shadow-[0_2px_18px_rgba(251,191,36,0.22)]"
          >
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>
          <div className="mx-auto my-4 h-px w-20 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-[0.12em] text-white">
            BARAKAH <span className="font-semibold lowercase tracking-normal text-amber-200">e</span>-MART <span className="ml-1.5 align-middle text-[0.42em] font-bold uppercase tracking-[0.28em] text-slate-400">POS</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base md:text-lg font-medium leading-relaxed text-slate-300 italic">
            “A business, like a child, grows beautifully when nurtured with love, patience, and care.”
          </p>
          <p className="mt-3 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Built with care · Growing with purpose
          </p>
        </div>
      </section>

      {/* 2. DYNAMIC HORIZON FILTERS (Styled exactly like the pills in the screenshot) */}
      <div className="bg-[#0b0f19] border border-slate-800/80 p-2 sm:p-2.5 rounded-2xl flex flex-wrap items-center gap-3 justify-between" id="dashboard-period-menu-container">
        <div className="flex flex-wrap gap-1.5" id="preset-horizontal-pills">
          {[
            { id: "all", label: "All Time" },
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "weekly", label: "7 Days" },
            { id: "monthly", label: "This Month" },
            { id: "lastmonth", label: "Last Month" },
            { id: "yearly", label: "This Year" },
            { id: "custom", label: "Custom Range" }
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

      <ProductSalesBreakdown
        products={products}
        transactions={transactions}
        dashboardFilter={dashboardFilter}
        customStart={customStart}
        customEnd={customEnd}
      />

      {/* 5. COMFORTABLE FILE MANIPULATION CARD (For quick local backup importing in plain English only) */}
      <div 
        className="bg-[#0b0e14]/90 border border-slate-800 rounded-xl p-4 flex flex-col items-center transition-all mt-4"
        id="data-backup-import-section-card"
      >
        <label className="w-full flex flex-col items-center justify-center cursor-pointer space-y-1.5" htmlFor="premium-file-upload">
          <CloudUpload className="w-6 h-6 text-indigo-400 animate-pulse" />
          <span className="text-xs font-black text-white">Import Offline Backup File</span>
          <span className="text-[9px] text-slate-500 text-center font-sans tracking-wide">
            Drag here or click to restore an offline <b>.json</b> database backup to refresh memory storage structure instantly.
          </span>
          <input
            id="premium-file-upload"
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {uploadSuccess && (
          <div className="w-full mt-2.5 text-center text-[10px] text-emerald-400 font-bold bg-emerald-950/20 py-1.5 px-3 rounded-lg border border-emerald-950/30 pl-2.5 animate-fadeIn">
            🎉 Local database backup parsed and restored successfully!
          </div>
        )}

        {uploadError && (
          <div className="w-full mt-2.5 text-center text-[10px] text-rose-400 font-bold bg-rose-950/20 py-1.5 px-3 rounded-lg border border-rose-950/30 pl-2.5 animate-fadeIn">
            ❌ {uploadError}
          </div>
        )}
      </div>

    </div>
  );
}
