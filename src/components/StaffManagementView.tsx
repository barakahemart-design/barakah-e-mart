import React, { useState } from "react";
import { 
  UserCheck, 
  Users, 
  Coins, 
  FileText, 
  Plus, 
  Search, 
  Trash2, 
  Printer, 
  Edit3, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Check, 
  ChevronDown,
  Building2,
  Lock
} from "lucide-react";

export interface SalaryPayment {
  id: string;
  monthCode: string; // e.g. "2026-05" for May 2026
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
  status: "paid" | "outstanding";
}

export interface Staff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  jobTitle: string;
  salary: number;
  joinDate: string;
  status: "active" | "inactive";
  notes?: string;
  salaryPayments?: SalaryPayment[];
}

interface StaffManagementViewProps {
  staffList: Staff[];
  onAddStaff: (staff: Omit<Staff, "id" | "salaryPayments">) => void;
  onUpdateStaff: (staff: Staff) => void;
  onDeleteStaff: (id: string, name: string) => void;
  currencySymbol: string;
  businessInfo: any;
  triggerNotification: (msg: string, type?: "success" | "error" | "info") => void;
}

export function StaffManagementView({
  staffList,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  currencySymbol = "৳",
  businessInfo,
  triggerNotification
}: StaffManagementViewProps) {
  // Navigation tabs within Staff Management
  const [activeSubTab, setActiveSubTab] = useState<"payroll" | "directory">("payroll");

  // Selection for payment ledger month (default to current month May 2026 "2026-05")
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-05");

  // Filter queries
  const [dirSearch, setDirSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");

  // Staff member Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffJobTitle, setStaffJobTitle] = useState("");
  const [staffSalary, setStaffSalary] = useState("");
  const [staffJoinDate, setStaffJoinDate] = useState("2026-05-01");
  const [staffNotes, setStaffNotes] = useState("");

  // Editing staff
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editSalary, setEditSalary] = useState("");
  const [editJoinDate, setEditJoinDate] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [editNotes, setEditNotes] = useState("");

  // Pay Salary modal states
  const [payingStaff, setPayingStaff] = useState<Staff | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("2026-05-29");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payNotes, setPayNotes] = useState("");
  const [payStatus, setPayStatus] = useState<"paid" | "outstanding">("paid");

  // Printing state
  const [printPayslipContext, setPrintPayslipContext] = useState<{
    staff: Staff;
    payment: SalaryPayment;
  } | null>(null);

  // Generate continuous list of months for UI (last 8 months starting from 2026-05)
  const monthOptions = [
    { code: "2026-05", label: "May 2026" },
    { code: "2026-04", label: "April 2026" },
    { code: "2026-03", label: "March 2026" },
    { code: "2026-02", label: "February 2026" },
    { code: "2026-01", label: "January 2026" },
    { code: "2025-12", label: "December 2025" },
    { code: "2025-11", label: "November 2025" },
    { code: "2025-10", label: "October 2025" },
  ];

  // Helper check: Is a given month completely paid for all ACTIVE staff members?
  const getMonthPaymentStatus = (monthCode: string) => {
    const activeEmployees = staffList.filter(s => s.status === "active");
    if (activeEmployees.length === 0) return "empty";
    
    // Check if every active employee has a 'paid' entry for this month
    const allPaid = activeEmployees.every(emp => {
      const payment = (emp.salaryPayments || []).find(p => p.monthCode === monthCode);
      return payment && payment.status === "paid";
    });

    if (allPaid) return "completed";

    // Check if at least one employee has payment logged or if some payments exist
    const hasAnyLogged = activeEmployees.some(emp => {
      const payment = (emp.salaryPayments || []).find(p => p.monthCode === monthCode);
      return payment;
    });

    return hasAnyLogged ? "outstanding" : "unpaid";
  };

  // Submission handles
  const handleAddNewStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffPhone || !staffJobTitle || !staffSalary) {
      triggerNotification("Please fill in all mandatory fields.", "error");
      return;
    }
    onAddStaff({
      name: staffName,
      phone: staffPhone,
      email: staffEmail,
      jobTitle: staffJobTitle,
      salary: parseFloat(staffSalary) || 0,
      joinDate: staffJoinDate,
      status: "active",
      notes: staffNotes
    });
    
    // reset
    setStaffName("");
    setStaffPhone("");
    setStaffEmail("");
    setStaffJobTitle("");
    setStaffSalary("");
    setStaffJoinDate("2026-05-01");
    setStaffNotes("");
    setShowAddModal(false);
    triggerNotification("Staff member successfully enlisted!", "success");
  };

  const handleUpdateStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    if (!editName || !editPhone || !editJobTitle || !editSalary) {
      triggerNotification("Please fill in all mandatory fields.", "error");
      return;
    }

    onUpdateStaff({
      ...editingStaff,
      name: editName,
      phone: editPhone,
      email: editEmail,
      jobTitle: editJobTitle,
      salary: parseFloat(editSalary) || 0,
      joinDate: editJoinDate,
      status: editStatus,
      notes: editNotes
    });

    setEditingStaff(null);
    triggerNotification("Staff details updated successfully.", "success");
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingStaff) return;

    const parsedAmount = parseFloat(payAmount) || 0;
    const currentPayments = payingStaff.salaryPayments || [];
    
    // Try to update existing for same month code or generate a clean sequence
    const existingIndex = currentPayments.findIndex(p => p.monthCode === selectedMonth);
    const updatedPayments = [...currentPayments];

    if (existingIndex >= 0) {
      // Overwrite previous
      updatedPayments[existingIndex] = {
        ...updatedPayments[existingIndex],
        amount: parsedAmount,
        paymentDate: payDate,
        paymentMethod: payMethod,
        notes: payNotes,
        status: payStatus
      };
    } else {
      // Create new
      updatedPayments.push({
        id: "sal_" + Date.now(),
        monthCode: selectedMonth,
        amount: parsedAmount,
        paymentDate: payDate,
        paymentMethod: payMethod,
        notes: payNotes,
        status: payStatus
      });
    }

    onUpdateStaff({
      ...payingStaff,
      salaryPayments: updatedPayments
    });

    setPayingStaff(null);
    triggerNotification(`Salary sheet recorded for ${payingStaff.name}`, "success");
  };

  // Remove payment note reference
  const handleRemovePayment = (staff: Staff, paymentId: string) => {
    if (!window.confirm("Are you sure you want to discard this salary payment entry?")) return;
    const updatedPayments = (staff.salaryPayments || []).filter(p => p.id !== paymentId);
    onUpdateStaff({
      ...staff,
      salaryPayments: updatedPayments
    });
    triggerNotification("Salary payment details discarded.", "info");
  };

  const activeEmployees = staffList.filter(s => s.status === "active");

  // Calculate metrics for selected month
  const totalPayrollBudget = activeEmployees.reduce((sum, emp) => sum + emp.salary, 0);
  
  const paidEmployees = activeEmployees.filter(emp => {
    const payment = (emp.salaryPayments || []).find(p => p.monthCode === selectedMonth);
    return payment && payment.status === "paid";
  });

  const unpaidActiveCount = activeEmployees.length - paidEmployees.length;

  const totalPaidSumTk = activeEmployees.reduce((sum, emp) => {
    const payment = (emp.salaryPayments || []).find(p => p.monthCode === selectedMonth);
    return payment && payment.status === "paid" ? sum + payment.amount : sum;
  }, 0);

  // Filtered directory profiles
  const filteredDirectory = staffList.filter(member => {
    const query = dirSearch.toLowerCase();
    const matchesSearch = member.name.toLowerCase().includes(query) || 
                          member.phone.includes(query) || 
                          member.jobTitle.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "all" || member.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Action to trigger printing window of a compiled receipt
  const triggerPrintPayslip = (staff: Staff, payment: SalaryPayment) => {
    setPrintPayslipContext({ staff, payment });
    setTimeout(() => {
      window.print();
    }, 350);
  };

  return (
    <div className="space-y-6 text-slate-700 dark:text-slate-300 font-sans" id="staff-management-workspace">
      
      {/* -------------------- PRINT ONLY STYLES & PRINT BANNER -------------------- */}
      {printPayslipContext && (
        <div className="hidden print:block fixed inset-0 bg-white text-black p-10 z-[99999] overflow-y-auto" id="printable-payslip-canvas">
          <div className="max-w-xl mx-auto space-y-6 border border-slate-300 p-8 rounded-xl bg-white shadow-xs">
            {/* Header */}
            <div className="border-b-2 border-slate-800 pb-4 flex items-center justify-between">
              <div className="space-y-1">
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight uppercase">
                  {businessInfo.name || "BARAKAH ELECTRONICS"}
                </h1>
                <p className="text-xs text-slate-650 font-medium">
                  {businessInfo.address || "Warehouse terminal, Dhaka, Bangladesh"}
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  Hotline: {businessInfo.phoneNumber || "01700-000000"} 
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-slate-700">SALARY SLIP</div>
                <div className="text-[10px] font-mono text-slate-500 mt-1 uppercase bg-slate-100 py-1 px-2 rounded font-bold">
                  {monthOptions.find(mo => mo.code === printPayslipContext.payment.monthCode)?.label || printPayslipContext.payment.monthCode}
                </div>
              </div>
            </div>

            {/* Employee Information */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg text-xs border border-slate-200">
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">Employee Profile</span>
                <p className="font-bold text-slate-800 text-sm">{printPayslipContext.staff.name}</p>
                <p className="text-slate-605 font-medium">{printPayslipContext.staff.jobTitle}</p>
                <p className="text-slate-500 font-mono">{printPayslipContext.staff.phone}</p>
              </div>
              <div className="space-y-1 text-right">
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">Payment Details</span>
                <p className="text-slate-700">Date: <span className="font-mono font-bold">{printPayslipContext.payment.paymentDate}</span></p>
                <p className="text-slate-700">Method: <span className="font-bold">{printPayslipContext.payment.paymentMethod}</span></p>
                <p className="text-emerald-700 font-bold uppercase bg-emerald-50 px-1.5 py-0.5 rounded inline-block text-[10px] border border-emerald-200 mt-1">
                  ✓ {printPayslipContext.payment.status.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Income Sheet */}
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[10px] uppercase text-slate-450 font-bold bg-slate-100">
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-800">Basic Monthly salary rate</span>
                    <p className="text-[10px] text-slate-400">Regular base rate of payroll</p>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono">
                    {currencySymbol}{printPayslipContext.staff.salary.toLocaleString()}
                  </td>
                </tr>
                {printPayslipContext.payment.notes && (
                  <tr>
                    <td className="py-3 px-3 bg-slate-50/50">
                      <span className="font-bold text-slate-700 text-[11px]">Salary notes & custom modifications</span>
                      <p className="text-[10px] text-slate-500 italic mt-0.5">{printPayslipContext.payment.notes}</p>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-600 font-mono bg-slate-50/50">
                      Adjusted
                    </td>
                  </tr>
                )}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-extrabold text-sm text-slate-900">
                  <td className="py-3.5 px-3 uppercase tracking-tight">Total Disbursed Net Amount</td>
                  <td className="py-3.5 px-3 text-right font-mono text-base text-slate-950 font-black">
                    {currencySymbol}{printPayslipContext.payment.amount.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Footer Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-12 text-center text-xs text-slate-600">
              <div className="space-y-1.5">
                <div className="w-full border-t border-slate-400 max-w-[180px] mx-auto mt-4" />
                <p className="font-bold">Authorized Signature</p>
                <p className="text-[10px] text-slate-450 uppercase tracking-widest">Office Seal</p>
              </div>
              <div className="space-y-1.5 font-sans">
                <div className="w-full border-t border-slate-400 max-w-[180px] mx-auto mt-4" />
                <p className="font-bold">Employee Signature</p>
                <p className="text-[10px] text-slate-450 uppercase tracking-widest text-[#050912]">Acknowledgement</p>
              </div>
            </div>

            <div className="text-center text-[9px] text-slate-400 font-mono pt-8 border-t border-slate-100">
              Electronic billing payslip generated on Barakah Bill Pro on {new Date().toLocaleDateString()}.
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MAIN DISPLAY WORKSPACE SCREEN -------------------- */}
      <div className="bg-[#1E1E24]/95 border border-slate-800 rounded-3xl p-5 md:p-6 space-y-6 shadow-xl print:hidden" id="workspace-frame">
        
        {/* Banner header of Staff Module */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5" id="staff-header-row">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/10">
                <UserCheck className="w-5 h-5" />
              </div>
              <h2 className="text-base font-extrabold tracking-tight text-white font-display">Staff & Store Payroll Management</h2>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Manage shop members, customize designations, track salary payouts, and instantly print payslips.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0" id="header-action-panel">
            {/* View selectors */}
            <div className="bg-slate-950 p-1.5 rounded-xl border border-slate-850 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveSubTab("payroll")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === "payroll"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Payroll Sheet
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("directory")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === "directory"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Staff Directory
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-lg transition-all transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Enlist Staff
            </button>
          </div>
        </div>


        {/* -----------------------------------------------------------------
            SUB-TAB A: PAYROLL & SALARY DISBURSEMENT SHEET
            ----------------------------------------------------------------- */}
        {activeSubTab === "payroll" && (
          <div className="space-y-6" id="payroll-workspace-container">
            
            {/* Months status quick-check bar */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-mono tracking-widest text-slate-400 pl-1 block font-extrabold">
                Salary Calendar Quick Status Look:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2" id="months-status-timeline">
                {monthOptions.map((m) => {
                  const status = getMonthPaymentStatus(m.code);
                  const isSelected = selectedMonth === m.code;
                  return (
                    <button
                      key={m.code}
                      onClick={() => setSelectedMonth(m.code)}
                      className={`p-2 rounded-xl text-center border transition-all text-xs flex flex-col items-center justify-between gap-1.5 cursor-pointer ${
                        isSelected 
                          ? "bg-blue-600/10 border-blue-500 text-white scale-102 ring-1 ring-blue-500" 
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-250"
                      }`}
                    >
                      <span className="font-bold text-[10px] truncate w-full">{m.label.split(" ")[0]}</span>
                      <span className="text-[8px] font-mono text-slate-500">{m.label.split(" ")[1]}</span>
                      
                      {status === "completed" && (
                        <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-[10px]" title="All members paid">
                          ✓
                        </span>
                      )}
                      {status === "outstanding" && (
                        <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold text-[10px]" title="Payments pending">
                          !
                        </span>
                      )}
                      {status === "unpaid" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-700" title="No entries logged" />
                      )}
                      {status === "empty" && (
                        <span className="text-[8px] text-slate-600 font-mono">No Staff</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Month Report summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/60 border border-slate-850 p-4 rounded-2xl" id="payroll-overview-metrics">
              
              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-400 block font-bold">Selected Operational Period</span>
                <span className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  {monthOptions.find(mo => mo.code === selectedMonth)?.label || selectedMonth}
                </span>
                <span className="text-[10px] text-slate-500 block">All statuses sync into global ledger.</span>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-400 block font-bold">Total Disbursed Net Amount</span>
                <span className="text-base font-black text-emerald-400 flex items-center font-mono">
                  {currencySymbol}{totalPaidSumTk.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Out of budget basic: {currencySymbol}{totalPayrollBudget.toLocaleString()}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] uppercase tracking-wider font-mono text-slate-400 block font-bold">Disbursement Status</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${
                    unpaidActiveCount === 0 
                      ? "bg-emerald-550/10 text-emerald-400 border border-emerald-500/20" 
                      : "bg-amber-550/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    {unpaidActiveCount === 0 ? "ALL DISBURSED ✓" : `${unpaidActiveCount} PENDING`}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    ({paidEmployees.length} of {activeEmployees.length} Paid)
                  </span>
                </div>
              </div>

            </div>

            {/* List and table of payroll members */}
            <div className="space-y-3" id="payroll-members-block">
              <div className="flex items-center justify-between pl-1">
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 block font-extrabold">
                  Disbursement Payout Roster:
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Total enrollees: {activeEmployees.length} actives
                </span>
              </div>

              {activeEmployees.length === 0 ? (
                <div className="bg-slate-950/40 border border-slate-850 p-10 rounded-2xl text-center space-y-2">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-350">No active staff members enroled currently.</p>
                  <p className="text-[10px] text-slate-500 max-w-xs mx-auto">Enlist staff members in the enlisting form first to manage store payroll sheets.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-850 rounded-2xl bg-slate-950/20">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-[10px] uppercase font-bold text-slate-400 font-mono bg-slate-950/30">
                        <th className="py-3 px-4">Staff details</th>
                        <th className="py-3 px-4">Role Title</th>
                        <th className="py-3 px-4">Payroll Salary (Tk)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">Recorded Log</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-300">
                      {activeEmployees.map((emp) => {
                        const payment = (emp.salaryPayments || []).find(p => p.monthCode === selectedMonth);
                        const isPaid = payment && payment.status === "paid";
                        
                        return (
                          <tr key={emp.id} className="hover:bg-slate-900/10 transition-colors">
                            <td className="py-3.5 px-4 space-y-0.5">
                              <span className="font-extrabold text-white text-xs block">{emp.name}</span>
                              <span className="font-mono text-[10px] text-slate-400 block">{emp.phone}</span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-300">
                              {emp.jobTitle}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-extrabold text-[#60a5fa]">
                              {currencySymbol}{emp.salary.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  PAID
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-400 border border-[#b45309]/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                  OUTSTANDING
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 max-w-[180px]">
                              {payment ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                    <span className="font-bold text-white uppercase">{payment.paymentMethod}</span>
                                    <span>•</span>
                                    <span>{payment.paymentDate}</span>
                                  </div>
                                  {payment.notes && (
                                    <p className="text-[10px] text-slate-500 italic truncate" title={payment.notes}>
                                      "{payment.notes}"
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic block">No payment record.</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Recording button / edit and details */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayingStaff(emp);
                                    setPayAmount(payment ? String(payment.amount) : String(emp.salary));
                                    setPayDate(payment ? payment.paymentDate : "2026-05-29");
                                    setPayMethod(payment ? payment.paymentMethod : "Cash");
                                    setPayNotes(payment ? (payment.notes || "") : "");
                                    setPayStatus(payment ? payment.status : "paid");
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                                    isPaid
                                      ? "bg-slate-950 text-slate-400 hover:text-white border border-slate-850"
                                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-extrabold"
                                  }`}
                                >
                                  <Coins className="w-3.5 h-3.5" />
                                  {isPaid ? "Modify Salary" : "Pay Salary"}
                                </button>

                                {payment && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => triggerPrintPayslip(emp, payment)}
                                      className="p-1.5 bg-slate-950 border border-slate-850 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-all"
                                      title="Print salary pay stub payslip"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePayment(emp, payment.id)}
                                      className="p-1.5 bg-slate-950 border border-slate-850 hover:bg-rose-950 rounded-lg text-slate-400 hover:text-rose-450 cursor-pointer transition-all"
                                      title="Discard entry"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}


        {/* -----------------------------------------------------------------
            SUB-TAB B: STAFF DIRECTORY list & profile controls
            ----------------------------------------------------------------- */}
        {activeSubTab === "directory" && (
          <div className="space-y-6" id="directory-workspace">
            
            {/* Directory filter and enroller header panel */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between" id="directory-toolbar">
              <div className="relative w-full md:max-w-xs" id="dir-search-wrap">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter by name, phone or title..."
                  value={dirSearch}
                  onChange={(e) => setDirSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto select-none" id="status-toggle-options">
                <span className="text-[10px] text-slate-400 font-mono shrink-0 uppercase tracking-wider pl-1 font-bold">Filter Status:</span>
                {(["all", "active", "inactive"] as const).map(pstatus => (
                  <button
                    key={pstatus}
                    type="button"
                    onClick={() => setStatusFilter(pstatus)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase cursor-pointer transition-all ${
                      statusFilter === pstatus
                        ? "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-extrabold"
                        : "text-slate-400 hover:text-white border border-transparent"
                    }`}
                  >
                    {pstatus}
                  </button>
                ))}
              </div>
            </div>

            {/* List entries layout */}
            {filteredDirectory.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-850 p-10 rounded-2xl text-center space-y-2">
                <Users className="w-8 h-8 text-slate-650 mx-auto" />
                <p className="text-xs font-bold text-slate-350">No directory profiles match criteria.</p>
                <p className="text-[10px] text-slate-500">Add enrollees using the "Enlist Staff" button on the top shelf.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="directory-cards-grid">
                {filteredDirectory.map((member) => (
                  <div 
                    key={member.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3.5 relative overflow-hidden bg-slate-950/40 ${
                      member.status === "active" 
                        ? "border-slate-850 hover:border-slate-700" 
                        : "border-slate-900 bg-slate-950/10 opacity-70"
                    }`}
                  >
                    {/* Upper ribbon details */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <span className={`text-[9px] uppercase font-mono tracking-widest font-extrabold px-2 py-0.5 rounded-md ${
                          member.status === "active" 
                            ? "bg-emerald-500/10 text-emerald-400" 
                            : "bg-slate-900 text-slate-400"
                        }`}>
                          {member.status}
                        </span>
                        <h4 className="text-sm font-extrabold text-white pt-1">{member.name}</h4>
                        <p className="text-[11px] text-slate-350">{member.jobTitle}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-[9px] text-slate-500 block font-mono">Monthly Rate</span>
                        <span className="text-xs font-mono font-black text-[#60a5fa]">{currencySymbol}{member.salary.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Meta values */}
                    <div className="border-t border-slate-900 pt-3 space-y-1.5 text-xs text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Phone Hotline</span>
                        <span className="font-mono text-white text-[11px]">{member.phone}</span>
                      </div>
                      {member.email && (
                        <div className="flex items-center justify-between">
                          <span>Email address</span>
                          <span className="truncate max-w-[150px] font-mono hover:text-white transition-all">{member.email}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span>Joined on</span>
                        <span className="font-mono">{member.joinDate}</span>
                      </div>
                      {member.notes && (
                        <div className="border-t border-slate-900 pt-2 msg-notes">
                          <span className="text-[9px] text-slate-500 font-mono block uppercase">Private staff notes:</span>
                          <p className="text-[10px] text-slate-350 italic leading-snug">"{member.notes}"</p>
                        </div>
                      )}
                    </div>

                    {/* Operations tools */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                      <span className="text-[9px] text-slate-500 font-mono">
                        Payments logged: {(member.salaryPayments || []).length}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStaff(member);
                            setEditName(member.name);
                            setEditPhone(member.phone);
                            setEditEmail(member.email || "");
                            setEditJobTitle(member.jobTitle);
                            setEditSalary(String(member.salary));
                            setEditJoinDate(member.joinDate);
                            setEditStatus(member.status);
                            setEditNotes(member.notes || "");
                          }}
                          className="p-1 px-2 hover:bg-slate-800 rounded bg-slate-950 text-slate-400 hover:text-white text-[10px] font-bold flex items-center gap-1 border border-slate-850 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 text-blue-400" />
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Are you absolutely sure you want to delete staff profile '${member.name}' from current registry?`)) {
                              onDeleteStaff(member.id, member.name);
                              triggerNotification(`Staff member '${member.name}' profile permanently cleared.`, "success");
                            }
                          }}
                          className="p-1 hover:bg-rose-950 rounded bg-slate-950 text-slate-500 hover:text-rose-450 border border-slate-900 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </div>


      {/* -----------------------------------------------------------------
          MODAL 1: ADD NEW STAFF enroller form popup
          ----------------------------------------------------------------- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[50000] flex items-center justify-center p-4 animate-fade-in" id="add-staff-modal">
          <div className="bg-[#1E1E24] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up-bounce" id="add-staff-panel">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
              <span className="text-xs font-extrabold text-white flex items-center gap-1 text-emerald-400">
                <Users className="w-4 h-4" />
                Enlist New Store Staff Member
              </span>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-450 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewStaff} className="p-5 space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Md. Kamal Hossain"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 01700112233"
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Email Addr</label>
                  <input
                    type="email"
                    placeholder="kamal@gmail.com"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Job Title / Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sales Executive"
                    value={staffJobTitle}
                    onChange={(e) => setStaffJobTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Monthly Base Salary *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-450 text-[11px] font-mono">{currencySymbol}</span>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="e.g. 18500"
                      value={staffSalary}
                      onChange={(e) => setStaffSalary(e.target.value)}
                      className="w-full pl-6 pr-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Joining operational Date</label>
                <input
                  type="date"
                  value={staffJoinDate}
                  onChange={(e) => setStaffJoinDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Private Notes / Address / References</label>
                <textarea
                  placeholder="Insert address or performance notes..."
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 h-16 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-extrabold cursor-pointer"
                >
                  Verify & Register Member
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* -----------------------------------------------------------------
          MODAL 2: UPDATE DETAILS OF ENLISTED MEMBER
          ----------------------------------------------------------------- */}
      {editingStaff && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[50000] flex items-center justify-center p-4 animate-fade-in" id="edit-staff-modal">
          <div className="bg-[#1E1E24] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up-bounce" id="edit-staff-panel">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
              <span className="text-xs font-extrabold text-white flex items-center gap-1 text-blue-450">
                <Edit3 className="w-4 h-4 text-blue-450" />
                Update Enrolled Member Profile
              </span>
              <button 
                onClick={() => setEditingStaff(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-450 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStaffSubmit} className="p-5 space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Email Addr</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Designation *</label>
                  <input
                    type="text"
                    required
                    value={editJobTitle}
                    onChange={(e) => setEditJobTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-dense"
                  />
                </div>
                <div className="col-span-1 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as "active" | "inactive")}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Base Salary *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-450 text-[11px] font-mono">{currencySymbol}</span>
                    <input
                      type="number"
                      required
                      min="0"
                      value={editSalary}
                      onChange={(e) => setEditSalary(e.target.value)}
                      className="w-full pl-6 pr-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Enrolled Joined Date</label>
                  <input
                    type="date"
                    value={editJoinDate}
                    onChange={(e) => setEditJoinDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 font-mono">Admin Notes & Private details</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 h-16 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold cursor-pointer"
                >
                  Save Profile Updates
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* -----------------------------------------------------------------
          MODAL 3: PAY SALARY / DISBURSE STATEMENT BUILDER
          ----------------------------------------------------------------- */}
      {payingStaff && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[50000] flex items-center justify-center p-4 animate-fade-in" id="pay-salary-modal">
          <div className="bg-[#1E1E24] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up-bounce" id="pay-salary-panel">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
              <span className="text-xs font-extrabold text-white flex items-center gap-1 text-emerald-450">
                <Coins className="w-4 h-4 text-emerald-450" />
                Disburse Payout: {payingStaff.name}
              </span>
              <button 
                onClick={() => setPayingStaff(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-450 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase font-mono tracking-widest font-extrabold text-slate-500 block">Payout Period</span>
                  <span className="text-xs font-bold text-white uppercase">
                    {monthOptions.find(mo => mo.code === selectedMonth)?.label || selectedMonth}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-mono tracking-widest font-extrabold text-slate-500 block">Contracted Rate</span>
                  <span className="text-xs font-mono font-bold text-[#60a5fa]">{currencySymbol}{payingStaff.salary.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#a0a0af] font-mono">Disbursed Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-450 text-[11px] font-mono">{currencySymbol}</span>
                    <input
                      type="number"
                      required
                      min="0"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full pl-6 pr-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#a0a0af] font-mono">Disbursement Date</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#a0a0af] font-mono">Payment Channel / Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500"
                  >
                    <option value="Cash">Cash Handover</option>
                    <option value="bKash">bKash Personal / Agent</option>
                    <option value="Rocket">Rocket Mobile Banking</option>
                    <option value="Nagad">Nagad Mobile Banking</option>
                    <option value="Bank Transfer">Direct Bank Wire / Check</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#a0a0af] font-mono">Verification Status</label>
                  <select
                    value={payStatus}
                    onChange={(e) => setPayStatus(e.target.value as "paid" | "outstanding")}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500"
                  >
                    <option value="paid">PAID & Clear (Disbursed)</option>
                    <option value="outstanding">Outstanding (Pending validation)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#a0a0af] font-mono">Custom adjustments notes (Bonuses/Deductions details)</label>
                <textarea
                  placeholder="e.g. Added Eid bonus / Absent deduction etc."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white outline-none focus:border-blue-500 h-16 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPayingStaff(null)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-extrabold cursor-pointer"
                >
                  Confirm & Sync Ledger Payout
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
