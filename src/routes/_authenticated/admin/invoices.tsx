import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { listInvoices, listUnits, createInvoice, voidInvoice, generateDocumentPdf } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Download, Ban, Mail, MessageCircle, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { downloadBase64Pdf } from "@/lib/pdf-download";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/_authenticated/admin/invoices")({
  head: () => ({ meta: [{ title: "Invoices — Hayy Admin" }] }),
  component: InvoicesPage,
});

type Line = { description: string; quantity: number; unit_price: number; tax_rate: number };
type Attachment = { name: string; url: string };

const blankLine = (): Line => ({ description: "", quantity: 1, unit_price: 0, tax_rate: 5 });

function InvoicesPage() {
  const { format: money } = useCurrency();
  const qc = useQueryClient();
  const fetchInvoices = useServerFn(listInvoices);
  const fetchUnits = useServerFn(listUnits);
  const create = useServerFn(createInvoice);
  const voidFn = useServerFn(voidInvoice);
  const genPdf = useServerFn(generateDocumentPdf);

  const invoices = useQuery({ queryKey: ["invoices"], queryFn: () => fetchInvoices() });
  const units = useQuery({ queryKey: ["units-sales"], queryFn: () => fetchUnits() });

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
    discount_amount: 0,
    notes: "",
  });
  const [lines, setLines] = useState<Line[]>([{ description: "Service charge", quantity: 1, unit_price: 0, tax_rate: 5 }]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachName, setAttachName] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const csvRef = useRef<HTMLInputElement>(null);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unit_price, 0), [lines]);
  const tax = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unit_price * (l.tax_rate / 100), 0), [lines]);
  const total = Math.max(subtotal + tax - Number(form.discount_amount || 0), 0);

  function resetForm() {
    setForm({
      unit_id: "", customer_name: "", customer_email: "", customer_phone: "",
      description: "", period_start: "", period_end: "",
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      payment_terms: "Net 30", discount_amount: 0, notes: "",
    });
    setLines([{ description: "Service charge", quantity: 1, unit_price: 0, tax_rate: 5 }]);
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
      discount_amount: Number(form.discount_amount || 0),
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
          }],
        } });
        ok++;
      } catch { fail++; }
    }
    if (csvRef.current) csvRef.current.value = "";
    toast.success(`Imported ${ok} invoice(s)${fail ? `, ${fail} failed` : ""}`);
    qc.invalidateQueries({ queryKey: ["invoices"] });
  }

  return (
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
          <Button variant="outline" onClick={() => csvRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New invoice
          </Button>
        </div>
      </header>

      <p className="text-xs text-muted-foreground">
        CSV columns: <code>unit_number, customer_name, customer_email, customer_phone, description, due_date, quantity, unit_price, tax_rate, discount, payment_terms</code>
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
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                <TableCell>{i.customer_name || i.units?.residents?.[0]?.full_name || "—"}</TableCell>
                <TableCell>{i.units?.building} • {i.units?.unit_number}</TableCell>
                <TableCell>{i.due_date}</TableCell>
                <TableCell className="text-right">{i.currency} {Number(i.amount).toFixed(2)}</TableCell>
                <TableCell className="text-right">{i.currency} {Number(i.amount_paid).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={i.status === "paid" ? "default" : i.status === "overdue" ? "destructive" : "secondary"}>
                    {i.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
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

      {/* Full-width create dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-[96vw] w-[1200px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Create invoice</DialogTitle>
          </DialogHeader>

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
                        <span className="col-span-5">Description</span>
                        <span className="col-span-2">Qty</span>
                        <span className="col-span-2">Unit price</span>
                        <span className="col-span-2">VAT %</span>
                        <span className="col-span-1" />
                      </div>
                      {lines.map((l, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2">
                          <Input className="col-span-5" placeholder="Description" value={l.description}
                            onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
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
                      <Button variant="outline" size="sm" onClick={() => setLines([...lines, blankLine()])}>
                        <Plus className="mr-2 h-4 w-4" /> Add line
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Discount (flat)</Label>
                      <Input type="number" step="0.01" value={form.discount_amount}
                        onChange={(e) => setForm({ ...form, discount_amount: +e.target.value })} />
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                      <div className="flex justify-between"><span>Subtotal</span><span>AED {subtotal.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>VAT</span><span>AED {tax.toFixed(2)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>− AED {Number(form.discount_amount || 0).toFixed(2)}</span></div>
                      <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span>AED {total.toFixed(2)}</span></div>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.unit_id || createMut.isPending}>
              {createMut.isPending ? "Creating…" : `Create invoice (AED ${total.toFixed(2)})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
