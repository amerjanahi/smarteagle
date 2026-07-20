import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listDocuments, listFolders, saveDocument, deleteDocument, setArchived, getSignedUrl,
} from "@/lib/documents.functions";
import { listUnits } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  FolderOpen, Upload, Search, Trash2, Archive, ArchiveRestore, Download, Eye, Pencil, Folder,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  head: () => ({ meta: [{ title: "Documents — Hayy Admin" }] }),
  component: DocumentsPage,
});

type DocRow = any;

const BUCKET = "documents";

function DocumentsPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listDocuments);
  const fetchFolders = useServerFn(listFolders);
  const fetchUnits = useServerFn(listUnits);
  const save = useServerFn(saveDocument);
  const del = useServerFn(deleteDocument);
  const archive = useServerFn(setArchived);
  const sign = useServerFn(getSignedUrl);

  const [q, setQ] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [archived, setArchivedF] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [unitFilter, setUnitFilter] = useState<string | null>(null);

  const [editing, setEditing] = useState<Partial<DocRow> | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const filters = { q: q || undefined, folder, category, archived, from: from || null, to: to || null, unit_id: unitFilter };
  const list = useQuery({ queryKey: ["docs", filters], queryFn: () => fetchList({ data: filters as any }) });
  const meta = useQuery({ queryKey: ["docs-folders"], queryFn: () => fetchFolders() });
  const units = useQuery({ queryKey: ["units-min"], queryFn: () => fetchUnits() });

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      let file_url = payload.file_url ?? null;
      if (uploadingFile) {
        const ext = uploadingFile.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, uploadingFile, { upsert: false });
        if (error) throw error;
        file_url = path;
      }
      return save({ data: { ...payload, file_url } as any });
    },
    onSuccess: () => {
      toast.success("Document saved");
      qc.invalidateQueries({ queryKey: ["docs"] });
      qc.invalidateQueries({ queryKey: ["docs-folders"] });
      setEditing(null); setUploadingFile(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function openFile(path: string) {
    const { url } = await sign({ data: { path } });
    setPreviewUrl(url);
  }

  async function downloadFile(path: string, title: string) {
    const { url } = await sign({ data: { path } });
    const a = document.createElement("a");
    a.href = url; a.download = title || "document"; document.body.appendChild(a); a.click(); a.remove();
  }

  const folders = meta.data?.folders ?? [];
  const categories = meta.data?.categories ?? [];

  const grouped = useMemo(() => {
    const m: Record<string, DocRow[]> = {};
    for (const r of list.data ?? []) {
      const k = r.folder || "Uncategorized";
      (m[k] ??= []).push(r);
    }
    return m;
  }, [list.data]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Documents</h2>
          <p className="text-sm text-muted-foreground">Upload, organize, and link documents to units, residents, suppliers, invoices and orders.</p>
        </div>
        <Button onClick={() => setEditing({ access_level: "admin", tags: [], archived: false })}>
          <Upload className="mr-2 h-4 w-4" /> Upload document
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <aside className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Folders</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <button className={`flex w-full items-center gap-2 rounded px-2 py-1 hover:bg-accent ${!folder ? "bg-accent" : ""}`} onClick={() => setFolder(null)}>
                <FolderOpen className="h-4 w-4" /> All
              </button>
              {folders.map((f) => (
                <button key={f} className={`flex w-full items-center gap-2 rounded px-2 py-1 hover:bg-accent ${folder === f ? "bg-accent" : ""}`} onClick={() => setFolder(f)}>
                  <Folder className="h-4 w-4" /> {f}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Category</CardTitle></CardHeader>
            <CardContent>
              <Select value={category ?? "all"} onValueChange={(v) => setCategory(v === "all" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={archived} onChange={(e) => setArchivedF(e.target.checked)} /> Show archived
              </label>
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search title, description…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
            <Select value={unitFilter ?? "all"} onValueChange={(v) => setUnitFilter(v === "all" ? null : v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Unit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All units</SelectItem>
                {(units.data ?? []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.unit_number} {u.building ?? ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!list.isLoading && (list.data?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No documents found.</p>}

          {Object.entries(grouped).map(([g, rows]) => (
            <div key={g} className="space-y-2">
              <h3 className="text-sm font-semibold">{g}</h3>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((r) => (
                  <Card key={r.id} className={r.archived ? "opacity-60" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm">{r.title}</CardTitle>
                        <Badge variant="outline">{r.access_level}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      {r.description && <p className="line-clamp-2">{r.description}</p>}
                      <div className="flex flex-wrap gap-1">
                        {(r.tags ?? []).map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.units && <span>Unit {r.units.unit_number}</span>}
                        {r.vendors && <span>· {r.vendors.name}</span>}
                        {r.invoices && <span>· {r.invoices.invoice_number}</span>}
                        {r.purchase_invoices && <span>· {r.purchase_invoices.bill_number}</span>}
                        {r.document_date && <span>· {r.document_date}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1 pt-2">
                        {r.file_url && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openFile(r.file_url)}><Eye className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => downloadFile(r.file_url, r.title)}><Download className="h-3.5 w-3.5" /></Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          await archive({ data: { id: r.id, archived: !r.archived } });
                          qc.invalidateQueries({ queryKey: ["docs"] });
                        }}>
                          {r.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => {
                          if (!confirm("Delete this document?")) return;
                          await del({ data: { id: r.id } });
                          qc.invalidateQueries({ queryKey: ["docs"] });
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit / Upload dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) { setEditing(null); setUploadingFile(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit document" : "Upload document"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Title</Label>
                <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <Label>Folder</Label>
                <Input list="folders-dl" value={editing.folder ?? ""} onChange={(e) => setEditing({ ...editing, folder: e.target.value })} />
                <datalist id="folders-dl">{folders.map((f) => <option key={f} value={f} />)}</datalist>
              </div>
              <div>
                <Label>Category</Label>
                <Input list="cats-dl" value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                <datalist id="cats-dl">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <Label>Tags (comma separated)</Label>
                <Input
                  value={(editing.tags ?? []).join(", ")}
                  onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean) })}
                />
              </div>
              <div>
                <Label>Document date</Label>
                <Input type="date" value={editing.document_date ?? ""} onChange={(e) => setEditing({ ...editing, document_date: e.target.value })} />
              </div>
              <div>
                <Label>Access</Label>
                <Select value={editing.access_level ?? "admin"} onValueChange={(v) => setEditing({ ...editing, access_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin only</SelectItem>
                    <SelectItem value="staff">Staff (finance/ops)</SelectItem>
                    <SelectItem value="resident">Resident (linked)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={editing.unit_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, unit_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {(units.data ?? []).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.unit_number} {u.building ?? ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>File {editing.file_url ? "(replace)" : ""}</Label>
                <Input type="file" onChange={(e) => setUploadingFile(e.target.files?.[0] ?? null)} />
                {editing.file_url && !uploadingFile && (
                  <p className="mt-1 text-xs text-muted-foreground">Current file will be kept unless replaced.</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setUploadingFile(null); }}>Cancel</Button>
            <Button
              onClick={() => saveMut.mutate(editing)}
              disabled={saveMut.isPending || !editing?.title || (!editing?.id && !uploadingFile)}
            >
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!previewUrl} onOpenChange={(v) => { if (!v) setPreviewUrl(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Preview</DialogTitle></DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} className="h-[70vh] w-full rounded border" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
