import React, { useCallback, useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { Truck, MapPin, Phone, PackageCheck, Wallet, RefreshCw, LogOut, CheckCircle2, AlertTriangle } from "lucide-react";

type Assignment = {
  id: string; invoice_no: string; customer_name: string; customer_phone: string;
  customer_address: string; delivery_status: string; items?: Array<{name: string; quantity: number}>;
};
type Expense = { id: string; amount: number; reason: string; category: string; date: string; payment_status: string };
type DriverProfile = { uid: string; name: string; email: string; phone?: string };

interface Props {
  staff: DriverProfile;
  currencySymbol?: string;
  onLogout: () => void;
}

export function DeliveryDriverView({ staff, currencySymbol = "৳", onLogout }: Props) {
  const [tab, setTab] = useState<"deliveries" | "expenses">("deliveries");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("Transport");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignmentId, setAssignmentId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const request = useCallback(async (path: string, body?: any) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Your login session has expired. Please log in again.");
    const token = await user.getIdToken();
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Delivery request failed.");
    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, e] = await Promise.all([
        request("/api/delivery/assignments"),
        request("/api/delivery/expenses/mine")
      ]);
      setAssignments(a.assignments || []);
      setExpenses(e.expenses || []);
    } catch (error: any) {
      console.error("[Delivery driver] Data load failed:", error);
    } finally { setLoading(false); }
  }, [request]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (item: Assignment, status: "delivered" | "failed" | "returned") => {
    try {
      await request("/api/delivery/assignments/update-mine", {
        assignment_id: item.id, delivery_status: status, delivery_note: notes[item.id] || ""
      });
      setAssignments(prev => prev.map(x => x.id === item.id ? { ...x, delivery_status: status } : x));
    } catch (error: any) { alert(error?.message || "Could not update delivery status."); }
  };

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await request("/api/delivery/expenses", {
        amount: Number(amount), reason, category, date, assignment_id: assignmentId || ""
      });
      setAmount(""); setReason(""); setAssignmentId("");
      await load();
      setTab("expenses");
    } catch (error: any) { alert(error?.message || "Could not submit expense."); }
  };

  return (
    <div className="min-h-screen bg-[#080d18] p-3 text-white sm:p-6" id="delivery-driver-panel">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div><p className="flex items-center gap-2 text-lg font-black"><Truck className="h-5 w-5 text-emerald-400" /> Delivery Panel</p><p className="mt-1 text-xs text-slate-400">{staff.name} · {staff.email}</p></div>
          <button onClick={onLogout} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300"><LogOut className="mr-1 inline h-3.5 w-3.5" /> Logout</button>
        </header>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1.5">
          <button onClick={() => setTab("deliveries")} className={`rounded-xl px-3 py-3 text-xs font-black ${tab === "deliveries" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>My Deliveries ({assignments.length})</button>
          <button onClick={() => setTab("expenses")} className={`rounded-xl px-3 py-3 text-xs font-black ${tab === "expenses" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>My Expenses ({expenses.length})</button>
        </div>

        <div className="flex justify-end"><button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300"><RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh</button></div>

        {tab === "deliveries" && <div className="space-y-3">
          {assignments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">No deliveries assigned to you right now.</div> : assignments.map(item => <article key={item.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-black">Invoice {item.invoice_no}</h3><span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-black capitalize text-amber-300">{item.delivery_status}</span></div>
            <div className="space-y-1 text-xs text-slate-300"><p className="font-bold">{item.customer_name}</p>{item.customer_phone && <a className="inline-flex items-center gap-1 text-sky-300" href={`tel:${item.customer_phone}`}><Phone className="h-3 w-3" /> {item.customer_phone}</a>}<p className="flex items-start gap-1 text-slate-400"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{item.customer_address || "Customer address not available"}</p></div>
            {item.items?.length ? <div className="rounded-xl bg-slate-950/70 p-3 text-[11px] text-slate-300">{item.items.map((x,i) => <p key={i}>{x.name} × {x.quantity}</p>)}</div> : null}
            {item.delivery_status !== "delivered" && <div className="space-y-2"><input value={notes[item.id] || ""} onChange={e => setNotes(prev => ({...prev,[item.id]:e.target.value}))} placeholder="Delivery note (optional)" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white" /><div className="grid grid-cols-3 gap-2"><button onClick={() => updateStatus(item,"delivered")} className="rounded-lg bg-emerald-500/15 px-2 py-2.5 text-[10px] font-black text-emerald-300">Delivered</button><button onClick={() => updateStatus(item,"failed")} className="rounded-lg bg-rose-500/15 px-2 py-2.5 text-[10px] font-black text-rose-300">Failed</button><button onClick={() => updateStatus(item,"returned")} className="rounded-lg bg-amber-500/15 px-2 py-2.5 text-[10px] font-black text-amber-300">Returned</button></div></div>}
          </article>)}
        </div>}

        {tab === "expenses" && <div className="space-y-4">
          <form onSubmit={submitExpense} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <h3 className="flex items-center gap-2 text-sm font-black"><Wallet className="h-4 w-4 text-emerald-400" /> Submit Delivery Expense</h3>
            <input required type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Amount (${currencySymbol})`} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" />
            <input required value={reason} onChange={e => setReason(e.target.value)} placeholder="Expense reason" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" />
            <div className="grid grid-cols-2 gap-2"><select value={category} onChange={e => setCategory(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-white"><option>Transport</option><option>Loading</option><option>Parking</option><option>Food</option><option>Other</option></select><input required type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-white" /></div>
            <select value={assignmentId} onChange={e => setAssignmentId(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-white"><option value="">General delivery expense (no invoice)</option>{assignments.map(x => <option key={x.id} value={x.id}>Invoice {x.invoice_no}</option>)}</select>
            <button className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black text-slate-950">Submit Expense</button>
          </form>
          <div className="space-y-2">{expenses.map(x => <div key={x.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3"><div><p className="text-sm font-bold">{currencySymbol}{Number(x.amount).toLocaleString("en-BD")} · {x.reason}</p><p className="text-[10px] text-slate-400">{x.category} · {x.date}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${x.payment_status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{x.payment_status}</span></div>)}</div>
        </div>}
      </div>
    </div>
  );
}
