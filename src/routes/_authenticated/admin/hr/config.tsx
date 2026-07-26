import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listAllowanceTypes, upsertAllowanceType, deleteAllowanceType,
  listDeductionTypes, upsertDeductionType, deleteDeductionType,
  listGrantTypes, upsertGrantType, deleteGrantType,
  listLeaveTypes, upsertLeaveType, deleteLeaveType,
  getSsConfig, upsertSsConfig,
} from "@/lib/hr.functions";
import { HrNav } from "./employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/hr/config")({
  head: () => ({ meta: [{ title: "HR Config" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="space-y-4">
      <HrNav />
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">HR Configuration</h2>
        <p className="text-sm text-muted-foreground">Manage allowance, deduction, grant, and leave types, plus social security rates.</p>
      </header>
      <Tabs defaultValue="allowances">
        <TabsList>
          <TabsTrigger value="allowances">Allowances</TabsTrigger>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
          <TabsTrigger value="grants">Grants</TabsTrigger>
          <TabsTrigger value="leave">Leave Types</TabsTrigger>
          <TabsTrigger value="ss">Social Security</TabsTrigger>
        </TabsList>
        <TabsContent value="allowances"><AllowancesTab /></TabsContent>
        <TabsContent value="deductions"><DeductionsTab /></TabsContent>
        <TabsContent value="grants"><GrantsTab /></TabsContent>
        <TabsContent value="leave"><LeaveTypesTab /></TabsContent>
        <TabsContent value="ss"><SsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function AllowancesTab() {
  const listFn = useServerFn(listAllowanceTypes);
  const saveFn = useServerFn(upsertAllowanceType);
  const delFn = useServerFn(deleteAllowanceType);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["hr", "allowance_types"], queryFn: () => listFn() });
  const [row, setRow] = useState({ code: "", name: "", default_amount: 0, is_taxable: true, is_active: true });
  const save = useMutation({
    mutationFn: (v: any) => saveFn({ data: v }),
    onSuccess: () => { toast.success("Saved"); setRow({ code: "", name: "", default_amount: 0, is_taxable: true, is_active: true }); qc.invalidateQueries({ queryKey: ["hr", "allowance_types"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["hr", "allowance_types"] }), onError: (e: any) => toast.error(e.message) });
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-6 gap-2 items-end">
        <div className="col-span-1"><Label>Code</Label><Input value={row.code} onChange={(e) => setRow({ ...row, code: e.target.value })} /></div>
        <div className="col-span-2"><Label>Name</Label><Input value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })} /></div>
        <div><Label>Default</Label><Input type="number" step="0.01" value={row.default_amount} onChange={(e) => setRow({ ...row, default_amount: Number(e.target.value) })} /></div>
        <div className="flex items-center gap-2"><Switch checked={row.is_taxable} onCheckedChange={(v) => setRow({ ...row, is_taxable: v })} /><Label>Taxable</Label></div>
        <Button size="sm" onClick={() => save.mutate(row)} disabled={!row.code || !row.name}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Default</TableHead><TableHead>Taxable</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {q.data?.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono">{r.code}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{Number(r.default_amount).toFixed(2)}</TableCell>
              <TableCell><Switch checked={r.is_taxable} onCheckedChange={(v) => save.mutate({ ...r, is_taxable: v })} /></TableCell>
              <TableCell><Switch checked={r.is_active} onCheckedChange={(v) => save.mutate({ ...r, is_active: v })} /></TableCell>
              <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DeductionsTab() {
  const listFn = useServerFn(listDeductionTypes);
  const saveFn = useServerFn(upsertDeductionType);
  const delFn = useServerFn(deleteDeductionType);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["hr", "deduction_types"], queryFn: () => listFn() });
  const [row, setRow] = useState({ code: "", name: "", default_amount: 0, is_statutory: false, is_active: true });
  const save = useMutation({
    mutationFn: (v: any) => saveFn({ data: v }),
    onSuccess: () => { toast.success("Saved"); setRow({ code: "", name: "", default_amount: 0, is_statutory: false, is_active: true }); qc.invalidateQueries({ queryKey: ["hr", "deduction_types"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["hr", "deduction_types"] }), onError: (e: any) => toast.error(e.message) });
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-6 gap-2 items-end">
        <div><Label>Code</Label><Input value={row.code} onChange={(e) => setRow({ ...row, code: e.target.value })} /></div>
        <div className="col-span-2"><Label>Name</Label><Input value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })} /></div>
        <div><Label>Default</Label><Input type="number" step="0.01" value={row.default_amount} onChange={(e) => setRow({ ...row, default_amount: Number(e.target.value) })} /></div>
        <div className="flex items-center gap-2"><Switch checked={row.is_statutory} onCheckedChange={(v) => setRow({ ...row, is_statutory: v })} /><Label>Statutory</Label></div>
        <Button size="sm" onClick={() => save.mutate(row)} disabled={!row.code || !row.name}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Default</TableHead><TableHead>Statutory</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {q.data?.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono">{r.code}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{Number(r.default_amount).toFixed(2)}</TableCell>
              <TableCell><Switch checked={r.is_statutory} onCheckedChange={(v) => save.mutate({ ...r, is_statutory: v })} /></TableCell>
              <TableCell><Switch checked={r.is_active} onCheckedChange={(v) => save.mutate({ ...r, is_active: v })} /></TableCell>
              <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GrantsTab() {
  const listFn = useServerFn(listGrantTypes);
  const saveFn = useServerFn(upsertGrantType);
  const delFn = useServerFn(deleteGrantType);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["hr", "grant_types"], queryFn: () => listFn() });
  const [row, setRow] = useState<any>({ code: "", name: "", calc_type: "fixed", rate_or_amount: 0, start_date: "", end_date: "", is_active: true });
  const save = useMutation({
    mutationFn: (v: any) => saveFn({ data: { ...v, start_date: v.start_date || null, end_date: v.end_date || null } }),
    onSuccess: () => { toast.success("Saved"); setRow({ code: "", name: "", calc_type: "fixed", rate_or_amount: 0, start_date: "", end_date: "", is_active: true }); qc.invalidateQueries({ queryKey: ["hr", "grant_types"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["hr", "grant_types"] }), onError: (e: any) => toast.error(e.message) });
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-7 gap-2 items-end">
        <div><Label>Code</Label><Input value={row.code} onChange={(e) => setRow({ ...row, code: e.target.value })} /></div>
        <div className="col-span-2"><Label>Name</Label><Input value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })} /></div>
        <div><Label>Type</Label>
          <Select value={row.calc_type} onValueChange={(v) => setRow({ ...row, calc_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="rate">Rate %</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Rate / Amt</Label><Input type="number" step="0.0001" value={row.rate_or_amount} onChange={(e) => setRow({ ...row, rate_or_amount: Number(e.target.value) })} /></div>
        <div><Label>Start</Label><Input type="date" value={row.start_date} onChange={(e) => setRow({ ...row, start_date: e.target.value })} /></div>
        <div><Label>End</Label><Input type="date" value={row.end_date} onChange={(e) => setRow({ ...row, end_date: e.target.value })} /></div>
      </div>
      <Button size="sm" onClick={() => save.mutate(row)} disabled={!row.code || !row.name}><Plus className="h-4 w-4 mr-1" />Add Grant Type</Button>
      <Table>
        <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Rate/Amt</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {q.data?.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono">{r.code}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.calc_type}</TableCell>
              <TableCell>{r.calc_type === "rate" ? `${(Number(r.rate_or_amount) * 100).toFixed(2)}%` : Number(r.rate_or_amount).toFixed(2)}</TableCell>
              <TableCell>{r.start_date ?? "—"}</TableCell>
              <TableCell>{r.end_date ?? "—"}</TableCell>
              <TableCell><Switch checked={r.is_active} onCheckedChange={(v) => save.mutate({ ...r, is_active: v })} /></TableCell>
              <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LeaveTypesTab() {
  const listFn = useServerFn(listLeaveTypes);
  const saveFn = useServerFn(upsertLeaveType);
  const delFn = useServerFn(deleteLeaveType);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["hr", "leave-types-all"], queryFn: () => listFn() });
  const [row, setRow] = useState<any>({ code: "", name: "", days_per_year: 0, paid: true, carry_forward: false, max_carry_days: 0, requires_document: false, allow_half_day: false, is_active: true });
  const save = useMutation({
    mutationFn: (v: any) => saveFn({ data: v }),
    onSuccess: () => { toast.success("Saved"); setRow({ code: "", name: "", days_per_year: 0, paid: true, carry_forward: false, max_carry_days: 0, requires_document: false, allow_half_day: false, is_active: true }); qc.invalidateQueries({ queryKey: ["hr", "leave-types-all"] }); qc.invalidateQueries({ queryKey: ["hr", "leave-types"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["hr", "leave-types-all"] }), onError: (e: any) => toast.error(e.message) });
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-8 gap-2 items-end">
        <div><Label>Code</Label><Input value={row.code} onChange={(e) => setRow({ ...row, code: e.target.value })} /></div>
        <div className="col-span-2"><Label>Name</Label><Input value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })} /></div>
        <div><Label>Days/Yr</Label><Input type="number" step="0.5" value={row.days_per_year} onChange={(e) => setRow({ ...row, days_per_year: Number(e.target.value) })} /></div>
        <div className="flex items-center gap-1"><Switch checked={row.paid} onCheckedChange={(v) => setRow({ ...row, paid: v })} /><Label>Paid</Label></div>
        <div className="flex items-center gap-1"><Switch checked={row.carry_forward} onCheckedChange={(v) => setRow({ ...row, carry_forward: v })} /><Label>Carry</Label></div>
        <div><Label>Max Carry</Label><Input type="number" step="0.5" value={row.max_carry_days} onChange={(e) => setRow({ ...row, max_carry_days: Number(e.target.value) })} /></div>
        <Button size="sm" onClick={() => save.mutate(row)} disabled={!row.code || !row.name}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <label className="flex items-center gap-1"><Switch checked={row.requires_document} onCheckedChange={(v) => setRow({ ...row, requires_document: v })} /> Requires document</label>
        <label className="flex items-center gap-1"><Switch checked={row.allow_half_day} onCheckedChange={(v) => setRow({ ...row, allow_half_day: v })} /> Allow half-day</label>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Days/Yr</TableHead>
          <TableHead>Paid</TableHead><TableHead>Carry</TableHead><TableHead>Max Carry</TableHead>
          <TableHead>Doc</TableHead><TableHead>Half</TableHead><TableHead>Active</TableHead><TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {q.data?.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono">{r.code}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.days_per_year}</TableCell>
              <TableCell><Switch checked={r.paid} onCheckedChange={(v) => save.mutate({ ...r, paid: v })} /></TableCell>
              <TableCell><Switch checked={r.carry_forward} onCheckedChange={(v) => save.mutate({ ...r, carry_forward: v })} /></TableCell>
              <TableCell>{r.max_carry_days}</TableCell>
              <TableCell><Switch checked={r.requires_document} onCheckedChange={(v) => save.mutate({ ...r, requires_document: v })} /></TableCell>
              <TableCell><Switch checked={r.allow_half_day} onCheckedChange={(v) => save.mutate({ ...r, allow_half_day: v })} /></TableCell>
              <TableCell><Switch checked={r.is_active} onCheckedChange={(v) => save.mutate({ ...r, is_active: v })} /></TableCell>
              <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SsTab() {
  const getFn = useServerFn(getSsConfig);
  const saveFn = useServerFn(upsertSsConfig);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["hr", "ss-config"], queryFn: () => getFn() });
  const [row, setRow] = useState<any>(null);
  const active = row ?? q.data ?? { scheme_name: "default", employee_rate: 0, employer_rate: 0, cap_amount: null, effective_from: new Date().toISOString().slice(0, 10), is_active: true };
  const save = useMutation({
    mutationFn: () => saveFn({ data: { ...active, employee_rate: Number(active.employee_rate), employer_rate: Number(active.employer_rate), cap_amount: active.cap_amount ? Number(active.cap_amount) : null } }),
    onSuccess: () => { toast.success("Saved"); setRow(null); qc.invalidateQueries({ queryKey: ["hr", "ss-config"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Scheme name</Label><Input value={active.scheme_name} onChange={(e) => setRow({ ...active, scheme_name: e.target.value })} /></div>
        <div><Label>Effective from</Label><Input type="date" value={active.effective_from} onChange={(e) => setRow({ ...active, effective_from: e.target.value })} /></div>
        <div><Label>Employee rate (0–1)</Label><Input type="number" step="0.0001" value={active.employee_rate} onChange={(e) => setRow({ ...active, employee_rate: Number(e.target.value) })} /></div>
        <div><Label>Employer rate (0–1)</Label><Input type="number" step="0.0001" value={active.employer_rate} onChange={(e) => setRow({ ...active, employer_rate: Number(e.target.value) })} /></div>
        <div><Label>Cap amount (optional)</Label><Input type="number" step="0.01" value={active.cap_amount ?? ""} onChange={(e) => setRow({ ...active, cap_amount: e.target.value ? Number(e.target.value) : null })} /></div>
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-1" />Save</Button>
      <p className="text-xs text-muted-foreground">Applied to (Basic + Allowances), capped at Cap Amount when set. Employee share deducted from net; employer share tracked for reporting.</p>
    </div>
  );
}
