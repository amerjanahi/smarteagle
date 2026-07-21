import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listPayrollRuns, createPayrollRun, approvePayrollRun, markPayrollPaid } from "@/lib/hr.functions";
import { HrNav } from "./employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Send, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/hr/payroll")({
  head: () => ({ meta: [{ title: "Payroll — HR" }] }),
  component: Page,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Page() {
  const listFn = useServerFn(listPayrollRuns);
  const createFn = useServerFn(createPayrollRun);
  const approveFn = useServerFn(approvePayrollRun);
  const paidFn = useServerFn(markPayrollPaid);
  const qc = useQueryClient();
  const now = new Date();
  const [form, setForm] = useState({ period_month: now.getMonth() + 1, period_year: now.getFullYear(), notes: "" });
  const [open, setOpen] = useState(false);

  const runs = useQuery({ queryKey: ["hr", "runs"], queryFn: () => listFn() });
  const create = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => { toast.success("Run created — payslips generated"); setOpen(false); qc.invalidateQueries({ queryKey: ["hr", "runs"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { id } }),
    onSuccess: () => { toast.success("Approved & sent to Finance for review"); qc.invalidateQueries({ queryKey: ["hr", "runs"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const paid = useMutation({
    mutationFn: (id: string) => paidFn({ data: { id } }),
    onSuccess: () => { toast.success("Marked as paid"); qc.invalidateQueries({ queryKey: ["hr", "runs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <HrNav />
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Payroll</h2>
          <p className="text-sm text-muted-foreground">Monthly runs. Finance approves accounting entries separately.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New Run</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Payroll Run</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Month</Label><Input type="number" min={1} max={12} value={form.period_month} onChange={(e) => setForm({ ...form, period_month: Number(e.target.value) })} /></div>
              <div><Label>Year</Label><Input type="number" value={form.period_year} onChange={(e) => setForm({ ...form, period_year: Number(e.target.value) })} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button disabled={create.isPending} onClick={() => create.mutate()}>Generate Payslips</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Period</TableHead><TableHead>Employees</TableHead>
            <TableHead>Gross</TableHead><TableHead>Deductions</TableHead><TableHead>Net</TableHead>
            <TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {runs.data?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{MONTHS[r.period_month - 1]} {r.period_year}</TableCell>
                <TableCell>{r.employee_count}</TableCell>
                <TableCell>{r.currency} {Number(r.total_gross).toFixed(2)}</TableCell>
                <TableCell>{r.currency} {Number(r.total_deductions).toFixed(2)}</TableCell>
                <TableCell className="font-semibold">{r.currency} {Number(r.total_net).toFixed(2)}</TableCell>
                <TableCell><Badge variant={r.status === "paid" ? "default" : r.status === "posted" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Link to="/admin/hr/payslips" search={{ run_id: r.id } as any}>
                    <Button size="sm" variant="ghost">View Payslips</Button>
                  </Link>
                  {r.status === "draft" && <Button size="sm" onClick={() => approve.mutate(r.id)}><Send className="h-3 w-3 mr-1" /> Approve</Button>}
                  {r.status === "posted" && <Button size="sm" onClick={() => paid.mutate(r.id)}><DollarSign className="h-3 w-3 mr-1" /> Mark Paid</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!runs.data?.length && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No payroll runs</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
