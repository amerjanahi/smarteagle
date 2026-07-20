import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Users, AlertTriangle, Ban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { checkOutVisitor } from "@/lib/gate.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CRITICAL_STAY_HOURS, MAX_STAY_HOURS, VISITOR_TYPES, deriveLiveStatus, formatDuration, typeLabel } from "./shared";

export function LiveAccessBoard() {
  const qc = useQueryClient();
  const checkOut = useServerFn(checkOutVisitor);
  const [now, setNow] = useState(Date.now());
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel("visitors-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitors" }, () => {
        qc.invalidateQueries({ queryKey: ["visitors-live"] });
        qc.invalidateQueries({ queryKey: ["visitors-history"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data: rows = [] } = useQuery({
    queryKey: ["visitors-live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitors")
        .select("id, visitor_name, visitor_phone, visitor_type, company, car_plate, checked_in_at, checked_in_by, status, blocked, gate_notes, unit_id, units(unit_number, building)")
        .eq("status", "checked_in")
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as any[];
      const staffIds = Array.from(new Set(list.map((r) => r.checked_in_by).filter(Boolean)));
      let staffMap = new Map<string, string>();
      if (staffIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", staffIds);
        staffMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return list.map((r) => ({ ...r, gate_staff_name: r.checked_in_by ? staffMap.get(r.checked_in_by) ?? "—" : "—" }));
    },
  });

  const { data: deniedToday = 0 } = useQuery({
    queryKey: ["visitors-denied-today"],
    queryFn: async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("visitors")
        .select("id", { count: "exact", head: true })
        .eq("blocked", true)
        .gte("updated_at", startOfDay.toISOString());
      return count ?? 0;
    },
  });

  const filtered = useMemo(
    () => (typeFilter === "all" ? rows : rows.filter((r: any) => r.visitor_type === typeFilter)),
    [rows, typeFilter]
  );

  const overdueCount = useMemo(
    () => rows.filter((r: any) => deriveLiveStatus(r) === "Overdue").length,
    [rows, now] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const exitMut = useMutation({
    mutationFn: (visitorId: string) => checkOut({ data: { visitorId } }),
    onSuccess: () => {
      toast.success("Marked as exited");
      qc.invalidateQueries({ queryKey: ["visitors-live"] });
      qc.invalidateQueries({ queryKey: ["visitors-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Users className="h-4 w-4" />} label="Inside now" value={rows.length} />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} label="Overdue" value={overdueCount} />
        <StatCard icon={<Ban className="h-4 w-4 text-red-600" />} label="Denied today" value={deniedToday} />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {VISITOR_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">Max stay {MAX_STAY_HOURS}h · Auto-refresh</span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Name / Company</TableHead>
              <TableHead>Villa</TableHead>
              <TableHead>Plate</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Gate staff</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">No one currently inside</TableCell></TableRow>
            )}
            {filtered.map((v: any) => {
              const enteredAt = v.checked_in_at ? new Date(v.checked_in_at).getTime() : now;
              const ms = now - enteredAt;
              const hrs = ms / 3600000;
              const status = deriveLiveStatus(v);
              const rowCls = hrs > CRITICAL_STAY_HOURS ? "bg-red-50 dark:bg-red-950/30"
                : hrs > MAX_STAY_HOURS ? "bg-amber-50 dark:bg-amber-950/30" : "";
              return (
                <TableRow key={v.id} className={rowCls}>
                  <TableCell><Badge variant="outline">{typeLabel(v.visitor_type)}</Badge></TableCell>
                  <TableCell>
                    <div className="font-medium">{v.visitor_name}</div>
                    <div className="text-xs text-muted-foreground">{v.company || v.visitor_phone || "—"}</div>
                  </TableCell>
                  <TableCell>{v.units?.unit_number ? `${v.units.building ? v.units.building + " · " : ""}${v.units.unit_number}` : "—"}</TableCell>
                  <TableCell>{v.car_plate ?? "—"}</TableCell>
                  <TableCell className="text-xs">{v.checked_in_at ? new Date(v.checked_in_at).toLocaleString() : "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{formatDuration(ms)}</TableCell>
                  <TableCell className="text-sm">{v.gate_staff_name}</TableCell>
                  <TableCell>
                    <Badge variant={status === "Overdue" ? "destructive" : status === "Denied" ? "destructive" : "secondary"}>{status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={exitMut.isPending} onClick={() => exitMut.mutate(v.id)}>
                      <LogOut className="mr-1 h-3.5 w-3.5" />Mark exited
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
