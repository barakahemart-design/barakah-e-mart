import React, { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "../lib/firebase";
import { createDeliveryOfflineOperation, deliveryStorageKey, isRetryableDeliveryError, readDeliveryLocal, writeDeliveryLocal, writeDeliveryCacheSection, writeDeliveryCacheSnapshot, isDeliveryCachePrimed, type DeliveryOfflineOperation } from "../lib/deliveryOffline";
import { Truck, UserPlus, RefreshCw, ClipboardList, Wallet, CheckCircle2, AlertCircle, UserRound, MapPin, Trash2, PauseCircle, PlayCircle, Edit3 } from "lucide-react";

type Driver = { uid: string; name: string; email: string; phone?: string; status: "active" | "inactive" };
type Assignment = {
  id: string; invoice_no: string; driver_uid: string; driver_name: string;
  customer_name: string; customer_phone: string; customer_address: string;
  customer_note?: string; delivery_note?: string;
  delivery_status: string; assigned_at: string;
  delivery_fee?: number; delivery_charge_bearer?: "showroom" | "customer"; payment_status?: "paid" | "unpaid"; payment_timing?: "advance" | "after_delivery"; payment_updated_at?: string; payment_received_at?: string;
  total_amount?: number; items?: Array<{ name: string; quantity: number; price?: number; total?: number }>;
};
type DeliveryExpense = {
  id: string; driver_uid?: string; driver_name: string; amount: number; reason: string; category: string;
  date: string; payment_status: "paid" | "unpaid"; assignment_id?: string;
  paid_at?: string; payment_date?: string; reviewed_at?: string;
};

interface Props {
  adminPin: string;
  salesPin?: string;
  panelRole?: "admin" | "sales";
  storeId: string;
  transactions?: any[];
  contacts?: any[];
  currencySymbol?: string;
  triggerNotification: (message: string, type?: "success" | "error" | "info") => void;
}

export function DeliveryManagementView({ adminPin, salesPin = "", panelRole = "admin", storeId, transactions = [], contacts = [], currencySymbol = "৳", triggerNotification }: Props) {
  const cacheKey = deliveryStorageKey("cache", `${storeId}:${panelRole}`);
  const offlineQueueKey = deliveryStorageKey("queue", `${storeId}:${panelRole}`);
  const invoiceLookupCacheKey = deliveryStorageKey("cache", `${storeId}:${panelRole}:invoice-lookups`);
  const [cachedData] = useState(() => readDeliveryLocal<{ staff: Driver[]; assignments: Assignment[]; queueItems: any[]; expenses: DeliveryExpense[] } | null>(cacheKey, null));
  const [cacheReady, setCacheReady] = useState(() => isDeliveryCachePrimed(cacheKey, panelRole === "admin" ? ["staff", "assignments", "queueItems", "expenses"] : ["staff", "assignments", "queueItems"]));
  const [tab, setTab] = useState<"home" | "staff" | "assignments" | "expenses" | "payments">("home");
  const [staff, setStaff] = useState<Driver[]>(() => cachedData?.staff || []);
  const [assignments, setAssignments] = useState<Assignment[]>(() => cachedData?.assignments || []);
  const [queueItems, setQueueItems] = useState<Array<{id:string; invoice_no:string; customer_name:string; customer_phone:string; customer_address:string; items?:Array<{name:string;quantity:number}>; total_amount?:number; queued_at:string}>>(() => cachedData?.queueItems || []);
  const [expenses, setExpenses] = useState<DeliveryExpense[]>(() => cachedData?.expenses || []);
  const [pendingOperations, setPendingOperations] = useState<DeliveryOfflineOperation[]>(() => readDeliveryLocal(offlineQueueKey, []));
  const pendingOperationsRef = useRef<DeliveryOfflineOperation[]>(pendingOperations);
  const syncingOfflineQueueRef = useRef(false);
  const [offlineNotice, setOfflineNotice] = useState(pendingOperations.length > 0);
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
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editDriverUid, setEditDriverUid] = useState("");
  const [savingAssignmentEdit, setSavingAssignmentEdit] = useState(false);
  const [driverUid, setDriverUid] = useState("");
  const [assignmentView, setAssignmentView] = useState<"assigned" | "delivered">("assigned");
  const [expenseView, setExpenseView] = useState<"unpaid" | "paid">("unpaid");
  const [paymentView, setPaymentView] = useState<"unpaid" | "paid">("unpaid");
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, { fee: string; status: "paid" | "unpaid"; timing: "advance" | "after_delivery"; bearer: "showroom" | "customer" }>>({});
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  type DateRangeFilter = "all" | "today" | "yesterday" | "weekly" | "monthly" | "yearly" | "custom";
  const [expenseDateFilter, setExpenseDateFilter] = useState<DateRangeFilter>("all");
  const [paymentDateFilter, setPaymentDateFilter] = useState<DateRangeFilter>("monthly");
  const [expenseCustomStart, setExpenseCustomStart] = useState(new Date().toISOString().slice(0, 10));
  const [expenseCustomEnd, setExpenseCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const [paymentCustomStart, setPaymentCustomStart] = useState(new Date().toISOString().slice(0, 10));
  const [paymentCustomEnd, setPaymentCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const notifyRef = React.useRef(triggerNotification);
  notifyRef.current = triggerNotification;
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;
  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;

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
    writeDeliveryCacheSnapshot(cacheKey, { staff, assignments, queueItems, expenses });
  }, [cacheKey, staff, assignments, queueItems, expenses]);

  const queueOfflineOperation = useCallback((path: string, body: Record<string, any>) => {
    const operation = createDeliveryOfflineOperation(path, body);
    const next = [...pendingOperationsRef.current, operation];
    pendingOperationsRef.current = next;
    writeDeliveryLocal(offlineQueueKey, next);
    setPendingOperations(next);
    setOfflineNotice(true);
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
          // Never discard a queued operation automatically. A 404/409 can mean
          // another device changed the record; keep it visible for safe review.
          if (!isRetryableDeliveryError(error)) notifyRef.current("A saved delivery change is still pending and needs review before sync: " + String((error as any)?.message || error), "error");
          break;
        }
      }
      if (hadPendingOperations && pendingOperationsRef.current.length === 0) {
        try {
          const results = await Promise.allSettled([
            request("/api/delivery/staff/list", {}),
            request("/api/delivery/assignments/admin-list", {}),
            request("/api/delivery/queue/list", {}),
            panelRole === "admin" ? request("/api/delivery/expenses/admin-list", { payment_status: "" }) : Promise.resolve({ expenses: [] })
          ]);
          if (results[0].status === "fulfilled" && Array.isArray(results[0].value.staff)) { writeDeliveryCacheSection(cacheKey, "staff", results[0].value.staff); setStaff(results[0].value.staff); }
          if (results[1].status === "fulfilled" && Array.isArray(results[1].value.assignments)) { writeDeliveryCacheSection(cacheKey, "assignments", results[1].value.assignments); setAssignments(results[1].value.assignments); }
          if (results[2].status === "fulfilled" && Array.isArray(results[2].value.queue)) { writeDeliveryCacheSection(cacheKey, "queueItems", results[2].value.queue); setQueueItems(results[2].value.queue); }
          if (results[3].status === "fulfilled" && Array.isArray(results[3].value.expenses)) { writeDeliveryCacheSection(cacheKey, "expenses", results[3].value.expenses); setExpenses(results[3].value.expenses); }
          setOfflineNotice(results.some(result => result.status === "rejected"));
          setCacheReady(isDeliveryCachePrimed(cacheKey, panelRole === "admin" ? ["staff", "assignments", "queueItems", "expenses"] : ["staff", "assignments", "queueItems"]));
        } catch (_) {
          setOfflineNotice(true);
        }
      }
    } finally {
      syncingOfflineQueueRef.current = false;
    }
  }, [request, panelRole, offlineQueueKey, cacheKey]);

  useEffect(() => {
    const retry = () => { void flushOfflineQueue(); };
    window.addEventListener("online", retry);
    const timer = window.setInterval(() => {
      if (pendingOperationsRef.current.length) retry();
    }, 30000);
    return () => { window.removeEventListener("online", retry); window.clearInterval(timer); };
  }, [flushOfflineQueue]);

  const lastLoadStartedAtRef = useRef(0);
  const loadAllInFlightRef = useRef(false);
  const queuedForcedRefreshRef = useRef(false);
  const loadAll = useCallback(async (force = false) => {
    if ((panelRole === "admin" && !adminPin) || (panelRole === "sales" && !salesPin) || !storeId) return;
    const now = Date.now();
    if (loadAllInFlightRef.current) {
      if (force) queuedForcedRefreshRef.current = true;
      return;
    }
    // Focus and visibility events often fire together on mobile. Avoid issuing
    // the same four admin list queries twice during one foreground transition.
    if (!force && now - lastLoadStartedAtRef.current < 5000) return;
    loadAllInFlightRef.current = true;
    lastLoadStartedAtRef.current = now;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        request("/api/delivery/staff/list", {}),
        request("/api/delivery/assignments/admin-list", {}),
        request("/api/delivery/queue/list", {}),
        panelRole === "admin" ? request("/api/delivery/expenses/admin-list", { payment_status: "" }) : Promise.resolve({ expenses: [] })
      ]);
      if (pendingOperationsRef.current.length) {
        // Keep optimistic local records visible until queued changes are reconciled.
        void flushOfflineQueue();
      } else {
        // Load each panel independently. One quota-limited endpoint must not hide
        // successful staff/assignment data or blank out the last saved expense/payment data.
        const staffResult = results[0];
        const assignmentResult = results[1];
        const queueResult = results[2];
        const expenseResult = results[3];
        if (staffResult.status === "fulfilled" && Array.isArray(staffResult.value.staff)) {
          writeDeliveryCacheSection(cacheKey, "staff", staffResult.value.staff);
          setStaff(staffResult.value.staff);
          setDriverUid(prev => prev || staffResult.value.staff.find((x: Driver) => x.status === "active")?.uid || "");
        }
        if (assignmentResult.status === "fulfilled" && Array.isArray(assignmentResult.value.assignments)) {
          writeDeliveryCacheSection(cacheKey, "assignments", assignmentResult.value.assignments);
          setAssignments(assignmentResult.value.assignments);
        }
        if (queueResult.status === "fulfilled" && Array.isArray(queueResult.value.queue)) {
          writeDeliveryCacheSection(cacheKey, "queueItems", queueResult.value.queue);
          setQueueItems(queueResult.value.queue);
        }
        if (expenseResult.status === "fulfilled" && Array.isArray(expenseResult.value.expenses)) {
          writeDeliveryCacheSection(cacheKey, "expenses", expenseResult.value.expenses);
          setExpenses(expenseResult.value.expenses);
        }
        const hasFailures = results.some(result => result.status === "rejected");
        setOfflineNotice(hasFailures);
        setCacheReady(isDeliveryCachePrimed(cacheKey, panelRole === "admin" ? ["staff", "assignments", "queueItems", "expenses"] : ["staff", "assignments", "queueItems"]));
        if (hasFailures && !cachedData) {
          const failedNames = results.map((result, index) => result.status === "rejected" ? ["staff", "invoice assignments", "delivery queue", "expenses/payments"][index] : "").filter(Boolean);
          notifyRef.current("Some Delivery Management data could not be refreshed (" + failedNames.join(", ") + "). Any previously saved local records remain visible.", "info");
        }
      }
    } catch (error: any) {
      setOfflineNotice(true);
      notifyRef.current(error?.message || "Could not load delivery management data. Previously saved local records are being kept.", "info");
    } finally {
      loadAllInFlightRef.current = false;
      setLoading(false);
      if (queuedForcedRefreshRef.current) {
        queuedForcedRefreshRef.current = false;
        void loadAll(true);
      }
    }
  }, [adminPin, salesPin, storeId, request, panelRole, flushOfflineQueue, cachedData, cacheKey]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Devices that previously hit a quota/network limit retry the cached view at a
  // low frequency. A focus/visibility refresh also picks up changes synced by
  // another device without adding an always-on Firestore listener.
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadAll();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const timer = window.setInterval(() => {
      if (offlineNotice && pendingOperationsRef.current.length === 0) void loadAll();
    }, 120000);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(timer);
    };
  }, [loadAll, offlineNotice]);

  // Clean only orphan assignments after verifying that the invoice no longer exists in this store.
  useEffect(() => {
    if (panelRole !== "admin" || tab !== "assignments") return;
    let cancelled = false;
    request("/api/delivery/assignments/cleanup-orphans", {})
      .then((result: any) => { if (!cancelled && Number(result.deleted || 0) > 0) loadAll(true); })
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
        if (!cancelled) {
          const cachedLookups = readDeliveryLocal<Record<string, any>>(invoiceLookupCacheKey, {});
          cachedLookups[value] = { invoice: result.invoice, already_assigned: Boolean(result.already_assigned), assigned_driver: result.assigned_driver || "", savedAt: new Date().toISOString() };
          writeDeliveryLocal(invoiceLookupCacheKey, cachedLookups);
          setInvoiceLookup({ status: "found", invoice: result.invoice, already_assigned: Boolean(result.already_assigned), assigned_driver: result.assigned_driver || "" });
        }
      } catch (error: any) {
        if (cancelled) return;
        const message = String(error?.message || "Could not search invoice.");
        if (isRetryableDeliveryError(error)) {
          const cached = readDeliveryLocal<Record<string, any>>(invoiceLookupCacheKey, {})[value];
          if (cached?.invoice) {
            setOfflineNotice(true);
            setInvoiceLookup({ status: "found", invoice: cached.invoice, already_assigned: Boolean(cached.already_assigned), assigned_driver: cached.assigned_driver || "" });
            return;
          }
          // Sales invoices and customer profiles are already cached locally by the
          // core POS. Use that same business-scoped data to prepare an offline
          // assignment; the server still validates the invoice before syncing it.
          const localTransaction = transactionsRef.current.find((item: any) => String(item?.invoiceNo || item?.invoice_no || "").trim() === value);
          if (localTransaction) {
            const contactId = String(localTransaction.contactId || localTransaction.contact_id || "");
            const localCustomer = contactsRef.current.find((item: any) => String(item?.id || "") === contactId && item?.type === "customer");
            const localInvoice = {
              invoice_no: value,
              customer_name: String(localCustomer?.name || localTransaction.customer_name || localTransaction.customerName || "Customer"),
              customer_phone: String(localCustomer?.phone || localTransaction.customer_phone || localTransaction.customerPhone || ""),
              customer_address: String(localCustomer?.address || localTransaction.customer_address || localTransaction.customerAddress || ""),
              total_amount: Number(localTransaction.total || localTransaction.totalAmount || 0),
              items: Array.isArray(localTransaction.items) ? localTransaction.items.map((item: any) => ({ name: String(item?.name || item?.productName || "Item"), quantity: Number(item?.quantity) || 0 })) : []
            };
            setOfflineNotice(true);
            setInvoiceLookup({ status: "found", invoice: localInvoice, already_assigned: false });
            return;
          }
        }
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
    if (invoiceLookup.status !== "found" || !invoiceSelected || invoiceLookup.already_assigned || assignments.some(item => String(item.invoice_no) === invoiceNo.trim())) {
      notifyRef.current(invoiceLookup.already_assigned || assignments.some(item => String(item.invoice_no) === invoiceNo.trim()) ? "This invoice is already assigned." : "Search and select a valid invoice number first.", "error");
      return;
    }
    if (!driverUid) {
      notifyRef.current("Select a delivery driver first.", "error");
      return;
    }
    const assignmentBody = { invoice_no: invoiceNo.trim(), driver_uid: driverUid };
    try {
      const result = await request("/api/delivery/assignments/create", assignmentBody);
      setAssignments(prev => [result.assignment, ...prev.filter(x => x.id !== result.assignment.id)]);
      setInvoiceNo("");
      setInvoiceLookup({ status: "idle" });
      setInvoiceSelected(false);
      notifyRef.current("Invoice assigned to delivery staff.", "success");
    } catch (error: any) {
      if (isRetryableDeliveryError(error) && invoiceLookup.invoice) {
        const selectedDriver = staff.find(x => x.uid === driverUid);
        const localId = "local-" + createDeliveryOfflineOperation("local", {}).id;
        const invoice = invoiceLookup.invoice;
        queueOfflineOperation("/api/delivery/assignments/create", assignmentBody);
        const localAssignment: Assignment = {
          id: localId,
          invoice_no: assignmentBody.invoice_no,
          driver_uid: driverUid,
          driver_name: selectedDriver?.name || "Delivery Staff",
          customer_name: String(invoice.customer_name || "Customer"),
          customer_phone: String(invoice.customer_phone || ""),
          customer_address: String(invoice.customer_address || ""),
          customer_note: String(invoice.customer_note || ""),
          delivery_note: "",
          delivery_status: "assigned",
          assigned_at: new Date().toISOString(),
          delivery_fee: 0,
          payment_status: "unpaid",
          payment_timing: "after_delivery",
          items: Array.isArray(invoice.items) ? invoice.items : []
        };
        setAssignments(prev => [localAssignment, ...prev.filter(x => x.invoice_no !== assignmentBody.invoice_no)]);
        setInvoiceNo("");
        setInvoiceLookup({ status: "idle" });
        setInvoiceSelected(false);
        setOfflineNotice(true);
        notifyRef.current("Invoice assignment saved on this device. It will sync when Firebase access returns.", "info");
      } else notifyRef.current(error?.message || "Could not assign invoice.", "error");
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

  const saveAssignmentEdit = async () => {
    if (panelRole !== "admin" || !editingAssignment || !editDriverUid || savingAssignmentEdit) return;
    const driver = activeDrivers.find(item => item.uid === editDriverUid);
    if (!driver) { notifyRef.current("Select an active delivery staff member.", "error"); return; }
    setSavingAssignmentEdit(true);
    try {
      await request("/api/delivery/assignments/admin-update-driver", { assignment_id: editingAssignment.id, driver_uid: driver.uid });
      setAssignments(prev => prev.map(item => item.id === editingAssignment.id ? { ...item, driver_uid: driver.uid, driver_name: driver.name } : item));
      setEditingAssignment(null);
      notifyRef.current("Invoice assignment updated to " + driver.name + ".", "success");
      void loadAll(true);
    } catch (error: any) { notifyRef.current(error?.message || "Could not update invoice assignment.", "error"); }
    finally { setSavingAssignmentEdit(false); }
  };

  const deleteInvoicePayment = async (assignment: Assignment) => {
    if (panelRole !== "admin" || assignment.id.startsWith("local-")) return;
    if (!window.confirm("Delete this invoice delivery payment entry? The invoice assignment and delivery history will remain, but the payment will be reset to Unpaid and its linked expense will be removed from profit calculations.")) return;
    try {
      await request("/api/delivery/assignments/payment-delete", { assignment_id: assignment.id });
      setAssignments(prev => prev.map(item => item.id === assignment.id ? { ...item, delivery_fee: 0, payment_status: "unpaid", payment_timing: "after_delivery", payment_updated_at: new Date().toISOString(), payment_received_at: "" } : item));
      setPaymentDrafts(prev => { const next = { ...prev }; delete next[assignment.id]; return next; });
      notifyRef.current("Invoice delivery payment entry deleted.", "success");
      void loadAll(true);
    } catch (error: any) { notifyRef.current(error?.message || "Could not delete invoice payment entry.", "error"); }
  };

  const deleteStaffExpensePayment = async (expense: DeliveryExpense) => {
    if (panelRole !== "admin") return;
    if (!window.confirm("Delete this staff expense/payment record permanently? This removes the request from Delivery Payments and expense history.")) return;
    try {
      await request("/api/delivery/expenses/admin-delete", { expense_id: expense.id });
      setExpenses(prev => prev.filter(item => item.id !== expense.id));
      notifyRef.current("Staff expense/payment record deleted.", "success");
    } catch (error: any) { notifyRef.current(error?.message || "Could not delete staff expense/payment record.", "error"); }
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
    timing: assignment.payment_timing === "advance" ? "advance" as const : "after_delivery" as const,
    bearer: assignment.delivery_charge_bearer === "customer" ? "customer" as const : "showroom" as const
  };

  const updateAssignmentPayment = async (assignment: Assignment) => {
    if (panelRole !== "admin") return;
    if (assignment.id.startsWith("local-")) {
      notifyRef.current("This invoice assignment is still waiting for cloud sync. Payment can be saved after the assignment receives its cloud ID.", "info");
      return;
    }
    const draft = getPaymentDraft(assignment);
    const fee = Number(draft.fee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 1000000) { notifyRef.current("Enter a valid payment amount.", "error"); return; }
    try {
      await request("/api/delivery/assignments/payment", {
        assignment_id: assignment.id, delivery_fee: fee,
        payment_status: draft.status, payment_timing: draft.timing, delivery_charge_bearer: draft.bearer
      });
      await loadAll(true);
      setPaymentDrafts(prev => { const next = { ...prev }; delete next[assignment.id]; return next; });
      setEditingPaymentId(null);
      notifyRef.current("Delivery payment updated.", "success");
    } catch (error: any) {
      if (isRetryableDeliveryError(error)) {
        const now = new Date().toISOString();
        const body = { assignment_id: assignment.id, delivery_fee: fee, payment_status: draft.status, payment_timing: draft.timing, delivery_charge_bearer: draft.bearer };
        queueOfflineOperation("/api/delivery/assignments/payment", body);
        setAssignments(prev => prev.map(item => item.id === assignment.id ? { ...item, delivery_fee: fee, payment_status: draft.status, payment_timing: draft.timing, delivery_charge_bearer: draft.bearer, payment_updated_at: now, payment_received_at: draft.status === "paid" ? (item.payment_received_at || now) : "" } : item));
        setPaymentDrafts(prev => { const next = { ...prev }; delete next[assignment.id]; return next; });
        setEditingPaymentId(null);
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
  // One central payment desk: invoice delivery fees and staff expense reimbursements.
  const filteredPaymentExpenses = expenses.filter(expense =>
    (expense.payment_status === "paid" ? "paid" : "unpaid") === paymentView &&
    isDateInRange(
      paymentView === "paid" ? (expense.payment_date || expense.paid_at || expense.reviewed_at || expense.date) : expense.date,
      paymentDateFilter, paymentCustomStart, paymentCustomEnd
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
        <button onClick={() => loadAll(true)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      {cacheReady && <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Device cache ready · {panelRole === "admin" ? "Staff, assignments, queue and expenses/payments saved" : "Staff, assignments and queue saved"}</div>}

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
            <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{person.name}</p><p className="truncate text-[11px] text-slate-400">{person.email} {person.phone ? "· " + person.phone : ""}</p><span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[9px] font-black ${person.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{person.status === "active" ? "ACTIVE" : "ON HOLD"}</span><p className="mt-1 text-[10px] text-slate-400">Expense payment: <span className="text-rose-300">{expenses.filter(x => (x.driver_uid ? x.driver_uid === person.uid : x.driver_name === person.name) && x.payment_status !== "paid").length} Pending</span> · <span className="text-emerald-300">{expenses.filter(x => (x.driver_uid ? x.driver_uid === person.uid : x.driver_name === person.name) && x.payment_status === "paid").length} Paid</span></p></div>
            {panelRole === "admin" && <div className="flex flex-wrap gap-2"><button onClick={() => toggleStaff(person)} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-black ${person.status === "active" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>{person.status === "active" ? <><PauseCircle className="h-3 w-3" /> Hold</> : <><PlayCircle className="h-3 w-3" /> Unhold</>}</button><button onClick={() => deleteStaff(person)} className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-2 text-[10px] font-black text-rose-300"><Trash2 className="h-3 w-3" /> Delete</button></div>}
          </div>)}
        </div>
      </div>}

      {tab === "payments" && panelRole === "admin" && <div className="space-y-3">
        {renderDateRangeFilter("delivery-payment-date-range", paymentDateFilter, setPaymentDateFilter, paymentCustomStart, setPaymentCustomStart, paymentCustomEnd, setPaymentCustomEnd)}
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1.5">
          <button type="button" onClick={() => setPaymentView("unpaid")} className={`rounded-xl px-3 py-3 text-xs font-black ${paymentView === "unpaid" ? "bg-rose-500/15 text-rose-300" : "text-slate-400"}`}>Unpaid ({assignments.filter(a => a.payment_status !== "paid").length + expenses.filter(e => e.payment_status !== "paid").length})</button>
          <button type="button" onClick={() => setPaymentView("paid")} className={`rounded-xl px-3 py-3 text-xs font-black ${paymentView === "paid" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>Paid ({assignments.filter(a => a.payment_status === "paid").length + expenses.filter(e => e.payment_status === "paid").length})</button>
        </div>
        <h3 className="pt-2 text-sm font-black text-white">Invoice Delivery Payments</h3>
        {filteredDeliveryPayments.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No {paymentView} delivery payments found for this date range.</p> : filteredDeliveryPayments.map(a => {
          const draft = getPaymentDraft(a);
          return <div key={a.id} className={`space-y-3 rounded-xl border p-4 transition-colors ${a.payment_status === "paid" ? "border-emerald-400/50 bg-emerald-500/[0.08] shadow-[inset_3px_0_0_rgba(52,211,153,0.85)]" : "border-rose-500/30 bg-rose-500/[0.045]"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-black text-white">Invoice #{a.invoice_no}</p><p className="mt-1 text-xs text-slate-200"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Customer</span> · {a.customer_name || "Customer"}</p><p className="mt-1 text-xs text-sky-200"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Delivery Staff</span> · {a.driver_name || "—"}</p><p className={`mt-1 text-[10px] font-black ${a.delivery_status === "delivered" ? "text-emerald-300" : "text-amber-300"}`}>Delivery Status: {a.delivery_status === "delivered" ? "Delivered" : "Not delivered yet"}</p><p className="mt-1 text-[10px] text-slate-500">Invoice Total · {currencySymbol}{Number(a.total_amount || 0).toLocaleString("en-BD")} · Assigned {a.assigned_at ? new Date(a.assigned_at).toLocaleString("en-BD") : "—"}</p>{a.customer_note && <p className="mt-1 text-[10px] text-slate-400">Customer Note: {a.customer_note}</p>}{a.delivery_note && <p className="mt-1 text-[10px] text-slate-400">Delivery Note: {a.delivery_note}</p>}</div><span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${a.payment_status === "paid" ? "bg-emerald-400 text-emerald-950" : "bg-rose-500 text-white"}`}>{a.payment_status === "paid" ? "Paid" : "Unpaid"}</span></div>
            {Array.isArray(a.items) && a.items.length > 0 && <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Purchased Products</p><div className="space-y-1.5">{a.items.map((item, index) => <div key={index} className="flex items-start justify-between gap-3 text-xs"><span className="min-w-0 text-slate-200">{item.name}</span><span className="shrink-0 text-right font-bold text-sky-200">× {item.quantity}{item.total ? <span className="ml-2 text-slate-400">{currencySymbol}{Number(item.total).toLocaleString("en-BD")}</span> : null}</span></div>)}</div></div>}
            {a.payment_status === "paid" && editingPaymentId !== a.id ? (
              <div className="grid gap-2 rounded-xl border border-emerald-400/20 bg-emerald-950/20 p-3 sm:grid-cols-4">
                <div><p className="text-[10px] font-bold text-slate-500">Delivery Charge</p><p className="mt-1 text-sm font-black text-emerald-200">{currencySymbol}{Number(a.delivery_fee || 0).toLocaleString("en-BD")}</p></div>
                <div><p className="text-[10px] font-bold text-slate-500">Payment Status</p><p className="mt-1 text-sm font-black text-emerald-300">Paid · Received</p></div>
                <div><p className="text-[10px] font-bold text-slate-500">Paid</p><p className="mt-1 text-sm font-semibold text-slate-200">{a.payment_timing === "advance" ? "Advance" : "After delivery"}</p></div>
                <div><p className="text-[10px] font-bold text-slate-500">Charge Bearer</p><p className="mt-1 text-sm font-black text-emerald-200">{a.delivery_charge_bearer === "customer" ? "Customer" : "Showroom"}</p></div>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-[10px] font-bold text-slate-400">Delivery payment ({currencySymbol})<input type="number" min="0" step="0.01" value={draft.fee} onChange={e => setPaymentDrafts(prev => ({ ...prev, [a.id]: { ...draft, fee: e.target.value } }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white" /></label>
                <label className="text-[10px] font-bold text-slate-400">Payment status<select value={draft.status} onChange={e => setPaymentDrafts(prev => ({ ...prev, [a.id]: { ...draft, status: e.target.value as "paid" | "unpaid" } }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"><option value="unpaid">Unpaid · Due</option><option value="paid">Paid · Received</option></select></label>
                <label className="text-[10px] font-bold text-slate-400">When paid?<select value={draft.timing} onChange={e => setPaymentDrafts(prev => ({ ...prev, [a.id]: { ...draft, timing: e.target.value as "advance" | "after_delivery" } }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"><option value="advance">Advance payment</option><option value="after_delivery">After delivery</option></select></label>
                <label className="text-[10px] font-bold text-slate-400">Who bears delivery charge?<select value={draft.bearer} onChange={e => setPaymentDrafts(prev => ({ ...prev, [a.id]: { ...draft, bearer: e.target.value as "showroom" | "customer" } }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"><option value="showroom">Showroom</option><option value="customer">Customer</option></select></label>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(a.payment_status !== "paid" || editingPaymentId === a.id) && <button onClick={() => updateAssignmentPayment(a)} className="rounded-lg bg-emerald-500 px-4 py-2.5 text-[10px] font-black text-slate-950">Save Payment Details</button>}
              {a.payment_status === "paid" && editingPaymentId !== a.id && <button type="button" onClick={() => { setPaymentDrafts(prev => ({ ...prev, [a.id]: { fee: String(a.delivery_fee || 0), status: "paid", timing: a.payment_timing === "advance" ? "advance" : "after_delivery", bearer: a.delivery_charge_bearer === "customer" ? "customer" : "showroom" } })); setEditingPaymentId(a.id); }} className="inline-flex items-center gap-1 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2.5 text-[10px] font-black text-sky-200"><Edit3 className="h-3 w-3" /> Edit</button>}
              {a.payment_status === "paid" && editingPaymentId === a.id && <button type="button" onClick={() => { setEditingPaymentId(null); setPaymentDrafts(prev => { const next = { ...prev }; delete next[a.id]; return next; }); }} className="rounded-lg border border-slate-700 px-3 py-2.5 text-[10px] font-bold text-slate-300">Cancel Edit</button>}
              <button type="button" onClick={() => deleteInvoicePayment(a)} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[10px] font-black text-rose-300"><Trash2 className="h-3 w-3" /> Delete Payment</button>
            </div>
          </div>;
        })}
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-black text-white">Staff Expense Payments</h3>
          {filteredPaymentExpenses.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">No {paymentView} staff expense payments for this date range.</p> : filteredPaymentExpenses.map(expense => <div key={`expense-${expense.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div><p className="text-sm font-black text-white">Staff Expense · {currencySymbol}{Number(expense.amount || 0).toLocaleString("en-BD")}</p><p className="mt-1 text-[11px] text-slate-300">{expense.driver_name} · {expense.reason}</p><p className="mt-1 text-[10px] text-slate-500">{expense.category} · Submitted {expense.date}{expense.assignment_id ? " · Linked delivery" : " · General expense"}</p>{expense.paid_at && <p className="mt-1 text-[10px] text-emerald-300">Paid {new Date(expense.paid_at).toLocaleString("en-BD")}</p>}</div>
            <div className="flex flex-wrap gap-2"><button onClick={() => updateExpense(expense)} className={`rounded-lg px-3 py-2 text-[10px] font-black ${expense.payment_status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{expense.payment_status === "paid" ? "Paid · Mark Unpaid" : "Pending · Mark Paid"}</button><button type="button" onClick={() => deleteStaffExpensePayment(expense)} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] font-black text-rose-300"><Trash2 className="h-3 w-3" /> Delete</button></div>
          </div>)}
        </div>
      </div>}

      {tab === "assignments" && <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1.5">
          <button type="button" onClick={() => setAssignmentView("assigned")} className={`rounded-xl px-3 py-3 text-xs font-black ${assignmentView === "assigned" ? "bg-amber-500/15 text-amber-300" : "text-slate-400"}`}>Assigned ({assignments.filter(x => x.delivery_status !== "delivered").length})</button>
          <button type="button" onClick={() => setAssignmentView("delivered")} className={`rounded-xl px-3 py-3 text-xs font-black ${assignmentView === "delivered" ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400"}`}>Delivered ({assignments.filter(x => x.delivery_status === "delivered").length})</button>
        </div>
        {assignmentView === "assigned" ? <>
          <div className="space-y-2">{assignments.filter(x => x.delivery_status !== "delivered").length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No assigned invoices right now.</p> : assignments.filter(x => x.delivery_status !== "delivered").map(item => <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-white">Invoice {item.invoice_no}</p><span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-black capitalize text-amber-300">{item.delivery_status || "assigned"}</span></div>
            <div className="mt-2 grid gap-1 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs"><p><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Customer</span><span className="ml-2 font-semibold text-white">{item.customer_name || "Customer"}</span></p><p><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Delivery Staff</span><span className="ml-2 font-semibold text-sky-200">{item.driver_name || "—"}</span></p></div>
            {Array.isArray(item.items) && item.items.length > 0 && <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/45 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Purchased Products</p><div className="space-y-1.5">{item.items.map((product, index) => <div key={index} className="flex items-start justify-between gap-3 text-xs"><span className="min-w-0 text-slate-200">{product.name}</span><span className="shrink-0 text-right font-bold text-sky-200">× {product.quantity}{product.total ? <span className="ml-2 text-slate-400">{currencySymbol}{Number(product.total).toLocaleString("en-BD")}</span> : null}</span></div>)}</div></div>}
            {panelRole === "admin" && <div className="mt-3 flex justify-end"><button type="button" onClick={() => { setEditingAssignment(item); setEditDriverUid(item.driver_uid); }} className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[10px] font-black text-sky-300">Edit Assignment</button></div>}
            <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{item.customer_address || "No customer address saved"}</p>
            <p className="mt-2 text-[10px] text-slate-400">Delivery: <span className={item.delivery_status === "delivered" ? "text-emerald-300" : "text-amber-300"}>{item.delivery_status === "delivered" ? "Delivered" : "Not delivered"}</span> · Driver payment: <span className={item.payment_status === "paid" ? "text-emerald-300" : "text-rose-300"}>{item.payment_status === "paid" ? "Paid" : "Unpaid"}</span></p>
            {panelRole === "admin" && <div className="mt-3 flex justify-end"><button type="button" disabled={deletingAssignmentNo === String(item.invoice_no)} onClick={() => deleteInvoiceAssignment(String(item.invoice_no))} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] font-black text-rose-300 disabled:opacity-50"><Trash2 className="h-3 w-3" />{deletingAssignmentNo === String(item.invoice_no) ? "Deleting…" : "Delete Invoice"}</button></div>}
          </div>)}</div>
        </> : <div className="space-y-2">
          {assignments.filter(x => x.delivery_status === "delivered").length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">No delivered invoices yet.</p> : assignments.filter(x => x.delivery_status === "delivered").map(item => <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-white">Invoice {item.invoice_no}</p><span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-300">Delivered</span></div>
            <div className="mt-2 grid gap-1 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-xs"><p><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Customer</span><span className="ml-2 font-semibold text-white">{item.customer_name || "Customer"}</span></p><p><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Delivery Staff</span><span className="ml-2 font-semibold text-sky-200">{item.driver_name || "—"}</span></p></div>
            {Array.isArray(item.items) && item.items.length > 0 && <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/45 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Purchased Products</p><div className="space-y-1.5">{item.items.map((product, index) => <div key={index} className="flex items-start justify-between gap-3 text-xs"><span className="min-w-0 text-slate-200">{product.name}</span><span className="shrink-0 font-bold text-sky-200">× {product.quantity}</span></div>)}</div></div>}
            {panelRole === "admin" && <div className="mt-3 flex justify-end"><button type="button" onClick={() => { setEditingAssignment(item); setEditDriverUid(item.driver_uid); }} className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[10px] font-black text-sky-300">Edit Assignment</button></div>}
            <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{item.customer_address || "No customer address saved"}</p>
            {panelRole === "admin" && <div className="mt-3 flex justify-end"><button type="button" disabled={deletingAssignmentNo === String(item.invoice_no)} onClick={() => deleteInvoiceAssignment(String(item.invoice_no))} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] font-black text-rose-300 disabled:opacity-50"><Trash2 className="h-3 w-3" />{deletingAssignmentNo === String(item.invoice_no) ? "Deleting…" : "Delete Invoice"}</button></div>}
          </div>)}
        </div>}
      </div>}

      {editingAssignment && panelRole === "admin" && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Edit invoice assignment">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
          <div><h3 className="text-base font-black text-white">Edit Invoice Assignment</h3><p className="mt-1 text-xs text-slate-400">Invoice {editingAssignment.invoice_no} · {editingAssignment.customer_name}</p></div>
          <label className="block space-y-1.5 text-xs font-bold text-slate-300">Assign to Delivery Staff
            <select value={editDriverUid} onChange={e => setEditDriverUid(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white"><option value="">Select active delivery staff</option>{activeDrivers.map(person => <option key={person.uid} value={person.uid}>{person.name} · {person.email}</option>)}</select>
          </label>
          <p className="text-[10px] leading-relaxed text-slate-500">The invoice, delivery progress and payment history will remain unchanged. Only the assigned delivery staff member will be changed.</p>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingAssignment(null)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300">Cancel</button><button type="button" disabled={!editDriverUid || savingAssignmentEdit} onClick={saveAssignmentEdit} className="rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50">{savingAssignmentEdit ? "Saving…" : "Save Changes"}</button></div>
        </div>
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
          <span className={`rounded-lg px-3 py-2 text-[10px] font-black ${expense.payment_status === "paid" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{expense.payment_status === "paid" ? "Paid" : "Pending · Pay in Delivery Payments"}</span>
        </div>)}
      </div>}

      <div className="flex items-center gap-2 rounded-xl border border-sky-500/15 bg-sky-500/5 p-3 text-[10px] leading-relaxed text-sky-200/80"><AlertCircle className="h-4 w-4 shrink-0" /> Delivery assignments are available to Admin and Sales. Only Admin can manage staff expenses and delivery payment status. Delivery accounts cannot access Admin, Sales, Ledger or inventory collections.</div>
    </div>
  );
}
