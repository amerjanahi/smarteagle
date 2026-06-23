import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/bank-bulk-entry")({
  head: () => ({ meta: [{ title: "Bank Bulk Entry — Hayy Admin" }] }),
  component: BulkEntryPage,
});

type Account = { id: string; name: string };
type Row = {
  txn_date: string; description: string; reference: string;
  direction: "in" | "out"; amount: number;
};

const today = () => new Date().toISOString().slice(0, 10);
const blank = (): Row => ({ txn_date: today(), description: "", reference: "", direction: "in", amount: 0 });

function BulkEntryPage() {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [rows, setRows] = useState<Row[]>([blank(), blank(), blank()]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["bank-accounts-list"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("bank_accounts" as any).select("id,name").order("name") as any);
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  function update(i: number, patch: Partial<Row>) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  }
  function remove(i: number) { setRows(r => r.filter((_, idx) => idx !== i)); }
  function addRow() { setRows(r => [...r, blank()]); }

  const totalIn = rows.filter(r => r.direction === "in").reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalOut = rows.filter(r => r.direction === "out").reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const post = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error("Select an account");
      const valid = rows.filter(r => r.description && Number(r.amount) > 0);
      if (!valid.length) throw new Error("Add at least one valid row");
      const payload = valid.map(r => ({
        account_id: accountId, txn_date: r.txn_date, description: r.description,
        reference: r.reference || null, direction: r.direction, amount: Number(r.amount), source: "bulk",
      }));
      const { error } = await (supabase.from("bank_transactions" as any).insert(payload) as any);
      if (error) throw error;
      return valid.length;
    },
    onSuccess: (n) => {
      toast.success(`Posted ${n} transactions`);
      qc.invalidateQueries({ queryKey: ["bank-txns"] });
      setRows([blank(), blank(), blank()]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Bulk Entry</h2>
        <p className="text-sm text-muted-foreground">Quickly post multiple bank transactions at once.</p>
      </header>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Bank account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-end gap-4 text-sm">
            <div><span className="text-muted-foreground">In: </span><span className="font-medium text-emerald-600 tabular-nums">{totalIn.toFixed(3)}</span></div>
            <div><span className="text-muted-foreground">Out: </span><span className="font-medium text-rose-600 tabular-nums">{totalOut.toFixed(3)}</span></div>
            <div><span className="text-muted-foreground">Net: </span><span className="font-medium tabular-nums">{(totalIn - totalOut).toFixed(3)}</span></div>
          </div>
        </div>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-6 sm:col-span-2">
                <Input type="date" value={r.txn_date} onChange={e => update(i, { txn_date: e.target.value })} />
              </div>
              <div className="col-span-6 sm:col-span-2">
                <Select value={r.direction} onValueChange={(v: any) => update(i, { direction: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">In</SelectItem>
                    <SelectItem value="out">Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-8 sm:col-span-4">
                <Input placeholder="Description" value={r.description} onChange={e => update(i, { description: e.target.value })} />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Input placeholder="Ref" value={r.reference} onChange={e => update(i, { reference: e.target.value })} />
              </div>
              <div className="col-span-10 sm:col-span-1">
                <Input type="number" step="0.001" placeholder="0.000" value={r.amount} onChange={e => update(i, { amount: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end">
                <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6"><ListPlus className="inline h-4 w-4 mr-1" />No rows. Add one below.</p>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={addRow}><Plus className="mr-2 h-4 w-4" /> Add row</Button>
          <Button onClick={() => post.mutate()} disabled={!accountId || post.isPending}>Post {rows.filter(r => r.description && Number(r.amount) > 0).length} transactions</Button>
        </div>
      </div>
    </div>
  );
}
