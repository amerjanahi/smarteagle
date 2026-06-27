import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminCreateUser, adminUpdateUser } from "@/lib/approvals.functions";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const ROLES = ["admin", "accountant", "resident", "owner", "tenant", "security"] as const;
type Role = (typeof ROLES)[number];

type Existing = {
  id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  roles: string[];
  approval_status: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user?: Existing | null;
}

export function UserFormDialog({ open, onOpenChange, user }: Props) {
  const qc = useQueryClient();
  const createFn = useServerFn(adminCreateUser);
  const updateFn = useServerFn(adminUpdateUser);
  const isEdit = !!user;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [roles, setRoles] = useState<Role[]>(["resident"]);
  const [status, setStatus] = useState<"approved" | "pending" | "rejected">("approved");

  useEffect(() => {
    if (open) {
      setEmail(user?.email ?? "");
      setPassword("");
      setFullName(user?.full_name ?? "");
      setPhone(user?.phone ?? "");
      setRoles(((user?.roles ?? ["resident"]) as Role[]).filter((r) => ROLES.includes(r)) as Role[]);
      setStatus((user?.approval_status as any) ?? "approved");
    }
  }, [open, user]);

  const save = useMutation({
    mutationFn: async () => {
      if (isEdit && user) {
        return updateFn({ data: {
          userId: user.id,
          fullName, phone: phone || null,
          email: email !== user.email ? email : undefined,
          password: password || undefined,
          roles, approvalStatus: status,
        }});
      }
      return createFn({ data: { email, password, fullName, phone: phone || undefined, roles }});
    },
    onSuccess: () => {
      toast.success(isEdit ? "User updated" : "User created");
      qc.invalidateQueries({ queryKey: ["all-signups"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const toggleRole = (r: Role) =>
    setRoles((cur) => cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Edit user" : "Add user"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} spellCheck />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{isEdit ? "New password (leave blank to keep)" : "Password"}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-3">
              {ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm capitalize">
                  <Checkbox checked={roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                  {r}
                </label>
              ))}
            </div>
          </div>
          {isEdit && (
            <div className="grid gap-1.5">
              <Label>Approval status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !email || !fullName || (!isEdit && !password) || roles.length === 0}
          >
            {save.isPending ? "Saving…" : isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
