
# HR Module — Phase 1

Scope kept intentionally minimal per your answers. Recruitment, performance, EOS, government grants, and NFC access control are deferred to later phases.

## What's included

- **Employees** — records, optional link to app user, documents
- **Attendance** — manual daily entries (hours in/out, status)
- **Leave** — request → approve/reject with balances
- **Payroll** — monthly runs, payslips, PDF export
- **Accounting** — auto-draft journal entries flagged for Finance review before posting

## Database (one migration)

New tables in `public` (with GRANTs + RLS + updated_at triggers):

- `employees` — employee_no, full_name, email, phone, national_id, position, department, hire_date, employment_status, basic_salary, allowances (jsonb), currency, user_id (nullable FK to auth.users), notes
- `employee_documents` — reuses `documents` bucket; row links employee_id → document_id
- `attendance` — employee_id, date, check_in, check_out, hours, status (present/absent/leave/holiday), notes  (unique on employee_id + date)
- `leave_types` — code, name, days_per_year, paid
- `leave_balances` — employee_id, leave_type_id, year, entitled, used
- `leave_requests` — employee_id, leave_type_id, from_date, to_date, days, reason, status (pending/approved/rejected), reviewed_by, reviewed_at
- `payroll_runs` — period_month, period_year, status (draft/approved/paid), totals, approved_by, approved_at, journal_entry_id (nullable)
- `payslips` — payroll_run_id, employee_id, basic, allowances, overtime, deductions, leave_adjustment, net_pay, snapshot (jsonb)
- `payroll_journal_drafts` — payroll_run_id, lines (jsonb: account_id, debit, credit, memo), status (pending_review/approved/rejected), reviewed_by

New role: `hr` in `app_role` enum. Add `has_role(_, 'hr')` helper reuse.

RLS summary:
- Admin + hr: full manage on all HR tables
- Employee (via `user_id`): read own record, own attendance, own payslips; create/cancel own leave requests
- Finance (`can_manage_sales`): read payroll_runs + payroll_journal_drafts; approve/reject drafts

## Sidebar

New top-level group **HR** with:
- Employees
- Attendance
- Leave
- Payroll (list of runs + create run)
- Payslips

Payroll approval queue surfaces inside existing **Finance** area:
- New tile in Finance: "Payroll Journals" — Finance reviews the auto-drafted entries and posts (creates journal entry using existing chart_of_accounts) or rejects.

Employee self-service surfaces inside existing **Portal** (bottom nav gains "Work" tab, visible only when the signed-in user has a linked `employees.user_id`): my profile, my attendance, my leave requests, my payslips.

## Server functions (new files, no edits to existing modules)

- `src/lib/hr.functions.ts` — CRUD for employees, attendance, leave, payroll run generation, payslip PDF
- `src/lib/hr-payroll.server.ts` — pure calc helpers (basic + allowances + OT − deductions ± leave)
- Payroll run flow:
  1. Admin/HR creates run for month → generates payslips from `employees` + `attendance` + approved `leave_requests`
  2. On run approval, drafts journal lines into `payroll_journal_drafts` (status `pending_review`)
  3. Finance approves → creates real journal entry, links `payroll_runs.journal_entry_id`, marks run `paid`

## UI (new routes under existing admin/portal shells)

Admin:
- `/admin/hr/employees` — list, create, edit, deactivate, upload documents
- `/admin/hr/attendance` — month grid per employee, bulk edit
- `/admin/hr/leave` — requests table with approve/reject
- `/admin/hr/payroll` — runs list + create-run wizard
- `/admin/hr/payslips` — search + view/download PDF
- `/admin/finance/payroll-journals` — Finance approval queue

Portal (self-service):
- `/portal/work` — profile, attendance history, leave request, payslip downloads

## Reuse (no duplication)

- `documents` storage bucket + `documents` table for employee files
- `chart_of_accounts` for journal posting
- Existing PDF helpers (`src/lib/pdf.server.ts`) for payslips
- Existing `audit_log` trigger applied to new HR tables
- Existing `currencies` + `useCurrency()` for payroll amounts
- Existing `has_role` and approval patterns

## Explicitly deferred (later phase, not in this plan)

- Government grants & wage subsidies
- Recruitment, performance, end-of-service
- NFC mobile cards, gate-reader integration, physical card/QR fallback UI
- Overtime auto-detection from attendance rules
- Advanced reports (basic per-run and per-employee summaries only)

## Technical details

- New DB enum values: `app_role` += `'hr'`; add `employment_status` enum, `leave_status` enum, `payroll_run_status` enum, `payroll_draft_status` enum
- Seed default `leave_types` (Annual 30, Sick 15, Unpaid 0) + populate balances on employee create
- Every new public table gets: GRANTs to authenticated + service_role, RLS enabled, policies, updated_at trigger, audit_log trigger
- No changes to existing files except: `src/routes/_authenticated/admin/route.tsx` (add HR sidebar group + Finance→Payroll Journals link), `src/routes/_authenticated/portal/route.tsx` bottom nav (conditional Work tab)
