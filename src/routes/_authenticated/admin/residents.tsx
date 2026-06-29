import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, Users, UserCheck, Home, KeyRound, Columns3, Mail, Phone, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ResidentFormDialog, type ResidentFormValues } from "@/components/admin/ResidentFormDialog";
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

export const Route = createFileRoute("/_authenticated/admin/residents")({
  head: () => ({ meta: [{ title: "Residents — Hayy Admin" }] }),
  component: ResidentsPage,
});

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

type ResidentRow = {
  id: string;
  unit_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  resident_type: "owner" | "tenant";
  move_in_date: string | null;
  move_out_date: string | null;
  is_active: boolean;
  units: {
    id: string;
    unit_number: string;
    building: string | null;
    floor: number | null;
    bedrooms: number | null;
    land_area_sqm: number | null;
    built_up_area_sqm: number | null;
    area_sqm: number | null;
  } | null;
};

const PAGE_SIZE = 100;

type ColumnKey =
  | "full_name" | "address" | "building" | "phone" | "email"
  | "resident_type" | "land_area_sqm" | "built_up_area_sqm"
  | "move_in_date" | "is_active";

type ColumnDef = {
  key: ColumnKey;
  label: string;
  align?: "left" | "right";
  required?: boolean;
  render: (r: ResidentRow) => React.ReactNode;
};

const addressOf = (r: ResidentRow) =>
  r.units ? `${r.units.building ? r.units.building + " · " : ""}Unit ${r.units.unit_number}` : "—";

const COLUMNS: ColumnDef[] = [
  { key: "full_name", label: "Name", required: true, render: (r) => <span className="font-medium">{r.full_name}</span> },
  { key: "address", label: "Address", render: (r) => <span className="text-muted-foreground">{addressOf(r)}</span> },
  { key: "building", label: "Building", render: (r) => <span className="text-muted-foreground">{r.units?.building ?? "—"}</span> },
  { key: "phone", label: "Phone", render: (r) => <span className="tabular-nums">{r.phone ?? "—"}</span> },
  { key: "email", label: "Email", render: (r) => <span className="text-muted-foreground">{r.email ?? "—"}</span> },
  {
    key: "resident_type", label: "Type",
    render: (r) => (
      <Badge variant="secondary" className={r.resident_type === "owner" ? "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15" : ""}>
        {r.resident_type}
      </Badge>
    ),
  },
  { key: "land_area_sqm", label: "Land (m²)", align: "right", render: (r) => r.units?.land_area_sqm ?? "—" },
  { key: "built_up_area_sqm", label: "Built-up (m²)", align: "right", render: (r) => r.units?.built_up_area_sqm ?? r.units?.area_sqm ?? "—" },
  { key: "move_in_date", label: "Move-in", render: (r) => <span className="text-muted-foreground">{fmtDate(r.move_in_date)}</span> },
  {
    key: "is_active", label: "Status",
    render: (r) => (
      <Badge variant={r.is_active ? "default" : "secondary"} className={cn(r.is_active ? "bg-emerald-600 hover:bg-emerald-600" : "")}>
        {r.is_active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
];

const DEFAULT_VISIBLE: ColumnKey[] = ["full_name", "address", "phone", "email", "resident_type", "built_up_area_sqm", "move_in_date", "is_active"];
const STORAGE_KEY = "admin.residents.columns.v1";

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

const SORT_OPTIONS: { value: string; label: string; key: "full_name" | "resident_type" | "move_in_date"; asc: boolean }[] = [
  { value: "name_asc", label: "Name (A→Z)", key: "full_name", asc: true },
  { value: "name_desc", label: "Name (Z→A)", key: "full_name", asc: false },
  { value: "type_asc", label: "Type (owner→tenant)", key: "resident_type", asc: true },
  { value: "movein_desc", label: "Move-in (newest)", key: "move_in_date", asc: false },
  { value: "movein_asc", label: "Move-in (oldest)", key: "move_in_date", asc: true },
];

function ResidentsPage() {
  const [search, setSearch] = useState("");
  const [building, setBuilding] = useState<string>("all");
  const [type, setType] = useState<"all" | "owner" | "tenant">("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("active");
  const [sort, setSort] = useState<string>("name_asc");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState<ColumnKey[]>(() => loadVisible());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ResidentFormValues | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("residents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resident deleted");
      qc.invalidateQueries({ queryKey: ["residents"] });
      qc.invalidateQueries({ queryKey: ["residents-stats"] });
      setDeletingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openAdd() { setEditing(null); setFormOpen(true); }
  function openEdit(r: ResidentRow) {
    setEditing({
      id: r.id,
      unit_id: r.unit_id,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone,
      resident_type: r.resident_type,
      move_in_date: r.move_in_date,
      move_out_date: r.move_out_date,
      is_active: r.is_active,
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

  function resetPageAnd<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(0); };
  }

  const buildings = useQuery({
    queryKey: ["resident-buildings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("building").not("building", "is", null);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: { building: string | null }) => r.building && set.add(r.building));
      return Array.from(set).sort();
    },
  });

  const list = useQuery({
    queryKey: ["residents", { search, building, type, status, sort, page }],
    queryFn: async () => {
      const sortOpt = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];
      const buildingFilter = building !== "all";
      let q = supabase
        .from("residents")
        .select(
          "id, unit_id, full_name, email, phone, resident_type, move_in_date, move_out_date, is_active, units!inner(id, unit_number, building, floor, bedrooms, land_area_sqm, built_up_area_sqm, area_sqm)",
          { count: "exact" },
        )
        .order(sortOpt.key, { ascending: sortOpt.asc, nullsFirst: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (buildingFilter) q = q.eq("units.building", building);
      if (type !== "all") q = q.eq("resident_type", type);
      if (status === "active") q = q.eq("is_active", true);
      if (status === "inactive") q = q.eq("is_active", false);
      if (search.trim()) {
        const s = search.trim();
        q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
      }

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as ResidentRow[], total: count ?? 0 };
    },
  });

  const stats = useQuery({
    queryKey: ["residents-stats", { building }],
    queryFn: async () => {
      let q = supabase
        .from("residents")
        .select("resident_type, is_active, units!inner(building)", { count: "exact" });
      if (building !== "all") q = q.eq("units.building", building);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as { resident_type: "owner" | "tenant"; is_active: boolean }[];
      const total = rows.length;
      const active = rows.filter((r) => r.is_active).length;
      const owners = rows.filter((r) => r.resident_type === "owner").length;
      const tenants = rows.filter((r) => r.resident_type === "tenant").length;
      return { total, active, owners, tenants };
    },
  });

  const detail = useQuery({
    queryKey: ["resident-detail", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residents")
        .select("*, units(*)")
        .eq("id", selectedId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ResidentRow | null;
    },
  });

  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const s = stats.data;
  const summary = useMemo(
    () => [
      { label: "Residents in view", value: s ? s.total.toLocaleString() : "—", icon: Users },
      { label: "Active", value: s ? `${s.active.toLocaleString()} (${s.total ? ((s.active / s.total) * 100).toFixed(1) : "0"}%)` : "—", icon: UserCheck },
      { label: "Owners", value: s ? s.owners.toLocaleString() : "—", icon: KeyRound },
      { label: "Tenants", value: s ? s.tenants.toLocaleString() : "—", icon: Home },
    ],
    [s],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-bold tracking-tight">Residents</h2>
        <p className="text-sm text-muted-foreground">Owners and tenants across every building. Click any row to see full details.</p>
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
            placeholder="Search name, email, or phone…"
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
          <Select value={type} onValueChange={(v) => resetPageAnd(setType)(v as typeof type)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="owner">Owners</SelectItem>
              <SelectItem value="tenant">Tenants</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => resetPageAnd(setStatus)(v as typeof status)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={resetPageAnd(setSort)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
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
            <Plus className="mr-2 h-4 w-4" /> Add resident
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
              <TableRow><TableCell colSpan={activeColumns.length + 1} className="py-10 text-center text-muted-foreground">Loading residents…</TableCell></TableRow>
            )}
            {!list.isLoading && (list.data?.rows.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={activeColumns.length + 1} className="py-10 text-center text-muted-foreground">No residents match these filters.</TableCell></TableRow>
            )}
            {(list.data?.rows ?? []).map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedId(r.id)}>
                {activeColumns.map((c) => (
                  <TableCell key={c.key} className={cn(c.align === "right" && "text-right tabular-nums")}>
                    {c.render(r)}
                  </TableCell>
                ))}
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingId(r.id)} aria-label="Delete">
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
            <SheetTitle>{detail.data?.full_name ?? "Resident"}</SheetTitle>
            <SheetDescription>{detail.data ? addressOf(detail.data) : ""}</SheetDescription>
          </SheetHeader>

          {detail.isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

          {detail.data && (
            <div className="mt-6 space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className={detail.data.resident_type === "owner" ? "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15" : ""}>
                  {detail.data.resident_type}
                </Badge>
                <Badge variant={detail.data.is_active ? "default" : "secondary"} className={detail.data.is_active ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
                  {detail.data.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {detail.data.email ? <a href={`mailto:${detail.data.email}`} className="hover:underline">{detail.data.email}</a> : <span className="text-muted-foreground">No email</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {detail.data.phone ? <a href={`tel:${detail.data.phone}`} className="hover:underline tabular-nums">{detail.data.phone}</a> : <span className="text-muted-foreground">No phone</span>}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unit</h4>
                <div className="grid grid-cols-2 gap-4 text-sm rounded-lg border border-border p-4">
                  <Field label="Address" value={addressOf(detail.data)} />
                  <Field label="Building" value={detail.data.units?.building ?? "—"} />
                  <Field label="Floor" value={detail.data.units?.floor ?? "—"} />
                  <Field label="Bedrooms" value={detail.data.units?.bedrooms ?? "—"} />
                  <Field label="Land area" value={detail.data.units?.land_area_sqm ? `${detail.data.units.land_area_sqm} m²` : "—"} />
                  <Field label="Built-up area" value={detail.data.units?.built_up_area_sqm ? `${detail.data.units.built_up_area_sqm} m²` : (detail.data.units?.area_sqm ? `${detail.data.units.area_sqm} m²` : "—")} />
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenancy</h4>
                <div className="grid grid-cols-2 gap-4 text-sm rounded-lg border border-border p-4">
                  <Field label="Move-in" value={fmtDate(detail.data.move_in_date)} />
                  <Field label="Move-out" value={fmtDate(detail.data.move_out_date)} />
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ResidentFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} />
      <ConfirmDeleteDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Delete resident?"
        description="This permanently removes the resident record. This action cannot be undone."
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
