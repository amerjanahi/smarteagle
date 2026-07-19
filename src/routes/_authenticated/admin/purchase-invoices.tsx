import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listPurchaseInvoices, createPurchaseInvoice, approvePurchaseInvoice,
  deletePurchaseInvoice, listVendors,
} from "@/lib/purchases.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/purchase-invoices")({
  head: () => ({ meta: [{ title: "Purchase Invoices — Hayy Admin" }] }),
  component: PurchaseInvoicesPage,
});

import { useCurrency } from "@/hooks/use-currency";

function statusBadge(s: string) {
  const tone: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700", unpaid: "bg-amber-100 text-amber-700",
    partial: "bg-blue-100 text-blue-700", overdue: "bg-red-100 text-red-700", cancelled: "bg-gray-100 text-gray-700",
  };
  return <Badge className={tone[s] ?? ""}>{s}</Badge>;
}

function approvalBadge(s: string) {
  const tone: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700", pending: "bg-amber-100 text-amber-700",
    rejected: "bg-red-100 text-red-700", draft: "bg-gray-100 text-gray-700",
  };
  return <Badge variant="outline" className={tone[s] ?? ""}>{s}</Badge>;
}

function PurchaseInvoicesPage() {
  const { format: money } = useCurrency();
  const fetchList = useServerFn(listPurchaseInvoices);
  const fetchVendors = useServerFn(listVendors);
  const create = useServerFn(createPurchaseInvoice);
  const approve = useServerFn(approvePurchaseInvoice);
  const del = useServerFn(deletePurchaseInvoice);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({ queryKey: ["purchase-invoices"], queryFn: () => fetchList() });
  const { data: vendors = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => fetchVendors() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);

  function startNew() {
    setForm({
      vendor_id: "", vendor_name: "", issue_date: new Date().toISOString().slice(0, 10),
      due_date: "", subtotal: 0, vat_rate: 5, discount_amount: 0, category: "other",
      description: "", notes: "", payment_terms: "Net 30", reference: "", attachment_url: "",
    });
    setOpen(true);
  }

  const totals = useMemo(() => {
    if (!form) return { vat: 0, total: 0 };
    const vat = (Number(form.subtotal) * Number(form.vat_rate)) / 100;
    const total = Number(form.subtotal) + vat - Number(form.discount_amount || 0);
    return { vat, total };
  }, [form]);

  async function submit() {
    try {
      const v = vendors.find((x: any) => x.id === form.vendor_id);
      await create({
        data: {
          vendor_id: form.vendor_id || null,
          vendor_name: v?.name || form.vendor_name,
          issue_date: form.issue_date,
          due_date: form.due_date || null,
          subtotal: Number(form.subtotal),
          vat_amount: totals.vat,
          discount_amount: Number(form.discount_amount || 0),
          category: form.category,
          description: form.description,
          notes: form.notes,
          payment_terms: form.payment_terms,
          reference: form.reference,
          attachments: form.attachment_url ? [{ url: form.attachment_url, name: "Attachment" }] : [],
        },
      });
      toast.success("Purchase invoice created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
    } catch (e: any) { toast.error(e.message); }
  }

  async function decide(id: string, decision: "approved" | "rejected") {
    await approve({ data: { id, decision } });
    toast.success(`Bill ${decision}`);
    qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete this bill?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["purchase-invoices"] });
  }

  function exportPdf(b: any) {
    // Simple printable view; uses browser print-to-PDF
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${b.bill_number}</title>
      <style>body{font-family:system-ui;padding:32px;color:#111}h1{margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ddd;padding:8px;text-align:left}.right{text-align:right}</style>
      </head><body>
      <h1>Purchase Invoice ${b.bill_number}</h1>
      <p><b>Vendor:</b> ${b.vendor_name}<br/><b>Issued:</b> ${b.issue_date}<br/><b>Due:</b> ${b.due_date ?? "-"}<br/><b>Status:</b> ${b.status} / ${b.approval_status}</p>
      <p>${b.description ?? ""}</p>
      <table>
        <tr><th>Subtotal</th><td class="right">${money(b.subtotal)}</td></tr>
        <tr><th>VAT</th><td class="right">${money(b.vat_amount)}</td></tr>
        <tr><th>Discount</th><td class="right">-${money(b.discount_amount)}</td></tr>
        <tr><th>Total</th><td class="right"><b>${money(b.total_amount)}</b></td></tr>
        <tr><th>Paid</th><td class="right">${money(b.amount_paid)}</td></tr>
        <tr><th>Balance Due</th><td class="right"><b>${money(b.balance_due)}</b></td></tr>
      </table>
      <p style="margin-top:24px;color:#666">${b.notes ?? ""}</p>
      <script>window.print()</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Purchase Invoices</h2>
          <p className="text-sm text-muted-foreground">Vendor bills with VAT, approval workflow, and payment tracking.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={startNew}><Plus className="mr-2 h-4 w-4" />New Bill</Button></DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>New Purchase Invoice</DialogTitle></DialogHeader>
            {form && (
              <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                  <Label>Vendor</Label>
                  <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick vendor" /></SelectTrigger>
                    <SelectContent>{vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["admin", "security", "utility", "fm", "maintenance", "other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Issue Date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
                <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                <div><Label>Subtotal (AED)</Label><Input type="number" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} /></div>
                <div><Label>VAT %</Label><Input type="number" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} /></div>
                <div><Label>Discount (AED)</Label><Input type="number" value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} /></div>
                <div><Label>Payment Terms</Label><Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></div>
                <div className="col-span-2"><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
                <div className="col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <div className="col-span-2"><Label>Attachment URL (receipt / scan)</Label><Input placeholder="https://..." value={form.attachment_url} onChange={(e) => setForm({ ...form, attachment_url: e.target.value })} /></div>
                <div className="col-span-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <div className="flex justify-between"><span>VAT</span><span>{money(totals.vat)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Total</span><span>{money(totals.total)}</span></div>
                </div>
              </div>
            )}
            <DialogFooter><Button onClick={submit}>Save Bill</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill #</TableHead><TableHead>Vendor</TableHead><TableHead>Issued</TableHead>
              <TableHead>Due</TableHead><TableHead>Total</TableHead><TableHead>Balance</TableHead>
              <TableHead>Status</TableHead><TableHead>Approval</TableHead><TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9}>Loading…</TableCell></TableRow> :
              data.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No bills yet</TableCell></TableRow> :
              data.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.bill_number}</TableCell>
                  <TableCell>{b.vendor_name}</TableCell>
                  <TableCell>{b.issue_date}</TableCell>
                  <TableCell>{b.due_date ?? "-"}</TableCell>
                  <TableCell>{money(b.total_amount)}</TableCell>
                  <TableCell>{money(b.balance_due)}</TableCell>
                  <TableCell>{statusBadge(b.status)}</TableCell>
                  <TableCell>{approvalBadge(b.approval_status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {b.approval_status === "pending" && (
                        <>
                          <Button size="icon" variant="ghost" title="Approve" onClick={() => decide(b.id, "approved")}><Check className="h-4 w-4 text-emerald-600" /></Button>
                          <Button size="icon" variant="ghost" title="Reject" onClick={() => decide(b.id, "rejected")}><X className="h-4 w-4 text-red-600" /></Button>
                        </>
                      )}
                      <Button size="icon" variant="ghost" title="Export PDF" onClick={() => exportPdf(b)}><Download className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" title="Delete" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
