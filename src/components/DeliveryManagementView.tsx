import React, { useCallback, useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { Truck, UserPlus, RefreshCw, ClipboardList, Wallet, CheckCircle2, AlertCircle, UserRound, MapPin, Trash2, PauseCircle, PlayCircle } from "lucide-react";

type Driver = { uid: string; name: string; email: string; phone?: string; status: "active" | "inactive" };
type Assignment = {
  id: string; invoice_no: string; driver_uid: string; driver_name: string;
  customer_name: string; customer_phone: string; customer_address: string;
  customer_note?: string; delivery_note?: string;
  delivery_status: string; assigned_at: string;
  delivery_fee?: number; payment_status?: "paid" | "unpaid"; payment_timing?: "advance" | "after_delivery"; payment_updated_at?: string; payment_received_at?: string;
  items?: Array<{ name: string; quantity: number }>;
};
type DeliveryExpense = {
  id: string; driver_name: string; amount: number; reason: string; category: string;
  date: string; payment_status: "paid" | "unpaid"; assignment_id?: string;
};

interface Props {
  adminPin: string;
  salesPin?: string;
  panelRole?: "admin" | "sales";
  storeId: string;
  currencySymbol?: string;
  triggerNotification: (message: string, type?: "success" | "error" | "info") => void;
}

export function DeliveryManagementView({ adminPin, salesPin = "", panelRole = "admin", storeId, currencySymbol = "৳", triggerNotification }: Props) {
  const [tab, setTab] = useState<"staff" | "assignments" | "expenses" | "payments">("staff");
  const [staff, setStaff] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [queueItems, setQueueItems] = useState<Array<{id:string; invoice_no:string; customer_name:string; customer_phone:string; customer_address:string; items?:Array<{name:string;quantity:number}>; total_amount?:number; queued_at:string}>>([]);
  const [expenses, setExpenses] = useState<DeliveryExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [driverUid, setDriverUid] = useState("");
  const [expenseFilter, setExpenseFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, { fee: string; status: "paid" | "unpaid"; timing: "advance" | "after_delivery" }>>({});
  type DateRangeFilter = "all" | "today" | "yesterday" | "weekly" | "monthly" | "yearly" | "custom";
  const [expenseDateFilter, setExpenseDateFilter] = useState<DateRangeFilter>("monthly");
  const [paymentDateFilter, setPaymentDateFilter] = useState<DateRangeFilter>("monthly");
  const [expenseCustomStart, setExpenseCustomStart] = useState(new Date().toISOString().slice(0, 10));
  const [expenseCustomEnd, setExpenseCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const [paymentCustomStart, setPaymentCustomStart] = useState(new Date().toISOString().slice(0, 10));
  const [paymentCustomEnd, setPaymentCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const notifyRef = React.useRef(triggerNotification);
  notifyRef.current = triggerNotification;

  const request = useCallback(async (path: string, body?: any) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Your secure login session has expired. Please log in again.");
    const token = await user.getIdToken();
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify({ store_id: storeId, panel_role: panelRole, ...(panelRole === "admin" ? { admin_pin: adminPin } : { sales_pin: salesPin }), ...body }) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Delivery request failed.");
    return data;
  }, [adminPin, salesPin, panelRole, storeId]);

  const loadAll = useCallback(async () => {
    if ((panelRole === "admin" && !adminPin) || (panelRole === "sales" && !salesPin) || !storeId) return;
    setLoading(true);
    try {
      const [staffData, assignmentData, queueData, expenseData] = await Promise.all([
        request("/api/delivery/staff/list", {}),
        request("/api/delivery/assignments/admin-list", {}),
        request("/api/delivery/queue/list", {}),
        panelRole === "admin" ? request("/api/delivery/expenses/admin-list", { payment_status: expenseFilter === "all" ? "" : expenseFilter }) : Promise.resolve({ expenses: [] })
      ]);
      setStaff(staffData.staff || []);
      setAssignments(assignmentData.assignments || []);
      setQueueItems(queueData.queue || []);
      setExpenses(expenseData.expenses || []);
      setDriverUid(prev => prev || staffData.staff?.find((x: Driver) => x.status === "active")?.uid || "");
    } catch (error: any) {
      notifyRef.current(error?.message || "Could not load delivery management data.", "error");
    } finally {
      setLoading(false);
    }
  }, [adminPin, salesPin, storeId, request, expenseFilter, panelRole]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await request("/api/delivery/staff/create", {
        name, email, phone, temporary_password: password
      });
      setStaff(prev => [result.staff, ...prev]);
      setCreatedCredentials({ email: result.staff.email, password });
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
    const nextStatus = person.status === "active" ? "inactive" : "active";
    try {
      await request("/api/delivery/staff/status", { staff_uid: person.uid, status: nextStatus });
      setStaff(prev => prev.map(x => x.uid === person.uid ? { ...x, status: nextStatus } : x));
      notifyRef.current(nextStatus === "inactive" ? "Delivery account put on hold." : "Delivery account reactivated.", "success");
    } catch (error: any) { notifyRef.current(error?.message || "Could not update staff status.", "error"); }
  };

  const deleteStaff = async (person: Driver) => {
    const confirmed = window.confirm(`Permanently delete ${person.name} ( ${person.email} )? Their Firebase login, delivery assignments and expense records will be deleted. This cannot be undone.`);
    if (!confirmed) return;
    try {
      await request("/api/delivery/staff/delete", { staff_uid: person.uid });
      setStaff(prev => prev.filter(x => x.uid !== person.uid));
      setAssignments(prev => prev.filter(x => x.driver_uid !== person.uid));
      if (driverUid === person.uid) setDriverUid(staff.find(x => x.uid !== person.uid && x.status === "active")?.uid || "");
      notifyRef.current("Delivery staff account and its linked records were deleted.", "success");
    } catch (error: any) { notifyRef.current(error?.message || "Could not delete delivery staff account.", "error"); }
  };

  const updateExpense = async (expense: DeliveryExpense) => {
    const next = expense.payment_status === "paid" ? "unpaid" : "paid";
    try {
      await request("/api/delivery/expenses/payment-status", { expense_id: expense.id, payment_status: next });
      setExpenses(prev => prev.map(x => x.id === expense.id ? { ...x, payment_status: next } : x));
      notifyRef.current(next === "paid" ? "Expense marked as Paid." : "Expense marked as Unpaid.", "success");
    } catch (error: any) { notifyRef.current(error?.message || "Could not update expense status.", "error"); }
  };

  const getPaymentDraft = (assignment: Assignment) => paymentDrafts[assignment.id] || {
    fee: String(assignment.delivery_fee || 0),
    status: assignment.payment_status === "paid" ? "paid" as const : "unpaid" as const,
    timing: assignment.payment_timing === "advance" ? "advance" as const : "after_delivery" as const
  };

  const updateAssignmentPayment = async (assignment: Assignment) => {
    if (panelRole !== "admin") return;
    const draft = getPaymentDraft(assignment);
    const fee = Number(draft.fee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 1000000) { notifyRef.current("Enter a valid payment amount.", "error"); return; }
    try {
      await request("/api/delivery/assignments/payment", {
        assignment_id: assignment.id, delivery_fee: fee,
        payment_status: draft.status, payment_timing: draft.timing
      });
      await loadAll();
      setPaymentDrafts(prev => { const next = { ...prev }; delete next[assignment.id]; return next; });
      notifyRef.current("Delivery payment updated.", "success");
    } catch (error: any) { notifyRef.current(error?.message || "Could not update delivery payment.", "error"); }
  };

  const isDateInRange = (value: any, filter: DateRangeFilter, customStart: string, customEnd: string) => {
    if (filter === "all") return true;
    if (!value) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (filter === "today") return target.getTime() === today.getTime();
    if (filter === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return target.getTime() === yesterday.getTime();
    }
    if (filter === "weekly") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return target >= start && target <= today;
    }
    if (filter === "monthly") return target.getMonth() === today.getMonth() && target.getFullYear() === today.getFullYear();
    if (filter === "yearly") return target.getFullYear() === today.getFullYear();
    if (filter === "custom") {
      if (!customStart || !customEnd || customStart > customEnd) return false;
      const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
      return key >= customStart && key <= customEnd;
    }
    return false;
  };

  const renderDateRangeFilter = (
    id: string,
    filter: DateRangeFilter,
    setFilter: (value: DateRangeFilter) => void,
    customStart: string,
    setCustomStart: (value: string) => void,
    customEnd: string,
    setCustomEnd: (value: string) => void
  ) => (
    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3" id={id}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date Range</div>
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: "all", label: "All" },
          { id: "today", label: "Today" },
          { id: "yesterday", label: "Yesterday" },
          { id: "weekly", label: "7 Days" },
          { id: "monthly", label: "This Month" },
          { id: "yearly", label: "This Year" },
          { id: "custom", label: "Custom" }
        ].map(preset => (
          <button key={preset.id} type="button" onClick={() => setFilter(preset.id as DateRangeFilter)}
            className={`rounded-lg border px-3 py-2 text-[10px] font-bold transition-all ${filter === preset.id ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-white"}`}>
            {preset.label}
          </button>
        ))}
      </div>
      {filter === "custom" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[10px] font-bold text-slate-400">From Date<input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white" /></label>
          <label className="text-[10px] font-bold text-slate-400">To Date<input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white" /></label>
          {customStart && customEnd && customStart > customEnd && <p className="text-[10px] text-rose-300 sm:col-span-2">From Date cannot be later than To Date.</p>}
        </div>
      )}
    </div>
  );

  const filteredStaffExpenses = expenses.filter(expense =>
    (expenseFilter === "all" || expense.payment_status === expenseFilter) &&
    isDateInRange(expense.date, expenseDateFilter, expenseCustomStart, expenseCustomEnd)
  );
  const filteredDeliveryPayments = assignments.filter(assignment =>
    isDateInRange(
      assignment.payment_received_at || assignment.payment_updated_at || assignment.assigned_at,
      paymentDateFilter,
      paymentCustomStart,
      paymentCustomEnd
    )
  );

  const activeDrivers = staff.filter(x => x.status === "active");
  const tabs = [
    { id: "staff" as const, label: "Delivery Staff", icon: UserRound },
    { id: "assignments" as const, label: "Invoice Assignments", icon: ClipboardList },
    ...(panelRole === "admin" ? [
      { id: "expenses" as const, label: "Staff Expenses", icon: Wallet },
      { id: "payments" as const, label: "Delivery Payments", icon: Wallet }
    ] : [])
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

      <div className={`grid ${panelRole === "admin" ? "grid-cols-4" : "grid-cols-2"} gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-1.5`}>
        {tabs.map(item => {
          const Icon = item.icon;
          return <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-[11px] font-bold transition-all ${tab === item.id ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : "text-slate-400 hover:bg-white/5"}`}><Icon className="h-4 w-4" /><span>{item.label}</span></button>;
        })}
      </div>

      {tab === "staff" && <div className={`grid gap-4 ${panelRole === "admin" ? "lg:grid-cols-[minmax(280px,0.85fr)_1.15fr]" : "grid-cols-1"}`}>
        {panelRole === "admin" && <form onSubmit={createStaff} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><UserPlus className="h-4 w-4 text-emerald-400" /> Create Delivery Account</h3>
          <input required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder="Staff full name" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Login email address" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number (optional)" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          <input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Temporary password (min. 8 characters)" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          <p className="text-[10px] leading-relaxed text-slate-500">Share the login email and temporary password privately with the driver. The password is not stored in the delivery profile.</p>
          {createdCredentials && <div className="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
            <p className="text-[11px] font-black text-emerald-300">New account credentials — share privately</p>
            <p className="break-all text-[11px] text-slate-200">Email: {createdCredentials.email}</p>
            <p className="break-all text-[11px] text-slate-200">Temporary password: {createdCredentials.password}</p>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(`Email: ${createdCredentials.email}\\nTemporary password: ${createdCredentials.password}`); }} className="rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-black text-slate-950">Copy Login Details</button>
            <button type="button" onClick={() => setCreatedCredentials(null)} className="ml-2 text-[10px] font-bold text-slate-400">Hide</button>
          </div>}
          <button disabled={loading} className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50">Create Delivery Staff</button>
        </form>}
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-sm font-black text-white">Delivery Staff Accounts <span className="ml-1 text-emerald-300">({staff.length})</span></h3>
          {staff.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No delivery staff accounts yet.</p> : staff.map(person => <div key={person.uid} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{person.name}</p><p className="truncate text-[11px] text-slate-400">{person.email} {person.phone ? "· " + person.phone : ""}</p><span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[9px] font-black ${person.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{person.status === "active" ? "ACTIVE" : "ON HOLD"}</span></div>
            {panelRole === "admin" && <div className="flex flex-wrap gap-2"><button onClick={() => toggleStaff(person)} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-black ${person.status === "active" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>{person.status === "active" ? <><PauseCircle className="h-3 w-3" /> Hold</> : <><PlayCircle className="h-3 w-3" /> Unhold</>}</button><button onClick={() => deleteStaff(person)} className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-2 text-[10px] font-black text-rose-300"><Trash2 className="h-3 w-3" /> Delete</button></div>}
          </div>)}
        </div>
      </div>}

      {tab === "payments" && panelRole === "admin" && <div className="space-y-3">
        <h3 className="text-sm font-black text-white">Delivery Staff Payments</h3>
        {renderDateRangeFilter("delivery-payment-date-range", paymentDateFilter, setPaymentDateFilter, paymentCustomStart, setPaymentCustomStart, paymentCustomEnd, setPaymentCustomEnd)}
        {filteredDeliveryPayments.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No delivery payments found for this date range.</p> : filteredDeliveryPayments.map(a => {
          const draft = getPaymentDraft(a);
          return <div key={a.id} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-black text-white">Invoice {a.invoice_no} · {a.customer_name}</p><p className="mt-1 text-[10px] text-slate-500">{a.driver_name} · Assigned {a.assigned_at ? new Date(a.assigned_at).toLocaleString("en-BD") : "—"}</p>{a.payment_updated_at && <p className="text-[10px] text-slate-500">Last updated {new Date(a.payment_updated_at).toLocaleString("en-BD")}</p>}{a.customer_note && <p className="mt-1 text-[10px] text-slate-400">Customer Note: {a.customer_note}</p>}{a.delivery_note && <p className="mt-1 text-[10px] text-slate-400">Delivery Note: {a.delivery_note}</p>}</div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${a.payment_status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{a.payment_status === "paid" ? "Paid" : "Unpaid"}</span></div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-[10px] font-bold text-slate-400">Delivery payment ({currencySymbol})<input type="number" min="0" step="0.01" value={draft.fee} onChange={e => setPaymentDrafts(prev => ({ ...prev, [a.id]: { ...draft, fee: e.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white" /></label>
              <label className="text-[10px] font-bold text-slate-400">Payment status<select value={draft.status} onChange={e => setPaymentDrafts(prev => ({ ...prev, [a.id]: { ...draft, status: e.target.value as "paid" | "unpaid" } }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"><option value="unpaid">Unpaid · Due</option><option value="paid">Paid · Received</option></select></label>
              <label className="text-[10px] font-bold text-slate-400">When paid?<select value={draft.timing} onChange={e => setPaymentDrafts(prev => ({ ...prev, [a.id]: { ...draft, timing: e.target.value as "advance" | "after_delivery" } }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"><option value="advance">Advance payment</option><option value="after_delivery">After delivery</option></select></label>
            </div>
            <button onClick={() => updateAssignmentPayment(a)} className="rounded-lg bg-emerald-500 px-4 py-2.5 text-[10px] font-black text-slate-950">Save Payment Details</button>
          </div>;
        })}
      </div>}

      {tab === "assignments" && <div className="space-y-4">
        <form onSubmit={assignInvoice} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="space-y-1.5 text-[11px] font-bold text-slate-300">Invoice Number<input required value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="Enter invoice number" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" /></label>
          <label className="space-y-1.5 text-[11px] font-bold text-slate-300">Assign to Driver<select required value={driverUid} onChange={e => setDriverUid(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500"><option value="">Select delivery staff</option>{activeDrivers.map(x => <option key={x.uid} value={x.uid}>{x.name} · {x.email}</option>)}</select></label>
          <button disabled={!activeDrivers.length} className="rounded-xl bg-emerald-500 px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-40">Assign Invoice</button>
        </form>
        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-sm font-black text-white">New Sales Delivery Queue <span className="text-emerald-300">({queueItems.length})</span></h3>
          {queueItems.length === 0 ? <p className="text-xs text-slate-500">No new sales waiting for delivery assignment.</p> : queueItems.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <div><p className="text-xs font-black text-white">Invoice {item.invoice_no} · {item.customer_name}</p><p className="text-[10px] text-slate-400">{item.customer_phone} · {item.customer_address}</p><p className="text-[10px] text-slate-500">{item.items?.map(x => `${x.name} × ${x.quantity}`).join(", ")}</p></div>
            <button type="button" onClick={() => setInvoiceNo(item.invoice_no)} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[10px] font-black text-emerald-300">Select Invoice</button>
          </div>)}
        </div>
        <div className="space-y-2">{assignments.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No invoice assignments yet.</p> : assignments.map(a => <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-white">Invoice {a.invoice_no}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${a.delivery_status === "delivered" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{a.delivery_status}</span></div>
          <p className="mt-1 text-xs text-slate-300">{a.customer_name} · {a.driver_name}</p>
          <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{a.customer_address || "No customer address saved"}</p>
        </div>)}</div>
      </div>}

      {tab === "expenses" && panelRole === "admin" && <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black text-white">Staff Expense Requests</h3><select value={expenseFilter} onChange={e => setExpenseFilter(e.target.value as any)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"><option value="all">All expenses</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></div>
        {renderDateRangeFilter("staff-expense-date-range", expenseDateFilter, setExpenseDateFilter, expenseCustomStart, setExpenseCustomStart, expenseCustomEnd, setExpenseCustomEnd)}
        {filteredStaffExpenses.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No staff expenses found for this date range.</p> : filteredStaffExpenses.map(expense => <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div><p className="text-sm font-black text-white">{currencySymbol}{Number(expense.amount || 0).toLocaleString("en-BD")} · {expense.reason}</p><p className="mt-1 text-[11px] text-slate-400">{expense.driver_name} · {expense.category} · {expense.date}</p></div>
          <button onClick={() => updateExpense(expense)} className={`rounded-lg px-3 py-2 text-[10px] font-black ${expense.payment_status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{expense.payment_status === "paid" ? "Paid · Mark Unpaid" : "Unpaid · Mark Paid"}</button>
        </div>)}
      </div>}

      <div className="flex items-center gap-2 rounded-xl border border-sky-500/15 bg-sky-500/5 p-3 text-[10px] leading-relaxed text-sky-200/80"><AlertCircle className="h-4 w-4 shrink-0" /> Delivery assignments are available to Admin and Sales. Only Admin can manage staff expenses and delivery payment status. Delivery accounts cannot access Admin, Sales, Ledger or inventory collections.</div>
    </div>
  );
}
