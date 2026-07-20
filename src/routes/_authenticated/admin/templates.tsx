import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listTemplates, saveTemplate, deleteTemplate } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/templates")({
  head: () => ({ meta: [{ title: "Document Templates — Hayy Admin" }] }),
  component: TemplatesPage,
});

type TplType = "invoice" | "receipt" | "credit_note" | "statement" | "work_order" | "purchase_order";

type Tpl = {
  id?: string;
  template_type: TplType;
  name: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  header_text: string;
  footer_text: string;
  fields_json: Record<string, any>;
  layout: "compact" | "standard" | "detailed";
  is_default: boolean;
};

const TYPE_LABELS: Record<TplType, string> = {
  invoice: "Invoice",
  receipt: "Receipt",
  credit_note: "Credit Note",
  statement: "Statement of Account",
  work_order: "Work Order",
  purchase_order: "Purchase Order",
};

const blank: Tpl = {
  template_type: "invoice",
  name: "New template",
  logo_url: "",
  primary_color: "#0F172A",
  accent_color: "#3B82F6",
  header_text: "",
  footer_text: "Thank you for your business.",
  fields_json: {
    show_logo: true,
    show_company_details: true,
    show_numbering: true,
    show_tax: true,
    show_period: true,
    show_notes: false,
    show_terms: true,
    company_details_text: "",
    terms_text: "",
    number_prefix: "",
  },
  layout: "standard",
  is_default: false,
};

function TemplatesPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listTemplates);
  const save = useServerFn(saveTemplate);
  const del = useServerFn(deleteTemplate);

  const list = useQuery({ queryKey: ["templates"], queryFn: () => fetchList() });
  const [editing, setEditing] = useState<Tpl | null>(null);

  const saveMut = useMutation({
    mutationFn: async () => save({ data: editing! as any }),
    onSuccess: () => {
      toast.success("Template saved");
      qc.invalidateQueries({ queryKey: ["templates"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openPreview(t: Tpl) {
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(renderPreviewHtml(t));
    w.document.close();
  }


  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Document Templates</h2>
          <p className="text-sm text-muted-foreground">Customize logo, colors, header, footer, and visible fields per document type.</p>
        </div>
        <Button onClick={() => setEditing(blank)}><Plus className="mr-2 h-4 w-4" /> New template</Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {list.data?.map((t: any) => (
            <Card key={t.id} className="cursor-pointer" onClick={() => setEditing(t)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">{t.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {t.is_default && <Badge>Default</Badge>}
                  <Badge variant="outline">{TYPE_LABELS[t.template_type as TplType] ?? t.template_type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <div className="h-6 w-6 rounded" style={{ background: t.primary_color }} />
                <div className="h-6 w-6 rounded" style={{ background: t.accent_color }} />
                <span className="text-xs text-muted-foreground">{t.layout}</span>
              </CardContent>
            </Card>
          ))}
          {!list.data?.length && <p className="text-sm text-muted-foreground">No templates yet. Click New template to create one.</p>}
        </div>

        {editing && (
          <Card>
            <CardHeader><CardTitle className="text-base">{editing.id ? "Edit" : "New"} template</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={editing.template_type} onValueChange={(v: any) => setEditing({ ...editing, template_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABELS) as TplType[]).map((k) => (
                        <SelectItem key={k} value={k}>{TYPE_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Layout</Label>
                  <Select value={editing.layout} onValueChange={(v: any) => setEditing({ ...editing, layout: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <Label className="block">Default for type</Label>
                    <p className="text-xs text-muted-foreground">Used for all PDFs of this type</p>
                  </div>
                  <Switch checked={editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Primary color</Label>
                  <Input type="color" value={editing.primary_color} onChange={(e) => setEditing({ ...editing, primary_color: e.target.value })} />
                </div>
                <div>
                  <Label>Accent color</Label>
                  <Input type="color" value={editing.accent_color} onChange={(e) => setEditing({ ...editing, accent_color: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Logo URL</Label>
                <Input value={editing.logo_url ?? ""} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} placeholder="https://…" />
              </div>
              <div>
                <Label>Header text</Label>
                <Input value={editing.header_text ?? ""} onChange={(e) => setEditing({ ...editing, header_text: e.target.value })} placeholder="Company name, address, TRN" />
              </div>
              <div>
                <Label>Footer text</Label>
                <Textarea value={editing.footer_text ?? ""} onChange={(e) => setEditing({ ...editing, footer_text: e.target.value })} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Number prefix</Label>
                  <Input
                    value={(editing.fields_json?.number_prefix as string) ?? ""}
                    onChange={(e) => setEditing({ ...editing, fields_json: { ...editing.fields_json, number_prefix: e.target.value } })}
                    placeholder="INV, WO, PO…"
                  />
                </div>
              </div>
              <div>
                <Label>Company details</Label>
                <Textarea
                  rows={3}
                  value={(editing.fields_json?.company_details_text as string) ?? ""}
                  onChange={(e) => setEditing({ ...editing, fields_json: { ...editing.fields_json, company_details_text: e.target.value } })}
                  placeholder="Name, address, TRN, phone, email"
                />
              </div>
              <div>
                <Label>Terms &amp; conditions</Label>
                <Textarea
                  rows={3}
                  value={(editing.fields_json?.terms_text as string) ?? ""}
                  onChange={(e) => setEditing({ ...editing, fields_json: { ...editing.fields_json, terms_text: e.target.value } })}
                  placeholder="Payment terms, warranty, etc."
                />
              </div>

              <div>
                <Label className="mb-2 block">Visible fields</Label>
                <div className="space-y-2">
                  {Object.entries(editing.fields_json)
                    .filter(([k, v]) => typeof v === "boolean" && k.startsWith("show_"))
                    .map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{k.replace(/^show_/, "").replace(/_/g, " ")}</span>
                        <Switch checked={!!v} onCheckedChange={(nv) => setEditing({ ...editing, fields_json: { ...editing.fields_json, [k]: nv } })} />
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {editing.id ? (
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={async () => {
                    if (!confirm("Delete this template?")) return;
                    await del({ data: { id: editing.id! } });
                    qc.invalidateQueries({ queryKey: ["templates"] });
                    setEditing(null);
                  }}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => openPreview(editing)}>
                    <Eye className="mr-2 h-4 w-4" /> Preview
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                    <Save className="mr-2 h-4 w-4" /> {saveMut.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function renderPreviewHtml(t: Tpl): string {
  const f = t.fields_json ?? {};
  const showLogo = f.show_logo !== false && t.logo_url;
  const showCompany = f.show_company_details !== false && f.company_details_text;
  const showTerms = f.show_terms !== false && f.terms_text;
  const numPrefix = f.number_prefix || "DOC";
  const label = TYPE_LABELS[t.template_type];
  const rows = t.template_type === "statement"
    ? `<tr><td>2026-01-15</td><td>${numPrefix}-2026-00001</td><td>Sample line</td><td class="r">1,000.00</td><td class="r">—</td><td class="r">1,000.00</td></tr>`
    : `<tr><td>Sample description</td><td class="r">1</td><td class="r">1,000.00</td>${f.show_tax !== false ? '<td class="r">5%</td>' : ""}<td class="r">1,050.00</td></tr>`;
  const cols = t.template_type === "statement"
    ? `<th>Date</th><th>Reference</th><th>Description</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th>`
    : `<th>Description</th><th class="r">Qty</th><th class="r">Unit Price</th>${f.show_tax !== false ? '<th class="r">Tax</th>' : ""}<th class="r">Total</th>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${label} Preview</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #0f172a; margin: 24px; }
  .bar { background: ${t.primary_color}; color: #fff; padding: 14px 20px; display:flex; align-items:center; justify-content:space-between; }
  .bar h1 { margin:0; font-size:20px; letter-spacing:2px; }
  .logo { max-height: 40px; background:#fff; padding:4px; border-radius:4px; }
  .meta { display:flex; justify-content:space-between; margin:20px 0; font-size: 13px; }
  table { width:100%; border-collapse: collapse; margin-top: 16px; font-size:13px; }
  th { background: ${t.accent_color}; color:#fff; text-align:left; padding: 8px; }
  td { padding: 8px; border-bottom: 1px solid #eee; }
  .r { text-align: right; }
  .totals { margin-top:16px; text-align:right; font-size:13px; }
  .totals div { padding:4px 0; }
  .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color:#666; white-space: pre-wrap; }
  .terms { margin-top: 24px; font-size: 11px; color:#444; white-space: pre-wrap; }
  .company { font-size: 12px; color:#333; white-space: pre-wrap; margin-top:6px; }
  .actions { position:fixed; top:8px; right:8px; }
  .actions button { padding: 6px 12px; margin-left:4px; }
  @media print { .actions { display: none; } body { margin: 0; } }
</style></head><body>
<div class="actions"><button onclick="window.print()">Print / Save as PDF</button><button onclick="window.close()">Close</button></div>
<div class="bar">
  <div>${showLogo ? `<img class="logo" src="${t.logo_url}"/>` : ""}</div>
  <h1>${label.toUpperCase()}</h1>
</div>
${t.header_text ? `<div style="font-size:11px;color:#666;margin-top:8px">${t.header_text}</div>` : ""}
${showCompany ? `<div class="company">${escapeHtml(f.company_details_text)}</div>` : ""}
<div class="meta">
  <div><strong>Bill To</strong><br/>Sample Customer<br/>Unit 101</div>
  <div>
    <div><strong>${label} #</strong> ${numPrefix}-2026-00001</div>
    <div><strong>Date</strong> 2026-01-20</div>
    ${t.template_type !== "receipt" && t.template_type !== "statement" ? '<div><strong>Due</strong> 2026-02-20</div>' : ""}
  </div>
</div>
<table><thead><tr>${cols}</tr></thead><tbody>${rows}</tbody></table>
${t.template_type !== "statement" ? `<div class="totals">
  <div>Subtotal: 1,000.00</div>
  ${f.show_tax !== false ? "<div>Tax: 50.00</div>" : ""}
  <div><strong>Total: 1,050.00</strong></div>
</div>` : ""}
${showTerms ? `<div class="terms"><strong>Terms &amp; Conditions</strong><br/>${escapeHtml(f.terms_text)}</div>` : ""}
${t.footer_text ? `<div class="footer">${escapeHtml(t.footer_text)}</div>` : ""}
</body></html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
}
