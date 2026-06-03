import React, { useState } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Bookmark, 
  ShoppingBag,
  ArrowUpRight,
  PlusCircle,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";
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
import { format } from "date-fns";

interface DashboardViewProps {
  products: any[];
  transactions: any[];
  expenses: any[];
  purchases: any[];
  businessInfo: any;
  dashboardFilter: string;
  setDashboardFilter: (val: any) => void;
  customStart: string;
  setCustomStart: (val: string) => void;
  customEnd: string;
  setCustomEnd: (val: string) => void;
  totalSalesTk: number;
  totalExpensesTk: number;
  totalOutstandingDueTk: number;
  totalPurchasesTk: number;
  totalUnitsSold: number;
  netProfitAmt: number;
  onNavigate: (tab: any) => void;
}

export function DashboardView({
  products,
  transactions,
  expenses,
  purchases,
  businessInfo,
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
  onNavigate
}: DashboardViewProps) {
  
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

  // Identify pending negative sales (products with negative stock or hasNegativeSale that are not yet marked as updated)
  const pendingNegativeSales = products.filter(p => (p.stock < 0 || p.hasNegativeSale) && !p.negativeSaleUpdated);

  return (
    <div className="space-y-6 text-slate-700 dark:text-slate-200 font-sans" id="dashboard-view">
      
      {/* Date Filters Header Section */}
      <div className="bg-white dark:bg-[#0f121d] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-center gap-4 shadow-sm relative overflow-hidden" id="dashboard-filter-bar">
        <div className="flex flex-wrap gap-2 justify-center items-center" id="filter-presets">
          {(["all", "today", "weekly", "monthly", "yearly", "custom"] as const).map(preset => (
            <button
              key={preset}
              onClick={() => setDashboardFilter(preset)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                dashboardFilter === preset 
                  ? "bg-blue-650 hover:bg-blue-700 text-white border-blue-500 dark:border-blue-600 shadow-md scale-105 font-black ring-2 ring-blue-500/40" 
                  : "bg-slate-50 dark:bg-[#121824]/60 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border-slate-250 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {preset === "all" && "All Time"}
              {preset === "today" && "Today"}
              {preset === "weekly" && "7 Days"}
              {preset === "monthly" && "This Month"}
              {preset === "yearly" && "This Year"}
              {preset === "custom" && "Custom Range"}
            </button>
          ))}
        </div>
      </div>

      {/* Custom range dates panel */}
      {dashboardFilter === "custom" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white dark:bg-[#0f121d] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl" id="custom-range-selector">
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold uppercase pl-1">Start Date</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#121824]/60 border border-slate-200 dark:border-[#20293a] rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold uppercase pl-1">End Date</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#121824]/60 border border-slate-200 dark:border-[#20293a] rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
            />
          </div>
          <p className="col-span-2 text-xs text-emerald-600 dark:text-emerald-400 self-end mb-2">💡 Net profit calculations will update based on selected dates.</p>
        </div>
      )}

      {/* Grid of Key Numerical Figures */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="accounting-metrics-row">
        
        {/* Metric 1: Total Sales */}
        <div className="bg-white dark:bg-[#111625]/95 border border-slate-200 dark:border-slate-800/80 p-4 md:p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-1 z-10 min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500 font-bold block truncate">Gross Sales</span>
            <p className="text-xl md:text-2xl font-black font-num text-slate-900 dark:text-white truncate">
              {businessInfo.currencySymbol} {(totalSalesTk ?? 0).toLocaleString()}
            </p>
            <span className="text-[10px] text-emerald-605 dark:text-emerald-400 font-medium block truncate">Invoiced amounts</span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100/60 dark:border-emerald-900/40 rounded-xl shrink-0 z-10">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="absolute -bottom-2 right-0 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Metric 2: Total Units Sold */}
        <div className="bg-white dark:bg-[#111625]/95 border border-slate-200 dark:border-slate-800/80 p-4 md:p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-1 z-10 min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500 font-bold block truncate">Total Units Sold</span>
            <p className="text-xl md:text-2xl font-black font-num text-sky-600 dark:text-sky-450 truncate">
              {(totalUnitsSold ?? 0).toLocaleString()} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">units</span>
            </p>
            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium block truncate">Sold in active period</span>
          </div>
          <div className="p-3 bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border border-sky-100/65 dark:border-sky-900/40 rounded-xl shrink-0 z-10">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="absolute -bottom-2 right-0 w-24 h-24 bg-sky-500/5 dark:bg-sky-500/10 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Metric 3: Total Expenses */}
        <div className="bg-white dark:bg-[#111625]/95 border border-slate-200 dark:border-slate-800/80 p-4 md:p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-1 z-10 min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500 font-bold block truncate">Total Expenses</span>
            <p className="text-xl md:text-2xl font-black font-num text-rose-605 dark:text-rose-450 truncate">
              {businessInfo.currencySymbol} {(totalExpensesTk ?? 0).toLocaleString()}
            </p>
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium block truncate">Operations & Bills</span>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100/65 dark:border-rose-900/40 rounded-xl shrink-0 z-10">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="absolute -bottom-2 right-0 w-24 h-24 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Metric 4: True Net Profit */}
        <div className="bg-white dark:bg-[#111625]/95 border border-slate-200 dark:border-slate-800/80 p-4 md:p-5 rounded-2xl flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-1 z-10 min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500 font-bold block truncate">True Net Profit</span>
            <p className={`text-xl md:text-2xl font-black font-sans truncate ${netProfitAmt >= 0 ? "text-emerald-600 dark:text-[#00E676]" : "text-rose-600 dark:text-rose-400"}`}>
              {businessInfo.currencySymbol} {(netProfitAmt ?? 0).toLocaleString()}
            </p>
            <span className="text-[10px] text-emerald-600 dark:text-[#00E676] font-medium block truncate">Net income after COGS</span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100/65 dark:border-emerald-900/40 rounded-xl shrink-0 z-10">
            <Bookmark className="w-5 h-5" />
          </div>
          <div className="absolute -bottom-2 right-0 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
        </div>

      </section>

      {/* Charts Visualization Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-graphics">
        
        {/* Bar/Area Trend Chart (8 Cols) */}
        <div className="col-span-1 lg:col-span-8 bg-white dark:bg-[#111625]/95 border border-slate-200 dark:border-slate-800/80 p-4 md:p-5 rounded-2xl space-y-4 shadow-sm overflow-hidden" id="sales-trends-panel">
          <div className="flex items-center justify-between" id="trend-header">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-white tracking-wide">Cash Flow Trends</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Daily gross value and direct cash received flows.</p>
            </div>
          </div>

          <div className="h-56 sm:h-72 w-full" id="recharts-trend-container">
            {ledgerTrendsPlotData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                No transaction records found for this period to display trends.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ledgerTrendsPlotData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.12} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#1e293b' }} />
                  <Area type="monotone" dataKey="Sales Value" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" />
                  <Area type="monotone" dataKey="Cash Received" stroke="#06b6d4" strokeWidth={1.5} fillOpacity={1} fill="url(#cashGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Expenses/Category breakdown distribution (4 Cols) */}
        <div className="col-span-1 lg:col-span-4 bg-white dark:bg-[#111625]/95 border border-slate-200 dark:border-slate-800/80 p-4 md:p-5 rounded-2xl space-y-4 flex flex-col justify-between shadow-sm overflow-hidden" id="expenses-composition-panel">
          <div id="composition-header" className="space-y-0.5">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white tracking-wide">Expenses Breakdown</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Share of operating expenses by categories.</p>
          </div>

          <div className="h-44 flex items-center justify-center relative my-2" id="pie-container">
            {expenseCategoryPlotData.length === 0 ? (
              <div className="text-slate-400 dark:text-slate-500 text-xs italic text-center">No expense items recorded.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategoryPlotData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {expenseCategoryPlotData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center z-10 pointer-events-none">
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 block font-mono uppercase tracking-wider">Total</span>
                  <span className="text-sm font-black font-num text-slate-800 dark:text-slate-200">{businessInfo.currencySymbol}{(totalExpensesTk ?? 0).toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-32 pr-1" id="categories-legends" style={{ scrollbarWidth: "thin" }}>
            {expenseCategoryPlotData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-[11px] font-sans">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-350 truncate pr-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-800 dark:text-slate-100 shrink-0">{businessInfo.currencySymbol}{(item.value ?? 0).toLocaleString()}</span>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* Alarms and Operations Overview Block */}
      <div className="space-y-6" id="critical-alarms-panel">
        
        {/* Pending Negative Stock Overdraft Alerts */}
        <div className="bg-white dark:bg-[#111625]/95 border border-slate-200 dark:border-slate-800/80 p-4 md:p-5 rounded-2xl space-y-4 shadow-sm" id="negative-stock-dashboard-alert">
          <div className="flex items-center justify-between text-rose-600 flex-wrap gap-2">
            <div className="space-y-0.5">
              <h3 className="text-xs font-black tracking-wider uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse inline-block" />
                Negative Stock Overdraft Alerts
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Pending negative inventory sales awaiting administrative price adjustments and stock reconciliation.
              </p>
            </div>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-450 bg-rose-50 dark:bg-rose-950/20 px-3 py-1 rounded-xl font-mono">
              {pendingNegativeSales.length} DEVIATING ITEMS
            </span>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1" id="negative-stock-items-scroll" style={{ scrollbarWidth: "thin" }}>
            {pendingNegativeSales.length === 0 ? (
              <div className="text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/20 p-5 rounded-2xl text-center text-xs font-medium flex items-center justify-center gap-2">
                <span>🎉 Excellent! No pending negative stock items. All sales balances are reconciled.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingNegativeSales.map((prod) => (
                  <div key={prod.id} className="bg-slate-50/75 dark:bg-[#151a2a]/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/60 flex items-center justify-between hover:bg-slate-100/50 dark:hover:bg-[#1b2137]/60 transition-colors">
                    <div className="space-y-1 flex-1 min-w-0 pr-3 text-left">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{prod.name}</p>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 uppercase leading-none font-sans">
                          Pending
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                        Category: {prod.category} | SKU: {prod.sku}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="inline-block px-2.5 py-1 text-[10px] font-bold font-mono bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-lg">
                          {prod.stock} {prod.unit}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate("negative-sales")}
                        className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600 dark:text-[#00E676] hover:text-emerald-700 rounded-lg border border-transparent hover:border-emerald-200 dark:hover:border-emerald-900/40 transition-all cursor-pointer"
                        title="Reconcile Product Price & Buy Rates"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
      </div>

    </div>
  );
}
