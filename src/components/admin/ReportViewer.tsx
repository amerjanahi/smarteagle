import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Printer, FileSpreadsheet, Settings2, RotateCcw, Pencil } from "lucide-react";
import { exportCsv, exportExcel, printReport, loadConfig, saveConfig, resetConfig, type ExportColumn } from "@/lib/report-export";
import { useAuth } from "@/hooks/use-auth";

type Props = {
  id: string;
  defaultTitle: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  data?: { columns: ExportColumn[]; rows: Record<string, any>[] };
};

export function ReportViewer({ id, defaultTitle, open, onOpenChange, loading, data }: Props) {
  const { role } = useAuth();
  const canEdit = role === "admin";
  const [cfg, setCfg] = useState(() => loadConfig(id));
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => { if (open) setCfg(loadConfig(id)); }, [open, id]);

  const title = cfg.name || defaultTitle;
  const allCols = data?.columns ?? [];
  const visibleKeys = cfg.columns && cfg.columns.length ? cfg.columns : allCols.map((c) => c.key);
  const cols = useMemo(() => allCols.filter((c) => visibleKeys.includes(c.key)), [allCols, visibleKeys]);
  const rows = data?.rows ?? [];

  function updateCfg(next: typeof cfg) { setCfg(next); saveConfig(id, next); }
  function toggleCol(key: string) {
    const set = new Set(visibleKeys);
    set.has(key) ? set.delete(key) : set.add(key);
    updateCfg({ ...cfg, columns: [...set] });
  }
  function commitName() {
    updateCfg({ ...cfg, name: nameInput.trim() || undefined });
    setEditingName(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingName ? (
              <>
                <Input autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)} className="h-8 w-64" />
                <Button size="sm" onClick={commitName}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
              </>
            ) : (
              <>
                <span>{title}</span>
                {canEdit && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setNameInput(title); setEditingName(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          {canEdit && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline"><Settings2 className="mr-1 h-3.5 w-3.5" />Columns</Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-2 max-h-72 overflow-auto">
                  {allCols.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={visibleKeys.includes(c.key)} onCheckedChange={() => toggleCol(c.key)} />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => { resetConfig(id); setCfg({}); }}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />Reset
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => printReport(title, cols, rows)}>
              <Printer className="mr-1 h-3.5 w-3.5" />Print / PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportExcel(title, cols, rows)}>
              <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportCsv(title, cols, rows)}>
              <Download className="mr-1 h-3.5 w-3.5" />CSV
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No data for the selected filters.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {cols.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    {cols.map((c) => (
                      <TableCell key={c.key} className="text-sm">
                        {formatCell(r[c.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="text-xs text-muted-foreground pt-2">{rows.length} row{rows.length === 1 ? "" : "s"}</div>
      </DialogContent>
    </Dialog>
  );
}

function formatCell(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return String(v);
}
