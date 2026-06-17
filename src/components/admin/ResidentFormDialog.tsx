import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type ResidentFormValues = {
  id?: string;
  unit_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  resident_type: "owner" | "tenant";
  move_in_date: string | null;
  move_out_date: string | null;
  is_active: boolean;
};

const EMPTY: ResidentFormValues = {
  unit_id: "", full_name: "", email: "", phone: "",
  resident_type: "tenant", move_in_date: null, move_out_date: null, is_active: true,
};

export function ResidentFormDialog({
  open, onOpenChange, initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ResidentFormValues | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<ResidentFormValues>(EMPTY);
  const [unitSearch, setUnitSearch] = useState("");

  useEffect(() => {
    if (open) setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
  }, [open, initial]);

  const units = useQuery({
    queryKey: ["unit-picker", unitSearch],
    queryFn: async () => {
      let q = supabase.from("units").select("id, building, unit_number").order("building").order("unit_number").limit(50);
      if (unitSearch.trim()) q = q.ilike("unit_number", `%${unitSearch.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Ensure current unit is in the picker list when editing
  const currentUnit = useQuery({
    queryKey: ["unit-picker-current", form.unit_id],
    enabled: !!form.unit_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("id, building, unit_number").eq("id", form.unit_id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const options = (() => {
    const list = units.data ?? [];
    if (currentUnit.data && !list.some((u) => u.id === currentUnit.data!.id)) {
      return [currentUnit.data, ...list];
    }
    return list;
  })();

  const save = useMutation({
    mutationFn: async (v: ResidentFormValues) => {
      const payload = {
        unit_id: v.unit_id,
        full_name: v.full_name.trim(),
        email: v.email?.trim() || null,
        phone: v.phone?.trim() || null,
        resident_type: v.resident_type,
        move_in_date: v.move_in_date || null,
        move_out_date: v.move_out_date || null,
        is_active: v.is_active,
      };
      if (isEdit && initial?.id) {
        const { error } = await supabase.from("residents").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("residents").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Resident updated" : "Resident added");
      qc.invalidateQueries({ queryKey: ["residents"] });
      qc.invalidateQueries({ queryKey: ["residents-stats"] });
      qc.invalidateQueries({ queryKey: ["resident-detail"] });
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["unit-detail"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set<K extends keyof ResidentFormValues>(k: K, v: ResidentFormValues[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit resident" : "Add resident"}</DialogTitle>
          <DialogDescription>{isEdit ? "Update resident information." : "Register a new owner or tenant."}</DialogDescription>
        </DialogHeader>

        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.full_name.trim()) return toast.error("Full name is required");
            if (!form.unit_id) return toast.error("Pick a unit");
            save.mutate(form);
          }}
        >
          <div className="col-span-2">
            <Label>Full name *</Label>
            <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.resident_type} onValueChange={(v) => set("resident_type", v as "owner" | "tenant")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="tenant">Tenant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-1 items-center justify-between rounded-md border border-input px-3 py-2">
              <span className="text-sm">Active</span>
              <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            </div>
          </div>
          <div className="col-span-2">
            <Label>Unit *</Label>
            <Input
              placeholder="Search unit number…"
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
              className="mb-2"
            />
            <Select value={form.unit_id || undefined} onValueChange={(v) => set("unit_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {options.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.building ? `${u.building} · ` : ""}Unit {u.unit_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Move-in</Label>
            <Input type="date" value={form.move_in_date ?? ""} onChange={(e) => set("move_in_date", e.target.value || null)} />
          </div>
          <div>
            <Label>Move-out</Label>
            <Input type="date" value={form.move_out_date ?? ""} onChange={(e) => set("move_out_date", e.target.value || null)} />
          </div>

          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : isEdit ? "Save changes" : "Add resident"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
