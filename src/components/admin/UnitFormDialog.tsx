import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type UnitFormValues = {
  id?: string;
  building: string | null;
  unit_number: string;
  floor: number | null;
  bedrooms: number | null;
  land_area_sqm: number | null;
  built_up_area_sqm: number | null;
  monthly_service_charge: number | null;
  handover_date: string | null;
  notes: string | null;
};

const EMPTY: UnitFormValues = {
  building: "", unit_number: "", floor: null, bedrooms: null,
  land_area_sqm: null, built_up_area_sqm: null, monthly_service_charge: null,
  handover_date: null, notes: "",
};

export function UnitFormDialog({
  open, onOpenChange, initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: UnitFormValues | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<UnitFormValues>(EMPTY);

  useEffect(() => {
    if (open) setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
  }, [open, initial]);

  const save = useMutation({
    mutationFn: async (v: UnitFormValues) => {
      const payload = {
        building: (v.building?.trim() || ""),
        unit_number: v.unit_number.trim(),
        floor: v.floor,
        bedrooms: v.bedrooms,
        land_area_sqm: v.land_area_sqm,
        built_up_area_sqm: v.built_up_area_sqm,
        monthly_service_charge: v.monthly_service_charge,
        handover_date: v.handover_date || null,
        notes: v.notes?.trim() || null,
      };
      if (isEdit && initial?.id) {
        const { error } = await supabase.from("units").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("units").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Unit updated" : "Unit added");
      qc.invalidateQueries({ queryKey: ["units"] });
      qc.invalidateQueries({ queryKey: ["units-stats"] });
      qc.invalidateQueries({ queryKey: ["unit-buildings"] });
      qc.invalidateQueries({ queryKey: ["unit-detail"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set<K extends keyof UnitFormValues>(k: K, v: UnitFormValues[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  const num = (s: string): number | null => (s === "" ? null : Number(s));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit unit" : "Add unit"}</DialogTitle>
          <DialogDescription>{isEdit ? "Update unit information." : "Create a new unit in the community."}</DialogDescription>
        </DialogHeader>

        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.unit_number.trim()) return toast.error("Unit number is required");
            save.mutate(form);
          }}
        >
          <div className="col-span-2">
            <Label>Unit number *</Label>
            <Input value={form.unit_number} onChange={(e) => set("unit_number", e.target.value)} required />
          </div>
          <div className="col-span-2">
            <Label>Building</Label>
            <Input value={form.building ?? ""} onChange={(e) => set("building", e.target.value)} />
          </div>
          <div>
            <Label>Floor</Label>
            <Input type="number" value={form.floor ?? ""} onChange={(e) => set("floor", num(e.target.value))} />
          </div>
          <div>
            <Label>Bedrooms</Label>
            <Input type="number" value={form.bedrooms ?? ""} onChange={(e) => set("bedrooms", num(e.target.value))} />
          </div>
          <div>
            <Label>Land area (m²)</Label>
            <Input type="number" step="0.01" value={form.land_area_sqm ?? ""} onChange={(e) => set("land_area_sqm", num(e.target.value))} />
          </div>
          <div>
            <Label>Built-up area (m²)</Label>
            <Input type="number" step="0.01" value={form.built_up_area_sqm ?? ""} onChange={(e) => set("built_up_area_sqm", num(e.target.value))} />
          </div>
          <div>
            <Label>Service charge (BHD)</Label>
            <Input type="number" step="0.001" value={form.monthly_service_charge ?? ""} onChange={(e) => set("monthly_service_charge", num(e.target.value))} />
          </div>
          <div>
            <Label>Handover date</Label>
            <Input type="date" value={form.handover_date ?? ""} onChange={(e) => set("handover_date", e.target.value || null)} />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : isEdit ? "Save changes" : "Add unit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
