import React, { useMemo, useState } from "react";
import { Boxes, Package, ChevronDown, ChevronRight, AirVent, Tv, Router, BatteryCharging, Microwave, WashingMachine, Truck, Refrigerator, Fan, HousePlug, Shapes, Heater } from "lucide-react";

interface ProductSalesBreakdownProps {
  products: any[];
  transactions: any[];
  dashboardFilter: string;
  customStart: string;
  customEnd: string;
}

function parseSalesDate(value: any): Date | null {
  if (!value) return null;
  try {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "object") {
      if (typeof value.toDate === "function") {
        const date = value.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
      }
      const seconds = value.seconds ?? value._seconds;
      if (typeof seconds === "number") {
        const date = new Date(seconds * 1000);
        return Number.isNaN(date.getTime()) ? null : date;
      }
    }
    if (typeof value === "string") {
      const dateOnly = value.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
      if (dateOnly) {
        return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12, 0, 0);
      }
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function getPeriodBounds(filter: string, customStart: string, customEnd: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (filter === "all") return null;
  if (filter === "today") return { start: todayStart, end: todayEnd };
  if (filter === "yesterday") {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 1);
    return { start, end: new Date(todayStart.getTime() - 1) };
  }
  if (filter === "weekly") {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 6);
    return { start, end: todayEnd };
  }
  if (filter === "monthly") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: todayEnd };
  }
  if (filter === "yearly") {
    return { start: new Date(now.getFullYear(), 0, 1), end: todayEnd };
  }
  if (filter === "custom") {
    if (!customStart || !customEnd) {
      return { start: new Date(8640000000000000), end: new Date(-8640000000000000) };
    }
    const start = new Date(customStart + "T00:00:00");
    const end = new Date(customEnd + "T23:59:59.999");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return { start: new Date(8640000000000000), end: new Date(-8640000000000000) };
    }
    return { start, end };
  }
  return null;
}

function isInsidePeriod(value: any, bounds: { start: Date; end: Date } | null) {
  if (!bounds) return true;
  const date = parseSalesDate(value);
  return !!date && date.getTime() >= bounds.start.getTime() && date.getTime() <= bounds.end.getTime();
}

function getCategoryIcon(categoryName: string) {
  // Normalize category names first so aliases such as "AC", "Air Conditioners",
  // "Water Heater" and "Small Home Appliances" are recognized consistently.
  const name = categoryName.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();

  if (/delivery|deliver|shipping|courier/.test(name)) return Truck;
  if (/water.?heater|geyser|hot.?water/.test(name)) return Heater;
  if (/air.?condition|aircon|\bac\b|\bacs\b/.test(name)) return AirVent;
  if (/television|\btv\b|smart tv/.test(name)) return Tv;
  if (/router|network|onu|modem|wifi/.test(name)) return Router;
  if (/ups|\bpower\b|inverter|battery/.test(name)) return BatteryCharging;
  if (/microwave|micro.?oven/.test(name)) return Microwave;
  if (/washing.?machine|washer/.test(name)) return WashingMachine;
  if (/refrigerator|fridge/.test(name)) return Refrigerator;
  if (/fan|cooler/.test(name)) return Fan;
  if (/small.?home.?appliance|small.?appliance|small.?item|kitchen.?appliance|accessor/.test(name)) return HousePlug;
  if (/appliance|home.?appliance/.test(name)) return Shapes;
  return Boxes;
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function ProductSalesBreakdown({
  products = [],
  transactions = [],
  dashboardFilter,
  customStart,
  customEnd
}: ProductSalesBreakdownProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(current => current.includes(categoryKey)
      ? current.filter(key => key !== categoryKey)
      : [...current, categoryKey]);
  };

  const report = useMemo(() => {
    const bounds = getPeriodBounds(dashboardFilter, customStart, customEnd);
    const safeProducts = Array.isArray(products) ? products : [];
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const categoryMap = new Map<string, { name: string; units: number; products: Map<string, { name: string; units: number }> }>();
    let totalUnits = 0;

    safeTransactions.forEach((transaction: any) => {
      if (!transaction || !isInsidePeriod(transaction.date, bounds) || !Array.isArray(transaction.items)) return;

      transaction.items.forEach((item: any) => {
        const quantity = Number(item?.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) return;

        const itemName = String(item?.name || item?.product_name || "Unnamed Product").trim() || "Unnamed Product";
        const itemProductId = String(item?.productId || item?.product_id || "");
        const matchedProduct = safeProducts.find((product: any) =>
          itemProductId && String(product?.id || "") === itemProductId
        ) || safeProducts.find((product: any) =>
          String(product?.name || "").trim().toLowerCase() === itemName.toLowerCase()
        );

        const savedCategory = String(item?.category || "").trim();
        const catalogCategory = String(matchedProduct?.category || "").trim();
        // Older invoices may not have stored a category. Use the matching product's
        // current catalog category; treat the legacy placeholder as missing.
        // The two legacy Green Plus television products were saved without a
        // usable category in some older sales records. Check both the invoice
        // line and the matched account-local catalog product before grouping
        // them under China LED TV.
        const classificationName = [itemName, String(matchedProduct?.name || "")]
          .filter(Boolean)
          .join(" ");
        const isGreenPlusTv =
          /green\s*plus/i.test(classificationName) &&
          /(32|tv|television)/i.test(classificationName);
        const categoryName = (
          savedCategory && savedCategory.toLowerCase() !== "uncategorized"
            ? savedCategory
            : catalogCategory && catalogCategory.toLowerCase() !== "uncategorized"
              ? catalogCategory
              : isGreenPlusTv
                ? "China LED TV"
                : ""
        ).trim();

        // Only show products that belong to a real category. Uncategorized
        // historical lines are intentionally excluded from this report.
        if (!categoryName) return;

        const categoryKey = categoryName.toLowerCase();
        const productKey = itemProductId || String(matchedProduct?.id || itemName.toLowerCase());

        let category = categoryMap.get(categoryKey);
        if (!category) {
          category = { name: categoryName, units: 0, products: new Map() };
          categoryMap.set(categoryKey, category);
        }

        const existingProduct = category.products.get(productKey);
        if (existingProduct) existingProduct.units += quantity;
        else category.products.set(productKey, { name: itemName, units: quantity });

        category.units += quantity;
        totalUnits += quantity;
      });
    });

    const categories = Array.from(categoryMap.values())
      .map(category => ({
        ...category,
        products: Array.from(category.products.values()).sort((a, b) => b.units - a.units || a.name.localeCompare(b.name))
      }))
      .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name));

    const productCount = categories.reduce((sum, category) => sum + category.products.length, 0);
    return { categories, totalUnits, productCount };
  }, [products, transactions, dashboardFilter, customStart, customEnd]);

  const periodLabel = dashboardFilter === "today" ? "Today"
    : dashboardFilter === "yesterday" ? "Yesterday"
    : dashboardFilter === "weekly" ? "Last 7 Days"
    : dashboardFilter === "monthly" ? "This Month"
    : dashboardFilter === "yearly" ? "This Year"
    : dashboardFilter === "custom" ? "Selected Date Range"
    : "All Time";

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800/90 bg-[#0b0f19] p-4 sm:p-5 shadow-lg" id="dashboard-product-sales-breakdown">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold tracking-wide text-white sm:text-base">Product Sales Breakdown</h2>
            <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">Category-wise and product-wise quantities · {periodLabel}</p>
          </div>
        </div>

      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">Categories</h3>
          <span className="text-[10px] text-slate-500">Units sold</span>
        </div>
        {report.categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-[#0e1422]/60 px-4 py-10 text-center">
            <Package className="mx-auto h-7 w-7 text-slate-500" />
            <p className="mt-2 text-xs font-semibold text-slate-300">No product sales found for this period</p>
            <p className="mt-1 text-[10px] text-slate-500">Try another date range to view sales quantities.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {report.categories.map(category => {
              const categoryKey = category.name.toLowerCase();
              const isExpanded = expandedCategories.includes(categoryKey);
              const CategoryIcon = getCategoryIcon(category.name);
              return (
                <div key={categoryKey} className={`group min-w-0 overflow-hidden rounded-2xl border bg-[#0e1422] transition-all duration-200 ${isExpanded ? "border-indigo-500/35 shadow-lg shadow-indigo-950/20" : "border-slate-800/90 hover:border-slate-700"}`}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(categoryKey)}
                    aria-expanded={isExpanded}
                    className="flex w-full items-center justify-between gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-white/[0.025] sm:px-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${isExpanded ? "border-indigo-400/20 bg-indigo-500/15 text-indigo-200" : "border-slate-700/70 bg-slate-800/70 text-slate-300 group-hover:text-indigo-300"}`}>
                        <CategoryIcon className="h-[18px] w-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-xs font-bold tracking-wide text-slate-100 sm:text-sm">{category.name}</h4>
                        <p className="mt-1 text-[10px] font-medium text-slate-500">{category.products.length} product{category.products.length === 1 ? "" : "s"} <span className="px-1 text-slate-700">·</span> {isExpanded ? "Tap to collapse" : "Tap to view products"}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <div className="text-right">
                        <div className="text-lg font-extrabold tabular-nums text-sky-300 sm:text-xl">{formatQuantity(category.units)}</div>
                        <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">Units sold</div>
                      </div>
                      <span className={`ml-0.5 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${isExpanded ? "bg-indigo-500/15 text-indigo-200" : "bg-slate-800/80 text-slate-400"}`}>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-800/90 bg-[#0a101c]/70">
                      {category.products.map((product, index) => (
                        <div key={product.name + "-" + index} className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-800/60 px-4 py-3 last:border-b-0 sm:px-5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Package className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <span className="min-w-0 break-words text-[11px] font-medium leading-relaxed text-slate-300 sm:text-xs">{product.name}</span>
                          </div>
                          <span className="flex h-7 min-w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/70 px-2 text-xs font-bold tabular-nums text-white">{formatQuantity(product.units)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
