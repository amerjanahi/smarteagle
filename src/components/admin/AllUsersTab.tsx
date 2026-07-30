import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, Home, Check, X } from "lucide-react";
import { listAllSignups, adminDeleteUser, approveSignup, rejectSignup } from "@/lib/approvals.functions";
import { approveVillaRequest, rejectVillaRequest } from "@/lib/villa-link.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserFormDialog } from "./UserFormDialog";
import { LinkVillaDialog } from "./LinkVillaDialog";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  approved: "default", pending: "secondary", rejected: "destructive",
};

export function AllUsersTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllSignups);
  const deleteFn = useServerFn(adminDeleteUser);
  const approveFn = useServerFn(approveSignup);
  const rejectFn = useServerFn(rejectSignup);
  const approveVillaFn = useServerFn(approveVillaRequest);
  const rejectVillaFn = useServerFn(rejectVillaRequest);
  const { data = [], isLoading } = useQuery({ queryKey: ["all-signups"], queryFn: () => listFn() });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [linkUser, setLinkUser] = useState<any>(null);
  const [deleteUser, setDeleteUser] = useState<any>(null);
  const [approvalRoles, setApprovalRoles] = useState<Record<string, "resident" | "operations">>({});

  const del = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId }}),
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["all-signups"] });
      setDeleteUser(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: ({ user, role }: { user: any; role: "resident" | "operations" }) => approveFn({ data: {
      userId: user.id,
      role,
      fullName: user.full_name ?? "User",
    } }),
    onSuccess: () => {
      toast.success("User approved and portal access granted");
      qc.invalidateQueries({ queryKey: ["all-signups"] });
      qc.invalidateQueries({ queryKey: ["pending-count"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not approve user"),
  });

  const reject = useMutation({
    mutationFn: (userId: string) => rejectFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("User rejected");
      qc.invalidateQueries({ queryKey: ["all-signups"] });
      qc.invalidateQueries({ queryKey: ["pending-count"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not reject user"),
  });

  const approveVilla = useMutation({
    mutationFn: (requestId: string) => approveVillaFn({ data: { requestId } }),
    onSuccess: () => {
      toast.success("Villa relationship approved and portal access activated");
      qc.invalidateQueries({ queryKey: ["all-signups"] });
      qc.invalidateQueries({ queryKey: ["pending-count"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not approve villa request"),
  });

  const rejectVilla = useMutation({
    mutationFn: (requestId: string) => rejectVillaFn({
      data: { requestId, reason: "Rejected by administrator" },
    }),
    onSuccess: () => {
      toast.success("Villa relationship rejected");
      qc.invalidateQueries({ queryKey: ["all-signups"] });
      qc.invalidateQueries({ queryKey: ["pending-count"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not reject villa request"),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data as any[]).map((u) => ({
      ...u,
      effective_status: u.approval_status === "approved" && u.roles.length === 0 ? "pending" : u.approval_status,
      access_stage:
        u.approval_status === "rejected" ? "Rejected" :
        u.approval_status !== "approved" || u.roles.length === 0 ? "Account review" :
        u.roles.includes("resident") && u.villa_count === 0 && u.pending_villa_count > 0 ? "Villa review" :
        u.roles.includes("resident") && u.villa_count === 0 ? "Villa onboarding" :
        "Active",
    })).filter((u) => {
      if (status !== "all" && u.effective_status !== status) return false;
      if (!q) return true;
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
      );
    });
  }, [data, search, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{rows.length} user{rows.length === 1 ? "" : "s"}</span>
        <Button className="ml-auto" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add user
        </Button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead>
            <TableHead>Type</TableHead><TableHead>Roles</TableHead><TableHead>Villas</TableHead>
            <TableHead>Status</TableHead><TableHead>Signed up</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No users.</TableCell></TableRow>}
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.phone ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{u.requested_role === "staff" ? "Staff" : "Resident"}</Badge></TableCell>
                <TableCell className="space-x-1">
                  {u.roles.length === 0 && <span className="text-muted-foreground text-sm">—</span>}
                  {u.roles.map((r: string) => <Badge key={r} variant="outline" className="capitalize">{r}</Badge>)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {u.pending_villa_request ? (
                    <span className="text-sm">
                      {u.pending_villa_request.units?.unit_number ?? "Villa"} ·{" "}
                      <span className="capitalize">
                        {String(u.pending_villa_request.relationship_type).replaceAll("_", " ")}
                      </span>
                    </span>
                  ) : u.villa_count}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[u.effective_status] ?? "outline"}>{u.access_stage}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {u.effective_status === "pending" && <>
                      <Select
                        value={approvalRoles[u.id] ?? (u.requested_role === "staff" ? "operations" : "resident")}
                        onValueChange={(value) => setApprovalRoles((current) => ({
                          ...current,
                          [u.id]: value as "resident" | "operations",
                        }))}
                      >
                        <SelectTrigger className="h-9 w-[118px]" aria-label={`Role for ${u.full_name ?? u.email}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="resident">Resident</SelectItem>
                          <SelectItem value="operations">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        title="Approve user"
                        onClick={() => approve.mutate({
                          user: u,
                          role: approvalRoles[u.id] ?? (u.requested_role === "staff" ? "operations" : "resident"),
                        })}
                        disabled={approve.isPending || reject.isPending}
                      >
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" title="Reject user" onClick={() => reject.mutate(u.id)} disabled={approve.isPending || reject.isPending}>
                        <X className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </>}
                    {u.access_stage === "Villa review" && u.pending_villa_request && <>
                      <Button
                        size="sm"
                        title="Approve villa relationship"
                        onClick={() => approveVilla.mutate(u.pending_villa_request.id)}
                        disabled={approveVilla.isPending || rejectVilla.isPending}
                      >
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Reject villa relationship"
                        onClick={() => rejectVilla.mutate(u.pending_villa_request.id)}
                        disabled={approveVilla.isPending || rejectVilla.isPending}
                      >
                        <X className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </>}
                    <Button size="icon" variant="ghost" title="Link villas" onClick={() => setLinkUser(u)}>
                      <Home className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Edit" onClick={() => { setEditing(u); setFormOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteUser(u)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />
      {linkUser && (
        <LinkVillaDialog
          open={!!linkUser}
          onOpenChange={(v) => !v && setLinkUser(null)}
          userId={linkUser.id}
          userName={linkUser.full_name ?? linkUser.email}
        />
      )}
      <ConfirmDeleteDialog
        open={!!deleteUser}
        onOpenChange={(v) => !v && setDeleteUser(null)}
        title="Delete user?"
        description={`This permanently deletes ${deleteUser?.email ?? "this user"} and their access. This cannot be undone.`}
        busy={del.isPending}
        onConfirm={() => deleteUser && del.mutate(deleteUser.id)}
      />
    </div>
  );
}
