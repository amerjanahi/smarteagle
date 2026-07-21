import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPayslips } from "@/lib/hr.functions";
import { HrNav } from "./employees";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/hr/payslips")({
  head: () => ({ meta: [{ title: "Payslips — HR" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ run_id: (s.run_id as string) || undefined }),
  component: Page,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Page() {
  const { run_id } = Route.useSearch();
  const fn = useServerFn(listPayslips);
  const rows = useQuery({ queryKey: ["hr", "payslips", run_id ?? "all"], queryFn: () => fn({ data: { run_id } }) });

  return (
    <div className="space-y-4">
      <HrNav />
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Payslips</h2>
        <p className="text-sm text-muted-foreground">
          {run_id ? "Payslips for the selected run." : "All payslips across every run."}
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Period</TableHead><TableHead>Employee</TableHead><TableHead>Position</TableHead>
            <TableHead>Basic</TableHead><TableHead>Allowances</TableHead><TableHead>Deductions</TableHead>
            <TableHead>Net</TableHead><TableHead>Days W/A/L</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.data?.map((r: any) => {
              const cur = r.payroll_runs?.currency ?? "AED";
              return (
                <TableRow key={r.id}>
                  <TableCell>{MONTHS[(r.payroll_runs?.period_month ?? 1) - 1]} {r.payroll_runs?.period_year}</TableCell>
                  <TableCell className="font-medium">{r.employees?.full_name}</TableCell>
                  <TableCell>{r.employees?.position ?? "—"}</TableCell>
                  <TableCell>{cur} {Number(r.basic).toFixed(2)}</TableCell>
                  <TableCell>{cur} {Number(r.allowances_total).toFixed(2)}</TableCell>
                  <TableCell>{cur} {Number(r.deductions_total).toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">{cur} {Number(r.net_pay).toFixed(2)}</TableCell>
                  <TableCell className="text-xs">{r.days_worked}/{r.days_absent}/{r.days_leave}</TableCell>
                </TableRow>
              );
            })}
            {!rows.data?.length && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No payslips</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
