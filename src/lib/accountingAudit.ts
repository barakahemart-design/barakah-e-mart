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
export function auditAccountingRecords(transactions: any[] = [], products: any[] = [], purchases: any[] = [], expenses: any[] = [], staffList: any[] = []): AccountingAuditIssue[] {
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

    const returnHistory = Array.isArray(transaction.returnHistory) ? transaction.returnHistory : [];
    const returnedByLine = new Map<string, number>();
    returnHistory.forEach((entry: any) => {
      const calculatedRefund = roundMoney(
        (asFiniteNumber(entry?.subtotalAmount) || 0) +
        (asFiniteNumber(entry?.taxAmount) || 0) -
        (asFiniteNumber(entry?.discountAmount) || 0)
      );
      const savedRefund = asFiniteNumber(entry?.refundAmount);
      if (savedRefund !== null && Math.abs(calculatedRefund - savedRefund) > 0.02) {
        issues.push({
          id: `return-value-${transaction.id || index}-${entry.id || returnHistory.indexOf(entry)}`,
          invoiceNo,
          message: "Return amount does not reconcile after its proportional VAT and discount adjustment."
        });
      }
      (Array.isArray(entry?.items) ? entry.items : []).forEach((line: any) => {
        const lineId = String(line?.transactionItemId || "");
        if (!lineId) return;
        returnedByLine.set(lineId, (returnedByLine.get(lineId) || 0) + (Number(line?.quantity) || 0));
      });
    });

    const refundHistory = Array.isArray(transaction.refundHistory) ? transaction.refundHistory : [];
    const refundTotal = refundHistory.reduce((sum: number, refund: any) => sum + Math.max(0, Number(refund?.amount) || 0), 0);
    const returnCashTotal = returnHistory.reduce((sum: number, entry: any) => sum + Math.max(0, Number(entry?.cashRefund) || 0), 0);
    if (Math.abs(roundMoney(refundTotal) - roundMoney(returnCashTotal)) > 0.02) {
      issues.push({
        id: `refund-history-${transaction.id || index}`,
        invoiceNo,
        message: "Cash refund history does not match the cash refund amounts saved in return records."
      });
    }
    if (refundTotal > 0) {
      const paymentHistory = Array.isArray(transaction.paymentHistory) ? transaction.paymentHistory : [];
      const recordedCollections = paymentHistory.reduce((sum: number, payment: any) => sum + Math.max(0, Number(payment?.amount) || 0), 0);
      if (paymentHistory.length > 0 && refundTotal > recordedCollections + 0.02) {
        issues.push({
          id: `refund-over-collection-${transaction.id || index}`,
          invoiceNo,
          message: "Cash refunds exceed the collection amounts recorded in payment history. Verify the original payment record."
        });
      }
    }
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

  (Array.isArray(products) ? products : []).forEach((product: any, index: number) => {
    const productName = String(product?.name || product?.id || `Product ${index + 1}`);
    const stock = asFiniteNumber(product?.stock);
    if (stock !== null && stock < -0.000001) {
      issues.push({ id: `negative-stock-${product.id || index}`, invoiceNo: productName, message: "Product currently has negative stock; reconcile outstanding Minus Sale quantities." });
    }
    const lots = Array.isArray(product?.costLots) ? product.costLots : (Array.isArray(product?.cost_lots) ? product.cost_lots : []);
    if (lots.length > 0 && stock !== null && stock >= 0 && product?.hasNegativeSale !== true) {
      const lotQuantity = lots.reduce((sum: number, lot: any) => sum + Math.max(0, Number(lot?.remainingQuantity) || 0), 0);
      if (Math.abs(lotQuantity - stock) > 0.02) {
        issues.push({ id: `fifo-stock-${product.id || index}`, invoiceNo: productName, message: `FIFO remaining lots (${roundMoney(lotQuantity)}) do not match product stock (${roundMoney(stock)}). Check manual stock adjustments and purchase lots.` });
      }
    }
  });

  (Array.isArray(purchases) ? purchases : []).forEach((purchase: any, index: number) => {
    const quantity = asFiniteNumber(purchase?.quantity);
    const buyPrice = asFiniteNumber(purchase?.buyPrice ?? purchase?.buy_price ?? purchase?.unitPrice);
    const total = asFiniteNumber(purchase?.totalAmount ?? purchase?.total_amount);
    const purchaseNo = String(purchase?.invoiceNo || purchase?.invoice_no || purchase?.id || `Purchase ${index + 1}`);
    if (quantity !== null && buyPrice !== null && total !== null && quantity > 0 && Math.abs(roundMoney(quantity * buyPrice) - roundMoney(total)) > 1.5) {
      issues.push({ id: `purchase-total-${purchase.id || index}`, invoiceNo: purchaseNo, message: "Purchase quantity × unit buy price does not match its saved total." });
    }
    const cashPaid = asFiniteNumber(purchase?.cashPaid ?? purchase?.cash_paid);
    const due = asFiniteNumber(purchase?.dueAmount ?? purchase?.due_amount);
    if (total !== null && cashPaid !== null && due !== null && Math.abs(roundMoney(Math.max(0, total - cashPaid)) - roundMoney(due)) > 1.5) {
      issues.push({ id: `purchase-due-${purchase.id || index}`, invoiceNo: purchaseNo, message: "Supplier paid amount plus due does not reconcile to the purchase total." });
    }
  });

  const salaryPaidByDay = new Map<string, number>();
  (Array.isArray(staffList) ? staffList : []).forEach((staff: any) => {
    (Array.isArray(staff?.salaryPayments) ? staff.salaryPayments : []).filter((payment: any) => payment?.status === "paid").forEach((payment: any) => {
      const date = String(payment?.paymentDate || "").slice(0, 10);
      if (date) salaryPaidByDay.set(date, (salaryPaidByDay.get(date) || 0) + (Number(payment?.amount) || 0));
    });
  });
  const manualSalaryByDay = new Map<string, number>();
  (Array.isArray(expenses) ? expenses : []).filter((expense: any) => /salary|payroll/i.test(String(expense?.category || ""))).forEach((expense: any) => {
    const date = String(expense?.date || "").slice(0, 10);
    if (date) manualSalaryByDay.set(date, (manualSalaryByDay.get(date) || 0) + (Number(expense?.amount) || 0));
  });
  salaryPaidByDay.forEach((amount, date) => {
    const manualAmount = manualSalaryByDay.get(date);
    if (manualAmount !== undefined && Math.abs(roundMoney(amount) - roundMoney(manualAmount)) <= 0.02) {
      issues.push({ id: `salary-duplicate-${date}`, invoiceNo: `Salary ${date}`, message: "Paid Staff Hub salaries match manual Salary expense totals for this date; confirm the two sources are not counted twice." });
    }
  });

  return issues;
}
