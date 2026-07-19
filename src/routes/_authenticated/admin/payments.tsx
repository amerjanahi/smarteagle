import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { listPayments, listInvoices, listUnits, recordPayment, generateDocumentPdf } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadBase64Pdf } from "@/lib/pdf-download";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({ meta: [{ title: "Payments — Hayy Admin" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { format: money } = useCurrency();
  const qc = useQueryClient();
  const fetchPayments = useServerFn(listPayments);
  const fetchInvoices = useServerFn(listInvoices);
  const fetchUnits = useServerFn(listUnits);
  const record = useServerFn(recordPayment);
  const genPdf = useServerFn(generateDocumentPdf);

  const payments = useQuery({ queryKey: ["payments"], queryFn: () => fetchPayments() });
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: () => fetchInvoices() });
  const units = useQuery({ queryKey: ["units-sales"], queryFn: () => fetchUnits() });

  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"card" | "bank_transfer" | "cash" | "cheque" | "mock">("bank_transfer");
  const [notes, setNotes] = useState("");
  const [allocs, setAllocs] = useState<Record<string, number>>({});

  const openInvoices = useMemo(() => (invoices.data ?? []).filter((i: any) =>
    i.unit_id === unitId && i.status !== "paid" && i.status !== "cancelled"
  ), [invoices.data, unitId]);

  const allocSum = Object.values(allocs).reduce((s, v) => s + (Number(v) || 0), 0);

  const mut = useMutation({
    mutationFn: async () => record({
      data: {
        unit_id: unitId,
        amount,
        payment_method: method,
        notes: notes || undefined,
        allocations: Object.entries(allocs)
          .filter(([, v]) => Number(v) > 0)
          .map(([invoice_id, amount_applied]) => ({ invoice_id, amount_applied: Number(amount_applied) })),
      },
    }),
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false); setUnitId(""); setAmount(0); setNotes(""); setAllocs({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handlePdf(id: string) {
    const r = await genPdf({ data: { kind: "receipt", id } });
    downloadBase64Pdf(r.base64, r.filename);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Payments</h2>
          <p className="text-sm text-muted-foreground">Record receipts and allocate to invoices.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Record payment</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Unit</Label>
                  <Select value={unitId} onValueChange={(v) => { setUnitId(v); setAllocs({}); }}>
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
                  <Label>Method</Label>
                  <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="mock">Mock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {unitId && (
                <div>
                  <Label>Allocate to open invoices (leave blank to auto-allocate FIFO)</Label>
                  <div className="mt-2 space-y-2">
                    {openInvoices.length === 0 && <p className="text-sm text-muted-foreground">No open invoices for this unit.</p>}
                    {openInvoices.map((i: any) => {
                      const bal = Number(i.amount) - Number(i.amount_paid);
                      return (
                        <div key={i.id} className="grid grid-cols-12 items-center gap-2 text-sm">
                          <div className="col-span-7">
                            <div className="font-mono text-xs">{i.invoice_number}</div>
                            <div className="text-xs text-muted-foreground">Balance: {i.currency} {bal.toFixed(2)}</div>
                          </div>
                          <Input className="col-span-3" type="number" step="0.01"
                            placeholder="0.00"
                            value={allocs[i.id] ?? ""}
                            onChange={(e) => setAllocs({ ...allocs, [i.id]: +e.target.value })} />
                          <Button variant="ghost" size="sm" className="col-span-2"
                            onClick={() => setAllocs({ ...allocs, [i.id]: bal })}>Fill</Button>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Allocated: AED {allocSum.toFixed(2)} • Unallocated: AED {Math.max(amount - allocSum, 0).toFixed(2)}
                  </p>
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => mut.mutate()} disabled={!unitId || !amount || mut.isPending}>
                {mut.isPending ? "Saving…" : "Record"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt #</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Allocated</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.data?.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                <TableCell>{p.invoices?.units?.unit_number ?? "—"}</TableCell>
                <TableCell>{new Date(p.paid_at).toLocaleDateString()}</TableCell>
                <TableCell className="capitalize">{p.payment_method}</TableCell>
                <TableCell>AED {Number(p.amount).toFixed(2)}</TableCell>
                <TableCell>AED {Number(p.allocated_amount).toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handlePdf(p.id)}><Download className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!payments.data?.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No payments yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
