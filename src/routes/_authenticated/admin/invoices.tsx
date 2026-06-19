import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listInvoices, listUnits, createInvoice, voidInvoice, generateDocumentPdf } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Download, Ban } from "lucide-react";
import { toast } from "sonner";
import { downloadBase64Pdf } from "@/lib/pdf-download";

export const Route = createFileRoute("/_authenticated/admin/invoices")({
  head: () => ({ meta: [{ title: "Invoices — Hayy Admin" }] }),
  component: InvoicesPage,
});

type Line = { description: string; quantity: number; unit_price: number; tax_rate: number };

function InvoicesPage() {
  const qc = useQueryClient();
  const fetchInvoices = useServerFn(listInvoices);
  const fetchUnits = useServerFn(listUnits);
  const create = useServerFn(createInvoice);
  const voidFn = useServerFn(voidInvoice);
  const genPdf = useServerFn(generateDocumentPdf);

  const invoices = useQuery({ queryKey: ["invoices"], queryFn: () => fetchInvoices() });
  const units = useQuery({ queryKey: ["units-sales"], queryFn: () => fetchUnits() });

  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [desc, setDesc] = useState("");
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([{ description: "Service charge", quantity: 1, unit_price: 0, tax_rate: 5 }]);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const tax = lines.reduce((s, l) => s + l.quantity * l.unit_price * (l.tax_rate / 100), 0);

  const createMut = useMutation({
    mutationFn: async () => create({ data: { unit_id: unitId, description: desc, due_date: dueDate, line_items: lines } }),
    onSuccess: () => {
      toast.success("Invoice created");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false);
      setUnitId(""); setDesc(""); setLines([{ description: "Service charge", quantity: 1, unit_price: 0, tax_rate: 5 }]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handlePdf(id: string) {
    const r = await genPdf({ data: { kind: "invoice", id } });
    downloadBase64Pdf(r.base64, r.filename);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Invoices</h2>
          <p className="text-sm text-muted-foreground">Sales invoices with line items and tax.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New invoice</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Create invoice</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Unit</Label>
                  <Select value={unitId} onValueChange={setUnitId}>
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      {units.data?.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.building} • {u.unit_number}{u.residents?.[0]?.full_name ? ` — ${u.residents[0].full_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Due date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="E.g. Q1 service charge" />
              </div>
              <div>
                <Label>Line items</Label>
                <div className="space-y-2">
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
                        onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm"
                    onClick={() => setLines([...lines, { description: "", quantity: 1, unit_price: 0, tax_rate: 5 }])}>
                    <Plus className="mr-2 h-4 w-4" /> Add line
                  </Button>
                </div>
                <div className="mt-3 text-right text-sm">
                  Subtotal: <strong>AED {subtotal.toFixed(2)}</strong> &nbsp;
                  Tax: <strong>AED {tax.toFixed(2)}</strong> &nbsp;
                  Total: <strong>AED {(subtotal + tax).toFixed(2)}</strong>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate()} disabled={!unitId || createMut.isPending}>
                {createMut.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.data?.map((i: any) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                <TableCell>{i.units?.building} • {i.units?.unit_number}</TableCell>
                <TableCell>{i.due_date}</TableCell>
                <TableCell>{i.currency} {Number(i.amount).toFixed(2)}</TableCell>
                <TableCell>{i.currency} {Number(i.amount_paid).toFixed(2)}</TableCell>
                <TableCell><Badge variant={i.status === "paid" ? "default" : i.status === "overdue" ? "destructive" : "secondary"}>{i.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handlePdf(i.id)}><Download className="h-4 w-4" /></Button>
                  {i.status !== "cancelled" && (
                    <Button variant="ghost" size="sm" onClick={async () => {
                      if (!confirm("Void this invoice?")) return;
                      await voidFn({ data: { id: i.id } });
                      qc.invalidateQueries({ queryKey: ["invoices"] });
                    }}><Ban className="h-4 w-4" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!invoices.data?.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No invoices yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
