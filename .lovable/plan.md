## Change

In `src/routes/_authenticated/admin/route.tsx`, remove two sidebar entries:

- Sales group: `Finance Reports` (`/admin/reports`) — line 51
- Purchases group: `Reports` (`/admin/purchase-reports`) — line 62

The central "Reports" under Operations (`/admin/reports-hub`) stays as the single reports entry.

## Not changed

- Route files (`admin/reports.tsx`, `admin/purchase-reports.tsx`) remain in place so URLs and functionality are untouched — only their sidebar links are removed.
- No changes to logic, data, or permissions.
