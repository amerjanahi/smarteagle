import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrency } from "@/hooks/use-currency";

type Amenity = {
  id: string; name: string; description: string | null; hourly_rate: number;
  capacity: number | null; is_active: boolean; requires_approval: boolean;
  deposit_amount: number; vat_rate: number; portal_bookable: boolean;
};

const empty = {
  name: "", description: "", hourly_rate: 0, capacity: 0, is_active: true,
  requires_approval: false, deposit_amount: 0, vat_rate: 10, portal_bookable: true,
};

export default function AmenitiesManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Amenity | null>(null);
  const [form, setForm] = useState(empty);

  const { data: items = [] } = useQuery({
    queryKey: ["admin-amenities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("amenities").select("*").order("name");
      if (error) throw error;
      return data as unknown as Amenity[];
    },
  });

  const reset = () => { setEditing(null); setForm(empty); };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        hourly_rate: Number(form.hourly_rate) || 0,
        capacity: Number(form.capacity) || null,
        is_active: form.is_active,
        requires_approval: form.requires_approval,
        deposit_amount: Number(form.deposit_amount) || 0,
        vat_rate: Number(form.vat_rate) || 0,
        portal_bookable: form.portal_bookable,
      };
      if (editing) {
        const { error } = await supabase.from("amenities").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("amenities").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); setOpen(false); reset(); qc.invalidateQueries({ queryKey: ["admin-amenities"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amenities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-amenities"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(a: Amenity) {
    setEditing(a);
    setForm({
      name: a.name, description: a.description ?? "", hourly_rate: a.hourly_rate,
      capacity: a.capacity ?? 0, is_active: a.is_active,
      requires_approval: a.requires_approval, deposit_amount: a.deposit_amount,
      vat_rate: a.vat_rate, portal_bookable: a.portal_bookable,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New amenity</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Edit amenity" : "New amenity"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Hourly rate (BHD)</Label><Input type="number" step="0.001" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })} /></div>
                <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
                <div><Label>Deposit (BHD)</Label><Input type="number" step="0.001" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: Number(e.target.value) })} /></div>
                <div><Label>VAT rate %</Label><Input type="number" step="0.01" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
              <div className="flex items-center justify-between"><Label>Bookable from resident portal</Label><Switch checked={form.portal_bookable} onCheckedChange={(v) => setForm({ ...form, portal_bookable: v })} /></div>
              <div className="flex items-center justify-between"><Label>Requires admin approval</Label><Switch checked={form.requires_approval} onCheckedChange={(v) => setForm({ ...form, requires_approval: v })} /></div>
              <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Sparkles className="mx-auto mb-2 h-6 w-6" /> No amenities yet
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Hourly</TableHead><TableHead>Deposit</TableHead>
              <TableHead>VAT%</TableHead><TableHead>Capacity</TableHead><TableHead>Flags</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell><div className="font-medium">{a.name}</div>{a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}</TableCell>
                  <TableCell>BHD {Number(a.hourly_rate).toFixed(3)}</TableCell>
                  <TableCell>BHD {Number(a.deposit_amount).toFixed(3)}</TableCell>
                  <TableCell>{Number(a.vat_rate).toFixed(2)}%</TableCell>
                  <TableCell>{a.capacity ?? "—"}</TableCell>
                  <TableCell className="space-x-1">
                    <Badge variant={a.is_active ? "default" : "outline"}>{a.is_active ? "Active" : "Inactive"}</Badge>
                    {a.portal_bookable && <Badge variant="secondary">Portal</Badge>}
                    {a.requires_approval && <Badge variant="outline">Approval</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => del.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
