import type { CSSProperties, ReactNode } from "react";
import type { CanvasDoc, CanvasElement, TplType } from "./types";
import { pageSize } from "./types";
import { resolveMergeTokens } from "./mergeFields";

export type RenderMode = "editor" | "preview" | "print";

function styleToCss(el: CanvasElement, mode: RenderMode): CSSProperties {
  const s = el.style ?? {};
  const base: CSSProperties = {
    position: "absolute",
    left: `${el.x}pt`,
    top: `${el.y}pt`,
    width: `${el.w}pt`,
    height: `${el.h}pt`,
    fontFamily: s.font ?? "Helvetica, Arial, sans-serif",
    fontSize: `${s.size ?? 10}pt`,
    fontWeight: s.weight ?? "normal",
    fontStyle: s.italic ? "italic" : "normal",
    textAlign: s.align ?? "left",
    color: s.color ?? "#0f172a",
    background: s.bg ?? "transparent",
    border: s.borderWidth ? `${s.borderWidth}pt solid ${s.borderColor ?? "#000"}` : undefined,
    padding: s.padding ? `${s.padding}pt` : undefined,
    lineHeight: s.lineHeight ?? 1.3,
    boxSizing: "border-box",
    overflow: "hidden",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
  if (mode === "editor") base.cursor = "move";
  return base;
}

export function renderElement(
  el: CanvasElement,
  type: TplType,
  mode: RenderMode,
  logoUrl?: string,
): ReactNode {
  switch (el.type) {
    case "text":
    case "field":
    case "payment":
      return <div style={styleToCss(el, mode)}>{resolveMergeTokens(el.content ?? "", type)}</div>;
    case "logo": {
      const src = el.src || logoUrl;
      return (
        <div style={{ ...styleToCss(el, mode), padding: 0 }}>
          {src ? <img src={src} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ border: "1px dashed #94a3b8", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8pt", color: "#64748b" }}>Logo</div>}
        </div>
      );
    }
    case "image":
      return (
        <div style={{ ...styleToCss(el, mode), padding: 0 }}>
          {el.src ? <img src={el.src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ border: "1px dashed #94a3b8", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8pt", color: "#64748b" }}>Image</div>}
        </div>
      );
    case "line": {
      const s = el.style ?? {};
      return <div style={{ position: "absolute", left: `${el.x}pt`, top: `${el.y}pt`, width: `${el.w}pt`, height: `${Math.max(s.borderWidth ?? 1, 1)}pt`, background: s.borderColor ?? s.color ?? "#0f172a" }} />;
    }
    case "rect":
      return <div style={styleToCss(el, mode)} />;
    case "table": {
      const cols = el.table?.columns ?? [];
      const s = el.style ?? {};
      // sample rows
      const sample = [
        { description: "Service charge — sample", quantity: "1", unit_price: "1,000.00", tax_rate: "5%", line_total: "1,050.00", date: "2026-01-15", reference: "INV-2026-00001", debit: "1,000.00", credit: "—", balance: "1,000.00", amount: "1,050.00" },
        { description: "Maintenance fee", quantity: "1", unit_price: "500.00", tax_rate: "5%", line_total: "525.00", date: "2026-01-20", reference: "INV-2026-00002", debit: "500.00", credit: "—", balance: "1,500.00", amount: "525.00" },
      ];
      return (
        <div style={{ ...styleToCss(el, mode), padding: 0 }}>
          <table style={{ width: "100%", height: "100%", borderCollapse: "collapse", fontSize: `${s.size ?? 9}pt`, fontFamily: s.font ?? "Helvetica, Arial, sans-serif" }}>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.key} style={{ width: `${c.width}pt`, background: s.bg ?? "#3B82F6", color: "#fff", padding: "4pt 6pt", textAlign: c.align ?? "left", fontWeight: "bold" }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sample.map((row, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c.key} style={{ padding: "3pt 6pt", borderBottom: "0.5pt solid #e5e7eb", textAlign: c.align ?? "left", color: s.color ?? "#0f172a" }}>{(row as any)[c.key] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "totals": {
      const rows = el.totals?.rows ?? [];
      const s = el.style ?? {};
      return (
        <div style={{ ...styleToCss(el, mode), padding: s.padding ? `${s.padding}pt` : "4pt" }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontWeight: r.bold ? "bold" : "normal", padding: "2pt 0" }}>
              <span>{r.label}</span>
              <span>{resolveMergeTokens(`{{${r.key}}}`, type)}</span>
            </div>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

export function CanvasPage({ doc, type, mode, logoUrl, children }: { doc: CanvasDoc; type: TplType; mode: RenderMode; logoUrl?: string; children?: ReactNode }) {
  const { w, h } = pageSize(doc);
  return (
    <div
      className="canvas-page"
      style={{
        position: "relative",
        width: `${w}pt`,
        height: `${h}pt`,
        background: "#fff",
        boxShadow: mode === "editor" ? "0 8px 24px rgba(0,0,0,0.12)" : undefined,
        overflow: "hidden",
      }}
    >
      {doc.elements.map((el) => (
        <div key={el.id}>{renderElement(el, type, mode, logoUrl)}</div>
      ))}
      {children}
    </div>
  );
}
