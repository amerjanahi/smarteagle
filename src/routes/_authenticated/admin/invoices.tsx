import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { listInvoices, listUnits, listInvoiceAccounts, createInvoice, voidInvoice, generateDocumentPdf, issueCreditNote, recordPayment } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Download, Ban, Mail, MessageCircle, Upload, FileText, Eye, CreditCard, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { downloadBase64Pdf } from "@/lib/pdf-download";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/_authenticated/admin/invoices")({
  head: () => ({ meta: [{ title: "Invoices — Hayy Admin" }] }),
  component: InvoicesPage,
});

type Line = { description: string; quantity: number; unit_price: number; tax_rate: number; account_id: string | null };
type Attachment = { name: string; url: string };

const blankLine = (): Line => ({ description: "", quantity: 1, unit_price: 0, tax_rate: 5, account_id: null });

function InvoicesPage() {
  const { format: money } = useCurrency();
  const qc = useQueryClient();
  const fetchInvoices = useServerFn(listInvoices);
  const fetchUnits = useServerFn(listUnits);
  const fetchAccounts = useServerFn(listInvoiceAccounts);
  const create = useServerFn(createInvoice);
  const voidFn = useServerFn(voidInvoice);
  const genPdf = useServerFn(generateDocumentPdf);
  const record = useServerFn(recordPayment);
  const issueCredit = useServerFn(issueCreditNote);

  const invoices = useQuery({ queryKey: ["invoices"], queryFn: () => fetchInvoices() });
  const units = useQuery({ queryKey: ["units-sales"], queryFn: () => fetchUnits() });
  const accounts = useQuery({ queryKey: ["invoice-gl-accounts"], queryFn: () => fetchAccounts() });
  const defaultAccountId = accounts.data?.find((account: any) => account.code === "4100")?.id ?? accounts.data?.[0]?.id ?? null;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    unit_id: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    description: "",
    period_start: "",
    period_end: "",
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    payment_terms: "Net 30",
    discount_value: "",
    discount_type: "amount" as "amount" | "percentage",
    notes: "",
  });
  const [lines, setLines] = useState<Line[]>([{ description: "Service charge", quantity: 1, unit_price: 0, tax_rate: 5, account_id: null }]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachName, setAttachName] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank_transfer" | "cash" | "cheque" | "mock">("bank_transfer");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [creditInvoice, setCreditInvoice] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditReason, setCreditReason] = useState("");
  const csvRef = useRef<HTMLInputElement>(null);

  const invoiceBalance = (invoice: any) => Math.max(
    Number(invoice.amount || 0) - Number(invoice.amount_paid || 0) - Number(invoice.credit_applied || 0), 0
  );

  function startPayment(invoice: any) {
    setSelectedInvoice(null);
    setPaymentInvoice(invoice);
    setPaymentAmount(invoiceBalance(invoice));
    setPaymentNotes("");
  }
  function startCredit(invoice: any) {
    setSelectedInvoice(null);
    setCreditInvoice(invoice);
    setCreditAmount(invoiceBalance(invoice));
    setCreditReason("");
  }
  async function saveQuickPayment() {
    if (!paymentInvoice) return;
    try {
      await record({ data: {
        unit_id: paymentInvoice.unit_id, amount: paymentAmount, payment_method: paymentMethod,
        notes: paymentNotes || undefined,
        allocations: [{ invoice_id: paymentInvoice.id, amount_applied: paymentAmount }],
      } });
      toast.success("Payment recorded and applied");
      setPaymentInvoice(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ["invoices"] }), qc.invalidateQueries({ queryKey: ["payments"] })]);
    } catch (error: any) { toast.error(error.message); }
  }
  async function saveQuickCredit() {
    if (!creditInvoice) return;
    try {
      await issueCredit({ data: {
        unit_id: creditInvoice.unit_id, invoice_id: creditInvoice.id, amount: creditAmount,
        reason: creditReason, allocations: [{ invoice_id: creditInvoice.id, amount_applied: creditAmount }],
      } });
      toast.success("Credit note created and applied");
      setCreditInvoice(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ["invoices"] }), qc.invalidateQueries({ queryKey: ["credit-notes"] })]);
    } catch (error: any) { toast.error(error.message); }
  }

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unit_price, 0), [lines]);
  const tax = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unit_price * (l.tax_rate / 100), 0), [lines]);
  const discountInput = Math.max(Number(form.discount_value || 0), 0);
  const calculatedDiscount = form.discount_type === "percentage"
    ? (subtotal + tax) * Math.min(discountInput, 100) / 100
    : discountInput;
  const total = Math.max(subtotal + tax - calculatedDiscount, 0);

  function resetForm() {
    setForm({
      unit_id: "", customer_name: "", customer_email: "", customer_phone: "",
      description: "", period_start: "", period_end: "",
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      payment_terms: "Net 30", discount_value: "", discount_type: "amount", notes: "",
    });
    setLines([{ description: "Service charge", quantity: 1, unit_price: 0, tax_rate: 5, account_id: defaultAccountId }]);
    setAttachments([]);
  }

  function onUnitChange(unitId: string) {
    const u: any = units.data?.find((x: any) => x.id === unitId);
    const r = u?.residents?.find((x: any) => x.is_active) ?? u?.residents?.[0];
    setForm((f) => ({
      ...f,
      unit_id: unitId,
      customer_name: r?.full_name ?? f.customer_name,
      customer_email: r?.email ?? f.customer_email,
    }));
  }

  const createMut = useMutation({
    mutationFn: async () => create({ data: {
      unit_id: form.unit_id,
      description: form.description,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
      due_date: form.due_date,
      discount_amount: calculatedDiscount,
      payment_terms: form.payment_terms || null,
      notes: form.notes || null,
      customer_name: form.customer_name || null,
      customer_email: form.customer_email || null,
      customer_phone: form.customer_phone || null,
      attachments,
      line_items: lines,
    } }),
    onSuccess: () => {
      toast.success("Invoice created");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handlePdf(id: string) {
    const r = await genPdf({ data: { kind: "invoice", id } });
    downloadBase64Pdf(r.base64, r.filename);
  }

  function emailInvoice(inv: any) {
    const to = inv.customer_email || inv.units?.residents?.[0]?.email || "";
    if (!to) { toast.error("No customer email on file"); return; }
    const subject = `Invoice ${inv.invoice_number}`;
    const body = `Dear ${inv.customer_name || "customer"},\n\nPlease find your invoice ${inv.invoice_number} for ${inv.currency} ${Number(inv.amount).toFixed(2)} due on ${inv.due_date}.\n\nThank you.`;
    window.open(`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  }

  function whatsappInvoice(inv: any) {
    const phone = (inv.customer_phone || "").replace(/[^\d]/g, "");
    if (!phone) { toast.error("No customer phone on file"); return; }
    const msg = `Hi ${inv.customer_name || ""}, your invoice ${inv.invoice_number} for ${inv.currency} ${Number(inv.amount).toFixed(2)} is due on ${inv.due_date}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean);
    if (rows.length < 2) { toast.error("CSV is empty"); return; }
    const headers = rows[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = (k: string) => headers.indexOf(k);
    let ok = 0, fail = 0;
    for (const row of rows.slice(1)) {
      const cols = row.split(",").map((c) => c.trim());
      const unitNumber = cols[idx("unit_number")];
      const u: any = units.data?.find((x: any) => x.unit_number === unitNumber);
      if (!u) { fail++; continue; }
      try {
        await create({ data: {
          unit_id: u.id,
          description: cols[idx("description")] || "Imported invoice",
          due_date: cols[idx("due_date")] || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          customer_name: cols[idx("customer_name")] || null,
          customer_email: cols[idx("customer_email")] || null,
          customer_phone: cols[idx("customer_phone")] || null,
          payment_terms: cols[idx("payment_terms")] || null,
          discount_amount: Number(cols[idx("discount")] || 0),
          line_items: [{
            description: cols[idx("description")] || "Service",
            quantity: Number(cols[idx("quantity")] || 1),
            unit_price: Number(cols[idx("unit_price")] || 0),
            tax_rate: Number(cols[idx("tax_rate")] || 5),
            account_id: accounts.data?.find((account: any) => account.code === cols[idx("account_code")])?.id ?? defaultAccountId,
          }],
        } });
        ok++;
      } catch { fail++; }
    }
    if (csvRef.current) csvRef.current.value = "";
    toast.success(`Imported ${ok} invoice(s)${fail ? `, ${fail} failed` : ""}`);
    qc.invalidateQueries({ queryKey: ["invoices"] });
  }

  function downloadCsvTemplate() {
    const headers = [
      "unit_number", "customer_name", "customer_email", "customer_phone",
      "description", "due_date", "quantity", "unit_price", "tax_rate",
      "account_code", "discount", "payment_terms",
    ];
    const example = [
      "101", "Example Resident", "resident@example.com", "+97300000000",
      "Monthly service charge", "2026-08-31", "1", "50.00", "5",
      "4100", "0", "Net 30",
    ];
    const csv = [headers, example].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "invoice-import-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (!open) return (
    <div className="space-y-4">

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Invoices</h2>
          <p className="text-sm text-muted-foreground">Sales invoices with line items, VAT, discount and attachments.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={csvRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsv}
          />
          <Button variant="outline" onClick={downloadCsvTemplate}>
            <Download className="mr-2 h-4 w-4" /> Download CSV template
          </Button>
          <Button variant="outline" onClick={() => csvRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New invoice
          </Button>
        </div>
      </header>

      <p className="text-xs text-muted-foreground">
        Download the template, replace the example row with your invoice data, then upload it. The <code>account_code</code> is the GL account code, such as <code>4100</code>.
      </p>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.data?.map((i: any) => (
              <TableRow key={i.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedInvoice(i)}>
                <TableCell className="font-mono text-xs font-medium">{i.invoice_number}</TableCell>
                <TableCell>{i.customer_name || i.units?.residents?.[0]?.full_name || "—"}</TableCell>
                <TableCell>{i.units?.building} • {i.units?.unit_number}</TableCell>
                <TableCell>{i.due_date}</TableCell>
                <TableCell className="text-right">{i.currency} {Number(i.amount).toFixed(2)}</TableCell>
                <TableCell className="text-right">{money(Number(i.amount_paid || 0))}</TableCell>
                <TableCell>
                  <Badge variant={i.status === "paid" ? "default" : i.status === "overdue" ? "destructive" : "secondary"}>
                    {i.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                  <Button variant="ghost" size="icon" title="View" onClick={() => setSelectedInvoice(i)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="PDF" onClick={() => handlePdf(i.id)}><Download className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Email" onClick={() => emailInvoice(i)}><Mail className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="WhatsApp" onClick={() => whatsappInvoice(i)}><MessageCircle className="h-4 w-4" /></Button>
                  {i.status !== "cancelled" && (
                    <Button variant="ghost" size="icon" title="Void" onClick={async () => {
                      if (!confirm("Void this invoice?")) return;
                      await voidFn({ data: { id: i.id } });
                      qc.invalidateQueries({ queryKey: ["invoices"] });
                    }}><Ban className="h-4 w-4" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!invoices.data?.length && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No invoices yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedInvoice} onOpenChange={(show) => !show && setSelectedInvoice(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Invoice {selectedInvoice?.invoice_number}</DialogTitle></DialogHeader>
          {selectedInvoice && <div className="space-y-5">
            <div className="grid gap-3 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{selectedInvoice.customer_name || selectedInvoice.units?.residents?.[0]?.full_name || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Unit</p><p className="font-medium">{selectedInvoice.units?.building} · {selectedInvoice.units?.unit_number}</p></div>
              <div><p className="text-xs text-muted-foreground">Due date</p><p className="font-medium">{new Date(selectedInvoice.due_date).toLocaleDateString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><Badge className="capitalize">{selectedInvoice.status}</Badge></div>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">VAT</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(selectedInvoice.invoice_line_items ?? []).map((line: any) => <TableRow key={line.id}><TableCell>{line.description}</TableCell><TableCell className="text-right">{line.quantity}</TableCell><TableCell className="text-right">{money(line.unit_price)}</TableCell><TableCell className="text-right">{line.tax_rate}%</TableCell><TableCell className="text-right">{money(line.line_total)}</TableCell></TableRow>)}
                  {!selectedInvoice.invoice_line_items?.length && <TableRow><TableCell colSpan={5}>{selectedInvoice.description || "Invoice total"}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <div className="ml-auto grid max-w-sm grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <span className="text-muted-foreground">Invoice total</span><span className="text-right font-medium">{money(selectedInvoice.amount)}</span>
              <span className="text-muted-foreground">Cash paid</span><span className="text-right">{money(selectedInvoice.amount_paid)}</span>
              <span className="text-muted-foreground">Credits applied</span><span className="text-right">{money(selectedInvoice.credit_applied || 0)}</span>
              <span className="border-t pt-2 font-semibold">Balance due</span><span className="border-t pt-2 text-right font-semibold">{money(invoiceBalance(selectedInvoice))}</span>
            </div>
            {selectedInvoice.notes && <div className="rounded-lg border p-3 text-sm"><p className="text-xs font-medium text-muted-foreground">Notes</p><p className="whitespace-pre-wrap">{selectedInvoice.notes}</p></div>}
            <div className="flex flex-wrap gap-2">
              {invoiceBalance(selectedInvoice) > 0 && selectedInvoice.status !== "cancelled" && <>
                <Button onClick={() => startPayment(selectedInvoice)}><CreditCard className="mr-2 h-4 w-4" />Record payment</Button>
                <Button variant="outline" onClick={() => startCredit(selectedInvoice)}><ReceiptText className="mr-2 h-4 w-4" />Add credit note</Button>
              </>}
              <Button variant="outline" onClick={() => handlePdf(selectedInvoice.id)}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!paymentInvoice} onOpenChange={(show) => !show && setPaymentInvoice(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Record payment for {paymentInvoice?.invoice_number}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">Outstanding balance: <strong>{money(paymentInvoice ? invoiceBalance(paymentInvoice) : 0)}</strong></div>
            <div><Label>Amount to receive and apply</Label><Input type="number" min="0.001" step="0.001" max={paymentInvoice ? invoiceBalance(paymentInvoice) : undefined} value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} /></div>
            <div><Label>Payment method</Label><Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="mock">Mock</SelectItem></SelectContent></Select></div>
            <div><Label>Notes</Label><Textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPaymentInvoice(null)}>Cancel</Button><Button onClick={saveQuickPayment} disabled={!paymentAmount || (paymentInvoice && paymentAmount > invoiceBalance(paymentInvoice))}>Record and apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!creditInvoice} onOpenChange={(show) => !show && setCreditInvoice(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add credit note to {creditInvoice?.invoice_number}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">Outstanding balance: <strong>{money(creditInvoice ? invoiceBalance(creditInvoice) : 0)}</strong></div>
            <div><Label>Credit amount to apply</Label><Input type="number" min="0.001" step="0.001" max={creditInvoice ? invoiceBalance(creditInvoice) : undefined} value={creditAmount} onChange={(e) => setCreditAmount(Number(e.target.value))} /></div>
            <div><Label>Reason</Label><Textarea value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder="Reason for reducing this invoice" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreditInvoice(null)}>Cancel</Button><Button onClick={saveQuickCredit} disabled={!creditAmount || !creditReason.trim() || (creditInvoice && creditAmount > invoiceBalance(creditInvoice))}>Create and apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] w-full flex-col">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border pb-4 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeWorkspace} title="Back to invoices">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 truncate font-display text-2xl font-bold tracking-tight">
              <FileText className="h-5 w-5 shrink-0" /> Create invoice
            </h2>
            <p className="text-sm text-muted-foreground">Customer details, line items and totals — all on one page.</p>
          </div>
        </div>
        <Button variant="outline" onClick={closeWorkspace}>Back to invoices</Button>
      </header>

      <div className="flex-1 pt-6">


          <div className="grid gap-6 lg:grid-cols-3">
            {/* LEFT — Customer + meta */}
            <Card className="lg:col-span-1">
              <CardContent className="space-y-4 pt-6">
                <div>
                  <Label>Unit</Label>
                  <Select value={form.unit_id} onValueChange={onUnitChange}>
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      {units.data?.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.building} • {u.unit_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Customer name</Label>
                  <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="+9715..." />
                  </div>
                </div>
                <div>
                  <Label>Due date</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Service from</Label>
                    <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
                  </div>
                  <div>
                    <Label>Service to</Label>
                    <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Payment terms</Label>
                  <Select value={form.payment_terms} onValueChange={(v) => setForm({ ...form, payment_terms: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                      <SelectItem value="Net 7">Net 7</SelectItem>
                      <SelectItem value="Net 14">Net 14</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 60">Net 60</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* RIGHT — Lines + totals + notes + attachments */}
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <div>
                    <Label>Description / Subject</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="E.g. Q1 service charge" />
                  </div>

                  <div>
                    <Label>Line items</Label>
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-muted-foreground">
                        <span className="col-span-3">Description</span>
                        <span className="col-span-2">GL account</span>
                        <span className="col-span-2">Qty</span>
                        <span className="col-span-2">Unit price</span>
                        <span className="col-span-2">VAT %</span>
                        <span className="col-span-1" />
                      </div>
                      {lines.map((l, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2">
                          <Input className="col-span-3" placeholder="Description" value={l.description}
                            onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                          <Select value={l.account_id ?? "unmapped"} onValueChange={(value) => setLines(lines.map((x, j) => j === i ? { ...x, account_id: value === "unmapped" ? null : value } : x))}>
                            <SelectTrigger className="col-span-2"><SelectValue placeholder="GL account" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unmapped">Unmapped</SelectItem>
                              {accounts.data?.map((account: any) => (
                                <SelectItem key={account.id} value={account.id}>{account.code} — {account.name} ({account.account_type})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input className="col-span-2" type="number" step="0.001" value={l.quantity}
                            onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: +e.target.value } : x))} />
                          <Input className="col-span-2" type="number" step="0.01" value={l.unit_price}
                            onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit_price: +e.target.value } : x))} />
                          <Input className="col-span-2" type="number" step="0.01" value={l.tax_rate}
                            onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, tax_rate: +e.target.value } : x))} />
                          <Button variant="ghost" size="icon" className="col-span-1"
                            onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : lines)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => setLines([...lines, { ...blankLine(), account_id: defaultAccountId }])}>
                        <Plus className="mr-2 h-4 w-4" /> Add line
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Discount</Label>
                      <div className="flex gap-2">
                        <Input type="number" min="0" max={form.discount_type === "percentage" ? 100 : undefined} step="0.01" value={form.discount_value}
                          placeholder="0"
                          onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
                        <Select value={form.discount_type} onValueChange={(value: "amount" | "percentage") => setForm({ ...form, discount_type: value })}>
                          <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="amount">Amount</SelectItem><SelectItem value="percentage">Percentage</SelectItem></SelectContent>
                        </Select>
                      </div>
                      {form.discount_type === "percentage" && <p className="mt-1 text-xs text-muted-foreground">Calculated from the invoice subtotal and VAT.</p>}
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                      <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                      <div className="flex justify-between"><span>VAT</span><span>{money(tax)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Discount{form.discount_type === "percentage" && discountInput ? ` (${discountInput}%)` : ""}</span><span>− {money(calculatedDiscount)}</span></div>
                      <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>{money(total)}</span></div>
                    </div>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Terms, bank details, thank-you note…" />
                  </div>

                  <div>
                    <Label>Attachments (links)</Label>
                    <div className="flex gap-2">
                      <Input placeholder="File name" value={attachName} onChange={(e) => setAttachName(e.target.value)} />
                      <Input placeholder="URL" value={attachUrl} onChange={(e) => setAttachUrl(e.target.value)} />
                      <Button variant="outline" onClick={() => {
                        if (!attachName || !attachUrl) return;
                        setAttachments([...attachments, { name: attachName, url: attachUrl }]);
                        setAttachName(""); setAttachUrl("");
                      }}>Add</Button>
                    </div>
                    {attachments.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {attachments.map((a, i) => (
                          <li key={i} className="flex items-center justify-between rounded border border-border px-2 py-1">
                            <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">{a.name}</a>
                            <Button variant="ghost" size="icon" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button variant="outline" onClick={closeWorkspace}>Cancel</Button>
        <Button onClick={() => createMut.mutate()} disabled={!form.unit_id || createMut.isPending}>
          {createMut.isPending ? "Creating…" : `Create invoice (${money(total)})`}
        </Button>
      </div>
    </div>
  );

}
