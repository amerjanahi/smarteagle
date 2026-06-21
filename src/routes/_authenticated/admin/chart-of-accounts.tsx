import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/chart-of-accounts")({
  head: () => ({ meta: [{ title: "Chart of Accounts — Hayy Admin" }] }),
  component: ChartOfAccountsPage,
});

type Account = { id: string; code: string; name: string; account_type: string; description: string | null; is_active: boolean };
const TYPES = ["asset", "liability", "equity", "income", "expense"];

function ChartOfAccountsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({ code: "", name: "", account_type: "asset", description: "", is_active: true });

  const { data: accounts = [] } = useQuery({
    queryKey: ["chart-of-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chart_of_accounts").select("*").order("code");
      if (error) throw error;
      return data as Account[];
    },
  });

  const reset = () => { setEditing(null); setForm({ code: "", name: "", account_type: "asset", description: "", is_active: true }); };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { code: form.code, name: form.name, account_type: form.account_type, description: form.description || null, is_active: form.is_active };
      if (editing) {
        const { error } = await supabase.from("chart_of_accounts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chart_of_accounts").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); setOpen(false); reset(); qc.invalidateQueries({ queryKey: ["chart-of-accounts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chart_of_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["chart-of-accounts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(a: Account) {
    setEditing(a);
    setForm({ code: a.code, name: a.name, account_type: a.account_type, description: a.description ?? "", is_active: a.is_active });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">General ledger structure for all financial transactions.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New account</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit account" : "New account"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="col-span-2 flex items-center justify-between"><Label>Active</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
              <Button onClick={() => save.mutate()} disabled={!form.code || !form.name || save.isPending} className="col-span-2">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Wallet className="mx-auto mb-2 h-6 w-6" /> No accounts yet
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono">{a.code}</TableCell>
                  <TableCell><div className="font-medium">{a.name}</div>{a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{a.account_type}</Badge></TableCell>
                  <TableCell><Badge variant={a.is_active ? "default" : "outline"}>{a.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => del.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
