import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, KeyRound, MailCheck, Search, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { listAllVillaRequests, approveVillaRequest, rejectVillaRequest } from "@/lib/villa-link.functions";
import { listProfileChangeRequests, reviewProfileChangeRequest } from "@/lib/profile.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type PermissionType = "all" | "portal_access" | "profile_change";
type ApprovalStatus = "pending" | "approved" | "rejected" | "all";
type UnifiedRequest = {
  id: string;
  type: Exclude<PermissionType, "all">;
  status: string;
  requestedAt: string;
  name: string;
  email: string;
  summary: string;
  details: Array<{ label: string; value: string }>;
  source: any;
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  owner: "Owner",
  tenant: "Tenant",
  family_member: "Family member",
  authorized_rep: "Authorized representative",
};

export function ApprovalCenter() {
  const queryClient = useQueryClient();
  const listVillaRequests = useServerFn(listAllVillaRequests);
  const listProfileRequests = useServerFn(listProfileChangeRequests);
  const approveVilla = useServerFn(approveVillaRequest);
  const rejectVilla = useServerFn(rejectVillaRequest);
  const reviewProfile = useServerFn(reviewProfileChangeRequest);
  const [permissionType, setPermissionType] = useState<PermissionType>("all");
  const [status, setStatus] = useState<ApprovalStatus>("pending");
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<UnifiedRequest | null>(null);
  const [reason, setReason] = useState("");

  const requests = useQuery({
    queryKey: ["unified-user-approvals"],
    queryFn: async () => {
      const [pendingVilla, approvedVilla, rejectedVilla, profileRequests] = await Promise.all([
        listVillaRequests({ data: { status: "pending" } }),
        listVillaRequests({ data: { status: "approved" } }),
        listVillaRequests({ data: { status: "rejected" } }),
        listProfileRequests(),
      ]);

      const villaRows: UnifiedRequest[] = [...pendingVilla, ...approvedVilla, ...rejectedVilla].map((request: any) => ({
        id: request.id,
        type: "portal_access",
        status: request.status,
        requestedAt: request.submitted_at,
        name: request.profiles?.full_name ?? "Resident",
        email: request.profiles?.email ?? "",
        summary: `Villa ${request.units?.unit_number ?? "?"} · ${RELATIONSHIP_LABELS[request.relationship_type] ?? request.relationship_type}`,
        details: [
          { label: "Villa", value: `${request.units?.building ? `${request.units.building} · ` : ""}${request.units?.unit_number ?? "—"}` },
          { label: "Permission", value: RELATIONSHIP_LABELS[request.relationship_type] ?? request.relationship_type ?? "—" },
          { label: "Phone", value: request.profiles?.phone ?? "—" },
          ...(request.rejection_reason ? [{ label: "Review note", value: request.rejection_reason }] : []),
        ],
        source: request,
      }));

      const profileRows: UnifiedRequest[] = profileRequests.map((request: any) => ({
        id: request.id,
        type: "profile_change",
        status: request.status,
        requestedAt: request.requested_at,
        name: request.profiles?.full_name ?? "User",
        email: request.current_email,
        summary: `${request.current_email} → ${request.requested_email}`,
        details: [
          { label: "Requested email", value: request.requested_email },
          { label: "Requested name", value: request.requested_full_name ?? "—" },
          { label: "Requested phone", value: request.requested_phone ?? "—" },
        ],
        source: request,
      }));

      return [...villaRows, ...profileRows].sort(
        (left, right) => new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime(),
      );
    },
  });

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (requests.data ?? []).filter((request) => {
      if (permissionType !== "all" && request.type !== permissionType) return false;
      if (status !== "all" && request.status !== status) return false;
      if (!query) return true;
      return [request.name, request.email, request.summary, ...request.details.map((detail) => detail.value)]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [permissionType, requests.data, search, status]);

  const approve = useMutation({
    mutationFn: async (request: UnifiedRequest) => {
      if (request.type === "portal_access") {
        await approveVilla({ data: { requestId: request.id } });
      } else {
        await reviewProfile({ data: { requestId: request.id, approve: true } });
      }
    },
    onSuccess: async () => {
      toast.success("Request approved and applied.");
      await invalidateApprovals(queryClient);
    },
    onError: (error: any) => toast.error(error.message ?? "Could not approve the request."),
  });

  const reject = useMutation({
    mutationFn: async () => {
      if (!rejecting) return;
      if (rejecting.type === "portal_access") {
        await rejectVilla({ data: { requestId: rejecting.id, reason } });
      } else {
        await reviewProfile({ data: { requestId: rejecting.id, approve: false, notes: reason } });
      }
    },
    onSuccess: async () => {
      toast.success("Request rejected.");
      setRejecting(null);
      setReason("");
      await invalidateApprovals(queryClient);
    },
    onError: (error: any) => toast.error(error.message ?? "Could not reject the request."),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <div><h4 className="font-semibold">Approval Center</h4><p className="text-sm text-muted-foreground">One queue for portal permissions and verified profile or email changes.</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requester, email, villa or phone" />
          </div>
          <Select value={permissionType} onValueChange={(value) => setPermissionType(value as PermissionType)}>
            <SelectTrigger aria-label="Permission type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All permission types</SelectItem>
              <SelectItem value="portal_access">Portal access</SelectItem>
              <SelectItem value="profile_change">Profile &amp; email changes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as ApprovalStatus)}>
            <SelectTrigger aria-label="Approval status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {requests.isLoading && <p className="text-sm text-muted-foreground">Loading approval requests…</p>}
      {!requests.isLoading && rows.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No matching approval requests.</div>}
      <div className="space-y-3">
        {rows.map((request) => {
          const TypeIcon = request.type === "portal_access" ? KeyRound : MailCheck;
          return <article key={`${request.type}:${request.id}`} className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-lg bg-muted p-2"><TypeIcon className="h-4 w-4 text-primary" /></div>
                <div className="min-w-0"><p className="font-medium">{request.name}</p><p className="break-all text-sm text-muted-foreground">{request.email}</p><p className="mt-1 text-sm">{request.summary}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{request.type === "portal_access" ? "Portal access" : "Profile change"}</Badge>
                <Badge variant={request.status === "pending" ? "default" : request.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{request.status}</Badge>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              {request.details.map((detail) => <div key={detail.label}><dt className="text-xs text-muted-foreground">{detail.label}</dt><dd className="break-words">{detail.value}</dd></div>)}
            </dl>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <p className="text-xs text-muted-foreground">Requested {new Date(request.requestedAt).toLocaleString()}</p>
              {request.status === "pending" && <div className="flex gap-2">
                <Button size="sm" onClick={() => approve.mutate(request)} disabled={approve.isPending || reject.isPending}><Check className="mr-1 h-4 w-4" />Approve &amp; apply</Button>
                <Button size="sm" variant="outline" onClick={() => { setRejecting(request); setReason(""); }} disabled={approve.isPending || reject.isPending}><X className="mr-1 h-4 w-4" />Reject</Button>
              </div>}
            </div>
          </article>;
        })}
      </div>

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject {rejecting?.type === "portal_access" ? "portal access" : "profile change"} request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Add a clear reason for {rejecting?.name ?? "the requester"}.</p>
            <div><Label>Reason</Label><Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for rejection" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => reject.mutate()} disabled={!reason.trim() || reject.isPending}>Reject request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function invalidateApprovals(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["unified-user-approvals"] }),
    queryClient.invalidateQueries({ queryKey: ["villa-requests"] }),
    queryClient.invalidateQueries({ queryKey: ["profile-change-requests"] }),
    queryClient.invalidateQueries({ queryKey: ["pending-count"] }),
  ]);
}
