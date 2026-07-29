import { createFileRoute } from "@tanstack/react-router";
import { ApprovalCenter } from "@/components/admin/ApprovalCenter";

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
          Review user access and security-sensitive account changes from one queue.
        </p>
      </header>
      <ApprovalCenter />
    </div>
  );
}
