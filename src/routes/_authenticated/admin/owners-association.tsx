import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportCsv } from "@/lib/report-export";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/owners-association")({
  head: () => ({ meta: [{ title: "Owners Association — Admin" }] }),
  component: OwnersAssociationAdmin,
});

type Proposal = {
  id: string; title: string; description: string; status: string;
  voting_starts_at: string | null; voting_closes_at: string | null;
  eligibility: string; final_decision: string | null; action_taken: string | null;
  created_at: string;
};

function OwnersAssociationAdmin() {
  const db = supabase as any;
  const qc = useQueryClient();
  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["association-admin-proposals"],
    queryFn: async () => {
      const { data, error } = await db.from("association_proposals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Proposal[];
    },
  });
  const { data: votes = [] } = useQuery({
    queryKey: ["association-admin-votes"],
    queryFn: async () => {
      const { data, error } = await db.from("association_votes").select("proposal_id,vote");
      if (error) throw error;
      return data as { proposal_id: string; choice: string }[];
    },
  });

  const save = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await db.from("association_proposals").update({
        ...patch, reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["association-admin-proposals"] }); toast.success("Proposal updated"); },
    onError: (e: any) => toast.error(e.message || "Could not update proposal"),
  });

  function counts(id: string) {
    const proposalVotes = votes.filter((v: { proposal_id: string; choice: string }) => v.proposal_id === id);
    return {
      forVotes: proposalVotes.filter((v: { choice: string }) => v.choice === "for").length,
      against: proposalVotes.filter((v: { choice: string }) => v.choice === "against").length,
      total: proposalVotes.length,
    };
  }

  function publish(proposal: Proposal, form: HTMLFormElement) {
    const fd = new FormData(form);
    const start = String(fd.get("start"));
    const end = String(fd.get("end"));
    if (!start || !end || new Date(end) <= new Date(start)) {
      toast.error("Choose a closing date after the voting start");
      return;
    }
    save.mutate({ id: proposal.id, patch: {
      status: "published", voting_starts_at: new Date(start).toISOString(),
      voting_closes_at: new Date(end).toISOString(), eligibility: fd.get("eligibility"),
      published_at: new Date().toISOString(),
    }});
  }

  function exportResults() {
    exportCsv("owners-association-voting-results", [
      { key: "title", label: "Proposal" }, { key: "status", label: "Status" },
      { key: "eligibility", label: "Eligibility" }, { key: "starts", label: "Voting starts" },
      { key: "ends", label: "Voting closes" }, { key: "forVotes", label: "For" },
      { key: "against", label: "Against" }, { key: "total", label: "Total votes" },
      { key: "support", label: "Support %" }, { key: "decision", label: "Final decision" },
      { key: "action", label: "Action taken" },
    ], proposals.map((p) => {
      const c = counts(p.id);
      return { title: p.title, status: p.status, eligibility: p.eligibility,
        starts: p.voting_starts_at || "", ends: p.voting_closes_at || "", ...c,
        support: c.total ? Math.round(c.forVotes / c.total * 100) : 0,
        decision: p.final_decision || "", action: p.action_taken || "" };
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-bold">Owners Association</h1>
          <p className="text-sm text-muted-foreground">Review ideas, manage voting and publish decisions.</p></div>
        <Button variant="outline" onClick={exportResults}><Download className="mr-2 h-4 w-4" />Export results</Button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading proposals…</p>}
      <div className="grid gap-4">
        {proposals.map((p) => {
          const c = counts(p.id);
          return (
            <Card key={p.id}>
              <CardHeader><div className="flex flex-wrap justify-between gap-2">
                <CardTitle>{p.title}</CardTitle>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize">{p.status}</span>
              </div></CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap text-sm">{p.description}</p>
                <div className="flex gap-5 text-sm">
                  <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" />{c.forVotes} for</span>
                  <span className="flex items-center gap-1"><ThumbsDown className="h-4 w-4" />{c.against} against</span>
                  <span>{c.total} total</span>
                </div>
                {p.status === "pending" && (
                  <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); publish(p, e.currentTarget); }}>
                    <div><Label htmlFor={`start-${p.id}`}>Voting starts</Label><Input id={`start-${p.id}`} name="start" type="datetime-local" required /></div>
                    <div><Label htmlFor={`end-${p.id}`}>Voting closes</Label><Input id={`end-${p.id}`} name="end" type="datetime-local" required /></div>
                    <div><Label htmlFor={`eligibility-${p.id}`}>Who can vote</Label>
                      <select id={`eligibility-${p.id}`} name="eligibility" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="all_residents">All residents</option><option value="owners_only">Eligible owners only</option>
                      </select>
                    </div>
                    <div className="flex gap-2 md:col-span-3">
                      <Button type="submit" disabled={save.isPending}>Approve & publish</Button>
                      <Button type="button" variant="outline" onClick={() => save.mutate({ id: p.id, patch: { status: "rejected" } })}>Reject</Button>
                    </div>
                  </form>
                )}
                {p.status === "published" && (
                  <Button variant="outline" onClick={() => save.mutate({ id: p.id, patch: { status: "closed" } })}>Close voting now</Button>
                )}
                {(p.status === "closed" || p.status === "decided") && (
                  <form className="grid gap-3 rounded-lg border p-4" onSubmit={(e) => {
                    e.preventDefault(); const fd = new FormData(e.currentTarget);
                    save.mutate({ id: p.id, patch: { status: "decided", final_decision: fd.get("decision"),
                      action_taken: fd.get("action"), decided_at: new Date().toISOString() } });
                  }}>
                    <div><Label>Final decision</Label><Input name="decision" defaultValue={p.final_decision || ""} required /></div>
                    <div><Label>Action taken / next steps</Label><Textarea name="action" defaultValue={p.action_taken || ""} required /></div>
                    <Button className="w-fit" type="submit">Publish final decision</Button>
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && proposals.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">No suggestions have been submitted yet.</CardContent></Card>}
      </div>
    </div>
  );
}
