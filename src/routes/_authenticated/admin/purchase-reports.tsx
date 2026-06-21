import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { agingReport, vendorStatement, listVendors } from "@/lib/purchases.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/purchase-reports")({
  head: () => ({ meta: [{ title: "Purchase Reports — Hayy Admin" }] }),
  component: PurchaseReports,
});

const money = (n: number) => `AED ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PurchaseReports() {
  const fetchAging = useServerFn(agingReport);
  const fetchVendors = useServerFn(listVendors);
  const fetchStatement = useServerFn(vendorStatement);
  const { data: aging = [] } = useQuery({ queryKey: ["aging"], queryFn: () => fetchAging() });
  const { data: vendors = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => fetchVendors() });
  const [vendorId, setVendorId] = useState<string>("");
  const { data: stmt } = useQuery({
    queryKey: ["vendor-statement", vendorId],
    queryFn: () => fetchStatement({ data: { vendor_id: vendorId } }),
    enabled: !!vendorId,
  });

  function printStatement() {
    if (!stmt) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const rows = stmt.lines.map((l: any) =>
      `<tr><td>${l.date}</td><td>${l.type}</td><td>${l.ref}</td><td class="r">${money(l.debit)}</td><td class="r">${money(l.credit)}</td><td class="r">${money(l.balance)}</td></tr>`
    ).join("");
    w.document.write(`<html><head><title>Vendor Statement</title>
      <style>body{font-family:system-ui;padding:32px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ddd;padding:8px;text-align:left}.r{text-align:right}</style>
      </head><body>
      <h1>Vendor Statement — ${stmt.vendor?.name ?? ""}</h1>
      <p>Closing balance: <b>${money(stmt.balance)}</b></p>
      <table><thead><tr><th>Date</th><th>Type</th><th>Ref</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Balance</th></tr></thead><tbody>${rows}</tbody></table>
      <script>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Purchase Reports</h2>
        <p className="text-sm text-muted-foreground">Vendor statements and aging analysis.</p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-sm">Aging Report (Accounts Payable)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Vendor</TableHead><TableHead>Current</TableHead><TableHead>1-30</TableHead><TableHead>31-60</TableHead><TableHead>61-90</TableHead><TableHead>90+</TableHead><TableHead>Total</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {aging.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nothing outstanding</TableCell></TableRow> :
                aging.map((r: any) => (
                  <TableRow key={r.vendor}>
                    <TableCell className="font-medium">{r.vendor}</TableCell>
                    <TableCell>{money(r.current)}</TableCell>
                    <TableCell>{money(r.d30)}</TableCell>
                    <TableCell>{money(r.d60)}</TableCell>
                    <TableCell>{money(r.d90)}</TableCell>
                    <TableCell className="text-red-600">{money(r.d90plus)}</TableCell>
                    <TableCell className="font-semibold">{money(r.total)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Vendor Statement</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Pick vendor" /></SelectTrigger>
              <SelectContent>{vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={printStatement} disabled={!stmt}><Download className="mr-2 h-4 w-4" />PDF</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!stmt ? <p className="text-sm text-muted-foreground">Pick a vendor to view their statement.</p> : (
            <>
              <p className="text-sm text-muted-foreground mb-2">Closing balance: <b>{money(stmt.balance)}</b></p>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Ref</TableHead><TableHead>Debit</TableHead><TableHead>Credit</TableHead><TableHead>Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {stmt.lines.map((l: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{l.date}</TableCell><TableCell>{l.type}</TableCell><TableCell className="font-mono text-xs">{l.ref}</TableCell>
                      <TableCell>{money(l.debit)}</TableCell><TableCell>{money(l.credit)}</TableCell><TableCell>{money(l.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
