import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/amenities")({
  head: () => ({ meta: [{ title: "Amenities — Hayy" }] }),
  component: AmenitiesPage,
});

function AmenitiesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amenity_id: "", starts_at: "", ends_at: "", notes: "" });

  const { data: amenities } = useQuery({
    queryKey: ["amenities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("amenities").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("amenity_bookings").select("*, amenities(name)").eq("requested_by", user!.id)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const book = useMutation({
    mutationFn: async () => {
      const { data: residents } = await supabase
        .from("residents").select("unit_id").eq("user_id", user!.id).limit(1);
      const unit_id = residents?.[0]?.unit_id ?? null;
      const { error } = await supabase.from("amenity_bookings").insert({
        amenity_id: form.amenity_id,
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        notes: form.notes || null,
        requested_by: user!.id,
        unit_id,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking requested");
      setOpen(false);
      setForm({ amenity_id: "", starts_at: "", ends_at: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Amenities</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm">Book</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Book an amenity</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Amenity</Label>
                <Select value={form.amenity_id} onValueChange={(v) => setForm({ ...form, amenity_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>
                    {amenities?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} — BHD {Number(a.hourly_rate).toFixed(3)}/hr</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Start</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
              <div><Label>End</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={() => book.mutate()} disabled={!form.amenity_id || !form.starts_at || !form.ends_at || book.isPending} className="w-full">
                Request booking
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Available</h2>
        {(amenities?.length ?? 0) === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-5 w-5" />No amenities listed yet
          </p>
        )}
        <ul className="grid grid-cols-2 gap-2">
          {amenities?.map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-soft)]">
              <p className="font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground">BHD {Number(a.hourly_rate).toFixed(3)}/hr</p>
              {a.capacity && <p className="text-xs text-muted-foreground">Cap. {a.capacity}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">My bookings</h2>
        {(bookings?.length ?? 0) === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <CalendarDays className="mx-auto mb-2 h-5 w-5" />No bookings yet
          </p>
        )}
        <ul className="space-y-2">
          {bookings?.map((b) => (
            <li key={b.id} className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-soft)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{(b.amenities as { name: string } | null)?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(b.starts_at).toLocaleString()} → {new Date(b.ends_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline">{b.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
