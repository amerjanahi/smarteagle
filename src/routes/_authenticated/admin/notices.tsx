import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Megaphone, Pencil, Trash2, Eye, Send, FileText, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDeleteDialog } from "@/components/admin/ConfirmDeleteDialog";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { DevicePreview } from "@/components/admin/DevicePreview";
import { sanitizeHtml } from "@/lib/sanitize-html";

export const Route = createFileRoute("/_authenticated/admin/notices")({
  head: () => ({ meta: [{ title: "Notices — Hayy Admin" }] }),
  component: NoticesPage,
});

type Notice = {
  id: string; subject: string; body: string; channel: string; audience: string;
  group_id: string | null; status: string; image_url: string | null;
  recipient_count: number; sent_at: string; published_at: string | null;
  created_at: string; updated_at: string;
  notice_groups?: { name: string } | null;
};

type Form = {
  id?: string; subject: string; body: string; channel: string; audience: string;
  group_id: string; image_url: string;
};

const EMPTY: Form = { subject: "", body: "", channel: "notice", audience: "all", group_id: "", image_url: "" };

function NoticesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Notice | null>(null);
  const [viewersNotice, setViewersNotice] = useState<Notice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Notice | null>(null);
  const [tab, setTab] = useState<"all" | "published" | "draft">("all");
  const [form, setForm] = useState<Form>(EMPTY);

  const { data: notices = [] } = useQuery({
    queryKey: ["notices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notices").select("*, notice_groups(name)").order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Notice[];
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["notice-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notice_groups").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const { data: viewReceipts = [], isLoading: loadingViewReceipts } = useQuery({
    queryKey: ["notice-view-receipts", viewersNotice?.id],
    enabled: !!viewersNotice,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_notice_viewers" as any, { p_notice_id: viewersNotice!.id } as any);
      if (error) throw error;
      return (data ?? []) as { user_id: string; full_name: string | null; email: string | null; viewed_at: string }[];
    },
  });
  const { data: viewCounts = [] } = useQuery({
    queryKey: ["notice-view-counts"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("notice_views" as any) as any).select("notice_id");
      if (error) throw error;
      return (data ?? []) as { notice_id: string }[];
    },
  });
  const viewsFor = (noticeId: string) => viewCounts.filter((view) => view.notice_id === noticeId).length;

  const save = useMutation({
    mutationFn: async ({ publish }: { publish: boolean }) => {
      let count = 0;
      if (publish) {
        if (form.audience === "all") {
          const { count: c } = await supabase.from("profiles").select("id", { count: "exact", head: true });
          count = c ?? 0;
        } else if (form.group_id) {
          const { count: c } = await supabase.from("notice_group_members").select("id", { count: "exact", head: true }).eq("group_id", form.group_id);
          count = c ?? 0;
        }
      }
      const payload: any = {
        subject: form.subject, body: sanitizeHtml(form.body), channel: form.channel, audience: form.audience,
        group_id: form.audience === "group" ? form.group_id : null,
        image_url: form.image_url || null,
        status: publish ? "published" : "draft",
        ...(publish ? { published_at: new Date().toISOString(), recipient_count: count, sent_by: user?.id ?? null } : {}),
      };
      if (form.id) {
        const { error } = await supabase.from("notices").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notices").insert({ ...payload, sent_by: user?.id ?? null } as never);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.publish ? "Notice published" : "Draft saved");
      setOpen(false); setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["notices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async (n: Notice) => {
      const nowDraft = n.status === "published";
      const patch: any = nowDraft
        ? { status: "draft" }
        : { status: "published", published_at: new Date().toISOString() };
      const { error } = await supabase.from("notices").update(patch).eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["notices"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (n: Notice) => {
      const { error } = await supabase.from("notices").delete().eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); setDeleteTarget(null); qc.invalidateQueries({ queryKey: ["notices"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setForm(EMPTY); setOpen(true); };
  const openEdit = (n: Notice) => {
    setForm({
      id: n.id, subject: n.subject, body: n.body, channel: n.channel,
      audience: n.audience, group_id: n.group_id ?? "", image_url: n.image_url ?? "",
    });
    setOpen(true);
  };

  const filtered = notices.filter((n) => tab === "all" ? true : n.status === tab);

  async function handleCoverUpload(file: File) {
    try {
      const path = `cover-${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("notice-images").upload(path, file);
      if (error) throw error;
      const { data } = await supabase.storage.from("notice-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (data?.signedUrl) setForm((f) => ({ ...f, image_url: data.signedUrl }));
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Notices</h1>
          <p className="text-sm text-muted-foreground">Create, edit, and publish notices to residents.</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />New notice</Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All ({notices.length})</TabsTrigger>
          <TabsTrigger value="published">Published ({notices.filter(n => n.status === "published").length})</TabsTrigger>
          <TabsTrigger value="draft">Drafts ({notices.filter(n => n.status === "draft").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Megaphone className="mx-auto mb-2 h-6 w-6" /> No notices
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Recipients / viewed</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Modified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {n.image_url && <img src={n.image_url} alt="" className="h-8 w-8 rounded object-cover" />}
                      <div>
                        <div className="font-medium">{n.subject || "(untitled)"}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{(n.body || "").replace(/<[^>]+>/g, " ").slice(0, 120)}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={n.status === "published" ? "default" : "outline"}>
                      {n.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant="outline">{n.channel}</Badge></TableCell>
                  <TableCell>{n.audience === "all" ? "All" : (n.notice_groups?.name ?? "Group")}</TableCell>
                  <TableCell>{n.status === "published" ? <span>{n.recipient_count} / {viewsFor(n.id)} viewed</span> : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(n.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setPreview(n)}><Eye className="h-4 w-4" /></Button>
                      {n.status === "published" && <Button size="sm" variant="ghost" onClick={() => setViewersNotice(n)} title="View read receipts"><Users className="h-4 w-4" /></Button>}
                      <Button size="sm" variant="ghost" onClick={() => openEdit(n)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => togglePublish.mutate(n)} title={n.status === "published" ? "Unpublish" : "Publish"}>
                        {n.status === "published" ? <FileText className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(n)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit notice" : "New notice"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <Label>Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Notice subject" />
            </div>
            <div>
              <Label>Cover image</Label>
              <div className="flex items-center gap-3">
                {form.image_url && <img src={form.image_url} alt="Cover" className="h-16 w-16 rounded border border-border object-cover" />}
                <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }} />
                {form.image_url && <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, image_url: "" })}>Remove</Button>}
              </div>
            </div>
            <div>
              <Label>Message</Label>
              <RichTextEditor value={form.body} onChange={(html) => setForm({ ...form, body: html })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Channel</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notice">In-app notice</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Audience</Label>
                <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All residents</SelectItem>
                    <SelectItem value="group">Specific group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.audience === "group" && (
              <div>
                <Label>Group</Label>
                <Select value={form.group_id} onValueChange={(v) => setForm({ ...form, group_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a group" /></SelectTrigger>
                  <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Live preview</Label>
            <DevicePreview>
              {(device) => (
                <div className={device === "mobile" ? "p-3 text-sm min-h-[420px]" : "p-6 min-h-[520px]"}>
                  <h2 className={device === "mobile" ? "text-base font-semibold mb-2" : "text-xl font-semibold mb-3"}>{form.subject || "(subject)"}</h2>
                  {form.image_url && <img src={form.image_url} alt="" className="w-full rounded-lg mb-3" />}
                  <div className="prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_img]:rounded-lg" dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.body) || "<p class='text-muted-foreground'>Start typing to see the preview…</p>" }} />
                </div>
              )}
            </DevicePreview>
          </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => save.mutate({ publish: false })} disabled={!form.subject || save.isPending}>
              Save draft
            </Button>
            <Button onClick={() => save.mutate({ publish: true })}
              disabled={!form.subject || !form.body || (form.audience === "group" && !form.group_id) || save.isPending}>
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{preview?.subject}</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={preview.status === "published" ? "default" : "outline"}>{preview.status}</Badge>
                <span>Created {new Date(preview.created_at).toLocaleString()}</span>
                <span>· Modified {new Date(preview.updated_at).toLocaleString()}</span>
              </div>
              <DevicePreview>
                {(device) => (
                  <div className={device === "mobile" ? "p-3 text-sm" : "p-6"}>
                    <h2 className={device === "mobile" ? "text-base font-semibold mb-2" : "text-xl font-semibold mb-3"}>{preview.subject}</h2>
                    {preview.image_url && <img src={preview.image_url} alt="" className="w-full rounded-lg mb-3" />}
                    <div className="prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_img]:rounded-lg" dangerouslySetInnerHTML={{ __html: sanitizeHtml(preview.body) }} />
                  </div>
                )}
              </DevicePreview>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewersNotice} onOpenChange={(o) => !o && setViewersNotice(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Viewed by — {viewersNotice?.subject}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Read receipts are visible to Top Admin only. Residents cannot see who else viewed this notice.</p>
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
            {loadingViewReceipts ? <p className="p-4 text-sm text-muted-foreground">Loading view receipts…</p> : viewReceipts.length ? (
              <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Viewed</TableHead></TableRow></TableHeader><TableBody>
                {viewReceipts.map((receipt) => <TableRow key={receipt.user_id}><TableCell>{receipt.full_name || "Unnamed user"}</TableCell><TableCell>{receipt.email || "—"}</TableCell><TableCell className="text-xs text-muted-foreground">{new Date(receipt.viewed_at).toLocaleString()}</TableCell></TableRow>)}
              </TableBody></Table>
            ) : <p className="p-4 text-sm text-muted-foreground">No one has viewed this notice yet.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete notice?"
        description="This will permanently remove the notice."
        onConfirm={() => deleteTarget && del.mutate(deleteTarget)}
        busy={del.isPending}
      />
    </div>
  );
}
