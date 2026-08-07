# Invoice creation as a full-page workspace

Today "Create invoice" opens a dialog stretched to the whole screen, which covers the admin sidebar. Replace it with a real in-page workspace that fills the full width and height of the content area while the main sidebar stays visible and usable.

## What changes

- The invoices page gets two states: the invoice list (current view) and a full-page **Create invoice** workspace.
- Clicking "New invoice" switches the content area to the workspace instead of opening a pop-up. No overlay, no dimmed background, sidebar and top bar stay active.
- The workspace header shows a Back to invoices button, the title, and the Save / Cancel actions pinned at the bottom of the form area so they're reachable without hunting.
- Form content is reorganized to use the extra space: customer/unit/date fields in a multi-column block, line items in a wide table, and totals in a summary panel beside the notes/attachments instead of stacked in a narrow column.
- Cancel or Back resets the form, same as closing the dialog does today.
- Smaller dialogs (invoice detail, record payment, credit note) stay as pop-ups — they're quick actions, not workspaces.

## Technical notes

- File: `src/routes/_authenticated/admin/invoices.tsx`. The `Dialog` wrapping the create form is removed; the existing `open` state now toggles between list markup and workspace markup, so all current form state, totals, CSV import, and submit logic are reused unchanged.
- Workspace container uses `min-h-[calc(100dvh-…)] w-full` sizing within the admin layout's content slot so it fills available height without breaking scroll.
- Responsive: single-column stacking on mobile via `grid-cols-1 lg:grid-cols-…`, `min-w-0` on text columns.
- No backend, schema, or server-function changes.
