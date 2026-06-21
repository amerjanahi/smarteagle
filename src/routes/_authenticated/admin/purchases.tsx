import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { purchasesDashboard } from "@/lib/purchases.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, FileText, Users, CreditCard, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/purchases")({
  head: () => ({ meta: [{ title: "Purchases — Hayy Admin" }] }),
  component: PurchasesHub,
});

const money = (n: number) =>
  `AED ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PurchasesHub() {
  const fetchDash = useServerFn(purchasesDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["purchases-dashboard"], queryFn: () => fetchDash() });

  const tiles = [
    { label: "Total Billed", value: money(data?.totalBilled ?? 0), tone: "text-foreground" },
    { label: "Outstanding", value: money(data?.outstanding ?? 0), tone: "text-amber-600" },
    { label: "Overdue", value: money(data?.overdue ?? 0), tone: "text-red-600" },
    { label: "Pending Approval", value: String(data?.pendingApproval ?? 0), tone: "text-blue-600" },
  ];

  const quick = [
    { to: "/admin/expenses", label: "Expenses", icon: Wallet, desc: "Operating costs & reimbursements" },
    { to: "/admin/purchase-invoices", label: "Purchase Invoices", icon: FileText, desc: "Vendor bills with VAT & approval" },
    { to: "/admin/vendors", label: "Vendors", icon: Users, desc: "Manage your suppliers" },
    { to: "/admin/vendor-payments", label: "Payments", icon: CreditCard, desc: "Pay vendors and track balances" },
    { to: "/admin/purchase-reports", label: "Reports", icon: BarChart3, desc: "Vendor statements & aging" },
  ] as const;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Purchases</h2>
        <p className="text-sm text-muted-foreground">Bills, vendor payments, approvals, and aging reports.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{t.label}</CardTitle></CardHeader>
            <CardContent><div className={`text-2xl font-bold ${t.tone}`}>{isLoading ? "…" : t.value}</div></CardContent>
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
    </div>
  );
}
