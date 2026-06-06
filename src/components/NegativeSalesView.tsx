import React, { useState } from "react";
import { Check, AlertCircle, ShoppingBag, Clock, Save, Edit2, User, FileText } from "lucide-react";

interface NegativeSalesProps {
  products: any[];
  onUpdatePricing: (id: string, buyPrice: number, sellPrice: number, addStock?: number) => void;
  onMarkUpdated: (id: string, updated: boolean) => void;
  currencySymbol: string;
  transactions: any[];
  contacts: any[];
  onNavigateToCustomer: (customerName: string) => void;
  onNavigateToInvoice: (invoiceNo: string) => void;
  onUpdateTransactionItemPrice?: (txId: string, itemIdx: number, buyPrice: number, isApproved: boolean, productId?: string) => void;
}

interface NegativeSaleItemRow {
  transactionId: string;
  invoiceNo: string;
  date: string;
  customerName: string;
  itemIndex: number;
  itemId: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  unit: string;
  quantity: number;
  price: number;
  buyPrice: number;
  isApproved: boolean;
}

export function NegativeSalesView({
  products = [],
  onUpdatePricing,
  onMarkUpdated,
  currencySymbol = "৳",
  transactions = [],
  contacts = [],
  onNavigateToCustomer,
  onNavigateToInvoice,
  onUpdateTransactionItemPrice
}: NegativeSalesProps) {
  // 1. Gather all individual transaction items that were purchased/sold with negative stock
  const negativeItems: NegativeSaleItemRow[] = [];

  transactions.forEach((tx) => {
    const associatedContact = contacts.find(c => c.id === tx.contactId);
    const customerName = associatedContact ? associatedContact.name : "Walk-in Showroom Client";

    if (tx.items && Array.isArray(tx.items)) {
      tx.items.forEach((item, idx) => {
        const dbProduct = products.find(p => p.id === item.productId || p.name === item.name);
        
        // Match negative state conditions (explicit tag, or product catalog is negative)
        const isNegative = item.isNegativeSale === true || (dbProduct && dbProduct.stock < 0);

        if (isNegative) {
          negativeItems.push({
            transactionId: tx.id,
            invoiceNo: tx.invoiceNo || "INV-000",
            date: tx.date || new Date().toISOString(),
            customerName,
            itemIndex: idx,
            itemId: item.id,
            productId: item.productId || (dbProduct ? dbProduct.id : ""),
            productName: item.name || (dbProduct ? dbProduct.name : "Unknown Product"),
            sku: dbProduct ? dbProduct.sku : (item.sku || "N/A"),
            category: dbProduct ? dbProduct.category : "Uncategorized",
            unit: dbProduct ? dbProduct.unit : "piece",
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0,
            buyPrice: item.buyPrice !== undefined && item.buyPrice > 0 ? Number(item.buyPrice) : (dbProduct ? Number(dbProduct.buyPrice) : 0),
            isApproved: item.isNegativeSaleApproved === true || item.negativeSaleUpdated === true
          });
        }
      });
    }
  });

  // Sort by date descending
  negativeItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Editing state
  const [editingKey, setEditingKey] = useState<string | null>(null); // txId_itemIndex
  const [editedBuyPrice, setEditedBuyPrice] = useState<string>("");
  const [alsoUpdateCatalog, setAlsoUpdateCatalog] = useState<boolean>(true);

  const startEditing = (row: NegativeSaleItemRow) => {
    setEditingKey(`${row.transactionId}_${row.itemIndex}`);
    setEditedBuyPrice(row.buyPrice.toString());
  };

  const handleSaveCost = (row: NegativeSaleItemRow) => {
    const cost = parseFloat(editedBuyPrice) || 0;
    if (onUpdateTransactionItemPrice) {
      onUpdateTransactionItemPrice(
        row.transactionId,
        row.itemIndex,
        cost,
        true, // Auto-approve upon manual entry of cost price
        alsoUpdateCatalog ? row.productId : undefined
      );
    } else {
      // Fallback
      onUpdatePricing(row.productId, cost, row.price, 0);
    }
    setEditingKey(null);
  };

  const handleToggleApproval = (row: NegativeSaleItemRow) => {
    if (onUpdateTransactionItemPrice) {
      onUpdateTransactionItemPrice(
        row.transactionId,
        row.itemIndex,
        row.buyPrice,
        !row.isApproved,
        undefined
      );
    } else {
      onMarkUpdated(row.productId, !row.isApproved);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn text-slate-200 font-sans" id="negative-sales-view">
      
      {/* Overview stats container */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0a101f]/80 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-mono">Separate Overdraft Sales</span>
            <h4 className="text-2xl font-black mt-1 text-rose-400 font-mono">{negativeItems.length}</h4>
          </div>
          <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-450 border border-rose-500/20">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>
        
        <div className="bg-[#0a101f]/80 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-mono">Pending Cost Specification</span>
            <h4 className="text-2xl font-black mt-1 text-yellow-400 font-mono">
              {negativeItems.filter(i => i.buyPrice === 0 || !i.isApproved).length}
            </h4>
          </div>
          <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20">
            <AlertCircle className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-[#0a101f]/80 border border-slate-800 p-5 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-mono">Approved / Solved Sales</span>
            <h4 className="text-2xl font-black mt-1 text-emerald-400 font-mono">
              {negativeItems.filter(i => i.isApproved).length}
            </h4>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <Check className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Extremely clean table ledger container */}
      <div className="bg-[#0a101f]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl" id="negative-table-ledger">
        <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#070b16]">
          <div>
            <h3 className="text-sm font-black tracking-wider uppercase text-white font-display">
              Individual Negative Overdraft Sales Log & Reconciliation
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              Verify administrative cost prices for each separate sold item. Specifying cost prices recalculates pure profit margins instantly.
            </p>
          </div>
          <div className="px-3 py-1 rounded-full text-[10px] font-bold font-mono bg-rose-500/10 text-rose-450 border border-rose-500/20">
            Overdraft Item Logs: {negativeItems.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="bg-[#050912] border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">
                <th className="py-4 px-5 text-center">Status</th>
                <th className="py-4 px-5">Sales Invoice & Customer</th>
                <th className="py-4 px-5">SKU Code</th>
                <th className="py-4 px-5">Product Name</th>
                <th className="py-4 px-5 text-center font-mono">Qty</th>
                <th className="py-4 px-5 text-right">Sale Price</th>
                <th className="py-4 px-5 text-right text-rose-300">Cost Price (Specification)</th>
                <th className="py-4 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/65 font-sans">
              {negativeItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 italic font-mono">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="text-3xl">🎉</span>
                      <span className="text-xs text-slate-500 tracking-wide">Currently no negative overdraft sales! All items have solid physical stock.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                negativeItems.map((item) => {
                  const key = `${item.transactionId}_${item.itemIndex}`;
                  const isEditing = editingKey === key;
                  const isUpdated = item.isApproved;

                  return (
                    <tr 
                      key={key} 
                      className={`transition-colors duration-150 ${
                        isUpdated 
                          ? "bg-[#0b1b15]/40 hover:bg-[#0b1b15]/60 border-l-4 border-emerald-500" 
                          : "bg-[#250d13]/30 hover:bg-[#250d13]/50 border-l-4 border-rose-500"
                      }`}
                    >
                      {/* Checkmark tick column */}
                      <td className="py-4 px-5 text-center font-sans">
                        <button
                          type="button"
                          onClick={() => handleToggleApproval(item)}
                          className={`w-7 h-7 mx-auto flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                            isUpdated
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                              : "bg-rose-500/10 text-rose-450 border-rose-500/30 hover:border-rose-400 hover:bg-rose-500/20 animate-pulse"
                          }`}
                          title={isUpdated ? "Mark as Pending (Reset)" : "Mark as Approved & Solved"}
                        >
                          {isUpdated ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-550" />
                          )}
                        </button>
                      </td>

                      {/* Sales Invoice & Customer */}
                      <td className="py-4 px-5">
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => onNavigateToCustomer(item.customerName)}
                            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
                            title="View Customer Profile"
                          >
                            <User className="w-3.5 h-3.5 inline text-slate-400" /> {item.customerName}
                          </button>
                          
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.invoiceNo) onNavigateToInvoice(item.invoiceNo);
                              }}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-slate-300 font-bold tracking-wide transition-all cursor-pointer inline-flex items-center gap-1"
                              title="Open Invoice Ledger"
                            >
                              <FileText className="w-3 h-3 text-slate-400" /> {item.invoiceNo}
                            </button>
                            <span className="text-[9px] text-slate-500 font-mono inline-flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(item.date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* SKU Code */}
                      <td className="py-4 px-5 font-mono text-slate-400 font-semibold">{item.sku}</td>

                      {/* Product Name */}
                      <td className="py-4 px-5">
                        <div className="space-y-0.5">
                          <span className="font-bold text-white block">{item.productName}</span>
                          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{item.category}</span>
                        </div>
                      </td>

                      {/* Quantity Sold */}
                      <td className="py-4 px-5 text-center font-mono">
                        <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-black border border-slate-700 text-[10px]">
                          {item.quantity} {item.unit}
                        </span>
                      </td>

                      {/* Sell Price */}
                      <td className="py-4 px-5 text-right font-mono font-bold text-slate-300">
                        {currencySymbol} {item.price.toLocaleString()}
                      </td>

                      {/* specifiable Cost Price / buyPrice */}
                      <td className="py-4 px-5 text-right font-mono">
                        {isEditing ? (
                          <div className="flex flex-col items-end gap-1.5 align-middle">
                            <input
                              type="number"
                              value={editedBuyPrice}
                              onChange={(e) => setEditedBuyPrice(e.target.value)}
                              className="w-28 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-rose-300 text-xs font-mono outline-none font-bold text-right"
                              placeholder="Cost Price"
                              autoFocus
                            />
                            <label className="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={alsoUpdateCatalog}
                                onChange={(e) => setAlsoUpdateCatalog(e.target.checked)}
                                className="rounded bg-slate-900 border-slate-700 text-emerald-500 accent-emerald-500 outline-none"
                              />
                              Update catalog default buy price
                            </label>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className={`font-black ${item.buyPrice === 0 ? "text-yellow-400" : "text-slate-200"}`}>
                              {currencySymbol} {item.buyPrice.toLocaleString()}
                            </span>
                            {item.buyPrice === 0 && (
                              <span className="text-[8px] text-yellow-500 block font-mono bg-yellow-500/5 border border-yellow-500/10 px-1 rounded">Needs specification</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-2 justify-center">
                            <button
                              type="button"
                              onClick={() => handleSaveCost(item)}
                              className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-[10px] rounded flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Save className="w-3.5 h-3.5" /> Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingKey(null)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer transition-all border flex items-center gap-1.5 mx-auto ${
                              item.buyPrice === 0
                                ? "bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border-yellow-500/20 animate-pulse"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                            }`}
                          >
                            <Edit2 className="w-3 h-3 text-emerald-400" />
                            Specify Cost Price
                          </button>
                        )}
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
  );
}
