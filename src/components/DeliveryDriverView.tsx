import React, { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "../lib/firebase";
import { createDeliveryOfflineOperation, deliveryStorageKey, isRetryableDeliveryError, readDeliveryLocal, writeDeliveryLocal, writeDeliveryCacheSection, writeDeliveryCacheSnapshot, isDeliveryCachePrimed, type DeliveryOfflineOperation } from "../lib/deliveryOffline";
import { Truck, MapPin, Phone, PackageCheck, Wallet, RefreshCw, LogOut, CheckCircle2, AlertTriangle } from "lucide-react";

type Assignment = {
  id: string; invoice_no: string; customer_name: string; customer_phone: string;
  customer_address: string; delivery_status: string; delivery_fee?: number; payment_status?: string;
  delivery_note?: string; assigned_at?: string; items?: Array<{name: string; quantity: number}>;
};
type Expense = { id: string; amount: number; reason: string; category: string; date: string; payment_status: string };
type DriverProfile = { uid: string; name: string; email: string; phone?: string };

interface Props {
  key?: string;
  staff: DriverProfile;
  currencySymbol?: string;
  onLogout: () => void;
}

export function DeliveryDriverView({ staff, currencySymbol = "৳", onLogout }: Props) {
  const cacheKey = deliveryStorageKey("cache", `driver:${staff.uid}`);
  const offlineQueueKey = deliveryStorageKey("queue", `driver:${staff.uid}`);
  const [cachedData] = useState(() => readDeliveryLocal<{ assignments: Assignment[]; expenses: Expense[] } | null>(cacheKey, null));
  const [cacheReady, setCacheReady] = useState(() => isDeliveryCachePrimed(cacheKey, ["assignments", "expenses"]));
  const [tab, setTab] = useState<"staff" | "deliveries" | "expenses" | "payments">("staff");
  const [deliveryView, setDeliveryView] = useState<"assigned" | "delivered">("assigned");
  const [paymentView, setPaymentView] = useState<"pending" | "received">("pending");
  const [expenseView, setExpenseView] = useState<"add" | "status">("add");
  const [assignments, setAssignments] = useState<Assignment[]>(() => cachedData?.assignments || []);
  const [expenses, setExpenses] = useState<Expense[]>(() => cachedData?.expenses || []);
  const [pendingOperations, setPendingOperations] = useState<DeliveryOfflineOperation[]>(() => readDeliveryLocal(offlineQueueKey, []));
  const pendingOperationsRef = useRef<DeliveryOfflineOperation[]>(pendingOperations);
  const syncingOfflineQueueRef = useRef(false);
  const [offlineNotice, setOfflineNotice] = useState(pendingOperations.length > 0);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("Transport");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignmentId, setAssignmentId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, { status: string; fee: string }>>({});

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
    if (!response.ok) {
      const failure: any = new Error(data.error || "Delivery request failed.");
      failure.status = response.status;
      throw failure;
    }
    return data;
  }, []);

  useEffect(() => {
    pendingOperationsRef.current = pendingOperations;
    writeDeliveryLocal(offlineQueueKey, pendingOperations);
  }, [pendingOperations, offlineQueueKey]);

  useEffect(() => {
    writeDeliveryCacheSnapshot(cacheKey, { assignments, expenses });
  }, [cacheKey, assignments, expenses]);

  const queueOfflineOperation = useCallback((path: string, body: Record<string, any>) => {
    const operation = createDeliveryOfflineOperation(path, body);
    const next = [...pendingOperationsRef.current, operation];
    pendingOperationsRef.current = next;
    writeDeliveryLocal(offlineQueueKey, next);
    setPendingOperations(next);
    setOfflineNotice(true);
    return operation;
  }, [offlineQueueKey]);

  const flushOfflineQueue = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (syncingOfflineQueueRef.current || !pendingOperationsRef.current.length) return;
    syncingOfflineQueueRef.current = true;
    const hadPendingOperations = pendingOperationsRef.current.length > 0;
    try {
      while (pendingOperationsRef.current.length) {
        const current = pendingOperationsRef.current[0];
        try {
          await request(current.path, current.body);
          const next = pendingOperationsRef.current.filter(item => item.id !== current.id);
          pendingOperationsRef.current = next;
          writeDeliveryLocal(offlineQueueKey, next);
          setPendingOperations(next);
        } catch (error) {
          // Keep failed operations locally. Never silently discard a delivery or
          // expense update because a cloud record changed on another device.
          if (!isRetryableDeliveryError(error)) console.warn("[Delivery driver] A saved change remains pending and needs review before sync:", (error as any)?.message || error);
          break;
        }
      }
      if (hadPendingOperations && pendingOperationsRef.current.length === 0) {
        try {
          const results = await Promise.allSettled([
            request("/api/delivery/assignments"),
            request("/api/delivery/expenses/mine")
          ]);
          if (results[0].status === "fulfilled" && Array.isArray(results[0].value.assignments)) {
          writeDeliveryCacheSection(cacheKey, "assignments", results[0].value.assignments);
          setAssignments(results[0].value.assignments);
        }
          if (results[1].status === "fulfilled" && Array.isArray(results[1].value.expenses)) {
          writeDeliveryCacheSection(cacheKey, "expenses", results[1].value.expenses);
          setExpenses(results[1].value.expenses);
        }
          setOfflineNotice(results.some(result => result.status === "rejected"));
        setCacheReady(isDeliveryCachePrimed(cacheKey, ["assignments", "expenses"]));
          setCacheReady(isDeliveryCachePrimed(cacheKey, ["assignments", "expenses"]));
        } catch (_) {
          setOfflineNotice(true);
        }
      }
    } finally {
      syncingOfflineQueueRef.current = false;
    }
  }, [request, offlineQueueKey, cacheKey]);

  useEffect(() => {
    const retry = () => { void flushOfflineQueue(); };
    window.addEventListener("online", retry);
    const timer = window.setInterval(() => {
      if (pendingOperationsRef.current.length) retry();
    }, 30000);
    return () => { window.removeEventListener("online", retry); window.clearInterval(timer); };
  }, [flushOfflineQueue]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        request("/api/delivery/assignments"),
        request("/api/delivery/expenses/mine")
      ]);
      if (pendingOperationsRef.current.length) {
        // Preserve optimistic device-local edits until the pending queue is clear.
        void flushOfflineQueue();
      } else {
        // A failed expense request must not prevent the driver's assignments from
        // refreshing, and vice versa. Keep the last cached data for failed panels.
        if (results[0].status === "fulfilled" && Array.isArray(results[0].value.assignments)) { writeDeliveryCacheSection(cacheKey, "assignments", results[0].value.assignments); setAssignments(results[0].value.assignments); }
        if (results[1].status === "fulfilled" && Array.isArray(results[1].value.expenses)) { writeDeliveryCacheSection(cacheKey, "expenses", results[1].value.expenses); setExpenses(results[1].value.expenses); }
        setOfflineNotice(results.some(result => result.status === "rejected"));
      }
    } catch (error: any) {
      setOfflineNotice(true);
      console.error("[Delivery driver] Data refresh failed; retaining device-local records:", error);
    } finally { setLoading(false); }
  }, [request, flushOfflineQueue, cachedData, cacheKey]);

  useEffect(() => { load(); }, [load]);

  // Retry cached data slowly while offline/quota-limited and refresh when the
  // driver returns to this tab, so other devices' synced changes become visible.
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const timer = window.setInterval(() => {
      if (offlineNotice && pendingOperationsRef.current.length === 0) void load();
    }, 120000);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(timer);
    };
  }, [load, offlineNotice]);

  const getEditDraft = (item: Assignment) => editDrafts[item.id] || {
    status: item.delivery_status || "assigned",
    fee: String(item.delivery_fee ?? 0)
  };

  const saveAssignmentEdits = async (item: Assignment) => {
    const draft = getEditDraft(item);
    const canEditAmount = item.payment_status !== "paid";
    const fee = Number(draft.fee);
    if (canEditAmount && (!Number.isFinite(fee) || fee < 0 || fee > 1000000)) {
      alert("Enter a valid delivery amount.");
      return;
    }
    try {
      const payload: any = {
        assignment_id: item.id,
        delivery_status: draft.status,
        delivery_note: notes[item.id] ?? item.delivery_note ?? ""
      };
      if (canEditAmount) payload.delivery_fee = fee;
      await request("/api/delivery/assignments/update-mine", payload);
      setAssignments(prev => prev.map(x => x.id === item.id
        ? { ...x, delivery_status: draft.status, delivery_note: payload.delivery_note, ...(canEditAmount ? { delivery_fee: fee } : {}) }
        : x));
      setEditDrafts(prev => { const next = { ...prev }; delete next[item.id]; return next; });
      alert("Delivery details updated.");
    } catch (error: any) {
      if (isRetryableDeliveryError(error)) {
        const payload: any = {
          assignment_id: item.id,
          delivery_status: draft.status,
          delivery_note: notes[item.id] ?? item.delivery_note ?? ""
        };
        if (canEditAmount) payload.delivery_fee = fee;
        queueOfflineOperation("/api/delivery/assignments/update-mine", payload);
        setAssignments(prev => prev.map(x => x.id === item.id ? {
          ...x, delivery_status: draft.status, delivery_note: payload.delivery_note,
          ...(canEditAmount ? { delivery_fee: fee } : {})
        } : x));
        setEditDrafts(prev => { const next = { ...prev }; delete next[item.id]; return next; });
        alert("Saved on this device. It will sync automatically when Firebase access returns.");
      } else alert(error?.message || "Could not update delivery details.");
    }
  };

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expensePayload = {
        amount: Number(amount), reason, category, date, assignment_id: assignmentId || ""
      };
      try {
        const result = await request("/api/delivery/expenses", expensePayload);
        if (result.expense) setExpenses(prev => [result.expense, ...prev.filter(x => x.id !== result.expense.id)]);
      } catch (error: any) {
        if (!isRetryableDeliveryError(error)) throw error;
        const clientRequestId = createDeliveryOfflineOperation("local-id", {}).id;
        queueOfflineOperation("/api/delivery/expenses", {
          ...expensePayload,
          client_request_id: clientRequestId
        });
        const localExpense: Expense = {
          id: clientRequestId, amount: Number(amount), reason, category, date,
          payment_status: "unpaid"
        };
        setExpenses(prev => [localExpense, ...prev.filter(x => x.id !== clientRequestId)]);
      }
      setAmount(""); setReason(""); setAssignmentId("");
      await load();
      setExpenseView("status");
      setTab("expenses");
    } catch (error: any) { alert(error?.message || "Could not submit expense."); }
  };

  return (
    <div className="h-[100dvh] overflow-y-auto overscroll-y-contain bg-[#080d18] p-3 pb-10 text-white sm:p-6" id="delivery-driver-panel">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div><p className="flex items-center gap-2 text-lg font-black"><Truck className="h-5 w-5 text-emerald-400" /> Delivery Panel</p><p className="mt-1 text-xs text-slate-400">{staff.name} · {staff.email}</p></div>
          <button onClick={onLogout} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300"><LogOut className="mr-1 inline h-3.5 w-3.5" /> Logout</button>
        </header>
        {cacheReady && <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Device cache ready · Your assignments and expenses are saved</div>}

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1.5 sm:grid-cols-4">
          <button onClick={() => setTab("staff")} className={`rounded-xl px-2 py-3 text-xs font-black ${tab === "staff" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>Delivery Staff</button>
          <button onClick={() => setTab("deliveries")} className={`rounded-xl px-2 py-3 text-xs font-black ${tab === "deliveries" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>Invoice Assignment ({assignments.length})</button>
          <button onClick={() => setTab("expenses")} className={`rounded-xl px-2 py-3 text-xs font-black ${tab === "expenses" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>Staff Expenses ({expenses.length})</button>
          <button onClick={() => setTab("payments")} className={`rounded-xl px-2 py-3 text-xs font-black ${tab === "payments" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>Delivery Payments ({assignments.length + expenses.length})</button>
        </div>

        {(offlineNotice || pendingOperations.length > 0) && <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100"><span className="font-black">Device-local delivery mode.</span> Showing the latest saved deliveries and expenses. {pendingOperations.length > 0 ? `${pendingOperations.length} change(s) waiting to sync.` : "Cloud data could not be refreshed."} Changes will sync automatically when Firebase access returns. Do not clear this browser's site data before sync completes.</div>}
        <div className="flex justify-end"><button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300"><RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh</button></div>

        {tab === "staff" && <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <h2 className="text-sm font-black text-white">Delivery Staff Profile</h2>
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
            <p className="text-base font-black text-white">{staff.name}</p>
            <p className="mt-1 text-xs text-slate-400">{staff.email}</p>
            {staff.phone && <p className="mt-1 text-xs text-slate-400">Phone: {staff.phone}</p>}
            <p className="mt-3 inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-300">Your delivery account</p>
            <p className="mt-3 text-[11px] text-slate-400">This page is for viewing your own staff profile. Staff account creation, hold/reactivation and deletion remain Admin-only.</p>
          </div>
        </section>}

        {tab === "deliveries" && <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1.5">
            <button onClick={() => setDeliveryView("assigned")} className={`rounded-xl px-3 py-3 text-xs font-black ${deliveryView === "assigned" ? "bg-amber-500/15 text-amber-300" : "text-slate-400"}`}>Assigned ({assignments.filter(x => x.delivery_status !== "delivered").length})</button>
            <button onClick={() => setDeliveryView("delivered")} className={`rounded-xl px-3 py-3 text-xs font-black ${deliveryView === "delivered" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>Delivered ({assignments.filter(x => x.delivery_status === "delivered").length})</button>
          </div>
          {(() => {
            const visibleAssignments = assignments.filter(item => deliveryView === "delivered" ? item.delivery_status === "delivered" : item.delivery_status !== "delivered");
            return visibleAssignments.length === 0
              ? <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">{deliveryView === "delivered" ? "No delivered parcels yet." : "No parcels assigned to you right now."}</div>
              : visibleAssignments.map(item => <article key={item.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-black">Invoice {item.invoice_no}</h3><span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-black capitalize text-amber-300">{item.delivery_status}</span></div>
            <div className="space-y-1 text-xs text-slate-300"><p className="font-bold">{item.customer_name}</p>{item.customer_phone && <a className="inline-flex items-center gap-1 text-sky-300" href={`tel:${item.customer_phone}`}><Phone className="h-3 w-3" /> {item.customer_phone}</a>}<p className="flex items-start gap-1 text-slate-400"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{item.customer_address || "Customer address not available"}</p></div>
            {item.items?.length ? <div className="rounded-xl bg-slate-950/70 p-3 text-[11px] text-slate-300">{item.items.map((x,i) => <p key={i}>{x.name} × {x.quantity}</p>)}</div> : null}
            {deliveryView === "assigned" && <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-bold text-slate-300">Edit delivery details</p><span className="text-[10px] text-slate-500">Status can be changed anytime</span></div>
              <label className="block text-[10px] font-bold text-slate-400">Delivery status
                <select value={getEditDraft(item).status} onChange={e => setEditDrafts(prev => ({ ...prev, [item.id]: { ...getEditDraft(item), status: e.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white">
                  <option value="assigned">Assigned / In progress</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option><option value="failed">Failed</option><option value="returned">Returned</option>
                </select>
              </label>
              <label className="block text-[10px] font-bold text-slate-400">Delivery amount ({currencySymbol})
                <input type="number" min="0" max="1000000" step="0.01" disabled={item.payment_status === "paid"} value={getEditDraft(item).fee} onChange={e => setEditDrafts(prev => ({ ...prev, [item.id]: { ...getEditDraft(item), fee: e.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50" />
              </label>
              {item.payment_status === "paid" && <p className="text-[10px] font-semibold text-emerald-300">Payment is Paid. Amount editing is locked; delivery status can still be changed.</p>}
              <input value={notes[item.id] ?? item.delivery_note ?? ""} onChange={e => setNotes(prev => ({...prev,[item.id]:e.target.value}))} placeholder="Delivery note (optional)" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white" />
              <button onClick={() => saveAssignmentEdits(item)} className="w-full rounded-lg bg-emerald-500 px-3 py-2.5 text-[10px] font-black text-slate-950">Save Changes</button>
            </div>}
          </article>);
          })()}
        </div>}

        {tab === "payments" && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1.5">
            <button onClick={() => setPaymentView("pending")} className={`rounded-xl px-3 py-3 text-xs font-black ${paymentView === "pending" ? "bg-rose-500/15 text-rose-300" : "text-slate-400"}`}>Pending Payment ({assignments.filter(x => x.payment_status !== "paid").length + expenses.filter(x => x.payment_status !== "paid").length})</button>
            <button onClick={() => setPaymentView("received")} className={`rounded-xl px-3 py-3 text-xs font-black ${paymentView === "received" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>Received Payment ({assignments.filter(x => x.payment_status === "paid").length + expenses.filter(x => x.payment_status === "paid").length})</button>
          </div>
          {(() => {
            const visiblePayments = assignments.filter(item => paymentView === "received" ? item.payment_status === "paid" : item.payment_status !== "paid");
            return visiblePayments.length === 0
              ? <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">{paymentView === "received" ? "No received payments yet." : "No pending payments."}</div>
              : visiblePayments.map(item => <article key={item.id} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black">Invoice {item.invoice_no}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${(item as any).payment_status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{(item as any).payment_status === "paid" ? "Payment Received" : "Payment Pending"}</span></div>
            <div className="space-y-1 rounded-xl bg-slate-950/60 p-3">
              <p className="text-xs font-bold text-slate-200">{item.customer_name || "Customer name unavailable"}</p>
              {item.customer_phone ? <a href={`tel:${item.customer_phone}`} className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300"><Phone className="h-3 w-3" /> {item.customer_phone}</a> : <p className="text-xs text-slate-500">Customer phone unavailable</p>}
              <p className="flex items-start gap-1 text-xs leading-relaxed text-slate-300"><MapPin className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /> <span>{item.customer_address || "Customer address unavailable"}</span></p>
            </div>
            <p className="text-lg font-black text-white">{currencySymbol}{Number((item as any).delivery_fee || 0).toLocaleString("en-BD")}</p>
            <p className="text-[11px] text-slate-400">{(item as any).payment_timing === "advance" ? "Advance payment" : "Payment after delivery"} · {item.assigned_at ? new Date(item.assigned_at).toLocaleString("en-BD") : "Date unavailable"}</p>
            {(item as any).payment_updated_at && <p className="text-[10px] text-slate-500">Last payment update: {new Date((item as any).payment_updated_at).toLocaleString("en-BD")}</p>}
            {(item as any).payment_received_at && <p className="text-[10px] text-emerald-300">Received: {new Date((item as any).payment_received_at).toLocaleString("en-BD")}</p>}
          </article>);
          })()}
          <section className="space-y-2 pt-2">
            <h3 className="text-sm font-black text-white">My Staff Expense Payments</h3>
            {expenses.filter(x => paymentView === "received" ? x.payment_status === "paid" : x.payment_status !== "paid").length === 0
              ? <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">No {paymentView} expense payments.</p>
              : expenses.filter(x => paymentView === "received" ? x.payment_status === "paid" : x.payment_status !== "paid").map(x => <article key={`driver-expense-payment-${x.id}`} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-black">Staff Expense · {currencySymbol}{Number(x.amount || 0).toLocaleString("en-BD")}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ${x.payment_status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{x.payment_status === "paid" ? "Paid" : "Pending"}</span></div>
                <p className="mt-1 text-[11px] text-slate-400">{x.reason} · {x.category} · {x.date}</p>
              </article>)}
          </section>
        </div>}

        {tab === "expenses" && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1.5">
            <button onClick={() => setExpenseView("add")} className={`rounded-xl px-3 py-3 text-xs font-black ${expenseView === "add" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>Add Expenses</button>
            <button onClick={() => setExpenseView("status")} className={`rounded-xl px-3 py-3 text-xs font-black ${expenseView === "status" ? "bg-sky-500/15 text-sky-300" : "text-slate-400"}`}>Payment Status ({expenses.length})</button>
          </div>
          {expenseView === "add" && <form onSubmit={submitExpense} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <h3 className="flex items-center gap-2 text-sm font-black"><Wallet className="h-4 w-4 text-emerald-400" /> Submit Expense</h3>
            <input required type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Amount (${currencySymbol})`} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" />
            <input required value={reason} onChange={e => setReason(e.target.value)} placeholder="Expense details / reason (what was this cost for?)" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white" />
            <div className="grid grid-cols-2 gap-2"><select value={category} onChange={e => setCategory(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-white"><option value="Delivery">Delivery Cost</option><option value="Transport">Transport Cost</option><option value="Pickup / Collection">Pickup / Collection</option><option value="Loading / Unloading">Loading / Unloading</option><option value="Fuel">Fuel</option><option value="Parking">Parking / Toll</option><option value="Food">Food / Refreshment</option><option value="Other">Other Expenses</option></select><input required type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-white" /></div>
            <select value={assignmentId} onChange={e => setAssignmentId(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-xs text-white"><option value="">General expense (not linked to an invoice)</option>{assignments.map(x => <option key={x.id} value={x.id}>Invoice {x.invoice_no}</option>)}</select>
            <button className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-xs font-black text-slate-950">Submit Expense</button>
          </form>}
          {expenseView === "status" && <div className="space-y-2">
            {expenses.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No expenses submitted yet.</div> : expenses.map(x => <div key={x.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3"><div className="min-w-0"><p className="text-sm font-bold">{currencySymbol}{Number(x.amount).toLocaleString("en-BD")} · {x.reason}</p><p className="text-[10px] text-slate-400">{x.category} · {x.date}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${x.payment_status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{x.payment_status === "paid" ? "Paid" : "Unpaid"}</span></div>)}
          </div>}
        </div>}
      </div>
    </div>
  );
}
