import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listEmployees, upsertEmployee, deleteEmployee,
} from "@/lib/hr.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, CalendarCheck, Plane, Wallet, FileText, Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/hr/employees")({
  head: () => ({ meta: [{ title: "Employees — HR" }] }),
  component: EmployeesPage,
});

const emptyEmp = {
  id: undefined as string | undefined,
  employee_no: "",
  full_name: "",
  email: "",
  phone: "",
  national_id: "",
  position: "",
  department: "",
  hire_date: new Date().toISOString().slice(0, 10),
  employment_status: "active" as "active" | "on_leave" | "terminated" | "suspended",
  basic_salary: 0,
  currency: "AED",
  notes: "",
  allowances: [] as { label: string; amount: number }[],
  deductions: [] as { label: string; amount: number }[],
};

export function HrNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/admin/hr/employees", label: "Employees", icon: Users },
    { to: "/admin/hr/attendance", label: "Attendance", icon: CalendarCheck },
    { to: "/admin/hr/leave", label: "Leave", icon: Plane },
    { to: "/admin/hr/payroll", label: "Payroll", icon: Wallet },
    { to: "/admin/hr/payslips", label: "Payslips", icon: FileText },
    { to: "/admin/hr/config", label: "Config", icon: Settings },
  ];
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-3">
      {items.map((i) => (
        <Link key={i.to} to={i.to}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${path === i.to ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
          <i.icon className="h-4 w-4" /> {i.label}
        </Link>
      ))}
    </div>
  );
}

function EmployeesPage() {
  const list = useServerFn(listEmployees);
  const save = useServerFn(upsertEmployee);
  const del = useServerFn(deleteEmployee);
  const qc = useQueryClient();
  const employees = useQuery({ queryKey: ["hr", "employees"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyEmp);

  const saveMut = useMutation({
    mutationFn: () => save({ data: form as any }),
    onSuccess: () => {
      toast.success("Employee saved");
      setOpen(false); setForm(emptyEmp);
      qc.invalidateQueries({ queryKey: ["hr", "employees"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["hr", "employees"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  function edit(e: any) {
    setForm({
      ...emptyEmp, ...e,
      allowances: (e.allowances as any) || [],
      deductions: (e.deductions as any) || [],
      email: e.email ?? "",
      basic_salary: Number(e.basic_salary),
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <HrNav />
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Employees</h2>
          <p className="text-sm text-muted-foreground">Manage staff records, roles, and pay.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(emptyEmp); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Employee</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} Employee</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Employee No *</Label><Input value={form.employee_no} onChange={(e) => setForm({ ...form, employee_no: e.target.value })} /></div>
              <div><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>National ID</Label><Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} /></div>
              <div><Label>Position</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
              <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
              <div><Label>Hire Date *</Label><Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.employment_status} onValueChange={(v: any) => setForm({ ...form, employment_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Basic Salary *</Label><Input type="number" step="0.01" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: Number(e.target.value) })} /></div>
              <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Emp No</TableHead><TableHead>Name</TableHead>
            <TableHead>Position</TableHead><TableHead>Department</TableHead>
            <TableHead>Status</TableHead><TableHead>Basic</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {employees.data?.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono">{e.employee_no}</TableCell>
                <TableCell className="font-medium">{e.full_name}</TableCell>
                <TableCell>{e.position ?? "—"}</TableCell>
                <TableCell>{e.department ?? "—"}</TableCell>
                <TableCell><Badge variant={e.employment_status === "active" ? "default" : "secondary"}>{e.employment_status}</Badge></TableCell>
                <TableCell>{e.currency} {Number(e.basic_salary).toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => edit(e)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Delete this employee?") && delMut.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!employees.data?.length && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No employees</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
