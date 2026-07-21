import React, { useState, useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Download, 
  Layers, 
  BarChart3, 
  FileSpreadsheet, 
  AlertCircle, 
  ShoppingBag, 
  Users, 
  Activity,
  CalendarDays,
  CirclePercent,
  Calculator
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart,
  Line,
  Legend
} from "recharts";
import {
  safeDate,
  safeFormat,
  safeIsWithinInterval,
  safeStartOfDay,
  safeEndOfDay,
  safeSubDays
} from "../lib/dateUtils";

interface ReportsViewProps {
  products: any[];
  transactions: any[];
  expenses: any[];
  purchases: any[];
  contacts: any[];
  businessInfo: any;
  currencySymbol: string;
}

export function ReportsView({
  products = [],
  transactions = [],
  expenses = [],
  purchases = [],
  contacts = [],
  businessInfo,
  currencySymbol = "৳"
}: ReportsViewProps) {
  const [filterType, setFilterType] = useState<"all" | "today" | "yesterday" | "weekly" | "monthly" | "yearly" | "custom">("all");
  const [startDate, setStartDate] = useState(() => {
    const thirtyDaysAgo = safeSubDays(new Date(), 30);
    return safeFormat(thirtyDaysAgo, "yyyy-MM-dd", "");
  });
  const [endDate, setEndDate] = useState(() => {
    return safeFormat(new Date(), "yyyy-MM-dd", "");
  });
  const [productSearch, setProductSearch] = useState("");

  // Check if a date falls inside the current date filter
  const isDateInFilter = (dateStr: any) => {
    try {
      const date = safeDate(dateStr);
      if (!date) return false;

      const now = safeDate(new Date());
      if (!now) return false;

      const safeToday = safeStartOfDay(now);
      if (!safeToday) return false;

      if (filterType === "all") return true;

      if (filterType === "today") {
        const s = safeStartOfDay(safeToday);
        const e = safeEndOfDay(safeToday);
        if (!s || !e) return false;
        return safeIsWithinInterval(date, { start: s, end: e });
      }

      if (filterType === "yesterday") {
        const yesterday = safeSubDays(safeToday, 1);
        if (!yesterday) return false;
        const s = safeStartOfDay(yesterday);
        const e = safeEndOfDay(yesterday);
        if (!s || !e) return false;
        return safeIsWithinInterval(date, { start: s, end: e });
      }

      if (filterType === "weekly") {
        const sevenDaysAgo = safeSubDays(safeToday, 7);
        if (!sevenDaysAgo) return false;
        const s = safeStartOfDay(sevenDaysAgo);
        const e = safeEndOfDay(safeToday);
        if (!s || !e) return false;
        return safeIsWithinInterval(date, { start: s, end: e });
      }

      if (filterType === "monthly") {
        const thirtyDaysAgo = safeSubDays(safeToday, 30);
        if (!thirtyDaysAgo) return false;
        const s = safeStartOfDay(thirtyDaysAgo);
        const e = safeEndOfDay(safeToday);
        if (!s || !e) return false;
        return safeIsWithinInterval(date, { start: s, end: e });
      }

      if (filterType === "yearly") {
        const startOfYearDate = safeDate(new Date(safeToday.getFullYear(), 0, 1));
        if (!startOfYearDate) return false;
        const s = safeStartOfDay(startOfYearDate);
        const e = safeEndOfDay(safeToday);
        if (!s || !e) return false;
        return safeIsWithinInterval(date, { start: s, end: e });
      }

      if (filterType === "custom") {
        if (!startDate || !endDate) return false;
        const startParsed = safeDate(startDate);
        const endParsed = safeDate(endDate);
        if (!startParsed || !endParsed) return false;
        const s = safeStartOfDay(startParsed);
        const e = safeEndOfDay(endParsed);
        if (!s || !e) return false;
        return safeIsWithinInterval(date, { start: s, end: e });
      }
    } catch (e) {
      return false;
    }
    return false;
  };

  // Filter records in real time
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => isDateInFilter(t.date));
  }, [transactions, filterType, startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => isDateInFilter(e.date));
  }, [expenses, filterType, startDate, endDate]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => isDateInFilter(p.date));
  }, [purchases, filterType, startDate, endDate]);

  // Aggregate stats
  const stats = useMemo(() => {
    let salesVal = 0;
    let cashReceived = 0;
    let dueBalance = 0;
    let salesTax = 0;
    let salesDiscount = 0;

    filteredTransactions.forEach(t => {
      if (!t) return;
      const tot = typeof t.total === "number" ? t.total : parseFloat(t.total) || 0;
      const paid = typeof t.paidAmount === "number" ? t.paidAmount : parseFloat(t.paidAmount) || 0;
      const due = typeof t.dueBalance === "number" ? t.dueBalance : parseFloat(t.dueBalance) || 0;
      const tx = typeof t.tax === "number" ? t.tax : parseFloat(t.tax) || 0;
      const disc = typeof t.discount === "number" ? t.discount : parseFloat(t.discount) || 0;

      salesVal += tot;
      cashReceived += paid;
      dueBalance += due;
      salesTax += tx;
      salesDiscount += disc;
    });

    let expenseVal = 0;
    filteredExpenses.forEach(e => {
      if (!e) return;
      const amt = typeof e.amount === "number" ? e.amount : parseFloat(e.amount) || 0;
      expenseVal += amt;
    });

    let purchaseVal = 0;
    filteredPurchases.forEach(p => {
      if (!p) return;
      const tot = typeof p.totalAmount === "number" ? p.totalAmount : parseFloat(p.totalAmount) || 0;
      purchaseVal += tot;
    });

    // Estimate Profit Margins: 
    // Sales value minus the estimated cost of goods sold (COGS)
    let estimatedCOGS = 0;
    filteredTransactions.forEach(t => {
      if (!t) return;
      t.items?.forEach((item: any) => {
        if (!item) return;
        // Look up item buyPrice in system catalog
        const catProd = products.find(p => p.id === item.productId);
        const buyCostVal = catProd ? catProd.buyPrice : (item.price * 0.85); // fallback estimate
        const buyCost = typeof buyCostVal === "number" ? buyCostVal : parseFloat(buyCostVal) || 0;
        const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(item.quantity) || 1;
        estimatedCOGS += buyCost * qty;
      });
    });

    const grossProfit = salesVal - estimatedCOGS;
    const netProfit = grossProfit - expenseVal;

    return {
      salesVal,
      cashReceived,
      dueBalance,
      salesTax,
      salesDiscount,
      expenseVal,
      purchaseVal,
      grossProfit,
      netProfit,
      cogs: estimatedCOGS
    };
  }, [filteredTransactions, filteredExpenses, filteredPurchases, products]);

  // Chart aggregation for Daily Sales Trend
  const dailyChartData = useMemo(() => {
    const map: Record<string, { date: string; Sales: number; Purchases: number; Expenses: number }> = {};
    
    filteredTransactions.forEach(t => {
      try {
        if (!t || !t.date) return;
        const parsed = safeDate(t.date);
        if (!parsed) return;
        const d = safeFormat(parsed, "dd MMM");
        if (!d) return;
        if (!map[d]) map[d] = { date: d, Sales: 0, Purchases: 0, Expenses: 0 };
        const tot = typeof t.total === "number" ? t.total : parseFloat(t.total) || 0;
        map[d].Sales += tot;
      } catch (err) {
        console.warn("Failed to format transaction date:", t.date, err);
      }
    });

    filteredPurchases.forEach(p => {
      try {
        if (!p || !p.date) return;
        const parsed = safeDate(p.date + "T12:00:00") || safeDate(p.date);
        if (!parsed) return;
        const d = safeFormat(parsed, "dd MMM");
        if (!d) return;
        if (!map[d]) map[d] = { date: d, Sales: 0, Purchases: 0, Expenses: 0 };
        const tot = typeof p.totalAmount === "number" ? p.totalAmount : parseFloat(p.totalAmount) || 0;
        map[d].Purchases += tot;
      } catch (err) {
        console.warn("Failed to format purchase date:", p.date, err);
      }
    });

    filteredExpenses.forEach(e => {
      try {
        if (!e || !e.date) return;
        const parsed = safeDate(e.date + "T12:00:00") || safeDate(e.date);
        if (!parsed) return;
        const d = safeFormat(parsed, "dd MMM");
        if (!d) return;
        if (!map[d]) map[d] = { date: d, Sales: 0, Purchases: 0, Expenses: 0 };
        const amt = typeof e.amount === "number" ? e.amount : parseFloat(e.amount) || 0;
        map[d].Expenses += amt;
      } catch (err) {
        console.warn("Failed to format expense date:", e.date, err);
      }
    });

    return Object.values(map).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 10).reverse();
  }, [filteredTransactions, filteredPurchases, filteredExpenses]);

  // Expenses categories classification chart data
  const expenseCatChartData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      if (!e) return;
      const cat = e.category || "Uncategorized";
      const amt = typeof e.amount === "number" ? e.amount : parseFloat(e.amount) || 0;
      map[cat] = (map[cat] || 0) + amt;
    });
    return Object.entries(map).map(([name, value]) => ({
      name,
      value: typeof value === "number" && !isNaN(value) ? value : 0
    }));
  }, [filteredExpenses]);

  // Expended items detailed breakdown: rent vs bills vs salaries explicitly
  const expenseBreakdown = useMemo(() => {
    let rent = 0;
    let bills = 0;
    let salaries = 0;
    let others = 0;

    filteredExpenses.forEach(e => {
      if (!e) return;
      const cat = (e.category || "").toLowerCase().trim();
      const desc = (e.description || "").toLowerCase().trim();
      const amt = typeof e.amount === "number" ? e.amount : parseFloat(e.amount) || 0;
      if (cat === "rent" || desc.includes("rent")) {
        rent += amt;
      } else if (cat === "electricity" || cat === "utility" || cat === "bills" || cat === "water" || cat === "internet" || desc.includes("bill")) {
        bills += amt;
      } else if (cat === "salary" || cat === "salaries" || cat === "wages" || cat === "payroll" || desc.includes("salary")) {
        salaries += amt;
      } else {
        others += amt;
      }
    });

    const total = rent + bills + salaries + others;

    return { rent, bills, salaries, others, total };
  }, [filteredExpenses]);

  // Top Selling products extraction
  const topSellingProducts = useMemo(() => {
    const map: Record<string, { id: string; name: string; sku: string; category: string; quantity: number; revenue: number }> = {};
    filteredTransactions.forEach(t => {
      if (!t) return;
      t.items?.forEach((item: any) => {
        if (!item) return;
        const pid = item.productId || item.name || "Unknown Product";
        if (!map[pid]) {
          map[pid] = {
            id: item.productId || "",
            name: item.name || "Unknown Product",
            sku: item.sku || "",
            category: item.category || "",
            quantity: 0,
            revenue: 0
          };
        }
        const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(item.quantity) || 1;
        const price = typeof item.price === "number" ? item.price : parseFloat(item.price) || 0;
        map[pid].quantity += qty;
        map[pid].revenue += price * qty;
      });
    });

    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredTransactions]);

  // Individual sale transaction items profitability breakdown ledger as requested by user
  const individualSaleItemsLedger = useMemo(() => {
    const list: Array<{
      date: string;
      invoiceNo: string;
      customerName: string;
      productName: string;
      sku: string;
      category: string;
      quantity: number;
      salePrice: number;
      totalRevenue: number;
      totalCogs: number;
      netProfit: number;
      profitMarginPct: number;
    }> = [];

    // Sort transactions from newest to oldest safely
    const sortedTxs = [...filteredTransactions].sort((a, b) => {
      if (!a || !b) return 0;
      const dateA = safeDate(a.date);
      const dateB = safeDate(b.date);
      const timeA = dateA ? dateA.getTime() : 0;
      const timeB = dateB ? dateB.getTime() : 0;
      return timeB - timeA;
    });

    sortedTxs.forEach(t => {
      if (!t) return;
      // Find customer name safely from contacts list
      const pairedContact = contacts.find(c => c.id === t.contactId);
      const customerName = pairedContact ? pairedContact.name : "Walk-In Customer";
      let txDateStr = "N/A";
      try {
        if (t.date) {
          const parsedD = safeDate(t.date);
          if (parsedD) {
            txDateStr = safeFormat(parsedD, "dd MMM yyyy", "N/A");
          }
        }
      } catch (err) {
        console.warn("Failed to format transaction date", t.date, err);
      }

      t.items?.forEach((item: any) => {
        if (!item) return;
        // Resolve standard item buy price or match with product database CATALOG buy price
        const dbProduct = products.find(p => p.id === item.productId || p.id === item.id || p.name === item.name);
        
        let buyCost = 0;
        if (dbProduct && typeof dbProduct.buyPrice === "number" && dbProduct.buyPrice > 0) {
          buyCost = dbProduct.buyPrice;
        } else if (item.buyPrice && typeof item.buyPrice === "number" && item.buyPrice > 0) {
          buyCost = item.buyPrice;
        } else if (dbProduct) {
          buyCost = typeof dbProduct.buyPrice === "number" ? dbProduct.buyPrice : parseFloat(dbProduct.buyPrice) || 0;
        } else if (item.buyPrice !== undefined) {
          buyCost = typeof item.buyPrice === "number" ? item.buyPrice : parseFloat(item.buyPrice) || 0;
        } else {
          buyCost = (typeof item.price === "number" ? item.price : parseFloat(item.price) || 0) * 0.70;
        }

        const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(item.quantity) || 1;
        const price = typeof item.price === "number" ? item.price : parseFloat(item.price) || 0;
        const totalRevenue = price * qty;
        const totalCogs = buyCost * qty;
        const netProfit = totalRevenue - totalCogs;
        const profitMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        list.push({
          date: txDateStr,
          invoiceNo: t.invoiceNo || "N/A",
          customerName,
          productName: item.name || "Unknown Product",
          sku: item.sku || dbProduct?.sku || "",
          category: item.category || dbProduct?.category || "",
          quantity: qty,
          salePrice: price,
          totalRevenue,
          totalCogs,
          netProfit,
          profitMarginPct
        });
      });
    });

    return list;
  }, [filteredTransactions, products, contacts]);

  const netProfitMarginPct = useMemo(() => {
    if (stats.salesVal <= 0) return 0;
    return (stats.netProfit / stats.salesVal) * 100;
  }, [stats]);

  const COLORS = ["#00E676", "#00B0FF", "#FFC400", "#D500F9", "#FF9100", "#FF1744"];

  // Export to simple printed CSV or receipt
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-slate-300 font-sans" id="reports-view">
      
      {/* Dynamic Selector Header Panel */}
      <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#2D2D35] flex flex-col lg:flex-row items-center justify-between gap-5 shadow-lg relative overflow-hidden" id="reports-period-selector-bar">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 bg-[#121214] border border-[#2D2D35] rounded-md text-[#00E676] font-mono text-[9px] uppercase tracking-wider font-extrabold block">
              REAL-TIME REPORTING ENGINE
            </span>
          </div>
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
            <CalendarDays className="w-4 h-4 text-[#00E676]" />
            Elite Business Intelligence Ledger
          </h2>
          <p className="text-[10px] text-[#A0A0A5]">
            Consolidate net margin, cash flows, purchase allocations, and VAT tax liabilities instantly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto justify-end" id="report-filter-presets">
          {(["all", "today", "yesterday", "weekly", "monthly", "yearly", "custom"] as const).map(preset => (
            <button
              key={preset}
              onClick={() => setFilterType(preset)}
              className={`px-3.5 py-2 rounded-xl text-[11px] font-bold tracking-wider transition-all border cursor-pointer uppercase font-mono ${
                filterType === preset
                  ? "bg-gradient-to-r from-[#00E676] to-[#00B0FF] text-slate-950 border-emerald-400 shadow-lg scale-102"
                  : "bg-[#121214] text-slate-400 hover:text-white border-[#2D2D35] hover:bg-slate-900"
              }`}
            >
              {preset === "all" && "All Time"}
              {preset === "today" && "Today"}
              {preset === "yesterday" && "Yesterday"}
              {preset === "weekly" && "Weekly"}
              {preset === "monthly" && "Monthly"}
              {preset === "yearly" && "Yearly"}
              {preset === "custom" && "Custom"}
            </button>
          ))}

          {filterType === "custom" && (
            <div className="flex items-center gap-2.5 bg-[#121214] border border-[#2D2D35] p-1.5 rounded-xl">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-white font-mono text-xs outline-none"
              />
              <span className="text-slate-600 text-xs font-bold shrink-0">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-white font-mono text-xs outline-none"
              />
            </div>
          )}

          <button
            onClick={handlePrintReport}
            className="p-2 py-2.5 bg-slate-800 hover:bg-slate-755 border border-slate-705/60 rounded-xl text-slate-300 hover:text-white text-[11px] font-bold font-mono uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all"
            title="Print Report Overview"
          >
            <Download className="w-3.5 h-3.5" />
            Print Ledger
          </button>
        </div>
      </div>

      {/* Grid of Elite Financial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="reports-metrics-shelf">
        
        {/* Total Sales Value */}
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#2D2D35] flex items-center justify-between shadow-lg relative overflow-hidden group">
          <div className="space-y-1.5">
            <span className="text-[9px] font-mono tracking-widest text-[#A0A0A5] uppercase font-bold block">Gross Sales Value</span>
            <span className="text-xl font-extrabold text-[#00E676] font-mono block">
              {currencySymbol}{stats.salesVal.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              Via {filteredTransactions.length} issued invoices
            </span>
          </div>
          <div className="p-3.5 bg-[#00E676]/10 rounded-xl border border-[#00E676]/15 text-[#00E676]">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Total Cash Received */}
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#2D2D35] flex items-center justify-between shadow-lg relative overflow-hidden group">
          <div className="space-y-1.5">
            <span className="text-[9px] font-mono tracking-widest text-[#A0A0A5] uppercase font-bold block">Cash Realized</span>
            <span className="text-xl font-extrabold text-[#00B0FF] font-mono block">
              {currencySymbol}{stats.cashReceived.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              Unpaid Dues: {currencySymbol}{stats.dueBalance.toLocaleString()}
            </span>
          </div>
          <div className="p-3.5 bg-[#00B0FF]/10 rounded-xl border border-[#00B0FF]/15 text-[#00B0FF]">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Expenses and Purchases */}
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#2D2D35] flex items-center justify-between shadow-lg relative overflow-hidden group">
          <div className="space-y-1.5">
            <span className="text-[9px] font-mono tracking-widest text-[#A0A0A5] uppercase font-bold block">Operational Expenses</span>
            <span className="text-xl font-extrabold text-[#FFC400] font-mono block">
              {currencySymbol}{stats.expenseVal.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              Catalog Purchases: {currencySymbol}{stats.purchaseVal.toLocaleString()}
            </span>
          </div>
          <div className="p-3.5 bg-[#FFC400]/10 rounded-xl border border-[#FFC400]/15 text-[#FFC400]">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        {/* Net Profits */}
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#2D2D35] flex items-center justify-between shadow-lg relative overflow-hidden group">
          <div className="space-y-1.5">
            <span className="text-[9px] font-mono tracking-widest text-[#A0A0A5] uppercase font-bold block">Estimated Net Profit</span>
            <span className={`text-xl font-extrabold font-mono block ${stats.netProfit >= 0 ? "text-[#00E676]" : "text-rose-500"}`}>
              {stats.netProfit >= 0 ? "+" : ""}{currencySymbol}{stats.netProfit.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              Estimated COGS: {currencySymbol}{stats.cogs.toLocaleString()}
            </span>
          </div>
          <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/15 text-emerald-400">
            <Calculator className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Recharts Analytics Shelf */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="reports-charts-shelf">
        
        {/* Main Sales Trend Line Chart */}
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#2D2D35] lg:col-span-2 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <BarChart3 className="w-4 h-4 text-[#00E676]" />
                Sales vs. Purchases Trend
              </span>
              <span className="text-[10px] text-[#A0A0A5] block">Shows cash inflow vs stock asset allocation chronologically.</span>
            </div>
          </div>

          <div className="h-64 font-mono text-[10px]">
            {dailyChartData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl text-slate-500 italic">
                Insufficient chronological data points in the selected range to draw trends.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D2D35" />
                  <XAxis dataKey="date" stroke="#A0A0A5" />
                  <YAxis stroke="#A0A0A5" />
                  <Tooltip contentStyle={{ backgroundColor: "#121214", border: "1px solid #2D2D35", borderRadius: "10px", color: "white" }} />
                  <Legend wrapperStyle={{ color: "#A0A0A5" }} />
                  <Line type="monotone" dataKey="Sales" stroke="#00E676" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Purchases" stroke="#00B0FF" strokeWidth={2} strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="Expenses" stroke="#FFC400" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Expenses allocation pie chart */}
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#2D2D35] space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <CirclePercent className="w-4 h-4 text-[#FFC400]" />
              Expense Distribution
            </span>
            <span className="text-[10px] text-[#A0A0A5] block">Shows allocation by category.</span>
          </div>

          <div className="h-48 flex items-center justify-center font-mono">
            {expenseCatChartData.length === 0 ? (
              <div className="text-slate-500 italic text-[10px] text-center">
                No recorded expense items mapped in select custom filter.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCatChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expenseCatChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#121214", border: "1px solid #2D2D35", borderRadius: "10px", color: "white" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-1 pt-2 border-t border-[#2D2D35]/50">
            {expenseCatChartData.slice(0, 3).map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] font-semibold">
                <div className="flex items-center gap-2 text-slate-400 font-sans">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                  <span>{entry.name}</span>
                </div>
                <span className="text-white font-mono">{currencySymbol}{entry.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 2026 OVERHAUL: PERFORMANCE BREAKDOWN BENTO SHIELD DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="showroom-performance-breakdown-row">
        
        {/* TOP SELLING PRODUCTS CARD */}
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#2D2D35] lg:col-span-1 space-y-4 shadow-lg flex flex-col justify-between animate-fade-in" id="top-selling-products-panel">
          <div className="space-y-0.5">
            <span className="text-xs font-extrabold text-[#00E676] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <ShoppingBag className="w-4 h-4 text-[#00E676]" />
              Top Selling Showcase
            </span>
            <span className="text-[10px] text-[#A0A0A5] block">Top products generating the highest volume of showroom sales.</span>
          </div>

          <div className="flex-1 py-2 divide-y divide-slate-800/20 text-xs text-[#A0A0A5] min-h-[220px]">
            {topSellingProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center italic text-slate-500">
                <span>No products sold in this date range.</span>
              </div>
            ) : (
              topSellingProducts.map((p, idx) => {
                const percentageOfTotalSales = stats.salesVal > 0 ? (p.revenue / stats.salesVal) * 100 : 0;
                return (
                  <div key={idx} className="py-2.5 flex flex-col gap-1.5 justify-center text-white">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="text-xs font-black text-slate-200 line-clamp-1 truncate block max-w-[200px] font-sans">{p.name}</span>
                      <span className="text-[#00E676] font-extrabold shrink-0">{currencySymbol}{p.revenue.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-[#121214] h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-[#00E676] to-[#00B0FF] h-full rounded-full" 
                        style={{ width: `${Math.min(percentageOfTotalSales, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[9px] text-[#A0A0A5] font-mono leading-none">
                      <span>{p.sku ? `SKU: ${p.sku}` : `Category: ${p.category || "General"}`}</span>
                      <span>{p.quantity} Units sold ({percentageOfTotalSales.toFixed(1)}%)</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* EXPENSE BREAKDOWN DETAILS (Rent vs Bills vs Salaries) */}
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#2D2D35] space-y-4 shadow-lg flex flex-col justify-between animate-fade-in" id="expenses-reconciliation-panel">
          <div className="space-y-0.5">
            <span className="text-xs font-extrabold text-[#FFC400] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Activity className="w-4 h-4 text-[#FFC400]" />
              Socio-OpEx Allocation Ledger
            </span>
            <span className="text-[10px] text-[#A0A0A5] block">Showroom rent, employee payrolls, and utility bills.</span>
          </div>

          <div className="flex-grow space-y-3 py-2 min-h-[220px] flex flex-col justify-center">
            
            {/* Rent Item */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-300 font-sans">1. Monthly Showroom Rent</span>
                <span className="text-white font-mono">{currencySymbol}{expenseBreakdown.rent.toLocaleString()}</span>
              </div>
              <div className="w-full bg-[#121214] h-2 rounded-xl overflow-hidden">
                <div 
                  className="bg-[#FF9100] h-full rounded-full" 
                  style={{ width: `${expenseBreakdown.total > 0 ? (expenseBreakdown.rent / expenseBreakdown.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Salary Item */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-300 font-sans">2. Salaries & Staff wages`</span>
                <span className="text-white font-mono">{currencySymbol}{expenseBreakdown.salaries.toLocaleString()}</span>
              </div>
              <div className="w-full bg-[#121214] h-2 rounded-xl overflow-hidden">
                <div 
                  className="bg-[#00B0FF] h-full rounded-full" 
                  style={{ width: `${expenseBreakdown.total > 0 ? (expenseBreakdown.salaries / expenseBreakdown.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Utility Bills Item */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-300 font-sans">3. Electricity & Utility Bills</span>
                <span className="text-white font-mono">{currencySymbol}{expenseBreakdown.bills.toLocaleString()}</span>
              </div>
              <div className="w-full bg-[#121214] h-2 rounded-xl overflow-hidden">
                <div 
                  className="bg-[#D500F9] h-full rounded-full" 
                  style={{ width: `${expenseBreakdown.total > 0 ? (expenseBreakdown.bills / expenseBreakdown.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Others Item */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-300 font-sans">4. Sundry & Other Expenses</span>
                <span className="text-white font-mono">{currencySymbol}{expenseBreakdown.others.toLocaleString()}</span>
              </div>
              <div className="w-full bg-[#121214] h-2 rounded-xl overflow-hidden">
                <div 
                  className="bg-[#FF1744] h-full rounded-full" 
                  style={{ width: `${expenseBreakdown.total > 0 ? (expenseBreakdown.others / expenseBreakdown.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

          </div>

          <div className="pt-3 border-t border-[#2D2D35]/50 flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#A0A0A5]">Total OpEx Spent:</span>
            <span className="text-[#FFC400] font-black">{currencySymbol}{expenseBreakdown.total.toLocaleString()}</span>
          </div>
        </div>

        {/* SHOWROOM HEALTH & PROFIT MARGINS */}
        <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#2D2D35] space-y-4 shadow-lg flex flex-col justify-between animate-fade-in" id="showroom-health-margins-panel">
          <div className="space-y-0.5">
            <span className="text-xs font-extrabold text-[#00B0FF] uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <CirclePercent className="w-4 h-4 text-[#00B0FF]" />
              Net Profit Margin Gauge
            </span>
            <span className="text-[10px] text-[#A0A0A5] block">Shows showroom return percentage relative to gross sales values.</span>
          </div>

          <div className="flex-grow flex flex-col items-center justify-center py-4 space-y-4 min-h-[220px]">
            {/* Visual Circular Gauge using clean inline SVG and high contrast classes */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-[#121214]"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={netProfitMarginPct >= 20 ? "#00E676" : netProfitMarginPct >= 5 ? "#00B0FF" : netProfitMarginPct > 0 ? "#FFC400" : "#FF1744"}
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - Math.max(0, Math.min(netProfitMarginPct, 100)) / 100)}`}
                  className="transition-all duration-1000 stroke-linecap-round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-base font-black font-mono text-white leading-none">
                  {netProfitMarginPct.toFixed(1)}%
                </span>
                <span className="text-[7px] font-mono text-[#A0A0A5] font-extrabold uppercase mt-1 tracking-wider leading-none">
                  Margin Rate
                </span>
              </div>
            </div>

            {/* Health grade interpretation banner */}
            <div className="w-full p-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider font-mono">
                SHOWROOM STATUS:{" "}
                {netProfitMarginPct >= 25 ? (
                  <span className="text-[#00E676]">Highly Lucrative</span>
                ) : netProfitMarginPct >= 12 ? (
                  <span className="text-[#00B0FF]">Stable Yield</span>
                ) : netProfitMarginPct > 0 ? (
                  <span className="text-[#FFC400]">Marginal Ratio</span>
                ) : (
                  <span className="text-rose-500">Net Deficit / Loss</span>
                )}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[#2D2D35]/50 flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#A0A0A5]">Net profit:</span>
            <span className={`font-black ${stats.netProfit >= 0 ? "text-[#00E676]" : "text-rose-500"}`}>
              {stats.netProfit >= 0 ? "+" : ""}{currencySymbol}{stats.netProfit.toLocaleString()}
            </span>
          </div>
        </div>

      </div>

      {/* TRANSACTION PROFITABILITY LEDGER */}
      <div className="bg-[#1E1E24] p-5 rounded-2xl border border-[#2D2D35] space-y-4 shadow-lg animate-fade-in" id="product-profitability-ledger-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
              <Layers className="w-4 h-4 text-[#00E676]" />
              Transaction Profitability Ledger
            </h3>
            <p className="text-[10px] text-[#A0A0A5]">
              Shows customer name, product item, sale price, custom wholesale cost, calculated net profit, and profit margin for each individual sales transaction item line.
            </p>
          </div>

          {/* Quick Search input to find specific item gains */}
          <div className="relative shrink-0 w-full sm:w-64">
            <input
              type="text"
              placeholder="Search product or customer..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full bg-[#121214] border border-[#2D2D35] focus:border-[#00B0FF] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* The responsive data table */}
        <div className="overflow-x-auto rounded-xl border border-[#2D2D35]/60">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#121214]/60 border-b border-[#2D2D35] text-[10px] uppercase font-mono tracking-wider text-slate-400">
                <th className="py-3 px-4">Date & Invoice</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Product Details</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Sale Price</th>
                <th className="py-3 px-4 text-right">Wholesale Cost (COGS)</th>
                <th className="py-3 px-4 text-right">Net Profit</th>
                <th className="py-3 px-4 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D2D35]/40 text-xs text-slate-300 font-medium font-sans">
              {(() => {
                const filteredList = individualSaleItemsLedger.filter(p => 
                  p.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
                  p.customerName.toLowerCase().includes(productSearch.toLowerCase()) ||
                  p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
                  p.category.toLowerCase().includes(productSearch.toLowerCase()) ||
                  p.invoiceNo.toLowerCase().includes(productSearch.toLowerCase())
                );

                if (filteredList.length === 0) {
                  return (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                        No transaction sales records match your filters.
                      </td>
                    </tr>
                  );
                }

                return filteredList.map((p, idx) => {
                  const isProfitPositive = p.netProfit >= 0;
                  return (
                    <tr key={idx} className="hover:bg-[#121214]/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        <div className="text-[11px] font-bold text-slate-300">{p.date}</div>
                        <div className="text-[9px] text-[#00E676] bg-[#00E676]/10 px-1 py-0.5 rounded inline-block mt-1 font-bold border border-[#00E676]/10">
                          {p.invoiceNo}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-[#00E676] rounded-full inline-block"></span>
                          {p.customerName}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5 pl-3">
                          Client Account Profile
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{p.productName}</div>
                        <div className="text-[9px] text-[#A0A0A5] font-mono mt-0.5">
                          {p.sku ? `SKU: ${p.sku}` : `Category: ${p.category || "General"}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-300">
                        {p.quantity}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-200">
                        {currencySymbol}{p.salePrice.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                        {currencySymbol}{p.totalCogs.toLocaleString()}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-mono font-extrabold ${isProfitPositive ? "text-[#00E676]" : "text-rose-500"}`}>
                        {isProfitPositive ? "+" : ""}{currencySymbol}{Math.round(p.netProfit).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${isProfitPositive ? "bg-emerald-950/40 text-emerald-400 border border-emerald-950" : "bg-rose-950/40 text-rose-400 border border-rose-950"}`}>
                          {p.profitMarginPct.toFixed(1)}%
                        </span>
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
  );
}
