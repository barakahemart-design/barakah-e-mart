import React, { useState, useEffect } from "react";
import { ProductSalesBreakdown } from "./ProductSalesBreakdown";
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Wallet,
  Package,
  ReceiptText,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ShoppingCart,
  FileText,
  Clock3
} from "lucide-react";
import { format } from "date-fns";

interface DashboardViewProps {
  products: any[];
  transactions: any[];
  storeEmail: string;
  businessInfo: any;
  onDataImport: (importedData: any) => void;
  onNavigate: (tab: any) => void;
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

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "weekly", label: "7 Days" },
  { id: "monthly", label: "This Month" },
  { id: "yearly", label: "This Year" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom" }
];

export function DashboardView({
  products,
  transactions,
  storeEmail,
  businessInfo,
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
  netProfitAmt
}: DashboardViewProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const currencySymbol = businessInfo?.currencySymbol || "৳";
  const formatMoney = (amount: number) => {
    const value = Number(amount || 0);
    if (!Number.isFinite(value)) return "0";
    return Math.abs(value).toLocaleString("en-US", {
      maximumFractionDigits: 0
    });
  };

  const periodLabel = PERIODS.find(period => period.id === dashboardFilter)?.label || "All Time";
  const metrics = [
    {
      id: "fin-gross-sales-card",
      label: "Gross Sales",
      value: formatMoney(totalSalesTk),
      icon: TrendingUp,
      color: "emerald",
      note: "Total invoiced sales",
      prefix: currencySymbol
    },
    {
      id: "fin-units-sold-card",
      label: "Units Sold",
      value: Number(totalUnitsSold || 0).toLocaleString("en-US"),
      icon: ShoppingBag,
      color: "violet",
      note: "Products sold",
      prefix: ""
    },
    {
      id: "fin-total-expenses-card",
      label: "Expenses",
      value: formatMoney(totalExpensesTk),
      icon: TrendingDown,
      color: "amber",
      note: "Operating costs",
      prefix: currencySymbol
    },
    {
      id: "fin-total-purchases-card",
      label: "Purchases",
      value: formatMoney(totalPurchasesTk),
      icon: Package,
      color: "blue",
      note: "Stock purchases",
      prefix: currencySymbol
    },
    {
      id: "fin-outstanding-due-card",
      label: "Outstanding Due",
      value: formatMoney(totalOutstandingDueTk),
      icon: Wallet,
      color: "rose",
      note: "Customer balances",
      prefix: currencySymbol
    }
  ] as const;

  const quickActions = [
    { label: "New Sale", description: "Open checkout", icon: ShoppingCart, tab: "pos", tone: "red" },
    { label: "Add Expense", description: "Record a cost", icon: ReceiptText, tab: "expenses", tone: "amber" },
    { label: "Open Ledger", description: "View cash flow", icon: FileText, tab: "ledger", tone: "slate" }
  ] as const;

  return (
    <main className="w-full min-w-0 max-w-none mx-0 px-0 sm:px-4 pt-2 pb-5 sm:py-6 space-y-4 sm:space-y-6 text-slate-100" id="premium-dashboard-panel">
      {/* Welcome / overview */}
      <section className="relative isolate overflow-hidden rounded-[24px] border border-rose-400/15 bg-[#111016] px-4 py-5 sm:px-6 sm:py-6 shadow-[0_18px_50px_rgba(0,0,0,.28)]" id="dashboard-header-block">
        <div className="pointer-events-none absolute -right-14 -top-24 h-56 w-56 rounded-full bg-rose-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-40 w-40 rounded-full bg-red-500/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-rose-300/15 bg-rose-500/10 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,.8)]" />
              <span className="text-[9px] font-bold uppercase tracking-[.2em] text-rose-200">Business overview</span>
            </div>
            <h1 className="text-[25px] sm:text-3xl font-black tracking-tight text-white leading-none">Dashboard</h1>
            <p className="mt-2 max-w-[260px] text-[11px] sm:text-xs leading-relaxed text-slate-400">
              {businessInfo?.name ? businessInfo.name : "Your business at a glance"}
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-right backdrop-blur-md">
            <div className="flex items-center justify-end gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              <Clock3 className="h-3 w-3" /> Local time
            </div>
            <div className="mt-1 text-xs font-bold tabular-nums text-white">{format(currentTime, "hh:mm a")}</div>
            <div className="mt-0.5 text-[9px] text-slate-500">{format(currentTime, "EEE, dd MMM")}</div>
          </div>
        </div>

        <div className="relative mt-5 overflow-hidden rounded-2xl border border-rose-300/15 bg-gradient-to-br from-[#35121d] via-[#21121b] to-[#15131b] p-4 sm:p-5" id="fin-total-profit-card">
          <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full border border-rose-200/10" />
          <div className="absolute -right-1 -top-4 h-20 w-20 rounded-full border border-rose-200/10" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[.19em] text-rose-200/75">Net profit</p>
              <div className="mt-2 flex min-w-0 items-baseline gap-1.5">
                <span className="text-base font-bold text-rose-200">{currencySymbol}</span>
                <span className={`truncate text-[clamp(26px,7vw,36px)] font-black leading-none tracking-tight tabular-nums ${netProfitAmt < 0 ? "text-rose-300" : "text-white"}`}>
                  {formatMoney(netProfitAmt)}
                </span>
                {netProfitAmt < 0 ? <ArrowDownRight className="h-4 w-4 shrink-0 text-rose-300" /> : <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-300" />}
              </div>
              <p className="mt-2 text-[10px] text-rose-100/55">After cost of goods and expenses · {periodLabel}</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-200/15 bg-rose-300/10 text-rose-200 shadow-inner sm:h-14 sm:w-14">
              <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          </div>
        </div>
      </section>

      {/* Period selector */}
      <section className="space-y-2" id="dashboard-period-menu-container">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-xs font-extrabold tracking-wide text-white">Performance</h2>
            <p className="mt-0.5 text-[10px] text-slate-500">Choose a date range to view your numbers</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[9px] font-semibold text-slate-400">
            <CalendarDays className="h-3 w-3" /> {periodLabel}
          </span>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#101117] p-1.5" id="preset-horizontal-pills">
          <div className="flex w-max min-w-full gap-1">
            {PERIODS.map(period => (
              <button
                key={period.id}
                type="button"
                onClick={() => setDashboardFilter(period.id)}
                aria-pressed={dashboardFilter === period.id}
                id={`preset-key-${period.id}`}
                className={`min-h-9 rounded-xl px-3 text-[10px] font-bold whitespace-nowrap transition-all active:scale-[.97] ${
                  dashboardFilter === period.id
                    ? "bg-gradient-to-br from-rose-500 to-red-700 text-white shadow-[0_5px_16px_rgba(190,24,93,.24)]"
                    : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
        {dashboardFilter === "custom" && (
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.07] bg-[#101117] p-3" id="custom-limits-deck">
            <label className="min-w-0 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              From
              <input
                type="date"
                value={customStart}
                onChange={event => setCustomStart(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#191a22] px-2 py-2 text-xs text-white outline-none focus:border-rose-400/50"
              />
            </label>
            <label className="min-w-0 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              To
              <input
                type="date"
                value={customEnd}
                onChange={event => setCustomEnd(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#191a22] px-2 py-2 text-xs text-white outline-none focus:border-rose-400/50"
              />
            </label>
          </div>
        )}
      </section>

      {/* Key business numbers */}
      <section className="space-y-2.5" id="premium-metrics-grid">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold tracking-wide text-white">Business snapshot</h2>
          <span className="text-[9px] text-slate-500">Updated from loaded app data</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
          {metrics.map(metric => {
            const Icon = metric.icon;
            const palette = {
              emerald: "text-emerald-300 bg-emerald-400/10 border-emerald-300/10",
              violet: "text-violet-300 bg-violet-400/10 border-violet-300/10",
              amber: "text-amber-300 bg-amber-400/10 border-amber-300/10",
              blue: "text-sky-300 bg-sky-400/10 border-sky-300/10",
              rose: "text-rose-300 bg-rose-400/10 border-rose-300/10"
            }[metric.color];
            return (
              <article key={metric.id} id={metric.id} className="group relative min-w-0 overflow-hidden rounded-[19px] border border-white/[0.075] bg-gradient-to-br from-[#171820] to-[#101116] p-3.5 shadow-[0_8px_24px_rgba(0,0,0,.18)] transition-transform duration-200 active:scale-[.985] sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[9px] font-bold uppercase tracking-[.12em] text-slate-400">{metric.label}</span>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${palette}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-3 flex min-w-0 items-baseline gap-1">
                  {metric.prefix && <span className="shrink-0 text-[11px] font-bold text-slate-400">{metric.prefix}</span>}
                  <span className="min-w-0 truncate text-[clamp(17px,4.8vw,23px)] font-black leading-none tracking-tight tabular-nums text-white">{metric.value}</span>
                </div>
                <p className="mt-2 truncate text-[9px] text-slate-500">{metric.note}</p>
                <div className={`pointer-events-none absolute -bottom-7 -right-5 h-16 w-16 rounded-full blur-2xl ${metric.color === "rose" ? "bg-rose-500/10" : metric.color === "emerald" ? "bg-emerald-500/10" : "bg-white/[0.035]"}`} />
              </article>
            );
          })}
        </div>
      </section>

      {/* Existing navigation destinations, no new data operations */}
      <section className="space-y-2" id="dashboard-quick-actions">
        <div className="px-1">
          <h2 className="text-xs font-extrabold tracking-wide text-white">Quick actions</h2>
          <p className="mt-0.5 text-[10px] text-slate-500">Jump straight to your daily tasks</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map(action => {
            const Icon = action.icon;
            const iconTone = action.tone === "red" ? "bg-rose-500/12 text-rose-300 border-rose-300/10" : action.tone === "amber" ? "bg-amber-400/10 text-amber-300 border-amber-300/10" : "bg-white/[0.06] text-slate-200 border-white/10";
            return (
              <button
                key={action.tab}
                type="button"
                onClick={() => onNavigate(action.tab)}
                className="flex min-w-0 flex-col items-start rounded-[18px] border border-white/[0.075] bg-[#14151c] p-3 text-left transition-all hover:border-white/15 hover:bg-[#1a1b23] active:scale-[.97]"
              >
                <span className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl border ${iconTone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="w-full truncate text-[10px] font-extrabold text-white">{action.label}</span>
                <span className="mt-0.5 w-full truncate text-[8px] text-slate-500">{action.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="space-y-4" id="dashboard-sales-analysis">
        <ProductSalesBreakdown
          products={products}
          transactions={transactions}
          storeEmail={storeEmail}
          dashboardFilter={dashboardFilter}
          customStart={customStart}
          customEnd={customEnd}
        />
      </div>
    </main>
  );
}
