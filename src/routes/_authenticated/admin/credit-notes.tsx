import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCreditNotes, listUnits, issueCreditNote, generateDocumentPdf } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadBase64Pdf } from "@/lib/pdf-download";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/_authenticated/admin/credit-notes")({
  head: () => ({ meta: [{ title: "Credit Notes — Hayy Admin" }] }),
  component: CreditNotesPage,
});

function CreditNotesPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listCreditNotes);
  const fetchUnits = useServerFn(listUnits);
  const issue = useServerFn(issueCreditNote);
  const genPdf = useServerFn(generateDocumentPdf);

  const list = useQuery({ queryKey: ["credit-notes"], queryFn: () => fetchList() });
  const units = useQuery({ queryKey: ["units-sales"], queryFn: () => fetchUnits() });

  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");

  const mut = useMutation({
    mutationFn: async () => issue({ data: { unit_id: unitId, amount, reason } }),
    onSuccess: () => {
      toast.success("Credit note issued");
      qc.invalidateQueries({ queryKey: ["credit-notes"] });
      setOpen(false); setUnitId(""); setAmount(0); setReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handlePdf(id: string) {
    const r = await genPdf({ data: { kind: "credit_note", id } });
    downloadBase64Pdf(r.base64, r.filename);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Credit Notes</h2>
          <p className="text-sm text-muted-foreground">Issue and track credit notes per customer.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Issue credit note</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Issue credit note</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Unit</Label>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {units.data?.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.building} • {u.unit_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(+e.target.value)} />
              </div>
              <div>
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this credit being issued?" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => mut.mutate()} disabled={!unitId || !amount || !reason || mut.isPending}>
                {mut.isPending ? "Issuing…" : "Issue"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Credit Note #</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.credit_note_number}</TableCell>
                <TableCell>{c.units?.building} • {c.units?.unit_number}</TableCell>
                <TableCell>{new Date(c.issued_at).toLocaleDateString()}</TableCell>
                <TableCell>AED {Number(c.amount).toFixed(2)}</TableCell>
                <TableCell>AED {Number(c.applied_amount).toFixed(2)}</TableCell>
                <TableCell>AED {Number(c.balance).toFixed(2)}</TableCell>
                <TableCell><Badge variant={c.status === "applied" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handlePdf(c.id)}><Download className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!list.data?.length && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No credit notes yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
