import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Hayy Admin" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Expenses</h2>
        <p className="text-sm text-muted-foreground">Operating costs, vendor bills, and reimbursements.</p>
      </header>
      <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="font-medium">Expenses module coming soon</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Log vendor invoices, categorize costs, and reconcile against budget.
        </p>
      </div>
    </div>
  );
}
