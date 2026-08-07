import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { persistCurrency } from "@/hooks/use-currency";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AllUsersTab } from "@/components/admin/AllUsersTab";
import { InvoiceReminderSettings } from "@/components/admin/InvoiceReminderSettings";
import { Bell, Building2, CircleDollarSign, FileStack, ShieldCheck, UsersRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Hayy Admin" }] }),
  component: SettingsPage,
});

const ROLES = ["admin", "property_manager", "finance", "accountant", "hr", "operations", "security", "viewer", "resident"] as const;
const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  admin: "Top Admin",
  property_manager: "Property Manager",
  finance: "Finance Manager",
  accountant: "Accountant",
  hr: "Human Resources",
  operations: "Operations",
  security: "Security",
  viewer: "Viewer",
  resident: "Resident",
};
const MODULES = ["property", "sales", "purchases", "bank", "operations", "communication", "settings"] as const;
const PERMS = [
  { key: "can_view", label: "View" },
  { key: "can_create", label: "Create" },
  { key: "can_edit", label: "Edit" },
  { key: "can_delete", label: "Delete" },
  { key: "can_approve", label: "Approve" },
  { key: "can_apply_txn", label: "Apply Txn" },
  { key: "can_export", label: "Export" },
] as const;

function SettingsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Settings &amp; Administration</h2>
        <p className="text-sm text-muted-foreground">A secure workspace for organization, people, finance controls, permissions, and documents.</p>
      </header>
      <hr className="border-border" />
      <Tabs defaultValue="organization" className="md:grid md:grid-cols-[200px_minmax(0,1fr)] md:items-start md:gap-8">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto p-1 md:sticky md:top-4 md:flex-col md:overflow-visible md:rounded-xl md:border md:bg-card md:p-2">
          <TabsTrigger value="organization" className="w-max shrink-0 gap-2 md:w-full md:justify-start md:px-3 md:py-2.5"><Building2 className="h-4 w-4" />Organization</TabsTrigger>
          <TabsTrigger value="people" className="w-max shrink-0 gap-2 md:w-full md:justify-start md:px-3 md:py-2.5"><UsersRound className="h-4 w-4" />People &amp; Access</TabsTrigger>
          <TabsTrigger value="finance" className="w-max shrink-0 gap-2 md:w-full md:justify-start md:px-3 md:py-2.5"><CircleDollarSign className="h-4 w-4" />Finance</TabsTrigger>
          <TabsTrigger value="reminders" className="w-max shrink-0 gap-2 md:w-full md:justify-start md:px-3 md:py-2.5"><Bell className="h-4 w-4" />Reminders</TabsTrigger>
          <TabsTrigger value="security" className="w-max shrink-0 gap-2 md:w-full md:justify-start md:px-3 md:py-2.5"><ShieldCheck className="h-4 w-4" />Security &amp; Roles</TabsTrigger>
          <TabsTrigger value="templates" className="w-max shrink-0 gap-2 md:w-full md:justify-start md:px-3 md:py-2.5"><FileStack className="h-4 w-4" />Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="organization" className="mt-4 min-w-0 space-y-6 md:mt-0"><SectionHeading title="Organization profile" description="Legal identity and contact details used throughout the platform." /><CompanyTab /></TabsContent>
        <TabsContent value="people" className="mt-4 min-w-0 space-y-6 md:mt-0"><SectionHeading title="Users" description="Manage user access, type, status, and portal permissions in one place." /><UsersTab /></TabsContent>
        <TabsContent value="finance" className="mt-4 min-w-0 space-y-6 md:mt-0"><SectionHeading title="Finance configuration" description="Control currency, tax, service-fee, and invoice defaults." /><FinanceTab /></TabsContent>
        <TabsContent value="reminders" className="mt-4 min-w-0 space-y-6 md:mt-0"><SectionHeading title="Automatic reminders" description="Set the invoice reminder cycle, approved message content, channels, and delivery queue." /><InvoiceReminderSettings /></TabsContent>
        <TabsContent value="security" className="mt-4 min-w-0 space-y-6 md:mt-0"><SectionHeading title="Security & roles" description="Apply least-privilege access by module and action." /><RolesTab /></TabsContent>
        <TabsContent value="templates" className="mt-4 min-w-0 space-y-6 md:mt-0">
          <SectionHeading title="Document templates" description="Manage the controlled layouts used for operational and financial documents." />
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            Manage document templates for Invoice, Receipt, Credit Note, Statement, Work Order, and Purchase Order.
            <div className="mt-3">
              <a href="/admin/templates" className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-primary-foreground hover:opacity-90">Open Document Templates →</a>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div className="space-y-1"><h3 className="text-lg font-semibold">{title}</h3><p className="text-sm text-muted-foreground">{description}</p></div>;
}

function UsersTab() { return <AllUsersTab />; }

function FinanceTab() {
  return <Tabs defaultValue="currency" className="space-y-3">
    <TabsList>
      <TabsTrigger value="currency">Currency</TabsTrigger>
      <TabsTrigger value="tax">Tax &amp; Fees</TabsTrigger>
      <TabsTrigger value="formats">Date, Time &amp; Numbers</TabsTrigger>
    </TabsList>
    <TabsContent value="currency"><CurrencyTab /></TabsContent>
    <TabsContent value="tax"><VatTab /></TabsContent>
    <TabsContent value="formats"><DisplayFormatsTab /></TabsContent>
  </Tabs>;
}

function useSettings() {
  return useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("company_settings" as any).select("*").maybeSingle() as any);
      if (error) throw error;
      return data;
    },
  });
}

function CompanyTab() {
  const qc = useQueryClient();
  const { data } = useSettings();
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.id) throw new Error("Settings are still loading.");
      if (!String(form.company_name ?? "").trim()) throw new Error("Company name is required.");
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) throw new Error("Enter a valid company email.");
      const payload = {
        company_name: String(form.company_name).trim(),
        cr_number: form.cr_number?.trim() || null,
        address: form.address?.trim() || null,
        phone: form.phone?.trim() || null,
        email: form.email?.trim().toLowerCase() || null,
        logo_url: form.logo_url || null,
      };
      const { error } = await (supabase.from("company_settings" as any).update(payload).eq("id", form.id) as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["company-settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleLogo(file: File) {
    if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
      toast.error("Use a PNG, JPG, WebP, or SVG logo.");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error("Logo must be 1 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, logo_url: reader.result as string });
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Company name</Label><Input value={form.company_name ?? ""} onChange={e => setForm({ ...form, company_name: e.target.value })} /></div>
        <div><Label>CR number</Label><Input value={form.cr_number ?? ""} onChange={e => setForm({ ...form, cr_number: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Address</Label><Textarea rows={2} value={form.address ?? ""} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone ?? ""} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div className="sm:col-span-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-3">
            {form.logo_url && <img src={form.logo_url} alt="Logo" className="h-12 w-12 rounded border border-border object-contain" />}
            <Input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogo(f); }} />
          </div>
        </div>
      </div>
      <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button></div>
    </div>
  );
}

function CurrencyTab() {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: currencies = [] } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("currencies" as any).select("*").order("code") as any);
      if (error) throw error;
      return data as any[];
    },
  });

  const updateRate = useMutation({
    mutationFn: async ({ code, exchange_rate }: { code: string; exchange_rate: number }) => {
      if (!Number.isFinite(exchange_rate) || exchange_rate <= 0) throw new Error("Exchange rate must be greater than zero.");
      const { error } = await (supabase.from("currencies" as any).update({ exchange_rate }).eq("code", code) as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Exchange rate updated"); qc.invalidateQueries({ queryKey: ["currencies"] }); },
    onError: (error: any) => toast.error(error.message),
  });

  const setDefault = useMutation({
    mutationFn: async (code: string) => {
      const { error: clearError } = await (supabase.from("currencies" as any).update({ is_default: false }).neq("code", "") as any);
      if (clearError) throw clearError;
      const { error: currencyError } = await (supabase.from("currencies" as any).update({ is_default: true }).eq("code", code) as any);
      if (currencyError) throw currencyError;
      if (settings?.id) {
        const { error } = await (supabase.from("company_settings" as any).update({ default_currency: code }).eq("id", settings.id) as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, code) => {
      const selected = currencies.find((currency: any) => currency.code === code);
      const activeCurrency = { code, symbol: code, decimals: selected?.decimals ?? 2 };
      persistCurrency(activeCurrency);
      qc.setQueryData(["active-currency"], activeCurrency);
      toast.success("Default updated");
      qc.invalidateQueries({ queryKey: ["currencies"] });
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      qc.invalidateQueries({ queryKey: ["active-currency"] });
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Decimals</TableHead>
          <TableHead>Exchange rate (to BHD)</TableHead><TableHead>Default</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {currencies.map((c: any) => (
            <TableRow key={c.code}>
              <TableCell className="font-medium">{c.code}</TableCell>
              <TableCell>{c.name}</TableCell>
              <TableCell>{c.decimals}</TableCell>
              <TableCell>
                <Input type="number" step={c.decimals === 3 ? "0.001" : "0.01"} defaultValue={c.exchange_rate}
                  onBlur={e => { const v = Number(e.target.value); if (v !== Number(c.exchange_rate)) updateRate.mutate({ code: c.code, exchange_rate: v }); }}
                  className="h-8 w-32" />
              </TableCell>
              <TableCell>
                {c.is_default ? <span className="text-emerald-600 text-sm font-medium">Default</span>
                  : <Button size="sm" variant="outline" onClick={() => setDefault.mutate(c.code)}>Set default</Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function VatTab() {
  const qc = useQueryClient();
  const { data } = useSettings();
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("company_settings" as any).update({
        vat_number: form.vat_number, vat_rate: form.vat_rate,
        vat_effective_date: form.vat_effective_date, tax_invoice_footer: form.tax_invoice_footer,
        annual_fee_rate: form.annual_fee_rate,
      }).eq("id", form.id) as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["company-settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>VAT registration number</Label><Input value={form.vat_number ?? ""} onChange={e => setForm({ ...form, vat_number: e.target.value })} /></div>
        <div><Label>VAT rate (%)</Label><Input type="number" step="0.01" value={form.vat_rate ?? 0} onChange={e => setForm({ ...form, vat_rate: Number(e.target.value) })} /></div>
        <div><Label>Effective date</Label><Input type="date" value={form.vat_effective_date ?? ""} onChange={e => setForm({ ...form, vat_effective_date: e.target.value })} /></div>
        <div><Label>Annual fee rate (per sqm)</Label><Input type="number" step="0.001" value={form.annual_fee_rate ?? 0} onChange={e => setForm({ ...form, annual_fee_rate: Number(e.target.value) })} /></div>
        <div className="sm:col-span-2"><Label>Tax invoice footer</Label><Textarea rows={3} value={form.tax_invoice_footer ?? ""} onChange={e => setForm({ ...form, tax_invoice_footer: e.target.value })} /></div>
      </div>
      <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button></div>
    </div>
  );
}

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY", "DD.MM.YYYY", "YYYY/MM/DD"] as const;
const TIME_FORMATS = ["24h", "12h"] as const;
const NUMBER_FORMATS = ["comma-dot", "dot-comma", "space-dot", "space-comma", "apostrophe-dot", "none-dot"] as const;
const DECIMAL_PLACES = [0, 1, 2, 3, 4] as const;

function formatNumberPreview(value: number, format: string, decimals: number) {
  const [group, decimal] = format === "dot-comma" ? [".", ","]
    : format === "space-dot" ? [" ", "."]
      : format === "space-comma" ? [" ", ","]
        : format === "apostrophe-dot" ? ["'", "."]
          : format === "none-dot" ? ["", "."]
            : [",", "."];
  const [whole, fraction = ""] = value.toFixed(decimals).split(".");
  const grouped = group ? whole.replace(/\\B(?=(\\d{3})+(?!\\d))/g, group) : whole;
  return decimals > 0 ? grouped + decimal + fraction : grouped;
}

function DisplayFormatsTab() {
  const qc = useQueryClient();
  const { data } = useSettings();
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (data) setForm(data); }, [data]);

  const dateFormat = DATE_FORMATS.includes(form.date_format) ? form.date_format : "DD/MM/YYYY";
  const timeFormat = TIME_FORMATS.includes(form.time_format) ? form.time_format : "24h";
  const numberFormat = NUMBER_FORMATS.includes(form.number_format) ? form.number_format : "comma-dot";
  const decimalPlaces = DECIMAL_PLACES.includes(Number(form.decimal_places) as (typeof DECIMAL_PLACES)[number]) ? Number(form.decimal_places) : 2;
  const previewDate = ({
    "DD/MM/YYYY": "06/08/2026", "MM/DD/YYYY": "08/06/2026", "YYYY-MM-DD": "2026-08-06",
    "DD-MM-YYYY": "06-08-2026", "MM-DD-YYYY": "08-06-2026", "DD.MM.YYYY": "06.08.2026", "YYYY/MM/DD": "2026/08/06",
  } as Record<string, string>)[dateFormat];
  const previewTime = timeFormat === "12h" ? "2:30 PM" : "14:30";

  const save = useMutation({
    mutationFn: async () => {
      if (!form.id) throw new Error("Settings are still loading.");
      const { error } = await (supabase.from("company_settings" as any).update({
        date_format: dateFormat,
        time_format: timeFormat,
        number_format: numberFormat,
        decimal_places: decimalPlaces,
      }).eq("id", form.id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Display formats saved");
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <p className="text-sm text-muted-foreground">Choose how dates, times, and financial numbers are shown across new screens. Existing stored data is not changed.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div><Label>Date format</Label><Select value={dateFormat} onValueChange={(value) => setForm({ ...form, date_format: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DATE_FORMATS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Time format</Label><Select value={timeFormat} onValueChange={(value) => setForm({ ...form, time_format: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="24h">24-hour (14:30)</SelectItem><SelectItem value="12h">12-hour (2:30 PM)</SelectItem></SelectContent></Select></div>
        <div><Label>Number format</Label><Select value={numberFormat} onValueChange={(value) => setForm({ ...form, number_format: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="comma-dot">1,234.56</SelectItem><SelectItem value="dot-comma">1.234,56</SelectItem><SelectItem value="space-dot">1 234.56</SelectItem><SelectItem value="space-comma">1 234,56</SelectItem><SelectItem value="apostrophe-dot">1&apos;234.56</SelectItem><SelectItem value="none-dot">1234.56</SelectItem></SelectContent></Select></div>
        <div><Label>Decimal places</Label><Select value={String(decimalPlaces)} onValueChange={(value) => setForm({ ...form, decimal_places: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DECIMAL_PLACES.map((value) => <SelectItem key={value} value={String(value)}>{value} {value === 1 ? "decimal" : "decimals"}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="grid gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-3"><div><span className="text-muted-foreground">Date preview</span><p className="font-medium">{previewDate}</p></div><div><span className="text-muted-foreground">Time preview</span><p className="font-medium">{previewTime}</p></div><div><span className="text-muted-foreground">Number preview</span><p className="font-medium">{formatNumberPreview(1234567.89, numberFormat, decimalPlaces)}</p></div></div>
      <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending}>Save formats</Button></div>
    </div>
  );
}

function RolesTab() {
  const qc = useQueryClient();
  const [role, setRole] = useState<string>("admin");
  const { data: perms = [] } = useQuery({
    queryKey: ["role-permissions", role],
    queryFn: async () => {
      const { data, error } = await (supabase.from("role_permissions" as any).select("*").eq("role", role) as any);
      if (error) throw error;
      return data as any[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, key, value }: { id: string; key: string; value: boolean }) => {
      const { error } = await (supabase.from("role_permissions" as any).update({ [key]: value }).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role-permissions", role] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p><span className="font-medium">Least privilege:</span> only grant actions required for the selected role. Permission changes take effect immediately.</p>
      </div>
      <div className="flex items-center gap-2">
        <Label>Role</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Module</TableHead>
            {PERMS.map(p => <TableHead key={p.key} className="text-center">{p.label}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>
            {MODULES.map(m => {
              const row = perms.find((p: any) => p.module === m);
              if (!row) return null;
              return (
                <TableRow key={m}>
                  <TableCell className="font-medium capitalize">{m}</TableCell>
                  {PERMS.map(p => (
                    <TableCell key={p.key} className="text-center">
                      <Switch aria-label={`${role} ${m} ${p.label}`} checked={!!row[p.key]} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate({ id: row.id, key: p.key, value: v })} />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
