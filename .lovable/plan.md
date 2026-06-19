## Sales Module Enhancement

Build out a complete sales/billing workflow on top of the existing `invoices`, `payments`, and `credit_notes` tables, with line-item support, payment allocation across multiple invoices, customizable document templates, PDF generation, statements, and an audit trail.

### 1. Database changes (migration)

**New tables**
- `invoice_line_items` — invoice_id, description, quantity, unit_price, tax_rate, line_total
- `credit_note_line_items` — same shape, tied to credit_notes
- `payment_allocations` — payment_id, invoice_id, amount_applied (lets one payment cover multiple invoices)
- `document_templates` — type (invoice/credit_note/receipt/statement), name, logo_url, primary_color, header_text, footer_text, fields_json (which columns to show), layout (compact/standard/detailed), is_default
- `audit_log` — table_name, record_id, action (insert/update/delete/issue/void/allocate), actor_user_id, before_json, after_json, created_at

**Column additions**
- `invoices`: tax_amount, subtotal, balance_due (generated), currency, voided_at, voided_by
- `credit_notes`: status (draft/issued/applied/void), applied_amount, balance (remaining credit)
- `payments`: allocated_amount, unallocated_amount (for over-payments → customer credit)
- `residents`/units: customer_balance view (computed)

**Triggers**
- Recompute invoice `amount_paid`/`status` from `payment_allocations` (not from `payments` directly)
- Recompute credit-note `applied_amount`/`balance` when allocations or invoice changes happen
- Write to `audit_log` on every insert/update/delete to invoices, payments, credit_notes, allocations
- Auto-generate sequential `invoice_number`, `receipt_number`, `credit_note_number` per year

**RBAC**
- Add roles `accountant` and `viewer` to existing `app_role` enum
- Helper: `can_manage_sales(user_id)` = admin OR accountant
- Policies: viewers read-only; accountants create/edit drafts; admins void/delete

### 2. Server functions (`src/lib/sales.functions.ts`)

All under `requireSupabaseAuth` + role check:
- `createInvoice` / `updateInvoice` / `voidInvoice` (with line items)
- `recordPayment` (with allocations array; auto-allocate FIFO if not specified)
- `issueCreditNote` / `applyCreditNote` (allocate to invoices)
- `getCustomerStatement` (unit_id, date range → invoices, payments, credits, running balance)
- `generateInvoicePdf` / `generateReceiptPdf` / `generateCreditNotePdf` / `generateStatementPdf` (returns base64 PDF using `pdf-lib`, applies selected template)
- `listTemplates` / `saveTemplate` / `uploadLogo` (admin only)

### 3. UI — `/admin/sales/*`

- `/admin/sales` — dashboard: outstanding receivables, aged debtors, recent activity
- `/admin/sales/invoices` — list, filter by status/unit/date; create/edit drawer with line items, tax, preview
- `/admin/sales/payments` — record payment, pick customer, allocate across open invoices, print receipt
- `/admin/sales/credit-notes` — issue/apply credit notes
- `/admin/sales/statements` — pick customer + date range, preview & download PDF, email
- `/admin/sales/templates` — template editor (logo upload, color picker, toggle fields, header/footer, live preview)
- `/admin/sales/audit` — searchable audit log (admin only)

### 4. Storage
- New private bucket `sales-documents` for logos and generated PDFs
- RLS: admins/accountants read+write, residents read only their own receipts/invoices

### Out of scope (ask separately if needed)
- Email delivery of PDFs (needs Resend setup)
- Online payment gateway integration (Stripe/Paddle)
- Multi-currency conversion rates
- Recurring invoice schedules

### Order of work
1. Migration (schema + RBAC + triggers + audit)
2. Server functions + PDF generation
3. Admin UI screens
4. Template editor
5. Resident-side: view own invoices/receipts/statements

Approve and I'll start with the migration.