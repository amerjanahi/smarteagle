import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { FileText, AlertCircle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/portal/invoices")({
  head: () => ({ meta: [{ title: "Invoices — Hayy" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const { user } = useAuth();
  const { format: money } = useCurrency();
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
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
        .select("*, units(building, unit_number), invoice_line_items(*)")
        .in("unit_id", unitIds)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const outstanding = (invoices ?? []).reduce(
    (sum, invoice) => sum + Number(invoice.amount) - Number(invoice.amount_paid ?? 0),
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
        {invoices?.map((invoice) => {
          const due = Number(invoice.amount) - Number(invoice.amount_paid ?? 0);
          const overdue = invoice.status !== "paid" && invoice.due_date && new Date(invoice.due_date) < new Date();
          return (
            <li key={invoice.id} className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
              <button
                type="button"
                className="w-full rounded-xl p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => setSelectedInvoice(invoice)}
                aria-label={`View invoice ${invoice.invoice_number}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{invoice.invoice_number}</p>
                    <p className="truncate text-xs text-muted-foreground">{invoice.description ?? "Service charge"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Due {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <p className="font-display text-lg font-bold">{money(invoice.amount)}</p>
                      <Badge variant={invoice.status === "paid" ? "secondary" : overdue ? "destructive" : "outline"}>
                        {invoice.status}
                      </Badge>
                      {due > 0 && <p className="mt-1 text-xs text-muted-foreground">Remaining {money(due)}</p>}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                </div>
                {overdue && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3" /> Past due
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto rounded-xl p-4 sm:p-6">
          <DialogHeader className="pr-7 text-left">
            <DialogTitle>Invoice {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Unit</p><p className="font-medium">{selectedInvoice.units?.building} · {selectedInvoice.units?.unit_number}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge className="capitalize">{selectedInvoice.status}</Badge></div>
                <div><p className="text-xs text-muted-foreground">Issued</p><p className="font-medium">{new Date(selectedInvoice.created_at).toLocaleDateString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Due</p><p className="font-medium">{selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : "—"}</p></div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Invoice items</h3>
                {(selectedInvoice.invoice_line_items ?? []).map((line: any) => (
                  <div key={line.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                    <div><p className="font-medium">{line.description}</p><p className="text-xs text-muted-foreground">{line.quantity} × {money(line.unit_price)} · VAT {line.tax_rate}%</p></div>
                    <p className="shrink-0 font-medium">{money(line.line_total)}</p>
                  </div>
                ))}
                {!selectedInvoice.invoice_line_items?.length && (
                  <div className="rounded-lg border p-3 text-sm">{selectedInvoice.description ?? "Invoice total"}</div>
                )}
              </div>

              <div className="ml-auto grid max-w-sm grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground">Invoice total</span><span className="text-right font-medium">{money(selectedInvoice.amount)}</span>
                <span className="text-muted-foreground">Paid</span><span className="text-right">{money(selectedInvoice.amount_paid ?? 0)}</span>
                <span className="border-t pt-2 font-semibold">Remaining</span><span className="border-t pt-2 text-right font-semibold">{money(Math.max(Number(selectedInvoice.amount) - Number(selectedInvoice.amount_paid ?? 0), 0))}</span>
              </div>

              {selectedInvoice.notes && (
                <div className="rounded-lg border p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
