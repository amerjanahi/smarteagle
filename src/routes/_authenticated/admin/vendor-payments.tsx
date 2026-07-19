import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listVendorPayments, recordVendorPayment, listPurchaseInvoices, listVendors,
} from "@/lib/purchases.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/vendor-payments")({
  head: () => ({ meta: [{ title: "Vendor Payments — Hayy Admin" }] }),
  component: VendorPaymentsPage,
});

import { useCurrency } from "@/hooks/use-currency";

function VendorPaymentsPage() {
  const { format: money } = useCurrency();
  const fetchList = useServerFn(listVendorPayments);
  const fetchBills = useServerFn(listPurchaseInvoices);
  const fetchVendors = useServerFn(listVendors);
  const create = useServerFn(recordVendorPayment);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({ queryKey: ["vendor-payments"], queryFn: () => fetchList() });
  const { data: bills = [] } = useQuery({ queryKey: ["purchase-invoices"], queryFn: () => fetchBills() });
  const { data: vendors = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => fetchVendors() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);

  function startNew() {
    setForm({
      vendor_id: "", purchase_invoice_id: "", payment_date: new Date().toISOString().slice(0, 10),
      amount: 0, method: "bank_transfer", reference: "", notes: "",
    });
    setOpen(true);
  }

  async function submit() {
    try {
      await create({
        data: {
          vendor_id: form.vendor_id || null,
          purchase_invoice_id: form.purchase_invoice_id || null,
          payment_date: form.payment_date,
          amount: Number(form.amount),
          method: form.method,
          reference: form.reference,
          notes: form.notes,
        },
      });
      toast.success("Payment recorded");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["vendor-payments"] });
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
    } catch (e: any) { toast.error(e.message); }
  }

  const openBills = bills.filter((b: any) => Number(b.balance_due) > 0);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Vendor Payments</h2>
          <p className="text-sm text-muted-foreground">Pay vendor bills and track outstanding balances.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={startNew}><Plus className="mr-2 h-4 w-4" />Record Payment</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Vendor Payment</DialogTitle></DialogHeader>
            {form && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Vendor</Label>
                  <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v, purchase_invoice_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Pick vendor" /></SelectTrigger>
                    <SelectContent>{vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Apply to Bill (optional)</Label>
                  <Select value={form.purchase_invoice_id} onValueChange={(v) => setForm({ ...form, purchase_invoice_id: v })}>
                    <SelectTrigger><SelectValue placeholder="On-account or pick a bill" /></SelectTrigger>
                    <SelectContent>
                      {openBills.filter((b: any) => !form.vendor_id || b.vendor_id === form.vendor_id).map((b: any) =>
                        <SelectItem key={b.id} value={b.id}>{b.bill_number} — {money(b.balance_due)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Payment Date</Label><Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div>
                <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div>
                  <Label>Method</Label>
                  <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["bank_transfer", "cheque", "cash", "card", "other"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
                <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
            )}
            <DialogFooter><Button onClick={submit}>Save Payment</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Payment #</TableHead><TableHead>Date</TableHead><TableHead>Vendor</TableHead><TableHead>Bill</TableHead><TableHead>Method</TableHead><TableHead>Amount</TableHead><TableHead>Reference</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow> :
              data.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No payments yet</TableCell></TableRow> :
              data.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.payment_number}</TableCell>
                  <TableCell>{p.payment_date}</TableCell>
                  <TableCell>{p.vendors?.name ?? "-"}</TableCell>
                  <TableCell>{p.purchase_invoices?.bill_number ?? "On account"}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell>{money(p.amount)}</TableCell>
                  <TableCell>{p.reference}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
