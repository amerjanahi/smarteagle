import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getMyEmployee, myLeaveBalances, listLeaveRequests, listPayslips, listAttendance, listLeaveTypes, createLeaveRequest } from "@/lib/hr.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/work")({
  head: () => ({ meta: [{ title: "My Work" }] }),
  component: Page,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Page() {
  const meFn = useServerFn(getMyEmployee);
  const balFn = useServerFn(myLeaveBalances);
  const reqFn = useServerFn(listLeaveRequests);
  const slipsFn = useServerFn(listPayslips);
  const attFn = useServerFn(listAttendance);
  const typesFn = useServerFn(listLeaveTypes);
  const createReq = useServerFn(createLeaveRequest);
  const qc = useQueryClient();

  const me = useQuery({ queryKey: ["me-emp"], queryFn: () => meFn() });
  const balances = useQuery({ queryKey: ["my-balances"], queryFn: () => balFn() });
  const requests = useQuery({ queryKey: ["my-requests"], queryFn: () => reqFn({ data: { mine: true } }) });
  const payslips = useQuery({ queryKey: ["my-payslips"], queryFn: () => slipsFn({ data: { mine: true } }) });
  const attendance = useQuery({ queryKey: ["my-att"], queryFn: () => attFn({ data: { employee_id: me.data?.id } }), enabled: !!me.data?.id });
  const types = useQuery({ queryKey: ["hr", "leave-types"], queryFn: () => typesFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type_id: "", from_date: "", to_date: "", reason: "" });

  const submit = useMutation({
    mutationFn: () => {
      const days = Math.max(1, Math.round((new Date(form.to_date).getTime() - new Date(form.from_date).getTime()) / 86400000) + 1);
      return createReq({ data: { ...form, employee_id: me.data!.id, days } });
    },
    onSuccess: () => { toast.success("Request submitted"); setOpen(false); qc.invalidateQueries({ queryKey: ["my-requests"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (me.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!me.data) return (
    <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
      You are not linked to an employee record yet. Ask your HR administrator to link your account.
    </div>
  );

  const emp = me.data;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>My Profile</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Name:</span> {emp.full_name}</div>
          <div><span className="text-muted-foreground">Emp No:</span> {emp.employee_no}</div>
          <div><span className="text-muted-foreground">Position:</span> {emp.position ?? "—"}</div>
          <div><span className="text-muted-foreground">Department:</span> {emp.department ?? "—"}</div>
          <div><span className="text-muted-foreground">Hire Date:</span> {emp.hire_date}</div>
          <div><span className="text-muted-foreground">Status:</span> {emp.employment_status}</div>
        </CardContent>
      </Card>

      <Tabs defaultValue="leave">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
        </TabsList>

        <TabsContent value="leave" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Balances</CardTitle>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Request Leave</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Type</Label>
                      <Select value={form.leave_type_id} onValueChange={(v) => setForm({ ...form, leave_type_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{types.data?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>From</Label><Input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></div>
                    <div><Label>To</Label><Input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button disabled={!form.leave_type_id || !form.from_date || !form.to_date} onClick={() => submit.mutate()}>Submit</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {balances.data?.map((b: any) => (
                  <div key={b.id} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">{b.leave_types?.name}</p>
                    <p className="text-lg font-semibold">{Number(b.entitled) - Number(b.used)} <span className="text-xs text-muted-foreground">/ {b.entitled}</span></p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>My Requests</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {requests.data?.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.leave_types?.name}</TableCell>
                      <TableCell>{r.from_date}</TableCell>
                      <TableCell>{r.to_date}</TableCell>
                      <TableCell>{r.days}</TableCell>
                      <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!requests.data?.length && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No requests</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Hours</TableHead></TableRow></TableHeader>
                <TableBody>
                  {attendance.data?.slice(0, 60).map((r: any) => (
                    <TableRow key={r.id}><TableCell>{r.date}</TableCell><TableCell><Badge variant="secondary">{r.status}</Badge></TableCell><TableCell>{r.hours ?? "—"}</TableCell></TableRow>
                  ))}
                  {!attendance.data?.length && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">No attendance</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payslips">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Basic</TableHead><TableHead>Allowances</TableHead><TableHead>Deductions</TableHead><TableHead>Net</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payslips.data?.map((r: any) => {
                    const cur = r.payroll_runs?.currency ?? "AED";
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{MONTHS[(r.payroll_runs?.period_month ?? 1) - 1]} {r.payroll_runs?.period_year}</TableCell>
                        <TableCell>{cur} {Number(r.basic).toFixed(2)}</TableCell>
                        <TableCell>{cur} {Number(r.allowances_total).toFixed(2)}</TableCell>
                        <TableCell>{cur} {Number(r.deductions_total).toFixed(2)}</TableCell>
                        <TableCell className="font-semibold">{cur} {Number(r.net_pay).toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!payslips.data?.length && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No payslips yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
