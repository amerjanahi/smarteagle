import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Download, Plus, ThumbsDown, ThumbsUp, Vote } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exportCsv } from "@/lib/report-export";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [section, setSection] = useState<"proposals" | "elections">("proposals");
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
      const { data, error } = await db.from("association_votes").select("proposal_id,choice");
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

  if (section === "elections") {
    return <div className="space-y-6">
      <AdminAssociationHeader section={section} setSection={setSection} />
      <AdminElections />
    </div>;
  }

  return (
    <div className="space-y-6">
      <AdminAssociationHeader section={section} setSection={setSection} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Suggestions and proposals</h2>
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

function AdminAssociationHeader({ section, setSection }: {
  section: "proposals" | "elections";
  setSection: (value: "proposals" | "elections") => void;
}) {
  return <header className="space-y-3"><div><h1 className="font-display text-2xl font-bold">Owners Association</h1><p className="text-sm text-muted-foreground">Community voting and board governance.</p></div><div className="grid max-w-xl grid-cols-2 rounded-lg bg-muted p-1"><Button size="sm" variant={section === "proposals" ? "default" : "ghost"} onClick={() => setSection("proposals")}><Vote className="mr-2 h-4 w-4" />Proposals</Button><Button size="sm" variant={section === "elections" ? "default" : "ghost"} onClick={() => setSection("elections")}><Award className="mr-2 h-4 w-4" />Board elections</Button></div></header>;
}

function AdminElections() {
  const db = supabase as any;
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", positions: "Chairperson, Vice Chairperson, Treasurer, Secretary, Board Member:3",
    nominations_open_at: "", nominations_close_at: "", voting_open_at: "", voting_close_at: "",
    term_starts_on: "", term_ends_on: "", voting_basis: "per_owner", secret_ballot: true, show_live_results: false,
  });
  const query = useQuery({
    queryKey: ["association-elections-admin"],
    queryFn: async () => {
      const [electionsResult, positionsResult, candidatesResult] = await Promise.all([
        db.from("association_elections").select("*").order("created_at", { ascending: false }),
        db.from("association_election_positions").select("*").order("display_order"),
        db.from("association_election_candidates").select("*, units(unit_number, building)").order("created_at"),
      ]);
      for (const result of [electionsResult, positionsResult, candidatesResult]) if (result.error) throw result.error;
      const results: Record<string, any[]> = {};
      for (const election of electionsResult.data ?? []) {
        const response = await db.rpc("aggregate_election_results", { _election_id: election.id });
        results[election.id] = response.data ?? [];
      }
      return { elections: electionsResult.data ?? [], positions: positionsResult.data ?? [], candidates: candidatesResult.data ?? [], results };
    },
  });
  const createElection = useMutation({
    mutationFn: async () => {
      const nominationOpen = new Date(form.nominations_open_at);
      const nominationClose = new Date(form.nominations_close_at);
      const votingOpen = new Date(form.voting_open_at);
      const votingClose = new Date(form.voting_close_at);
      if (!form.title.trim() || !form.positions.trim()) throw new Error("Election title and positions are required.");
      if (!(nominationOpen < nominationClose && nominationClose <= votingOpen && votingOpen < votingClose)) throw new Error("Dates must follow nomination opening, nomination closing, voting opening and voting closing.");
      const { data: auth } = await supabase.auth.getUser();
      const { data: election, error } = await db.from("association_elections").insert({
        title: form.title.trim(), description: form.description.trim() || null, status: "nominations",
        voting_basis: form.voting_basis, secret_ballot: form.secret_ballot, show_live_results: form.show_live_results,
        nominations_open_at: nominationOpen.toISOString(), nominations_close_at: nominationClose.toISOString(),
        voting_open_at: votingOpen.toISOString(), voting_close_at: votingClose.toISOString(),
        term_starts_on: form.term_starts_on || null, term_ends_on: form.term_ends_on || null, created_by: auth.user?.id,
      }).select("id").single();
      if (error) throw error;
      const positions = form.positions.split(",").map((item, index) => {
        const [title, seatsText] = item.trim().split(":");
        return { election_id: election.id, title: title.trim(), seats: Math.min(Math.max(Number(seatsText || 1), 1), 20), display_order: index };
      }).filter((position) => position.title);
      const { error: positionsError } = await db.from("association_election_positions").insert(positions);
      if (positionsError) throw positionsError;
    },
    onSuccess: () => {
      toast.success("Board election created and nominations opened.");
      setCreateOpen(false);
      setForm({ ...form, title: "", description: "" });
      qc.invalidateQueries({ queryKey: ["association-elections-admin"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateElection = async (id: string, patch: any) => {
    const { error } = await db.from("association_elections").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Election updated");
    qc.invalidateQueries({ queryKey: ["association-elections-admin"] });
  };
  const reviewCandidate = async (id: string, status: "approved" | "rejected") => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await db.from("association_election_candidates").update({
      status, reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Candidate ${status}`);
    qc.invalidateQueries({ queryKey: ["association-elections-admin"] });
  };
  const publishWinners = async (election: any) => {
    const positions = query.data?.positions.filter((position: any) => position.election_id === election.id) ?? [];
    const candidates = query.data?.candidates.filter((candidate: any) => candidate.election_id === election.id) ?? [];
    const resultMap = Object.fromEntries((query.data?.results[election.id] ?? []).map((row: any) => [row.candidate_id, Number(row.vote_count)]));
    for (const position of positions) {
      const ranked = candidates.filter((candidate: any) => candidate.position_id === position.id && candidate.status === "approved")
        .sort((a: any, b: any) => (resultMap[b.id] ?? 0) - (resultMap[a.id] ?? 0));
      if (ranked.length > position.seats && (resultMap[ranked[position.seats - 1]?.id] ?? 0) === (resultMap[ranked[position.seats]?.id] ?? 0)) {
        toast.error(`Tie detected for ${position.title}. Resolve it with a runoff before publishing winners.`);
        return;
      }
      const winners = ranked.slice(0, position.seats);
      if (winners.length) {
        const { error } = await db.from("association_election_candidates").update({ status: "elected" }).in("id", winners.map((winner: any) => winner.id));
        if (error) throw error;
      }
    }
    await updateElection(election.id, { status: "published" });
  };
  const exportElection = (election: any) => {
    const positions = query.data?.positions.filter((position: any) => position.election_id === election.id) ?? [];
    const resultMap = Object.fromEntries((query.data?.results[election.id] ?? []).map((row: any) => [row.candidate_id, Number(row.vote_count)]));
    const candidates = (query.data?.candidates ?? []).filter((candidate: any) => candidate.election_id === election.id && ["approved", "elected"].includes(candidate.status));
    exportCsv(`board-election-${election.title}`, [
      { key: "position", label: "Position" }, { key: "candidate", label: "Candidate" },
      { key: "unit", label: "Unit" }, { key: "votes", label: "Votes" }, { key: "result", label: "Result" },
    ], candidates.map((candidate: any) => ({
      position: positions.find((position: any) => position.id === candidate.position_id)?.title ?? "",
      candidate: candidate.display_name, unit: candidate.units?.unit_number ?? "",
      votes: resultMap[candidate.id] ?? 0, result: candidate.status === "elected" ? "Elected" : "",
    })));
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Board elections</h2><p className="text-sm text-muted-foreground">Manage nominations, secret voting, turnout and final results.</p></div><Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Create election</Button></div>
    {query.isLoading && <p className="text-sm text-muted-foreground">Loading elections…</p>}
    {query.data?.elections.map((election: any) => {
      const positions = query.data.positions.filter((position: any) => position.election_id === election.id);
      const candidates = query.data.candidates.filter((candidate: any) => candidate.election_id === election.id);
      const results = query.data.results[election.id] ?? [];
      const resultMap = Object.fromEntries(results.map((row: any) => [row.candidate_id, Number(row.vote_count)]));
      const turnout = results.length ? Number(results[0].turnout || 0) : 0;
      return <Card key={election.id}><CardHeader><div className="flex flex-wrap justify-between gap-2"><div><CardTitle>{election.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{election.description}</p></div><Badge className="capitalize">{election.status.replace("_", " ")}</Badge></div></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-2 text-xs sm:grid-cols-3"><p className="rounded-lg bg-muted/50 p-2">Nominations close<br /><strong>{new Date(election.nominations_close_at).toLocaleString()}</strong></p><p className="rounded-lg bg-muted/50 p-2">Voting closes<br /><strong>{new Date(election.voting_close_at).toLocaleString()}</strong></p><p className="rounded-lg bg-muted/50 p-2">Turnout<br /><strong>{turnout} owner{turnout === 1 ? "" : "s"}</strong></p></div>
        <div className="space-y-3">{positions.map((position: any) => <div key={position.id} className="rounded-lg border p-3"><div className="mb-2 flex justify-between"><h3 className="font-semibold">{position.title}</h3><span className="text-xs text-muted-foreground">{position.seats} seat{position.seats === 1 ? "" : "s"}</span></div><div className="space-y-2">{candidates.filter((candidate: any) => candidate.position_id === position.id).map((candidate: any) => <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-3 text-sm"><div><p className="font-medium">{candidate.display_name} {candidate.status === "elected" && "🏆"}</p><p className="text-xs text-muted-foreground">{candidate.units?.building} · {candidate.units?.unit_number} · {candidate.status}</p><p className="mt-1">{candidate.statement}</p></div><div className="flex items-center gap-2"><strong>{resultMap[candidate.id] ?? 0} votes</strong>{candidate.status === "pending" && <><Button size="sm" onClick={() => reviewCandidate(candidate.id, "approved")}>Approve</Button><Button size="sm" variant="outline" onClick={() => reviewCandidate(candidate.id, "rejected")}>Reject</Button></>}</div></div>)}</div></div>)}</div>
        <div className="flex flex-wrap gap-2">
          {election.status === "nominations" && <Button variant="outline" onClick={() => updateElection(election.id, { status: "candidate_review" })}>Close nominations</Button>}
          {election.status === "candidate_review" && <Button onClick={() => updateElection(election.id, { status: "voting" })}>Open voting</Button>}
          {election.status === "voting" && <Button variant="outline" onClick={() => updateElection(election.id, { status: "closed" })}>Close voting</Button>}
          {election.status === "closed" && <Button onClick={() => publishWinners(election)}><Award className="mr-2 h-4 w-4" />Publish winners</Button>}
          <Button variant="outline" onClick={() => exportElection(election)}><Download className="mr-2 h-4 w-4" />Export results</Button>
        </div>
      </CardContent></Card>;
    })}
    {!query.isLoading && !query.data?.elections.length && <Card><CardContent className="py-10 text-center text-muted-foreground">No board elections created yet.</CardContent></Card>}
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Create board election</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label>Election title</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="2027 Owners Association Board Election" /></div>
      <div className="sm:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
      <div className="sm:col-span-2"><Label>Positions</Label><Input value={form.positions} onChange={(event) => setForm({ ...form, positions: event.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Comma-separated. Use “Board Member:3” for three seats.</p></div>
      <div><Label>Nominations open</Label><Input type="datetime-local" value={form.nominations_open_at} onChange={(event) => setForm({ ...form, nominations_open_at: event.target.value })} /></div>
      <div><Label>Nominations close</Label><Input type="datetime-local" value={form.nominations_close_at} onChange={(event) => setForm({ ...form, nominations_close_at: event.target.value })} /></div>
      <div><Label>Voting opens</Label><Input type="datetime-local" value={form.voting_open_at} onChange={(event) => setForm({ ...form, voting_open_at: event.target.value })} /></div>
      <div><Label>Voting closes</Label><Input type="datetime-local" value={form.voting_close_at} onChange={(event) => setForm({ ...form, voting_close_at: event.target.value })} /></div>
      <div><Label>Term starts</Label><Input type="date" value={form.term_starts_on} onChange={(event) => setForm({ ...form, term_starts_on: event.target.value })} /></div>
      <div><Label>Term ends</Label><Input type="date" value={form.term_ends_on} onChange={(event) => setForm({ ...form, term_ends_on: event.target.value })} /></div>
      <div><Label>Voting basis</Label><select className="flex h-9 w-full rounded-md border bg-background px-3 text-sm" value={form.voting_basis} onChange={(event) => setForm({ ...form, voting_basis: event.target.value })}><option value="per_owner">One ballot per owner</option><option value="per_unit">One ballot per unit</option></select></div>
      <div className="space-y-2 pt-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.secret_ballot} onChange={(event) => setForm({ ...form, secret_ballot: event.target.checked })} />Secret ballot</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.show_live_results} onChange={(event) => setForm({ ...form, show_live_results: event.target.checked })} />Show live results to owners</label></div>
      <Button className="sm:col-span-2" disabled={createElection.isPending} onClick={() => createElection.mutate()}>Create and open nominations</Button>
    </div></DialogContent></Dialog>
  </div>;
}
