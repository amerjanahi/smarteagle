import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/sales")({
  head: () => ({ meta: [{ title: "Sales — Hayy Admin" }] }),
  component: SalesPage,
});

function SalesPage() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Sales</h2>
        <p className="text-sm text-muted-foreground">Track unit sales, deposits, and revenue.</p>
      </header>
      <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="font-medium">Sales module coming soon</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Record sale agreements, deposits, and payment schedules per unit.
        </p>
      </div>
    </div>
  );
}
