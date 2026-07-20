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
import { Plus, Trash2, Save } from "lucide-react";
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
                  <Badge variant="outline">{t.template_type}</Badge>
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
                      <SelectItem value="invoice">Invoice</SelectItem>
                      <SelectItem value="receipt">Receipt</SelectItem>
                      <SelectItem value="credit_note">Credit Note</SelectItem>
                      <SelectItem value="statement">Statement</SelectItem>
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

              <div>
                <Label className="mb-2 block">Visible fields</Label>
                <div className="space-y-2">
                  {Object.entries(editing.fields_json).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{k.replace(/_/g, " ")}</span>
                      <Switch checked={v} onCheckedChange={(nv) => setEditing({ ...editing, fields_json: { ...editing.fields_json, [k]: nv } })} />
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
