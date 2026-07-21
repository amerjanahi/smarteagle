import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listPayrollJournalDrafts, reviewPayrollDraft } from "@/lib/hr.functions";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/payroll-journals")({
  head: () => ({ meta: [{ title: "Payroll Journals — Finance" }] }),
  component: Page,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Page() {
  const listFn = useServerFn(listPayrollJournalDrafts);
  const reviewFn = useServerFn(reviewPayrollDraft);
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<any | null>(null);
  const [notes, setNotes] = useState("");

  const rows = useQuery({ queryKey: ["payroll-drafts"], queryFn: () => listFn() });
  const review = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" }) => reviewFn({ data: { ...v, review_notes: notes } }),
    onSuccess: () => { toast.success("Reviewed"); setViewing(null); setNotes(""); qc.invalidateQueries({ queryKey: ["payroll-drafts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Payroll Journals</h2>
        <p className="text-sm text-muted-foreground">Review and approve auto-drafted payroll journal entries.</p>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Period</TableHead><TableHead>Gross</TableHead>
            <TableHead>Deductions</TableHead><TableHead>Net</TableHead>
            <TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.data?.map((r: any) => {
              const run = r.payroll_runs;
              const cur = run?.currency ?? "AED";
              return (
                <TableRow key={r.id}>
                  <TableCell>{MONTHS[(run?.period_month ?? 1) - 1]} {run?.period_year}</TableCell>
                  <TableCell>{cur} {Number(run?.total_gross ?? 0).toFixed(2)}</TableCell>
                  <TableCell>{cur} {Number(run?.total_deductions ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">{cur} {Number(run?.total_net ?? 0).toFixed(2)}</TableCell>
                  <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setViewing(r)}><Eye className="h-4 w-4 mr-1" /> Review</Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!rows.data?.length && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No drafts</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Journal Entry Preview</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <Table>
                <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead>Memo</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(viewing.lines as any[]).map((l, i) => (
                    <TableRow key={i}>
                      <TableCell>{l.account_name}{!l.account_id && <span className="text-xs text-destructive"> (unmapped)</span>}</TableCell>
                      <TableCell className="text-right font-mono">{Number(l.debit).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">{Number(l.credit).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.memo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {viewing.status === "pending_review" && (
                <Textarea placeholder="Review notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              )}
            </div>
          )}
          {viewing?.status === "pending_review" && (
            <DialogFooter>
              <Button variant="destructive" onClick={() => review.mutate({ id: viewing.id, decision: "rejected" })}><X className="h-4 w-4 mr-1" /> Reject</Button>
              <Button onClick={() => review.mutate({ id: viewing.id, decision: "approved" })}><Check className="h-4 w-4 mr-1" /> Approve & Post</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
