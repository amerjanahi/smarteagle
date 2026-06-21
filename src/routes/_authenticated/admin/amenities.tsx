import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/admin/amenities")({
  head: () => ({ meta: [{ title: "Amenities — Hayy Admin" }] }),
  component: AmenitiesPage,
});

type Amenity = { id: string; name: string; description: string | null; hourly_rate: number; capacity: number | null; is_active: boolean };

function AmenitiesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Amenity | null>(null);
  const [form, setForm] = useState({ name: "", description: "", hourly_rate: 0, capacity: 0, is_active: true });

  const { data: items = [] } = useQuery({
    queryKey: ["admin-amenities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("amenities").select("*").order("name");
      if (error) throw error;
      return data as Amenity[];
    },
  });

  const reset = () => { setEditing(null); setForm({ name: "", description: "", hourly_rate: 0, capacity: 0, is_active: true }); };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        hourly_rate: Number(form.hourly_rate) || 0,
        capacity: Number(form.capacity) || null,
        is_active: form.is_active,
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
    setForm({ name: a.name, description: a.description ?? "", hourly_rate: a.hourly_rate, capacity: a.capacity ?? 0, is_active: a.is_active });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Amenities</h1>
          <p className="text-sm text-muted-foreground">Pool, gym, hall, and other shared facilities.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New amenity</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit amenity" : "New amenity"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Hourly rate</Label><Input type="number" step="0.001" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })} /></div>
                <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
              <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Sparkles className="mx-auto mb-2 h-6 w-6" /> No amenities yet
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Hourly</TableHead><TableHead>Capacity</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell><div className="font-medium">{a.name}</div>{a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}</TableCell>
                  <TableCell>BHD {Number(a.hourly_rate).toFixed(3)}</TableCell>
                  <TableCell>{a.capacity ?? "—"}</TableCell>
                  <TableCell><Badge variant={a.is_active ? "default" : "outline"}>{a.is_active ? "Active" : "Inactive"}</Badge></TableCell>
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
