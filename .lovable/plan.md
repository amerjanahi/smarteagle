## Move Templates to Settings + expand types + add Document Management

Reuse existing `document_templates` and `documents` tables, existing `notice-images` storage patterns, and current templates UI. Minimal, additive changes only.

### 1. Templates — move under Settings and add types

- Extend the `template_type` values used in the UI/PDF generator to include: `invoice`, `receipt`, `credit_note`, `statement`, `work_order`, `purchase_order`. The DB column is `text` (no check constraint) so no migration needed.
- Add 4 configurable field toggles to `fields_json` defaults: `show_logo`, `show_company_details`, `show_numbering`, `show_terms` (plus existing `show_tax`, `show_period`, `show_notes`).
- Add optional fields to the editor UI (persisted inside `fields_json` as extra keys — no schema change): `company_details_text`, `terms_text`, `number_prefix`.
- Add a **Preview** button that opens a print-ready HTML render (using existing `generatePdf` for invoice/receipt/credit_note/statement; a simple HTML preview for work_order / purchase_order until PDFs are wired to real records) → browser Print for PDF export. No new deps.
- Sidebar: remove the standalone "Templates" item from Sales; add a "Document Templates" link inside the **Settings** page (tab or sub-nav) at `/admin/templates` — keep the existing route path so nothing else breaks.

### 2. Document Management (new) under Operations

New route `src/routes/_authenticated/admin/documents.tsx` and small server-fn file `src/lib/documents.functions.ts`.

- Additive migration on existing `public.documents`:
  - add columns: `folder text`, `tags text[] default '{}'`, `document_date date`, `access_level text default 'admin'` (admin | staff | resident), `archived boolean default false`, `unit_id uuid`, `resident_id uuid`, `vendor_id uuid`, `invoice_id uuid`, `purchase_invoice_id uuid`, `updated_at timestamptz default now()`
  - keep existing columns (`title`, `description`, `file_url`, `category`, `uploaded_by`, `created_at`)
  - update RLS: admins full access; staff read non-archived; residents read where `resident_id = auth.uid()` or linked unit and `access_level = 'resident'`. Add GRANTs.
- Reuse the `notice-images` bucket pattern → create one new private bucket `documents` via `supabase--storage_create_bucket` with signed-URL downloads.
- UI features (single page):
  - Left panel: folder tree + category filter + archived toggle
  - Top bar: search (title/description/tags), date range, link filters (unit/resident/vendor)
  - Grid/list of documents with preview (image/PDF inline), download, edit details dialog, archive/unarchive, delete
  - Upload dialog: file, title, description, folder, category, tags, date, access level, optional links (unit, resident, vendor, invoice, PO)
- Add sidebar entry under **Operations** → "Documents".

### 3. Files touched

- `src/routes/_authenticated/admin/route.tsx` — remove Sales→Templates, add Operations→Documents; keep Settings link to templates.
- `src/routes/_authenticated/admin/settings.tsx` — add "Document Templates" card/link opening `/admin/templates`.
- `src/routes/_authenticated/admin/templates.tsx` — add new types, extra fields, Preview button.
- `src/lib/pdf.server.ts` — add minimal `work_order` and `purchase_order` renderers (reuse invoice-style layout).
- `src/lib/sales.functions.ts` — no signature change; template_type union widened.
- New: `src/lib/documents.functions.ts`, `src/routes/_authenticated/admin/documents.tsx`, migration + storage bucket.

### Out of scope

- No changes to existing invoice/receipt/credit-note/statement generation flows beyond template-type widening.
- No new PDF engine or rich text editor for terms (plain textarea, print-friendly).