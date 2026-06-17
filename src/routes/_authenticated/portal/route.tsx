import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, FileText, Wrench, UserPlus, MoreHorizontal, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/portal")({
  component: PortalShell,
});

const tabs = [
  { to: "/portal", label: "Home", icon: Home },
  { to: "/portal/invoices", label: "Invoices", icon: FileText },
  { to: "/portal/maintenance", label: "Repairs", icon: Wrench },
  { to: "/portal/visitors", label: "Visitors", icon: UserPlus },
  { to: "/portal/more", label: "More", icon: MoreHorizontal },
] as const;

function PortalShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-1 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 backdrop-blur">
        <ul className="mx-auto flex max-w-2xl items-stretch">
          {tabs.map((t) => {
            const active = pathname === t.to;
            return (
              <li key={t.to} className="flex-1">
                <Link
                  to={t.to}
                  className={`flex flex-col items-center gap-1 py-2 text-xs transition-colors ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-5 w-5" />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
