import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Landmark } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/bank-accounts")({
  head: () => ({ meta: [{ title: "Bank Accounts — Hayy Admin" }] }),
  component: BankAccountsPage,
});

type Account = {
  id: string; name: string; bank_name: string | null; account_number: string | null;
  currency: string; opening_balance: number; is_active: boolean; notes: string | null;
};

const empty = { name: "", bank_name: "", account_number: "", currency: "BHD", opening_balance: 0, is_active: true, notes: "" };

function BankAccountsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(empty);

  const { data: accounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("bank_accounts" as any).select("*").order("name") as any);
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  const { data: balances = {} } = useQuery({
    queryKey: ["bank-balances", accounts.map(a => a.id).join(",")],
    enabled: accounts.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("bank_transactions" as any)
        .select("account_id, direction, amount") as any);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const a of accounts) map[a.id] = Number(a.opening_balance) || 0;
      for (const t of (data ?? []) as Array<{ account_id: string; direction: string; amount: number }>) {
        map[t.account_id] = (map[t.account_id] ?? 0) + (t.direction === "in" ? Number(t.amount) : -Number(t.amount));
      }
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, opening_balance: Number(form.opening_balance) || 0 };
      if (editing) {
        const { error } = await (supabase.from("bank_accounts" as any).update(payload).eq("id", editing.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("bank_accounts" as any).insert(payload) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Account updated" : "Account added");
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openNew() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(a: Account) {
    setEditing(a);
    setForm({
      name: a.name, bank_name: a.bank_name ?? "", account_number: a.account_number ?? "",
      currency: a.currency, opening_balance: Number(a.opening_balance), is_active: a.is_active, notes: a.notes ?? "",
    });
    setOpen(true);
  }

  const fmt = (n: number) => new Intl.NumberFormat("en-BH", { minimumFractionDigits: 3 }).format(n);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Bank Accounts</h2>
          <p className="text-sm text-muted-foreground">Manage bank accounts and current balances.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} bank account</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Account name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Bank name</Label><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
              <div><Label>Account #</Label><Input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} /></div>
              <div><Label>Currency</Label><Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} /></div>
              <div><Label>Opening balance</Label><Input type="number" step="0.001" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2 sm:col-span-2"><Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="hidden sm:table-cell">Bank</TableHead>
              <TableHead className="hidden md:table-cell">Number</TableHead>
              <TableHead className="text-right">Current balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                <Landmark className="mx-auto mb-2 h-5 w-5 opacity-60" />No bank accounts yet
              </TableCell></TableRow>
            )}
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">{a.bank_name ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{a.account_number ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{a.currency} {fmt(balances[a.id] ?? Number(a.opening_balance))}</TableCell>
                <TableCell>{a.is_active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
