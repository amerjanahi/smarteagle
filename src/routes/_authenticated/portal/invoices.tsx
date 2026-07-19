import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { FileText, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/portal/invoices")({
  head: () => ({ meta: [{ title: "Invoices — Hayy" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const { user } = useAuth();
  const { format: money } = useCurrency();
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["portal-invoices", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: residents } = await supabase
        .from("residents")
        .select("unit_id")
        .eq("user_id", user!.id);
      const unitIds = (residents ?? []).map((r) => r.unit_id).filter(Boolean) as string[];
      if (unitIds.length === 0) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("*, units(building, unit_number)")
        .in("unit_id", unitIds)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const outstanding = (invoices ?? []).reduce(
    (sum, i) => sum + Number(i.amount) - Number(i.amount_paid ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Outstanding: <span className="font-semibold text-foreground">{money(outstanding)}</span>
        </p>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && (invoices?.length ?? 0) === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto mb-2 h-6 w-6" />
          No invoices yet
        </div>
      )}

      <ul className="space-y-2">
        {invoices?.map((inv) => {
          const due = Number(inv.amount) - Number(inv.amount_paid ?? 0);
          const overdue = inv.status !== "paid" && inv.due_date && new Date(inv.due_date) < new Date();
          return (
            <li
              key={inv.id}
              className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{inv.description ?? "Service charge"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Due {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold">BHD {Number(inv.amount).toFixed(3)}</p>
                  <Badge variant={inv.status === "paid" ? "secondary" : overdue ? "destructive" : "outline"}>
                    {inv.status}
                  </Badge>
                  {due > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Remaining BHD {due.toFixed(3)}
                    </p>
                  )}
                </div>
              </div>
              {overdue && (
                <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /> Past due
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
