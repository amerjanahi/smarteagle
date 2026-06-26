import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Calculator, Save, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/annual-fees")({
  component: AnnualFeesCalculator,
});

type Frequency = "annual" | "semi" | "quarterly";

function daysBetween(from: string, to: string) {
  const a = new Date(from);
  const b = new Date(to);
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

function fmt(n: number, d = 3) {
  return Number.isFinite(n) ? n.toFixed(d) : "0.000";
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  // step back one day so the period is inclusive (e.g. Jan1 + 12m → Dec31)
  target.setDate(target.getDate() - 1);
  return target.toISOString().slice(0, 10);
}

function computeToDate(from: string, freq: Frequency): string {
  if (!from) return "";
  const months = freq === "annual" ? 12 : freq === "semi" ? 6 : 3;
  return addMonths(from, months);
}

function AnnualFeesCalculator() {
  const qc = useQueryClient();

  const settings = useQuery({
    queryKey: ["company_settings_annual"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("annual_fee_rate, default_currency, vat_rate")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const units = useQuery({
    queryKey: ["units_for_annual"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id, building, unit_number, gfa_sqm, built_up_area_sqm, area_sqm")
        .order("building").order("unit_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const residents = useQuery({
    queryKey: ["residents_for_annual"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residents")
        .select("id, full_name, unit_id")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const thisYear = new Date().getFullYear();
  const [unitId, setUnitId] = useState<string>("");
  const [annualRate, setAnnualRate] = useState<string>("");
  const [gfa, setGfa] = useState<string>("");
  const [frequency, setFrequency] = useState<Frequency>("annual");
  const [fromDate, setFromDate] = useState<string>(`${thisYear}-01-01`);
  const [toDate, setToDate] = useState<string>(`${thisYear}-12-31`);
  const [openingBalance, setOpeningBalance] = useState<string>("");
  const [vatEnabled, setVatEnabled] = useState<boolean>(false);
  const [vatRate, setVatRate] = useState<string>("");
  const [discountFrom, setDiscountFrom] = useState<string>("");
  const [discountTo, setDiscountTo] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Default the rate & vat from settings once loaded
  useMemo(() => {
    if (!annualRate && settings.data?.annual_fee_rate != null) {
      setAnnualRate(String(settings.data.annual_fee_rate));
    }
    if (!vatRate && settings.data?.vat_rate != null) {
      setVatRate(String(settings.data.vat_rate));
    }
  }, [settings.data, annualRate, vatRate]);

  // Auto-update toDate when frequency or fromDate changes
  useEffect(() => {
    const next = computeToDate(fromDate, frequency);
    if (next) setToDate(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frequency, fromDate]);

  function onSelectUnit(id: string) {
    setUnitId(id);
    const u = units.data?.find((x) => x.id === id);
    if (u) {
      const g = u.gfa_sqm ?? u.built_up_area_sqm ?? u.area_sqm ?? 0;
      setGfa(String(g ?? ""));
    }
  }

  const rate = Number(annualRate) || 0;
  const gfaNum = Number(gfa) || 0;
  const validPeriod = !!fromDate && !!toDate && new Date(toDate) >= new Date(fromDate);
  const periodDays = validPeriod ? daysBetween(fromDate, toDate) : 0;

  const yearStart = fromDate ? new Date(fromDate).getFullYear() : thisYear;
  const yearDays =
    (new Date(yearStart, 11, 31).getTime() - new Date(yearStart, 0, 1).getTime()) / 86_400_000 + 1;

  const gross = rate * gfaNum;
  const prorata = validPeriod ? (gross * periodDays) / yearDays : 0;

  const validDiscount =
    !discountFrom || !discountTo || new Date(discountTo) >= new Date(discountFrom);
  const userDiscount = Math.max(0, Number(discountAmount) || 0);
  const cappedDiscount = Math.min(userDiscount, prorata);

  const opening = Math.max(0, Number(openingBalance) || 0);
  const subtotal = Math.max(0, prorata - cappedDiscount) + opening;
  const vatPct = vatEnabled ? Math.max(0, Number(vatRate) || 0) : 0;
  const vatAmount = subtotal * (vatPct / 100);
  const net = subtotal + vatAmount;

  const currency = settings.data?.default_currency ?? "BHD";

  const calcs = useQuery({
    queryKey: ["annual_fee_calcs", unitId],
    enabled: !!unitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annual_fee_calculations")
        .select("*")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const buildNotes = () => {
    const parts: string[] = [];
    parts.push(`Frequency: ${frequency}`);
    if (opening > 0) parts.push(`Opening balance: ${fmt(opening)} ${currency}`);
    if (vatEnabled) parts.push(`VAT ${fmt(vatPct, 2)}%: ${fmt(vatAmount)} ${currency}`);
    if (notes.trim()) parts.push(notes.trim());
    return parts.join(" | ");
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!unitId) throw new Error("Select a customer/villa");
      if (rate < 0 || gfaNum < 0) throw new Error("Rate and GFA must be positive");
      if (!validPeriod) throw new Error("To Date must be on or after From Date");
      if (!validDiscount) throw new Error("Discount dates are invalid");
      if (userDiscount > prorata) throw new Error("Discount cannot exceed pro-rata fee");
      if (opening < 0) throw new Error("Opening balance must be positive");

      const resident = residents.data?.find((r) => r.unit_id === unitId);

      const { error } = await supabase.from("annual_fee_calculations").insert({
        unit_id: unitId,
        resident_id: resident?.id ?? null,
        annual_rate: rate,
        gfa_sqm: gfaNum,
        period_from: fromDate,
        period_to: toDate,
        gross_annual_fee: Number(gross.toFixed(3)),
        prorata_fee: Number(prorata.toFixed(3)),
        waiver_from: discountFrom || null,
        waiver_to: discountTo || null,
        waived_amount: Number(cappedDiscount.toFixed(3)),
        net_payable: Number(net.toFixed(3)),
        notes: buildNotes() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Calculation saved to customer account");
      qc.invalidateQueries({ queryKey: ["annual_fee_calcs", unitId] });
      setDiscountAmount("");
      setOpeningBalance("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateInvoiceMut = useMutation({
    mutationFn: async (calcId: string) => {
      const calc = calcs.data?.find((c) => c.id === calcId);
      if (!calc) throw new Error("Calculation not found");
      const { data: inv, error } = await supabase
        .from("invoices")
        .insert({
          invoice_number: "",
          unit_id: calc.unit_id,
          amount: calc.net_payable,
          subtotal: calc.net_payable,
          due_date: calc.period_to,
          period_start: calc.period_from,
          period_end: calc.period_to,
          status: "unpaid",
          description: "Annual service fee",
          notes: `Annual fee ${calc.period_from} → ${calc.period_to} (GFA ${calc.gfa_sqm} × ${calc.annual_rate})${Number(calc.waived_amount) > 0 ? `; discount ${calc.waived_amount}` : ""}`,
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase
        .from("annual_fee_calculations")
        .update({ invoice_id: inv.id })
        .eq("id", calcId);
    },
    onSuccess: () => {
      toast.success("Invoice generated");
      qc.invalidateQueries({ queryKey: ["annual_fee_calcs", unitId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unitLabel = (u: { building: string; unit_number: string }) =>
    `${u.building} – ${u.unit_number}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Annual Fees Calculator</h2>
          <p className="text-sm text-muted-foreground">
            Calculate annual / semi-annual / quarterly service fees with VAT, opening balance and discounts.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" /> Calculation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Customer / Villa</Label>
                <Select value={unitId} onValueChange={onSelectUnit}>
                  <SelectTrigger><SelectValue placeholder="Select a unit" /></SelectTrigger>
                  <SelectContent>
                    {units.data?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{unitLabel(u)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Billing Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual (12 months)</SelectItem>
                    <SelectItem value="semi">Semi-Annual (6 months)</SelectItem>
                    <SelectItem value="quarterly">Quarterly (3 months)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Annual Rate ({currency} per sqm)</Label>
                <Input
                  type="number" min="0" step="0.001"
                  value={annualRate}
                  onChange={(e) => setAnnualRate(e.target.value)}
                  placeholder={`Default ${fmt(settings.data?.annual_fee_rate ?? 0)}`}
                />
              </div>

              <div>
                <Label>Registered GFA (sqm)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={gfa}
                  onChange={(e) => setGfa(e.target.value)}
                />
              </div>

              <div>
                <Label>From Date</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <Label>To Date</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>

              <div>
                <Label>Opening Balance ({currency})</Label>
                <Input
                  type="number" min="0" step="0.001"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0.000 — carried-forward balance"
                />
              </div>

              <div>
                <Label>VAT</Label>
                <div className="flex h-9 items-center gap-3 rounded-md border border-input px-3">
                  <Switch checked={vatEnabled} onCheckedChange={setVatEnabled} />
                  <Input
                    type="number" min="0" step="0.01"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    disabled={!vatEnabled}
                    className="h-7 border-0 p-0 shadow-none focus-visible:ring-0"
                    placeholder="VAT %"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>

              <div className="md:col-span-2 border-t pt-4">
                <p className="mb-2 text-sm font-medium">Discount (optional)</p>
              </div>

              <div>
                <Label>Discount Period — From</Label>
                <Input type="date" value={discountFrom} onChange={(e) => setDiscountFrom(e.target.value)} />
              </div>
              <div>
                <Label>Discount Period — To</Label>
                <Input type="date" value={discountTo} onChange={(e) => setDiscountTo(e.target.value)} />
              </div>

              <div className="md:col-span-2">
                <Label>Discount Amount ({currency})</Label>
                <Input
                  type="number" min="0" step="0.001"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0.000 — leave blank for none, or enter partial/full discount"
                />
                {userDiscount > prorata && (
                  <p className="mt-1 text-xs text-destructive">
                    Discount exceeds pro-rata fee and will be capped to {fmt(prorata)}.
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>

            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !unitId || !validPeriod || !validDiscount}
              className="w-full"
            >
              <Save className="mr-2 h-4 w-4" />
              Save calculation to customer account
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Frequency" v={frequency === "annual" ? "Annual" : frequency === "semi" ? "Semi-Annual" : "Quarterly"} />
            <Row k="Annual Rate" v={`${fmt(rate)} ${currency}/sqm`} />
            <Row k="GFA" v={`${fmt(gfaNum, 2)} sqm`} />
            <Row k="Gross Annual Fee" v={`${fmt(gross)} ${currency}`} />
            <Row k="Period" v={validPeriod ? `${periodDays} / ${Math.round(yearDays)} days` : "invalid"} />
            <Row k="Pro-rata Fee" v={`${fmt(prorata)} ${currency}`} />
            <Row k="Discount" v={`- ${fmt(cappedDiscount)} ${currency}`} />
            <Row k="Opening Balance" v={`+ ${fmt(opening)} ${currency}`} />
            <Row k="Subtotal" v={`${fmt(subtotal)} ${currency}`} />
            <Row k={`VAT (${fmt(vatPct, 2)}%)`} v={`${fmt(vatAmount)} ${currency}`} />
            <div className="my-2 border-t" />
            <Row k="Net Payable" v={`${fmt(net)} ${currency}`} strong />
          </CardContent>
        </Card>
      </div>

      {unitId && (
        <Card>
          <CardHeader><CardTitle>Saved calculations for this customer</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>GFA</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Pro-rata</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calcs.data?.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No calculations yet.</TableCell></TableRow>
                )}
                {calcs.data?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">{c.period_from} → {c.period_to}</TableCell>
                    <TableCell>{fmt(Number(c.gfa_sqm), 2)}</TableCell>
                    <TableCell>{fmt(Number(c.annual_rate))}</TableCell>
                    <TableCell>{fmt(Number(c.gross_annual_fee))}</TableCell>
                    <TableCell>{fmt(Number(c.prorata_fee))}</TableCell>
                    <TableCell>{fmt(Number(c.waived_amount))}</TableCell>
                    <TableCell className="font-semibold">{fmt(Number(c.net_payable))}</TableCell>
                    <TableCell>{c.invoice_id ? <span className="text-xs text-muted-foreground">Generated</span> : <span className="text-xs">—</span>}</TableCell>
                    <TableCell>
                      {!c.invoice_id && (
                        <Button size="sm" variant="outline"
                          onClick={() => generateInvoiceMut.mutate(c.id)}
                          disabled={generateInvoiceMut.isPending}>
                          <FileText className="mr-1 h-3 w-3" /> Invoice
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "text-base font-semibold" : ""}`}>
      <span className="text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}
