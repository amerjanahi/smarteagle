import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/calculator")({
  head: () => ({ meta: [{ title: "Service Charge Calculator — Hayy" }] }),
  component: CalculatorPage,
});

function CalculatorPage() {
  const { user } = useAuth();
  const { format: money } = useCurrency();
  const [unitId, setUnitId] = useState<string>("");
  const [months, setMonths] = useState(12);

  const { data: units } = useQuery({
    queryKey: ["calc-units", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: residents } = await supabase
        .from("residents").select("unit_id").eq("user_id", user!.id);
      const ids = (residents ?? []).map((r) => r.unit_id).filter(Boolean) as string[];
      if (ids.length === 0) {
        const { data } = await supabase.from("units").select("id, building, unit_number, monthly_service_charge, built_up_area_sqm, land_area_sqm").limit(50);
        return data ?? [];
      }
      const { data } = await supabase.from("units")
        .select("id, building, unit_number, monthly_service_charge, built_up_area_sqm, land_area_sqm")
        .in("id", ids);
      return data ?? [];
    },
  });

  const unit = useMemo(() => units?.find((u) => u.id === unitId), [units, unitId]);
  const monthly = Number(unit?.monthly_service_charge ?? 0);
  const total = monthly * months;
  const perSqm = unit?.built_up_area_sqm ? monthly / Number(unit.built_up_area_sqm) : 0;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Service Charge Calculator</h1>
        <p className="text-sm text-muted-foreground">Estimate costs over time.</p>
      </header>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div>
          <Label>Unit</Label>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger><SelectValue placeholder="Select a unit" /></SelectTrigger>
            <SelectContent>
              {units?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.building ? `${u.building} · ` : ""}{u.unit_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Months</Label>
          <Input type="number" min={1} max={120} value={months} onChange={(e) => setMonths(Number(e.target.value) || 1)} />
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--gradient-brand)] p-6 text-primary-foreground shadow-[var(--shadow-lifted)]">
        <div className="flex items-center gap-2 text-sm opacity-80">
          <Calculator className="h-4 w-4" /> Estimated total
        </div>
        <p className="mt-2 font-display text-4xl font-extrabold">{money(total)}</p>
        <p className="mt-1 text-sm opacity-80">
          {months} month{months === 1 ? "" : "s"} × {money(monthly)}/mo
        </p>
      </div>

      {unit && (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">Built-up area</dt>
            <dd className="font-semibold">{unit.built_up_area_sqm ?? "—"} m²</dd>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">Land area</dt>
            <dd className="font-semibold">{unit.land_area_sqm ?? "—"} m²</dd>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">Rate / m²</dt>
            <dd className="font-semibold">BHD {perSqm.toFixed(3)}</dd>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">Monthly</dt>
            <dd className="font-semibold">BHD {monthly.toFixed(3)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
