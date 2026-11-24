import React, { useMemo, useState } from "react";
import { RotateCcw, ReceiptText, AlertTriangle, CheckCircle2 } from "lucide-react";

type ReturnLineInput = { transactionItemId: string; productId?: string; quantity: number };
type ReturnRequest = {
  transactionId: string;
  date: string;
  reason: string;
  refundMethod: string;
  note: string;
  items: ReturnLineInput[];
};

type Props = {
  transactions: any[];
  onProcessReturn: (request: ReturnRequest) => Promise<boolean>;
  currencySymbol?: string;
};

const money = (value: number, symbol: string) => `${symbol} ${Math.round(value || 0).toLocaleString("en-US")}`;
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function SalesReturnsView({ transactions = [], onProcessReturn, currencySymbol = "৳" }: Props) {
  const [invoiceId, setInvoiceId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [returnDate, setReturnDate] = useState(today());
  const [reason, setReason] = useState("Customer return");
  const [refundMethod, setRefundMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const eligibleTransactions = useMemo(() => transactions.filter(tx =>
    Array.isArray(tx?.items) && tx.items.some((item: any, index: number) => {
      const itemId = String(item.firestoreId || item.id || `${tx.id}_item_${index}`);
      const returned = (Array.isArray(tx.returnHistory) ? tx.returnHistory : [])
        .flatMap((entry: any) => Array.isArray(entry.items) ? entry.items : [])
        .filter((line: any) => String(line.transactionItemId) === itemId)
        .reduce((sum: number, line: any) => sum + (Number(line.quantity) || 0), 0);
      return Math.max(0, Number(item.quantity) - returned) > 0.000001;
    })
  ), [transactions]);

  const selectedTransaction = eligibleTransactions.find(tx => tx.id === invoiceId) || null;
  const returnableLines = useMemo(() => {
    if (!selectedTransaction) return [];
    return (selectedTransaction.items || []).map((item: any, index: number) => {
      const itemId = String(item.firestoreId || item.id || `${selectedTransaction.id}_item_${index}`);
      const returned = (Array.isArray(selectedTransaction.returnHistory) ? selectedTransaction.returnHistory : [])
        .flatMap((entry: any) => Array.isArray(entry.items) ? entry.items : [])
        .filter((line: any) => String(line.transactionItemId) === itemId)
        .reduce((sum: number, line: any) => sum + (Number(line.quantity) || 0), 0);
      return {
        itemId,
        productId: item.productId,
        name: item.name || "Product",
        quantity: Number(item.quantity) || 0,
        returned,
        available: Math.max(0, (Number(item.quantity) || 0) - returned),
        price: Number(item.price) || 0
      };
    }).filter((line: any) => line.available > 0.000001);
  }, [selectedTransaction]);

  const originalSubtotal = Number(selectedTransaction?.originalSubtotal ?? selectedTransaction?.subtotal) || 0;
  const originalTotal = Number(selectedTransaction?.originalTotal ?? selectedTransaction?.total) || 0;
  const invoiceValueFactor = originalSubtotal > 0 ? originalTotal / originalSubtotal : 1;
  const selectedReturnValue = returnableLines.reduce((sum: number, line: any) => {
    const qty = Math.max(0, Number(quantities[line.itemId]) || 0);
    return sum + Math.min(qty, line.available) * line.price * invoiceValueFactor;
  }, 0);

  const handleSubmit = async () => {
    if (!selectedTransaction) return;
    if (!returnDate) return;
    const items = returnableLines.map((line: any) => ({
      transactionItemId: line.itemId,
      productId: line.productId,
      quantity: Number(quantities[line.itemId]) || 0
    })).filter((line: ReturnLineInput) => line.quantity > 0);
    if (items.length === 0) return;
    if (items.some(line => {
      const match = returnableLines.find((row: any) => row.itemId === line.transactionItemId);
      return !match || line.quantity > match.available + 0.000001;
    })) return;

    setSaving(true);
    try {
      const saved = await onProcessReturn({
        transactionId: selectedTransaction.id,
        date: returnDate,
        reason: reason.trim() || "Customer return",
        refundMethod,
        note: note.trim(),
        items
      });
      if (saved) {
        setQuantities({});
        setInvoiceId("");
        setReturnDate(today());
        setNote("");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 text-slate-200" id="sales-returns-workspace">
      <div className="rounded-2xl border border-white/10 bg-[#10141d] p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-400/10 p-3 text-amber-300"><RotateCcw className="h-5 w-5" /></div>
          <div><h1 className="text-xl font-bold text-white">Sales Returns & Refunds</h1><p className="mt-1 text-xs text-slate-400">Return full or partial quantities from an existing invoice. Returned stock is restored to its original FIFO cost lots.</p></div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#10141d] p-5 space-y-4">
        <label className="block space-y-2">
          <span className="text-xs font-semibold text-slate-300">Select Original Invoice</span>
          <select value={invoiceId} onChange={event => { setInvoiceId(event.target.value); setQuantities({}); }} className="w-full rounded-xl border border-white/15 bg-[#090d14] px-3 py-3 text-sm text-white">
            <option value="">Choose an invoice with returnable items</option>
            {eligibleTransactions.map(tx => <option key={tx.id} value={tx.id}>{tx.invoiceNo || tx.invoice_no || tx.id} · {tx.date ? new Date(tx.date).toLocaleDateString() : "No date"} · {tx.contactName || tx.customerName || "Customer"}</option>)}
          </select>
        </label>

        {selectedTransaction ? <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.04] p-3 text-xs">
            <span className="text-slate-300"><ReceiptText className="mr-1 inline h-3.5 w-3.5" />Invoice {selectedTransaction.invoiceNo || selectedTransaction.invoice_no || selectedTransaction.id}</span>
            <span className="text-slate-400">Current invoice total: {money(Number(selectedTransaction.total) || 0, currencySymbol)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-500"><tr><th className="p-3">Product</th><th className="p-3 text-right">Sold</th><th className="p-3 text-right">Returned</th><th className="p-3 text-right">Available</th><th className="p-3 text-right">Return Qty</th></tr></thead>
              <tbody className="divide-y divide-white/10">
                {returnableLines.map((line: any) => <tr key={line.itemId}>
                  <td className="p-3 text-white">{line.name}<div className="text-[10px] text-slate-500">{money(line.price, currencySymbol)} / unit</div></td>
                  <td className="p-3 text-right">{line.quantity}</td>
                  <td className="p-3 text-right text-amber-300">{line.returned}</td>
                  <td className="p-3 text-right text-emerald-300">{line.available}</td>
                  <td className="p-3 text-right"><input type="number" min="0" max={line.available} step="0.01" value={quantities[line.itemId] || ""} onChange={event => setQuantities(prev => ({ ...prev, [line.itemId]: event.target.value }))} className="w-24 rounded-lg border border-white/15 bg-[#090d14] px-2 py-2 text-right text-white" /></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-xs text-slate-400">Return Date</span><input type="date" value={returnDate} onChange={event => setReturnDate(event.target.value)} className="w-full rounded-xl border border-white/15 bg-[#090d14] px-3 py-3 text-sm text-white" /></label>
            <label className="space-y-1"><span className="text-xs text-slate-400">Refund Method (if cash refund is due)</span><select value={refundMethod} onChange={event => setRefundMethod(event.target.value)} className="w-full rounded-xl border border-white/15 bg-[#090d14] px-3 py-3 text-sm text-white"><option>Cash</option><option>Bank</option><option>Mobile Banking</option><option>Store Credit</option></select></label>
            <label className="space-y-1"><span className="text-xs text-slate-400">Reason</span><input value={reason} onChange={event => setReason(event.target.value)} className="w-full rounded-xl border border-white/15 bg-[#090d14] px-3 py-3 text-sm text-white" /></label>
            <label className="space-y-1"><span className="text-xs text-slate-400">Note (Optional)</span><input value={note} onChange={event => setNote(event.target.value)} className="w-full rounded-xl border border-white/15 bg-[#090d14] px-3 py-3 text-sm text-white" /></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
            <div><div className="text-[10px] uppercase tracking-wide text-slate-400">Estimated return value</div><div className="mt-1 text-xl font-bold text-white">{money(selectedReturnValue, currencySymbol)}</div><div className="mt-1 text-[10px] text-slate-500">Includes the original invoice's proportional discount and VAT.</div></div>
            <button type="button" disabled={saving || selectedReturnValue <= 0} onClick={handleSubmit} className="inline-flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/15 px-5 py-3 text-xs font-bold text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />{saving ? "Saving Return..." : "Process Return"}</button>
          </div>
          <p className="flex items-start gap-2 text-[10px] text-slate-500"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />The return is saved against the original invoice. Any cash refund is limited to money already collected; the remaining return value reduces the customer's outstanding balance.</p>
        </> : <p className="py-8 text-center text-xs text-slate-500">Select an invoice to review its returnable quantities.</p>}
      </div>
    </div>
  );
}
