import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Home, Users, FileText, CreditCard, Receipt,
  BarChart3, Wrench, UserCheck, LogOut, Building2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => {
    // role gating happens in the component to avoid double sessions checks
  },
  component: AdminShell,
});

const groups = [
  {
    label: "Overview",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Property",
    items: [
      { to: "/admin/units", label: "Units", icon: Home },
      { to: "/admin/residents", label: "Residents", icon: Users },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/admin/invoices", label: "Invoices", icon: FileText },
      { to: "/admin/payments", label: "Payments", icon: CreditCard },
      { to: "/admin/credit-notes", label: "Credit Notes", icon: Receipt },
      { to: "/admin/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/admin/maintenance", label: "Maintenance", icon: Wrench },
      { to: "/admin/visitors", label: "Visitors", icon: UserCheck },
    ],
  },
] as const;

function AdminShell() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!loading && role !== "admin") {
    navigate({ to: "/portal", replace: true });
  }

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">Hayy Admin</p>
                <p className="truncate text-xs opacity-70">{user?.email}</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            {groups.map((g) => (
              <SidebarGroup key={g.label}>
                <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {g.items.map((item) => {
                      const active = pathname === item.to;
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton asChild isActive={active}>
                            <Link to={item.to}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="justify-start">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-2 border-b border-border bg-card px-4">
            <SidebarTrigger />
            <h1 className="font-display text-base font-semibold">Admin Portal</h1>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
