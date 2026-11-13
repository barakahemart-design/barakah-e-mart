export interface CostLot {
  id: string;
  purchaseId?: string;
  source: "opening" | "purchase" | "manual" | "recovered" | "reconciliation";
  receivedAt: string;
  receivedQuantity: number;
  remainingQuantity: number;
  unitCost: number;
}

export interface CostAllocation {
  id: string;
  lotId?: string;
  purchaseId?: string;
  source: string;
  quantity: number;
  unitCost: number;
}

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const cleanQty = (value: unknown): number => Math.max(0, num(value));
const EPSILON = 0.000001;

function makeUnitAllocations(
  quantity: number,
  unitCost: number,
  lotId: string | undefined,
  purchaseId: string | undefined,
  source: string,
  seed: string
): CostAllocation[] {
  const qty = cleanQty(quantity);
  if (qty <= EPSILON) return [];

  if (Number.isInteger(qty) && qty <= 100) {
    return Array.from({ length: qty }, (_, index) => ({
      id: `${seed}-${index + 1}`,
      ...(lotId ? { lotId } : {}),
      ...(purchaseId ? { purchaseId } : {}),
      source,
      quantity: 1,
      unitCost
    }));
  }

  return [{
    id: seed,
    ...(lotId ? { lotId } : {}),
    ...(purchaseId ? { purchaseId } : {}),
    source,
    quantity: qty,
    unitCost
  }];
}

/**
 * Adds a cost-lot view to legacy products without changing their stock count.
 * Existing stock is represented by one opening lot at the catalog cost that
 * was in effect when tracking first begins.
 */
export function normalizeCostLots(product: any): CostLot[] {
  const stock = cleanQty(product?.stock);
  const rawLots = Array.isArray(product?.costLots) ? product.costLots : [];

  if (rawLots.length === 0) {
    if (stock <= EPSILON) return [];
    return [{
      id: `opening-${product?.id || "product"}`,
      source: "opening",
      receivedAt: "1970-01-01T00:00:00.000Z",
      receivedQuantity: stock,
      remainingQuantity: stock,
      unitCost: Math.max(0, num(product?.buyPrice))
    }];
  }

  const lots: CostLot[] = rawLots.map((lot: any, index: number) => ({
    id: String(lot?.id || `legacy-lot-${index}`),
    ...(lot?.purchaseId ? { purchaseId: String(lot.purchaseId) } : {}),
    source: (lot?.source || "purchase") as CostLot["source"],
    receivedAt: String(lot?.receivedAt || "1970-01-01T00:00:00.000Z"),
    receivedQuantity: cleanQty(lot?.receivedQuantity ?? lot?.remainingQuantity),
    remainingQuantity: cleanQty(lot?.remainingQuantity),
    unitCost: Math.max(0, num(lot?.unitCost))
  }));

  const lotQty = lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
  if (lotQty + EPSILON < stock) {
    const gap = stock - lotQty;
    const reconciliationId = `reconciliation-${product?.id || "product"}`;
    const existing = lots.find(lot => lot.id === reconciliationId);
    if (existing) {
      existing.receivedQuantity += gap;
      existing.remainingQuantity += gap;
    } else {
      lots.push({
        id: reconciliationId,
        source: "reconciliation",
        receivedAt: new Date().toISOString(),
        receivedQuantity: gap,
        remainingQuantity: gap,
        unitCost: Math.max(0, num(product?.buyPrice))
      });
    }
  } else if (lotQty > stock + EPSILON) {
    // Product stock is authoritative if a legacy/manual adjustment left
    // the cost-lot quantities out of sync. Trim newest lots first.
    let excess = lotQty - stock;
    const newestFirst = [...lots].sort((a, b) =>
      new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
    for (const lot of newestFirst) {
      if (excess <= EPSILON) break;
      const trim = Math.min(lot.remainingQuantity, excess);
      lot.remainingQuantity -= trim;
      excess -= trim;
    }
  }

  return lots;
}

/** Consume available stock from the oldest cost lots first. Any oversold
 * quantity is explicitly marked unallocated and uses the catalog fallback
 * cost until an administrator specifies the actual cost in the ledger.
 */
export function allocateFifoCost(product: any, quantity: number, saleDate?: string): {
  product: any;
  allocations: CostAllocation[];
  averageUnitCost: number;
} {
  const qty = cleanQty(quantity);
  const lots = normalizeCostLots(product).sort((a, b) => {
    const dateDiff = new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
    return dateDiff || a.id.localeCompare(b.id);
  });
  let remaining = Math.min(qty, cleanQty(product?.stock));
  const allocations: CostAllocation[] = [];
  let allocationSequence = 0;

  for (const lot of lots) {
    if (remaining <= EPSILON) break;
    if (lot.remainingQuantity <= EPSILON) continue;
    const take = Math.min(lot.remainingQuantity, remaining);
    lot.remainingQuantity -= take;
    remaining -= take;
    allocationSequence += 1;
    allocations.push(...makeUnitAllocations(
      take,
      lot.unitCost,
      lot.id,
      lot.purchaseId,
      lot.source,
      `alloc-${product?.id || "product"}-${saleDate || Date.now()}-${allocationSequence}`
    ));
  }

  const unallocated = qty - allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  if (unallocated > EPSILON) {
    allocations.push(...makeUnitAllocations(
      unallocated,
      Math.max(0, num(product?.buyPrice)),
      undefined,
      undefined,
      "unallocated",
      `unallocated-${product?.id || "product"}-${saleDate || Date.now()}`
    ));
  }

  const totalCost = allocations.reduce((sum, allocation) => sum + allocation.quantity * allocation.unitCost, 0);
  return {
    product: {
      ...product,
      stock: num(product?.stock) - qty,
      costLots: lots
    },
    allocations,
    averageUnitCost: qty > EPSILON ? totalCost / qty : 0
  };
}

/** Restore a deleted/reduced sale item to the original lots where possible. */
export function restoreFifoCost(product: any, item: any): any {
  const qty = cleanQty(item?.quantity);
  if (qty <= EPSILON) return product;

  const lots = normalizeCostLots(product);
  const allocations: CostAllocation[] = Array.isArray(item?.costAllocations) && item.costAllocations.length
    ? item.costAllocations
    : makeUnitAllocations(
        qty,
        Math.max(0, num(item?.buyPrice ?? product?.buyPrice)),
        undefined,
        undefined,
        "legacy-return",
        `legacy-return-${item?.id || Date.now()}`
      );

  let restoredQty = 0;
  for (const allocation of allocations) {
    const allocationQty = cleanQty(allocation.quantity);
    if (allocationQty <= EPSILON) continue;
    restoredQty += allocationQty;
    const targetLot = allocation.lotId ? lots.find(lot => lot.id === allocation.lotId) : undefined;

    if (targetLot) {
      targetLot.remainingQuantity = Math.min(
        targetLot.receivedQuantity,
        targetLot.remainingQuantity + allocationQty
      );
    } else if (allocation.source !== "unallocated" && item?.isNegativeSale !== true) {
      lots.push({
        id: `recovered-${item?.id || Date.now()}-${allocation.id}`,
        source: "recovered",
        receivedAt: new Date().toISOString(),
        receivedQuantity: allocationQty,
        remainingQuantity: allocationQty,
        unitCost: Math.max(0, num(allocation.unitCost))
      });
    }
  }

  if (restoredQty + EPSILON < qty) {
    const missing = qty - restoredQty;
    lots.push({
      id: `recovered-${item?.id || Date.now()}-remainder`,
      source: "recovered",
      receivedAt: new Date().toISOString(),
      receivedQuantity: missing,
      remainingQuantity: missing,
      unitCost: Math.max(0, num(item?.buyPrice ?? product?.buyPrice))
    });
  }

  return {
    ...product,
    stock: num(product?.stock) + qty,
    costLots: lots
  };
}

/** Add a purchase batch as its own FIFO cost lot. */
export function addPurchaseCostLot(product: any, purchase: any): any {
  const lots = normalizeCostLots(product).filter(lot => lot.id !== String(purchase.id));
  const qty = cleanQty(purchase.quantity);
  if (qty > EPSILON) {
    lots.push({
      id: String(purchase.id),
      purchaseId: String(purchase.id),
      source: "purchase",
      receivedAt: String(purchase.date || new Date().toISOString()),
      receivedQuantity: qty,
      remainingQuantity: qty,
      unitCost: Math.max(0, num(purchase.buyPrice))
    });
  }

  return {
    ...product,
    stock: num(product?.stock) + qty,
    buyPrice: Math.max(0, num(purchase.buyPrice)),
    costLots: lots
  };
}

/** Update a purchase lot. Returns null when the edit would erase already-sold units. */
export function updatePurchaseCostLot(product: any, purchaseId: string, purchase: any): any | null {
  const lots = normalizeCostLots(product);
  const index = lots.findIndex(lot => lot.id === String(purchaseId) || lot.purchaseId === String(purchaseId));
  if (index < 0) return null;

  const lot = lots[index];
  const soldQuantity = Math.max(0, lot.receivedQuantity - lot.remainingQuantity);
  const nextQuantity = cleanQty(purchase.quantity);
  if (nextQuantity + EPSILON < soldQuantity) return null;

  const delta = nextQuantity - lot.receivedQuantity;
  lots[index] = {
    ...lot,
    receivedAt: String(purchase.date || lot.receivedAt),
    receivedQuantity: nextQuantity,
    remainingQuantity: Math.max(0, nextQuantity - soldQuantity),
    unitCost: Math.max(0, num(purchase.buyPrice))
  };

  return {
    ...product,
    stock: num(product?.stock) + delta,
    buyPrice: Math.max(0, num(purchase.buyPrice)),
    costLots: lots
  };
}

/** A purchase cannot be deleted after any of its units have been sold. */
export function removePurchaseCostLot(product: any, purchaseId: string): any | null {
  const lots = normalizeCostLots(product);
  const lot = lots.find(item => item.id === String(purchaseId) || item.purchaseId === String(purchaseId));
  if (!lot) return { ...product, costLots: lots };
  const soldQuantity = Math.max(0, lot.receivedQuantity - lot.remainingQuantity);
  if (soldQuantity > EPSILON) return null;

  return {
    ...product,
    stock: Math.max(0, num(product?.stock) - lot.remainingQuantity),
    costLots: lots.filter(item => item.id !== lot.id)
  };
}

/** Return stock only from the still-available quantity of the selected purchase lot. */
export function returnPurchaseCostLot(product: any, purchaseId: string, quantity: number): any | null {
  const lots = normalizeCostLots(product);
  const lot = lots.find(item => item.id === String(purchaseId) || item.purchaseId === String(purchaseId));
  if (!lot) return null;
  const qty = cleanQty(quantity);
  if (qty > lot.remainingQuantity + EPSILON) return null;

  lot.remainingQuantity = Math.max(0, lot.remainingQuantity - qty);
  lot.receivedQuantity = Math.max(0, lot.receivedQuantity - qty);
  return {
    ...product,
    stock: Math.max(0, num(product?.stock) - qty),
    costLots: lots
  };
}

/** Resize an already-sold line while preserving the cost of units that remain sold. */
export function resizeFifoSaleItem(product: any, oldItem: any, newItem: any, saleDate?: string): {
  product: any;
  item: any;
} {
  const oldQuantity = cleanQty(oldItem?.quantity);
  const newQuantity = cleanQty(newItem?.quantity);
  const oldAllocations = getCostAllocationsForItem(oldItem, product?.buyPrice ?? 0);

  const kept: CostAllocation[] = [];
  const released: CostAllocation[] = [];
  let keepRemaining = Math.min(oldQuantity, newQuantity);

  for (const allocation of oldAllocations) {
    const allocationQty = cleanQty(allocation.quantity);
    if (keepRemaining <= EPSILON) {
      released.push({ ...allocation });
      continue;
    }
    const keepQty = Math.min(allocationQty, keepRemaining);
    if (keepQty > EPSILON) kept.push({ ...allocation, quantity: keepQty });
    const releaseQty = allocationQty - keepQty;
    if (releaseQty > EPSILON) {
      released.push({
        ...allocation,
        id: `${allocation.id}-released`,
        quantity: releaseQty
      });
    }
    keepRemaining -= keepQty;
  }

  let nextProduct = product;
  let nextAllocations = kept;

  if (newQuantity < oldQuantity) {
    const releasedQuantity = oldQuantity - newQuantity;
    const releasedItem = {
      ...oldItem,
      quantity: releasedQuantity,
      costAllocations: released,
      buyPrice: getAverageCostFromAllocations({ quantity: releasedQuantity, costAllocations: released }, oldItem?.buyPrice ?? 0)
    };
    nextProduct = restoreFifoCost(nextProduct, releasedItem);
  } else if (newQuantity > oldQuantity) {
    const additional = allocateFifoCost(nextProduct, newQuantity - oldQuantity, saleDate);
    nextProduct = additional.product;
    nextAllocations = [...kept, ...additional.allocations];
  }

  const totalQty = nextAllocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  const totalCost = nextAllocations.reduce((sum, allocation) => sum + allocation.quantity * allocation.unitCost, 0);
  return {
    product: nextProduct,
    item: {
      ...newItem,
      costAllocations: nextAllocations,
      buyPrice: totalQty > EPSILON ? totalCost / totalQty : Math.max(0, num(newItem?.buyPrice))
    }
  };
}

/** Legacy sale lines are expanded to individual units for the ledger editor. */
export function getCostAllocationsForItem(item: any, fallbackUnitCost = 0): CostAllocation[] {
  if (Array.isArray(item?.costAllocations) && item.costAllocations.length) {
    return item.costAllocations.map((allocation: any, index: number) => ({
      id: String(allocation?.id || `allocation-${index + 1}`),
      ...(allocation?.lotId ? { lotId: String(allocation.lotId) } : {}),
      ...(allocation?.purchaseId ? { purchaseId: String(allocation.purchaseId) } : {}),
      source: String(allocation?.source || "legacy"),
      quantity: cleanQty(allocation?.quantity) || 1,
      unitCost: Math.max(0, num(allocation?.unitCost))
    }));
  }

  const qty = cleanQty(item?.quantity);
  const cost = Math.max(0, num(item?.buyPrice ?? fallbackUnitCost));
  return makeUnitAllocations(
    qty,
    cost,
    undefined,
    undefined,
    "legacy",
    `legacy-${item?.id || "item"}`
  );
}

/** Average per-unit cost used by legacy reports that multiply unit cost by quantity. */
export function getAverageCostFromAllocations(item: any, fallbackUnitCost = 0): number {
  const allocations = getCostAllocationsForItem(item, fallbackUnitCost);
  const quantity = allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  if (quantity <= EPSILON) return Math.max(0, num(item?.buyPrice ?? fallbackUnitCost));
  const totalCost = allocations.reduce((sum, allocation) => sum + allocation.quantity * allocation.unitCost, 0);
  return totalCost / quantity;
}

/** Change one sold-unit cost without touching other units or the catalog cost. */
export function updateOneCostAllocation(item: any, allocationIndex: number, unitCost: number): any {
  const allocations = getCostAllocationsForItem(item, item?.buyPrice ?? 0);
  if (allocationIndex < 0 || allocationIndex >= allocations.length) return item;
  allocations[allocationIndex] = {
    ...allocations[allocationIndex],
    unitCost: Math.max(0, num(unitCost))
  };
  const totalQty = allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  const totalCost = allocations.reduce((sum, allocation) => sum + allocation.quantity * allocation.unitCost, 0);
  return {
    ...item,
    costAllocations: allocations,
    buyPrice: totalQty > EPSILON ? totalCost / totalQty : Math.max(0, num(unitCost))
  };
}

/** Set all allocations on a line to one manually specified cost. */
export function updateAllCostAllocations(item: any, unitCost: number): any {
  const allocations = getCostAllocationsForItem(item, item?.buyPrice ?? 0).map(allocation => ({
    ...allocation,
    unitCost: Math.max(0, num(unitCost))
  }));
  return {
    ...item,
    costAllocations: allocations,
    buyPrice: Math.max(0, num(unitCost))
  };
}
