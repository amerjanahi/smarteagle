import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Hayy Admin" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-display text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Organisation, billing, and team preferences.</p>
      </header>
      <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="font-medium">Settings module coming soon</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage company profile, currency, tax rates, and team members.
        </p>
      </div>
    </div>
  );
}
