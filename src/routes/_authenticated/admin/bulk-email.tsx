import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/bulk-email")({
  head: () => ({ meta: [{ title: "Bulk Email — Hayy Admin" }] }),
  component: BulkEmailPage,
});

function BulkEmailPage() {
  const { user } = useAuth();
  const [audience, setAudience] = useState<"all" | "group">("all");
  const [groupId, setGroupId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["notice-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notice_groups").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: recipients = [] } = useQuery({
    queryKey: ["bulk-recipients", audience, groupId],
    queryFn: async () => {
      if (audience === "all") {
        const { data, error } = await supabase.from("profiles").select("id, email, full_name");
        if (error) throw error;
        return (data ?? []) as any[];
      }
      if (!groupId) return [];
      const { data, error } = await supabase.from("notice_group_members").select("user_id, profiles:user_id(id, email, full_name)").eq("group_id", groupId);
      if (error) throw error;
      return (data ?? []).map((m: any) => m.profiles).filter(Boolean);
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const emails = recipients.map((r: any) => r.email).filter(Boolean);
      if (emails.length === 0) throw new Error("No recipients");
      // Log to notices table for audit
      const { error } = await supabase.from("notices").insert({
        subject, body, channel: "email",
        audience, group_id: audience === "group" ? groupId : null,
        sent_by: user?.id ?? null, recipient_count: emails.length,
      } as never);
      if (error) throw error;
      // Open mail client with bcc list (privacy-friendly)
      const href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = href;
    },
    onSuccess: () => { toast.success(`Queued email to ${recipients.length} recipients`); setSubject(""); setBody(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Bulk Email</h1>
        <p className="text-sm text-muted-foreground">Compose and send bulk emails to residents or groups.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2 rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Audience</Label>
              <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All residents</SelectItem>
                  <SelectItem value="group">Specific group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {audience === "group" && (
              <div>
                <Label>Group</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger><SelectValue placeholder="Pick a group" /></SelectTrigger>
                  <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div><Label>Message</Label><Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <Button onClick={() => send.mutate()} disabled={!subject || !body || send.isPending || recipients.length === 0}>
            <Send className="mr-1 h-4 w-4" /> Send to {recipients.length}
          </Button>
        </div>
        <aside className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Mail className="h-4 w-4" /> Recipients ({recipients.length})</div>
          <ul className="max-h-96 space-y-1 overflow-auto text-xs">
            {recipients.map((r: any) => (
              <li key={r.id} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1">
                <span>{r.full_name || r.email}</span>
                <Badge variant="outline" className="text-[10px]">{r.email}</Badge>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
