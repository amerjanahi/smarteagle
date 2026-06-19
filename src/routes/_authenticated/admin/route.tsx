import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Home, Users, FileText, CreditCard, Receipt,
  BarChart3, Wrench, UserCheck, LogOut, Building2,
  TrendingUp, Wallet, Settings, FileSignature, ShieldCheck, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton,
  SidebarMenuSubItem, SidebarProvider, SidebarTrigger, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminShell,
});

type NavItem = { to: string; label: string; icon: any };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  { label: "Overview", items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Property", items: [
    { to: "/admin/units", label: "Units", icon: Home },
    { to: "/admin/residents", label: "Residents", icon: Users },
  ]},
  { label: "Finance", items: [
    { to: "/admin/expenses", label: "Expenses", icon: Wallet },
    { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  ]},
  { label: "Operations", items: [
    { to: "/admin/maintenance", label: "Maintenance", icon: Wrench },
    { to: "/admin/visitors", label: "Visitors", icon: UserCheck },
  ]},
  { label: "System", items: [{ to: "/admin/settings", label: "Settings", icon: Settings }] },
];

const salesGroup = {
  label: "Sales",
  icon: TrendingUp,
  items: [
    { to: "/admin/sales", label: "Sales Hub", icon: TrendingUp },
    { to: "/admin/invoices", label: "Invoices", icon: FileText },
    { to: "/admin/credit-notes", label: "Credit Notes", icon: Receipt },
    { to: "/admin/payments", label: "Receipts & Payments", icon: CreditCard },
    { to: "/admin/statements", label: "Statements", icon: FileSignature },
    { to: "/admin/templates", label: "Templates", icon: Settings },
    { to: "/admin/audit", label: "Audit Log", icon: ShieldCheck },
  ],
};

function AdminShell() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [salesOpen, setSalesOpen] = useState(
    () => salesGroup.items.some((i) => pathname.startsWith(i.to))
  );

  if (!loading && role !== "admin") {
    navigate({ to: "/portal", replace: true });
  }

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const overviewGroup = groups[0];
  const propertyGroup = groups[1];
  const financeGroup = groups[2];
  const opsGroup = groups[3];
  const sysGroup = groups[4];

  const renderGroup = (g: NavGroup) => (
    <SidebarGroup key={g.label}>
      <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {g.items.map((item) => (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton asChild isActive={pathname === item.to}>
                <Link to={item.to}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

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
            {renderGroup(overviewGroup)}
            {renderGroup(propertyGroup)}

            {/* Collapsible Sales group */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible open={salesOpen} onOpenChange={setSalesOpen} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          isActive={salesGroup.items.some((i) => pathname === i.to)}
                          className="justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <salesGroup.icon className="h-4 w-4" />
                            <span>{salesGroup.label}</span>
                          </span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${salesOpen ? "rotate-180" : ""}`} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {salesGroup.items.map((item) => (
                            <SidebarMenuSubItem key={item.to}>
                              <SidebarMenuSubButton asChild isActive={pathname === item.to}>
                                <Link to={item.to}>
                                  <item.icon className="h-3.5 w-3.5" />
                                  <span>{item.label}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {renderGroup(financeGroup)}
            {renderGroup(opsGroup)}
            {renderGroup(sysGroup)}
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
