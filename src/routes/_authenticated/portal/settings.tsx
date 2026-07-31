import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, UserRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Hayy Resident Portal" },
      { name: "description", content: "Manage your resident account settings and personal details." },
      { property: "og:title", content: "Settings — Hayy Resident Portal" },
      { property: "og:description", content: "Manage your resident account settings and personal details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const items = [
  { to: "/portal/profile", label: "Personal details", icon: UserRound },
] as const;

function SettingsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account preferences.</p>
      </header>

      <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
        {items.map((it) => (
          <li key={it.to}>
            <Link to={it.to} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-accent/20">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/30 text-accent-foreground">
                <it.icon className="h-4 w-4" />
              </div>
              <span className="flex-1 font-medium">{it.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
