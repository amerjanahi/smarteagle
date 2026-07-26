# HR Phase 2 — Payroll, Leave & Attendance Enhancements

## Scope

Extend the existing HR module (Employees, Leave, Payroll, Attendance) with configurable pay components, richer leave rules, a locked approval workflow, and bulk attendance import. Reuse existing tables where possible; add new tables only for component catalogs and per-payslip line items.

## 1. Database changes

New tables (all with RLS: HR staff manage; employees can read own where relevant):

- `allowance_types` — code, name, is_taxable, default_amount, is_active
- `deduction_types` — code, name, is_statutory, default_amount, is_active
- `grant_types` — code, name, calc_type (rate|fixed), rate_or_amount, start_date, end_date, is_active
- `social_security_config` — country/scheme, employee_rate, employer_rate, cap_amount, effective_from
- `employee_compensation` — employee_id, currency, basic_salary, effective_from, effective_to (versioned)
- `employee_allowances` — employee_id, allowance_type_id, amount, start_date, end_date
- `employee_deductions` — employee_id, deduction_type_id, amount, start_date, end_date
- `employee_grants` — employee_id, grant_type_id, amount_override, start_date, end_date
- `payslip_lines` — payslip_id, kind (basic|allowance|deduction|grant|ss_ee|ss_er|overtime|unpaid_leave|adjustment), ref_id, label, amount, is_locked
- `payroll_adjustments` — payslip_id, reason, amount, created_by, created_at (post-approval changes)

Alter existing:
- `leave_types`: add `is_paid`, `carry_forward`, `max_carry_days`, `requires_document`, `allow_half_day`
- `leave_requests`: add `is_half_day`, `document_url`, `unpaid_days` (computed on approval)
- `payroll_runs`: add workflow status enum `draft|review|approved|paid`, `approved_by`, `approved_at`, `locked_at`
- `payslips`: add `status`, `is_locked`, `overtime_hours`, `overtime_amount`, `unpaid_leave_days`, `unpaid_leave_amount`, `social_security_ee`, `social_security_er`, `grants_amount`, `allowances_total`, `deductions_total`, `payment_status`
- `employees`: add `default_currency` (nullable → falls back to company_settings.default_currency)

Audit: reuse existing `audit_log` via `log_audit_event` trigger on new tables.

## 2. Server functions (`src/lib/hr.functions.ts`)

Add CRUD for allowance/deduction/grant/leave types and employee compensation components. Extend payroll generation to:

1. Resolve currency (employee → company setting; override on run).
2. Sum active allowances, deductions, grants for the period.
3. Compute social security from config.
4. Pull approved **unpaid** leave days → deduct `(basic/working_days) × unpaid_days`.
5. Add overtime lines (manual entry pre-approval).
6. Persist as `payslip_lines` for full breakdown.

Workflow functions: `submitPayrollForReview`, `approvePayrollRun` (locks payslips + lines), `markPayrollPaid`, `addPayrollAdjustment`, `recalculatePayslip` (blocked when locked), `bulkApprovePayslips`.

Attendance import: `importAttendanceCsv` / `importAttendanceXlsx` server fn accepting parsed rows `{ employee_no, date, check_in, check_out, hours, status }`.

Export: `exportPayrollExcel`, `exportPayrollPdf`, `exportBankTransferFile` (CSV of employee, IBAN, amount, currency).

## 3. Admin UI

- **Settings → HR Config** (new tabs page under `/admin/hr/config`): manage allowance types, deduction types, grant types, leave types, social security config.
- **Employees**: add Compensation tab in the edit dialog for basic salary + currency dropdown + assign allowances/deductions/grants with dates.
- **Leave**: form supports half-day toggle and document upload; type editor exposes new rule fields.
- **Payroll**:
  - Runs list gains status pipeline chips (Draft → Review → Approved → Paid) with bulk approve.
  - Run detail: detailed table with columns Basic, Allowances, Deductions, SS (EE/ER), Grants, Overtime, Unpaid Leave, Gross, Net, Payment Status, Approval Status.
  - Row actions: edit/delete/recalculate before approval; adjustment/reversal after.
  - Toolbar: search, filters (dept, status, currency), Excel export, PDF export, bank file.
- **Attendance**: add "Import CSV/Excel" button with column mapping preview and validation.

## 4. Portal (employee self-service)

- Show payslip lines breakdown, currency, and adjustments.
- Leave request form: half-day toggle + optional document upload when type requires it.

## 5. Currency

Reuse `useCurrency` for display defaults. Employee/run currency stored on records; formatter parameterized by decimals from `currencies` table.

## 6. Out of scope (to keep credits low)

- NFC access control (already deferred to later phase).
- Recruitment/performance/EOS modules.
- Multi-country tax engine — social security is a single configurable scheme.

## Technical notes

- New `app_role` unchanged; HR staff use existing `is_hr_staff`.
- Locking = `is_locked=true` on payslips + payslip_lines; server fns reject writes when locked unless via adjustment path.
- CSV/XLSX import parsed client-side (papaparse + xlsx already candidates); server fn accepts array to keep bundle logic isomorphic.
- Bank transfer file = generic CSV template (employee_no, name, iban, amount, currency, reference); no bank-specific formats.
- Audit log auto-populates via `log_audit_event` trigger attached to new tables.
