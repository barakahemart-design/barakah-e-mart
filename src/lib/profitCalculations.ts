export type HistoricalCogsResult = {
  totalCogs: number;
  complete: boolean;
  incompleteLines: Array<{ transactionId: string; invoiceNo: string; itemId: string; productName: string; reason: string }>;
};

/**
 * Calculate COGS strictly from immutable sale-time cost snapshots.
 * Never read today's product catalog price and never invent a percentage cost.
 */
export function calculateHistoricalCogs(transactions: any[] = []): HistoricalCogsResult {
  const incompleteLines: HistoricalCogsResult["incompleteLines"] = [];
  let totalCogs = 0;
  const EPSILON = 0.000001;

  const readAllocations = (item: any) => {
    const value = Array.isArray(item?.costAllocations) ? item.costAllocations :
      (Array.isArray(item?.cost_allocations) ? item.cost_allocations : []);
    return value;
  };
  const readUnitCost = (item: any): number | null => {
    for (const key of ["buyPrice", "cost_price", "buy_price"]) {
      const raw = item?.[key];
      if (raw === undefined || raw === null || raw === "") continue;
      const value = Number(raw);
      if (Number.isFinite(value) && value >= 0) return value;
    }
    return null;
  };
  const sumAllocations = (allocations: any[]): { quantity: number; cost: number } | null => {
    let quantity = 0;
    let cost = 0;
    for (const allocation of allocations) {
      const qty = Number(allocation?.quantity);
      const unitCost = Number(allocation?.unitCost ?? allocation?.unit_cost);
      if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(unitCost) || unitCost < 0) return null;
      quantity += qty;
      cost += qty * unitCost;
    }
    return { quantity, cost };
  };

  (Array.isArray(transactions) ? transactions : []).forEach((transaction: any, txIndex: number) => {
    if (!transaction || typeof transaction !== "object") return;
    const items = Array.isArray(transaction.items) ? transaction.items : [];
    const returns = (Array.isArray(transaction.returnHistory) ? transaction.returnHistory :
      (Array.isArray(transaction.return_history) ? transaction.return_history : []))
      .flatMap((entry: any) => Array.isArray(entry?.items) ? entry.items : []);

    items.forEach((item: any, itemIndex: number) => {
      if (!item) return;
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) {
        incompleteLines.push({ transactionId: String(transaction.id || ""), invoiceNo: String(transaction.invoiceNo || transaction.invoice_no || transaction.id || "Unknown invoice"), itemId: String(item.id || item.firestoreId || itemIndex), productName: String(item.name || "Product"), reason: "Invalid sold quantity." });
        return;
      }
      if (quantity <= EPSILON) return;

      const itemId = String(item.firestoreId || item.id || `${transaction.id || txIndex}_item_${itemIndex}`);
      const allocations = readAllocations(item);
      let originalCost: number | null = null;
      let unitCost: number | null = null;
      if (allocations.length) {
        const totals = sumAllocations(allocations);
        if (totals && Math.abs(totals.quantity - quantity) <= EPSILON) {
          originalCost = totals.cost;
          unitCost = totals.cost / quantity;
        }
      } else {
        unitCost = readUnitCost(item);
        if (unitCost !== null) originalCost = unitCost * quantity;
      }

      const returnedLines = returns.filter((line: any) =>
        String(line?.transactionItemId || line?.transaction_item_id || "") === itemId
      );
      const returnedQuantity = returnedLines.reduce((sum: number, line: any) =>
        sum + Math.max(0, Number(line?.quantity) || 0), 0);
      if (returnedQuantity > quantity + EPSILON) {
        incompleteLines.push({ transactionId: String(transaction.id || ""), invoiceNo: String(transaction.invoiceNo || transaction.invoice_no || transaction.id || "Unknown invoice"), itemId, productName: String(item.name || "Product"), reason: "Returned quantity exceeds the sold quantity." });
        return;
      }

      if (originalCost === null) {
        incompleteLines.push({ transactionId: String(transaction.id || ""), invoiceNo: String(transaction.invoiceNo || transaction.invoice_no || transaction.id || "Unknown invoice"), itemId, productName: String(item.name || "Product"), reason: allocations.length ? "FIFO allocation quantity/cost does not reconcile with the sold quantity." : "Historical sale cost is missing; current catalog cost is intentionally not used." });
        return;
      }

      let returnedCost = 0;
      let returnCostComplete = true;
      if (returnedQuantity > EPSILON) {
        // New return records carry their exact returnedCost. Legacy records can
        // use their saved allocation slice, or a uniform sale-time unit cost.
        for (const line of returnedLines) {
          const lineQty = Math.max(0, Number(line?.quantity) || 0);
          if (line?.returnedCost !== undefined && line?.returnedCost !== null && line?.returnedCost !== "") {
            const value = Number(line.returnedCost);
            if (!Number.isFinite(value) || value < 0) { returnCostComplete = false; break; }
            returnedCost += value;
            continue;
          }
          const lineAllocations = Array.isArray(line?.costAllocations) ? line.costAllocations :
            (Array.isArray(line?.cost_allocations) ? line.cost_allocations : []);
          if (lineAllocations.length) {
            const totals = sumAllocations(lineAllocations);
            if (!totals || Math.abs(totals.quantity - lineQty) > EPSILON) { returnCostComplete = false; break; }
            returnedCost += totals.cost;
            continue;
          }
          if (unitCost !== null) {
            returnedCost += unitCost * lineQty;
          } else {
            returnCostComplete = false;
            break;
          }
        }
      }
      if (!returnCostComplete || returnedCost > originalCost + 0.02) {
        incompleteLines.push({ transactionId: String(transaction.id || ""), invoiceNo: String(transaction.invoiceNo || transaction.invoice_no || transaction.id || "Unknown invoice"), itemId, productName: String(item.name || "Product"), reason: "Returned units do not have a reliable matching historical cost." });
        return;
      }
      totalCogs += Math.max(0, originalCost - returnedCost);
    });
  });

  return { totalCogs, complete: incompleteLines.length === 0, incompleteLines };
}
