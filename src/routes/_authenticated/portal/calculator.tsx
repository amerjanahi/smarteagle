import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCurrency } from "@/hooks/use-currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Calculator, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/calculator")({
  head: () => ({ meta: [{ title: "Service Charge Calculator - Hayy" }] }),
  component: CalculatorPage,
});

const UNIT_FIELDS =
  "id, building, unit_number, monthly_service_charge, built_up_area_sqm, land_area_sqm" as const;
const MONTH_PRESETS = [1, 3, 6, 12, 24];

type CalculatorUnit = {
  id: string;
  building: string | null;
  unit_number: string;
  monthly_service_charge: number | null;
  built_up_area_sqm: number | null;
  land_area_sqm: number | null;
};

function clampMonths(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(120, Math.max(1, Math.round(value)));
}

function CalculatorPage() {
  const { user } = useAuth();
  const { format: money } = useCurrency();
  const [unitId, setUnitId] = useState("");
  const [months, setMonths] = useState(12);

  const {
    data: units = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["calc-units", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<CalculatorUnit[]> => {
      const { data: links, error: linksError } = await supabase
        .from("user_villas")
        .select("villa_id")
        .eq("user_id", user!.id)
        .eq("status", "active");

      if (linksError) throw linksError;

      let ids = [...new Set((links ?? []).map((link) => link.villa_id).filter(Boolean))];

      // Keep legacy resident records working while all accounts migrate to user_villas.
      if (ids.length === 0) {
        const { data: residents, error: residentsError } = await supabase
          .from("residents")
          .select("unit_id")
          .eq("user_id", user!.id);

        if (residentsError) throw residentsError;
        ids = [...new Set((residents ?? []).map((resident) => resident.unit_id).filter(Boolean))] as string[];
      }

      if (ids.length === 0) return [];

      const { data, error: unitsError } = await supabase
        .from("units")
        .select(UNIT_FIELDS)
        .in("id", ids)
        .order("building")
        .order("unit_number");

      if (unitsError) throw unitsError;
      return (data ?? []) as CalculatorUnit[];
    },
  });

  useEffect(() => {
    if (units.length === 0) {
      setUnitId("");
      return;
    }

    if (!units.some((item) => item.id === unitId)) {
      setUnitId(units[0].id);
    }
  }, [unitId, units]);

  const unit = useMemo(() => units.find((item) => item.id === unitId), [units, unitId]);
  const monthly = Math.max(0, Number(unit?.monthly_service_charge ?? 0));
  const total = monthly * months;
  const annual = monthly * 12;
  const builtUpArea = Math.max(0, Number(unit?.built_up_area_sqm ?? 0));
  const perSqmMonthly = builtUpArea > 0 ? monthly / builtUpArea : null;
  const perSqmAnnual = builtUpArea > 0 ? annual / builtUpArea : null;
  const hasCharge = monthly > 0;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Service Charge Calculator</h1>
        <p className="text-sm text-muted-foreground">
          Estimate your service charges by unit and billing period.
        </p>
      </header>

      <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="space-y-1.5">
          <Label htmlFor="calculator-unit">Unit</Label>
          {isLoading ? (
            <div className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your linked units...
            </div>
          ) : (
            <Select value={unitId} onValueChange={setUnitId} disabled={units.length === 0}>
              <SelectTrigger id="calculator-unit">
                <SelectValue placeholder={units.length === 0 ? "No linked unit found" : "Select a unit"} />
              </SelectTrigger>
              <SelectContent>
                {units.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.building ? `${item.building} - ` : ""}
                    {item.unit_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="calculator-months">Billing period (months)</Label>
          <Input
            id="calculator-months"
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            value={months}
            onChange={(event) => setMonths(clampMonths(Number(event.target.value)))}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {MONTH_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={months === preset ? "default" : "outline"}
                onClick={() => setMonths(preset)}
              >
                {preset} {preset === 1 ? "month" : "months"}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold">We could not load your service-charge details.</p>
            <p className="text-muted-foreground">Please refresh the page or contact community management.</p>
          </div>
        </div>
      )}

      {!isLoading && !error && units.length === 0 && (
        <div role="status" className="flex gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold">No active unit is linked to this account.</p>
            <p className="text-muted-foreground">
              Ask community management to link your resident account to a unit before calculating charges.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-[var(--gradient-brand)] p-6 text-primary-foreground shadow-[var(--shadow-lifted)]">
        <div className="flex items-center gap-2 text-sm opacity-80">
          <Calculator className="h-4 w-4" /> Estimated total
        </div>
        <p className="mt-2 font-display text-4xl font-extrabold">{money(total)}</p>
        <p className="mt-1 text-sm opacity-80">
          {months} month{months === 1 ? "" : "s"} x {money(monthly)}/month
        </p>
      </div>

      {unit && (
        <>
          {!hasCharge && (
            <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <p className="font-semibold">No monthly service charge is configured for this unit.</p>
              <p className="text-muted-foreground">
                The estimate will remain zero until community management adds a charge to the unit.
              </p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">Monthly charge</dt>
              <dd className="font-semibold">{money(monthly)}</dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">Annual charge</dt>
              <dd className="font-semibold">{money(annual)}</dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">Built-up area</dt>
              <dd className="font-semibold">
                {builtUpArea > 0 ? `${builtUpArea.toLocaleString()} sq m` : "Not set"}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">Land area</dt>
              <dd className="font-semibold">
                {Number(unit.land_area_sqm) > 0
                  ? `${Number(unit.land_area_sqm).toLocaleString()} sq m`
                  : "Not set"}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">Monthly rate / sq m</dt>
              <dd className="font-semibold">{perSqmMonthly === null ? "Not available" : money(perSqmMonthly)}</dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">Annual rate / sq m</dt>
              <dd className="font-semibold">{perSqmAnnual === null ? "Not available" : money(perSqmAnnual)}</dd>
            </div>
          </dl>

          <p className="px-1 text-xs text-muted-foreground">
            This estimate uses the monthly service charge configured for your unit. Actual invoices may include
            adjustments, credits, or one-time fees.
          </p>
        </>
      )}
    </div>
  );
}
