import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, MailCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listProfileChangeRequests, reviewProfileChangeRequest } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/admin/profile-change-requests")({
  head: () => ({ meta: [{ title: "Profile change requests — Hayy Admin" }] }),
  component: ProfileChangeRequestsPage,
});

function ProfileChangeRequestsPage() {
  const queryClient = useQueryClient();
  const listRequests = useServerFn(listProfileChangeRequests);
  const reviewRequest = useServerFn(reviewProfileChangeRequest);
  const { data: requests = [], isLoading } = useQuery({ queryKey: ["profile-change-requests"], queryFn: () => listRequests() });
  async function review(requestId: string, approve: boolean) {
    try {
      await reviewRequest({ data: { requestId, approve } });
      await queryClient.invalidateQueries({ queryKey: ["profile-change-requests"] });
      toast.success(approve ? "Email change approved and applied." : "Email change request rejected.");
    } catch (error: any) { toast.error(error.message ?? "Could not review the request."); }
  }
  return <div className="space-y-4">
    <header><h1 className="font-display text-2xl font-bold">Profile change requests</h1><p className="text-sm text-muted-foreground">Approve verified requests before a user’s login email is changed.</p></header>
    {isLoading && <p className="text-sm text-muted-foreground">Loading requests…</p>}
    {!isLoading && requests.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No profile change requests.</div>}
    <div className="space-y-3">
      {requests.map((request: any) => <article key={request.id} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{request.profiles?.full_name || "User"}</p><p className="text-sm text-muted-foreground">Requested {new Date(request.requested_at).toLocaleString()}</p></div><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium capitalize">{request.status}</span></div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Current email</dt><dd>{request.current_email}</dd></div><div><dt className="text-muted-foreground">Requested email</dt><dd>{request.requested_email}</dd></div><div><dt className="text-muted-foreground">Name</dt><dd>{request.requested_full_name || "—"}</dd></div><div><dt className="text-muted-foreground">Phone</dt><dd>{request.requested_phone || "—"}</dd></div></dl>
        {request.status === "pending" && <div className="mt-4 flex gap-2"><Button onClick={() => review(request.id, true)}><Check className="mr-1 h-4 w-4" />Approve</Button><Button variant="outline" onClick={() => review(request.id, false)}><X className="mr-1 h-4 w-4" />Reject</Button></div>}
      </article>)}
    </div>
  </div>;
}
