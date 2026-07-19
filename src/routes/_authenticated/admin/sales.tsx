import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { salesDashboard } from "@/lib/sales.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Receipt, CreditCard, BarChart3, FileSignature, Settings, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/sales")({
  head: () => ({ meta: [{ title: "Sales — Hayy Admin" }] }),
  component: SalesDashboard,
});

import { useCurrency } from "@/hooks/use-currency";

function SalesDashboard() {
  const { format: money } = useCurrency();
  const fetchDash = useServerFn(salesDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["sales-dashboard"],
    queryFn: () => fetchDash(),
  });

  const tiles = [
    { label: "Outstanding", value: money(data?.outstanding ?? 0), tone: "text-amber-600" },
    { label: "Overdue", value: money(data?.overdue ?? 0), tone: "text-red-600" },
    { label: "Paid (recent)", value: money(data?.paidThisMonth ?? 0), tone: "text-emerald-600" },
    { label: "Total Invoiced", value: money(data?.totalInvoiced ?? 0), tone: "text-foreground" },
  ];

  const quick = [
    { to: "/admin/invoices", label: "Invoices", icon: FileText, desc: "Create and manage sales invoices" },
    { to: "/admin/payments", label: "Payments", icon: CreditCard, desc: "Record receipts and allocations" },
    { to: "/admin/credit-notes", label: "Credit Notes", icon: Receipt, desc: "Issue and apply credit notes" },
    { to: "/admin/statements", label: "Statements", icon: FileSignature, desc: "Customer account statements" },
    { to: "/admin/templates", label: "Templates", icon: Settings, desc: "Customize document layouts" },
    { to: "/admin/audit", label: "Audit Log", icon: ShieldCheck, desc: "Full transaction history" },
    { to: "/admin/reports", label: "Reports", icon: BarChart3, desc: "Aged receivables and analytics" },
  ] as const;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Sales</h2>
        <p className="text-sm text-muted-foreground">Invoices, payments, credit notes, statements, and templates.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{t.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${t.tone}`}>{isLoading ? "…" : t.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quick.map((q) => (
          <Link key={q.to} to={q.to} className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <q.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{q.label}</p>
                <p className="text-xs text-muted-foreground">{q.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.recent?.length ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.recent.slice(0, 10).map((r: any) => (
                <li key={r.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <span className="capitalize">{r.action} on {r.table_name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
