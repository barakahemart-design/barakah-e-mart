import React, { useState } from "react";
import { 
  Package, 
  Trash2, 
  ShieldCheck, 
  Tag, 
  Info, 
  Search, 
  Filter, 
  AlertTriangle, 
  TrendingUp, 
  FolderLock, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Calendar,
  Smartphone,
  Tv,
  Wifi,
  Laptop,
  Cpu,
  AlertCircle,
  Plus,
  PlusCircle,
  Image as ImageIcon,
  CloudUpload,
  X,
  Edit2
} from "lucide-react";

interface ProductsViewProps {
  products: any[];
  onAddProduct: (prod: { 
    name: string; 
    sku: string; 
    category: string; 
    buyPrice: number; 
    sellPrice: number; 
    stock: number; 
    unit: string; 
    imageUrl?: string;
  }) => void;
  onUpdateProduct: (prod: {
    id: string;
    name: string;
    sku: string;
    category: string;
    buyPrice: number;
    sellPrice: number;
    stock: number;
    unit: string;
    imageUrl?: string;
  }) => void;
  onDeleteProduct: (id: string, name: string) => void;
  currencySymbol: string;
  isSalesRole: boolean;
}

export function ProductsView({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  currencySymbol = "৳",
  isSalesRole = false
}: ProductsViewProps) {
  // Filter fields
  const [searchQuery, setSearchQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  // Registration states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdSku, setNewProdSku] = useState("");
  const [newProdCat, setNewProdCat] = useState("");
  const [newProdBuy, setNewProdBuy] = useState("");
  const [newProdSell, setNewProdSell] = useState("");
  const [newProdStock, setNewProdStock] = useState("");
  const [newProdUnit, setNewProdUnit] = useState("pcs");
  const [newProdImgUrl, setNewProdImgUrl] = useState("");
  const [isCompressingProdImg, setIsCompressingProdImg] = useState(false);

  // Modern Popover Edit States
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editCat, setEditCat] = useState("");
  const [editBuy, setEditBuy] = useState("");
  const [editSell, setEditSell] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editUnit, setEditUnit] = useState("pcs");
  const [editImgUrl, setEditImgUrl] = useState("");
  const [isCompressingEditImg, setIsCompressingEditImg] = useState(false);

  const startEditProduct = (prod: any) => {
    setEditingProduct(prod);
    setEditName(prod.name);
    setEditSku(prod.sku || "");
    setEditCat(prod.category || "");
    setEditBuy(prod.buyPrice.toString());
    setEditSell(prod.sellPrice.toString());
    setEditStock(prod.stock.toString());
    setEditUnit(prod.unit || "pcs");
    setEditImgUrl(prod.imageUrl || "");
  };

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingProdImg(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max_size = 450; 
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL("image/jpeg", 0.7);
          setNewProdImgUrl(base64);
        }
        setIsCompressingProdImg(false);
      };
    };
  };

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingEditImg(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max_size = 450;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL("image/jpeg", 0.7);
          setEditImgUrl(base64);
        }
        setIsCompressingEditImg(false);
      };
    };
  };

  const handleAddNewProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;
    onAddProduct({
      name: newProdName,
      sku: newProdSku || `P-${Date.now().toString().slice(-4)}`,
      category: newProdCat || "Electronics",
      buyPrice: parseFloat(newProdBuy) || 0,
      sellPrice: parseFloat(newProdSell) || 0,
      stock: parseInt(newProdStock) || 0,
      unit: newProdUnit || "pcs",
      imageUrl: newProdImgUrl
    });
    setNewProdName("");
    setNewProdSku("");
    setNewProdCat("");
    setNewProdBuy("");
    setNewProdSell("");
    setNewProdStock("");
    setNewProdUnit("pcs");
    setNewProdImgUrl("");
    setShowAddForm(false);
  };

  const handleUpdateProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    onUpdateProduct({
      id: editingProduct.id,
      name: editName,
      sku: editSku || editingProduct.sku,
      category: editCat || "Electronics",
      buyPrice: parseFloat(editBuy) || 0,
      sellPrice: parseFloat(editSell) || 0,
      stock: parseInt(editStock) || 0,
      unit: editUnit || "pcs",
      imageUrl: editImgUrl
    });
    setEditingProduct(null);
  };

  // Deletion prompt index state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filtered = products.filter(p => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      const matchesCat = catFilter === "all" || p.category === catFilter;
      return matchesCat;
    }
    const searchTerms = query.split(/\s+/);
    const targetString = `${p.name} ${p.sku} ${p.category}`.toLowerCase();
    const matchesSearch = searchTerms.every(term => targetString.includes(term));
    const matchesCat = catFilter === "all" || p.category === catFilter;
    return matchesSearch && matchesCat;
  });

  const categoriesList = Array.from(new Set(products.map(p => p.category)));

  return (
    <div className="space-y-6 animate-fade-in text-[#A0A0A5] font-sans" id="products-view">
      
      {/* 1. Header & Quick Actions shelf */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-sm font-bold text-white tracking-widest uppercase flex items-center gap-2">
            <Package className="w-4 h-4 text-[#00E676]" />
            Products Registry & Catalog
          </h2>
          <p className="text-[10px] text-[#A0A0A5] tracking-wide mt-0.5">
            Real-time shop index, pricing profiles, and shelf reorder levels.
          </p>
        </div>

        {/* Read-Only Mode Indicator (Centralized Catalog) */}
        <div className="flex items-center gap-2 bg-[#050912] border border-slate-800 px-3.5 py-1.5 rounded-xl">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00E676]" />
          <span className="text-[10px] font-bold text-slate-300 font-mono uppercase tracking-wider">
            PRE-EXISTING CATALOG DATABASE
          </span>
        </div>
      </div>

      {/* 2. Hidden Security Warning for Sales Roles */}
      {isSalesRole && (
        <div className="bg-[#1E1E24] border border-[#2D2D35] p-3 rounded-xl flex items-center gap-3 text-amber-500 shadow-sm text-xs">
          <Info className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Sales Staff Panel active. Stock buy-costs and margin diagnostic charts are security locked.
          </span>
        </div>
      )}

      {/* Admin Product Registration Card (Collapsible) */}
      {!isSalesRole && (
        <div className="bg-[#1E1E24] border border-[#2D2D35] rounded-2xl overflow-hidden shadow-lg transition-all" id="admin-product-registration-card">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full px-5 py-4 bg-[#121214]/60 hover:bg-[#121214]/80 flex items-center justify-between text-left transition-all"
          >
            <div className="flex items-center gap-2.5">
              <PlusCircle className="w-4.5 h-4.5 text-[#00E676]" />
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wider block">Add Product Registry Entry</span>
                <span className="text-[10px] text-[#A0A0A5]">Declare new high-quality electronics item in catalog index.</span>
              </div>
            </div>
            <span className="p-1 px-2.5 bg-[#121214] border border-slate-800 rounded-lg text-white font-mono text-[9px] uppercase tracking-wider select-none shrink-0 font-bold">
              {showAddForm ? "Hide Form" : "Open Form"}
            </span>
          </button>

          {showAddForm && (
            <form onSubmit={handleAddNewProductSubmit} className="p-6 border-t border-[#2D2D35]/50 space-y-4 font-sans text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 col-span-1 md:col-span-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Product Title / Model Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sony Bravia 65' Class X90L"
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Storage Shelf SKU / Barcode</label>
                  <input
                    type="text"
                    placeholder="e.g. SNY-65-X90L"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5 col-span-1 md:col-span-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Category Mapped *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Air Conditioners"
                    value={newProdCat}
                    onChange={(e) => setNewProdCat(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all"
                  />
                  <div className="flex flex-wrap gap-1 pt-1.5 max-h-[64px] overflow-y-auto custom-scrollbar-thin">
                    {Array.from(new Set([...products.map(p => p.category), "Electronics", "Mobile Phones", "Laptops", "Air Conditioners", "Smart TV", "Home Appliances"])).filter(Boolean).slice(0, 8).map(cat => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setNewProdCat(cat)}
                        className={`text-[9px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                          newProdCat === cat 
                            ? "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/35 font-bold" 
                            : "bg-[#121214] hover:bg-slate-800 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Warehouse Unit (e.g. unit, pcs) *</label>
                  <input
                    type="text"
                    required
                    placeholder="pcs"
                    value={newProdUnit}
                    onChange={(e) => setNewProdUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Net Buy Cost ({currencySymbol}) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    placeholder="0"
                    value={newProdBuy}
                    onChange={(e) => setNewProdBuy(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Retail Sell Price ({currencySymbol}) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    placeholder="0"
                    value={newProdSell}
                    onChange={(e) => setNewProdSell(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-2">
                <div className="space-y-1.5 md:col-span-3">
                  <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Initial Shelf Stock *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    placeholder="0"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-6">
                  <label className="text-[10px] font-semibold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Upload Product Thumbnail</label>
                  <div className="flex gap-2">
                    <label className="flex-1 px-4 py-2 bg-[#121214] hover:bg-slate-900 border border-[#2D2D35] hover:border-[#00E676]/35 rounded-xl text-[#A0A0A5] hover:text-white cursor-pointer transition-all flex items-center justify-center gap-2">
                      <CloudUpload className="w-4 h-4 text-[#00E676]" />
                      <span className="text-[11px] font-semibold font-sans">
                        {isCompressingProdImg ? "Optimizing Assets..." : "Upload Stock Image"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isCompressingProdImg}
                        onChange={handleProductImageUpload}
                        className="hidden"
                      />
                    </label>
                    
                    {newProdImgUrl && (
                      <button
                        type="button"
                        onClick={() => setNewProdImgUrl("")}
                        className="px-3 bg-rose-500/10 hover:bg-[#FF3333] hover:text-[#050912] border border-rose-500/20 hover:border-[#FF3333] rounded-xl text-[#FF3333] transition-all"
                        title="Delete image logo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="md:col-span-3 flex justify-center">
                  {newProdImgUrl ? (
                    <div className="w-14 h-14 bg-[#121214] border border-[#2D2D35] rounded-xl overflow-hidden relative group">
                      <img src={newProdImgUrl} className="w-full h-full object-cover" alt="Custom Preview" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 bg-[#121214]/50 border-2 border-dashed border-[#2D2D35] rounded-xl flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-slate-700" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-[#00E676] to-[#00B0FF] hover:from-[#00E676] hover:to-[#00E676] text-[#050912] font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all flex items-center gap-1.5 hover:shadow-lg hover:shadow-[#00E676]/20 active:scale-95 duration-200"
                >
                  <Plus className="w-3.5 h-3.5 text-[#050912]" />
                  Save Product Entry
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 4. Active Catalog parameters searching top-bar */}
      <div className="bg-[#1E1E24] p-4 rounded-2xl border border-[#2D2D35] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md" id="filter-shelf">
        <div className="space-y-0.5">
          <span className="text-[10px] uppercase font-extrabold text-white tracking-widest bg-[#121214] px-2.5 py-1 rounded-md border border-[#2D2D35]">ACTIVE DIRECTORY</span>
          <span className="text-[10px] font-mono text-[#A0A0A5] pl-2 font-semibold">Total Registry: {products.length} units listed</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto" id="search-shelf-parameters">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-3 text-[#A0A0A5] w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Search by label or Stock SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 pl-9 bg-[#121214] border border-[#2D2D35] rounded-xl text-xs text-white placeholder-[#A0A0A5]/60 outline-none focus:border-[#00E676] w-full transition-all"
            />
          </div>

          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="px-3 py-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-xs text-white outline-none focus:border-[#00E676] cursor-pointer transition-all font-semibold"
          >
            <option value="all">-- All Categories --</option>
            {categoriesList.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 5. Responsive Grid View (2-3 columns across) as explicitly demanded */}
      {filtered.length === 0 ? (
        <div className="bg-[#1E1E24] border border-[#2D2D35] rounded-2xl p-16 text-center text-[#A0A0A5] flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-white/5 rounded-full border border-[#2D2D35]/50 text-slate-500">
            <Package className="w-8 h-8 opacity-40" />
          </div>
          <p className="text-xs italic">
            No stock products mapped your criteria in the directory.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-12" id="products-bento-grid">
          {filtered.map((prod) => {
            const isLowStock = prod.stock <= 5;
            const profitMargin = prod.sellPrice - prod.buyPrice;

            // Determine specific visual media categories configuration
            let categoryIcon = <Package className="w-8 h-8 text-emerald-400 opacity-60" />;
            const catLower = (prod.category || "").toLowerCase();
            if (catLower.includes("conditioner") || catLower.includes("ac")) {
              categoryIcon = <Cpu className="w-8 h-8 text-cyan-400 opacity-70" />;
            } else if (catLower.includes("refriger") || catLower.includes("fridge")) {
              categoryIcon = <Cpu className="w-8 h-8 text-emerald-400 opacity-70" />;
            } else if (catLower.includes("tv") || catLower.includes("television") || catLower.includes("bravia")) {
              categoryIcon = <Tv className="w-8 h-8 text-blue-400 opacity-70" />;
            } else if (catLower.includes("net") || catLower.includes("wifi") || catLower.includes("router")) {
              categoryIcon = <Wifi className="w-8 h-8 text-indigo-400 opacity-70" />;
            } else if (catLower.includes("comput") || catLower.includes("laptop") || catLower.includes("elitebook")) {
              categoryIcon = <Laptop className="w-8 h-8 text-purple-400 opacity-70" />;
            } else if (catLower.includes("phone") || catLower.includes("smartphone") || catLower.includes("mobile")) {
              categoryIcon = <Smartphone className="w-8 h-8 text-teal-400 opacity-70" />;
            }

            return (
              <div 
                key={prod.id} 
                className="bg-[#1E1E24] hover:border-[#00E676]/25 border border-[#2D2D35] p-5 rounded-2xl shadow-lg transition-all duration-300 relative overflow-hidden group flex flex-col justify-between space-y-4"
                id={`product-catalog-card-${prod.id}`}
              >
                {/* Visual accent top edge for low stock or luxury items using solid Coral Red of #FF3333 */}
                <div className={`absolute top-0 left-0 right-0 h-1 transition-colors ${
                  isLowStock ? "bg-[#FF3333]" : "bg-[#00E676]/30 group-hover:bg-[#00E676]"
                }`}></div>

                {/* HIGH-QUALITY MODERN ROUNDED IMAGE CONTAINER */}
                <div className="w-full h-32 rounded-xl overflow-hidden bg-[#121214] border border-slate-800/80 mb-1 relative flex items-center justify-center group-hover:scale-[1.01] transition-transform duration-300">
                  {prod.imageUrl ? (
                    <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#121214] via-[#1E1E24] to-slate-900 flex flex-col items-center justify-center p-4">
                      {categoryIcon}
                      <span className="text-[8px] font-mono font-black uppercase text-slate-500 block mt-2.5 tracking-widest bg-[#050912] px-2 py-0.5 rounded border border-slate-800/40">
                        In-House Asset
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Header information block */}
                <div className="space-y-1.5 position-relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#00B0FF] font-mono bg-[#00B0FF]/5 pl-2 pr-2.5 py-0.5 rounded-full border border-[#00B0FF]/25 flex items-center gap-1">
                      <Layers className="w-2.5 h-2.5" />
                      {prod.category}
                    </span>
                    <span className="text-[10px] font-mono text-[#A0A0A5] font-semibold">
                      {prod.sku}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-[#00E676] transition-colors leading-snug line-clamp-2 pt-1 font-sans">
                    {prod.name}
                  </h3>
                </div>

                {/* Price point detail display rows */}
                <div className="bg-[#121214] p-3 rounded-xl border border-[#2D2D35] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[#A0A0A5]">Retail Buyout:</span>
                    <span className="text-sm font-extrabold text-white font-mono">
                      {currencySymbol}{prod.sellPrice.toLocaleString()}
                    </span>
                  </div>

                  {/* Manager restricted pricing profiles */}
                  {!isSalesRole ? (
                    <div className="border-t border-[#2D2D35] pt-2 mt-1.5 space-y-1.5 font-sans">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#A0A0A5]">Purchase Cost:</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {currencySymbol}{prod.buyPrice.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-[#A0A0A5]">Net Profit Margin:</span>
                        <span className="text-[#00E676] font-extrabold flex items-center gap-1 font-mono">
                          <TrendingUp className="w-2.5 h-2.5 shrink-0" />
                          +{currencySymbol}{profitMargin.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-[#2D2D35] pt-1.5 mt-1 text-center">
                      <span className="text-[9px] font-semibold text-amber-400/80 uppercase tracking-widest font-mono flex items-center justify-center gap-1 select-none">
                        <FolderLock className="w-2.5 h-2.5" />
                        Cost Info Secure
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Footer status block */}
                <div className="pt-2 border-t border-[#2D2D35]/40 flex items-center justify-between gap-2">
                  {/* Stock counter tag status with static high contrast Neon Coral Red */}
                  <div>
                    {isLowStock ? (
                      <div className="flex flex-col">
                        <span className="px-2.5 py-1 bg-[#FF3333] text-white border border-[#FF3333]/45 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow">
                          <AlertCircle className="w-2.5 h-2.5 text-white" />
                          Minus Stock / Reorder Alert
                        </span>
                        <span className="text-[9px] font-mono text-rose-400 pr-1 pl-1 mt-1 block font-extrabold">
                          Only {prod.stock} {prod.unit} left on rack
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="px-2.5 py-1 bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5 text-[#00E676]" />
                          In Stock Stocked
                        </span>
                        <span className="text-[9px] font-mono text-[#A0A0A5] pl-1 mt-0.5 font-semibold">
                          {prod.stock} {prod.unit} units ready
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Edit/Deletion button for non staff panel */}
                  {!isSalesRole && (
                    <div className="flex items-center gap-1 text-right shrink-0">
                      {/* Brand-new Edit Product Trigger Code */}
                      <button
                        onClick={() => startEditProduct(prod)}
                        className="p-2 text-slate-400 hover:text-[#00E676] hover:bg-emerald-500/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-[#00E676]/20"
                        title="Edit entry details"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-400" />
                      </button>

                      {deleteConfirmId === prod.id ? (
                        <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-xl border border-rose-500/25">
                          <button
                            onClick={() => {
                              onDeleteProduct(prod.id, prod.name);
                              setDeleteConfirmId(null);
                            }}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[8px] uppercase px-1.5 py-1 rounded cursor-pointer transition-all"
                          >
                            Del
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-[#A0A0A5] hover:text-white text-[8px] px-1.5 py-1 transition-all cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(prod.id)}
                          className="p-2 text-slate-500 hover:text-[#FF3333] hover:bg-rose-550/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-[#FF3333]/25"
                          title="Unregister Product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ULTRA-PREMIUM CORNER POPUP DIALOG FOR PRODUCT DETAILS AND IMAGE EDITING */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" id="edit-product-overlay-backdrop">
          <div className="bg-[#1E1E24] border border-[#2D2D35] rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full transform transition-all duration-300 scale-100 relative max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-[#121214]/80 border-b border-[#2D2D35] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-1 px-2.5 bg-[#00E676]/10 border border-[#00E676]/20 rounded-md text-[#00E676] font-mono text-[9px] uppercase tracking-wider font-extrabold block">
                  SHOWROOM STOCK EDIT
                </span>
                <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">Modify Product Entry</h3>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Scrollable Body Form */}
            <form onSubmit={handleUpdateProductSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 font-sans text-xs text-[#A0A0A5]">
              
              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Product Title / Model Specification *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all"
                />
              </div>

              {/* SKU & Category Mapped */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Category classification *</label>
                  <input
                    type="text"
                    required
                    value={editCat}
                    onChange={(e) => setEditCat(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all"
                  />
                  <div className="flex flex-wrap gap-1 pt-1.5 max-h-[64px] overflow-y-auto custom-scrollbar-thin">
                    {Array.from(new Set([...products.map(p => p.category), "Electronics", "Mobile Phones", "Laptops", "Air Conditioners", "Smart TV", "Home Appliances"])).filter(Boolean).slice(0, 8).map(cat => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setEditCat(cat)}
                        className={`text-[9px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                          editCat === cat 
                            ? "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/35 font-bold" 
                            : "bg-[#121214] hover:bg-slate-800 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Warehouse SKU Tag</label>
                  <input
                    type="text"
                    required
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all"
                  />
                </div>
              </div>

              {/* Pricing buy, sell, stock unit */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Costing Cost ({currencySymbol}) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editBuy}
                    onChange={(e) => setEditBuy(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Selling Price ({currencySymbol}) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editSell}
                    onChange={(e) => setEditSell(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Shelf Stock ({editUnit}) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121214] border border-[#2D2D35] rounded-xl text-white outline-none focus:border-[#00E676] transition-all font-mono"
                  />
                </div>
              </div>

              {/* Live Picture / Upload New File Option */}
              <div className="p-4 bg-[#121214]/40 border border-[#2D2D35] rounded-2xl space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-[#A0A0A5] pl-1 block">Update Gallery Picture File</label>
                
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <label className="w-full sm:flex-1 px-4 py-3 bg-[#121214] hover:bg-slate-900 border border-[#2D2D35] hover:border-[#00E676]/35 rounded-xl text-[#A0A0A5] hover:text-white cursor-pointer transition-all flex items-center justify-center gap-2">
                    <CloudUpload className="w-4 h-4 text-[#00E676]" />
                    <span className="text-[11px] font-semibold font-sans">
                      {isCompressingEditImg ? "Compressing File..." : "Pick Image File..."}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isCompressingEditImg}
                      onChange={handleEditImageUpload}
                      className="hidden"
                    />
                  </label>

                  {editImgUrl ? (
                    <div className="flex gap-2.5 items-center shrink-0">
                      <div className="w-14 h-14 bg-[#121214] border border-[#2D2D35] rounded-xl overflow-hidden relative group">
                        <img src={editImgUrl} className="w-full h-full object-cover" alt="Custom Preview" referrerPolicy="no-referrer" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditImgUrl("")}
                        className="p-2.5 bg-rose-500/10 hover:bg-[#FF3333] hover:text-[#050912] border border-rose-500/15 rounded-xl text-[#FF3333] transition-all shrink-0"
                        title="Discard current picture"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-14 h-14 bg-[#121214]/60 border border-dashed border-[#2D2D35] rounded-xl flex items-center justify-center shrink-0">
                      <ImageIcon className="w-5 h-5 text-slate-705" />
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer row */}
              <div className="pt-4 border-t border-[#2D2D35]/50 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 bg-[#121214] hover:bg-slate-900 border border-[#2D2D35] rounded-xl text-slate-400 hover:text-white font-bold transition-all cursor-pointer uppercase font-mono text-[10px]"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  disabled={isCompressingEditImg}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#00E676] to-[#00B0FF] text-slate-950 font-black uppercase tracking-wider rounded-xl hover:shadow-lg transition-all cursor-pointer text-[10px] font-mono"
                >
                  Apply Settings
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
