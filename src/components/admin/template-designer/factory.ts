import type { CanvasDoc, CanvasElement, TplType } from "./types";

function defaultStyle(overrides: Partial<CanvasElement["style"]> = {}): CanvasElement["style"] {
  return { font: "Helvetica, Arial, sans-serif", size: 10, weight: "normal", align: "left", color: "#0f172a", lineHeight: 1.3, ...overrides };
}

let idCounter = 0;
export function newId() {
  idCounter++;
  return `el_${Date.now().toString(36)}_${idCounter}`;
}

export function newElement(type: CanvasElement["type"]): CanvasElement {
  const base = { id: newId(), x: 40, y: 40, w: 200, h: 30, style: defaultStyle() } as CanvasElement;
  switch (type) {
    case "text":
      return { ...base, type, content: "Text" };
    case "field":
      return { ...base, type, content: "{{doc.number}}", style: defaultStyle({ weight: "bold" }) };
    case "logo":
      return { ...base, type, w: 120, h: 50 };
    case "image":
      return { ...base, type, w: 120, h: 80, src: "" };
    case "line":
      return { ...base, type, w: 300, h: 2, style: defaultStyle({ borderWidth: 1, borderColor: "#0f172a" }) };
    case "rect":
      return { ...base, type, w: 200, h: 100, style: defaultStyle({ borderWidth: 1, borderColor: "#e5e7eb", bg: "#f8fafc" }) };
    case "table":
      return {
        ...base, type, w: 515, h: 120,
        style: defaultStyle({ size: 9, bg: "#3B82F6" }),
        table: {
          source: "invoice_line_items",
          columns: [
            { key: "description", label: "Description", width: 260, align: "left" },
            { key: "quantity", label: "Qty", width: 50, align: "right" },
            { key: "unit_price", label: "Unit Price", width: 80, align: "right" },
            { key: "tax_rate", label: "Tax", width: 50, align: "right" },
            { key: "line_total", label: "Total", width: 75, align: "right" },
          ],
        },
      };
    case "totals":
      return {
        ...base, type, x: 340, w: 215, h: 100,
        style: defaultStyle({ size: 10 }),
        totals: {
          rows: [
            { label: "Subtotal", key: "totals.subtotal" },
            { label: "Tax", key: "totals.tax" },
            { label: "Total", key: "totals.total", bold: true },
          ],
        },
      };
    case "payment":
      return { ...base, type, w: 260, h: 60, content: "Bank: {{company.name}}\nIBAN: __\nSwift: __", style: defaultStyle({ size: 9 }) };
    default:
      return base;
  }
}

export function defaultDoc(type: TplType): CanvasDoc {
  const title = type.replace("_", " ").toUpperCase();
  return {
    page: { size: "A4", orientation: "portrait", margin: 40, grid: 8 },
    elements: [
      { ...newElement("logo"), x: 40, y: 30 },
      { id: newId(), type: "text", x: 380, y: 40, w: 175, h: 30, style: defaultStyle({ size: 22, weight: "bold", align: "right" }), content: title },
      { id: newId(), type: "text", x: 40, y: 100, w: 300, h: 14, style: defaultStyle({ size: 8, color: "#64748b" }), content: "Bill To" },
      { id: newId(), type: "field", x: 40, y: 116, w: 300, h: 18, style: defaultStyle({ size: 12, weight: "bold" }), content: "{{resident.full_name}}" },
      { id: newId(), type: "field", x: 40, y: 136, w: 300, h: 14, style: defaultStyle({ size: 10 }), content: "Unit {{unit.unit_number}} {{unit.building}}" },
      { id: newId(), type: "text", x: 380, y: 100, w: 175, h: 14, style: defaultStyle({ size: 8, color: "#64748b", align: "right" }), content: "Document #" },
      { id: newId(), type: "field", x: 380, y: 116, w: 175, h: 18, style: defaultStyle({ size: 12, weight: "bold", align: "right" }), content: "{{doc.number}}" },
      { id: newId(), type: "text", x: 380, y: 138, w: 175, h: 14, style: defaultStyle({ size: 8, color: "#64748b", align: "right" }), content: "Date" },
      { id: newId(), type: "field", x: 380, y: 152, w: 175, h: 14, style: defaultStyle({ size: 10, align: "right" }), content: "{{doc.date}}" },
      { ...newElement("table"), x: 40, y: 200 },
      { ...newElement("totals"), x: 340, y: 340 },
      { id: newId(), type: "text", x: 40, y: 780, w: 515, h: 20, style: defaultStyle({ size: 8, color: "#64748b", align: "center" }), content: "Thank you for your business." },
    ],
  };
}
