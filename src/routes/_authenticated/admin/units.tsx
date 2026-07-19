import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, Home, Users, KeyRound, Wallet, Columns3, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { UnitFormDialog, type UnitFormValues } from "@/components/admin/UnitFormDialog";
import { ConfirmDeleteDialog } from "@/components/admin/ConfirmDeleteDialog";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/_authenticated/admin/units")({
  head: () => ({ meta: [{ title: "Units — Hayy Admin" }] }),
  component: UnitsPage,
});

let CURRENT_MONEY: (n: number | null | undefined) => string = (n) =>
  n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const fmtBHD = (n: number | null | undefined) => CURRENT_MONEY(n);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

type Unit = {
  id: string;
  building: string | null;
  unit_number: string;
  floor: number | null;
  bedrooms: number | null;
  area_sqm: number | null;
  land_area_sqm: number | null;
  built_up_area_sqm: number | null;
  monthly_service_charge: number | null;
  handover_date: string | null;
  is_occupied: boolean;
  notes: string | null;
};

type Resident = {
  id: string;
  unit_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  resident_type: string;
  move_in_date: string | null;
  is_active: boolean;
};

const PAGE_SIZE = 100;

type ColumnKey =
  | "unit_number" | "building" | "floor" | "bedrooms"
  | "land_area_sqm" | "built_up_area_sqm" | "monthly_service_charge"
  | "handover_date" | "is_occupied";

type ColumnDef = {
  key: ColumnKey;
  label: string;
  align?: "left" | "right";
  required?: boolean;
  render: (u: Unit) => React.ReactNode;
};

const COLUMNS: ColumnDef[] = [
  { key: "unit_number", label: "Unit", required: true, render: (u) => <span className="font-medium">{u.unit_number}</span> },
  { key: "building", label: "Building", render: (u) => <span className="text-muted-foreground">{u.building ?? "—"}</span> },
  { key: "floor", label: "Floor", align: "right", render: (u) => u.floor ?? "—" },
  { key: "bedrooms", label: "BR", align: "right", render: (u) => u.bedrooms ?? "—" },
  { key: "land_area_sqm", label: "Land (m²)", align: "right", render: (u) => u.land_area_sqm ?? "—" },
  { key: "built_up_area_sqm", label: "Built-up (m²)", align: "right", render: (u) => u.built_up_area_sqm ?? u.area_sqm ?? "—" },
  { key: "monthly_service_charge", label: "Service charge", align: "right", render: (u) => fmtBHD(u.monthly_service_charge) },
  { key: "handover_date", label: "Handover", render: (u) => <span className="text-muted-foreground">{fmtDate(u.handover_date)}</span> },
  {
    key: "is_occupied", label: "Status",
    render: (u) => (
      <Badge variant={u.is_occupied ? "default" : "secondary"} className={cn(u.is_occupied ? "bg-emerald-600 hover:bg-emerald-600" : "")}>
        {u.is_occupied ? "Occupied" : "Vacant"}
      </Badge>
    ),
  },
];

const DEFAULT_VISIBLE: ColumnKey[] = COLUMNS.map((c) => c.key);
const STORAGE_KEY = "admin.units.columns.v1";

function loadVisible(): ColumnKey[] {
  if (typeof window === "undefined") return DEFAULT_VISIBLE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE;
    const parsed = JSON.parse(raw) as ColumnKey[];
    const valid = parsed.filter((k) => COLUMNS.some((c) => c.key === k));
    const required = COLUMNS.filter((c) => c.required).map((c) => c.key);
    return Array.from(new Set([...required, ...valid]));
  } catch {
    return DEFAULT_VISIBLE;
  }
}

type SortKey = "unit_number" | "building" | "floor" | "bedrooms" | "monthly_service_charge" | "handover_date";
const SORT_OPTIONS: { value: string; label: string; key: SortKey; asc: boolean }[] = [
  { value: "unit_asc", label: "Unit number (A→Z)", key: "unit_number", asc: true },
  { value: "unit_desc", label: "Unit number (Z→A)", key: "unit_number", asc: false },
  { value: "building_asc", label: "Building (A→Z)", key: "building", asc: true },
  { value: "floor_asc", label: "Floor (low→high)", key: "floor", asc: true },
  { value: "floor_desc", label: "Floor (high→low)", key: "floor", asc: false },
  { value: "bedrooms_desc", label: "Bedrooms (most)", key: "bedrooms", asc: false },
  { value: "charge_desc", label: "Service charge (high→low)", key: "monthly_service_charge", asc: false },
  { value: "charge_asc", label: "Service charge (low→high)", key: "monthly_service_charge", asc: true },
  { value: "handover_desc", label: "Handover (newest)", key: "handover_date", asc: false },
  { value: "handover_asc", label: "Handover (oldest)", key: "handover_date", asc: true },
];

function UnitsPage() {
  const [search, setSearch] = useState("");
  const [building, setBuilding] = useState<string>("all");
  const [occupancy, setOccupancy] = useState<"all" | "occupied" | "vacant">("all");
  const [sort, setSort] = useState<string>("building_asc");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState<ColumnKey[]>(() => loadVisible());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UnitFormValues | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Unit deleted");
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["units-stats"] });
      setDeletingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openAdd() { setEditing(null); setFormOpen(true); }
  function openEdit(u: Unit) {
    setEditing({
      id: u.id,
      building: u.building,
      unit_number: u.unit_number,
      floor: u.floor,
      bedrooms: u.bedrooms,
      land_area_sqm: u.land_area_sqm,
      built_up_area_sqm: u.built_up_area_sqm,
      monthly_service_charge: u.monthly_service_charge,
      handover_date: u.handover_date,
      notes: u.notes,
    });
    setFormOpen(true);
  }

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visible)); } catch { /* ignore */ }
  }, [visible]);

  const visibleSet = useMemo(() => new Set(visible), [visible]);
  const activeColumns = useMemo(() => COLUMNS.filter((c) => visibleSet.has(c.key)), [visibleSet]);

  function toggleColumn(key: ColumnKey, on: boolean) {
    const col = COLUMNS.find((c) => c.key === key);
    if (col?.required) return;
    setVisible((prev) => {
      const set = new Set(prev);
      if (on) set.add(key); else set.delete(key);
      return COLUMNS.map((c) => c.key).filter((k) => set.has(k));
    });
  }

  const buildings = useQuery({
    queryKey: ["unit-buildings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("building").not("building", "is", null);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: { building: string | null }) => r.building && set.add(r.building));
      return Array.from(set).sort();
    },
  });

  const list = useQuery({
    queryKey: ["units", { search, building, occupancy, sort, page }],
    queryFn: async () => {
      const sortOpt = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];
      let q = supabase
        .from("units")
        .select("id, building, unit_number, floor, bedrooms, area_sqm, land_area_sqm, built_up_area_sqm, monthly_service_charge, handover_date, is_occupied, notes", { count: "exact" })
        .order(sortOpt.key, { ascending: sortOpt.asc, nullsFirst: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);


      if (building !== "all") q = q.eq("building", building);
      if (occupancy === "occupied") q = q.eq("is_occupied", true);
      if (occupancy === "vacant") q = q.eq("is_occupied", false);
      if (search.trim()) q = q.ilike("unit_number", `%${search.trim()}%`);

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Unit[], total: count ?? 0 };
    },
  });

  const stats = useQuery({
    queryKey: ["units-stats", { building }],
    queryFn: async () => {
      let q = supabase.from("units").select("is_occupied, handover_date, monthly_service_charge", { count: "exact" });
      if (building !== "all") q = q.eq("building", building);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as Pick<Unit, "is_occupied" | "handover_date" | "monthly_service_charge">[];
      const total = rows.length;
      const occupied = rows.filter((r) => r.is_occupied).length;
      const handed = rows.filter((r) => r.handover_date).length;
      const billable = rows.reduce((s, r) => s + Number(r.monthly_service_charge ?? 0), 0);
      return { total, occupied, handed, billable };
    },
  });

  const detail = useQuery({
    queryKey: ["unit-detail", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const [u, r] = await Promise.all([
        supabase.from("units").select("*").eq("id", selectedId!).maybeSingle(),
        supabase.from("residents").select("*").eq("unit_id", selectedId!).order("is_active", { ascending: false }).order("move_in_date", { ascending: false }),
      ]);
      if (u.error) throw u.error;
      return { unit: u.data as Unit | null, residents: (r.data ?? []) as Resident[] };
    },
  });

  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function resetPageAnd<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(0);
    };
  }

  const s = stats.data;
  const summary = useMemo(
    () => [
      { label: "Units in view", value: s ? s.total.toLocaleString() : "—", icon: Home },
      { label: "Occupied", value: s ? `${s.occupied.toLocaleString()} (${s.total ? ((s.occupied / s.total) * 100).toFixed(1) : "0"}%)` : "—", icon: Users },
      { label: "Handed over", value: s ? `${s.handed.toLocaleString()} (${s.total ? ((s.handed / s.total) * 100).toFixed(1) : "0"}%)` : "—", icon: KeyRound },
      { label: "Monthly billable", value: s ? fmtBHD(s.billable) : "—", icon: Wallet },
    ],
    [s],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-bold tracking-tight">Units</h2>
        <p className="text-sm text-muted-foreground">Browse, filter, and inspect every unit in the community.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-1 font-display text-xl font-bold tabular-nums">{c.value}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => resetPageAnd(setSearch)(e.target.value)}
            placeholder="Search unit number..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={building} onValueChange={resetPageAnd(setBuilding)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Building" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All buildings</SelectItem>
              {(buildings.data ?? []).map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={occupancy} onValueChange={(v) => resetPageAnd(setOccupancy)(v as typeof occupancy)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All occupancy</SelectItem>
              <SelectItem value="occupied">Occupied</SelectItem>
              <SelectItem value="vacant">Vacant</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={resetPageAnd(setSort)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-10">
                <Columns3 className="mr-2 h-4 w-4" />
                Columns
                <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs tabular-nums">
                  {activeColumns.length}/{COLUMNS.length}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMNS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.key}
                  checked={visibleSet.has(c.key)}
                  disabled={c.required}
                  onCheckedChange={(on) => toggleColumn(c.key, on)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.label}{c.required ? " (required)" : ""}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent rounded-sm"
                onClick={() => setVisible(DEFAULT_VISIBLE)}
              >
                Reset to default
              </button>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-10" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Add unit
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <Table>
          <TableHeader>
            <TableRow>
              {activeColumns.map((c) => (
                <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>{c.label}</TableHead>
              ))}
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow><TableCell colSpan={activeColumns.length + 1} className="py-10 text-center text-muted-foreground">Loading units…</TableCell></TableRow>
            )}
            {!list.isLoading && (list.data?.rows.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={activeColumns.length + 1} className="py-10 text-center text-muted-foreground">No units match these filters.</TableCell></TableRow>
            )}
            {(list.data?.rows ?? []).map((u) => (
              <TableRow key={u.id} className="cursor-pointer" onClick={() => setSelectedId(u.id)}>
                {activeColumns.map((c) => (
                  <TableCell key={c.key} className={cn(c.align === "right" && "text-right tabular-nums")}>
                    {c.render(u)}
                  </TableCell>
                ))}
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingId(u.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            {total === 0 ? "0 results" : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total.toLocaleString()}`}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
            <span className="text-muted-foreground">Page {page + 1} of {pageCount}</span>
            <Button size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detail.data?.unit?.unit_number ?? "Unit"}</SheetTitle>
            <SheetDescription>{detail.data?.unit?.building ?? "—"}</SheetDescription>
          </SheetHeader>

          {detail.isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

          {detail.data?.unit && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Floor" value={detail.data.unit.floor ?? "—"} />
                <Field label="Bedrooms" value={detail.data.unit.bedrooms ?? "—"} />
                <Field label="Land area" value={detail.data.unit.land_area_sqm ? `${detail.data.unit.land_area_sqm} m²` : "—"} />
                <Field label="Built-up area" value={detail.data.unit.built_up_area_sqm ? `${detail.data.unit.built_up_area_sqm} m²` : "—"} />
                <Field label="Service charge" value={fmtBHD(detail.data.unit.monthly_service_charge)} />
                <Field label="Handover date" value={fmtDate(detail.data.unit.handover_date)} />
                <Field
                  label="Status"
                  value={
                    <Badge
                      variant={detail.data.unit.is_occupied ? "default" : "secondary"}
                      className={detail.data.unit.is_occupied ? "bg-emerald-600 hover:bg-emerald-600" : ""}
                    >
                      {detail.data.unit.is_occupied ? "Occupied" : "Vacant"}
                    </Badge>
                  }
                />
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Residents</h4>
                {(detail.data.residents.length === 0) ? (
                  <p className="text-sm text-muted-foreground">No residents on file.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.data.residents.map((r) => (
                      <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{r.full_name}</p>
                          <Badge variant={r.is_active ? "default" : "secondary"} className={r.is_active ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
                            {r.resident_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.email ?? "—"} · {r.phone ?? "—"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Moved in {fmtDate(r.move_in_date)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {detail.data.unit.notes && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h4>
                  <p className="text-sm text-muted-foreground">{detail.data.unit.notes}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <UnitFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} />
      <ConfirmDeleteDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Delete unit?"
        description="This permanently removes the unit and any related records. This action cannot be undone."
        busy={del.isPending}
        onConfirm={() => deletingId && del.mutate(deletingId)}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
