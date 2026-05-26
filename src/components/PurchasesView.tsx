import React, { useState } from "react";
import { 
  PlusCircle, 
  ShoppingBag, 
  Trash2, 
  Edit3, 
  X, 
  Calendar, 
  User, 
  Package, 
  Check, 
  Clipboard, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  DollarSign, 
  FileText, 
  Plus, 
  Layers
} from "lucide-react";

interface PurchasesViewProps {
  purchases: any[];
  products: any[];
  contacts: any[];
  onAddPurchase: (purchase: {
    invoiceNo: string;
    supplierId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    date: string;
    note: string;
    updatedSellPrice?: number;
  }) => void;
  onDeletePurchase: (id: string) => void;
  onEditPurchase: (id: string, purchase: {
    invoiceNo: string;
    supplierId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    date: string;
    note: string;
  }) => void;
  onAddSupplier?: (supplier: { name: string; phone: string; address: string }) => string;
  currencySymbol: string;
}

export function PurchasesView({
  purchases,
  products,
  contacts,
  onAddPurchase,
  onDeletePurchase,
  onEditPurchase,
  onAddSupplier,
  currencySymbol = "৳"
}: PurchasesViewProps) {
  // 3-Step Wizard Flow States
  const [currentStep, setCurrentStep] = useState<number>(1);

  // STEP 1 State: Supplier Selection
  const [supplierId, setSupplierId] = useState<string>("walk-in-supplier");
  const [supplierSearch, setSupplierSearch] = useState<string>("");
  const [showNewSupplierForm, setShowNewSupplierForm] = useState<boolean>(false);
  const [newSupName, setNewSupName] = useState<string>("");
  const [newSupPhone, setNewSupPhone] = useState<string>("");
  const [newSupAddress, setNewSupAddress] = useState<string>("");

  // STEP 2 State: Items costings
  const [productId, setProductId] = useState<string>("");
  const [productSearch, setProductSearch] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [updateSellPrice, setUpdateSellPrice] = useState<boolean>(false);
  const [newSellPriceInput, setNewSellPriceInput] = useState<string>("");

  // STEP 3 State: Invoice Metadata & Billing
  const [cashPaid, setCashPaid] = useState<string>("");
  const [invoiceNo, setInvoiceNo] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState<string>("");

  // Edit Modal State
  const [editingPur, setEditingPur] = useState<any | null>(null);
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editProductId, setEditProductId] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editInvoiceNo, setEditInvoiceNo] = useState("");

  // Inline deletion confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter suppliers
  const filteredSuppliers = contacts.filter(
    c => 
      c.type === "supplier" && 
      (c.name.toLowerCase().includes(supplierSearch.toLowerCase()) || 
       c.phone.toLowerCase().includes(supplierSearch.toLowerCase()))
  );

  // Filter products for step 2 selection List
  const filteredProductsSelect = products.filter(
    p => 
      p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleProductSelect = (id: string) => {
    setProductId(id);
    const prod = products.find(p => p.id === id);
    if (prod) {
      setUnitPrice(prod.buyPrice.toString());
      setNewSellPriceInput(prod.sellPrice.toString());
    }
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName || !newSupPhone) return;

    if (onAddSupplier) {
      const createdId = onAddSupplier({
        name: newSupName,
        phone: newSupPhone,
        address: newSupAddress
      });
      if (createdId) {
        setSupplierId(createdId);
      }
    }
    // Reset form
    setNewSupName("");
    setNewSupPhone("");
    setNewSupAddress("");
    setShowNewSupplierForm(false);
  };

  const getChosenSupplierObj = () => {
    if (supplierId === "walk-in-supplier") return { name: "Walk-in Supplier", phone: "N/A" };
    return contacts.find(c => c.id === supplierId);
  };

  const getChosenProductObj = () => {
    return products.find(p => p.id === productId);
  };

  // Helper values for step review calculations
  const parsedQty = parseFloat(quantity) || 0;
  const parsedBuyCost = parseFloat(unitPrice) || 0;
  const calculatedTotalAmount = parsedQty * parsedBuyCost;
  
  // Set default paid value when stepping into summary
  const enterStep3 = () => {
    setCashPaid(calculatedTotalAmount.toString());
    setInvoiceNo(`PUR-${Date.now().toString().slice(-6)}`);
    setCurrentStep(3);
  };

  const handleFinalSubmit = () => {
    if (!productId || parsedQty <= 0 || parsedBuyCost < 0) {
      return;
    }

    onAddPurchase({
      invoiceNo: invoiceNo || `PUR-${Date.now().toString().slice(-6)}`,
      supplierId: supplierId,
      productId,
      quantity: parsedQty,
      unitPrice: parsedBuyCost,
      totalAmount: calculatedTotalAmount,
      date,
      note: note || `Purchase of ${getChosenProductObj()?.name}`,
      updatedSellPrice: updateSellPrice ? (parseFloat(newSellPriceInput) || undefined) : undefined
    });

    // Reset wizard
    setSupplierId("walk-in-supplier");
    setProductId("");
    setProductSearch("");
    setQuantity("");
    setUnitPrice("");
    setUpdateSellPrice(false);
    setNewSellPriceInput("");
    setNote("");
    setInvoiceNo("");
    setCashPaid("");
    setCurrentStep(1);
  };

  // Handle Edit modal pricing and selections
  const handleEditProductSelect = (id: string) => {
    setEditProductId(id);
    const selectedProd = products.find(p => p.id === id);
    if (selectedProd) {
      setEditUnitPrice(selectedProd.buyPrice.toString());
    }
  };

  const handleStartEdit = (pur: any) => {
    setEditingPur(pur);
    setEditSupplierId(pur.supplierId);
    setEditProductId(pur.productId);
    setEditQuantity(pur.quantity.toString());
    setEditUnitPrice(pur.unitPrice.toString());
    setEditDate(pur.date);
    setEditNote(pur.note || "");
    setEditInvoiceNo(pur.invoiceNo);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPur) return;

    const qty = parseFloat(editQuantity) || 1;
    const price = parseFloat(editUnitPrice) || 0;
    const total = qty * price;

    onEditPurchase(editingPur.id, {
      invoiceNo: editInvoiceNo,
      supplierId: editSupplierId,
      productId: editProductId,
      quantity: qty,
      unitPrice: price,
      totalAmount: total,
      date: editDate,
      note: editNote
    });

    setEditingPur(null);
  };

  const getSupplierName = (id: string) => {
    if (id === "walk-in-supplier") return "Walk-in Supplier";
    const s = contacts.find(c => c.id === id);
    return s ? s.name : "Walk-in Supplier";
  };

  const getProductName = (id: string) => {
    const p = products.find(prod => prod.id === id);
    return p ? p.name : "Deleted Product";
  };

  return (
    <div className="space-y-6 animate-fadeIn font-sans" id="purchases-premium-module">
      {/* Premium Step Wizard Container */}
      <div className="bg-[#1E1E24]/95 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6" id="wizard-base">
        
        {/* Step Headings/Header Navigation */}
        <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-850 pb-5 gap-4" id="wizard-header">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/15 rounded-xl text-emerald-400 border border-emerald-500/10">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Premium Stock Acquisition Engine</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Wizard-guided batch inventory updates & direct vendor ledgers.</p>
            </div>
          </div>

          {/* Interactive Flow Indicator */}
          <div className="flex items-center gap-2 md:gap-4 select-none font-mono text-[10px]" id="flow-indicator">
            <div 
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                currentStep === 1 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold" 
                  : "bg-slate-900/50 border-slate-850 text-slate-500"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-slate-950/90 text-center leading-4 text-[9px] font-bold">1</span>
              <span>Supplier & Account</span>
            </div>
            <span className="text-slate-700 font-bold">&rarr;</span>
            <div 
              onClick={() => productId && setCurrentStep(2)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                !productId ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              } ${
                currentStep === 2 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold" 
                  : "bg-slate-900/50 border-slate-850 text-slate-500"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-slate-950/90 text-center leading-4 text-[9px] font-bold">2</span>
              <span>Purchase Details</span>
            </div>
            <span className="text-slate-700 font-bold">&rarr;</span>
            <div 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                !productId || !quantity || !unitPrice ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              } ${
                currentStep === 3 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold" 
                  : "bg-slate-900/50 border-slate-850 text-slate-500"
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-slate-950/90 text-center leading-4 text-[9px] font-bold">3</span>
              <span>Review & Confirm</span>
            </div>
          </div>
        </div>

        {/* -------------------- STEP 1: SELECT SUPPLIER -------------------- */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fadeIn" id="pos-step-1">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">Step 1: Choose Vendor or Dealer Account</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Select from standard showroom partners, register contacts, or use Walk-in Supplier payment tabs.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewSupplierForm(!showNewSupplierForm)}
                className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ml-auto md:ml-0"
              >
                <Plus className="w-4 h-4" />
                Quick Add Supplier
              </button>
            </div>

            {/* Slide Down Quick Supplier Registration */}
            {showNewSupplierForm && (
              <form onSubmit={handleCreateSupplier} className="bg-[#121214] border border-slate-800 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 animate-slideIn">
                <div className="col-span-1 md:col-span-3 pb-1 border-b border-slate-850 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Register New Supplier Profile</span>
                  <button type="button" onClick={() => setShowNewSupplierForm(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pl-1 font-mono">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Walton Bangladesh HQ"
                    value={newSupName}
                    onChange={(e) => setNewSupName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-lg text-white text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pl-1 font-mono">Mobile / Contact Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 01710-XXXXXX"
                    value={newSupPhone}
                    onChange={(e) => setNewSupPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-lg text-white text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pl-1 font-mono">Commercial Address</label>
                  <input
                    type="text"
                    placeholder="Dhaka, Bangladesh"
                    value={newSupAddress}
                    onChange={(e) => setNewSupAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-lg text-white text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="col-span-1 md:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl transition-all hover:bg-emerald-400 active:scale-95 shadow-md shadow-emerald-500/10"
                  >
                    Save & Auto-Select Supplier
                  </button>
                </div>
              </form>
            )}

            {/* Quick search input */}
            <div className="relative w-full" id="supplier-search-input-wrap">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search partners database by name, phone numbers or corporate handles..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="w-full px-4 py-2.5 pl-10 bg-[#121214] border border-slate-800 rounded-xl text-slate-200 text-xs outline-none focus:border-emerald-500 transition-all font-mono"
              />
            </div>

            {/* Real-time Supplier list card matching */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3" id="supplier-grid-panel">
              {/* Default Cash Card */}
              <div
                onClick={() => setSupplierId("walk-in-supplier")}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-28 ${
                  supplierId === "walk-in-supplier"
                    ? "bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/5 text-white"
                    : "bg-[#121214] border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 rounded">DEALER CASH</span>
                  {supplierId === "walk-in-supplier" && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />}
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-bold block leading-none text-white">Walk-in Local Supplier</h4>
                  <span className="text-[10px] text-slate-500 block mt-1 font-mono">Immediate Hand Cash Outflows</span>
                </div>
              </div>

              {/* Dynamic Matching Suppliers list */}
              {filteredSuppliers.map((c) => {
                const isSelected = supplierId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSupplierId(c.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-28 ${
                      isSelected
                        ? "bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/5 text-white"
                        : "bg-[#121214] border-slate-800 text-slate-300 hover:border-slate-750"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black uppercase tracking-wider font-mono px-2 py-0.5 bg-emerald-950/20 text-emerald-400 rounded border border-emerald-900/10">LEDGER PROFILE</span>
                      {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />}
                    </div>
                    <div className="text-left space-y-0.5">
                      <h4 className="text-xs font-bold block leading-tight truncate text-white">{c.name}</h4>
                      <span className="text-[9px] text-slate-400 block font-mono">Phone: {c.phone}</span>
                      <span className="text-[9px] text-slate-500 block truncate font-sans">Addr: {c.address}</span>
                    </div>
                  </div>
                );
              })}

              {filteredSuppliers.length === 0 && supplierSearch.trim() !== "" && (
                <div className="col-span-1 md:col-span-3 p-6 text-center text-slate-500 italic bg-[#121214] rounded-xl border border-dashed border-slate-800 text-xs">
                  No suppliers matching search found. Click "Quick Add" to list them safely.
                </div>
              )}
            </div>

            {/* Navigation footer */}
            <div className="flex justify-end pt-3 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 bg-emerald-500 text-slate-950 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-emerald-400 transition-all cursor-pointer flex items-center justify-center gap-2 shadow shadow-emerald-500/10"
              >
                Next Step: Products & Costing
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* -------------------- STEP 2: ADD PURCHASED ITEMS -------------------- */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fadeIn" id="pos-step-2">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">Step 2: Define Items, Costs & Stock Inventory</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Select a catalog index item, configure current acquisition prices, unit buy costs, and toggles.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Product Select List Card (5 Cols) */}
              <div className="md:col-span-5 space-y-3" id="wizard-product-col">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono block pl-1">Products Catalog</span>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search standard goods by titles/SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full px-3 py-1.5 pl-8 bg-[#121214] border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 border border-slate-850 p-2 rounded-xl bg-[#121214]/50 custom-scrollbar">
                  {filteredProductsSelect.map((p) => {
                    const isSelected = productId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleProductSelect(p.id)}
                        className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between text-xs ${
                          isSelected 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-white font-bold" 
                            : "bg-[#121214] border-slate-800 text-slate-300 hover:bg-slate-900"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-white block truncate font-sans text-xs">{p.name}</span>
                          <span className="text-[9px] text-slate-500 block font-mono">SKU: {p.sku} | In-Stock: {p.stock}</span>
                        </div>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-900 rounded text-slate-400 border border-slate-800">
                          {p.buyPrice} buy
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cost Forms panel (7 Cols) */}
              <div className="md:col-span-7 bg-[#121214] border border-slate-800 p-5 rounded-2xl space-y-4" id="wizard-pricing-col">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono block pl-1 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Costing Configuration Panel
                </span>

                {productId ? (
                  <div className="space-y-3 font-sans text-xs">
                    {/* Display chosen item info */}
                    <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-mono text-slate-500 block uppercase font-bold">Configuring</span>
                        <strong className="text-xs text-white block mt-0.5">{getChosenProductObj()?.name}</strong>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
                        Stock basis: {getChosenProductObj()?.stock} unit({getChosenProductObj()?.unit})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pl-1 font-mono">Unit Purchase Rate *</label>
                        <input
                          type="number"
                          id="wizard-buy-input"
                          min={0}
                          placeholder={getChosenProductObj()?.buyPrice.toString() || "0"}
                          value={unitPrice}
                          onChange={(e) => setUnitPrice(e.target.value)}
                          className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-lg text-emerald-400 font-bold font-mono text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pl-1 font-mono">Quantity Restocking *</label>
                        <input
                          type="number"
                          id="wizard-qty-input"
                          min={1}
                          placeholder="e.g. 50"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-lg text-white font-mono text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Premium updates sell toggle requirements block */}
                    <div className="p-3.5 bg-slate-900 border border-slate-850 rounded-xl space-y-3 mt-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <strong className="text-xs text-slate-200 block">Configure Global Selling Price?</strong>
                          <span className="text-[9px] text-slate-500 font-medium block">Updates showroom retail tag instantly when buy rates fluctuate.</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={updateSellPrice} 
                            onChange={(e) => setUpdateSellPrice(e.target.checked)} 
                            className="sr-only peer" 
                          />
                          <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-slate-950"></div>
                        </label>
                      </div>

                      {updateSellPrice && (
                        <div className="space-y-1 pt-2 border-t border-slate-850 animate-slideIn">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pl-1 font-mono">New Showroom Selling Price</label>
                          <input
                            type="number"
                            min={0}
                            value={newSellPriceInput}
                            onChange={(e) => setNewSellPriceInput(e.target.value)}
                            className="w-full px-3 py-1.5 bg-[#050912] border border-slate-800 rounded-lg text-white font-bold font-mono text-xs outline-none focus:border-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-500 italic bg-[#050912] rounded-xl border border-dashed border-slate-800 text-xs">
                    👈 Please search and choose a product from the catalogs left column to edit values and begin!
                  </div>
                )}
              </div>
            </div>

            {/* Navigation footer */}
            <div className="flex justify-between pt-3 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 bg-[#121214] hover:bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Suppliers
              </button>
              <button
                type="button"
                disabled={!productId || parsedQty <= 0 || parsedBuyCost < 0}
                onClick={enterStep3}
                className="px-5 py-2.5 bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-emerald-400 transition-all cursor-pointer flex items-center justify-center gap-2 shadow shadow-emerald-500/10"
              >
                Next Step: Billing Review
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* -------------------- STEP 3: PAYMENT & SUMMARY -------------------- */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fadeIn" id="pos-step-3">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest font-mono">Step 3: Supplier Bill Settlements & Meta Registry</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Finalize invoice vouchers, review payment details, settle transactions and generate print memos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* Calculations receipt review (Card) */}
              <div className="bg-[#121214] border border-slate-800 p-5 rounded-2xl flex flex-col justify-between" id="summary-left-col">
                <div className="space-y-3 font-sans text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono block pl-1">Consolidated Bill review</span>
                  
                  <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Chosen Supplier Link:</span>
                      <strong className="text-white font-bold text-xs">{getChosenSupplierObj()?.name}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400 pl-2">
                      <span>Supplier Contact Phone:</span>
                      <span className="font-mono text-slate-300">{getChosenSupplierObj()?.phone}</span>
                    </div>
                    <div className="border-t border-slate-850/60 my-1"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Restocking Content:</span>
                      <strong className="text-emerald-400 text-xs">{getChosenProductObj()?.name}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400 pl-2">
                      <span>Restock Units Qty:</span>
                      <span className="font-mono text-slate-300">x{quantity} {getChosenProductObj()?.unit}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400 pl-2">
                      <span>Agreed Buy Price Basis:</span>
                      <span className="font-mono text-slate-300">{unitPrice} {currencySymbol}</span>
                    </div>
                    {updateSellPrice && (
                      <div className="flex justify-between items-center text-[11px] text-amber-500 font-bold pl-2 bg-amber-500/5 py-1 px-1.5 rounded">
                        <span>New Selling Price update:</span>
                        <span className="font-mono">{newSellPriceInput} {currencySymbol}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Main Billing computations */}
                <div className="pt-4 border-t border-slate-850 mt-4 space-y-2 text-right">
                  <div className="flex justify-between items-center">
                    <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Total Purchase Cost:</span>
                    <strong className="text-xl font-mono text-white font-black">
                      {currencySymbol} {calculatedTotalAmount.toLocaleString()}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-800 pt-2 text-[11px] font-mono text-amber-400">
                    <span>Due to Supplier Account:</span>
                    <span className="font-bold">
                      {currencySymbol} {Math.max(0, calculatedTotalAmount - (parseFloat(cashPaid) || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cash Paid input form and date details */}
              <div className="bg-[#121214] border border-slate-800 p-5 rounded-2xl space-y-4" id="summary-right-col">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider font-mono block pl-1">Voucher Accounting Metadata</span>
                
                <div className="space-y-3 font-sans text-xs">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pl-1 font-mono">Total cash paid to supplier *</label>
                    <input
                      type="number"
                      id="wizard-paid-input"
                      min={0}
                      max={calculatedTotalAmount}
                      value={cashPaid}
                      onChange={(e) => setCashPaid(e.target.value)}
                      className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-lg text-emerald-450 text-xs font-mono font-bold outline-none focus:border-emerald-500 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pl-1 font-mono">Invoice Order ID</label>
                      <input
                        type="text"
                        value={invoiceNo}
                        onChange={(e) => setInvoiceNo(e.target.value)}
                        placeholder="Auto-generated"
                        className="w-full px-3 py-1.5 bg-[#050912] border border-slate-800 rounded-lg text-white font-mono text-xs outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pl-1 font-mono">Acquisition Date</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#050912] border border-slate-800 rounded-lg text-white font-mono text-xs outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pl-1 font-mono">Internal purchase memo note</label>
                    <input
                      type="text"
                      placeholder="e.g. Walton direct showroom stock import, partial payment..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-3 py-2 bg-[#050912] border border-slate-800 rounded-lg text-white font-sans text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation footer */}
            <div className="flex justify-between pt-3 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 bg-[#121214] hover:bg-slate-900 border border-slate-800 text-slate-200 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Pricing
              </button>
              
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl hover:from-emerald-400 hover:to-emerald-300 transition-all cursor-pointer flex items-center justify-center gap-2 shadow shadow-emerald-500/20 active:scale-95"
              >
                <Check className="w-4 h-4" />
                Confirm Purchase & Stock
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 4. PAST PURCHASES REGISTRY LEDGER TABLE */}
      <div className="bg-[#1E1E24]/95 border border-slate-800 rounded-2xl overflow-hidden shadow-xl" id="purchases-ledgers-tbl">
        <div className="p-5 border-b border-slate-850 bg-slate-900/30 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-extrabold uppercase tracking-widest font-mono text-slate-500 block">Historic Database</span>
            <h3 className="text-xs font-black tracking-wider uppercase text-white mt-0.5">Showroom Stock Purchase Registers</h3>
          </div>
          <span className="text-[10px] bg-slate-900 border border-slate-800 px-3 py-1 text-slate-400 rounded-lg font-mono">
            Purchases Logged: <strong className="text-white">{purchases.length}</strong> items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-850 text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold">
                <th className="py-3.5 px-5">Date</th>
                <th className="py-3.5 px-5">Invoice No</th>
                <th className="py-3.5 px-5">Supplier Account</th>
                <th className="py-3.5 px-5">Product Target</th>
                <th className="py-3.5 px-5 text-center">Acquired Qty</th>
                <th className="py-3.5 px-5 text-right">Unit Buy Rate</th>
                <th className="py-3.5 px-5 text-right">Total Outflow</th>
                <th className="py-3.5 px-5">Audit Notes</th>
                <th className="py-3.5 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 font-sans">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 italic bg-[#1E1E24]/30 font-mono text-[11px]">
                    ⚠️ Currently no historic stock acquisition vouchers found. Settle the purchase flows above to append lists.
                  </td>
                </tr>
              ) : (
                purchases.map((pur) => (
                  <tr key={pur.id} className="hover:bg-slate-900/40 text-slate-300 transition-colors">
                    <td className="py-4 px-5 font-mono text-slate-450">{pur.date}</td>
                    <td className="py-4 px-5 font-mono font-bold text-white">{pur.invoiceNo}</td>
                    <td className="py-4 px-5 font-sans font-medium text-slate-350">{getSupplierName(pur.supplierId)}</td>
                    <td className="py-4 px-5 font-sans font-bold text-emerald-400">{getProductName(pur.productId)}</td>
                    <td className="py-4 px-5 text-center font-mono text-emerald-500 font-bold">+{pur.quantity}</td>
                    <td className="py-4 px-5 text-right font-mono text-slate-400">{currencySymbol} {(pur.unitPrice ?? 0).toLocaleString()}</td>
                    <td className="py-4 px-5 text-right font-mono font-bold text-white">{currencySymbol} {(pur.totalAmount ?? 0).toLocaleString()}</td>
                    <td className="py-4 px-5 text-slate-400 text-xs italic">{pur.note || "Standard purchase lot"}</td>
                    <td className="py-4 px-5 text-center">
                      {deleteConfirmId === pur.id ? (
                        <div className="flex items-center gap-1.5 justify-center">
                          <button
                            onClick={() => {
                              onDeletePurchase(pur.id);
                              setDeleteConfirmId(null);
                            }}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-bold p-1 px-2.5 rounded text-[10px] transition-colors cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1 px-2.5 rounded text-[10px] transition-colors cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 justify-center">
                          <button
                            onClick={() => handleStartEdit(pur)}
                            className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-all cursor-pointer"
                            title="Edit Purchase Memo"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(pur.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                            title="Discard Purchase Memo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retro premium modal overlay to correct historic Purchase registries */}
      {editingPur && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-[#1E1E24] border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3" id="edit-pur-header">
              <div className="flex items-center gap-2 text-emerald-400">
                <Edit3 className="w-5 h-5 animate-pulse" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Verify Purchase Record Adjustments</h3>
              </div>
              <button
                onClick={() => setEditingPur(null)}
                className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-900 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="grid grid-cols-2 gap-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block font-mono pl-0.5">Invoice Voucher ID</label>
                <input
                  type="text"
                  required
                  value={editInvoiceNo}
                  onChange={(e) => setEditInvoiceNo(e.target.value)}
                  className="w-full p-2.5 bg-[#121214] border border-slate-800 rounded-lg text-slate-100 font-mono text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block font-mono pl-0.5">Acquisition Date</label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full p-2.5 bg-[#121214] border border-slate-800 rounded-lg text-slate-100 font-mono text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block font-mono pl-0.5">Supplier Partner</label>
                <select
                  value={editSupplierId}
                  onChange={(e) => setEditSupplierId(e.target.value)}
                  className="w-full p-2.5 bg-[#121214] border border-slate-800 rounded-lg text-slate-100 text-xs outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="walk-in-supplier">-- Walk-in Supplier --</option>
                  {contacts.filter(c => c.type === "supplier").map(sup => (
                    <option key={sup.id} value={sup.id} className="bg-[#1E1E24]">{sup.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block font-mono pl-0.5">Registered Product</label>
                <select
                  value={editProductId}
                  onChange={(e) => handleEditProductSelect(e.target.value)}
                  className="w-full p-2.5 bg-[#121214] border border-slate-800 rounded-lg text-slate-100 text-xs outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {products.map(prod => (
                    <option key={prod.id} value={prod.id} className="bg-[#1E1E24]">{prod.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block font-mono pl-0.5">Quantity Bought</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="w-full p-2.5 bg-[#121214] border border-slate-800 rounded-lg text-white font-mono text-xs font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block font-mono pl-0.5 font-bold">Unit Cost Rate ({currencySymbol})</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={editUnitPrice}
                  onChange={(e) => setEditUnitPrice(e.target.value)}
                  className="w-full p-2.5 bg-[#121214] border border-slate-800 rounded-lg text-emerald-450 font-mono text-xs font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-[10px] text-slate-400 uppercase block font-mono pl-0.5">Transaction Notes</label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Record adjustment reason"
                  className="w-full p-2.5 bg-[#121214] border border-slate-800 rounded-lg text-slate-100 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="col-span-2 flex justify-between items-center bg-[#121214] border border-slate-800 p-3.5 rounded-xl mt-2 font-mono text-[11px]">
                <span className="text-slate-500 uppercase tracking-widest font-black">Sum Total Cash Flow:</span>
                <span className="text-xs font-black text-white">
                  {currencySymbol} {((parseFloat(editQuantity) || 0) * (parseFloat(editUnitPrice) || 0)).toLocaleString()}
                </span>
              </div>

              <div className="col-span-2 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPur(null)}
                  className="px-4 py-2 bg-[#121214] border border-slate-800 text-slate-350 text-xs font-bold uppercase rounded-lg hover:bg-slate-900 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-lg hover:from-emerald-400 hover:to-emerald-300 transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-500/10"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
