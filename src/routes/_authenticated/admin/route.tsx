import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { pendingSignupCount } from "@/lib/approvals.functions";
import {
  LayoutDashboard, Home, Users, FileText, CreditCard, Receipt,
  BarChart3, Wrench, UserCheck, LogOut, Building2,
  TrendingUp, Wallet, Settings, FileSignature, ShieldCheck, ChevronDown,
  ShoppingBag, Truck, Sparkles, Megaphone, Mail, BookOpen, Landmark, ArrowLeftRight, ListPlus, GitCompare, Calculator,
  Bell, UserPlus,
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

const overviewGroup: NavGroup = { label: "Overview", items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }] };
const propertyGroup: NavGroup = { label: "Property", items: [
  { to: "/admin/units", label: "Units", icon: Home },
  { to: "/admin/residents", label: "Residents", icon: Users },
  { to: "/admin/amenities", label: "Amenities", icon: Sparkles },
]};
const opsItems: NavItem[] = [
  { to: "/admin/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/admin/visitors", label: "Visitors", icon: UserCheck },
];
const sysGroup: NavGroup = { label: "System", items: [{ to: "/admin/settings", label: "Settings", icon: Settings }] };

const salesItems: NavItem[] = [
  { to: "/admin/sales", label: "Sales Hub", icon: TrendingUp },
  { to: "/admin/invoices", label: "Invoices", icon: FileText },
  { to: "/admin/credit-notes", label: "Credit Notes", icon: Receipt },
  { to: "/admin/payments", label: "Receipts", icon: CreditCard },
  { to: "/admin/statements", label: "Statements", icon: FileSignature },
  { to: "/admin/templates", label: "Templates", icon: Settings },
  { to: "/admin/audit", label: "Audit Log", icon: ShieldCheck },
];

const purchasesItems: NavItem[] = [
  { to: "/admin/purchases", label: "Purchases Hub", icon: ShoppingBag },
  { to: "/admin/expenses", label: "Expenses", icon: Wallet },
  { to: "/admin/purchase-invoices", label: "Purchase Invoices", icon: FileText },
  { to: "/admin/vendors", label: "Vendors", icon: Truck },
  { to: "/admin/vendor-payments", label: "Payments", icon: CreditCard },
  { to: "/admin/purchase-reports", label: "Reports", icon: BarChart3 },
];

const commsItems: NavItem[] = [
  { to: "/admin/notices", label: "Notices", icon: Megaphone },
  { to: "/admin/notice-groups", label: "Groups", icon: Users },
  { to: "/admin/bulk-email", label: "Bulk Email", icon: Mail },
];

const bankItems: NavItem[] = [
  { to: "/admin/bank-accounts", label: "Bank Accounts", icon: Landmark },
  { to: "/admin/bank-transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/admin/bank-bulk-entry", label: "Bulk Entry", icon: ListPlus },
  { to: "/admin/bank-reconciliation", label: "Reconciliation", icon: GitCompare },
];

function AdminShell() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const inSales = salesItems.some((i) => pathname === i.to);
  const inPurch = purchasesItems.some((i) => pathname === i.to);
  const inBank = bankItems.some((i) => pathname === i.to);
  const [salesOpen, setSalesOpen] = useState(inSales);
  const [purchOpen, setPurchOpen] = useState(inPurch);
  const [bankOpen, setBankOpen] = useState(inBank);

  if (!loading && role !== "admin") {
    navigate({ to: "/portal", replace: true });
  }

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

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

  const renderSubsection = (
    label: string, icon: any, items: NavItem[], open: boolean, setOpen: (v: boolean) => void
  ) => {
    const Icon = icon;
    const active = items.some((i) => pathname === i.to);
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <SidebarMenuSubItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton isActive={active} className="justify-between">
              <span className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </SidebarMenuSubButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-2">
              {items.map((item) => (
                <li key={item.to}>
                  <SidebarMenuSubButton asChild isActive={pathname === item.to} size="sm">
                    <Link to={item.to}>
                      <item.icon className="h-3.5 w-3.5" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </SidebarMenuSubItem>
      </Collapsible>
    );
  };

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
                <p className="truncate text-sm font-bold">
                  Hello {(((user?.user_metadata as any)?.full_name as string | undefined)?.trim().split(/\s+/)[0]) || user?.email?.split("@")[0] || "Admin"}
                </p>
                <p className="truncate text-xs opacity-70">{user?.email}</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            {renderGroup(overviewGroup)}
            {renderGroup(propertyGroup)}

            {/* Finance group */}
            <SidebarGroup>
              <SidebarGroupLabel>Finance</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuSub>
                    {renderSubsection("Sales", TrendingUp, salesItems, salesOpen, setSalesOpen)}
                    {renderSubsection("Purchases", ShoppingBag, purchasesItems, purchOpen, setPurchOpen)}
                    {renderSubsection("Bank", Landmark, bankItems, bankOpen, setBankOpen)}
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === "/admin/chart-of-accounts"}>
                        <Link to="/admin/chart-of-accounts">
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Chart of Accounts</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === "/admin/annual-fees"}>
                        <Link to="/admin/annual-fees">
                          <Calculator className="h-3.5 w-3.5" />
                          <span>Annual Fees</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Operations group */}
            <SidebarGroup>
              <SidebarGroupLabel>Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {opsItems.map((item) => (
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

            {/* Communication — top-level group */}
            <SidebarGroup>
              <SidebarGroupLabel>Communication</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {commsItems.map((item) => (
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
