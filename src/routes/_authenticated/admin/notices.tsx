import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/notices")({
  head: () => ({ meta: [{ title: "Notices — Hayy Admin" }] }),
  component: NoticesPage,
});

function NoticesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "", channel: "notice", audience: "all", group_id: "" });

  const { data: notices = [] } = useQuery({
    queryKey: ["notices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notices").select("*, notice_groups(name)").order("sent_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
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

  const send = useMutation({
    mutationFn: async () => {
      let count = 0;
      if (form.audience === "all") {
        const { count: c } = await supabase.from("profiles").select("id", { count: "exact", head: true });
        count = c ?? 0;
      } else if (form.group_id) {
        const { count: c } = await supabase.from("notice_group_members").select("id", { count: "exact", head: true }).eq("group_id", form.group_id);
        count = c ?? 0;
      }
      const { error } = await supabase.from("notices").insert({
        subject: form.subject, body: form.body, channel: form.channel, audience: form.audience,
        group_id: form.audience === "group" ? form.group_id : null,
        sent_by: user?.id ?? null,
        recipient_count: count,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notice sent");
      setOpen(false);
      setForm({ subject: "", body: "", channel: "notice", audience: "all", group_id: "" });
      qc.invalidateQueries({ queryKey: ["notices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Notices</h1>
          <p className="text-sm text-muted-foreground">Send notices to all residents or selected groups.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Send notice</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Compose notice</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
              <div><Label>Message</Label><Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
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
              <Button onClick={() => send.mutate()} disabled={!form.subject || !form.body || (form.audience === "group" && !form.group_id) || send.isPending} className="w-full">
                Send
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {notices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Megaphone className="mx-auto mb-2 h-6 w-6" /> No notices yet
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Channel</TableHead><TableHead>Audience</TableHead><TableHead>Recipients</TableHead><TableHead>Sent</TableHead></TableRow></TableHeader>
            <TableBody>
              {notices.map((n) => (
                <TableRow key={n.id}>
                  <TableCell><div className="font-medium">{n.subject}</div><div className="text-xs text-muted-foreground line-clamp-1">{n.body}</div></TableCell>
                  <TableCell><Badge variant="outline">{n.channel}</Badge></TableCell>
                  <TableCell>{n.audience === "all" ? "All residents" : (n.notice_groups?.name ?? "Group")}</TableCell>
                  <TableCell>{n.recipient_count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(n.sent_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
