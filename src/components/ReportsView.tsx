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
import { auditAccountingRecords } from "../lib/accountingAudit";
import { calculateHistoricalCogs } from "../lib/profitCalculations";

// Resolve historical unit cost only from the sale snapshot. Never substitute the
// current catalog cost or a percentage of the selling price for an old sale.
function getItemBuyCost(item: any): number | null {
  if (!item || typeof item !== "object") return null;
  const allocations = Array.isArray(item.costAllocations) ? item.costAllocations :
    (Array.isArray(item.cost_allocations) ? item.cost_allocations : []);
  if (allocations.length > 0) {
    let allocatedQty = 0;
    let allocatedCost = 0;
    for (const allocation of allocations) {
      const qty = Number(allocation?.quantity);
      const unitCost = Number(allocation?.unitCost ?? allocation?.unit_cost);
      if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(unitCost) || unitCost < 0) return null;
      allocatedQty += qty;
      allocatedCost += qty * unitCost;
    }
    const soldQty = Number(item.quantity);
    if (!Number.isFinite(soldQty) || soldQty <= 0 || Math.abs(allocatedQty - soldQty) > 0.000001) return null;
    return allocatedCost / soldQty;
  }
  for (const key of ["buyPrice", "cost_price", "buy_price"]) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0) {
      return Number(value);
    }
  }
  return null;
}

function getReturnedItemCost(returnedLines: any[]): number | null {
  let total = 0;
  for (const line of returnedLines) {
    if (line?.returnedCost !== undefined && line?.returnedCost !== null && Number.isFinite(Number(line.returnedCost)) && Number(line.returnedCost) >= 0) {
      total += Number(line.returnedCost);
      continue;
    }
    const allocations = Array.isArray(line?.costAllocations) ? line.costAllocations : [];
    if (!allocations.length) return null;
    for (const allocation of allocations) {
      const qty = Number(allocation?.quantity);
      const unitCost = Number(allocation?.unitCost ?? allocation?.unit_cost);
      if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(unitCost) || unitCost < 0) return null;
      total += qty * unitCost;
    }
  }
  return total;
}

interface ReportsViewProps {
  products?: any[];
  transactions?: any[];
  expenses?: any[];
  additionalExpenses?: any[];
  purchases?: any[];
  contacts?: any[];
  staffList?: any[];
  businessInfo?: any;
  currencySymbol?: string;
  onNavigateToInvoice?: (invoiceNo: string) => void;
}

export function ReportsView({
  products = [],
  transactions = [],
  expenses = [],
  additionalExpenses = [],
  purchases = [],
  contacts = [],
  staffList = [],
  businessInfo,
  currencySymbol = "৳",
  onNavigateToInvoice
}: ReportsViewProps) {
  const safeProducts = Array.isArray(products) ? products : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const baseExpenses = Array.isArray(expenses) ? expenses : [];
  const extraExpenses = Array.isArray(additionalExpenses) ? additionalExpenses : [];
  const knownExpenseIds = new Set(baseExpenses.map((expense: any) => expense?.id).filter(Boolean));
  const safeExpenses = [
    ...baseExpenses,
    ...extraExpenses.filter((expense: any) => !expense?.id || !knownExpenseIds.has(expense.id))
  ];
  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const integrityIssues = useMemo(
    () => auditAccountingRecords(safeTransactions, safeProducts, safePurchases, baseExpenses, staffList),
    [safeTransactions, safeProducts, safePurchases, baseExpenses, staffList]
  );

  const [filterType, setFilterType] = useState<"all" | "today" | "yesterday" | "weekly" | "monthly" | "yearly" | "custom">("all");
  const [startDate, setStartDate] = useState(() => {
    const thirtyDaysAgo = safeSubDays(new Date(), 30);
    return safeFormat(thirtyDaysAgo, "yyyy-MM-dd", "");
  });
  const [endDate, setEndDate] = useState(() => {
    return safeFormat(new Date(), "yyyy-MM-dd", "");
  });
  const [productSearch, setProductSearch] = useState("");
  const [monthlyArchiveOpen, setMonthlyArchiveOpen] = useState(false);
  const [fullDashboardOpen, setFullDashboardOpen] = useState(false);
  const [reportSection, setReportSection] = useState<"dashboard" | "sales" | "issues" | "expenses" | "purchases" | "payments" | "products">("dashboard");
  const [selectedArchiveMonth, setSelectedArchiveMonth] = useState<number | null>(null);
  const [archiveYear, setArchiveYear] = useState(() => new Date().getFullYear());

  // Check if a date falls inside the current date filter
  const isDateInFilter = (dateStr: any) => {
    try {
      if (!dateStr) return false;
      const date = safeDate(dateStr);
      if (!date) return false;

      const now = safeDate(new Date());
      if (!now) return false;

      const safeToday = safeStartOfDay(now);
      if (!safeToday) return false;

      if (filterType === "all") return true;

      if (filterType === "yearly") {
        return date.getFullYear() === now.getFullYear();
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

      if (filterType === "monthly") {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }

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
        const sevenDaysAgo = safeSubDays(safeToday, 6);
        if (!sevenDaysAgo) return false;
        const s = safeStartOfDay(sevenDaysAgo);
        const e = safeEndOfDay(safeToday);
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
    return safeTransactions.filter(t => t && isDateInFilter(t.date));
  }, [safeTransactions, filterType, startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    return safeExpenses.filter(e => e && isDateInFilter(e.date));
  }, [safeExpenses, filterType, startDate, endDate]);

  const filteredPurchases = useMemo(() => {
    return safePurchases.filter(p => p && isDateInFilter(p.date));
  }, [safePurchases, filterType, startDate, endDate]);

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
      dueBalance += due;
      salesTax += tx;
      salesDiscount += disc;
    });

    // Cash collections belong to the date they were received, not necessarily
    // the original invoice date. Legacy paid amounts without a history remain
    // attributed to the invoice date until they can be reconciled.
    safeTransactions.forEach(t => {
      if (!t) return;
      const paid = typeof t.paidAmount === "number" ? t.paidAmount : parseFloat(t.paidAmount) || 0;
      const history = Array.isArray(t.paymentHistory) ? t.paymentHistory : [];
      const refunds = Array.isArray(t.refundHistory) ? t.refundHistory : [];
      const refundTotal = refunds.reduce((sum: number, refund: any) => sum + Math.max(0, Number(refund?.amount) || 0), 0);
      const historyTotal = history.reduce((sum: number, payment: any) => sum + Math.max(0, Number(payment?.amount) || 0), 0);
      // Reconstruct cash received before refunds, then post each refund on its
      // actual refund date instead of rewriting the original collection date.
      const grossCollected = paid + refundTotal;
      const effectiveHistoryTotal = Math.min(grossCollected, historyTotal);
      if (isDateInFilter(t.date)) cashReceived += Math.max(0, grossCollected - effectiveHistoryTotal);
      let remainingHistoryAmount = effectiveHistoryTotal;
      [...history].sort((a: any, b: any) => String(a?.date || "").localeCompare(String(b?.date || ""))).forEach((payment: any) => {
        const recordedAmount = Math.min(remainingHistoryAmount, Math.max(0, Number(payment?.amount) || 0));
        if (recordedAmount <= 0) return;
        if (payment?.date && isDateInFilter(payment.date)) cashReceived += recordedAmount;
        remainingHistoryAmount -= recordedAmount;
      });
      refunds.forEach((refund: any) => {
        if (refund?.date && isDateInFilter(refund.date)) cashReceived -= Math.max(0, Number(refund.amount) || 0);
      });
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

    // Use the same strict sale-time cost engine as the main Dashboard.
    const historicalCogs = calculateHistoricalCogs(filteredTransactions);
    const estimatedCOGS = historicalCogs.totalCogs;
    const incompleteCostLines = historicalCogs.incompleteLines.length;

    // POS adds VAT on top of the discounted subtotal. VAT collected is a
    // payable, not business revenue, so exclude it from business revenue.
    const netSalesExcludingVat = Math.max(0, salesVal - salesTax);
    const profitComplete = historicalCogs.complete;
    const grossProfit = profitComplete ? netSalesExcludingVat - estimatedCOGS : 0;
    const netProfit = profitComplete ? grossProfit - expenseVal : 0;

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
      cogs: estimatedCOGS,
      profitComplete,
      incompleteCostLines
    };
  }, [filteredTransactions, filteredExpenses, filteredPurchases, safeTransactions, filterType, startDate, endDate]);

  // Chart aggregation for Daily Sales Trend
  const dailyChartData = useMemo(() => {
    const map: Record<string, { date: string; sortDate: string; Sales: number; Purchases: number; Expenses: number }> = {};
    
    filteredTransactions.forEach(t => {
      try {
        if (!t || !t.date) return;
        const parsed = safeDate(t.date);
        if (!parsed) return;
        const sortDate = safeFormat(parsed, filterType === "yearly" ? "yyyy-MM" : "yyyy-MM-dd");
        const d = safeFormat(parsed, filterType === "yearly" ? "MMM" : "dd MMM");
        if (!sortDate || !d) return;
        if (!map[sortDate]) map[sortDate] = { date: d, sortDate, Sales: 0, Purchases: 0, Expenses: 0 };
        const tot = typeof t.total === "number" ? t.total : parseFloat(t.total) || 0;
        map[sortDate].Sales += tot;
      } catch (err) {
        console.warn("Failed to format transaction date:", t.date, err);
      }
    });

    filteredPurchases.forEach(p => {
      try {
        if (!p || !p.date) return;
        const parsed = safeDate(p.date + "T12:00:00") || safeDate(p.date);
        if (!parsed) return;
        const sortDate = safeFormat(parsed, filterType === "yearly" ? "yyyy-MM" : "yyyy-MM-dd");
        const d = safeFormat(parsed, filterType === "yearly" ? "MMM" : "dd MMM");
        if (!sortDate || !d) return;
        if (!map[sortDate]) map[sortDate] = { date: d, sortDate, Sales: 0, Purchases: 0, Expenses: 0 };
        const tot = typeof p.totalAmount === "number" ? p.totalAmount : parseFloat(p.totalAmount) || 0;
        map[sortDate].Purchases += tot;
      } catch (err) {
        console.warn("Failed to format purchase date:", p.date, err);
      }
    });

    filteredExpenses.forEach(e => {
      try {
        if (!e || !e.date) return;
        const parsed = safeDate(e.date + "T12:00:00") || safeDate(e.date);
        if (!parsed) return;
        const sortDate = safeFormat(parsed, filterType === "yearly" ? "yyyy-MM" : "yyyy-MM-dd");
        const d = safeFormat(parsed, filterType === "yearly" ? "MMM" : "dd MMM");
        if (!sortDate || !d) return;
        if (!map[sortDate]) map[sortDate] = { date: d, sortDate, Sales: 0, Purchases: 0, Expenses: 0 };
        const amt = typeof e.amount === "number" ? e.amount : parseFloat(e.amount) || 0;
        map[sortDate].Expenses += amt;
      } catch (err) {
        console.warn("Failed to format expense date:", e.date, err);
      }
    });

    const maxGroups = filterType === "yearly" ? 12 : 10;
    return Object.values(map).sort((a, b) => a.sortDate.localeCompare(b.sortDate)).slice(-maxGroups);
  }, [filteredTransactions, filteredPurchases, filteredExpenses, filterType]);

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
      t.items?.forEach((item: any, index: number) => {
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
        const soldQty = typeof item.quantity === "number" ? item.quantity : parseFloat(item.quantity) || 0;
        const itemId = String(item.firestoreId || item.id || `${t.id}_item_${index}`);
        const returnedQty = (Array.isArray(t.returnHistory) ? t.returnHistory : [])
          .flatMap((entry: any) => Array.isArray(entry.items) ? entry.items : [])
          .filter((line: any) => String(line.transactionItemId) === itemId)
          .reduce((sum: number, line: any) => sum + (Number(line.quantity) || 0), 0);
        const qty = Math.max(0, soldQty - returnedQty);
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
      totalCogs: number | null;
      netProfit: number | null;
      profitMarginPct: number | null;
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
      const pairedContact = safeContacts.find(c => c && c.id === t.contactId);
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

      if (Array.isArray(t.items)) {
        const invoiceGrossItems = t.items.reduce((sum: number, line: any, index: number) => {
          const itemId = String(line.firestoreId || line.id || `${t.id}_item_${index}`);
          const returnedQty = (Array.isArray(t.returnHistory) ? t.returnHistory : [])
            .flatMap((entry: any) => Array.isArray(entry.items) ? entry.items : [])
            .filter((returned: any) => String(returned.transactionItemId) === itemId)
            .reduce((qty: number, returned: any) => qty + (Number(returned.quantity) || 0), 0);
          const remainingQty = Math.max(0, (Number(line?.quantity) || 0) - returnedQty);
          return sum + (Number(line?.price) || 0) * remainingQty;
        }, 0);
        const invoiceTotal = Number(t.total) || 0;
        const invoiceTax = Number(t.tax) || 0;
        const invoiceNetSales = Math.max(0, invoiceTotal - invoiceTax);
        const revenueAllocationFactor = invoiceGrossItems > 0 ? invoiceNetSales / invoiceGrossItems : 1;

        t.items.forEach((item: any) => {
          if (!item) return;
          const dbProduct = safeProducts.find(p => p && (p.id === item.productId || p.id === item.id || p.name === item.name));
          // Cost comes only from the historical invoice snapshot, never the live catalog.
          const buyCost = getItemBuyCost(item);

          const qty = typeof item.quantity === "number" ? item.quantity : parseFloat(item.quantity) || 0;
          const price = typeof item.price === "number" ? item.price : parseFloat(item.price) || 0;
          const itemId = String(item.firestoreId || item.id || `${t.id}_item_${t.items.indexOf(item)}`);
          const returnedLines = (Array.isArray(t.returnHistory) ? t.returnHistory : [])
            .flatMap((entry: any) => Array.isArray(entry.items) ? entry.items : [])
            .filter((line: any) => String(line.transactionItemId) === itemId);
          const returnedQty = returnedLines.reduce((sum: number, line: any) => sum + (Number(line.quantity) || 0), 0);
          const returnedCost = getReturnedItemCost(returnedLines);
          const netQty = Math.max(0, qty - returnedQty);
          // Allocate net sales (after invoice discount and excluding VAT) to
          // the unreturned quantity. Missing historical cost stays explicitly unknown.
          const totalRevenue = price * netQty * revenueAllocationFactor;
          const totalCogs = buyCost === null || (returnedQty > 0 && returnedCost === null)
            ? null
            : Math.max(0, buyCost * qty - (returnedCost || 0));
          const netProfit = totalCogs === null ? null : totalRevenue - totalCogs;
          const profitMarginPct = totalRevenue > 0 && netProfit !== null ? (netProfit / totalRevenue) * 100 : null;

          list.push({
            date: txDateStr,
            invoiceNo: t.invoiceNo || "N/A",
            customerName,
            productName: item.name || "Unknown Product",
            sku: item.sku || dbProduct?.sku || "",
            category: item.category || dbProduct?.category || "",
            quantity: netQty,
            salePrice: price,
            totalRevenue,
            totalCogs,
            netProfit,
            profitMarginPct
          });
        });
      }
    });

    return list;
  }, [filteredTransactions, safeProducts, safeContacts]);

  // MONTHLY BUSINESS ARCHIVE — uses the records already loaded by the live account listeners.
  const archiveMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const archiveMonthData = useMemo(() => archiveMonths.map((monthName, monthIndex) => {
    const inMonth = (value: any) => { const d = safeDate(value); return !!d && d.getFullYear() === archiveYear && d.getMonth() === monthIndex; };
    const sales = safeTransactions.filter(t => t && inMonth(t.date));
    const monthExpenses = safeExpenses.filter(e => e && inMonth(e.date));
    const monthPurchases = safePurchases.filter(p => p && inMonth(p.date));
    const salesTotal = sales.reduce((n, t) => n + (Number(t.total) || 0), 0);
    const taxTotal = sales.reduce((n, t) => n + (Number(t.tax) || 0), 0);
    const expenseTotal = monthExpenses.reduce((n, e) => n + (Number(e.amount) || 0), 0);
    const purchaseTotal = monthPurchases.reduce((n, p) => n + (Number(p.totalAmount) || 0), 0);
    const historicalCogs = calculateHistoricalCogs(sales);
    let cogs = historicalCogs.totalCogs;
    let incompleteCostLines = historicalCogs.incompleteLines.length;
    const productRows: any[] = [];
    sales.forEach(t => {
      const returns = (Array.isArray(t.returnHistory) ? t.returnHistory : []).flatMap((entry: any) => Array.isArray(entry?.items) ? entry.items : []);
      (Array.isArray(t.items) ? t.items : []).forEach((item: any, index: number) => {
        if (!item) return;
        const qty = Math.max(0, Number(item.quantity) || 0);
        const itemId = String(item.firestoreId || item.id || `${t.id}_item_${index}`);
        const returnedLines = returns.filter((line: any) => String(line?.transactionItemId || line?.transaction_item_id || "") === itemId);
        const returnedQty = returnedLines.reduce((n: number, line: any) => n + Math.max(0, Number(line?.quantity) || 0), 0);
        const netQty = Math.max(0, qty - returnedQty);
        const grossItems = (Array.isArray(t.items) ? t.items : []).reduce((n: number, line: any, lineIndex: number) => {
          const lineId = String(line?.firestoreId || line?.id || `${t.id}_item_${lineIndex}`);
          const lineReturns = returns.filter((ret: any) => String(ret?.transactionItemId || ret?.transaction_item_id || "") === lineId);
          const remain = Math.max(0, (Number(line?.quantity) || 0) - lineReturns.reduce((sum: number, ret: any) => sum + (Number(ret?.quantity) || 0), 0));
          return n + (Number(line?.price) || 0) * remain;
        }, 0);
        const netInvoice = Math.max(0, (Number(t.total) || 0) - (Number(t.tax) || 0));
        const revenue = grossItems > 0 ? (Number(item.price) || 0) * netQty * netInvoice / grossItems : 0;
        const unitCost = getItemBuyCost(item), returnedCost = getReturnedItemCost(returnedLines);
        const lineCogs = unitCost === null || (returnedQty > 0 && returnedCost === null) ? null : Math.max(0, qty * unitCost - (returnedCost || 0));
        const profit = lineCogs === null ? null : revenue - lineCogs;
        productRows.push({ date: t.date, invoiceNo: t.invoiceNo || t.invoice_no || "N/A", productName: item.name || "Unknown Product", sku: item.sku || "", quantity: netQty, revenue, cogs: lineCogs, profit });
      });
    });
    const profitComplete = incompleteCostLines === 0;
    const netSales = Math.max(0, salesTotal - taxTotal);
    const grossProfit = profitComplete ? netSales - cogs : null;
    const netProfit = profitComplete ? (grossProfit as number) - expenseTotal : null;
    // Attribute collections/refunds to the date they actually happened, not the invoice date.
    let cashReceived = 0;
    const cashMovements: any[] = [];
    safeTransactions.forEach(t => {
      if (!t) return;
      const paid = Number(t.paidAmount ?? t.paid_amount) || 0;
      const payments = Array.isArray(t.paymentHistory) ? t.paymentHistory : (Array.isArray(t.payment_history) ? t.payment_history : []);
      const refunds = Array.isArray(t.refundHistory) ? t.refundHistory : (Array.isArray(t.refund_history) ? t.refund_history : []);
      const refundTotal = refunds.reduce((n: number, r: any) => n + Math.max(0, Number(r?.amount) || 0), 0);
      const historyTotal = payments.reduce((n: number, p: any) => n + Math.max(0, Number(p?.amount) || 0), 0);
      const grossCollected = paid + refundTotal;
      let remainingHistory = Math.min(grossCollected, historyTotal);
      if (inMonth(t.date)) {
        const legacyCollection = Math.max(0, grossCollected - remainingHistory);
        if (legacyCollection > 0) {
          cashReceived += legacyCollection;
          cashMovements.push({ date: t.date, invoiceNo: t.invoiceNo || t.invoice_no || "N/A", type: "Invoice collection (legacy date)", amount: legacyCollection });
        }
      }
      [...payments].sort((a: any, b: any) => String(a?.date || "").localeCompare(String(b?.date || ""))).forEach((payment: any) => {
        const amount = Math.min(remainingHistory, Math.max(0, Number(payment?.amount) || 0));
        if (amount <= 0) return;
        if (inMonth(payment?.date)) {
          cashReceived += amount;
          cashMovements.push({ date: payment.date, invoiceNo: t.invoiceNo || t.invoice_no || "N/A", type: "Payment received", amount });
        }
        remainingHistory -= amount;
      });
      refunds.forEach((refund: any) => {
        const amount = Math.max(0, Number(refund?.amount) || 0);
        if (inMonth(refund?.date)) {
          cashReceived -= amount;
          cashMovements.push({ date: refund.date, invoiceNo: t.invoiceNo || t.invoice_no || "N/A", type: "Refund paid", amount: -amount });
        }
      });
    });
    return { monthName, monthIndex, sales, expenses: monthExpenses, purchases: monthPurchases, salesTotal, expenseTotal, purchaseTotal, cogs, grossProfit, netProfit, profitComplete, incompleteCostLines, cashReceived, cashMovements, productRows };
  }), [safeTransactions, safeExpenses, safePurchases, archiveYear]);

  const netProfitMarginPct = useMemo(() => {
    const netSales = Math.max(0, stats.salesVal - stats.salesTax);
    if (!stats.profitComplete || netSales <= 0) return null;
    return (stats.netProfit / netSales) * 100;
  }, [stats]);

  const COLORS = ["#00E676", "#00B0FF", "#FFC400", "#D500F9", "#FF9100", "#FF1744"];

  // Export to simple printed CSV or receipt
  const handlePrintReport = () => {
    window.print();
  };


  if (reportSection !== "dashboard") {
    const money = (n: number) => currencySymbol + Math.round(n || 0).toLocaleString();
    const titles: Record<string,string> = {sales:"Sales & Invoices",issues:"Accounting Issues",expenses:"Expenses",purchases:"Purchases",payments:"Payments & Refunds",products:"Products Sold & Profit"};
    const cashRows = archiveMonthData.flatMap(month => month.cashMovements).sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date)));
    return <div className="space-y-5 text-slate-200 pb-8" id="reports-category-page">
      <div><button onClick={()=>setReportSection("dashboard")} className="text-xs font-bold text-sky-400 mb-2">← Back to Dashboard</button><h2 className="text-xl font-black text-white">{titles[reportSection]}</h2><p className="text-xs text-slate-400 mt-1">Detailed records in a separate report page.</p></div>
      <div className="rounded-2xl border border-slate-700 bg-[#1e1e24] overflow-hidden">
      {reportSection === "issues" && <><h3 className="p-4 border-b border-slate-700 font-bold">Accounting review ({integrityIssues.length})</h3>{integrityIssues.length ? integrityIssues.map(issue=><div key={issue.id} className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1"><b className="text-xs text-amber-200">{issue.invoiceNo}</b><p className="text-xs mt-1">{issue.message}</p></div>{issue.transactionId && onNavigateToInvoice && <button type="button" onClick={()=>onNavigateToInvoice(issue.invoiceNo)} className="shrink-0 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-[10px] font-bold text-sky-200 hover:bg-sky-500/20">Review / Correct in Ledger →</button>}</div>):<p className="p-8 text-center text-emerald-300">No accounting mismatches detected.</p>}</>}
      {reportSection === "sales" && <><h3 className="p-4 border-b border-slate-700 font-bold">All Sales Invoices ({safeTransactions.length})</h3><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-xs"><thead><tr className="bg-[#141419] text-slate-400">{["Date","Invoice","Customer","Total","Paid","Due"].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">{safeTransactions.length ? [...safeTransactions].sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date))).map((t:any,i:number)=>{const c=safeContacts.find((ct:any)=>ct?.id===(t.contactId||t.contact_id));return <tr key={t.id||i}><td className="p-3">{t.date||"—"}</td><td className="p-3">{t.invoiceNo||t.invoice_no||"—"}</td><td className="p-3">{c?.name||"Walk-In Customer"}</td><td className="p-3 text-right">{money(Number(t.total)||0)}</td><td className="p-3 text-right">{money(Number(t.paidAmount??t.paid_amount)||0)}</td><td className="p-3 text-right">{money(Number(t.dueBalance??t.due_balance)||0)}</td></tr>}) : <tr><td colSpan={6} className="p-8 text-center">No sales invoices.</td></tr>}</tbody></table></div></>}
      {reportSection === "expenses" && <><h3 className="p-4 border-b border-slate-700 font-bold">All Expenses ({safeExpenses.length})</h3><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-xs"><thead><tr className="bg-[#141419] text-slate-400">{["Date","Category","Description","Amount"].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">{safeExpenses.map((e:any,i:number)=><tr key={e.id||i}><td className="p-3">{e.date||"—"}</td><td className="p-3">{e.category||"Other"}</td><td className="p-3">{e.description||e.note||"—"}</td><td className="p-3 text-right">{money(Number(e.amount)||0)}</td></tr>)}</tbody></table></div></>}
      {reportSection === "purchases" && <><h3 className="p-4 border-b border-slate-700 font-bold">All Purchases ({safePurchases.length})</h3><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-xs"><thead><tr className="bg-[#141419] text-slate-400">{["Date","Supplier","Reference","Total"].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">{safePurchases.map((p:any,i:number)=><tr key={p.id||i}><td className="p-3">{p.date||"—"}</td><td className="p-3">{p.supplierName||p.supplier||"—"}</td><td className="p-3">{p.invoiceNo||p.reference||p.id||"—"}</td><td className="p-3 text-right">{money(Number(p.totalAmount)||0)}</td></tr>)}</tbody></table></div></>}
      {reportSection === "payments" && <><h3 className="p-4 border-b border-slate-700 font-bold">Payments & Refunds ({cashRows.length})</h3><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-xs"><thead><tr className="bg-[#141419] text-slate-400">{["Date","Invoice","Type","Amount"].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">{cashRows.map((p:any,i:number)=><tr key={i}><td className="p-3">{p.date}</td><td className="p-3">{p.invoiceNo}</td><td className="p-3">{p.type}</td><td className="p-3 text-right">{money(p.amount)}</td></tr>)}</tbody></table></div></>}
      {reportSection === "products" && <><h3 className="p-4 border-b border-slate-700 font-bold">Product-wise Sales & Profit</h3><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr className="bg-[#141419] text-slate-400">{["Date / Invoice","Customer","Product","Qty","Sale Price","COGS","Profit"].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">{individualSaleItemsLedger.map((p:any,i:number)=><tr key={i}><td className="p-3">{p.date}<div className="text-slate-500">{p.invoiceNo}</div></td><td className="p-3">{p.customerName}</td><td className="p-3">{p.productName}</td><td className="p-3 text-right">{p.quantity}</td><td className="p-3 text-right">{money(p.salePrice)}</td><td className="p-3 text-right">{p.totalCogs===null?"Missing cost":money(p.totalCogs)}</td><td className="p-3 text-right">{p.netProfit===null?"N/A":money(p.netProfit)}</td></tr>)}</tbody></table></div></>}
      </div>
    </div>;
  }

  // Dedicated month picker and month-detail page.
  if (monthlyArchiveOpen) {
    const m = selectedArchiveMonth === null ? null : archiveMonthData[selectedArchiveMonth];
    const money = (n: number) => `${currencySymbol}${Math.round(n || 0).toLocaleString()}`;
    return (
      <div className="space-y-5 text-slate-200 pb-8" id="monthly-business-archive">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><button onClick={() => { setMonthlyArchiveOpen(false); setSelectedArchiveMonth(null); }} className="text-xs font-bold text-sky-400 mb-2">← Back to Reports Dashboard</button><h2 className="text-xl font-black text-white">Monthly Business Archive</h2><p className="text-xs text-slate-400 mt-1">All sales, products, expenses, purchases and profit by month</p></div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#1e1e24] p-2"><button onClick={() => { setArchiveYear(y => y - 1); setSelectedArchiveMonth(null); }} className="px-2">‹</button><b className="font-mono">{archiveYear}</b><button disabled={archiveYear >= new Date().getFullYear()} onClick={() => { setArchiveYear(y => y + 1); setSelectedArchiveMonth(null); }} className="px-2 disabled:opacity-30">›</button></div>
        </div>
        {!m ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{archiveMonthData.map(month => <button key={month.monthIndex} onClick={() => setSelectedArchiveMonth(month.monthIndex)} className="text-left rounded-2xl border border-slate-700 bg-[#1e1e24] hover:border-sky-500 p-4"><div className="flex justify-between"><b className="text-white">{month.monthName}</b><CalendarDays className="w-4 h-4 text-sky-400"/></div><p className="text-[10px] text-slate-400 mt-3">{month.sales.length} sales · {month.expenses.length} expenses · {month.purchases.length} purchases</p><p className="font-mono font-black mt-2">{money(month.salesTotal)}</p><p className={`text-[10px] font-bold mt-1 ${month.netProfit === null ? "text-amber-300" : month.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{month.netProfit === null ? "Profit: Cost data incomplete" : `Net Profit: ${money(month.netProfit)}`}</p></button>)}</div> :
        <div className="space-y-5">
          <div className="flex justify-between items-center"><h3 className="font-black text-lg text-white">{m.monthName} {archiveYear} — Monthly Details</h3><button onClick={() => setSelectedArchiveMonth(null)} className="text-xs text-sky-300 border border-slate-700 rounded-lg px-3 py-2">← All Months</button></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[["Sales",money(m.salesTotal)],["Cash Received",money(m.cashReceived)],["Expenses",money(m.expenseTotal)],["Purchases",money(m.purchaseTotal)],["COGS",money(m.cogs)],["Gross Profit",m.grossProfit === null ? "Incomplete" : money(m.grossProfit)],["Net Profit",m.netProfit === null ? "Cost data incomplete" : money(m.netProfit)],["Invoices",String(m.sales.length)]].map(([label,value])=><div key={label} className="rounded-xl border border-slate-700 bg-[#1e1e24] p-3"><p className="text-[10px] uppercase text-slate-400">{label}</p><p className="font-mono font-black text-sm mt-2">{value}</p></div>)}</div>
          {!m.profitComplete && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">Profit cannot be verified: {m.incompleteCostLines} sold item line(s) are missing reliable historical cost. No estimated cost is substituted.</div>}
          <section className="rounded-xl border border-slate-700 bg-[#1e1e24] overflow-hidden"><h4 className="font-bold p-4 border-b border-slate-700">Products Sold & Item-wise Profit</h4><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-xs"><thead className="bg-[#141419] text-slate-400"><tr>{["Date / Invoice","Product","Qty","Sales","COGS","Profit"].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">{m.productRows.length ? m.productRows.map((p:any,i:number)=><tr key={i}><td className="p-3">{p.date}<div className="text-slate-500">{p.invoiceNo}</div></td><td className="p-3 font-bold">{p.productName}{p.sku && <div className="text-slate-500">{p.sku}</div>}</td><td className="p-3 text-right">{p.quantity}</td><td className="p-3 text-right">{money(p.revenue)}</td><td className="p-3 text-right">{p.cogs === null ? "Missing cost" : money(p.cogs)}</td><td className="p-3 text-right">{p.profit === null ? "N/A" : money(p.profit)}</td></tr>):<tr><td colSpan={6} className="p-5 text-center text-slate-500">No products sold this month.</td></tr>}</tbody></table></div></section>
          <section className="rounded-xl border border-slate-700 bg-[#1e1e24] overflow-hidden"><h4 className="font-bold p-4 border-b border-slate-700">Sales Invoices</h4><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-xs"><thead className="bg-[#141419] text-slate-400"><tr>{["Date","Invoice","Customer","Total","Paid","Due"].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">{m.sales.length ? m.sales.map((t:any,i:number)=>{const customer=safeContacts.find((ct:any)=>ct?.id===t.contactId);return <tr key={t.id||i}><td className="p-3">{t.date}</td><td className="p-3">{t.invoiceNo||t.invoice_no||"—"}</td><td className="p-3">{customer?.name||"Walk-In Customer"}</td><td className="p-3 text-right">{money(Number(t.total)||0)}</td><td className="p-3 text-right">{money(Number(t.paidAmount??t.paid_amount)||0)}</td><td className="p-3 text-right">{money(Number(t.dueBalance??t.due_balance)||0)}</td></tr>}):<tr><td colSpan={6} className="p-5 text-center text-slate-500">No sales invoices.</td></tr>}</tbody></table></div></section>
          <section className="rounded-xl border border-slate-700 bg-[#1e1e24] overflow-hidden"><h4 className="font-bold p-4 border-b border-slate-700">Payments & Refunds</h4><div className="overflow-x-auto"><table className="w-full min-w-[500px] text-xs"><thead className="bg-[#141419] text-slate-400"><tr>{["Date","Invoice","Type","Amount"].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">{m.cashMovements.length ? m.cashMovements.map((p:any,i:number)=><tr key={i}><td className="p-3">{p.date}</td><td className="p-3">{p.invoiceNo}</td><td className="p-3">{p.type}</td><td className={`p-3 text-right ${p.amount < 0 ? "text-rose-400" : "text-emerald-400"}`}>{money(p.amount)}</td></tr>):<tr><td colSpan={4} className="p-5 text-center text-slate-500">No dated payment or refund entries.</td></tr>}</tbody></table></div></section>
          <section className="rounded-xl border border-slate-700 bg-[#1e1e24] overflow-hidden"><h4 className="font-bold p-4 border-b border-slate-700">Expenses</h4><div className="overflow-x-auto"><table className="w-full min-w-[550px] text-xs"><thead className="bg-[#141419] text-slate-400"><tr>{["Date","Category","Description","Amount"].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">{m.expenses.length ? m.expenses.map((e:any,i:number)=><tr key={e.id||i}><td className="p-3">{e.date}</td><td className="p-3">{e.category||"Other"}</td><td className="p-3">{e.description||e.note||"—"}</td><td className="p-3 text-right">{money(Number(e.amount)||0)}</td></tr>):<tr><td colSpan={4} className="p-5 text-center text-slate-500">No expenses.</td></tr>}</tbody></table></div></section>
          <section className="rounded-xl border border-slate-700 bg-[#1e1e24] overflow-hidden"><h4 className="font-bold p-4 border-b border-slate-700">Purchases</h4><div className="overflow-x-auto"><table className="w-full min-w-[550px] text-xs"><thead className="bg-[#141419] text-slate-400"><tr>{["Date","Supplier","Reference","Total"].map(x=><th key={x} className="p-3 text-left">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-700">{m.purchases.length ? m.purchases.map((p:any,i:number)=><tr key={p.id||i}><td className="p-3">{p.date}</td><td className="p-3">{p.supplierName||p.supplier||"—"}</td><td className="p-3">{p.invoiceNo||p.reference||p.id||"—"}</td><td className="p-3 text-right">{money(Number(p.totalAmount)||0)}</td></tr>):<tr><td colSpan={4} className="p-5 text-center text-slate-500">No purchases.</td></tr>}</tbody></table></div></section>
        </div>}
      </div>
    );
  }


  if (!fullDashboardOpen && !monthlyArchiveOpen && reportSection === "dashboard") {
    const cards = [
      { key: "sales", title: "Sales & Invoices", count: safeTransactions.length, note: "Invoices, customer sales and balances" },
      { key: "issues", title: "Accounting Issues", count: integrityIssues.length, note: "Find mismatches and open correction actions" },
      { key: "expenses", title: "Expenses", count: safeExpenses.length, note: "Operating, delivery and salary expenses" },
      { key: "purchases", title: "Purchases", count: safePurchases.length, note: "Purchase bills and supplier records" },
      { key: "payments", title: "Payments & Refunds", count: archiveMonthData.reduce((n, m) => n + m.cashMovements.length, 0), note: "Collections and refunds by payment date" },
      { key: "products", title: "Products Sold & Profit", count: individualSaleItemsLedger.length, note: "Item-wise sales, cost and profit" }
    ] as const;
    return <div className="space-y-5 text-slate-200 pb-8" id="reports-home-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-black text-white">Reports Dashboard</h2><p className="text-xs text-slate-400 mt-1">Choose a report to open its own detail page.</p></div>
      </div>
      <button type="button" onClick={() => setFullDashboardOpen(true)} className="w-full rounded-2xl border border-sky-500/40 bg-gradient-to-r from-sky-500/15 to-indigo-500/10 p-5 text-left hover:border-sky-400 transition-colors" id="open-full-reports-overview">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-sky-300">Overview</p><h3 className="mt-1 text-lg font-black text-white">Full Business Dashboard</h3><p className="mt-1 text-xs text-slate-400">Open date filters, live time, sales, cash, expenses, COGS, net profit and charts in one page.</p></div><span className="rounded-xl bg-sky-500/15 px-4 py-3 text-sm font-black text-sky-200">Open →</span></div>
      </button>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" id="reports-section-cards">
        {cards.map(item => <button key={item.key} type="button" onClick={() => setReportSection(item.key)} className="rounded-2xl border border-[#2D2D35] bg-[#1E1E24] p-4 text-left hover:border-sky-400 transition-colors">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-white">{item.title}</h3><span className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-bold text-sky-300">{item.count}</span></div>
          <p className="mt-3 text-[11px] text-slate-400">{item.note}</p><p className="mt-3 text-[10px] font-bold text-sky-300">Open details →</p>
        </button>)}
      </div>
      <div className="rounded-2xl border border-slate-700 bg-[#1E1E24] p-4" id="reports-monthly-archive-tiles">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3"><div><h3 className="text-sm font-black text-white">Monthly Business Archive</h3><p className="text-[10px] text-slate-400 mt-1">Each month opens its own detailed report.</p></div><div className="flex items-center gap-3"><button type="button" onClick={() => setArchiveYear(y => y - 1)} className="px-2 text-white">‹</button><b className="text-xs font-mono text-white">{archiveYear}</b><button type="button" disabled={archiveYear >= new Date().getFullYear()} onClick={() => setArchiveYear(y => y + 1)} className="px-2 text-white disabled:opacity-30">›</button></div></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">{archiveMonthData.map(month => <button key={month.monthIndex} type="button" onClick={() => { setMonthlyArchiveOpen(true); setSelectedArchiveMonth(month.monthIndex); }} className="rounded-xl border border-slate-700 bg-[#121214] p-3 text-left hover:border-sky-500">
          <div className="flex items-center justify-between"><b className="text-xs text-white">{month.monthName}</b><CalendarDays className="h-4 w-4 text-sky-300"/></div><p className="mt-2 text-[10px] text-slate-400">{month.sales.length} sales · {month.expenses.length} expenses</p><p className="mt-1 text-xs font-mono font-black text-white">{currencySymbol}{Math.round(month.salesTotal).toLocaleString()}</p><p className="mt-1 text-[9px] font-bold">{month.netProfit === null ? "Profit incomplete" : "Net: " + currencySymbol + Math.round(month.netProfit).toLocaleString()}</p>
        </button>)}</div>
      </div>
    </div>;
  }

  return (
    <div className="space-y-6 text-slate-300 font-sans" id="reports-view">

      {fullDashboardOpen && <div className="flex items-center justify-between gap-3"><div><button type="button" onClick={() => setFullDashboardOpen(false)} className="mb-2 text-xs font-bold text-sky-300">← Back to Reports Dashboard</button><h2 className="text-lg font-black text-white">Full Business Overview</h2></div><span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[10px] font-bold text-sky-200">Overview</span></div>}
      <div className="rounded-2xl border border-slate-700 bg-[#111827] p-4" id="accounting-integrity-audit">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">Read-only Accounting Integrity Check</h3>
            <p className="mt-1 text-[10px] text-slate-400">Checks invoice totals, paid/due balances, product line values and return quantities using data already loaded by the existing live listeners. No extra Firestore reads or writes.</p>
          </div>
          <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${integrityIssues.length === 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
            {integrityIssues.length === 0 ? "No mismatches detected" : `${integrityIssues.length} item(s) need review`}
          </div>
        </div>
        {integrityIssues.length > 0 && <div className="mt-3 space-y-2">
          {integrityIssues.map(issue => <div key={issue.id} className="rounded-lg border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2">
            <p className="text-[10px] font-bold text-amber-200">{issue.invoiceNo}</p>
            <p className="mt-0.5 text-[10px] text-slate-300">{issue.message}</p>
          </div>)}
          <p className="text-[10px] text-slate-400">Showing all {integrityIssues.length} findings. No records were changed.</p>
        </div>}
      </div>
      
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
              {preset === "all" && "All"}
              {preset === "today" && "Today"}
              {preset === "yesterday" && "Yesterday"}
              {preset === "weekly" && "7 Days"}
              {preset === "monthly" && "This Month"}
              {preset === "yearly" && "This Year"}
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
            <span className={`text-xl font-extrabold font-mono block ${!stats.profitComplete ? "text-amber-300" : stats.netProfit >= 0 ? "text-[#00E676]" : "text-rose-500"}`}>
              {stats.profitComplete ? `${stats.netProfit >= 0 ? "+" : ""}${currencySymbol}${stats.netProfit.toLocaleString()}` : "Cost data incomplete"}
            </span>
            <span className="text-[10px] text-slate-400 block font-mono">
              {stats.profitComplete ? `Verified COGS: ${currencySymbol}${stats.cogs.toLocaleString()}` : `${stats.incompleteCostLines} sale line(s) need historical cost`}
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
                <span className="text-slate-300 font-sans">2. Salaries & Staff wages</span>
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
                  stroke={netProfitMarginPct === null ? "#FFC400" : netProfitMarginPct >= 20 ? "#00E676" : netProfitMarginPct >= 5 ? "#00B0FF" : netProfitMarginPct > 0 ? "#FFC400" : "#FF1744"}
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - Math.max(0, Math.min(netProfitMarginPct ?? 0, 100)) / 100)}`}
                  className="transition-all duration-1000 stroke-linecap-round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-base font-black font-mono text-white leading-none">
                  {netProfitMarginPct === null ? "N/A" : `${netProfitMarginPct.toFixed(1)}%`}
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
                {netProfitMarginPct === null ? (
                  <span className="text-amber-300">Cost Data Incomplete — Review Required</span>
                ) : netProfitMarginPct >= 25 ? (
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
            <span className={`font-black ${!stats.profitComplete ? "text-amber-300" : stats.netProfit >= 0 ? "text-[#00E676]" : "text-rose-500"}`}>
              {stats.profitComplete ? `${stats.netProfit >= 0 ? "+" : ""}${currencySymbol}${stats.netProfit.toLocaleString()}` : "Incomplete"}
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
                  const isProfitPositive = p.netProfit !== null && p.netProfit >= 0;
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
                        {p.totalCogs === null ? "Missing cost" : `${currencySymbol}${p.totalCogs.toLocaleString()}`}
                      </td>
                      <td className={`py-3.5 px-4 text-right font-mono font-extrabold ${isProfitPositive ? "text-[#00E676]" : "text-rose-500"}`}>
                        {p.netProfit === null ? "N/A" : `${isProfitPositive ? "+" : ""}${currencySymbol}${Math.round(p.netProfit).toLocaleString()}`}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${isProfitPositive ? "bg-emerald-950/40 text-emerald-400 border border-emerald-950" : "bg-rose-950/40 text-rose-400 border border-rose-950"}`}>
                          {p.profitMarginPct === null ? "N/A" : `${p.profitMarginPct.toFixed(1)}%`}
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
