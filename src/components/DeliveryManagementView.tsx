import React, { useCallback, useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { Truck, UserPlus, RefreshCw, ClipboardList, Wallet, CheckCircle2, AlertCircle, UserRound, MapPin } from "lucide-react";

type Driver = { uid: string; name: string; email: string; phone?: string; status: "active" | "inactive" };
type Assignment = {
  id: string; invoice_no: string; driver_uid: string; driver_name: string;
  customer_name: string; customer_phone: string; customer_address: string;
  delivery_status: string; assigned_at: string;
  items?: Array<{ name: string; quantity: number }>;
};
type DeliveryExpense = {
  id: string; driver_name: string; amount: number; reason: string; category: string;
  date: string; payment_status: "paid" | "unpaid"; assignment_id?: string;
};

interface Props {
  adminPin: string;
  storeId: string;
  currencySymbol?: string;
  triggerNotification: (message: string, type?: "success" | "error" | "info") => void;
}

export function DeliveryManagementView({ adminPin, storeId, currencySymbol = "৳", triggerNotification }: Props) {
  const [tab, setTab] = useState<"staff" | "assignments" | "expenses">("staff");
  const [staff, setStaff] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [expenses, setExpenses] = useState<DeliveryExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [driverUid, setDriverUid] = useState("");
  const [expenseFilter, setExpenseFilter] = useState<"all" | "paid" | "unpaid">("all");
  const notifyRef = React.useRef(triggerNotification);
  notifyRef.current = triggerNotification;

  const request = useCallback(async (path: string, body?: any) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Your secure login session has expired. Please log in again.");
    const token = await user.getIdToken();
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify({ store_id: storeId, admin_pin: adminPin, ...body }) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Delivery request failed.");
    return data;
  }, [adminPin, storeId]);

  const loadAll = useCallback(async () => {
    if (!adminPin || !storeId) return;
    setLoading(true);
    try {
      const [staffData, assignmentData, expenseData] = await Promise.all([
        request("/api/delivery/staff/list", {}),
        request("/api/delivery/assignments/admin-list", {}),
        request("/api/delivery/expenses/admin-list", { payment_status: expenseFilter === "all" ? "" : expenseFilter })
      ]);
      setStaff(staffData.staff || []);
      setAssignments(assignmentData.assignments || []);
      setExpenses(expenseData.expenses || []);
      setDriverUid(prev => prev || staffData.staff?.find((x: Driver) => x.status === "active")?.uid || "");
    } catch (error: any) {
      notifyRef.current(error?.message || "Could not load delivery management data.", "error");
    } finally {
      setLoading(false);
    }
  }, [adminPin, storeId, request, expenseFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await request("/api/delivery/staff/create", {
        name, email, phone, temporary_password: password
      });
      setStaff(prev => [result.staff, ...prev]);
      setName(""); setEmail(""); setPhone(""); setPassword("");
      notifyRef.current("Delivery staff account created successfully.", "success");
    } catch (error: any) {
      notifyRef.current(error?.message || "Could not create delivery staff.", "error");
    }
  };

  const assignInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await request("/api/delivery/assignments/create", { invoice_no: invoiceNo, driver_uid: driverUid });
      setAssignments(prev => [result.assignment, ...prev.filter(x => x.id !== result.assignment.id)]);
      setInvoiceNo("");
      notifyRef.current("Invoice assigned to delivery staff.", "success");
    } catch (error: any) {
      notifyRef.current(error?.message || "Could not assign invoice.", "error");
    }
  };

  const toggleStaff = async (person: Driver) => {
    try {
      await request("/api/delivery/staff/status", { staff_uid: person.uid, status: person.status === "active" ? "inactive" : "active" });
      setStaff(prev => prev.map(x => x.uid === person.uid ? { ...x, status: x.status === "active" ? "inactive" : "active" } : x));
      notifyRef.current("Delivery staff status updated.", "success");
    } catch (error: any) { notifyRef.current(error?.message || "Could not update staff status.", "error"); }
  };

  const updateExpense = async (expense: DeliveryExpense) => {
    const next = expense.payment_status === "paid" ? "unpaid" : "paid";
    try {
      await request("/api/delivery/expenses/payment-status", { expense_id: expense.id, payment_status: next });
      setExpenses(prev => prev.map(x => x.id === expense.id ? { ...x, payment_status: next } : x));
      notifyRef.current(next === "paid" ? "Expense marked as Paid." : "Expense marked as Unpaid.", "success");
    } catch (error: any) { notifyRef.current(error?.message || "Could not update expense status.", "error"); }
  };

  const activeDrivers = staff.filter(x => x.status === "active");
  const tabs = [
    { id: "staff" as const, label: "Delivery Staff", icon: UserRound },
    { id: "assignments" as const, label: "Invoice Assignments", icon: ClipboardList },
    { id: "expenses" as const, label: "Delivery Expenses", icon: Wallet }
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-fadeIn" id="delivery-management-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-white"><Truck className="h-5 w-5 text-emerald-400" /> Delivery Management</h2>
          <p className="mt-1 text-xs text-slate-400">Manage delivery accounts, invoice assignments and driver expenses.</p>
        </div>
        <button onClick={loadAll} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-1.5">
        {tabs.map(item => {
          const Icon = item.icon;
          return <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-[11px] font-bold transition-all ${tab === item.id ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : "text-slate-400 hover:bg-white/5"}`}><Icon className="h-4 w-4" /><span>{item.label}</span></button>;
        })}
      </div>

      {tab === "staff" && <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.85fr)_1.15fr]">
        <form onSubmit={createStaff} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><UserPlus className="h-4 w-4 text-emerald-400" /> Create Delivery Account</h3>
          <input required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder="Staff full name" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Login email address" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number (optional)" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          <input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Temporary password (min. 8 characters)" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          <p className="text-[10px] leading-relaxed text-slate-500">Share the login email and temporary password privately with the driver. The password is not stored in the delivery profile.</p>
          <button disabled={loading} className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50">Create Delivery Staff</button>
        </form>
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-sm font-black text-white">Delivery Staff Accounts <span className="ml-1 text-emerald-300">({staff.length})</span></h3>
          {staff.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No delivery staff accounts yet.</p> : staff.map(person => <div key={person.uid} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{person.name}</p><p className="truncate text-[11px] text-slate-400">{person.email} {person.phone ? "· " + person.phone : ""}</p></div>
            <button onClick={() => toggleStaff(person)} className={`rounded-lg px-3 py-2 text-[10px] font-black ${person.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{person.status === "active" ? "Active · Disable" : "Inactive · Enable"}</button>
          </div>)}
        </div>
      </div>}

      {tab === "assignments" && <div className="space-y-4">
        <form onSubmit={assignInvoice} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="space-y-1.5 text-[11px] font-bold text-slate-300">Invoice Number<input required value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="Enter invoice number" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" /></label>
          <label className="space-y-1.5 text-[11px] font-bold text-slate-300">Assign to Driver<select required value={driverUid} onChange={e => setDriverUid(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500"><option value="">Select delivery staff</option>{activeDrivers.map(x => <option key={x.uid} value={x.uid}>{x.name} · {x.email}</option>)}</select></label>
          <button disabled={!activeDrivers.length} className="rounded-xl bg-emerald-500 px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-40">Assign Invoice</button>
        </form>
        <div className="space-y-2">{assignments.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No invoice assignments yet.</p> : assignments.map(a => <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-white">Invoice {a.invoice_no}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${a.delivery_status === "delivered" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{a.delivery_status}</span></div>
          <p className="mt-1 text-xs text-slate-300">{a.customer_name} · {a.driver_name}</p>
          <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{a.customer_address || "No customer address saved"}</p>
        </div>)}</div>
      </div>}

      {tab === "expenses" && <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black text-white">Driver Expense Requests</h3><select value={expenseFilter} onChange={e => setExpenseFilter(e.target.value as any)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"><option value="all">All expenses</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></div>
        {expenses.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No delivery expenses submitted.</p> : expenses.map(expense => <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div><p className="text-sm font-black text-white">{currencySymbol}{Number(expense.amount || 0).toLocaleString("en-BD")} · {expense.reason}</p><p className="mt-1 text-[11px] text-slate-400">{expense.driver_name} · {expense.category} · {expense.date}</p></div>
          <button onClick={() => updateExpense(expense)} className={`rounded-lg px-3 py-2 text-[10px] font-black ${expense.payment_status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{expense.payment_status === "paid" ? "Paid · Mark Unpaid" : "Unpaid · Mark Paid"}</button>
        </div>)}
      </div>}

      <div className="flex items-center gap-2 rounded-xl border border-sky-500/15 bg-sky-500/5 p-3 text-[10px] leading-relaxed text-sky-200/80"><AlertCircle className="h-4 w-4 shrink-0" /> Driver records and expense approvals are handled by the secure server API. Delivery accounts do not receive access to Admin, Sales, Ledger or inventory collections.</div>
    </div>
  );
}
