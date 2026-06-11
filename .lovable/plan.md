# Community Management Platform — Rebuild Plan

Porting the uploaded Expo + FastAPI/MongoDB project to Lovable's stack: **TanStack Start (React web) + Lovable Cloud (Postgres + Auth)**. Single web app, role-based routing — residents get a mobile-first portal, admins get a desktop sidebar portal.

## Recommendation on backend

Use **Lovable Cloud** (Postgres + built-in email auth). It's the supported path here, gives us RLS for resident/admin separation, and removes the need to host FastAPI/MongoDB. Mock SMS-OTP and payment gateways stay mocked behind a thin abstraction, exactly like the PRD describes — easy to swap later.

## Phased delivery

I'll ship in 4 phases. After each phase the app is usable end-to-end for what's built so far.

### Phase 1 — Foundation (this turn)
- Enable Lovable Cloud
- Design system (mobile-first tokens, admin sidebar tokens, brand colors)
- DB schema + RLS + seed migration: `profiles`, `user_roles` (app_role enum: admin, resident), `units`, `residents`, `invoices`, `payments`, `credit_notes`, `maintenance_requests`, `visitors`, `announcements`, `documents`
- Seed: admin@test.com + 4 residents, 5 units across Tower A/B, sample invoices
- Auth: email + password (mock-OTP UX preserved as a labeled "demo login" using seeded accounts; real OTP deferred)
- Role-based route shell: `/` redirects to `/portal` (residents) or `/admin` (admins)
- `_authenticated/` gate via the managed Supabase integration layout

### Phase 2 — Resident portal (mobile-first)
Routes under `/portal/*`:
- Dashboard (outstanding balance, quick actions)
- Invoices list + detail + one-tap mock pay
- Maintenance requests (create with photo upload to Cloud Storage, list, status)
- Visitors (create request, QR code, list)
- Announcements + Documents

### Phase 3 — Admin portal (desktop sidebar, 9 modules)
Routes under `/admin/*`, RBAC-gated:
1. Dashboard — financial KPIs, collection rate, recent payments, overdue alerts
2. Units — CRUD
3. Residents — CRUD, auto-updates unit occupancy via trigger
4. Invoices — filters, bulk generate, clone, delete
5. Payments — receipt #, gateway provider, method
6. Credit Notes — auto-numbered CN-YYYYMMDD-XXXX
7. Reports — collection by building, aging buckets, occupancy
8. Maintenance — list, status updates, vendor assignment
9. Visitors — approve/reject queue

### Phase 4 — Polish
- Empty states, loading skeletons, error boundaries on every route
- SEO: per-route head() metadata, sitemap.xml, robots.txt
- Responsive QA across breakpoints

## Technical notes

- **Server functions** in `src/lib/*.functions.ts` for all data access; admin client loaded inside handlers only.
- **RLS**: residents see only their own units/invoices/etc via `auth.uid()`; admins use `has_role(auth.uid(), 'admin')` security-definer function.
- **Payments/OTP**: kept as mock with a `gateway_provider` column so AFS/EasyPay/BenefitPay can be wired later without schema changes.
- **No native-mobile features**: QR codes rendered as SVG in-page; photo upload uses Cloud Storage instead of Expo's image picker.

## Out of scope (per PRD's future roadmap)
Real payment gateway, real SMS OTP, multi-tenant, Arabic/bilingual, push notifications, Power BI, bank reconciliation, PDF/Excel export, scheduled email reports.

## What I'll build right now if you approve
Just **Phase 1** — foundation, schema, seed data, auth, and role-based routing shell with placeholder dashboards. Then I'll check in before starting Phase 2.