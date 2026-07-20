
## Central Reports Hub

Add a single **Reports** page under **Operations** that provides one entry point to every report across the platform, reusing existing data and logic.

### Sidebar
- Add `Reports` (BarChart3 icon) to `opsItems` in `src/routes/_authenticated/admin/route.tsx`, pointing to `/admin/reports-hub`.
- Keep existing `/admin/reports` (Finance) and `/admin/purchase-reports` intact — the hub links to them.

### New route: `/admin/reports-hub`
File: `src/routes/_authenticated/admin/reports-hub.tsx`

Layout:
- Header with global filter bar (persisted in URL search params via TanStack Router):
  - Date range (presets: This Month / Last Month / QTD / YTD / Custom)
  - Unit (searchable select)
  - Resident (searchable select)
  - Category (expense/invoice categories)
  - Status (paid/unpaid/partial/overdue/cancelled)
  - Transaction type (invoice/payment/expense/bill/bank)
- Grid of report cards grouped by section:
  - **Sales**: Invoices list, Aging, Collections
  - **Purchases**: Bills, Expenses by category, Vendor payments
  - **Payments & Collections**: Receipts by method, Outstanding
  - **Residents & Units**: Residents roster, Units occupancy
  - **Bank**: Balances, Reconciliation status, Transactions
  - **Annual Fees**: Calculations & billing status
  - **Accounting**: Profit & Loss, Balance Sheet, Cash Flow
  - **Ageing**: AR aging + AP aging
- Each card opens a `ReportViewer` drawer/dialog showing:
  - Title (editable inline when user has `admin` role — persisted to `localStorage` key `report-config:<reportId>`)
  - Column chooser (checkbox list, saved to same local config)
  - Data table (reuses existing shadcn `Table`)
  - Toolbar: View / Print / Export PDF / Export Excel

### Data layer (reuse first)
- Reuse `financeReport` from `src/lib/reports.functions.ts` for P&L, Cash Flow, Aging, Collections.
- Add a thin `src/lib/reports-hub.functions.ts` with additional `createServerFn` handlers **only** where no equivalent exists:
  - `residentsUnitsReport` — joins existing `residents` + `units`
  - `bankReport` — sums `bank_accounts` + `bank_transactions`
  - `annualFeesReport` — reads `annual_fee_calculations`
  - `balanceSheetReport` — derived from `chart_of_accounts` + invoices/payments/expenses
- All handlers gated by `requireSupabaseAuth` + `can_manage_sales` role check (same pattern as `financeReport`).
- No schema changes, no new tables, no data duplication.

### Export utilities
- PDF: reuse existing `src/lib/pdf.server.ts` pattern (server fn returns base64) + `downloadBase64Pdf` from `src/lib/pdf-download.ts`. Single generic `exportReportPdf` server fn accepting `{ title, columns, rows }`.
- Excel: client-side using `xlsx` (already common) — add via `bun add xlsx` if missing; generate workbook from the same `{ columns, rows }` shape.
- Print: `window.print()` on the viewer with a print-only stylesheet class.

### Report configuration persistence
- Per-user, per-report config stored in `localStorage` under `report-config:<id>`:
  ```json
  { "name": "AR Aging", "columns": ["invoice_number","customer","due_date","balance"] }
  ```
- Reset button restores defaults.
- Gate the edit UI behind `role === "admin"` from `useAuth`.

### Non-goals
- No changes to existing report pages (`/admin/reports`, `/admin/purchase-reports`, `/admin/statements`).
- No new DB tables, no permissions changes, no module rewrites.
- No server-side persistence of layout (localStorage only) to keep credit usage minimal.

### Files touched
- **New**: `src/routes/_authenticated/admin/reports-hub.tsx`, `src/lib/reports-hub.functions.ts`, `src/components/admin/ReportViewer.tsx`, `src/lib/report-export.ts`
- **Edited**: `src/routes/_authenticated/admin/route.tsx` (add sidebar item)
