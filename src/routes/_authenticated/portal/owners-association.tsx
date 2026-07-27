import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Bell,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/owners-association")({
  head: () => ({ meta: [{ title: "Owners Association - Hayy" }] }),
  component: OwnersAssociationPage,
});

type Proposal = {
  id: string;
  submitted_by: string;
  title: string;
  description: string;
  status: "pending" | "published" | "closed" | "rejected" | "decided";
  eligibility: "all_residents" | "owners_only";
  voting_starts_at: string | null;
  voting_closes_at: string | null;
  final_decision: string | null;
  action_taken: string | null;
  created_at: string;
};

type Vote = {
  id: string;
  proposal_id: string;
  user_id: string;
  choice: "for" | "against";
};

type Comment = {
  id: string;
  proposal_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type AssociationNotification = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

const db = supabase as any;

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function OwnersAssociationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["owners-association", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      await db.rpc("refresh_association_deadline_notifications");

      const [proposalsResult, votesResult, commentsResult, notificationsResult] = await Promise.all([
        db.from("association_proposals").select("*").order("created_at", { ascending: false }),
        db.from("association_votes").select("*"),
        db.from("association_comments").select("*").order("created_at", { ascending: true }),
        db
          .from("association_notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      for (const result of [proposalsResult, votesResult, commentsResult, notificationsResult]) {
        if (result.error) throw result.error;
      }

      return {
        proposals: (proposalsResult.data ?? []) as Proposal[],
        votes: (votesResult.data ?? []) as Vote[],
        comments: (commentsResult.data ?? []) as Comment[],
        notifications: (notificationsResult.data ?? []) as AssociationNotification[],
      };
    },
  });

  const submitSuggestion = useMutation({
    mutationFn: async () => {
      const cleanTitle = title.trim();
      const cleanDescription = description.trim();
      if (cleanTitle.length < 5) throw new Error("Add a title of at least 5 characters.");
      if (cleanDescription.length < 10) throw new Error("Add a little more detail to your suggestion.");

      const { error } = await db.from("association_proposals").insert({
        submitted_by: user!.id,
        title: cleanTitle,
        description: cleanDescription,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Suggestion submitted for administrator review.");
      setTitle("");
      setDescription("");
      setSuggestionOpen(false);
      queryClient.invalidateQueries({ queryKey: ["owners-association"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const castVote = useMutation({
    mutationFn: async ({ proposalId, choice }: { proposalId: string; choice: "for" | "against" }) => {
      const { error } = await db.rpc("cast_association_vote", {
        _proposal_id: proposalId,
        _choice: choice,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Your vote has been recorded.");
      queryClient.invalidateQueries({ queryKey: ["owners-association"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addComment = useMutation({
    mutationFn: async (proposalId: string) => {
      const body = (commentDrafts[proposalId] ?? "").trim();
      if (!body) throw new Error("Write a comment first.");
      const { error } = await db.from("association_comments").insert({
        proposal_id: proposalId,
        user_id: user!.id,
        body,
      });
      if (error) throw error;
      return proposalId;
    },
    onSuccess: (proposalId) => {
      setCommentDrafts((current) => ({ ...current, [proposalId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["owners-association"] });
      toast.success("Comment added.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const markNotificationsRead = useMutation({
    mutationFn: async () => {
      const unreadIds = (data?.notifications ?? []).filter((item) => !item.read_at).map((item) => item.id);
      if (unreadIds.length === 0) return;
      const { error } = await db
        .from("association_notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owners-association"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const visibleProposals = data?.proposals ?? [];
  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const voteGroups = useMemo(() => {
    const map = new Map<string, Vote[]>();
    for (const vote of data?.votes ?? []) {
      map.set(vote.proposal_id, [...(map.get(vote.proposal_id) ?? []), vote]);
    }
    return map;
  }, [data?.votes]);

  const commentGroups = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const comment of data?.comments ?? []) {
      map.set(comment.proposal_id, [...(map.get(comment.proposal_id) ?? []), comment]);
    }
    return map;
  }, [data?.comments]);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Owners Association</h1>
          <p className="text-sm text-muted-foreground">
            Share ideas, review proposals, and take part in community decisions.
          </p>
        </div>
        <Dialog open={suggestionOpen} onOpenChange={setSuggestionOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> Suggest
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit a suggestion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="suggestion-title">Title</Label>
                <Input
                  id="suggestion-title"
                  value={title}
                  maxLength={160}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Example: Add shaded seating near the pool"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="suggestion-description">Details</Label>
                <Textarea
                  id="suggestion-description"
                  value={description}
                  maxLength={5000}
                  rows={6}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe the idea, expected benefit, and any concerns."
                />
              </div>
              <Button
                className="w-full"
                disabled={submitSuggestion.isPending}
                onClick={() => submitSuggestion.mutate()}
              >
                Submit for review
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {notifications.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Association notifications</h2>
              {unreadCount > 0 && <Badge>{unreadCount} new</Badge>}
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markNotificationsRead.mutate()}>
                Mark read
              </Button>
            )}
          </div>
          <ul className="space-y-2">
            {notifications.slice(0, 4).map((notification) => (
              <li
                key={notification.id}
                className={`rounded-lg p-3 text-sm ${notification.read_at ? "bg-muted/30" : "bg-primary/5"}`}
              >
                <p className="font-medium">{notification.title}</p>
                <p className="text-muted-foreground">{notification.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isLoading && (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          Loading association proposals...
        </div>
      )}

      {!isLoading && visibleProposals.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
          <p className="font-medium">No proposals yet</p>
          <p className="text-sm text-muted-foreground">Be the first resident to submit an improvement idea.</p>
        </div>
      )}

      <div className="space-y-4">
        {visibleProposals.map((proposal) => {
          const votes = voteGroups.get(proposal.id) ?? [];
          const comments = commentGroups.get(proposal.id) ?? [];
          const votesFor = votes.filter((vote) => vote.choice === "for").length;
          const votesAgainst = votes.filter((vote) => vote.choice === "against").length;
          const totalVotes = votesFor + votesAgainst;
          const support = totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 0;
          const myVote = votes.find((vote) => vote.user_id === user?.id);
          const now = Date.now();
          const votingOpen =
            proposal.status === "published" &&
            !!proposal.voting_starts_at &&
            !!proposal.voting_closes_at &&
            now >= new Date(proposal.voting_starts_at).getTime() &&
            now < new Date(proposal.voting_closes_at).getTime();

          return (
            <article key={proposal.id} className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{proposal.title}</h2>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{proposal.description}</p>
                </div>
                <Badge variant={proposal.status === "published" ? "default" : "secondary"}>
                  {proposal.status === "pending" ? "Awaiting review" : proposal.status}
                </Badge>
              </div>

              {proposal.status !== "pending" && proposal.status !== "rejected" && (
                <>
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                      <Clock3 className="h-4 w-4" />
                      <span>Opens: {formatDate(proposal.voting_starts_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                      <Clock3 className="h-4 w-4" />
                      <span>Closes: {formatDate(proposal.voting_closes_at)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{votesFor} for</span>
                      <span>{votesAgainst} against</span>
                    </div>
                    <Progress value={support} />
                    <p className="text-center text-xs text-muted-foreground">
                      {totalVotes} vote{totalVotes === 1 ? "" : "s"} - {support}% support
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      variant={myVote?.choice === "for" ? "default" : "outline"}
                      disabled={!votingOpen || !!myVote || castVote.isPending}
                      onClick={() => castVote.mutate({ proposalId: proposal.id, choice: "for" })}
                    >
                      <ThumbsUp className="mr-1 h-4 w-4" /> Vote for
                    </Button>
                    <Button
                      className="flex-1"
                      variant={myVote?.choice === "against" ? "destructive" : "outline"}
                      disabled={!votingOpen || !!myVote || castVote.isPending}
                      onClick={() => castVote.mutate({ proposalId: proposal.id, choice: "against" })}
                    >
                      <ThumbsDown className="mr-1 h-4 w-4" /> Vote against
                    </Button>
                  </div>

                  {myVote && (
                    <p className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" /> Your vote for "{myVote.choice}" is recorded.
                    </p>
                  )}
                  {!myVote && proposal.eligibility === "owners_only" && (
                    <p className="text-xs text-muted-foreground">Voting is restricted to eligible owners.</p>
                  )}

                  {(proposal.final_decision || proposal.action_taken) && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="font-medium">Final decision</p>
                      {proposal.final_decision && <p className="mt-1 text-sm">{proposal.final_decision}</p>}
                      {proposal.action_taken && (
                        <p className="mt-2 text-sm text-muted-foreground">Action: {proposal.action_taken}</p>
                      )}
                    </div>
                  )}

                  <section className="space-y-3 border-t border-border pt-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <MessageSquare className="h-4 w-4" /> Comments ({comments.length})
                    </h3>
                    <ul className="space-y-2">
                      {comments.map((comment) => (
                        <li key={comment.id} className="rounded-lg bg-muted/40 p-3 text-sm">
                          <p>{comment.body}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Resident - {formatDate(comment.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <Input
                        value={commentDrafts[proposal.id] ?? ""}
                        maxLength={2000}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({ ...current, [proposal.id]: event.target.value }))
                        }
                        placeholder="Add feedback..."
                      />
                      <Button
                        variant="outline"
                        disabled={addComment.isPending}
                        onClick={() => addComment.mutate(proposal.id)}
                      >
                        Post
                      </Button>
                    </div>
                  </section>
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
