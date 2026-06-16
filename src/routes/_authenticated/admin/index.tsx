import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, KeyRound, TrendingUp, Wallet, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Hayy Admin" }] }),
  component: AdminDashboard,
});

const bhd = new Intl.NumberFormat("en-BH", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
  useGrouping: true,
});
const fmtBHD = (n: number) => `BHD ${bhd.format(n)}`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function AdminDashboard() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [units, invoices, payments] = await Promise.all([
        supabase.from("units").select("id, is_occupied, handover_date"),
        supabase.from("invoices").select("amount, amount_paid"),
        supabase.from("payments").select("amount"),
      ]);
      const u = (units.data ?? []) as Array<{ is_occupied: boolean; handover_date: string | null }>;
      const inv = (invoices.data ?? []) as Array<{ amount: number; amount_paid: number }>;
      const pay = (payments.data ?? []) as Array<{ amount: number }>;
      const totalUnits = u.length;
      const handed = u.filter((x) => x.handover_date !== null).length;
      const occupied = u.filter((x) => x.is_occupied).length;
      const invoiced = inv.reduce((s, i) => s + Number(i.amount), 0);
      const collected = pay.reduce((s, p) => s + Number(p.amount), 0);
      return {
        totalUnits,
        handed,
        occupied,
        handoverRate: totalUnits ? (handed / totalUnits) * 100 : 0,
        occupancyRate: totalUnits ? (occupied / totalUnits) * 100 : 0,
        invoiced,
        collected,
        outstanding: Math.max(0, invoiced - collected),
        collectionRate: invoiced > 0 ? (collected / invoiced) * 100 : 0,
      };
    },
  });

  const s = stats.data;

  const rateCards = [
    {
      label: "Handover rate",
      value: s ? fmtPct(s.handoverRate) : "—",
      sub: s ? `${s.handed} of ${s.totalUnits} units handed over` : "—",
      icon: KeyRound,
    },
    {
      label: "Occupancy rate",
      value: s ? fmtPct(s.occupancyRate) : "—",
      sub: s ? `${s.occupied} of ${s.totalUnits} units occupied` : "—",
      icon: Building2,
    },
    {
      label: "Collection rate",
      value: s ? fmtPct(s.collectionRate) : "—",
      sub: s ? `${fmtBHD(s.collected)} of ${fmtBHD(s.invoiced)}` : "—",
      icon: TrendingUp,
    },
  ];

  const amountCards = [
    { label: "Invoiced", value: s ? fmtBHD(s.invoiced) : "—", icon: FileText },
    { label: "Collected", value: s ? fmtBHD(s.collected) : "—", icon: Wallet },
    { label: "Outstanding", value: s ? fmtBHD(s.outstanding) : "—", icon: AlertCircle },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Welcome back</h2>
        <p className="text-sm text-muted-foreground">A quick look at your community's finance and operations.</p>
      </header>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Performance</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {rateCards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight">{c.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Finance (BHD)</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {amountCards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
