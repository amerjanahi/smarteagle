export type ElementType =
  | "text"
  | "field"
  | "image"
  | "logo"
  | "line"
  | "rect"
  | "table"
  | "totals"
  | "payment";

export type ElStyle = {
  font?: string;
  size?: number;
  weight?: "normal" | "bold";
  italic?: boolean;
  align?: "left" | "center" | "right";
  color?: string;
  bg?: string;
  borderWidth?: number;
  borderColor?: string;
  padding?: number;
  lineHeight?: number;
};

export type TableColumn = {
  key: string;
  label: string;
  width: number; // pt
  align?: "left" | "center" | "right";
};

export type CanvasElement = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  style: ElStyle;
  content?: string; // supports {{merge.field}}
  src?: string; // image url
  table?: {
    columns: TableColumn[];
    source: "invoice_line_items" | "credit_note_line_items" | "statement_rows" | "payment_allocations";
  };
  totals?: { rows: { label: string; key: string; bold?: boolean }[] };
};

export type CanvasDoc = {
  page: {
    size: "A4";
    orientation: "portrait" | "landscape";
    margin: number;
    grid: number;
  };
  elements: CanvasElement[];
};

export type TplType =
  | "invoice"
  | "receipt"
  | "credit_note"
  | "statement"
  | "work_order"
  | "purchase_order";

// A4 in points: 595 x 842
export const A4 = { w: 595, h: 842 };
export const PT_TO_PX = 96 / 72; // 1.3333

export function pageSize(doc: CanvasDoc) {
  return doc.page.orientation === "landscape"
    ? { w: A4.h, h: A4.w }
    : { w: A4.w, h: A4.h };
}
