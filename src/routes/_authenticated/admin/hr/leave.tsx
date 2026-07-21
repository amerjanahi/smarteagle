import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listLeaveRequests, listLeaveTypes, reviewLeaveRequest, createLeaveRequest, listEmployees } from "@/lib/hr.functions";
import { HrNav } from "./employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, X, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/hr/leave")({
  head: () => ({ meta: [{ title: "Leave — HR" }] }),
  component: Page,
});

function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1);
}

function Page() {
  const listFn = useServerFn(listLeaveRequests);
  const typesFn = useServerFn(listLeaveTypes);
  const empFn = useServerFn(listEmployees);
  const createFn = useServerFn(createLeaveRequest);
  const reviewFn = useServerFn(reviewLeaveRequest);
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", leave_type_id: "", from_date: "", to_date: "", reason: "" });

  const rows = useQuery({ queryKey: ["hr", "leave", status], queryFn: () => listFn({ data: { status: status || undefined } }) });
  const types = useQuery({ queryKey: ["hr", "leave-types"], queryFn: () => typesFn() });
  const employees = useQuery({ queryKey: ["hr", "employees"], queryFn: () => empFn() });

  const create = useMutation({
    mutationFn: () => createFn({ data: { ...form, days: daysBetween(form.from_date, form.to_date) } }),
    onSuccess: () => { toast.success("Request created"); setOpen(false); qc.invalidateQueries({ queryKey: ["hr", "leave"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const review = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" }) => reviewFn({ data: v }),
    onSuccess: () => { toast.success("Reviewed"); qc.invalidateQueries({ queryKey: ["hr", "leave"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <HrNav />
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Leave Requests</h2>
          <p className="text-sm text-muted-foreground">Approve or reject employee leave.</p>
        </div>
        <div className="flex gap-2">
          <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New Request</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Leave Request</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Employee</Label>
                  <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{employees.data?.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Leave Type</Label>
                  <Select value={form.leave_type_id} onValueChange={(v) => setForm({ ...form, leave_type_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{types.data?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>From</Label><Input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></div>
                <div><Label>To</Label><Input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></div>
                <div className="col-span-2 text-sm text-muted-foreground">Days: {daysBetween(form.from_date, form.to_date)}</div>
                <div className="col-span-2"><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              </div>
              <DialogFooter><Button disabled={!form.employee_id || !form.leave_type_id || !form.from_date || !form.to_date} onClick={() => create.mutate()}>Submit</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Employee</TableHead><TableHead>Type</TableHead>
            <TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead>
            <TableHead>Status</TableHead><TableHead>Reason</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.data?.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.employees?.full_name ?? "—"}</TableCell>
                <TableCell>{r.leave_types?.name}</TableCell>
                <TableCell>{r.from_date}</TableCell>
                <TableCell>{r.to_date}</TableCell>
                <TableCell>{r.days}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-xs">{r.reason ?? ""}</TableCell>
                <TableCell className="text-right">
                  {r.status === "pending" && (
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => review.mutate({ id: r.id, decision: "approved" })}><Check className="h-4 w-4 text-green-600" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => review.mutate({ id: r.id, decision: "rejected" })}><X className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!rows.data?.length && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No requests</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
