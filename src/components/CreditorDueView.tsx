import React, { useMemo, useState } from "react";
import { BarChart3, PlusCircle, Users, Package, Trash2, Pencil, Check, X } from "lucide-react";
import { safeFormat } from "../lib/dateUtils";

type Creditor = { id: string; name: string; phone?: string; active?: boolean };
type CreditorEntry = {
  id: string; creditorId: string; creditorName: string; dueAmount: number;
  paidAmount: number; date: string; paymentMethod: string; note?: string;
  paidBy?: string; receivedBy?: string;
};
type Ledger = { creditors: Creditor[]; entries: CreditorEntry[] };

type Props = {
  businessInfo: any;
  setBusinessInfo: React.Dispatch<React.SetStateAction<any>>;
  triggerNotification: (message: string, type: "success" | "error" | "info") => void;
  toUUID: (value: string, email?: string) => string;
  activeUser: any;
  activeSection: "creditor-entry" | "creditors" | "creditor-report";
};

const inputClass = "w-full bg-white/[0.075] border border-white/18 rounded-xl px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none shadow-inner backdrop-blur-2xl focus:border-white/30 focus:bg-white/[0.10]";
const panelClass = "bg-white/[0.065] border border-white/16 rounded-2xl p-5 shadow-[0_18px_55px_rgba(0,0,0,0.48)] backdrop-blur-[32px]";

export function CreditorDueView({ businessInfo, setBusinessInfo, triggerNotification, toUUID, activeUser, activeSection }: Props) {
  const section = activeSection === "creditor-entry" ? "entry" : activeSection === "creditors" ? "creditors" : "report";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [creditorId, setCreditorId] = useState("");
  const [due, setDue] = useState("");
  const [paid, setPaid] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [editingCreditorId, setEditingCreditorId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const ledger: Ledger = (businessInfo?.creditorLedger || { creditors: [], entries: [] }) as Ledger;
  const creditors = ledger.creditors || [];
  const entries = ledger.entries || [];
  const activeCreditors = creditors.filter(c => c.active !== false);
  const selectedEntries = entries.filter(e => e.creditorId === creditorId);
  const previousBalance = selectedEntries.reduce((sum, e) => sum + (Number(e.dueAmount) || 0) - (Number(e.paidAmount) || 0), 0);
  const dueValue = Number(due) || 0;
  const paidValue = Number(paid) || 0;
  const nextBalance = previousBalance + dueValue - paidValue;

  const updateLedger = (next: Ledger) => {
    setBusinessInfo((prev: any) => ({ ...prev, creditorLedger: next }));
  };

  const summaries = useMemo(() => creditors.map(c => {
    const rows = entries.filter(e => e.creditorId === c.id);
    const totalDue = rows.reduce((sum, e) => sum + (Number(e.dueAmount) || 0), 0);
    const totalPaid = rows.reduce((sum, e) => sum + (Number(e.paidAmount) || 0), 0);
    return { ...c, rows, totalDue, totalPaid, balance: totalDue - totalPaid };
  }), [creditors, entries]);
  const grandDue = summaries.reduce((sum, c) => sum + c.totalDue, 0);
  const grandPaid = summaries.reduce((sum, c) => sum + c.totalPaid, 0);



  return (
    <div className="space-y-5">


      {section === "entry" && <div className={`${panelClass} space-y-5`}>
        <div><h2 className="text-base font-bold text-white">Add Due & Paid</h2><p className="text-xs text-slate-400 mt-1">Record a new amount owed, a payment made, or both together.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1"><span className="text-xs text-slate-400">Creditor Name</span>
            <select value={creditorId} onChange={e => setCreditorId(e.target.value)} className={inputClass}>
              <option value="">Select creditor</option>{activeCreditors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>{activeCreditors.length === 0 && <span className="block text-[10px] text-amber-400">Add a creditor first from Creditor Management.</span>}
          </label>
          <label className="space-y-1"><span className="text-xs text-slate-400">Transaction Date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} /></label>
          <label className="space-y-1"><span className="text-xs text-slate-400">New Due Amount</span><input type="number" min="0" step="0.01" value={due} onChange={e => setDue(e.target.value)} placeholder="0.00" className={inputClass} /></label>
          <label className="space-y-1"><span className="text-xs text-slate-400">Paid Amount</span><input type="number" min="0" step="0.01" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0.00" className={inputClass} /></label>
          <label className="space-y-1"><span className="text-xs text-slate-400">Payment Method</span><select value={method} onChange={e => setMethod(e.target.value)} className={inputClass}><option>Cash</option><option>Bank</option><option>Mobile Banking</option><option>Other</option></select></label>
          <label className="space-y-1"><span className="text-xs text-slate-400">Note / Reference (Optional)</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="Transaction details..." className={inputClass} /></label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/16 bg-white/[0.065] p-4 shadow-inner backdrop-blur-2xl"><p className="text-[10px] uppercase tracking-wide text-slate-500">Previous Balance</p><p className="text-lg font-bold text-white mt-1">{businessInfo.currencySymbol} {previousBalance.toLocaleString()}</p></div>
          <div className="rounded-xl border border-white/16 bg-white/[0.065] p-4 shadow-inner backdrop-blur-2xl"><p className="text-[10px] uppercase tracking-wide text-slate-500">This Entry Balance</p><p className="text-lg font-bold text-white mt-1">{businessInfo.currencySymbol} {Math.max(0, dueValue - paidValue).toLocaleString()}</p></div>
          <div className="rounded-xl border border-white/16 bg-white/[0.065] p-4 shadow-inner backdrop-blur-2xl"><p className="text-[10px] uppercase tracking-wide text-white/75">New Total Balance</p><p className="text-lg font-bold text-white mt-1">{businessInfo.currencySymbol} {Math.max(0, nextBalance).toLocaleString()}</p></div>
        </div>
        <div className="flex justify-end"><button onClick={() => {
          if (!creditorId) { triggerNotification("Please select a creditor.", "error"); return; }
          if (dueValue <= 0 && paidValue <= 0) { triggerNotification("Enter a due amount or paid amount.", "error"); return; }
          if (paidValue > previousBalance + dueValue) { triggerNotification("Paid amount cannot exceed the existing balance plus this new due.", "error"); return; }
          const creditor = activeCreditors.find(c => c.id === creditorId);
          if (!creditor) return;
          const entry: CreditorEntry = { id: toUUID(`creditor_entry_${Date.now()}`, activeUser?.email || "creditor"), creditorId, creditorName: creditor.name, dueAmount: dueValue, paidAmount: paidValue, date: new Date(date + "T12:00:00").toISOString(), paymentMethod: method, note: note.trim(), paidBy: businessInfo?.name || "Business", receivedBy: paidValue > 0 ? creditor.name : "" };
          updateLedger({ creditors, entries: [entry, ...entries] });
          setDue(""); setPaid(""); setNote("");
          triggerNotification("Creditor transaction saved.", "success");
        }} className="px-5 py-3 rounded-xl border border-white/25 bg-white/[0.10] text-white text-xs font-bold shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-2xl hover:bg-white/[0.14] transition-all">Save Transaction</button></div>
      </div>}

      {section === "creditors" && <div className={`${panelClass} space-y-5`}>
        <div><h2 className="text-base font-bold text-white">Creditor Management</h2><p className="text-xs text-slate-400 mt-1">Add or remove the people and businesses you owe money to.</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Creditor name" className={inputClass} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" className={inputClass} />
          <button onClick={() => {
            const cleanName = name.trim();
            if (!cleanName) { triggerNotification("Enter a creditor name.", "error"); return; }
            if (activeCreditors.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) { triggerNotification("This creditor already exists.", "error"); return; }
            const newCreditor: Creditor = { id: toUUID(`creditor_${Date.now()}`, activeUser?.email || "creditor"), name: cleanName, phone: phone.trim(), active: true };
            updateLedger({ creditors: [...creditors, newCreditor], entries });
            setName(""); setPhone("");
            triggerNotification("Creditor added.", "success");
          }} className="px-5 py-3 rounded-xl border border-white/25 bg-white/[0.10] text-white text-xs font-bold shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-2xl hover:bg-white/[0.14] transition-all">Add Creditor</button>
        </div>
        <div className="divide-y divide-slate-800">
          {activeCreditors.map(c => {
            const balance = entries.filter(e => e.creditorId === c.id).reduce((sum, e) => sum + (Number(e.dueAmount)||0) - (Number(e.paidAmount)||0), 0);
            return <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {editingCreditorId === c.id ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Creditor name" className={inputClass} />
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone (optional)" className={inputClass} />
              </div> : <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">{c.name}</p><p className="text-[10px] text-white/55">{c.phone || "No phone added"} · Balance: {businessInfo.currencySymbol} {balance.toLocaleString()}</p></div>}
              <div className="flex items-center gap-2 shrink-0">
                {editingCreditorId === c.id ? <>
                  <button onClick={() => {
                    const cleanName = editName.trim();
                    if (!cleanName) { triggerNotification("Enter a creditor name.", "error"); return; }
                    if (activeCreditors.some(x => x.id !== c.id && x.name.toLowerCase() === cleanName.toLowerCase())) { triggerNotification("This creditor already exists.", "error"); return; }
                    updateLedger({ creditors: creditors.map(x => x.id === c.id ? { ...x, name: cleanName, phone: editPhone.trim() } : x), entries: entries.map(e => e.creditorId === c.id ? { ...e, creditorName: cleanName, receivedBy: e.paidAmount > 0 ? cleanName : e.receivedBy } : e) });
                    setEditingCreditorId(null);
                    triggerNotification("Creditor details updated.", "success");
                  }} className="px-3 py-2 rounded-lg border border-white/30 bg-white/[0.14] text-white text-[10px] font-bold flex items-center gap-1"><Check className="w-3 h-3" />Save</button>
                  <button onClick={() => setEditingCreditorId(null)} className="px-3 py-2 rounded-lg border border-white/15 bg-white/[0.05] text-white/70 text-[10px] font-bold"><X className="w-3 h-3" /></button>
                </> : <>
                  <button onClick={() => { setEditingCreditorId(c.id); setEditName(c.name); setEditPhone(c.phone || ""); }} className="px-3 py-2 rounded-lg border border-white/20 bg-white/[0.07] text-white hover:bg-white/[0.14] text-[10px] font-bold flex items-center gap-1"><Pencil className="w-3 h-3" />Edit</button>
                  <button onClick={() => {
                    const linkedEntries = entries.filter(entry => entry.creditorId === c.id);
                    const totalDue = linkedEntries.reduce((sum, entry) => sum + (Number(entry.dueAmount) || 0), 0);
                    const totalPaid = linkedEntries.reduce((sum, entry) => sum + (Number(entry.paidAmount) || 0), 0);
                    const confirmed = window.confirm(
                      `Archive ${c.name}? Their ${linkedEntries.length} transaction(s) will remain in the ledger for accounting history.\n\nTotal due: ${businessInfo.currencySymbol} ${totalDue.toLocaleString()}\nTotal paid: ${businessInfo.currencySymbol} ${totalPaid.toLocaleString()}\n\nArchived creditors are removed from new-entry selection but their balances and history are preserved.`
                    );
                    if (!confirmed) return;
                    updateLedger({
                      creditors: creditors.map(x => x.id === c.id ? { ...x, active: false } : x),
                      entries
                    });
                    if (creditorId === c.id) setCreditorId("");
                  }} className="px-3 py-2 rounded-lg border border-white/15 text-white/65 hover:text-white hover:border-white/35 text-[10px] font-bold flex items-center gap-1"><Trash2 className="w-3 h-3" />Remove</button>
                </>}
              </div>
            </div>;
          })}
          {activeCreditors.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No creditors added yet.</p>}
        </div>
      </div>}

      {section === "report" && <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[{ label: "Total Due Added", value: grandDue, color: "text-amber-400" }, { label: "Total Paid", value: grandPaid, color: "text-emerald-400" }, { label: "Outstanding Balance", value: grandDue - grandPaid, color: "text-rose-400" }].map(card => <div key={card.label} className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-4"><p className="text-[10px] text-slate-500 uppercase tracking-wide">{card.label}</p><p className={`text-xl font-bold mt-2 ${card.color}`}>{businessInfo.currencySymbol} {card.value.toLocaleString()}</p></div>)}
        </div>
        <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800"><h2 className="text-sm font-bold text-white">Creditor Summary</h2></div>
          <div className="overflow-x-auto"><table className="w-full text-xs text-left min-w-[620px]"><thead className="text-[10px] text-slate-500 uppercase bg-[#050912]"><tr><th className="p-3">Creditor</th><th className="p-3 text-right">Total Due</th><th className="p-3 text-right">Total Paid</th><th className="p-3 text-right">Remaining</th></tr></thead>
            <tbody className="divide-y divide-slate-800">{summaries.map(c => <tr key={c.id}><td className="p-3 text-white font-semibold">{c.name}</td><td className="p-3 text-right text-amber-400">{businessInfo.currencySymbol} {c.totalDue.toLocaleString()}</td><td className="p-3 text-right text-emerald-400">{businessInfo.currencySymbol} {c.totalPaid.toLocaleString()}</td><td className="p-3 text-right text-rose-400 font-bold">{businessInfo.currencySymbol} {c.balance.toLocaleString()}</td></tr>)}</tbody>
          </table></div>
        </div>
        <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800"><h2 className="text-sm font-bold text-white">Transaction History</h2></div>
          <div className="overflow-x-auto"><table className="w-full text-xs text-left min-w-[980px]"><thead className="text-[10px] text-slate-500 uppercase bg-[#050912]"><tr><th className="p-3">Date</th><th className="p-3">Creditor</th><th className="p-3 text-right">Due Added</th><th className="p-3 text-right">Paid</th><th className="p-3">Paid By</th><th className="p-3">Received By</th><th className="p-3">Payment Method</th><th className="p-3">Note</th></tr></thead>
            <tbody className="divide-y divide-slate-800">{entries.map(e => <tr key={e.id}><td className="p-3 whitespace-nowrap text-slate-400">{safeFormat(e.date, "dd MMM yyyy", "—")}</td><td className="p-3 text-white">{e.creditorName}</td><td className="p-3 text-right text-amber-400">{businessInfo.currencySymbol} {(e.dueAmount || 0).toLocaleString()}</td><td className="p-3 text-right text-white">{businessInfo.currencySymbol} {(e.paidAmount || 0).toLocaleString()}</td><td className="p-3 text-white">{e.paidAmount > 0 ? (e.paidBy || businessInfo?.name || "Business") : "—"}</td><td className="p-3 text-white">{e.paidAmount > 0 ? (e.receivedBy || e.creditorName) : "—"}</td><td className="p-3 text-white/75">{e.paymentMethod}</td><td className="p-3 text-white/55">{e.note || "—"}</td></tr>)}</tbody>
          </table></div>
          {entries.length === 0 && <p className="p-8 text-center text-xs text-slate-500">No creditor transactions recorded yet.</p>}
        </div>
      </div>}
    </div>
  );
}
