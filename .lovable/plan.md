## Security Staff Portal — v1 (slim scope)

Mobile-first `/gate` portal for security staff. Reuses existing `visitors`, `residents`, `units`, `user_roles`. Strict access: no finance, docs, or admin settings.

### 1. Role & routing

- Reuse existing `security` role in `app_role` (already present).
- New pathless layout `src/routes/_authenticated/gate/route.tsx`:
  - `beforeLoad` calls `has_role(security)` or admin; other roles redirect to `/admin` or `/portal`.
  - Bottom-tab nav (mobile) / side rail (tablet).
- Post sign-in redirect: users whose only role is `security` land on `/gate`.
- Small guard added to admin layout to bounce security-only users to `/gate`.

### 2. Data changes (minimal migration)

Extend `visitors` table:
- `visitor_type text default 'guest'` (guest / delivery / contractor)
- `company text`
- `blocked boolean default false`
- `checked_in_by uuid`, `checked_out_by uuid` (staff who scanned)
- `gate_notes text`

Add RLS policies so `security` role can:
- SELECT visitors, units (unit_number, building only via existing table), residents (name + unit only)
- UPDATE visitors for check-in/out fields
- No access to invoices, payments, expenses, documents, company_settings (already restricted; verify).

New tables (each with GRANT + RLS):
- `incidents` — reported_by, unit_id (nullable), title, description, severity, photo_urls[], occurred_at, status
- `emergency_contacts` — name, role_label, phone, priority (admin-managed, security read-only)
- `gate_activity_log` — staff_id, action, visitor_id, unit_id, metadata jsonb, device_info, session_id, created_at

Storage: new private bucket `incident-photos` — security can insert; admins read via signed URLs.

### 3. Routes (`/gate/*`)

- `/gate` — dashboard: today's expected visitors, quick actions, realtime alert banner
- `/gate/scan` — QR scan (camera) + manual code entry fallback
- `/gate/checkin` — walk-in registration: name, phone, plate, purpose, resident/unit search, visitor_type
- `/gate/search` — single input searches name / phone / plate / villa number
- `/gate/approved` — today's approved list with status chips + check-in/out actions
- `/gate/incidents` — list + "Report incident" form with photo upload
- `/gate/emergency` — read-only emergency contacts with tap-to-call

Admin gets a new page `/admin/emergency-contacts` under Operations to maintain the contacts.

### 4. Realtime alerts

Subscribe to `visitors` on the dashboard. Toast + banner on:
- `blocked = true` visitor attempting check-in
- QR match with `status = 'cancelled'` or `expected_at` older than 24h
- Unknown QR / no match

### 5. Activity & session tracking

Every gate action goes through `createServerFn` (`requireSupabaseAuth`) that also inserts into `gate_activity_log` with `staff_id = context.userId`, action, entity IDs, `device_info = userAgent`, `session_id` from `sessionStorage` UUID. Admin can view under Audit.

### 6. Bilingual (EN / AR)

Small dictionary at `src/lib/i18n/gate.ts`. Toggle in gate header persists to `localStorage.gate_lang`. Sets `dir="rtl"` on Arabic. No new i18n framework.

### 7. Files

Create:
```
src/routes/_authenticated/gate/route.tsx
src/routes/_authenticated/gate/index.tsx
src/routes/_authenticated/gate/scan.tsx
src/routes/_authenticated/gate/checkin.tsx
src/routes/_authenticated/gate/search.tsx
src/routes/_authenticated/gate/approved.tsx
src/routes/_authenticated/gate/incidents.tsx
src/routes/_authenticated/gate/emergency.tsx
src/routes/_authenticated/admin/emergency-contacts.tsx
src/components/gate/BottomNav.tsx
src/components/gate/AlertBanner.tsx
src/components/gate/QrScanner.tsx        (wraps qr-scanner npm package)
src/lib/gate.functions.ts                (checkIn, checkOut, blockVisitor, logActivity, reportIncident)
src/lib/i18n/gate.ts
```

Edit:
- `src/routes/auth.tsx` (or post-login redirect logic): route security-only users to `/gate`.
- `src/routes/_authenticated/admin/route.tsx`: bounce security-only users out.

### 8. Technical notes

- QR: `qr-scanner` (~15KB) added on approval.
- Photos: private `incident-photos` bucket, signed URLs.
- All writes via `createServerFn` + `requireSupabaseAuth`; staff_id derived server-side, never trusted from client.
- RLS uses `has_role(auth.uid(), 'security')` alongside admin policies.

### Explicitly out of scope (per your input)

- Shift handover notes
- SMS / push notifications
- Facial recognition / ANPR
- Native app packaging (works in existing Capacitor shell)

Ready to build on approval.