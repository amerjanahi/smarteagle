
## WYSIWYG Drag-and-Drop Template Designer

Replace the current form-based `admin/templates.tsx` with a canvas designer that stores element positions in `document_templates.fields_json`. Reuse existing table, permissions, and save function; add a new client-side renderer that draws the same layout to PDF (pdf-lib) using saved coordinates. Legacy templates without a canvas layout fall back to the existing renderers in `src/lib/pdf.server.ts`.

### Data model (no migration)

Extend `fields_json` with an optional `canvas` object — old templates without it keep working via the existing PDF renderer:

```ts
fields_json.canvas = {
  page: { size: "A4", orientation: "portrait" | "landscape", margin: number, grid: number },
  elements: Element[]     // absolute-positioned, ordered = z-index
}

type Element = {
  id: string;
  type: "text" | "field" | "image" | "logo" | "line" | "rect" | "table" | "totals" | "payment";
  x: number; y: number; w: number; h: number;   // pt (A4 = 595x842)
  rotation?: number;
  style: { font?: string; size?: number; weight?: "normal"|"bold"; italic?: boolean;
           align?: "left"|"center"|"right"; color?: string; bg?: string;
           border?: { width: number; color: string }; padding?: number; lineHeight?: number };
  content?: string;                        // text or {{merge.field}} tokens
  src?: string;                            // image url (logo defaults to template.logo_url)
  table?: { columns: { key: string; label: string; width: number; align?: string }[];
            source: "invoice_line_items" | "credit_note_line_items" | "statement_rows" | "payment_allocations" };
  totals?: { rows: { label: string; key: string; bold?: boolean }[] };
};
```

### Files

- **New `src/components/admin/template-designer/`**
  - `Designer.tsx` — main editor: toolbar, left palette, center canvas, right inspector, bottom status bar.
  - `Canvas.tsx` — absolute-positioned A4 page (`div` sized in pt with CSS `zoom`), rulers, grid overlay, alignment guides.
  - `DraggableElement.tsx` — wraps each element; uses pointer events for drag + 8 resize handles; snap-to-grid (configurable) and snap-to-siblings; inline text editing via `contentEditable` on double-click.
  - `Inspector.tsx` — right panel: position (x/y/w/h), rotation, font, size, weight, color, bg, border, padding, align, layer up/down, duplicate, delete. Table editor: add/remove columns, drag column widths. Merge-field picker per doc type.
  - `Palette.tsx` — draggable/clickable items: Text, Field, Logo, Image, Line, Rect, Table, Totals, Payment details.
  - `useHistory.ts` — undo/redo stack (up to 50 states) with Ctrl+Z / Ctrl+Shift+Z.
  - `mergeFields.ts` — per-type available tokens (invoice.number, invoice.date, resident.full_name, unit.unit_number, totals.subtotal, totals.tax, totals.total, totals.paid, totals.balance, company.name, company.address, etc.). Reused by preview and PDF export.
  - `renderPreview.tsx` — resolves merge fields against a sample or real record and renders HTML (same absolute layout) for on-screen preview + `window.print()` (pixel-accurate: A4 at 96dpi with `@page` CSS).
  - `renderPdf.ts` — client-side pdf-lib generator that walks `canvas.elements` and emits PDF at exact coordinates (text, images, lines, rects, tables, totals). Uses Helvetica/Helvetica-Bold from StandardFonts.
  - `xlsxExport.ts` — table-only export: flattens the first `table` element's rows into an XLSX using `xlsx` (already ubiquitous — add via `bun add xlsx` if missing).

- **Rewrite `src/routes/_authenticated/admin/templates.tsx`**
  - Left: list of templates grouped by type with badges (default, version).
  - Actions: New, Duplicate, Set default, Save, Save as new version, Delete, Preview (HTML), Export PDF, Export XLSX.
  - Center: `<Designer />`.
  - Version handling: on "Save as new version" copy row with `name = "{name} v{n+1}"` and `is_default = false`.
  - A4 portrait/landscape switch in top toolbar; zoom 50–200% slider; ruler and grid toggles.

- **`src/lib/sales.functions.ts`** (minor)
  - No schema change; `saveTemplate` already accepts arbitrary `fields_json`. Add a `duplicateTemplate` server fn (copies row, clears `is_default`).

- **`src/lib/pdf.server.ts`** (backwards compatible)
  - Add a small branch: if `template.fields_json?.canvas` exists, render using coords (same logic as `renderPdf.ts` but server-side) for real invoice/receipt/credit-note/statement PDFs. Otherwise, keep existing renderers untouched. Add stubs for `work_order` and `purchase_order` that require a canvas layout (they have no legacy renderer).

### Interactions

- Drag from palette → drops at cursor with default size.
- Click element → selected (blue outline + 8 handles). Shift-click multi-select (move group).
- Arrow keys nudge 1pt, Shift+Arrow 10pt.
- Ctrl+D duplicate, Del delete, Ctrl+] / Ctrl+[ layer up/down.
- Alignment guides appear when edges/centers align with siblings or page centers (±3pt threshold).
- Snap-to-grid honors `canvas.page.grid` (default 8pt), toggled from toolbar.
- Rulers: top + left, ticks in mm, cursor indicator.
- Inline text edit: double-click text/field element → `contentEditable` with basic formatting toolbar (bold, italic, size, color).

### PDF/print accuracy

- Screen canvas uses `1pt = 1.3333px` (96dpi) and `transform: scale(zoom)`; measured against pdf-lib output so preview matches print within 1px.
- Print stylesheet sets `@page { size: A4 [landscape]; margin: 0 }` and hides UI chrome — browser Print → Save as PDF gives the same layout as `renderPdf.ts`.

### Permissions & scope

- Route already admin-gated via `_authenticated` layout; no change.
- Reuses existing `document_templates` RLS and grants.
- No new tables, no new buckets.
- One optional dep: `xlsx` (only if not present) for XLSX export.

### Out of scope

- Multi-page templates (single A4 page only; long tables auto-paginate at render time).
- Collaborative editing.
- Free-form vector drawing beyond line/rect.
