import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Users, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/notice-groups")({
  head: () => ({ meta: [{ title: "Groups — Hayy Admin" }] }),
  component: GroupsPage,
});

function GroupsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [memberDialog, setMemberDialog] = useState<any>(null);
  const [pickUser, setPickUser] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["groups-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notice_groups").select("*, notice_group_members(id, user_id, profiles:user_id(email, full_name))").order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, full_name").order("full_name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("notice_groups").update({ name: form.name, description: form.description || null }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notice_groups").insert({ name: form.name, description: form.description || null } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); setOpen(false); setEditing(null); setForm({ name: "", description: "" }); qc.invalidateQueries({ queryKey: ["groups-full"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("notice_groups").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["groups-full"] }); },
  });

  const addMember = useMutation({
    mutationFn: async ({ group_id, user_id }: { group_id: string; user_id: string }) => {
      const { error } = await supabase.from("notice_group_members").insert({ group_id, user_id } as never);
      if (error) throw error;
    },
    onSuccess: () => { setPickUser(""); qc.invalidateQueries({ queryKey: ["groups-full"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("notice_group_members").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups-full"] }),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Groups</h1>
          <p className="text-sm text-muted-foreground">Organize residents into groups for targeted communication.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm({ name: "", description: "" }); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New group</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit group" : "New group"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-6 w-6" /> No groups yet
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{g.name}</p>
                  {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                  <Badge variant="outline" className="mt-1">{g.notice_group_members?.length ?? 0} members</Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(g); setForm({ name: g.name, description: g.description ?? "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setMemberDialog(g)}><UserPlus className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => del.mutate(g.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!memberDialog} onOpenChange={(v) => !v && setMemberDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Members — {memberDialog?.name}</DialogTitle></DialogHeader>
          {memberDialog && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Select value={pickUser} onValueChange={setPickUser}>
                  <SelectTrigger><SelectValue placeholder="Add resident" /></SelectTrigger>
                  <SelectContent>
                    {profiles
                      .filter((p) => !memberDialog.notice_group_members?.some((m: any) => m.user_id === p.id))
                      .map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={() => pickUser && addMember.mutate({ group_id: memberDialog.id, user_id: pickUser })} disabled={!pickUser}>Add</Button>
              </div>
              <ul className="space-y-1">
                {memberDialog.notice_group_members?.map((m: any) => (
                  <li key={m.id} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                    <span>{m.profiles?.full_name || m.profiles?.email}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeMember.mutate(m.id)}><X className="h-3 w-3" /></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
