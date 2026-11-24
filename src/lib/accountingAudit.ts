export type AccountingAuditIssue = {
  id: string;
  invoiceNo: string;
  message: string;
};

const asFiniteNumber = (value: any): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

/**
 * Read-only consistency checks over records already loaded by the app's
 * existing Firestore listeners. This function performs no reads or writes.
 */
export function auditAccountingRecords(transactions: any[] = []): AccountingAuditIssue[] {
  const issues: AccountingAuditIssue[] = [];
  const seenInvoices = new Set<string>();

  (Array.isArray(transactions) ? transactions : []).forEach((transaction, index) => {
    if (!transaction || typeof transaction !== "object") return;
    const invoiceNo = String(transaction.invoiceNo || transaction.invoice_no || transaction.id || `Record ${index + 1}`);
    const invoiceKey = String(transaction.invoiceNo || transaction.invoice_no || "").trim().toLowerCase();

    if (invoiceKey) {
      if (seenInvoices.has(invoiceKey)) {
        issues.push({ id: `duplicate-${transaction.id || index}`, invoiceNo, message: "Duplicate invoice number found." });
      } else {
        seenInvoices.add(invoiceKey);
      }
    }

    const subtotal = asFiniteNumber(transaction.subtotal);
    const tax = asFiniteNumber(transaction.tax ?? transaction.tax_amount);
    const discount = asFiniteNumber(transaction.discount);
    const total = asFiniteNumber(transaction.total ?? transaction.total_amount);

    if (subtotal !== null && tax !== null && discount !== null && total !== null) {
      const expectedTotal = roundMoney(subtotal + tax - discount);
      if (Math.abs(expectedTotal - total) > 0.02) {
        issues.push({
          id: `total-${transaction.id || index}`,
          invoiceNo,
          message: `Invoice total does not reconcile (expected ${expectedTotal.toFixed(2)}, saved ${total.toFixed(2)}).`
        });
      }
    }

    const paid = asFiniteNumber(transaction.paidAmount ?? transaction.paid_amount);
    const due = asFiniteNumber(transaction.dueBalance ?? transaction.due_balance);
    if (paid !== null && due !== null && total !== null && Math.abs(roundMoney(paid + due) - total) > 0.02) {
      issues.push({
        id: `balance-${transaction.id || index}`,
        invoiceNo,
        message: `Paid amount plus outstanding due does not equal the invoice total.`
      });
    }

    const items = Array.isArray(transaction.items) ? transaction.items : [];
    if (items.length > 0 && subtotal !== null) {
      let lineSubtotal = 0;
      let canReconcileLines = true;
      items.forEach((item: any) => {
        const quantity = asFiniteNumber(item?.quantity);
        const price = asFiniteNumber(item?.price ?? item?.sell_price);
        if (quantity === null || price === null) {
          canReconcileLines = false;
          return;
        }
        lineSubtotal += quantity * price;
      });

      if (canReconcileLines) {
        const returnedSubtotal = (Array.isArray(transaction.returnHistory) ? transaction.returnHistory : [])
          .reduce((sum: number, entry: any) => {
            const recorded = asFiniteNumber(entry?.subtotalAmount);
            if (recorded !== null) return sum + recorded;
            return sum + (Array.isArray(entry?.items) ? entry.items.reduce((lineSum: number, line: any) => {
              const quantity = asFiniteNumber(line?.quantity);
              const price = asFiniteNumber(line?.unitSellPrice);
              return quantity !== null && price !== null ? lineSum + quantity * price : lineSum;
            }, 0) : 0);
          }, 0);
        const expectedSubtotal = roundMoney(Math.max(0, lineSubtotal - returnedSubtotal));
        if (Math.abs(expectedSubtotal - subtotal) > 0.02) {
          issues.push({
            id: `subtotal-${transaction.id || index}`,
            invoiceNo,
            message: `Product line values after recorded returns do not match the saved invoice subtotal.`
          });
        }
      }
    }

    const returnedByLine = new Map<string, number>();
    (Array.isArray(transaction.returnHistory) ? transaction.returnHistory : []).forEach((entry: any) => {
      (Array.isArray(entry?.items) ? entry.items : []).forEach((line: any) => {
        const lineId = String(line?.transactionItemId || "");
        if (!lineId) return;
        returnedByLine.set(lineId, (returnedByLine.get(lineId) || 0) + (Number(line?.quantity) || 0));
      });
    });
    items.forEach((item: any, itemIndex: number) => {
      const lineId = String(item?.firestoreId || item?.id || `${transaction.id}_item_${itemIndex}`);
      const returned = returnedByLine.get(lineId) || 0;
      const sold = Math.max(0, Number(item?.quantity) || 0);
      if (returned > sold + 0.000001) {
        issues.push({
          id: `return-qty-${transaction.id || index}-${itemIndex}`,
          invoiceNo,
          message: `Returned quantity exceeds the original sold quantity for ${item?.name || "a product line"}.`
        });
      }
    });
  });

  return issues;
}
