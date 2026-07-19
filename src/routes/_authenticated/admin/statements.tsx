import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { listUnits, getCustomerStatement, generateDocumentPdf } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { downloadBase64Pdf } from "@/lib/pdf-download";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/_authenticated/admin/statements")({
  head: () => ({ meta: [{ title: "Statements — Hayy Admin" }] }),
  component: StatementsPage,
});

function StatementsPage() {
  const { format: money, code: currencyCode } = useCurrency();
  const fetchUnits = useServerFn(listUnits);
  const fetchStatement = useServerFn(getCustomerStatement);
  const genPdf = useServerFn(generateDocumentPdf);

  const units = useQuery({ queryKey: ["units-sales"], queryFn: () => fetchUnits() });
  const [unitId, setUnitId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const stmt = useQuery({
    queryKey: ["statement", unitId, from, to],
    queryFn: () => fetchStatement({ data: { unit_id: unitId, from: from || undefined, to: to || undefined } }),
    enabled: !!unitId,
  });

  const rows = useMemo(() => {
    if (!stmt.data) return [];
    const r: any[] = [];
    for (const i of stmt.data.invoices ?? []) r.push({ date: i.created_at, ref: i.invoice_number, desc: i.description ?? "Invoice", debit: Number(i.amount), credit: 0 });
    for (const p of stmt.data.payments ?? []) {
      const applied = (p.payment_allocations ?? []).reduce((s: number, a: any) => s + Number(a.amount_applied), 0);
      r.push({ date: p.paid_at, ref: p.receipt_number, desc: `Payment (${p.payment_method})`, debit: 0, credit: applied });
    }
    for (const c of stmt.data.credits ?? []) r.push({ date: c.issued_at, ref: c.credit_note_number, desc: `Credit: ${c.reason ?? ""}`, debit: 0, credit: Number(c.amount) });
    r.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let bal = 0;
    return r.map((x) => { bal += x.debit - x.credit; return { ...x, balance: bal }; });
  }, [stmt.data]);

  async function downloadPdf() {
    const r = await genPdf({ data: { kind: "statement", id: unitId, unit_id: unitId, from: from || undefined, to: to || undefined } });
    downloadBase64Pdf(r.base64, r.filename);
  }

  const finalBalance = rows.length ? rows[rows.length - 1].balance : 0;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Customer Statements</h2>
        <p className="text-sm text-muted-foreground">Account history with running balance per customer.</p>
      </header>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label>Customer / Unit</Label>
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
        <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>

      {unitId && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <p className="text-xs text-muted-foreground">Outstanding balance</p>
              <p className="text-2xl font-bold">{money(finalBalance)}</p>
            </div>
            <Button onClick={downloadPdf}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                  <TableCell>{r.desc}</TableCell>
                  <TableCell className="text-right">{r.debit ? r.debit.toFixed(2) : ""}</TableCell>
                  <TableCell className="text-right">{r.credit ? r.credit.toFixed(2) : ""}</TableCell>
                  <TableCell className="text-right font-semibold">{r.balance.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No transactions</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
