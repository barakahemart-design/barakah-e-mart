import React, { useMemo, useState } from "react";
import { toUUID } from "../lib/firebase-helpers";
import { Boxes, Package, ShoppingBag } from "lucide-react";
import { safeDate } from "../lib/dateUtils";

interface ProductSalesBreakdownProps {
  products: any[];
  transactions: any[];
  storeEmail: string;
  dashboardFilter: string;
  customStart: string;
  customEnd: string;
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
    const end = new Date(todayStart.getTime() - 1);
    return { start, end };
  }
  if (filter === "weekly") {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 6);
    return { start, end: todayEnd };
  }
  if (filter === "monthly") {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: todayEnd
    };
  }
  if (filter === "yearly") {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: todayEnd
    };
  }
  if (filter === "custom") {
    if (!customStart || !customEnd) return null;
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
  const date = safeDate(value);
  return !!date && date.getTime() >= bounds.start.getTime() && date.getTime() <= bounds.end.getTime();
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function ProductSalesBreakdown({
  products = [],
  transactions = [],
  storeEmail,
  dashboardFilter,
  customStart,
  customEnd
}: ProductSalesBreakdownProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const todayKey = new Date().toDateString();
  const report = useMemo(() => {
    const bounds = getPeriodBounds(dashboardFilter, customStart, customEnd);
    const safeProducts = Array.isArray(products) ? products : [];
    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const categoryMap = new Map<string, { name: string; units: number; products: Map<string, { name: string; units: number; productId?: string }> }>();
    // Normalize category/product names conservatively. Do not use SKU/model aliases:
    // those can be shared or formatted differently and may assign an item to another category.
    const normalize = (value: any) => String(value ?? "")
      .trim()
      .toLocaleLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const productById = new Map<string, any>();
    const productsByName = new Map<string, any | null>();
    safeProducts.forEach((product: any) => {
      if (!product) return;
      const ids = [
        product.id, product.firestoreId, product.productId, product.product_id,
        product.id ? toUUID(String(product.id), storeEmail) : "",
        product.firestoreId ? toUUID(String(product.firestoreId), storeEmail) : ""
      ];
      ids.map((id: any) => String(id || "").trim()).filter(Boolean)
        .forEach((id: string) => productById.set(id, product));

      const productName = normalize(product.name || product.productName || product.product_name);
      if (productName) {
        // A duplicate name is ambiguous: never guess which product/category it means.
        if (productsByName.has(productName)) productsByName.set(productName, null);
        else productsByName.set(productName, product);
      }
    });

    let totalUnits = 0;
    safeTransactions.forEach((transaction: any) => {
      if (!transaction || !isInsidePeriod(transaction.date, bounds) || !Array.isArray(transaction.items)) return;
      transaction.items.forEach((item: any) => {
        const quantity = Number(item?.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) return;

        const itemName = String(item?.name || item?.productName || item?.product_name || "Unnamed Product").trim() || "Unnamed Product";
        const itemProductId = String(item?.productId || item?.product_id || item?.productID || "").trim();
        // Prefer exact product identifiers. If an old sale has no resolvable ID,
        // use only a unique exact product-name match; never match by model/SKU fragments.
        const normalizedItemName = normalize(itemName);
        const matchedProduct = (itemProductId ? productById.get(itemProductId) : undefined)
          || (itemProductId ? productById.get(toUUID(itemProductId, storeEmail)) : undefined)
          || (normalizedItemName ? productsByName.get(normalizedItemName) || undefined : undefined);

        const currentProductCategory = String(matchedProduct?.category || matchedProduct?.productCategory || matchedProduct?.product_category || "").trim();
        const savedItemCategory = String(item?.category || item?.productCategory || item?.product_category || "").trim();

        // The Products list is the source of truth for a matched product.
        // Do not let an old transaction's saved category override its current category.
        // Only fall back to the historical sale category when the product cannot be matched
        // or the product record has no category value at all.
        const categoryName = matchedProduct
          ? (currentProductCategory || "Uncategorized")
          : (savedItemCategory || "Uncategorized");

        const categoryKey = normalize(categoryName) || "uncategorized";
        const productKey = String(matchedProduct?.id || itemProductId || normalize(itemName));
        let category = categoryMap.get(categoryKey);
        if (!category) {
          category = { name: categoryName, units: 0, products: new Map() };
          categoryMap.set(categoryKey, category);
        }

        const existingProduct = category.products.get(productKey);
        if (existingProduct) {
          existingProduct.units += quantity;
        } else {
          category.products.set(productKey, {
            name: String(matchedProduct?.name || itemName),
            units: quantity,
            productId: String(matchedProduct?.id || itemProductId || "") || undefined
          });
        }
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
  }, [products, transactions, dashboardFilter, customStart, customEnd, storeEmail, todayKey]);

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
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-extrabold tracking-wide text-white">Product Sales Breakdown</h2>
            <p className="mt-1 text-[10px] sm:text-xs text-slate-400">Category-wise and product-wise quantities · {periodLabel}</p>
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[10px] font-bold text-emerald-300">
          <ShoppingBag className="h-3.5 w-3.5" />
          {formatQuantity(report.totalUnits)} units sold
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">Category Sales Summary</h3>
          <span className="text-[10px] text-slate-500">Highest sales first · Units sold</span>
        </div>
        {report.categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-[#0e1422]/60 px-4 py-6 text-center text-xs text-slate-400">No category sales found for this period.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {report.categories.map((category, index) => (
              <div key={category.name.toLowerCase()} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0e1422] px-3.5 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-[10px] font-black text-indigo-300">{index + 1}</span>
                  <span className="truncate text-xs font-bold text-white">{category.name}</span>
                </div>
                <span className="shrink-0 text-lg font-black tabular-nums text-emerald-300">{formatQuantity(category.units)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">Category & Product Details</h3>
          <span className="text-[10px] text-slate-500">Select a category to view products</span>
        </div>

        {report.categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-[#0e1422]/60 px-4 py-10 text-center">
            <Package className="mx-auto h-7 w-7 text-slate-500" />
            <p className="mt-2 text-xs font-semibold text-slate-300">No product sales found for this period</p>
            <p className="mt-1 text-[10px] text-slate-500">Try another date range to view sales quantities.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {report.categories.map(category => {
              const isExpanded = expandedCategory === category.name;
              return (
                <div key={category.name.toLowerCase()} className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-[#0e1422]">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedCategory(isExpanded ? null : category.name)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/40"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300">
                        <Boxes className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-xs font-extrabold text-white">{category.name}</h4>
                        <p className="mt-0.5 text-[10px] text-slate-500">{category.products.length} product{category.products.length === 1 ? "" : "s"} · Click to {isExpanded ? "hide" : "view"} details</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <div className="text-lg font-black tabular-nums text-emerald-300">{formatQuantity(category.units)}</div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-500">units sold</div>
                      </div>
                      <span className="text-slate-400" aria-hidden="true">{isExpanded ? "−" : "+"}</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-800/80 divide-y divide-slate-800/70">
                      {category.products.map(product => (
                        <div key={product.productId || product.name} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-2">
                            <Package className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <span className="truncate text-[11px] font-medium text-slate-300">{product.name}</span>
                          </div>
                          <span className="shrink-0 text-xs font-bold tabular-nums text-white">{formatQuantity(product.units)} units</span>
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
