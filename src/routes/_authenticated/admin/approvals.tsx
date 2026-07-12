import { createFileRoute } from "@tanstack/react-router";
import { PortalAccessRequestsInner } from "./portal-access-requests";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  head: () => ({ meta: [{ title: "Approvals — Hayy Admin" }] }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Approvals</h2>
        <p className="text-sm text-muted-foreground">
          Review resident villa-link requests. Approving a request instantly grants portal access —
          no separate signup approval is required.
        </p>
      </header>
      <PortalAccessRequestsInner />
    </div>
  );
}
