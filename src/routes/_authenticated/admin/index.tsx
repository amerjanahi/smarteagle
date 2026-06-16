import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, startOfMonth, startOfYear, subMonths } from "date-fns";
import {
  Building2,
  KeyRound,
  TrendingUp,
  Wallet,
  FileText,
  AlertCircle,
  CalendarIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

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

type Preset = { label: string; range: () => DateRange };
const today = () => new Date();
const presets: Preset[] = [
  { label: "This month", range: () => ({ from: startOfMonth(today()), to: today() }) },
  { label: "Last 3 months", range: () => ({ from: startOfMonth(subMonths(today(), 2)), to: today() }) },
  { label: "Last 12 months", range: () => ({ from: startOfMonth(subMonths(today(), 11)), to: today() }) },
  { label: "Year to date", range: () => ({ from: startOfYear(today()), to: today() }) },
];

function AdminDashboard() {
  const [range, setRange] = useState<DateRange>(() => presets[2].range());

  const fromISO = useMemo(
    () => (range.from ? format(range.from, "yyyy-MM-dd") : null),
    [range.from],
  );
  const toISO = useMemo(
    () => (range.to ? format(range.to, "yyyy-MM-dd") : fromISO),
    [range.to, fromISO],
  );

  const stats = useQuery({
    queryKey: ["admin-stats", fromISO, toISO],
    enabled: !!fromISO && !!toISO,
    queryFn: async () => {
      const from = fromISO!;
      const to = toISO!;
      const toEndIso = `${to}T23:59:59.999Z`;

      const [unitsRes, residentsRes, invoicesRes, paymentsRes] = await Promise.all([
        supabase.from("units").select("id, handover_date"),
        supabase.from("residents").select("unit_id, move_in_date, move_out_date"),
        supabase.from("invoices").select("amount, period_start").gte("period_start", from).lte("period_start", to),
        supabase.from("payments").select("amount, paid_at").gte("paid_at", `${from}T00:00:00.000Z`).lte("paid_at", toEndIso),
      ]);

      const u = (unitsRes.data ?? []) as Array<{ id: string; handover_date: string | null }>;
      const r = (residentsRes.data ?? []) as Array<{ unit_id: string; move_in_date: string | null; move_out_date: string | null }>;
      const inv = (invoicesRes.data ?? []) as Array<{ amount: number }>;
      const pay = (paymentsRes.data ?? []) as Array<{ amount: number }>;

      const totalUnits = u.length;
      const handed = u.filter((x) => x.handover_date && x.handover_date <= to).length;

      const occupiedUnitIds = new Set<string>();
      for (const res of r) {
        const mi = res.move_in_date;
        const mo = res.move_out_date;
        if (!mi) continue;
        if (mi > to) continue;
        if (mo && mo < from) continue;
        occupiedUnitIds.add(res.unit_id);
      }
      const occupied = occupiedUnitIds.size;

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

  const rangeLabel =
    range.from && range.to
      ? `${format(range.from, "dd MMM yyyy")} — ${format(range.to, "dd MMM yyyy")}`
      : "Pick a date range";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted-foreground">
            Performance and finance for the selected period.
          </p>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal md:w-[320px]",
                !range.from && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {rangeLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="flex flex-col gap-1 border-b border-border p-2 sm:flex-row">
              {presets.map((p) => (
                <Button
                  key={p.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => setRange(p.range())}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <Calendar
              mode="range"
              selected={range}
              onSelect={(r) => r && setRange(r)}
              numberOfMonths={2}
              defaultMonth={range.from ?? new Date()}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </header>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Performance
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {rateCards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
            >
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
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Finance (BHD)
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {amountCards.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
            >
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
