import React, { useState } from "react";
import { AlertTriangle, TrendingDown } from "lucide-react";

interface NegativeSalesProps {
  products: any[];
  onUpdatePricing: (id: string, buyPrice: number, sellPrice: number, addStock?: number) => void;
  currencySymbol: string;
  transactions: any[];
  contacts: any[];
  onNavigateToCustomer: (customerName: string) => void;
  onNavigateToInvoice: (invoiceNo: string) => void;
}

export function NegativeSalesView({
  products,
  onUpdatePricing,
  currencySymbol = "৳",
  transactions = [],
  contacts = [],
  onNavigateToCustomer,
  onNavigateToInvoice
}: NegativeSalesProps) {
  const negativeStockProducts = products.filter(p => p.stock < 0);

  // States for inline pricing adjustments
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newBuy, setNewBuy] = useState("");
  const [newSell, setNewSell] = useState("");
  const [restockQty, setRestockQty] = useState("");

  const handleStartEdit = (prod: any) => {
    setEditingId(prod.id);
    setNewBuy(prod.buyPrice.toString());
    setNewSell(prod.sellPrice.toString());
    restockQty && setRestockQty("");
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
    <div className="space-y-6 animate-fadeIn text-slate-700 font-sans" id="negative-sales-view">
      
      {/* Information Box explaining the "Minus Item Sales" feature */}
      <div className="bg-white border border-amber-200 p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-start shadow-sm" id="negative-sales-header">
        <div className="p-3 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl shrink-0">
          <AlertTriangle className="w-5.5 h-5.5 animate-pulse" />
        </div>
        <div className="space-y-1.5" id="negative-intro">
          <h2 className="text-sm font-extrabold text-slate-800 tracking-wide uppercase flex items-center gap-2">
            Negative Stock & Profit Margin Adjustments
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Even if a product's recorded stock shows 0 or negative as items are sold, transactions continue smoothly so no customer is turned away! Once new purchase stock arrives, define the correct Buy Price here to automatically recalculate exact net profit on your dashboard.
          </p>
        </div>
      </div>

      {/* Grid displays tracking negative totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="negative-stats-cards">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-400 font-bold block">Negative Product Types</span>
            <span className="text-2xl font-black font-num text-rose-600">{negativeStockProducts.length} Products</span>
          </div>
          <TrendingDown className="w-8 h-8 text-rose-500/10 shrink-0" />
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between col-span-2 shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-400 font-bold block">Status Alert</span>
            <span className="text-xs text-amber-600 font-medium leading-relaxed block">
              ⚠️ Negative items require immediate purchase rate updates to correct net profit metrics. Clicking a customer name maps their profile immediately!
            </span>
          </div>
        </div>
      </div>

      {/* Negative Stock Table Ledger */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm" id="negative-table-ledger">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-xs font-black tracking-wider uppercase text-slate-800">Negative Stock Inventory Tracking</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">
                <th className="py-3 px-5">SKU Code</th>
                <th className="py-3 px-5">Product Name</th>
                <th className="py-3 px-5">Last Associated Sales Reference & Customer</th>
                <th className="py-3 px-5">Category</th>
                <th className="py-3 px-5 text-center">Negative Stock</th>
                <th className="py-3 px-5 text-right">Buy Price</th>
                <th className="py-3 px-5 text-right">Sell Price</th>
                <th className="py-3 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {negativeStockProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                    🎉 Currently no negative stock! All inventory levels are healthy and positive.
                  </td>
                </tr>
              ) : (
                negativeStockProducts.map((p) => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 text-slate-700">
                      <td className="py-3.5 px-5 font-mono text-slate-500 font-semibold">{p.sku}</td>
                      <td className="py-3.5 px-5 font-bold text-slate-900">{p.name}</td>
                      <td className="py-3.5 px-5">
                        {(() => {
                          const pTxs = getProductTransactions(p.id, p.name);
                          if (pTxs.length === 0) {
                            return <span className="text-slate-400 italic font-mono text-[10px]">No sales recorded</span>;
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
                                className="text-xs font-extrabold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer flex items-center gap-1 text-left bg-transparent border-0 p-0"
                                title="View Customer Profile"
                              >
                                👤 {customerLabel}
                              </button>
                              
                              {/* Clickable Invoice number */}
                              <button
                                type="button"
                                onClick={() => onNavigateToInvoice(latest.invoiceNo)}
                                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-mono text-slate-600 font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1 text-left"
                                title="Open invoice details in ledger"
                              >
                                📄 {latest.invoiceNo}
                              </button>
                              
                              {pTxs.length > 1 && (
                                <span className="text-[9px] text-slate-400 block font-mono italic">
                                  + {pTxs.length - 1} other transactions
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-slate-550">{p.category}</td>
                      <td className="py-3.5 px-5 text-center font-mono">
                        <span className="px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-black w-max mx-auto block">
                          {p.stock} {p.unit}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            value={newBuy}
                            onChange={(e) => setNewBuy(e.target.value)}
                            className="w-24 px-2.5 py-1 bg-slate-55 border border-slate-200 rounded-lg text-emerald-600 text-xs font-mono outline-none font-bold"
                          />
                        ) : (
                          `${currencySymbol} ${(p.buyPrice ?? 0).toLocaleString()}`
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold">
                        {isEditing ? (
                          <input
                            type="number"
                            value={newSell}
                            onChange={(e) => setNewSell(e.target.value)}
                            className="w-24 px-2.5 py-1 bg-slate-55 border border-slate-200 rounded-lg text-slate-800 text-xs font-mono outline-none"
                          />
                        ) : (
                          `${currencySymbol} ${(p.sellPrice ?? 0).toLocaleString()}`
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-center font-sans">
                        {isEditing ? (
                          <div className="flex items-center gap-2 justify-center">
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] text-slate-400 mb-0.5 font-mono font-bold">Add Restock</span>
                              <input
                                type="number"
                                placeholder="+ stock"
                                value={restockQty}
                                onChange={(e) => setRestockQty(e.target.value)}
                                className="w-16 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-mono outline-none text-center"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSave(p.id)}
                              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-601 text-slate-950 font-bold text-xs rounded-lg transition-all shrink-0 cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-all shrink-0 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(p)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-[#10b981]/15 text-emerald-600 border border-emerald-100 rounded-xl text-xs font-bold cursor-pointer transition-all"
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
