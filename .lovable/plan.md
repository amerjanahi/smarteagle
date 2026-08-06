# Admin Settings Layout Refresh

Make the right-hand Settings content area wider and more organized while keeping the left vertical tab sidebar.

## What to change

1. Widen the right content column
   - Reduce the left tab sidebar width from 240px to 200px in `src/routes/_authenticated/admin/settings.tsx` so the right panel gets more room.
   - Increase the right column’s internal spacing (`gap-6` between title, filters, and table).
   - Ensure the right panel is flush and uses all available horizontal space.

2. Reorganize the Users tab
   - Add a row of summary cards at the top: Total users, Pending, Active, Rejected.
   - Move search and status filter onto one clean toolbar with consistent spacing.
   - Replace the single crowded “Actions” column with labeled icon buttons (or grouped actions) so the table is easier to scan.
   - Keep the existing table and dialogs; only improve layout and spacing.

3. Polish the Settings page header
   - Keep the page title and subtitle but add a subtle horizontal divider between the subtitle and the tab/content area so the sections read more clearly.

## Files to edit

- `src/routes/_authenticated/admin/settings.tsx` — grid sizing and page spacing.
- `src/components/admin/AllUsersTab.tsx` — summary cards, toolbar, action spacing.

## Out of scope

- No changes to the left sidebar content or tab behavior.
- No backend or data changes.
- No changes to the form dialogs or table columns beyond visual spacing.
