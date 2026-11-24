import React, { useState } from "react";
import { Activity, CheckCircle2, AlertTriangle, XCircle, Copy } from "lucide-react";

type Props = {
  products: any[];
  transactions: any[];
  purchases: any[];
  expenses: any[];
  staffList?: any[];
  currencySymbol?: string;
};

type AuditFinding = { severity: "error" | "warning" | "ok"; title: string; detail: string };

const num = (value: any) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const close = (a: number, b: number, tolerance = 1) => Math.abs(a - b) <= tolerance;
const dayKey = (value: any) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "").slice(0, 10) : date.toISOString().slice(0, 10);
};

export function AccountingIntegrityAudit({ products = [], transactions = [], purchases = [], expenses = [], staffList = [], currencySymbol = "৳" }: Props) {
  const [findings, setFindings] = useState<AuditFinding[] | null>(null);
  const [checkedAt, setCheckedAt] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const runAudit = () => {
    const next: AuditFinding[] = [];
    const productIds = new Set(products.map(product => String(product.id)));
    const invoiceNos = new Set<string>();
    let duplicateInvoices = 0;
    let invoiceArithmeticErrors = 0;
    let invoiceBalanceErrors = 0;
    let returnQuantityErrors = 0;
    let returnValueErrors = 0;
    let fifoWarnings = 0;
    let orphanItems = 0;
    let negativeStocks = 0;
    let purchaseWarnings = 0;
    let salaryDuplicateDates = 0;

    transactions.forEach(tx => {
      const invoiceNo = String(tx.invoiceNo || tx.invoice_no || "");
      if (invoiceNo) {
        if (invoiceNos.has(invoiceNo)) duplicateInvoices += 1;
        invoiceNos.add(invoiceNo);
      }
      const subtotal = num(tx.subtotal);
      const tax = num(tx.tax);
      const discount = num(tx.discount);
      const total = num(tx.total ?? tx.total_amount);
      const paid = num(tx.paidAmount ?? tx.paid_amount);
      const due = num(tx.dueBalance ?? tx.due_balance);
      if (!close(subtotal + tax - discount, total, 1.5)) invoiceArithmeticErrors += 1;
      if (!close(Math.max(0, total - paid), due, 1.5)) invoiceBalanceErrors += 1;

      const returnHistory = Array.isArray(tx.returnHistory) ? tx.returnHistory : [];
      const returnedByItem = new Map<string, number>();
      returnHistory.forEach((entry: any) => {
        const lines = Array.isArray(entry.items) ? entry.items : [];
        lines.forEach((line: any) => {
          const id = String(line.transactionItemId || "");
          returnedByItem.set(id, (returnedByItem.get(id) || 0) + num(line.quantity));
        });
        const calculatedRefund = num(entry.subtotalAmount) + num(entry.taxAmount) - num(entry.discountAmount);
        if (!close(calculatedRefund, num(entry.refundAmount), 1.5)) returnValueErrors += 1;
      });
      (Array.isArray(tx.items) ? tx.items : []).forEach((item: any, index: number) => {
        const itemId = String(item.firestoreId || item.id || `${tx.id}_item_${index}`);
        if (num(item.quantity) < (returnedByItem.get(itemId) || 0) - 0.000001) returnQuantityErrors += 1;
        if (item.productId && !productIds.has(String(item.productId))) orphanItems += 1;
        const allocations = Array.isArray(item.costAllocations) ? item.costAllocations : [];
        if (allocations.length > 0) {
          const allocatedQty = allocations.reduce((sum: number, allocation: any) => sum + num(allocation.quantity), 0);
          if (!close(allocatedQty, num(item.quantity), 0.02)) fifoWarnings += 1;
        } else if (num(item.quantity) > 0 && item.isNegativeSale !== true) {
          fifoWarnings += 1;
        }
      });
      const refundHistory = Array.isArray(tx.refundHistory) ? tx.refundHistory : [];
      const refundTotal = refundHistory.reduce((sum: number, refund: any) => sum + Math.max(0, num(refund.amount)), 0);
      const paymentHistory = Array.isArray(tx.paymentHistory) ? tx.paymentHistory : [];
      if (paymentHistory.length > 0 && !close(paymentHistory.reduce((sum: number, payment: any) => sum + Math.max(0, num(payment.amount)), 0), paid + refundTotal, 2)) {
        next.push({ severity: "warning", title: `Payment history mismatch · ${invoiceNo || tx.id}`, detail: `Recorded collections and refunds do not reconcile to the current paid balance. Review the invoice payment history.` });
      }
    });

    products.forEach(product => {
      if (num(product.stock) < -0.000001) negativeStocks += 1;
      const lots = Array.isArray(product.costLots) ? product.costLots : [];
      if (lots.length > 0 && num(product.stock) >= 0 && product.hasNegativeSale !== true) {
        const lotQty = lots.reduce((sum: number, lot: any) => sum + Math.max(0, num(lot.remainingQuantity)), 0);
        if (!close(lotQty, num(product.stock), 0.02)) fifoWarnings += 1;
      }
    });

    purchases.forEach(purchase => {
      const quantity = num(purchase.quantity);
      const price = num(purchase.buyPrice ?? purchase.buy_price);
      const total = num(purchase.totalAmount ?? purchase.total_amount);
      if (quantity > 0 && !close(quantity * price, total, 1.5)) purchaseWarnings += 1;
      if (purchase.cashPaid !== undefined && purchase.dueAmount !== undefined &&
        !close(Math.max(0, total - num(purchase.cashPaid)), num(purchase.dueAmount), 1.5)) purchaseWarnings += 1;
    });

    const paidSalaryByDay = new Map<string, number>();
    staffList.forEach(staff => (Array.isArray(staff.salaryPayments) ? staff.salaryPayments : [])
      .filter((payment: any) => payment?.status === "paid")
      .forEach((payment: any) => {
        const key = dayKey(payment.paymentDate);
        paidSalaryByDay.set(key, (paidSalaryByDay.get(key) || 0) + num(payment.amount));
      }));
    const manualSalaryByDay = new Map<string, number>();
    expenses.filter(expense => /salary|payroll/i.test(String(expense.category || ""))).forEach(expense => {
      const key = dayKey(expense.date);
      manualSalaryByDay.set(key, (manualSalaryByDay.get(key) || 0) + num(expense.amount));
    });
    paidSalaryByDay.forEach((amount, day) => {
      if (manualSalaryByDay.has(day) && close(amount, manualSalaryByDay.get(day) || 0, 1)) salaryDuplicateDates += 1;
    });

    if (duplicateInvoices) next.push({ severity: "error", title: "Duplicate invoice numbers", detail: `${duplicateInvoices} duplicate invoice number(s) were found.` });
    if (invoiceArithmeticErrors) next.push({ severity: "error", title: "Invoice total mismatch", detail: `${invoiceArithmeticErrors} invoice(s) do not reconcile: subtotal + VAT − discount ≠ total.` });
    if (invoiceBalanceErrors) next.push({ severity: "error", title: "Customer balance mismatch", detail: `${invoiceBalanceErrors} invoice(s) do not reconcile: total − paid ≠ due.` });
    if (returnQuantityErrors) next.push({ severity: "error", title: "Return quantity exceeds sold quantity", detail: `${returnQuantityErrors} returned line(s) exceed their original sold quantity.` });
    if (returnValueErrors) next.push({ severity: "error", title: "Return value mismatch", detail: `${returnValueErrors} return record(s) do not reconcile after VAT and discount.` });
    if (negativeStocks) next.push({ severity: "warning", title: "Negative product stock", detail: `${negativeStocks} product(s) currently have negative stock.` });
    if (fifoWarnings) next.push({ severity: "warning", title: "FIFO cost-lot mismatch", detail: `${fifoWarnings} sale/product record(s) have missing or inconsistent FIFO allocation quantities.` });
    if (orphanItems) next.push({ severity: "warning", title: "Historical product references", detail: `${orphanItems} invoice line(s) refer to products not currently in the catalog. This may be intentional for archived products.` });
    if (purchaseWarnings) next.push({ severity: "warning", title: "Purchase amount mismatch", detail: `${purchaseWarnings} purchase record(s) need quantity × buy price and supplier due verification.` });
    if (salaryDuplicateDates) next.push({ severity: "warning", title: "Possible duplicate salary expenses", detail: `${salaryDuplicateDates} date(s) have matching paid Staff Hub salary and manual Salary expense totals. Confirm they represent the same payroll before production.` });
    if (next.length === 0) next.push({ severity: "ok", title: "No reconciliation issues detected", detail: "All checked invoice, balance, return, FIFO, purchase and stock rules passed for the data currently loaded in this session." });

    setFindings(next);
    setCheckedAt(new Date().toLocaleString());
    setCopyMessage("");
  };

  const copyReport = async () => {
    if (!findings) return;
    const report = [
      `Barakah E-Mart accounting audit · ${checkedAt}`,
      ...findings.map(item => `[${item.severity.toUpperCase()}] ${item.title}: ${item.detail}`)
    ].join("\n");
    try {
      await navigator.clipboard.writeText(report);
      setCopyMessage("Audit summary copied.");
    } catch {
      setCopyMessage("Copy is not available in this browser.");
    }
  };

  const errors = findings?.filter(item => item.severity === "error").length || 0;
  const warnings = findings?.filter(item => item.severity === "warning").length || 0;
  return (
    <section className="rounded-2xl border border-white/10 bg-[#10141d] p-5 space-y-4" id="accounting-integrity-audit">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-cyan-400/10 p-3 text-cyan-300"><Activity className="h-5 w-5" /></div>
          <div><h2 className="text-sm font-bold text-white">Accounting Data Integrity Check</h2><p className="mt-1 text-[10px] text-slate-400">Read-only checks against records already loaded in this session.</p></div>
        </div>
        <button type="button" onClick={runAudit} className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2.5 text-xs font-bold text-cyan-100">Run Data Audit</button>
      </div>
      <p className="text-[10px] text-slate-500">This check does not create Firestore reads, writes, listeners, or background sync. It uses the current Products, Invoices, Purchases, Expenses and Staff data already displayed by the app.</p>
      {findings && <>
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
          <span>Checked: {checkedAt}</span>
          <span className="text-rose-300">Errors: {errors}</span>
          <span className="text-amber-300">Warnings: {warnings}</span>
          <button type="button" onClick={copyReport} className="inline-flex items-center gap-1 text-cyan-300"><Copy className="h-3 w-3" />Copy summary</button>
          {copyMessage && <span>{copyMessage}</span>}
        </div>
        <div className="space-y-2">
          {findings.map((finding, index) => <div key={index} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            {finding.severity === "error" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" /> : finding.severity === "warning" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />}
            <div><div className="text-xs font-semibold text-white">{finding.title}</div><div className="mt-1 text-[10px] leading-relaxed text-slate-400">{finding.detail}</div></div>
          </div>)}
        </div>
      </>}
    </section>
  );
}
