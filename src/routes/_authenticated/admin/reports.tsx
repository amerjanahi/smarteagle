import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { financeReport } from "@/lib/reports.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer, TrendingUp, TrendingDown, Wallet, FileText } from "lucide-react";

import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Finance Reports — Hayy Admin" }] }),
  component: ReportsPage,
});

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() { return new Date().toISOString().slice(0, 10); }

function toCsv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}
function download(name: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const run = useServerFn(financeReport);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["finance-report", from, to],
    queryFn: () => run({ data: { from, to } }),
    enabled: !!from && !!to,
  });

  function setPreset(kind: "month" | "quarter" | "year" | "ytd") {
    const now = new Date();
    let f = new Date();
    if (kind === "month") f = new Date(now.getFullYear(), now.getMonth(), 1);
    if (kind === "quarter") f = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    if (kind === "year") f = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    if (kind === "ytd") f = new Date(now.getFullYear(), 0, 1);
    setFrom(f.toISOString().slice(0, 10));
    setTo(today());
  }

  function exportCsv() {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Finance Report", `${data.range.from} to ${data.range.to}`],
      [],
      ["Income Summary"],
      ["Invoiced", data.income.invoiced],
      ["Collected", data.income.collected],
      ["Outstanding", data.income.outstanding],
      ["Invoices", data.income.invoice_count],
      ["Payments", data.income.payment_count],
      [],
      ["Expenses"],
      ["Total", data.expenses.total],
      ["Count", data.expenses.count],
      [],
      ["Net Cash (Collected - Expenses)", data.net],
      [],
      ["Expenses by Category"],
      ["Category", "Amount"],
      ...data.expenses.by_category.map((c) => [c.category, c.amount]),
      [],
      ["AR Aging (as of end date)"],
      ["Bucket", "Count", "Amount"],
      ...data.aging.map((a) => [a.bucket, a.count, a.amount]),
      [],
      ["Collections by Method"],
      ["Method", "Count", "Amount"],
      ...data.collections_by_method.map((c) => [c.method, c.count, c.amount]),
      [],
      ["Monthly Trend"],
      ["Month", "Invoiced", "Collected", "Expenses"],
      ...data.monthly.map((m) => [m.month, m.invoiced, m.collected, m.expenses]),
    ];
    download(`finance-report_${data.range.from}_to_${data.range.to}.csv`, toCsv(rows));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Finance Reports</h2>
          <p className="text-sm text-muted-foreground">Income, expenses, receivables and cash trends for any period.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
          <Button variant="outline" size="sm" onClick={() => setPreset("month")}>This Month</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset("quarter")}>3M</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset("ytd")}>YTD</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset("year")}>12M</Button>
          <Button size="sm" onClick={() => refetch()} disabled={isFetching}>{isFetching ? "Loading…" : "Run"}</Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()} disabled={!data}><Printer className="mr-2 h-4 w-4" />Print</Button>
        </div>
      </header>

      {!data ? (
        <p className="text-sm text-muted-foreground">Pick a date range and click Run.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={FileText} label="Invoiced" value={money(data.income.invoiced)} sub={`${data.income.invoice_count} invoices`} />
            <StatCard icon={TrendingUp} label="Collected" value={money(data.income.collected)} sub={`${data.income.payment_count} payments`} />
            <StatCard icon={Wallet} label="Expenses" value={money(data.expenses.total)} sub={`${data.expenses.count} entries`} />
            <StatCard icon={data.net >= 0 ? TrendingUp : TrendingDown} label="Net Cash" value={money(data.net)} sub="Collected − Expenses" tone={data.net >= 0 ? "pos" : "neg"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">AR Aging (as of {data.range.to})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Bucket</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.aging.map((a) => (
                      <TableRow key={a.bucket}>
                        <TableCell className="font-medium">{a.bucket}</TableCell>
                        <TableCell className="text-right">{a.count}</TableCell>
                        <TableCell className={`text-right ${a.bucket === "90+" ? "text-red-600 font-semibold" : ""}`}>{money(a.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">Total Outstanding</TableCell>
                      <TableCell className="text-right font-bold">{data.aging.reduce((s, a) => s + a.count, 0)}</TableCell>
                      <TableCell className="text-right font-bold">{money(data.aging.reduce((s, a) => s + a.amount, 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Collections by Method</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Count</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.collections_by_method.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No payments in range</TableCell></TableRow>
                    ) : data.collections_by_method.map((c) => (
                      <TableRow key={c.method}>
                        <TableCell className="font-medium capitalize">{c.method}</TableCell>
                        <TableCell className="text-right">{c.count}</TableCell>
                        <TableCell className="text-right">{money(c.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Expenses by Category</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">% of Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.expenses.by_category.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No expenses in range</TableCell></TableRow>
                    ) : data.expenses.by_category.map((c) => (
                      <TableRow key={c.category}>
                        <TableCell className="font-medium capitalize">{c.category.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-right">{money(c.amount)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{data.expenses.total ? ((c.amount / data.expenses.total) * 100).toFixed(1) : "0"}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Monthly Trend</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Invoiced</TableHead><TableHead className="text-right">Collected</TableHead><TableHead className="text-right">Expenses</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.monthly.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No activity in range</TableCell></TableRow>
                    ) : data.monthly.map((m) => {
                      const net = m.collected - m.expenses;
                      return (
                        <TableRow key={m.month}>
                          <TableCell className="font-medium">{m.month}</TableCell>
                          <TableCell className="text-right">{money(m.invoiced)}</TableCell>
                          <TableCell className="text-right">{money(m.collected)}</TableCell>
                          <TableCell className="text-right">{money(m.expenses)}</TableCell>
                          <TableCell className={`text-right font-semibold ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>{money(net)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${tone === "neg" ? "text-red-600" : tone === "pos" ? "text-emerald-600" : "text-muted-foreground"}`} />
        </div>
        <p className={`mt-1 text-2xl font-bold ${tone === "neg" ? "text-red-600" : tone === "pos" ? "text-emerald-600" : ""}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
