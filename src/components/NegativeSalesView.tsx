import React, { useState } from "react";
import { Check, CheckCircle2, AlertCircle, ShoppingBag, Clock } from "lucide-react";

interface NegativeSalesProps {
  products: any[];
  onUpdatePricing: (id: string, buyPrice: number, sellPrice: number, addStock?: number) => void;
  onMarkUpdated: (id: string, updated: boolean) => void;
  currencySymbol: string;
  transactions: any[];
  contacts: any[];
  onNavigateToCustomer: (customerName: string) => void;
  onNavigateToInvoice: (invoiceNo: string) => void;
}

export function NegativeSalesView({
  products,
  onUpdatePricing,
  onMarkUpdated,
  currencySymbol = "৳",
  transactions = [],
  contacts = [],
  onNavigateToCustomer,
  onNavigateToInvoice
}: NegativeSalesProps) {
  // Ensure we include both currently negative and pre-registered negative items
  const negativeStockProducts = products.filter(p => p.stock < 0 || p.hasNegativeSale);

  // States for inline pricing adjustments
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newBuy, setNewBuy] = useState("");
  const [newSell, setNewSell] = useState("");
  const [restockQty, setRestockQty] = useState("");

  const handleStartEdit = (prod: any) => {
    setEditingId(prod.id);
    setNewBuy(prod.buyPrice.toString());
    setNewSell(prod.sellPrice.toString());
    setRestockQty("");
  };

  const handleSave = (id: string) => {
    onUpdatePricing(
      id, 
      parseFloat(newBuy) || 0, 
      parseFloat(newSell) || 0, 
      parseFloat(restockQty) || 0
    );
    setEditingId(null);
  };

  // Find all transactions that contain a specific product
  const getProductTransactions = (pId: string, pName: string) => {
    return transactions.filter(t => 
      t.items.some(item => item.productId === pId || item.id === pId || item.name.toLowerCase() === pName.toLowerCase())
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn text-slate-200 font-sans" id="negative-sales-view">
      
      {/* Extremely clean table ledger container */}
      <div className="bg-[#0a101f]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl" id="negative-table-ledger">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#070b16]">
          <div>
            <h3 className="text-sm font-black tracking-wider uppercase text-white font-display">
              Negative Overdraft Sales Log & Reconciliation
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              Verify administrative costs, buying prices, and approve negative inventory items.
            </p>
          </div>
          <div className="px-3 py-1 rounded-full text-[10px] font-bold font-mono bg-rose-500/10 text-rose-450 border border-rose-500/20">
            Total Overdraft Items: {negativeStockProducts.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="bg-[#050912] border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">
                <th className="py-4 px-5 text-center">Mark</th>
                <th className="py-4 px-5">SKU Code</th>
                <th className="py-4 px-5">Product Name</th>
                <th className="py-4 px-5">Last Associated Sales Reference & Customer</th>
                <th className="py-4 px-5 font-mono">Category</th>
                <th className="py-4 px-5 text-center">Overdraft Stock</th>
                <th className="py-4 px-5 text-right">Buy Price</th>
                <th className="py-4 px-5 text-right">Sell Price</th>
                <th className="py-4 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/65 font-sans">
              {negativeStockProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400 italic font-mono">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="text-3xl">🎉</span>
                      <span className="text-xs text-slate-550 tracking-wide">Currently no negative overdraft sales! All inventory levels are healthy and positive.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                negativeStockProducts.map((p) => {
                  const isEditing = editingId === p.id;
                  const isUpdated = p.negativeSaleUpdated === true;

                  return (
                    <tr 
                      key={p.id} 
                      className={`transition-colors duration-150 ${
                        isUpdated 
                          ? "bg-emerald-950/10 hover:bg-emerald-950/20 border-l-4 border-emerald-500" 
                          : "bg-rose-950/10 hover:bg-rose-950/15 border-l-4 border-rose-500"
                      }`}
                    >
                      {/* Checkmark tick column */}
                      <td className="py-4 px-5 text-center font-sans">
                        <button
                          type="button"
                          onClick={() => onMarkUpdated(p.id, !isUpdated)}
                          className={`w-7 h-7 mx-auto flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                            isUpdated
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500 hover:bg-emerald-500/30"
                              : "bg-rose-500/10 text-rose-450 border-rose-500/30 hover:border-rose-400 hover:bg-rose-500/20 animate-pulse"
                          }`}
                          title={isUpdated ? "Mark as Pending (Reset)" : "Mark as Approved & Solved (Turn Green)"}
                        >
                          {isUpdated ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-550" />
                          )}
                        </button>
                      </td>

                      <td className="py-4 px-5 font-mono text-slate-400 font-semibold">{p.sku}</td>
                      <td className="py-4 px-5 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {isUpdated ? (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded">
                              Verified
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-500/15 text-rose-450 border border-rose-500/20 rounded">
                              Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        {(() => {
                          const pTxs = getProductTransactions(p.id, p.name);
                          if (pTxs.length === 0) {
                            return <span className="text-slate-500 italic font-mono text-[10px]">No sales recorded</span>;
                          }
                          // Sort by date descending
                          const sorted = [...pTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                          const latest = sorted[0];
                          const associatedContact = contacts.find(c => c.id === latest.contactId);
                          const customerLabel = associatedContact ? associatedContact.name : "Walk-in Showroom Client";
                          
                          return (
                            <div className="space-y-1.5" id={`p-negative-assoc-${p.id}`}>
                              {/* Clickable Customer Name */}
                              <button
                                type="button"
                                onClick={() => onNavigateToCustomer(customerLabel)}
                                className="text-xs font-extrabold text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer flex items-center gap-1 text-left bg-transparent border-0 p-0"
                                title="View Customer Profile"
                              >
                                👤 {customerLabel}
                              </button>
                              
                              {/* Clickable Invoice number */}
                              <button
                                type="button"
                                onClick={() => onNavigateToInvoice(latest.invoiceNo)}
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-slate-300 font-bold tracking-wide transition-all cursor-pointer inline-flex items-center gap-1 text-left"
                                title="Open invoice details in ledger"
                              >
                                📄 {latest.invoiceNo}
                              </button>
                              
                              {pTxs.length > 1 && (
                                <span className="text-[9px] text-slate-500 block font-mono italic">
                                  + {pTxs.length - 1} other transactions
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-4 px-5 font-mono text-xs text-slate-400">{p.category}</td>
                      <td className="py-4 px-5 text-center font-mono">
                        <span className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-black w-max mx-auto block ${
                          isUpdated 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                            : "bg-rose-500/10 text-rose-455 border-rose-500/30"
                        }`}>
                          {p.stock} {p.unit}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            value={newBuy}
                            onChange={(e) => setNewBuy(e.target.value)}
                            className="w-24 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 text-xs font-mono outline-none font-bold"
                          />
                        ) : (
                          `${currencySymbol} ${(p.buyPrice ?? 0).toLocaleString()}`
                        )}
                      </td>
                      <td className="py-4 px-5 text-right font-mono font-bold">
                        {isEditing ? (
                          <input
                            type="number"
                            value={newSell}
                            onChange={(e) => setNewSell(e.target.value)}
                            className="w-24 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-xs font-mono outline-none"
                          />
                        ) : (
                          `${currencySymbol} ${(p.sellPrice ?? 0).toLocaleString()}`
                        )}
                      </td>
                      <td className="py-4 px-5 text-center font-sans">
                        {isEditing ? (
                          <div className="flex items-center gap-2 justify-center">
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] text-slate-400 mb-0.5 font-mono font-bold">Add Restock</span>
                              <input
                                type="number"
                                placeholder="+ stock"
                                value={restockQty}
                                onChange={(e) => setRestockQty(e.target.value)}
                                className="w-16 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono outline-none text-center animate-pulse"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSave(p.id)}
                              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-lg transition-all shrink-0 cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-all shrink-0 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(p)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                              isUpdated
                                ? "bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/20"
                                : "bg-rose-500/10 hover:bg-rose-500/25 text-rose-450 border-rose-500/20"
                            }`}
                          >
                            Adjust Stock & Price
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
