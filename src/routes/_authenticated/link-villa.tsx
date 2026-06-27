import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Search, Loader2, CheckCircle2, Clock, XCircle, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { listVillasForLink, submitVillaRequest, myVillaRequests, myVillas } from "@/lib/villa-link.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/link-villa")({
  head: () => ({ meta: [{ title: "Link your villa — Hayy" }] }),
  component: LinkVillaPage,
});

function LinkVillaPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listVillasForLink);
  const reqsFn = useServerFn(myVillaRequests);
  const villasFn = useServerFn(myVillas);
  const submit = useServerFn(submitVillaRequest);

  const { data: myReqs = [] } = useQuery({ queryKey: ["my-villa-requests"], queryFn: () => reqsFn() });
  const { data: myLinks = [] } = useQuery({ queryKey: ["my-villas"], queryFn: () => villasFn() });
  const { data: villas = [], isLoading } = useQuery({ queryKey: ["villas-for-link"], queryFn: () => listFn() });

  // If already approved, send to portal
  if (myLinks.length > 0) {
    navigate({ to: "/portal", replace: true });
    return null;
  }

  const pending = myReqs.find((r: any) => r.status === "pending");
  const lastRejected = myReqs.find((r: any) => r.status === "rejected");

  const [search, setSearch] = useState("");
  const [selectedVilla, setSelectedVilla] = useState<any>(null);
  const [relationship, setRelationship] = useState<string>("");
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return villas;
    return villas.filter((v: any) =>
      v.unit_number?.toLowerCase().includes(q) || v.building?.toLowerCase().includes(q),
    );
  }, [villas, search]);

  const submitMut = useMutation({
    mutationFn: () => submit({ data: { villaId: selectedVilla.id, relationshipType: relationship as any, notes: notes || undefined } }),
    onSuccess: () => {
      toast.success("Request submitted. An admin will review it shortly.");
      qc.invalidateQueries({ queryKey: ["my-villa-requests"] });
      setSelectedVilla(null); setRelationship(""); setNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--gradient-brand)] text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Welcome</p>
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}><LogOut className="mr-1 h-4 w-4" />Sign out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {pending && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h2 className="font-display text-lg font-bold">Your villa access request is under review</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Villa <strong>{pending.units?.unit_number}</strong> · {prettyRel(pending.relationship_type)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(pending.submitted_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {lastRejected && !pending && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-900/50 dark:bg-rose-950/30">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <h2 className="font-display text-lg font-bold">Previous request rejected</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Villa <strong>{lastRejected.units?.unit_number}</strong>
                </p>
                {lastRejected.rejection_reason && (
                  <p className="mt-2 text-sm rounded-lg bg-card border border-border p-2">{lastRejected.rejection_reason}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">You may submit a new request below.</p>
              </div>
            </div>
          </div>
        )}

        {!pending && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <h1 className="font-display text-2xl font-bold">Link Your Villa</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Find your villa and tell us your relationship to it. An admin will approve your access.
            </p>

            <div className="mt-5">
              <Label>Search villas</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Villa number or community…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {isLoading && <div className="p-6 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading villas…</div>}
              {!isLoading && filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No villas match your search.</div>}
              {filtered.map((v: any) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVilla(v)}
                  className={`flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-accent/50 transition-colors ${selectedVilla?.id === v.id ? "bg-accent" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">Villa {v.unit_number}</p>
                    <p className="text-xs text-muted-foreground truncate">{v.building ?? "—"}{v.floor != null ? ` · Floor ${v.floor}` : ""}</p>
                  </div>
                  <VillaStatusBadge status={v.link_status} />
                </button>
              ))}
            </div>

            {selectedVilla && (
              <div className="mt-5 space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Selected</p>
                  <p className="font-semibold">Villa {selectedVilla.unit_number}</p>
                  {selectedVilla.link_status === "linked" && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      This villa is already linked. You can request as a new owner/tenant — an admin will review.
                    </p>
                  )}
                </div>
                <div>
                  <Label>Your relationship to this villa</Label>
                  <Select value={relationship} onValueChange={setRelationship}>
                    <SelectTrigger><SelectValue placeholder="Please select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="tenant">Tenant</SelectItem>
                      <SelectItem value="family_member">Family Member</SelectItem>
                      <SelectItem value="authorized_rep">Authorized Representative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the admin should know" />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setSelectedVilla(null)}>Cancel</Button>
                  <Button onClick={() => submitMut.mutate()} disabled={!relationship || submitMut.isPending}>
                    {submitMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit request
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function VillaStatusBadge({ status }: { status: string }) {
  if (status === "linked") return <Badge variant="outline" className="border-rose-200 text-rose-700">Already linked</Badge>;
  if (status === "pending") return <Badge variant="outline" className="border-amber-200 text-amber-700">Pending request</Badge>;
  return <Badge variant="outline" className="border-emerald-200 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" />Available</Badge>;
}

function prettyRel(r: string) {
  return ({ owner: "Owner", tenant: "Tenant", family_member: "Family Member", authorized_rep: "Authorized Representative" } as any)[r] ?? r;
}
