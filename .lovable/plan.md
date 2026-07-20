## Goal

Add two new admin views under Visitors:
1. **Live Access Board** — real-time who's inside now, with duration and quick exit.
2. **Visitor History** — searchable, filterable log of all past entries with export.

## Approach

Keep `admin/visitors.tsx` as pre-registration and convert its top bar into tabs: **Pre-Register | Live Board | History**. Reuse existing `visitors` table + `checkOutVisitor` server fn. No schema changes required — all needed columns exist (`visitor_type`, `company`, `car_plate`, `checked_in_at/_by`, `checked_out_at/_by`, `expected_at`, `status`, `blocked`, `gate_notes`, `unit_id`, `approved_by`).

Overdue rule: default max stay = 8 hours (configurable constant), highlight row in amber; > 24 h in red.

### 1. Live Access Board (`LiveAccessBoard.tsx`)
- Query: `visitors` where `status = 'checked_in'`, join `units(unit_number, building)`, join `profiles!checked_in_by(full_name)` for gate staff name.
- Realtime: subscribe to `postgres_changes` on `visitors` (inside `useEffect`, teardown on unmount) → `invalidateQueries`.
- Local ticking clock (setInterval 30s) to refresh live durations.
- Columns: Type (badge) · Name / Company · Villa · Plate · Entry time · Duration · Gate staff · Status · **Mark Exited** button (calls `checkOutVisitor`).
- Status derivation: `Inside` (< max), `Overdue` (> max), plus `Denied` when `blocked = true`.
- Header stats: Inside now, Overdue, Denied today.
- Filter chip row: visitor type.

### 2. Visitor History (`VisitorHistory.tsx`)
- Query all visitors ordered by `expected_at desc`, joined with units + gate staff profile.
- Filter bar: date range (from/to on `expected_at`), villa (unit select), visitor type, plate (text), status, gate staff (profile select). Client-side filtering after fetch (bounded to last 500 for perf; add "Load more" later if needed).
- Columns: Entry · Exit · Duration · Villa · Type · Name/Phone · Plate · Approval source (`approved_by` name or "Pre-registered" / "Walk-in") · Gate staff · Status · Notes/Incident flag.
- Row click → detail drawer showing full notes and any linked incident photos (if `gate_notes` or matching incident within ±1h on same unit).
- Export: reuse `src/lib/report-export.ts` — `exportCsv`, `exportExcel`, `printReport` (PDF via print). Add buttons: Export CSV / Excel / PDF.

### 3. Wire into existing page
Refactor `src/routes/_authenticated/admin/visitors.tsx` to render a `Tabs` component with three panels. Existing pre-register form and QR dialog stay in the "Pre-Register" tab unchanged.

## Files

- **New** `src/components/admin/visitors/LiveAccessBoard.tsx`
- **New** `src/components/admin/visitors/VisitorHistory.tsx`
- **New** `src/components/admin/visitors/shared.ts` — duration formatter, status/type badges, `MAX_STAY_HOURS` constant.
- **Edit** `src/routes/_authenticated/admin/visitors.tsx` — wrap existing UI in Tabs, add two new tabs.

## Out of scope

- Schema changes, permitted-duration per visitor type, gate-staff device tracking beyond what already logs, and incident photo attachments beyond linking existing `incidents` records. Ask if you want any of these.
