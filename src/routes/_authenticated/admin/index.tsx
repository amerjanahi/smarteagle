import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, FileText, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Hayy Admin" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [units, residents, invoices, payments] = await Promise.all([
        supabase.from("units").select("id, is_occupied"),
        supabase.from("residents").select("id, is_active"),
        supabase.from("invoices").select("amount, amount_paid, status"),
        supabase.from("payments").select("amount"),
      ]);
      const u = units.data ?? [];
      const r = residents.data ?? [];
      const inv = (invoices.data ?? []) as Array<{ amount: number; amount_paid: number; status: string }>;
      const pay = (payments.data ?? []) as Array<{ amount: number }>;
      const invoiced = inv.reduce((s, i) => s + Number(i.amount), 0);
      const collected = pay.reduce((s, p) => s + Number(p.amount), 0);
      return {
        units: u.length,
        occupied: u.filter((x) => x.is_occupied).length,
        residents: r.filter((x) => x.is_active).length,
        invoiced,
        collected,
        outstanding: Math.max(0, invoiced - collected),
        collectionRate: invoiced > 0 ? (collected / invoiced) * 100 : 0,
      };
    },
  });

  const s = stats.data;
  const fmt = (n: number) => `BHD ${n.toFixed(3)}`;

  const cards = [
    { label: "Units", value: s ? `${s.occupied} / ${s.units}` : "—", sub: "occupied", icon: Building2 },
    { label: "Active residents", value: s ? String(s.residents) : "—", sub: "linked accounts", icon: Users },
    { label: "Invoiced", value: s ? fmt(s.invoiced) : "—", sub: "all time", icon: FileText },
    { label: "Collected", value: s ? fmt(s.collected) : "—", sub: `${s ? s.collectionRate.toFixed(0) : 0}% collection rate`, icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Welcome back</h2>
        <p className="text-sm text-muted-foreground">A quick look at your community's finance and operations.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="font-medium">Modules coming next</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Units, Residents, Invoices, Payments, Credit Notes, Reports, Maintenance, Visitors —
          full CRUD coming in the next build phase.
        </p>
      </div>
    </div>
  );
}
