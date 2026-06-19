import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAuditLog } from "@/lib/sales.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Log — Hayy Admin" }] }),
  component: AuditPage,
});

function AuditPage() {
  const fetchLog = useServerFn(listAuditLog);
  const [table, setTable] = useState<string>("");

  const log = useQuery({
    queryKey: ["audit", table],
    queryFn: () => fetchLog({ data: { table: table || undefined, limit: 200 } }),
  });

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Audit Log</h2>
        <p className="text-sm text-muted-foreground">Every sales change — who, what, when.</p>
      </header>

      <div className="flex items-end gap-3 rounded-xl border border-border bg-card p-3">
        <div className="w-64">
          <Label>Filter by table</Label>
          <Select value={table || "all"} onValueChange={(v) => setTable(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sales tables</SelectItem>
              <SelectItem value="invoices">Invoices</SelectItem>
              <SelectItem value="payments">Payments</SelectItem>
              <SelectItem value="credit_notes">Credit notes</SelectItem>
              <SelectItem value="payment_allocations">Payment allocations</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Actor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {log.data?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.table_name}</TableCell>
                <TableCell><Badge variant={r.action === "delete" ? "destructive" : "secondary"}>{r.action}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{r.record_id?.slice(0, 8)}</TableCell>
                <TableCell className="font-mono text-xs">{r.actor_user_id?.slice(0, 8) ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!log.data?.length && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No audit entries</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
