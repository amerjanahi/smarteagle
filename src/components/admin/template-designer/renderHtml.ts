import type { CanvasDoc, CanvasElement, TplType } from "./types";
import { pageSize } from "./types";
import { MERGE_FIELDS, resolveMergeTokens } from "./mergeFields";

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function elToHtml(el: CanvasElement, type: TplType, logoUrl?: string): string {
  const s = el.style ?? {};
  const common = `position:absolute;left:${el.x}pt;top:${el.y}pt;width:${el.w}pt;height:${el.h}pt;box-sizing:border-box;overflow:hidden;`;
  const text = `font-family:${s.font ?? "Helvetica, Arial, sans-serif"};font-size:${s.size ?? 10}pt;font-weight:${s.weight ?? "normal"};font-style:${s.italic ? "italic" : "normal"};text-align:${s.align ?? "left"};color:${s.color ?? "#0f172a"};line-height:${s.lineHeight ?? 1.3};`;
  const box = `background:${s.bg ?? "transparent"};${s.borderWidth ? `border:${s.borderWidth}pt solid ${s.borderColor ?? "#000"};` : ""}${s.padding ? `padding:${s.padding}pt;` : ""}`;
  switch (el.type) {
    case "text":
    case "field":
    case "payment":
      return `<div style="${common}${text}${box}white-space:pre-wrap;word-break:break-word;">${esc(resolveMergeTokens(el.content ?? "", type))}</div>`;
    case "logo":
    case "image": {
      const src = el.src || (el.type === "logo" ? logoUrl : "");
      return `<div style="${common}">${src ? `<img src="${esc(src)}" style="width:100%;height:100%;object-fit:contain"/>` : ""}</div>`;
    }
    case "line":
      return `<div style="position:absolute;left:${el.x}pt;top:${el.y}pt;width:${el.w}pt;height:${Math.max(s.borderWidth ?? 1, 1)}pt;background:${s.borderColor ?? s.color ?? "#0f172a"};"></div>`;
    case "rect":
      return `<div style="${common}${box}"></div>`;
    case "table": {
      const cols = el.table?.columns ?? [];
      const sample = [
        { description: "Service charge — sample", quantity: "1", unit_price: "1,000.00", tax_rate: "5%", line_total: "1,050.00", date: "2026-01-15", reference: "INV-2026-00001", debit: "1,000.00", credit: "—", balance: "1,000.00", amount: "1,050.00" },
        { description: "Maintenance fee", quantity: "1", unit_price: "500.00", tax_rate: "5%", line_total: "525.00", date: "2026-01-20", reference: "INV-2026-00002", debit: "500.00", credit: "—", balance: "1,500.00", amount: "525.00" },
      ];
      const head = cols.map((c) => `<th style="width:${c.width}pt;background:${s.bg ?? "#3B82F6"};color:#fff;padding:4pt 6pt;text-align:${c.align ?? "left"};font-weight:bold;">${esc(c.label)}</th>`).join("");
      const body = sample.map((row) => `<tr>${cols.map((c) => `<td style="padding:3pt 6pt;border-bottom:0.5pt solid #e5e7eb;text-align:${c.align ?? "left"};color:${s.color ?? "#0f172a"};">${esc((row as any)[c.key] ?? "")}</td>`).join("")}</tr>`).join("");
      return `<div style="${common}"><table style="width:100%;border-collapse:collapse;font-size:${s.size ?? 9}pt;font-family:${s.font ?? "Helvetica, Arial, sans-serif"};"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }
    case "totals": {
      const rows = (el.totals?.rows ?? []).map((r) => `<div style="display:flex;justify-content:space-between;font-weight:${r.bold ? "bold" : "normal"};padding:2pt 0;"><span>${esc(r.label)}</span><span>${esc(resolveMergeTokens(`{{${r.key}}}`, type))}</span></div>`).join("");
      return `<div style="${common}${text}padding:${s.padding ?? 4}pt;">${rows}</div>`;
    }
  }
  return "";
}

export function renderDocHtml(doc: CanvasDoc, type: TplType, opts: { title?: string; logoUrl?: string; autoPrint?: boolean } = {}): string {
  const { w, h } = pageSize(doc);
  const orient = doc.page.orientation === "landscape" ? "A4 landscape" : "A4 portrait";
  const elements = doc.elements.map((el) => elToHtml(el, type, opts.logoUrl)).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title ?? "Preview")}</title>
<style>
  @page { size: ${orient}; margin: 0; }
  html, body { margin: 0; padding: 0; background: #e5e7eb; }
  .toolbar { position: fixed; top: 8px; right: 8px; z-index: 10; }
  .toolbar button { padding: 6px 12px; margin-left: 4px; border-radius: 4px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; }
  .page { width: ${w}pt; height: ${h}pt; background: #fff; margin: 20px auto; position: relative; box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .page { margin: 0; box-shadow: none; }
  }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button><button onclick="window.close()">Close</button></div>
<div class="page">${elements}</div>
${opts.autoPrint ? "<script>setTimeout(()=>window.print(),300)</script>" : ""}
</body></html>`;
}
