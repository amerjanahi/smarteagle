import { createFileRoute, Outlet, Link, useRouterState, useNavigate, redirect } from "@tanstack/react-router";
import { Home, FileText, Wrench, UserPlus, MoreHorizontal, LogOut, Briefcase } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEmployee } from "@/lib/hr.functions";

export const Route = createFileRoute("/_authenticated/portal")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });

    const [{ data: roles }, { data: villaLinks }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("user_villas").select("id").eq("user_id", user.id).eq("status", "active").limit(1),
    ]);
    const roleNames = (roles ?? []).map((row: any) => row.role);
    const isResidentOnly =
      roleNames.includes("resident") &&
      !roleNames.some((role: string) => ["admin", "operations", "security", "hr", "accountant"].includes(role));

    // Stage two: a resident approved by the admin may only complete villa
    // onboarding until the selected relationship is approved.
    if (isResidentOnly && !villaLinks?.length) {
      throw redirect({ to: "/link-villa" });
    }
  },
  component: PortalShell,
});

const baseTabs = [
  { to: "/portal", label: "Home", icon: Home },
  { to: "/portal/invoices", label: "Invoices", icon: FileText },
  { to: "/portal/maintenance", label: "Repairs", icon: Wrench },
  { to: "/portal/visitors", label: "Visitors", icon: UserPlus },
  { to: "/portal/more", label: "More", icon: MoreHorizontal },
] as const;
const workTab = { to: "/portal/work", label: "Work", icon: Briefcase } as const;

function PortalShell() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const meEmpFn = useServerFn(getMyEmployee);
  const { data: meEmp } = useQuery({
    queryKey: ["me-emp"],
    queryFn: () => meEmpFn(),
    enabled: role !== "admin",
  });
  const tabs = meEmp ? [...baseTabs.slice(0, 4), workTab, baseTabs[4]] : baseTabs;

  async function handleSignOut() {
    const { biometric } = await import("@/lib/biometric");
    await biometric.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
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

      <nav aria-label="Resident navigation" className="safe-bottom fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 backdrop-blur">
        <ul className="mx-auto flex max-w-2xl items-stretch">
          {tabs.map((t) => {
            const active = pathname === t.to;
            return (
              <li key={t.to} className="flex-1">
                <Link
                  to={t.to}
                  preload="intent"
                  aria-current={active ? "page" : undefined}
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
