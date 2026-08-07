import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useMemo, useState } from "react";
import { listTemplates, saveTemplate, deleteTemplate, duplicateTemplate } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Copy, Star } from "lucide-react";
import { toast } from "sonner";
import { defaultDoc } from "@/components/admin/template-designer/factory";
import { renderDocHtml } from "@/components/admin/template-designer/renderHtml";
import type { CanvasDoc, TplType } from "@/components/admin/template-designer/types";

const Designer = lazy(() => import("@/components/admin/template-designer/Designer").then(({ Designer }) => ({ default: Designer })));

export const Route = createFileRoute("/_authenticated/admin/templates")({
  head: () => ({ meta: [{ title: "Document Templates — Hayy Admin" }] }),
  component: TemplatesPage,
});

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

function blankTpl(type: TplType = "invoice"): Tpl {
  return {
    template_type: type,
    name: `New ${TYPE_LABELS[type]}`,
    logo_url: "",
    primary_color: "#0F172A",
    accent_color: "#3B82F6",
    header_text: "",
    footer_text: "",
    fields_json: { canvas: defaultDoc(type), version: 1 },
    layout: "standard",
    is_default: false,
  };
}

function TemplatesPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listTemplates);
  const save = useServerFn(saveTemplate);
  const del = useServerFn(deleteTemplate);
  const dup = useServerFn(duplicateTemplate);

  const list = useQuery({ queryKey: ["templates"], queryFn: () => fetchList() });
  const [editing, setEditing] = useState<Tpl | null>(null);

  const canvasDoc: CanvasDoc = useMemo(() => {
    return (editing?.fields_json?.canvas as CanvasDoc) ?? defaultDoc(editing?.template_type ?? "invoice");
  }, [editing]);

  const setCanvas = (doc: CanvasDoc) => {
    if (!editing) return;
    setEditing({ ...editing, fields_json: { ...editing.fields_json, canvas: doc } });
  };

  const saveMut = useMutation({
    mutationFn: async () => save({ data: editing! as any }),
    onSuccess: (res: any) => {
      toast.success("Template saved");
      qc.invalidateQueries({ queryKey: ["templates"] });
      if (res?.id && editing) setEditing({ ...editing, id: res.id });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openPreview = (autoPrint = false) => {
    if (!editing) return;
    const html = renderDocHtml(canvasDoc, editing.template_type, {
      title: `${editing.name} preview`,
      logoUrl: editing.logo_url,
      autoPrint,
    });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const t of list.data ?? []) {
      const k = t.template_type;
      (g[k] ??= []).push(t);
    }
    return g;
  }, [list.data]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Document Templates</h2>
          <p className="text-sm text-muted-foreground">Drag-and-drop WYSIWYG designer with merge fields, tables, and pixel-accurate PDF/print.</p>
        </div>
        <div className="flex gap-2">
          <Select onValueChange={(v: TplType) => setEditing(blankTpl(v))}>
            <SelectTrigger className="w-48"><SelectValue placeholder="New template…" /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as TplType[]).map((k) => (
                <SelectItem key={k} value={k}>{TYPE_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {!editing ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(TYPE_LABELS) as TplType[]).map((k) => (
            <Card key={k}>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">{TYPE_LABELS[k]}</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setEditing(blankTpl(k))}><Plus className="h-4 w-4 mr-1" />New</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {(grouped[k] ?? []).length === 0 && <p className="text-xs text-muted-foreground">No templates yet.</p>}
                {(grouped[k] ?? []).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between rounded border p-2 hover:bg-muted/50">
                    <button className="flex-1 text-left" onClick={() => setEditing(t)}>
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.layout}</div>
                    </button>
                    <div className="flex items-center gap-1">
                      {t.is_default && <Badge variant="secondary"><Star className="h-3 w-3 mr-0.5" />Default</Badge>}
                      <Button size="icon" variant="ghost" title="Duplicate" onClick={async () => {
                        await dup({ data: { id: t.id } });
                        qc.invalidateQueries({ queryKey: ["templates"] });
                        toast.success("Duplicated");
                      }}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4 grid gap-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <Label className="text-xs">Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={editing.template_type} onValueChange={(v: TplType) => setEditing({ ...editing, template_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as TplType[]).map((k) => (
                      <SelectItem key={k} value={k}>{TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Logo URL</Label>
                <Input value={editing.logo_url ?? ""} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} placeholder="https://…" />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <Label className="text-xs block">Default</Label>
                  <p className="text-[10px] text-muted-foreground">For this type</p>
                </div>
                <Switch checked={editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} />
              </div>
              <div className="md:col-span-6 flex items-center justify-between pt-2 border-t">
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditing(null)}>Back</Button>
                  {editing.id && (
                    <Button variant="ghost" onClick={async () => {
                      const r: any = await dup({ data: { id: editing.id! } });
                      qc.invalidateQueries({ queryKey: ["templates"] });
                      toast.success("Duplicated as new version");
                      if (r?.id) {
                        const list2: any = await fetchList();
                        const created = list2.find((x: any) => x.id === r.id);
                        if (created) setEditing(created);
                      }
                    }}><Copy className="h-4 w-4 mr-1" />Duplicate / Version</Button>
                  )}
                  {editing.id && (
                    <Button variant="ghost" className="text-red-600" onClick={async () => {
                      if (!confirm("Delete this template?")) return;
                      await del({ data: { id: editing.id! } });
                      qc.invalidateQueries({ queryKey: ["templates"] });
                      setEditing(null);
                    }}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                  )}
                </div>
                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                  <Save className="h-4 w-4 mr-1" />{saveMut.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Suspense fallback={<div className="rounded-xl border bg-muted/20 p-8 text-center text-sm text-muted-foreground">Loading template editor…</div>}>
            <Designer
              value={canvasDoc}
              type={editing.template_type}
              logoUrl={editing.logo_url}
              onChange={setCanvas}
              onPreview={() => openPreview(false)}
              onPrint={() => openPreview(true)}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
