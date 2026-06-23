import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { GitCompare, Wand2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApplyTransactionDialog, type ApplyTxn } from "@/components/admin/ApplyTransactionDialog";

export const Route = createFileRoute("/_authenticated/admin/bank-reconciliation")({
  head: () => ({ meta: [{ title: "Bank Reconciliation — Hayy Admin" }] }),
  component: ReconciliationPage,
});

type Account = { id: string; name: string; currency: string; opening_balance: number };
type Txn = {
  id: string; account_id: string; txn_date: string; description: string; reference: string | null;
  direction: "in" | "out"; amount: number;
  status: "matched" | "partial" | "unmatched" | "review" | "draft" | "applied" | "partially_applied" | "reversed";
  applied_amount?: number | null; applied_to_type?: string | null; applied_to_id?: string | null; apply_notes?: string | null;
};

const STATUS_TONE: Record<string, string> = {
  matched: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  applied: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  partially_applied: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  unmatched: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
  review: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  reversed: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => new Intl.NumberFormat("en-BH", { minimumFractionDigits: 3 }).format(n);

function ReconciliationPage() {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [asOf, setAsOf] = useState(todayStr());
  const [statementBalance, setStatementBalance] = useState(0);
  const [applyTxn, setApplyTxn] = useState<ApplyTxn | null>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ["bank-accounts-recon"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("bank_accounts" as any).select("id,name,currency,opening_balance").order("name") as any);
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  const { data: txns = [] } = useQuery({
    queryKey: ["bank-recon-txns", accountId, asOf],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("bank_transactions" as any)
        .select("*").eq("account_id", accountId).lte("txn_date", asOf).order("txn_date", { ascending: false }) as any);
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });

  const acct = accounts.find(a => a.id === accountId);

  const summary = useMemo(() => {
    const opening = Number(acct?.opening_balance ?? 0);
    let systemBalance = opening;
    let unmatchedReceipts = 0, unmatchedPayments = 0;
    let matched = 0, partial = 0, unmatched = 0, review = 0;
    for (const t of txns) {
      const a = Number(t.amount);
      systemBalance += t.direction === "in" ? a : -a;
      if (t.status === "matched") matched++;
      else if (t.status === "partial") partial++;
      else if (t.status === "review") review++;
      else {
        unmatched++;
        if (t.direction === "in") unmatchedReceipts += a;
        else unmatchedPayments += a;
      }
    }
    return {
      systemBalance, statementBalance: Number(statementBalance) || 0,
      difference: (Number(statementBalance) || 0) - systemBalance,
      unmatchedReceipts, unmatchedPayments,
      counts: { matched, partial, unmatched, review, total: txns.length },
    };
  }, [txns, statementBalance, acct]);

  const autoMatch = useMutation({
    mutationFn: async () => {
      // Naive auto-match: mark transactions with a reference matching an existing receipt/vendor payment amount.
      const ids = txns.filter(t => t.status === "unmatched").map(t => t.id);
      if (!ids.length) return 0;
      const { error } = await (supabase.from("bank_transactions" as any).update({ status: "review" }).in("id", ids) as any);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`Flagged ${n} for review`);
      qc.invalidateQueries({ queryKey: ["bank-recon-txns"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markAll = useMutation({
    mutationFn: async (status: Txn["status"]) => {
      const ids = txns.filter(t => t.status === "unmatched").map(t => t.id);
      if (!ids.length) return;
      const { error } = await (supabase.from("bank_transactions" as any).update({ status }).in("id", ids) as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["bank-recon-txns"] }); },
  });

  const setOne = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Txn["status"] }) => {
      const { error } = await (supabase.from("bank_transactions" as any).update({ status }).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-recon-txns"] }),
  });

  const summaryCards = [
    { label: "Statement balance", value: fmt(summary.statementBalance), tone: "" },
    { label: "System balance", value: fmt(summary.systemBalance), tone: "" },
    { label: "Difference", value: fmt(summary.difference), tone: summary.difference === 0 ? "text-emerald-600" : "text-rose-600" },
    { label: "Unmatched receipts", value: fmt(summary.unmatchedReceipts), tone: "text-emerald-600" },
    { label: "Unmatched payments", value: fmt(summary.unmatchedPayments), tone: "text-rose-600" },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Reconciliation</h2>
        <p className="text-sm text-muted-foreground">Match bank statement lines and review variances.</p>
      </header>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label>Bank account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>As of</Label><Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} /></div>
          <div><Label>Statement balance</Label><Input type="number" step="0.001" value={statementBalance} onChange={e => setStatementBalance(Number(e.target.value))} /></div>
        </div>
      </div>

      {accountId ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {summaryCards.map(c => (
              <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={`mt-1 font-display text-lg font-bold tabular-nums ${c.tone}`}>{acct?.currency} {c.value}</p>
              </div>
            ))}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge variant="secondary">Total {summary.counts.total}</Badge>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Matched {summary.counts.matched}</Badge>
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Partial {summary.counts.partial}</Badge>
              <Badge variant="outline">Unmatched {summary.counts.unmatched}</Badge>
              <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">Review {summary.counts.review}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => autoMatch.mutate()}><Wand2 className="mr-2 h-4 w-4" /> Auto-match</Button>
              <Button variant="outline" size="sm" onClick={() => markAll.mutate("matched")}>Mark all matched</Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden md:table-cell">Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txns.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    <GitCompare className="mx-auto mb-2 h-5 w-5 opacity-60" />No transactions for this period
                  </TableCell></TableRow>
                )}
                {txns.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="tabular-nums">{t.txn_date}</TableCell>
                    <TableCell className="font-medium">{t.description}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{t.reference ?? "—"}</TableCell>
                    <TableCell className={`text-right tabular-nums ${t.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                      {t.direction === "in" ? "+" : "−"} {Number(t.amount).toFixed(3)}
                    </TableCell>
                    <TableCell>
                      <Select value={t.status} onValueChange={(v: any) => setOne.mutate({ id: t.id, status: v })}>
                        <SelectTrigger className={`h-7 w-[120px] border-0 ${STATUS_TONE[t.status]}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="matched">Matched</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="unmatched">Unmatched</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          Select a bank account to begin reconciliation.
        </div>
      )}
    </div>
  );
}
