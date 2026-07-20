import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Printer, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportCsv, exportExcel, printReport } from "@/lib/report-export";
import { VISITOR_TYPES, formatDuration, typeLabel } from "./shared";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "checked_in", label: "Checked in" },
  { value: "checked_out", label: "Checked out" },
  { value: "cancelled", label: "Cancelled" },
];

export function VisitorHistory() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [unitId, setUnitId] = useState("all");
  const [type, setType] = useState("all");
  const [plate, setPlate] = useState("");
  const [status, setStatus] = useState("all");
  const [staff, setStaff] = useState("all");
  const [search, setSearch] = useState("");
  const [blocked, setBlocked] = useState("all");
  const [detail, setDetail] = useState<any | null>(null);

  const { data: units = [] } = useQuery({
    queryKey: ["units-list"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id, unit_number, building").order("unit_number");
      return data ?? [];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["visitors-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitors")
        .select("id, visitor_name, visitor_phone, visitor_type, company, car_plate, expected_at, checked_in_at, checked_out_at, checked_in_by, approved_by, requested_by, status, blocked, gate_notes, unit_id, units(unit_number, building)")
        .order("expected_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const list = (data ?? []) as any[];
      const profileIds = Array.from(new Set(
        list.flatMap((r) => [r.checked_in_by, r.approved_by, r.requested_by]).filter(Boolean)
      ));
      let map = new Map<string, string>();
      if (profileIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", profileIds);
        map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return list.map((r) => ({
        ...r,
        gate_staff_name: r.checked_in_by ? map.get(r.checked_in_by) ?? "—" : "—",
        approval_source: r.approved_by
          ? (map.get(r.approved_by) ?? "Admin/Security")
          : (r.requested_by ? "Resident pre-registered" : "Walk-in"),
      }));
    },
  });

  const staffOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (r.checked_in_by) seen.set(r.checked_in_by, r.gate_staff_name);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const fromMs = from ? new Date(from).getTime() : null;
    const toMs = to ? new Date(to).getTime() + 86_400_000 : null;
    const s = search.trim().toLowerCase();
    const p = plate.trim().toLowerCase();
    return rows.filter((r: any) => {
      const t = r.expected_at ? new Date(r.expected_at).getTime() : 0;
      if (fromMs && t < fromMs) return false;
      if (toMs && t > toMs) return false;
      if (unitId !== "all" && r.unit_id !== unitId) return false;
      if (type !== "all" && r.visitor_type !== type) return false;
      if (status !== "all" && r.status !== status) return false;
      if (staff !== "all" && r.checked_in_by !== staff) return false;
      if (blocked === "blocked" && !r.blocked) return false;
      if (blocked === "allowed" && r.blocked) return false;
      if (p && !(r.car_plate ?? "").toLowerCase().includes(p)) return false;
      if (s) {
        const hay = `${r.visitor_name} ${r.visitor_phone ?? ""} ${r.company ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, from, to, unitId, type, status, staff, plate, search, blocked]);

  const exportRows = filtered.map((r: any) => ({
    entry: r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : "—",
    exit: r.checked_out_at ? new Date(r.checked_out_at).toLocaleString() : "—",
    duration: r.checked_in_at && r.checked_out_at
      ? formatDuration(new Date(r.checked_out_at).getTime() - new Date(r.checked_in_at).getTime())
      : "—",
    villa: r.units?.unit_number ?? "—",
    type: typeLabel(r.visitor_type),
    name: r.visitor_name,
    phone: r.visitor_phone ?? "",
    company: r.company ?? "",
    plate: r.car_plate ?? "",
    approval: r.approval_source,
    staff: r.gate_staff_name,
    status: r.blocked ? "Denied" : r.status,
    notes: r.gate_notes ?? "",
  }));
  const cols = [
    { key: "entry", label: "Entry" },
    { key: "exit", label: "Exit" },
    { key: "duration", label: "Duration" },
    { key: "villa", label: "Villa" },
    { key: "type", label: "Type" },
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "company", label: "Company" },
    { key: "plate", label: "Plate" },
    { key: "approval", label: "Approval source" },
    { key: "staff", label: "Gate staff" },
    { key: "status", label: "Status" },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <div><Label className="text-xs">Search name / phone / company</Label>
          <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label className="text-xs">Plate</Label><Input value={plate} onChange={(e) => setPlate(e.target.value)} /></div>
        <div><Label className="text-xs">Villa</Label>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All villas</SelectItem>
              {units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.building ? `${u.building} · ` : ""}{u.unit_number}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {VISITOR_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              <SelectItem value="__sep" disabled>──</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Gate staff</Label>
          <Select value={staff} onValueChange={setStaff}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
              {staffOptions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Access</Label>
          <Select value={blocked} onValueChange={setBlocked}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="allowed">Allowed</SelectItem>
              <SelectItem value="blocked">Denied / blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{filtered.length} of {rows.length} records</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCsv("visitor-history", cols, exportRows)}><Download className="mr-1 h-4 w-4" />CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportExcel("visitor-history", cols, exportRows)}><FileSpreadsheet className="mr-1 h-4 w-4" />Excel</Button>
          <Button size="sm" variant="outline" onClick={() => printReport("Visitor History", cols, exportRows)}><Printer className="mr-1 h-4 w-4" />PDF</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry</TableHead>
              <TableHead>Exit</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Villa</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Plate</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Gate staff</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">No matching records</TableCell></TableRow>
            )}
            {filtered.map((r: any) => {
              const durationMs = r.checked_in_at && r.checked_out_at
                ? new Date(r.checked_out_at).getTime() - new Date(r.checked_in_at).getTime() : null;
              return (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                  <TableCell className="text-xs">{r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-xs">{r.checked_out_at ? new Date(r.checked_out_at).toLocaleString() : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{durationMs !== null ? formatDuration(durationMs) : "—"}</TableCell>
                  <TableCell>{r.units?.unit_number ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{typeLabel(r.visitor_type)}</Badge></TableCell>
                  <TableCell>
                    <div className="font-medium">{r.visitor_name}</div>
                    <div className="text-xs text-muted-foreground">{r.company || r.visitor_phone || "—"}</div>
                  </TableCell>
                  <TableCell>{r.car_plate ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.approval_source}</TableCell>
                  <TableCell className="text-xs">{r.gate_staff_name}</TableCell>
                  <TableCell>
                    <Badge variant={r.blocked ? "destructive" : r.status === "cancelled" ? "outline" : "secondary"}>
                      {r.blocked ? "Denied" : r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Visit details</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Info label="Name" value={detail.visitor_name} />
                <Info label="Phone" value={detail.visitor_phone ?? "—"} />
                <Info label="Type" value={typeLabel(detail.visitor_type)} />
                <Info label="Company" value={detail.company ?? "—"} />
                <Info label="Villa" value={detail.units?.unit_number ?? "—"} />
                <Info label="Plate" value={detail.car_plate ?? "—"} />
                <Info label="Expected" value={detail.expected_at ? new Date(detail.expected_at).toLocaleString() : "—"} />
                <Info label="Entry" value={detail.checked_in_at ? new Date(detail.checked_in_at).toLocaleString() : "—"} />
                <Info label="Exit" value={detail.checked_out_at ? new Date(detail.checked_out_at).toLocaleString() : "—"} />
                <Info label="Gate staff" value={detail.gate_staff_name} />
                <Info label="Approval" value={detail.approval_source} />
                <Info label="Status" value={detail.blocked ? "Denied" : detail.status} />
              </div>
              {detail.gate_notes && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Notes</div>
                  <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-2 text-sm">{detail.gate_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
