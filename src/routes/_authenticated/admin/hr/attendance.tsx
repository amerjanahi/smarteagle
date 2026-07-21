import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listAttendance, upsertAttendance, listEmployees } from "@/lib/hr.functions";
import { HrNav } from "./employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/hr/attendance")({
  head: () => ({ meta: [{ title: "Attendance — HR" }] }),
  component: Page,
});

function Page() {
  const listFn = useServerFn(listAttendance);
  const empFn = useServerFn(listEmployees);
  const saveFn = useServerFn(upsertAttendance);
  const qc = useQueryClient();
  const [filter, setFilter] = useState({ employee_id: "", from: "", to: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "", date: new Date().toISOString().slice(0, 10),
    check_in: "", check_out: "", hours: 0, status: "present" as const, notes: "",
  });

  const employees = useQuery({ queryKey: ["hr", "employees"], queryFn: () => empFn() });
  const rows = useQuery({
    queryKey: ["hr", "attendance", filter],
    queryFn: () => listFn({ data: { employee_id: filter.employee_id || undefined, from: filter.from || undefined, to: filter.to || undefined } }),
  });

  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      ...form,
      check_in: form.check_in || null,
      check_out: form.check_out || null,
      hours: form.hours || null,
    } as any }),
    onSuccess: () => { toast.success("Saved"); setOpen(false); qc.invalidateQueries({ queryKey: ["hr", "attendance"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <HrNav />
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Attendance</h2>
          <p className="text-sm text-muted-foreground">Manual daily entries.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Entry</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Attendance</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Employee</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{employees.data?.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="leave">Leave</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="weekend">Weekend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Check In</Label><Input type="time" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} /></div>
              <div><Label>Check Out</Label><Input type="time" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} /></div>
              <div><Label>Hours</Label><Input type="number" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.employee_id || save.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex gap-3 rounded-xl border border-border bg-card p-3">
        <div className="w-64">
          <Label>Employee</Label>
          <Select value={filter.employee_id || "all"} onValueChange={(v) => setFilter({ ...filter, employee_id: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {employees.data?.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>From</Label><Input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} /></div>
        <div><Label>To</Label><Input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} /></div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Status</TableHead><TableHead>In</TableHead><TableHead>Out</TableHead><TableHead>Hours</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.data?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.employees?.full_name ?? "—"}</TableCell>
                <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                <TableCell>{r.check_in ?? "—"}</TableCell>
                <TableCell>{r.check_out ?? "—"}</TableCell>
                <TableCell>{r.hours ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.notes ?? ""}</TableCell>
              </TableRow>
            ))}
            {!rows.data?.length && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No records</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
