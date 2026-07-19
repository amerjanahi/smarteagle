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
  Briefcase,
  ShieldCheck,
  Zap,
  Sparkles,
  Receipt,
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

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

type PresetKey = "month" | "quarter" | "year" | "ytd" | "custom";
const today = () => new Date();
const PRESETS: { key: PresetKey; label: string; range: () => DateRange }[] = [
  { key: "month", label: "This month", range: () => ({ from: startOfMonth(today()), to: today() }) },
  { key: "quarter", label: "Last 3 months", range: () => ({ from: startOfMonth(subMonths(today(), 2)), to: today() }) },
  { key: "year", label: "Last 12 months", range: () => ({ from: startOfMonth(subMonths(today(), 11)), to: today() }) },
  { key: "ytd", label: "Year to date", range: () => ({ from: startOfYear(today()), to: today() }) },
];

type ExpenseCategory = "admin" | "security" | "utility" | "fm" | "maintenance" | "other";

const CATEGORY_META: Record<ExpenseCategory, { label: string; icon: typeof Briefcase; tone: string }> = {
  admin:       { label: "Admin",       icon: Briefcase,   tone: "text-blue-600" },
  security:    { label: "Security",    icon: ShieldCheck, tone: "text-rose-600" },
  utility:     { label: "Utility",     icon: Zap,         tone: "text-amber-600" },
  fm:          { label: "FM",          icon: Sparkles,    tone: "text-emerald-600" },
  maintenance: { label: "Maintenance", icon: Wallet,      tone: "text-violet-600" },
  other:       { label: "Other",       icon: Receipt,     tone: "text-muted-foreground" },
};

import { useCurrency } from "@/hooks/use-currency";

function AdminDashboard() {
  const { format: fmtBHD } = useCurrency();
  const [presetKey, setPresetKey] = useState<PresetKey>("year");
  const [range, setRange] = useState<DateRange>(() => PRESETS[2].range());

  function applyPreset(key: PresetKey) {
    setPresetKey(key);
    const p = PRESETS.find((x) => x.key === key);
    if (p) setRange(p.range());
  }

  function applyCustom(r: DateRange | undefined) {
    if (!r) return;
    setRange(r);
    setPresetKey("custom");
  }

  const fromISO = useMemo(() => (range.from ? format(range.from, "yyyy-MM-dd") : null), [range.from]);
  const toISO = useMemo(() => (range.to ? format(range.to, "yyyy-MM-dd") : fromISO), [range.to, fromISO]);

  const stats = useQuery({
    queryKey: ["admin-stats", fromISO, toISO],
    enabled: !!fromISO && !!toISO,
    queryFn: async () => {
      const from = fromISO!;
      const to = toISO!;
      const toEndIso = `${to}T23:59:59.999Z`;

      const [unitsRes, residentsRes, invoicesRes, paymentsRes, expensesRes] = await Promise.all([
        supabase.from("units").select("id, handover_date"),
        supabase.from("residents").select("unit_id, move_in_date, move_out_date"),
        supabase.from("invoices").select("amount, period_start").gte("period_start", from).lte("period_start", to),
        supabase.from("payments").select("amount, paid_at").gte("paid_at", `${from}T00:00:00.000Z`).lte("paid_at", toEndIso),
        supabase.from("expenses").select("amount, category, expense_date").gte("expense_date", from).lte("expense_date", to),
      ]);

      const u = (unitsRes.data ?? []) as Array<{ id: string; handover_date: string | null }>;
      const r = (residentsRes.data ?? []) as Array<{ unit_id: string; move_in_date: string | null; move_out_date: string | null }>;
      const inv = (invoicesRes.data ?? []) as Array<{ amount: number }>;
      const pay = (paymentsRes.data ?? []) as Array<{ amount: number }>;
      const exp = (expensesRes.data ?? []) as Array<{ amount: number; category: ExpenseCategory }>;

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

      const byCategory: Record<ExpenseCategory, number> = {
        admin: 0, security: 0, utility: 0, fm: 0, maintenance: 0, other: 0,
      };
      let expensesTotal = 0;
      for (const e of exp) {
        const amt = Number(e.amount);
        byCategory[e.category] = (byCategory[e.category] ?? 0) + amt;
        expensesTotal += amt;
      }

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
        expensesTotal,
        byCategory,
        netCashflow: collected - expensesTotal,
      };
    },
  });

  const s = stats.data;

  const rangeLabel =
    range.from && range.to
      ? `${format(range.from, "dd MMM yyyy")} — ${format(range.to, "dd MMM yyyy")}`
      : "Pick a date range";

  // Actual vs Budget (budget = invoiced as planned target; actual = collected)
  const budget = s?.invoiced ?? 0;
  const actual = s?.collected ?? 0;
  const variance = actual - budget;
  const actualPct = budget > 0 ? (actual / budget) * 100 : 0;



  const financeCards = [
    { label: "Invoiced", value: s ? fmtBHD(s.invoiced) : "—", icon: FileText },
    { label: "Collected", value: s ? fmtBHD(s.collected) : "—", icon: Wallet },
    { label: "Outstanding", value: s ? fmtBHD(s.outstanding) : "—", icon: AlertCircle },
    { label: "Total expenses", value: s ? fmtBHD(s.expensesTotal) : "—", icon: Receipt },
    { label: "Net cashflow", value: s ? fmtBHD(s.netCashflow) : "—", icon: TrendingUp, accent: s && s.netCashflow < 0 ? "text-rose-600" : "text-emerald-600" },
  ];

  const categoryOrder: ExpenseCategory[] = ["admin", "security", "utility", "fm", "maintenance", "other"];

  // Donut math
  const collectionPct = s ? Math.max(0, Math.min(100, s.collectionRate)) : 0;
  const R = 52, C = 2 * Math.PI * R;
  const dash = (collectionPct / 100) * C;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted-foreground">Performance and finance for the selected period.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={presetKey === p.key ? "default" : "outline"}
              onClick={() => applyPreset(p.key)}
              className="rounded-full"
            >
              {p.label}
            </Button>
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={presetKey === "custom" ? "default" : "outline"}
                className="rounded-full"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {presetKey === "custom" ? rangeLabel : "Custom range"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={range}
                onSelect={applyCustom}
                numberOfMonths={2}
                defaultMonth={range.from ?? new Date()}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
            Showing {rangeLabel}
          </span>
        </div>
      </header>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Performance</h3>
        <div className="grid gap-4 md:grid-cols-12">
          {/* Collection Rate donut (replaces Handover rate card position) */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:col-span-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Collection rate</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-32 w-32 shrink-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
                  <circle
                    cx="60" cy="60" r={R} fill="none"
                    stroke="hsl(var(--primary))" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${dash} ${C - dash}`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-2xl font-bold tabular-nums">{fmtPct(collectionPct)}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Collected</span>
                </div>
              </div>
              <div className="min-w-0 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Collected</span>
                  <span className="ml-auto font-medium tabular-nums">{s ? fmtBHD(s.collected) : "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-muted" />
                  <span className="text-muted-foreground">Invoiced</span>
                  <span className="ml-auto font-medium tabular-nums">{s ? fmtBHD(s.invoiced) : "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actual vs Budget */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:col-span-7">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Actual vs Budget</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <p className="font-display text-3xl font-bold tracking-tight tabular-nums">{s ? fmtBHD(actual) : "—"}</p>
              <p className="text-xs text-muted-foreground">of {s ? fmtBHD(budget) : "—"} budget</p>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", variance >= 0 ? "bg-emerald-500" : "bg-primary")}
                style={{ width: `${Math.min(100, actualPct)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{fmtPct(actualPct)} of budget</span>
              <span className={cn("font-medium tabular-nums", variance >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {variance >= 0 ? "+" : ""}{s ? fmtBHD(variance) : "—"}
              </span>
            </div>
          </div>

        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Finance (BHD)</h3>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {financeCards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className={cn("mt-2 font-display text-xl font-bold tabular-nums", c.accent)}>{c.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expenses by category</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {categoryOrder.map((key) => {
            const meta = CATEGORY_META[key];
            const value = s?.byCategory[key] ?? 0;
            const share = s && s.expensesTotal > 0 ? (value / s.expensesTotal) * 100 : 0;
            return (
              <div key={key} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{meta.label}</p>
                  <meta.icon className={cn("h-4 w-4", meta.tone)} />
                </div>
                <p className="mt-2 font-display text-xl font-bold tabular-nums">{s ? fmtBHD(value) : "—"}</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full bg-primary")} style={{ width: `${Math.min(100, share)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{fmtPct(share)} of total</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
