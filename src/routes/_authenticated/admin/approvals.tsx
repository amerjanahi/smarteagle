import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, UserPlus, Copy, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listPendingSignups, approveSignup, rejectSignup,
  createInvitation, listInvitations, revokeInvitation,
} from "@/lib/approvals.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  head: () => ({ meta: [{ title: "User Approvals — Hayy Admin" }] }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">User Approvals</h2>
        <p className="text-sm text-muted-foreground">Review pending signups and invite new users.</p>
      </header>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending signups</TabsTrigger>
          <TabsTrigger value="invites">Invitations</TabsTrigger>
        </TabsList>
        <TabsContent value="pending"><PendingTab /></TabsContent>
        <TabsContent value="invites"><InvitesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function PendingTab() {
  const qc = useQueryClient();
  const list = useServerFn(listPendingSignups);
  const approve = useServerFn(approveSignup);
  const reject = useServerFn(rejectSignup);

  const { data = [], isLoading } = useQuery({ queryKey: ["pending-signups"], queryFn: () => list() });
  const { data: units = [] } = useQuery({
    queryKey: ["units-min"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id, unit_number").order("unit_number");
      return data ?? [];
    },
  });

  const [selected, setSelected] = useState<any | null>(null);
  const [role, setRole] = useState<"admin" | "resident">("resident");
  const [unitId, setUnitId] = useState<string>("");

  const approveMut = useMutation({
    mutationFn: () => approve({ data: { userId: selected.id, role, unitId: unitId || null, fullName: selected.full_name } }),
    onSuccess: () => {
      toast.success("User approved");
      qc.invalidateQueries({ queryKey: ["pending-signups"] });
      qc.invalidateQueries({ queryKey: ["pending-count"] });
      setSelected(null); setUnitId(""); setRole("resident");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => reject({ data: { userId: id } }),
    onSuccess: () => {
      toast.success("Rejected");
      qc.invalidateQueries({ queryKey: ["pending-signups"] });
      qc.invalidateQueries({ queryKey: ["pending-count"] });
    },
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Requested</TableHead><TableHead className="text-right">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
          {!isLoading && data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No pending signups.</TableCell></TableRow>}
          {data.map((u: any) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.full_name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button size="sm" onClick={() => setSelected(u)}><Check className="h-4 w-4 mr-1" />Approve</Button>
                <Button size="sm" variant="outline" onClick={() => rejectMut.mutate(u.id)}><X className="h-4 w-4 mr-1" />Reject</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve {selected?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resident">Resident / Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === "resident" && (
              <div>
                <Label>Link to unit (optional)</Label>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger><SelectValue placeholder="Select a unit…" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.unit_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>Approve user</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvitesTab() {
  const qc = useQueryClient();
  const list = useServerFn(listInvitations);
  const create = useServerFn(createInvitation);
  const revoke = useServerFn(revokeInvitation);

  const { data = [] } = useQuery({ queryKey: ["invitations"], queryFn: () => list() });
  const { data: units = [] } = useQuery({
    queryKey: ["units-min"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id, unit_number").order("unit_number");
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", fullName: "", role: "resident" as "admin" | "resident", unitId: "" });

  const createMut = useMutation({
    mutationFn: () => create({ data: { email: form.email, role: form.role, unitId: form.unitId || null, fullName: form.fullName } }),
    onSuccess: (row: any) => {
      const link = `${window.location.origin}/auth?invite=${row.token}`;
      navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Invitation created — link copied to clipboard");
      qc.invalidateQueries({ queryKey: ["invitations"] });
      setOpen(false); setForm({ email: "", fullName: "", role: "resident", unitId: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function copyLink(token: string) {
    const link = `${window.location.origin}/auth?invite=${token}`;
    navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Invite link copied");
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4 mr-1" />New invitation</Button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Expires</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No invitations yet.</TableCell></TableRow>}
            {data.map((i: any) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.email}</TableCell>
                <TableCell className="capitalize">{i.role}</TableCell>
                <TableCell>
                  <Badge variant={i.status === "pending" ? "secondary" : i.status === "accepted" ? "default" : "outline"} className="capitalize">{i.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(i.expires_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right space-x-2">
                  {i.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => copyLink(i.token)}><Copy className="h-4 w-4 mr-1" />Copy link</Button>
                      <Button size="sm" variant="outline" onClick={() => revoke({ data: { id: i.id } }).then(() => qc.invalidateQueries({ queryKey: ["invitations"] }))}>Revoke</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite a user</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Full name (optional)</Label><Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resident">Resident / Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "resident" && (
              <div>
                <Label>Unit (optional)</Label>
                <Select value={form.unitId} onValueChange={(v) => setForm({ ...form, unitId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a unit…" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.unit_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Mail className="h-3.5 w-3.5 mt-0.5" />
              An invite link will be created and copied to your clipboard. Send it to the user via email or WhatsApp. (Auto-send by email comes in the next step once your email domain is set up.)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.email || createMut.isPending}>Create invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
