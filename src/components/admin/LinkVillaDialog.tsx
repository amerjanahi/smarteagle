import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  adminListUserVillas, adminLinkVilla, adminUnlinkVilla, adminListUnits,
} from "@/lib/approvals.functions";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  userName: string;
}

const RELS = ["owner", "tenant", "family_member", "authorized_rep"] as const;

export function LinkVillaDialog({ open, onOpenChange, userId, userName }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListUserVillas);
  const unitsFn = useServerFn(adminListUnits);
  const linkFn = useServerFn(adminLinkVilla);
  const unlinkFn = useServerFn(adminUnlinkVilla);

  const villasQ = useQuery({
    queryKey: ["user-villas", userId], enabled: open,
    queryFn: () => listFn({ data: { userId } }),
  });
  const unitsQ = useQuery({
    queryKey: ["admin-units"], enabled: open, queryFn: () => unitsFn(),
  });

  const [villaId, setVillaId] = useState("");
  const [rel, setRel] = useState<(typeof RELS)[number]>("tenant");

  const link = useMutation({
    mutationFn: () => linkFn({ data: { userId, villaId, relationshipType: rel }}),
    onSuccess: () => {
      toast.success("Villa linked");
      setVillaId("");
      qc.invalidateQueries({ queryKey: ["user-villas", userId] });
      qc.invalidateQueries({ queryKey: ["all-signups"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unlink = useMutation({
    mutationFn: (linkId: string) => unlinkFn({ data: { linkId }}),
    onSuccess: () => {
      toast.success("Villa unlinked");
      qc.invalidateQueries({ queryKey: ["user-villas", userId] });
      qc.invalidateQueries({ queryKey: ["all-signups"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Link villas — {userName}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Current links</Label>
            <div className="mt-2 space-y-2">
              {villasQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
              {villasQ.data?.length === 0 && <div className="text-sm text-muted-foreground">No villas linked.</div>}
              {(villasQ.data ?? []).map((v: any) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-border p-2">
                  <div className="text-sm">
                    <div className="font-medium">{v.units?.unit_number ?? "—"} {v.units?.building ? `· ${v.units.building}` : ""}</div>
                    <div className="text-xs text-muted-foreground capitalize">{v.relationship_type} · {v.status}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => unlink.mutate(v.id)} disabled={unlink.isPending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 border-t border-border pt-4">
            <Label>Add villa</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={villaId} onValueChange={setVillaId}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {(unitsQ.data ?? []).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.unit_number}{u.building ? ` · ${u.building}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rel} onValueChange={(v) => setRel(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => link.mutate()} disabled={!villaId || link.isPending} className="w-fit">
              {link.isPending ? "Linking…" : "Link villa"}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
