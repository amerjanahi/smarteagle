import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Wallet, ShoppingBag, CreditCard, Users, Landmark, Calculator,
  TrendingUp, Scale, ArrowDownUp, AlertCircle, BarChart3, Home,
} from "lucide-react";
import { ReportViewer } from "@/components/admin/ReportViewer";
import {
  rptInvoices, rptPayments, rptExpenses, rptPurchaseInvoices, rptResidents,
  rptUnits, rptBank, rptAnnualFees, rptAging, rptProfitLoss, rptBalanceSheet, rptCashFlow,
} from "@/lib/reports-hub.functions";

export const Route = createFileRoute("/_authenticated/admin/reports-hub")({
  head: () => ({ meta: [{ title: "Reports Hub — Hayy Admin" }] }),
  component: ReportsHubPage,
});

type Filters = { from: string; to: string; unit_id?: string; resident_id?: string; category?: string; status?: string };

function firstOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function today() { return new Date().toISOString().slice(0, 10); }

type ReportDef = { id: string; title: string; icon: any; section: string; fn: any };

function ReportsHubPage() {
  const [filters, setFilters] = useState<Filters>({ from: firstOfMonth(), to: today() });
  const [active, setActive] = useState<ReportDef | null>(null);

  const invoicesFn = useServerFn(rptInvoices);
  const paymentsFn = useServerFn(rptPayments);
  const expensesFn = useServerFn(rptExpenses);
  const purchInvFn = useServerFn(rptPurchaseInvoices);
  const residentsFn = useServerFn(rptResidents);
  const unitsFn = useServerFn(rptUnits);
  const bankFn = useServerFn(rptBank);
  const annualFn = useServerFn(rptAnnualFees);
  const agingFn = useServerFn(rptAging);
  const plFn = useServerFn(rptProfitLoss);
  const bsFn = useServerFn(rptBalanceSheet);
  const cfFn = useServerFn(rptCashFlow);

  const reports: ReportDef[] = [
    { id: "sales.invoices", title: "Sales Invoices", icon: FileText, section: "Sales & Invoices", fn: invoicesFn },
    { id: "sales.aging", title: "AR Ageing", icon: AlertCircle, section: "Outstanding & Ageing", fn: agingFn },
    { id: "payments.collections", title: "Payments & Collections", icon: CreditCard, section: "Payments & Collections", fn: paymentsFn },
    { id: "purchases.expenses", title: "Expenses", icon: Wallet, section: "Purchases, Bills & Expenses", fn: expensesFn },
    { id: "purchases.bills", title: "Purchase Invoices (Bills)", icon: ShoppingBag, section: "Purchases, Bills & Expenses", fn: purchInvFn },
    { id: "residents.roster", title: "Residents Roster", icon: Users, section: "Residents & Units", fn: residentsFn },
    { id: "units.list", title: "Units", icon: Home, section: "Residents & Units", fn: unitsFn },
    { id: "bank.transactions", title: "Bank & Reconciliation", icon: Landmark, section: "Bank & Reconciliation", fn: bankFn },
    { id: "annual.fees", title: "Annual Fees", icon: Calculator, section: "Annual Fees", fn: annualFn },
    { id: "acc.pl", title: "Profit & Loss", icon: TrendingUp, section: "Accounting", fn: plFn },
    { id: "acc.bs", title: "Balance Sheet", icon: Scale, section: "Accounting", fn: bsFn },
    { id: "acc.cf", title: "Cash Flow", icon: ArrowDownUp, section: "Accounting", fn: cfFn },
  ];

  const runMutation = useMutation({
    mutationFn: async (def: ReportDef) => def.fn({ data: filters }),
  });

  function openReport(def: ReportDef) {
    setActive(def);
    runMutation.mutate(def);
  }

  function setPreset(preset: string) {
    const now = new Date();
    let from = new Date(now.getFullYear(), now.getMonth(), 1);
    let to = now;
    if (preset === "last-month") {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === "qtd") {
      from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    } else if (preset === "ytd") {
      from = new Date(now.getFullYear(), 0, 1);
    }
    setFilters((f) => ({ ...f, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }));
  }

  const sections = [...new Set(reports.map((r) => r.section))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Reports Hub
        </h1>
        <p className="text-sm text-muted-foreground">One place for every report across the platform.</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Preset</Label>
            <Select onValueChange={setPreset}>
              <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="qtd">Quarter to date</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Unit ID</Label>
            <Input placeholder="Optional" value={filters.unit_id ?? ""} onChange={(e) => setFilters({ ...filters, unit_id: e.target.value || undefined })} />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Input placeholder="Optional" value={filters.category ?? ""} onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })} />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Input placeholder="Optional" value={filters.status ?? ""} onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })} />
          </div>
        </CardContent>
      </Card>

      {sections.map((section) => (
        <div key={section} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{section}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reports.filter((r) => r.section === section).map((r) => {
              const Icon = r.icon;
              return (
                <Card key={r.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openReport(r)}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">View · Print · PDF · Excel</p>
                    </div>
                    <Button size="sm" variant="ghost" className="ml-auto">Open</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {active && (
        <ReportViewer
          id={active.id}
          defaultTitle={active.title}
          open={!!active}
          onOpenChange={(v) => { if (!v) setActive(null); }}
          loading={runMutation.isPending}
          data={runMutation.data as any}
        />
      )}
    </div>
  );
}
