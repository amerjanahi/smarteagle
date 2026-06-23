import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Plus, Upload, ArrowLeftRight, Link2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApplyTransactionDialog, type ApplyTxn } from "@/components/admin/ApplyTransactionDialog";

export const Route = createFileRoute("/_authenticated/admin/bank-transactions")({
  head: () => ({ meta: [{ title: "Bank Transactions — Hayy Admin" }] }),
  component: BankTxnsPage,
});

type Txn = {
  id: string; account_id: string; txn_date: string; description: string; reference: string | null;
  direction: "in" | "out"; amount: number;
  status: "matched" | "partial" | "unmatched" | "review" | "draft" | "applied" | "partially_applied" | "reversed";
  source: string; notes: string | null;
  applied_amount?: number | null; applied_to_type?: string | null; applied_to_id?: string | null; apply_notes?: string | null;
};

type Account = { id: string; name: string; currency: string };

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
const emptyForm = { account_id: "", txn_date: todayStr(), description: "", reference: "", direction: "in" as "in" | "out", amount: 0, notes: "" };

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cells: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cells.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cells.push(cur);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
}

function BankTxnsPage() {
  const qc = useQueryClient();
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ["bank-accounts-list"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("bank_accounts" as any).select("id,name,currency").order("name") as any);
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  const { data: txns = [] } = useQuery({
    queryKey: ["bank-txns", accountFilter, statusFilter],
    queryFn: async () => {
      let q: any = supabase.from("bank_transactions" as any).select("*").order("txn_date", { ascending: false }).limit(500);
      if (accountFilter !== "all") q = q.eq("account_id", accountFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });

  const accountName = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a.name])), [accounts]);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("bank_transactions" as any).insert({
        ...form, amount: Number(form.amount) || 0, source: "manual",
      }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction added");
      qc.invalidateQueries({ queryKey: ["bank-txns"] });
      setOpen(false); setForm({ ...emptyForm, account_id: form.account_id });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Txn["status"] }) => {
      const { error } = await (supabase.from("bank_transactions" as any).update({ status }).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-txns"] }),
  });

  async function handleCsv(file: File) {
    if (accountFilter === "all") { toast.error("Pick an account before importing"); return; }
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) { toast.error("Empty CSV"); return; }
    const inserts = rows.map(r => {
      const amt = Number(r.amount || r.value || 0);
      const dir = (r.direction || (amt < 0 ? "out" : "in")).toLowerCase();
      return {
        account_id: accountFilter,
        txn_date: r.date || r.txn_date || todayStr(),
        description: r.description || r.memo || r.narration || "(no description)",
        reference: r.reference || r.ref || null,
        direction: dir === "out" || dir === "debit" ? "out" : "in",
        amount: Math.abs(amt),
        source: "csv",
      };
    });
    const { error } = await (supabase.from("bank_transactions" as any).insert(inserts) as any);
    if (error) toast.error(error.message);
    else { toast.success(`Imported ${inserts.length} rows`); qc.invalidateQueries({ queryKey: ["bank-txns"] }); }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Bank Transactions</h2>
          <p className="text-sm text-muted-foreground">Bank statement lines with reconciliation status.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCsv(f); }} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Import CSV</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New entry</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New transaction</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Account</Label>
                  <Select value={form.account_id} onValueChange={v => setForm({ ...form, account_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Date</Label><Input type="date" value={form.txn_date} onChange={e => setForm({ ...form, txn_date: e.target.value })} /></div>
                <div>
                  <Label>Direction</Label>
                  <Select value={form.direction} onValueChange={(v: any) => setForm({ ...form, direction: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Money in (receipt)</SelectItem>
                      <SelectItem value="out">Money out (payment)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Amount</Label><Input type="number" step="0.001" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                <div><Label>Reference</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => create.mutate()} disabled={!form.account_id || !form.description || create.isPending}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All accounts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="unmatched">Unmatched</SelectItem>
            <SelectItem value="review">Review</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="hidden sm:table-cell">Account</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="hidden md:table-cell">Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {txns.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                <ArrowLeftRight className="mx-auto mb-2 h-5 w-5 opacity-60" />No transactions
              </TableCell></TableRow>
            )}
            {txns.map(t => (
              <TableRow key={t.id}>
                <TableCell className="tabular-nums">{t.txn_date}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">{accountName[t.account_id] ?? "—"}</TableCell>
                <TableCell className="font-medium">{t.description}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{t.reference ?? "—"}</TableCell>
                <TableCell className={`text-right tabular-nums ${t.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                  {t.direction === "in" ? "+" : "−"} {Number(t.amount).toFixed(3)}
                </TableCell>
                <TableCell>
                  <Select value={t.status} onValueChange={(v: any) => setStatus.mutate({ id: t.id, status: v })}>
                    <SelectTrigger className={`h-7 w-[120px] border-0 ${STATUS_TONE[t.status]}`}>
                      <SelectValue />
                    </SelectTrigger>
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
    </div>
  );
}
