import { useState, type ReactNode } from "react";
import { KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalAccessRequestsInner } from "@/routes/_authenticated/admin/portal-access-requests";
import { ProfileChangeRequestsInner } from "@/routes/_authenticated/admin/profile-change-requests";

type PermissionType = "all" | "portal_access" | "profile_change";

const PERMISSION_TYPES = {
  portal_access: {
    title: "Portal access",
    description: "Villa links and the resident’s relationship or permission for that property.",
    icon: KeyRound,
  },
  profile_change: {
    title: "Profile & email changes",
    description: "Password-verified requests to change identity or login contact information.",
    icon: MailCheck,
  },
} as const;

export function ApprovalCenter() {
  const [permissionType, setPermissionType] = useState<PermissionType>("all");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <h4 className="font-semibold">Approval Center</h4>
            <p className="text-sm text-muted-foreground">One queue for user permissions and security-sensitive account changes.</p>
          </div>
        </div>
        <div className="w-full sm:w-64">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Permission type</label>
          <Select value={permissionType} onValueChange={(value) => setPermissionType(value as PermissionType)}>
            <SelectTrigger aria-label="Permission type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All permission types</SelectItem>
              <SelectItem value="portal_access">Portal access</SelectItem>
              <SelectItem value="profile_change">Profile &amp; email changes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(permissionType === "all" || permissionType === "portal_access") && (
        <ApprovalSection type="portal_access"><PortalAccessRequestsInner /></ApprovalSection>
      )}
      {(permissionType === "all" || permissionType === "profile_change") && (
        <ApprovalSection type="profile_change"><ProfileChangeRequestsInner /></ApprovalSection>
      )}
    </div>
  );
}

function ApprovalSection({ type, children }: { type: keyof typeof PERMISSION_TYPES; children: ReactNode }) {
  const config = PERMISSION_TYPES[type];
  const Icon = config.icon;
  return (
    <section className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
      <header className="flex items-start gap-3 border-b pb-3">
        <Icon className="mt-0.5 h-5 w-5 text-primary" />
        <div><h4 className="font-semibold">{config.title}</h4><p className="text-sm text-muted-foreground">{config.description}</p></div>
      </header>
      {children}
    </section>
  );
}
