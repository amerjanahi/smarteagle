import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Calculator, Bell, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/portal/more")({
  head: () => ({ meta: [{ title: "More — Hayy" }] }),
  component: MorePage,
});

const items = [
  { to: "/portal/amenities", label: "Book amenities", icon: CalendarDays },
  { to: "/portal/calculator", label: "Service charge calculator", icon: Calculator },
  { to: "/portal/announcements", label: "Announcements", icon: Bell },
] as const;

function MorePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold">More</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
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

      <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-[var(--shadow-soft)] hover:bg-accent/20">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-destructive/10 text-destructive">
          <LogOut className="h-4 w-4" />
        </div>
        <span className="font-medium text-destructive">Sign out</span>
      </button>
    </div>
  );
}
