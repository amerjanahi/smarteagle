import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, X, Search } from "lucide-react";
import {
  listAllVillaRequests, approveVillaRequest, rejectVillaRequest,
} from "@/lib/villa-link.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/portal-access-requests")({
  head: () => ({ meta: [{ title: "Portal Access Requests — Hayy Admin" }] }),
  component: PortalAccessRequestsPage,
});

const REL: Record<string, string> = {
  owner: "Owner", tenant: "Tenant", family_member: "Family Member", authorized_rep: "Auth. Rep",
};

function PortalAccessRequestsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Portal Access Requests</h2>
        <p className="text-sm text-muted-foreground">Approve or reject resident villa-link requests.</p>
      </header>
      <PortalAccessRequestsInner />
    </div>
  );
}

export function PortalAccessRequestsInner() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
      <TabsList>
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="approved">Approved</TabsTrigger>
        <TabsTrigger value="rejected">Rejected</TabsTrigger>
      </TabsList>
      <TabsContent value={tab}><RequestsTable status={tab} /></TabsContent>
    </Tabs>
  );
}

function RequestsTable({ status }: { status: "pending" | "approved" | "rejected" }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllVillaRequests);
  const approve = useServerFn(approveVillaRequest);
  const reject = useServerFn(rejectVillaRequest);

  const { data = [], isLoading } = useQuery({
    queryKey: ["villa-requests", status],
    queryFn: () => listFn({ data: { status } }),
  });

  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r: any) =>
      r.profiles?.full_name?.toLowerCase().includes(q) ||
      r.profiles?.email?.toLowerCase().includes(q) ||
      r.units?.unit_number?.toLowerCase().includes(q),
    );
  }, [data, search]);

  const [rejectFor, setRejectFor] = useState<any>(null);
  const [reason, setReason] = useState("");

  const approveMut = useMutation({
    mutationFn: (id: string) => approve({ data: { requestId: id } }),
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: ["villa-requests"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: () => reject({ data: { requestId: rejectFor.id, reason } }),
    onSuccess: () => {
      toast.success("Rejected");
      qc.invalidateQueries({ queryKey: ["villa-requests"] });
      setRejectFor(null); setReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, email, villa…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Resident</TableHead><TableHead>Contact</TableHead><TableHead>Villa</TableHead>
            <TableHead>Relationship</TableHead><TableHead>Submitted</TableHead>
            {status === "pending" && <TableHead className="text-right">Actions</TableHead>}
            {status === "rejected" && <TableHead>Reason</TableHead>}
            {status === "approved" && <TableHead>Reviewed</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No {status} requests.</TableCell></TableRow>}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.profiles?.full_name ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  <div>{r.profiles?.email}</div>
                  {r.profiles?.phone && <div className="text-muted-foreground">{r.profiles.phone}</div>}
                </TableCell>
                <TableCell>Villa {r.units?.unit_number ?? "?"}</TableCell>
                <TableCell><Badge variant="secondary">{REL[r.relationship_type] ?? r.relationship_type}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{new Date(r.submitted_at).toLocaleDateString()}</TableCell>
                {status === "pending" && (
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" onClick={() => approveMut.mutate(r.id)} disabled={approveMut.isPending}><Check className="h-4 w-4 mr-1" />Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => setRejectFor(r)}><X className="h-4 w-4 mr-1" />Reject</Button>
                  </TableCell>
                )}
                {status === "rejected" && <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.rejection_reason ?? "—"}</TableCell>}
                {status === "approved" && <TableCell className="text-sm text-muted-foreground">{r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : "—"}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{rejectFor?.profiles?.full_name} → Villa {rejectFor?.units?.unit_number}</p>
            <div>
              <Label>Reason</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="The resident will see this reason." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectMut.mutate()} disabled={!reason.trim() || rejectMut.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
