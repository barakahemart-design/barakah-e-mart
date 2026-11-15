import React, { useMemo, useState } from "react";
import { BarChart3, PlusCircle, Users, Package, Trash2 } from "lucide-react";
import { safeFormat } from "../lib/dateUtils";

type Creditor = { id: string; name: string; phone?: string; active?: boolean };
type CreditorEntry = {
  id: string; creditorId: string; creditorName: string; dueAmount: number;
  paidAmount: number; date: string; paymentMethod: string; note?: string;
};
type Ledger = { creditors: Creditor[]; entries: CreditorEntry[] };

type Props = {
  businessInfo: any;
  setBusinessInfo: React.Dispatch<React.SetStateAction<any>>;
  triggerNotification: (message: string, type: "success" | "error" | "info") => void;
  toUUID: (value: string, email?: string) => string;
  activeUser: any;
};

const inputClass = "w-full bg-[#050912] border border-slate-700 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-white";
const panelClass = "bg-[#0b0f19] border border-slate-800 rounded-2xl p-5";

export function CreditorDueView({ businessInfo, setBusinessInfo, triggerNotification, toUUID, activeUser }: Props) {
  const [section, setSection] = useState<"entry" | "creditors" | "report">("entry");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [creditorId, setCreditorId] = useState("");
  const [due, setDue] = useState("");
  const [paid, setPaid] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");

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

  const tabs = [
    { id: "entry" as const, title: "Add Due & Paid", detail: "Record a due or payment", Icon: PlusCircle },
    { id: "creditors" as const, title: "Creditor Management", detail: "Add or remove creditors", Icon: Users },
    { id: "report" as const, title: "Due Report", detail: "Balances and transactions", Icon: BarChart3 }
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tabs.map(tab => {
          const Icon = tab.Icon;
          const active = section === tab.id;
          return <button key={tab.id} onClick={() => setSection(tab.id)}
            className={`text-left p-4 rounded-2xl border transition-all ${active ? "bg-white text-black border-white shadow-lg" : "bg-[#0b0f19] text-slate-300 border-slate-800 hover:border-slate-600"}`}>
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold">{tab.title}</span><Icon className="w-4 h-4 shrink-0" /></div>
            <p className={`text-[10px] mt-1 ${active ? "text-slate-600" : "text-slate-500"}`}>{tab.detail}</p>
          </button>;
        })}
      </div>

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
          <div className="rounded-xl border border-slate-800 bg-[#050912] p-4"><p className="text-[10px] uppercase tracking-wide text-slate-500">Previous Balance</p><p className="text-lg font-bold text-amber-400 mt-1">{businessInfo.currencySymbol} {previousBalance.toLocaleString()}</p></div>
          <div className="rounded-xl border border-slate-800 bg-[#050912] p-4"><p className="text-[10px] uppercase tracking-wide text-slate-500">This Entry Balance</p><p className="text-lg font-bold text-rose-400 mt-1">{businessInfo.currencySymbol} {Math.max(0, dueValue - paidValue).toLocaleString()}</p></div>
          <div className="rounded-xl border border-slate-700 bg-white p-4"><p className="text-[10px] uppercase tracking-wide text-slate-600">New Total Balance</p><p className="text-lg font-bold text-black mt-1">{businessInfo.currencySymbol} {Math.max(0, nextBalance).toLocaleString()}</p></div>
        </div>
        <div className="flex justify-end"><button onClick={() => {
          if (!creditorId) { triggerNotification("Please select a creditor.", "error"); return; }
          if (dueValue <= 0 && paidValue <= 0) { triggerNotification("Enter a due amount or paid amount.", "error"); return; }
          if (paidValue > previousBalance + dueValue) { triggerNotification("Paid amount cannot exceed the existing balance plus this new due.", "error"); return; }
          const creditor = activeCreditors.find(c => c.id === creditorId);
          if (!creditor) return;
          const entry: CreditorEntry = { id: toUUID(`creditor_entry_${Date.now()}`, activeUser?.email || "creditor"), creditorId, creditorName: creditor.name, dueAmount: dueValue, paidAmount: paidValue, date: new Date(date + "T12:00:00").toISOString(), paymentMethod: method, note: note.trim() };
          updateLedger({ creditors, entries: [entry, ...entries] });
          setDue(""); setPaid(""); setNote("");
          triggerNotification("Creditor transaction saved.", "success");
        }} className="px-5 py-3 rounded-xl bg-white text-black text-xs font-bold hover:bg-slate-200">Save Transaction</button></div>
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
          }} className="px-5 py-3 rounded-xl bg-white text-black text-xs font-bold">Add Creditor</button>
        </div>
        <div className="divide-y divide-slate-800">
          {activeCreditors.map(c => {
            const balance = entries.filter(e => e.creditorId === c.id).reduce((sum, e) => sum + (Number(e.dueAmount)||0) - (Number(e.paidAmount)||0), 0);
            return <div key={c.id} className="py-3 flex items-center justify-between gap-3">
              <div><p className="text-sm font-semibold text-white">{c.name}</p><p className="text-[10px] text-slate-500">{c.phone || "No phone added"} · Balance: {businessInfo.currencySymbol} {balance.toLocaleString()}</p></div>
              <button onClick={() => {
                if (!window.confirm(`Remove ${c.name} from the active creditor list? Existing transactions will remain in reports.`)) return;
                updateLedger({ creditors: creditors.map(x => x.id === c.id ? { ...x, active: false } : x), entries });
                if (creditorId === c.id) setCreditorId("");
              }} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 text-[10px] font-bold flex items-center gap-1"><Trash2 className="w-3 h-3" />Remove</button>
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
          <div className="overflow-x-auto"><table className="w-full text-xs text-left min-w-[760px]"><thead className="text-[10px] text-slate-500 uppercase bg-[#050912]"><tr><th className="p-3">Date</th><th className="p-3">Creditor</th><th className="p-3 text-right">Due Added</th><th className="p-3 text-right">Paid</th><th className="p-3">Payment Method</th><th className="p-3">Note</th></tr></thead>
            <tbody className="divide-y divide-slate-800">{entries.map(e => <tr key={e.id}><td className="p-3 whitespace-nowrap text-slate-400">{safeFormat(e.date, "dd MMM yyyy", "—")}</td><td className="p-3 text-white">{e.creditorName}</td><td className="p-3 text-right text-amber-400">{businessInfo.currencySymbol} {(e.dueAmount || 0).toLocaleString()}</td><td className="p-3 text-right text-emerald-400">{businessInfo.currencySymbol} {(e.paidAmount || 0).toLocaleString()}</td><td className="p-3">{e.paymentMethod}</td><td className="p-3 text-slate-400">{e.note || "—"}</td></tr>)}</tbody>
          </table></div>
          {entries.length === 0 && <p className="p-8 text-center text-xs text-slate-500">No creditor transactions recorded yet.</p>}
        </div>
      </div>}
    </div>
  );
}
