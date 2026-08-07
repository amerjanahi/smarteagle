# Live invoice preview panel

Add a preview panel to the Create invoice workspace that renders the invoice as it will look, updating instantly as fields change.

## What changes

- The workspace becomes a two-part layout: the form on the left, and a sticky **Preview** panel on the right that scrolls with the page on desktop.
- The preview renders an A4-style document sheet showing:
  - header with company name and "INVOICE" title, plus a placeholder invoice number (assigned on save)
  - customer name, email, phone, unit, issue/due dates, payment terms, service period
  - description/subject line
  - line items table with quantity, unit price, VAT % and line total
  - totals block: subtotal, VAT, discount, grand total, all in the active display currency
  - notes and attachment names when present
- Empty fields show muted placeholders instead of blanks, so the layout never jumps.
- On tablet/mobile the preview moves below the form and can be collapsed with a "Show/Hide preview" toggle so the form stays usable on small screens.
- The existing "Create invoice" and Cancel actions and all save logic stay exactly as they are; the preview is display-only.

## Technical notes

- New component `src/components/admin/InvoicePreview.tsx`, a pure presentational component taking the current form values, line items, attachments, computed subtotal/VAT/discount/total, the resolved unit label, and the money formatter from `useCurrency()`.
- `src/routes/_authenticated/admin/invoices.tsx` wraps the existing workspace form in a `lg:grid-cols-[minmax(0,1fr)_420px]` grid and renders `<InvoicePreview />` in the second column with `lg:sticky lg:top-4`. No changes to state, mutation, or server functions.
- Company name comes from the existing `company_settings` read pattern already used by the currency hook (name only, cached query); falls back to a neutral label when unset.
- Styling uses existing semantic tokens (`bg-card`, `border-border`, `text-muted-foreground`) to visually match the generated PDF layout in `src/lib/pdf.server.ts` without duplicating PDF code.
