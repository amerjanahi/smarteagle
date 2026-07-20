// Client-side export helpers for the Reports Hub.
// No dependencies: CSV/Excel via HTML-blob, PDF via browser print.

export type ExportColumn = { key: string; label: string };
export type ExportRow = Record<string, any>;

function esc(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function csvEsc(v: any): string {
  const s = esc(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function htmlEsc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(title: string, cols: ExportColumn[], rows: ExportRow[]) {
  const header = cols.map((c) => csvEsc(c.label)).join(",");
  const body = rows.map((r) => cols.map((c) => csvEsc(r[c.key])).join(",")).join("\n");
  download(new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8" }), `${title}.csv`);
}

export function exportExcel(title: string, cols: ExportColumn[], rows: ExportRow[]) {
  const thead = `<tr>${cols.map((c) => `<th>${htmlEsc(c.label)}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${cols.map((c) => `<td>${htmlEsc(esc(r[c.key]))}</td>`).join("")}</tr>`).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><title>${htmlEsc(title)}</title></head><body><table border="1">${thead}${tbody}</table></body></html>`;
  download(new Blob([html], { type: "application/vnd.ms-excel" }), `${title}.xls`);
}

export function printReport(title: string, cols: ExportColumn[], rows: ExportRow[]) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const thead = `<tr>${cols.map((c) => `<th>${htmlEsc(c.label)}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${cols.map((c) => `<td>${htmlEsc(esc(r[c.key]))}</td>`).join("")}</tr>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="UTF-8"><title>${htmlEsc(title)}</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0 0 12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f5f5f5}@media print{@page{size:A4 landscape;margin:12mm}}</style>
    </head><body><h1>${htmlEsc(title)}</h1><table>${thead}${tbody}</table>
    <script>window.onload=()=>{window.focus();window.print();}</script></body></html>`);
  w.document.close();
}

// Simple local config storage for editable report layout
export type ReportConfig = { name?: string; columns?: string[] };
const KEY = (id: string) => `report-config:${id}`;

export function loadConfig(id: string): ReportConfig {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY(id)) ?? "{}"); } catch { return {}; }
}
export function saveConfig(id: string, cfg: ReportConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY(id), JSON.stringify(cfg));
}
export function resetConfig(id: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY(id));
}
