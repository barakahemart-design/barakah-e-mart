import React, { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "../lib/firebase";
import { createDeliveryOfflineOperation, deliveryStorageKey, isRetryableDeliveryError, readDeliveryLocal, writeDeliveryLocal, type DeliveryOfflineOperation } from "../lib/deliveryOffline";
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
  paid_at?: string; payment_date?: string; reviewed_at?: string;
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
  const cacheKey = deliveryStorageKey("cache", `${storeId}:${panelRole}`);
  const offlineQueueKey = deliveryStorageKey("queue", `${storeId}:${panelRole}`);
  const cachedData = readDeliveryLocal<{ staff: Driver[]; assignments: Assignment[]; queueItems: any[]; expenses: DeliveryExpense[] } | null>(cacheKey, null);
  const [tab, setTab] = useState<"home" | "staff" | "assignments" | "expenses" | "payments">("home");
  const [staff, setStaff] = useState<Driver[]>(() => cachedData?.staff || []);
  const [assignments, setAssignments] = useState<Assignment[]>(() => cachedData?.assignments || []);
  const [queueItems, setQueueItems] = useState<Array<{id:string; invoice_no:string; customer_name:string; customer_phone:string; customer_address:string; items?:Array<{name:string;quantity:number}>; total_amount?:number; queued_at:string}>>(() => cachedData?.queueItems || []);
  const [expenses, setExpenses] = useState<DeliveryExpense[]>(() => cachedData?.expenses || []);
  const [pendingOperations, setPendingOperations] = useState<DeliveryOfflineOperation[]>(() => readDeliveryLocal(offlineQueueKey, []));
  const pendingOperationsRef = useRef<DeliveryOfflineOperation[]>(pendingOperations);
  const syncingOfflineQueueRef = useRef(false);
  const [offlineNotice, setOfflineNotice] = useState(Boolean(cachedData) || pendingOperations.length > 0);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceLookup, setInvoiceLookup] = useState<{ status: "idle" | "loading" | "found" | "not_found" | "error"; invoice?: any; already_assigned?: boolean; assigned_driver?: string; message?: string }>({ status: "idle" });
  const [invoiceSelected, setInvoiceSelected] = useState(false);
  const [deletingAssignmentNo, setDeletingAssignmentNo] = useState("");
  const [driverUid, setDriverUid] = useState("");
  const [assignmentView, setAssignmentView] = useState<"assigned" | "delivered">("assigned");
  const [expenseView, setExpenseView] = useState<"unpaid" | "paid">("unpaid");
  const [paymentView, setPaymentView] = useState<"unpaid" | "paid">("unpaid");
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, { fee: string; status: "paid" | "unpaid"; timing: "advance" | "after_delivery" }>>({});
  type DateRangeFilter = "all" | "today" | "yesterday" | "weekly" | "monthly" | "yearly" | "custom";
  const [expenseDateFilter, setExpenseDateFilter] = useState<DateRangeFilter>("all");
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
    if (!response.ok) {
      const failure: any = new Error(data.error || "Delivery request failed.");
      failure.status = response.status;
      throw failure;
    }
    return data;
  }, [adminPin, salesPin, panelRole, storeId]);

  useEffect(() => {
    pendingOperationsRef.current = pendingOperations;
    writeDeliveryLocal(offlineQueueKey, pendingOperations);
  }, [pendingOperations, offlineQueueKey]);

  useEffect(() => {
    writeDeliveryLocal(cacheKey, { staff, assignments, queueItems, expenses, savedAt: new Date().toISOString() });
  }, [cacheKey, staff, assignments, queueItems, expenses]);

  const queueOfflineOperation = useCallback((path: string, body: Record<string, any>) => {
    const operation = createDeliveryOfflineOperation(path, body);
    const next = [...pendingOperationsRef.current, operation];
    pendingOperationsRef.current = next;
    setPendingOperations(next);
    setOfflineNotice(true);
  }, []);

  const flushOfflineQueue = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (syncingOfflineQueueRef.current || !pendingOperationsRef.current.length) return;
    syncingOfflineQueueRef.current = true;
    try {
      while (pendingOperationsRef.current.length) {
        const current = pendingOperationsRef.current[0];
        try {
          await request(current.path, current.body);
          const next = pendingOperationsRef.current.filter(item => item.id !== current.id);
          pendingOperationsRef.current = next;
          setPendingOperations(next);
        } catch (error) {
          // Keep the first failed operation and all later operations in order.
          // This prevents a later payment/status change overtaking an earlier change.
          if (!isRetryableDeliveryError(error)) notifyRef.current("A saved delivery change needs review before it can sync: " + String((error as any)?.message || error), "error");
          break;
        }
      }
    } finally {
      syncingOfflineQueueRef.current = false;
    }
  }, [request]);

  useEffect(() => {
    const retry = () => { void flushOfflineQueue(); };
    window.addEventListener("online", retry);
    const timer = window.setInterval(() => {
      if (pendingOperationsRef.current.length) retry();
    }, 30000);
    return () => { window.removeEventListener("online", retry); window.clearInterval(timer); };
  }, [flushOfflineQueue]);

  const loadAll = useCallback(async () => {
    if ((panelRole === "admin" && !adminPin) || (panelRole === "sales" && !salesPin) || !storeId) return;
    setLoading(true);
    try {
      const [staffData, assignmentData, queueData, expenseData] = await Promise.all([
        request("/api/delivery/staff/list", {}),
        request("/api/delivery/assignments/admin-list", {}),
        request("/api/delivery/queue/list", {}),
        panelRole === "admin" ? request("/api/delivery/expenses/admin-list", { payment_status: "" }) : Promise.resolve({ expenses: [] })
      ]);
      setStaff(staffData.staff || []);
      setAssignments(assignmentData.assignments || []);
      setQueueItems(queueData.queue || []);
      setExpenses(expenseData.expenses || []);
      setDriverUid(prev => prev || staffData.staff?.find((x: Driver) => x.status === "active")?.uid || "");
      setOfflineNotice(false);
      void flushOfflineQueue();
    } catch (error: any) {
      setOfflineNotice(true);
      if (!cachedData) notifyRef.current(error?.message || "Could not load delivery management data.", "error");
      else notifyRef.current("Cloud limit/network unavailable. Showing the latest saved delivery data on this device.", "info");
    } finally {
      setLoading(false);
    }
  }, [adminPin, salesPin, storeId, request, panelRole, flushOfflineQueue, cachedData]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Clean only orphan assignments after verifying that the invoice no longer exists in this store.
  useEffect(() => {
    if (panelRole !== "admin" || tab !== "assignments") return;
    let cancelled = false;
    request("/api/delivery/assignments/cleanup-orphans", {})
      .then((result: any) => { if (!cancelled && Number(result.deleted || 0) > 0) loadAll(); })
      .catch((error: any) => console.warn("[Delivery] Orphan assignment cleanup skipped:", error?.message || error));
    return () => { cancelled = true; };
  }, [panelRole, tab, request, loadAll]);

  useEffect(() => {
    const value = invoiceNo.trim();
    setInvoiceSelected(false);
    if (!value) { setInvoiceLookup({ status: "idle" }); return; }
    let cancelled = false;
    setInvoiceLookup({ status: "loading" });
    const timer = window.setTimeout(async () => {
      try {
        const result = await request("/api/delivery/invoices/lookup", { invoice_no: value });
        if (!cancelled) setInvoiceLookup({ status: "found", invoice: result.invoice, already_assigned: Boolean(result.already_assigned), assigned_driver: result.assigned_driver || "" });
      } catch (error: any) {
        if (cancelled) return;
        const message = String(error?.message || "Could not search invoice.");
        setInvoiceLookup(message.toLowerCase().includes("invoice not found") ? { status: "not_found", message } : { status: "error", message });
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [invoiceNo, request]);

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
    if (invoiceLookup.status !== "found" || !invoiceSelected || invoiceLookup.already_assigned) {
      notifyRef.current(invoiceLookup.already_assigned ? "This invoice is already assigned." : "Search and select a valid invoice number first.", "error");
      return;
    }
    if (!driverUid) {
      notifyRef.current("Select a delivery driver first.", "error");
      return;
    }
    try {
      const result = await request("/api/delivery/assignments/create", { invoice_no: invoiceNo, driver_uid: driverUid });
      setAssignments(prev => [result.assignment, ...prev.filter(x => x.id !== result.assignment.id)]);
      setInvoiceNo("");
      setInvoiceLookup({ status: "idle" });
      setInvoiceSelected(false);
      notifyRef.current("Invoice assigned to delivery staff.", "success");
    } catch (error: any) {
      notifyRef.current(error?.message || "Could not assign invoice.", "error");
    }
  };

  const deleteInvoiceAssignment = async (invoiceNoToDelete: string) => {
    const cleanInvoiceNo = String(invoiceNoToDelete || "").trim();
    if (panelRole !== "admin" || !cleanInvoiceNo || deletingAssignmentNo) return;
    if (!window.confirm("Remove invoice " + cleanInvoiceNo + " from Delivery Assignment and Delivery Queue? The original sales invoice and customer ledger will not be deleted.")) return;
    setDeletingAssignmentNo(cleanInvoiceNo);
    try {
      await request("/api/delivery/assignments/admin-delete", { invoice_no: cleanInvoiceNo });
      setAssignments(prev => prev.filter(item => String(item.invoice_no) !== cleanInvoiceNo));
      setQueueItems(prev => prev.filter(item => String(item.invoice_no) !== cleanInvoiceNo));
      notifyRef.current("Invoice " + cleanInvoiceNo + " removed from Delivery Assignment/Queue. The original invoice is safe.", "success");
    } catch (error: any) {
      if (isRetryableDeliveryError(error)) {
        queueOfflineOperation("/api/delivery/assignments/admin-delete", { invoice_no: cleanInvoiceNo });
        setAssignments(prev => prev.filter(item => String(item.invoice_no) !== cleanInvoiceNo));
        setQueueItems(prev => prev.filter(item => String(item.invoice_no) !== cleanInvoiceNo));
        notifyRef.current("Removal saved on this device. It will sync when the cloud limit/connection returns.", "info");
      } else notifyRef.current(error?.message || "Could not delete invoice assignment.", "error");
    } finally {
      setDeletingAssignmentNo("");
    }
  };

  const toggleStaff = async (person: Driver) => {
    const nextStatus = person.status === "active" ? "inactive" : "active";
    try {
      await request("/api/delivery/staff/status", { staff_uid: person.uid, status: nextStatus });
      setStaff(prev => prev.map(x => x.uid === person.uid ? { ...x, status: nextStatus } : x));
      notifyRef.current(nextStatus === "inactive" ? "Delivery account put on hold." : "Delivery account reactivated.", "success");
    } catch (error: any) {
      if (isRetryableDeliveryError(error)) {
        queueOfflineOperation("/api/delivery/staff/status", { staff_uid: person.uid, status: nextStatus });
        setStaff(prev => prev.map(x => x.uid === person.uid ? { ...x, status: nextStatus } : x));
        notifyRef.current("Staff status saved on this device and queued for cloud sync.", "info");
      } else notifyRef.current(error?.message || "Could not update staff status.", "error");
    }
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
      const result = await request("/api/delivery/expenses/payment-status", { expense_id: expense.id, payment_status: next });
      setExpenses(prev => prev.map(x => x.id === expense.id ? {
        ...x,
        payment_status: next,
        paid_at: result.paid_at || undefined,
        payment_date: result.payment_date || undefined
      } : x));
      notifyRef.current(next === "paid" ? "Expense marked as Paid." : "Expense marked as Unpaid.", "success");
    } catch (error: any) {
      if (isRetryableDeliveryError(error)) {
        const now = new Date().toISOString();
        queueOfflineOperation("/api/delivery/expenses/payment-status", { expense_id: expense.id, payment_status: next });
        setExpenses(prev => prev.map(x => x.id === expense.id ? { ...x, payment_status: next, paid_at: next === "paid" ? (x.paid_at || now) : undefined, payment_date: next === "paid" ? now.slice(0, 10) : undefined } : x));
        notifyRef.current("Expense payment change saved on this device and queued for cloud sync.", "info");
      } else notifyRef.current(error?.message || "Could not update expense status.", "error");
    }
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
    } catch (error: any) {
      if (isRetryableDeliveryError(error)) {
        const now = new Date().toISOString();
        const body = { assignment_id: assignment.id, delivery_fee: fee, payment_status: draft.status, payment_timing: draft.timing };
        queueOfflineOperation("/api/delivery/assignments/payment", body);
        setAssignments(prev => prev.map(item => item.id === assignment.id ? { ...item, delivery_fee: fee, payment_status: draft.status, payment_timing: draft.timing, payment_updated_at: now, payment_received_at: draft.status === "paid" ? (item.payment_received_at || now) : "" } : item));
        setPaymentDrafts(prev => { const next = { ...prev }; delete next[assignment.id]; return next; });
        notifyRef.current("Delivery payment saved on this device. It will sync when cloud access returns.", "info");
      } else notifyRef.current(error?.message || "Could not update delivery payment.", "error");
    }
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
    expense.payment_status === expenseView &&
    isDateInRange(
      expenseView === "paid"
        ? (expense.payment_date || expense.paid_at || expense.reviewed_at || expense.date)
        : expense.date,
      expenseDateFilter,
      expenseCustomStart,
      expenseCustomEnd
    )
  );
  const filteredDeliveryPayments = assignments.filter(assignment =>
    (assignment.payment_status === "paid" ? "paid" : "unpaid") === paymentView &&
    isDateInRange(
      paymentView === "paid"
        ? (assignment.payment_received_at || assignment.payment_updated_at || assignment.assigned_at)
        : (assignment.payment_updated_at || assignment.assigned_at),
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

      {(offlineNotice || pendingOperations.length > 0) && <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100">
        <span className="font-black">Device-local delivery mode.</span> Showing the latest saved records on this device. {pendingOperations.length > 0 ? `${pendingOperations.length} change(s) waiting to sync.` : "Cloud data could not be refreshed."} Pending changes sync automatically when Firebase access is restored. Do not clear this browser's site data before sync completes.
      </div>}

      {tab === "home" ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tabs.map(item => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setTab(item.id)} className="flex min-h-28 items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-5 text-left hover:border-sky-400/60">
          <Icon className="h-7 w-7 text-sky-300" /><span className="flex-1 text-sm font-black text-white">{item.label}</span><span className="text-xs text-slate-400">Open →</span>
        </button>; })}
      </div> : <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <button type="button" onClick={() => setTab("home")} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white">← Delivery Management</button>
        <span className="text-xs font-black text-sky-300">{tabs.find(item => item.id === tab)?.label}</span>
      </div>}

      {tab === "staff" && <div className={`grid gap-4 ${panelRole === "admin" ? "lg:grid-cols-[minmax(280px,0.85fr)_1.15fr]" : "grid-cols-1"}`}>
        {panelRole === "admin" && <form onSubmit={createStaff} autoComplete="off" className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><UserPlus className="h-4 w-4 text-emerald-400" /> Create Delivery Account</h3>
          <input autoComplete="off" name="delivery-staff-full-name" required minLength={2} value={name} onChange={e => setName(e.target.value)} placeholder="Staff full name" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          <input autoComplete="new-password" name="delivery-staff-login-email" readOnly onFocus={e => { e.currentTarget.readOnly = false; }} required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Login email address" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          <input autoComplete="off" name="delivery-staff-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number (optional)" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
          <input autoComplete="new-password" name="delivery-staff-temporary-password" required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Temporary password (min. 8 characters)" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
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
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1.5">
          <button type="button" onClick={() => setPaymentView("unpaid")} className={`rounded-xl px-3 py-3 text-xs font-black ${paymentView === "unpaid" ? "bg-rose-500/15 text-rose-300" : "text-slate-400"}`}>Unpaid ({assignments.filter(a => a.payment_status !== "paid").length})</button>
          <button type="button" onClick={() => setPaymentView("paid")} className={`rounded-xl px-3 py-3 text-xs font-black ${paymentView === "paid" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>Paid ({assignments.filter(a => a.payment_status === "paid").length})</button>
        </div>
        {renderDateRangeFilter("delivery-payment-date-range", paymentDateFilter, setPaymentDateFilter, paymentCustomStart, setPaymentCustomStart, paymentCustomEnd, setPaymentCustomEnd)}
        {filteredDeliveryPayments.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No {paymentView} delivery payments found for this date range.</p> : filteredDeliveryPayments.map(a => {
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
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1.5">
          <button type="button" onClick={() => setAssignmentView("assigned")} className={`rounded-xl px-3 py-3 text-xs font-black ${assignmentView === "assigned" ? "bg-amber-500/15 text-amber-300" : "text-slate-400"}`}>Assigned ({assignments.filter(x => x.delivery_status !== "delivered").length})</button>
          <button type="button" onClick={() => setAssignmentView("delivered")} className={`rounded-xl px-3 py-3 text-xs font-black ${assignmentView === "delivered" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>Delivered ({assignments.filter(x => x.delivery_status === "delivered").length})</button>
        </div>
        {assignmentView === "assigned" ? <>
          <form onSubmit={assignInvoice} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="space-y-1.5 text-[11px] font-bold text-slate-300">Assign to Driver<select required value={driverUid} onChange={e => setDriverUid(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500"><option value="">Select delivery staff</option>{activeDrivers.map(x => <option key={x.uid} value={x.uid}>{x.name} · {x.email}</option>)}</select></label>
            <div className="space-y-1.5 text-[11px] font-bold text-slate-300">
              <label htmlFor="delivery-invoice-number">Enter Invoice Number</label>
              <input id="delivery-invoice-number" required inputMode="numeric" autoComplete="off" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} placeholder="Type invoice number to search" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-500" />
              {invoiceLookup.status === "loading" && <p className="pt-1 text-[10px] text-slate-400">Searching invoices in this business account…</p>}
              {invoiceLookup.status === "not_found" && <p role="status" className="pt-1 text-[10px] font-bold text-rose-400">Invoice not found in this business account.</p>}
              {invoiceLookup.status === "error" && <p role="alert" className="pt-1 text-[10px] text-rose-300">{invoiceLookup.message}</p>}
              {invoiceLookup.status === "found" && <div className="mt-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-[10px] text-emerald-100">
                <p className="font-black">Invoice #{invoiceLookup.invoice?.invoice_no} · {invoiceLookup.invoice?.customer_name}</p>
                <p className="mt-1 text-emerald-100/75">{invoiceLookup.invoice?.customer_phone || "No phone number"} · {currencySymbol} {Number(invoiceLookup.invoice?.total_amount || 0).toLocaleString()}</p>
                {invoiceLookup.already_assigned ? <p className="mt-1 font-bold text-amber-300">Already assigned to {invoiceLookup.assigned_driver || "a delivery staff member"}.</p> : <button type="button" onClick={() => setInvoiceSelected(true)} className={invoiceSelected ? "mt-2 rounded-lg bg-emerald-500/20 px-3 py-2 font-black text-emerald-200" : "mt-2 rounded-lg bg-emerald-500 px-3 py-2 font-black text-slate-950"}>{invoiceSelected ? "Invoice Selected" : "Select Invoice"}</button>}
              </div>}
            </div>
            <button disabled={!activeDrivers.length || !driverUid || invoiceLookup.status !== "found" || !invoiceSelected || Boolean(invoiceLookup.already_assigned)} className="rounded-xl bg-emerald-500 px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-40">Assign Invoice</button>
          </form>
          <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="text-sm font-black text-white">New Sales Delivery Queue <span className="text-emerald-300">({queueItems.length})</span></h3>
            {queueItems.length === 0 ? <p className="text-xs text-slate-500">No new sales waiting for delivery assignment.</p> : queueItems.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div><p className="text-xs font-black text-white">Invoice {item.invoice_no} · {item.customer_name}</p><p className="text-[10px] text-slate-400">{item.customer_phone} · {item.customer_address}</p><p className="text-[10px] text-slate-500">{item.items?.map(x => `${x.name} × ${x.quantity}`).join(", ")}</p></div>
              <div className="flex items-center gap-2"><button type="button" onClick={() => setInvoiceNo(item.invoice_no)} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[10px] font-black text-emerald-300">Select Invoice</button>{panelRole === "admin" && <button type="button" disabled={deletingAssignmentNo === String(item.invoice_no)} onClick={() => deleteInvoiceAssignment(String(item.invoice_no))} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] font-black text-rose-300 disabled:opacity-50"><Trash2 className="h-3 w-3" />Delete Invoice</button>}</div>
            </div>)}
          </div>
          <div className="space-y-2">{assignments.filter(x => x.delivery_status !== "delivered").length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No assigned invoices right now.</p> : assignments.filter(x => x.delivery_status !== "delivered").map(item => <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-white">Invoice {item.invoice_no}</p><span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-black capitalize text-amber-300">{item.delivery_status || "assigned"}</span></div>
            <p className="mt-1 text-xs text-slate-300">{item.customer_name} · {item.driver_name}</p>
            <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{item.customer_address || "No customer address saved"}</p>
            {panelRole === "admin" && <div className="mt-3 flex justify-end"><button type="button" disabled={deletingAssignmentNo === String(item.invoice_no)} onClick={() => deleteInvoiceAssignment(String(item.invoice_no))} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] font-black text-rose-300 disabled:opacity-50"><Trash2 className="h-3 w-3" />{deletingAssignmentNo === String(item.invoice_no) ? "Deleting…" : "Delete Invoice"}</button></div>}
          </div>)}</div>
        </> : <div className="space-y-2">
          {assignments.filter(x => x.delivery_status === "delivered").length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No delivered invoices yet.</p> : assignments.filter(x => x.delivery_status === "delivered").map(item => <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-white">Invoice {item.invoice_no}</p><span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-300">Delivered</span></div>
            <p className="mt-1 text-xs text-slate-300">{item.customer_name} · {item.driver_name}</p>
            <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{item.customer_address || "No customer address saved"}</p>
            {panelRole === "admin" && <div className="mt-3 flex justify-end"><button type="button" disabled={deletingAssignmentNo === String(item.invoice_no)} onClick={() => deleteInvoiceAssignment(String(item.invoice_no))} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] font-black text-rose-300 disabled:opacity-50"><Trash2 className="h-3 w-3" />{deletingAssignmentNo === String(item.invoice_no) ? "Deleting…" : "Delete Invoice"}</button></div>}
          </div>)}
        </div>}
      </div>}

      {tab === "expenses" && panelRole === "admin" && <div className="space-y-3">
        <h3 className="text-sm font-black text-white">Staff Expense Requests</h3>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1.5">
          <button type="button" onClick={() => setExpenseView("unpaid")} className={`rounded-xl px-3 py-3 text-xs font-black ${expenseView === "unpaid" ? "bg-rose-500/15 text-rose-300" : "text-slate-400"}`}>Unpaid ({expenses.filter(x => x.payment_status !== "paid").length})</button>
          <button type="button" onClick={() => setExpenseView("paid")} className={`rounded-xl px-3 py-3 text-xs font-black ${expenseView === "paid" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>Paid ({expenses.filter(x => x.payment_status === "paid").length})</button>
        </div>
        {renderDateRangeFilter("staff-expense-date-range", expenseDateFilter, setExpenseDateFilter, expenseCustomStart, setExpenseCustomStart, expenseCustomEnd, setExpenseCustomEnd)}
        {filteredStaffExpenses.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No {expenseView} staff expenses found for this date range.</p> : filteredStaffExpenses.map(expense => <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div><p className="text-sm font-black text-white">{currencySymbol}{Number(expense.amount || 0).toLocaleString("en-BD")} · {expense.reason}</p><p className="mt-1 text-[11px] text-slate-400">{expense.driver_name} · {expense.category} · {expense.date}</p></div>
          <button onClick={() => updateExpense(expense)} className={`rounded-lg px-3 py-2 text-[10px] font-black ${expense.payment_status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{expense.payment_status === "paid" ? "Paid · Mark Unpaid" : "Unpaid · Mark Paid"}</button>
        </div>)}
      </div>}

      <div className="flex items-center gap-2 rounded-xl border border-sky-500/15 bg-sky-500/5 p-3 text-[10px] leading-relaxed text-sky-200/80"><AlertCircle className="h-4 w-4 shrink-0" /> Delivery assignments are available to Admin and Sales. Only Admin can manage staff expenses and delivery payment status. Delivery accounts cannot access Admin, Sales, Ledger or inventory collections.</div>
    </div>
  );
}
