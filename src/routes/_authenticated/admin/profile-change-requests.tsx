import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Search, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listProfileChangeRequests, reviewProfileChangeRequest } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/admin/profile-change-requests")({
  head: () => ({ meta: [{ title: "Profile change requests — Hayy Admin" }] }),
  component: ProfileChangeRequestsPage,
});

function ProfileChangeRequestsPage() {
  return <div className="space-y-4">
    <header><h1 className="font-display text-2xl font-bold">Profile change requests</h1><p className="text-sm text-muted-foreground">Approve verified requests before a user’s login email is changed.</p></header>
    <ProfileChangeRequestsInner />
  </div>;
}

export function ProfileChangeRequestsInner() {
  const queryClient = useQueryClient();
  const listRequests = useServerFn(listProfileChangeRequests);
  const reviewRequest = useServerFn(reviewProfileChangeRequest);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [search, setSearch] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["profile-change-requests"],
    queryFn: () => listRequests(),
  });

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request: any) => {
      if (status !== "all" && request.status !== status) return false;
      if (!query) return true;
      return [request.profiles?.full_name, request.current_email, request.requested_email, request.requested_phone]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [requests, search, status]);

  async function review(requestId: string, approve: boolean) {
    setReviewingId(requestId);
    try {
      await reviewRequest({ data: { requestId, approve } });
      await queryClient.invalidateQueries({ queryKey: ["profile-change-requests"] });
      toast.success(approve ? "Email change approved and applied." : "Email change request rejected.");
    } catch (error: any) {
      toast.error(error.message ?? "Could not review the request.");
    } finally {
      setReviewingId(null);
    }
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Email changes require password verification and administrator approval.
      </div>
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or phone" />
      </div>
    </div>
    <Tabs value={status} onValueChange={(value) => setStatus(value as typeof status)}>
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="approved">Approved</TabsTrigger>
        <TabsTrigger value="rejected">Rejected</TabsTrigger>
        <TabsTrigger value="all">All</TabsTrigger>
      </TabsList>
    </Tabs>
    {isLoading && <p className="text-sm text-muted-foreground">Loading requests…</p>}
    {!isLoading && rows.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No matching profile change requests.</div>}
    <div className="space-y-3">
      {rows.map((request: any) => <article key={request.id} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-medium">{request.profiles?.full_name || "User"}</p><p className="text-sm text-muted-foreground">Requested {new Date(request.requested_at).toLocaleString()}</p></div>
          <Badge variant={request.status === "pending" ? "default" : "secondary"} className="capitalize">{request.status}</Badge>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Current email</dt><dd className="break-all">{request.current_email}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Requested email</dt><dd className="break-all font-medium">{request.requested_email}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Requested name</dt><dd>{request.requested_full_name || "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Requested phone</dt><dd>{request.requested_phone || "—"}</dd></div>
        </dl>
        {request.status === "pending" && <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => review(request.id, true)} disabled={reviewingId === request.id}><Check className="mr-1 h-4 w-4" />Approve &amp; apply</Button>
          <Button variant="outline" onClick={() => review(request.id, false)} disabled={reviewingId === request.id}><X className="mr-1 h-4 w-4" />Reject</Button>
        </div>}
      </article>)}
    </div>
  </div>;
}
