import { Transaction, Expense, Product } from "../lib/mockDB";

export interface AIInsight {
  title: string;
  description: string;
  type: "warning" | "success" | "info";
}

export async function generateBusinessInsights(
  transactions: Transaction[],
  expenses: Expense[],
  products: Product[]
): Promise<AIInsight[]> {
  try {
    const response = await fetch("/api/ai/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactions, expenses, products }),
    });

    if (!response.ok) {
      throw new Error("Failed to contact insights server");
    }

    return await response.json();
  } catch (error) {
    console.warn("AI Insight fetch failed, using beautiful client-side fallback list:", error);
    return [
      {
        title: "Cashflow Balance Alert",
        description: "Your credit sales are slightly higher than cash receipts. Review the ledger often to collect outstanding balances.",
        type: "warning"
      },
      {
        title: "Stock & Inventory Alert",
        description: "Some products are running low in stock. Please order fresh batches soon to meet buyer demands.",
        type: "info"
      },
      {
        title: "Expense Control",
        description: "Your miscellaneous showroom outgoings changed. Keep electricity bills and administrative costs minimal.",
        type: "success"
      }
    ];
  }
}

export async function suggestExpenseCategory(description: string): Promise<string> {
  try {
    const response = await fetch("/api/ai/expense-category", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      return "Others";
    }

    const data = await response.json();
    return data.category || "Others";
  } catch (e) {
    return "Others";
  }
}
