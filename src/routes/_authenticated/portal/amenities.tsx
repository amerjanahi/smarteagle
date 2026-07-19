import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcBooking, hoursBetween, PURPOSE_LABELS, type BookingPurpose, type ExtraService } from "@/lib/booking-calculator";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/_authenticated/portal/amenities")({
  head: () => ({ meta: [{ title: "Book Amenities — Hayy" }] }),
  component: PortalAmenities,
});

type Amenity = {
  id: string; name: string; description: string | null;
  hourly_rate: number; capacity: number | null; is_active: boolean;
  requires_approval: boolean; deposit_amount: number; vat_rate: number; portal_bookable: boolean;
};

type MyBooking = {
  id: string; status: string; purpose: string; starts_at: string; ends_at: string;
  total_amount: number; amenities?: { name: string } | null;
};

function PortalAmenities() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Amenity | null>(null);

  const { data: amenities = [] } = useQuery({
    queryKey: ["portal-amenities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("amenities").select("*")
        .eq("is_active", true).eq("portal_bookable", true).order("name");
      if (error) throw error;
      return data as unknown as Amenity[];
    },
  });

  const { data: mine = [] } = useQuery({
    queryKey: ["portal-my-bookings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("amenity_bookings")
        .select("*, amenities(name)").eq("requested_by", user!.id)
        .order("starts_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data as unknown as MyBooking[];
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold">Book amenities</h1>
        <p className="text-sm text-muted-foreground">Reserve pool, hall, gym & more.</p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {amenities.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground sm:col-span-2">
            No bookable amenities right now.
          </div>
        )}
        {amenities.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{a.name}</h3>
                {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
              </div>
              {a.requires_approval && <Badge variant="outline">Approval</Badge>}
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>BHD {Number(a.hourly_rate).toFixed(3)}/hr</span>
              <Button size="sm" onClick={() => setSelected(a)}><Plus className="mr-1 h-4 w-4" />Book</Button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">My bookings</h2>
        {mine.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <CalendarDays className="mx-auto mb-2 h-5 w-5" />No bookings yet
          </div>
        ) : (
          <ul className="space-y-2">
            {mine.map((b) => (
              <li key={b.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{b.amenities?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(b.starts_at).toLocaleString()} • {PURPOSE_LABELS[b.purpose as BookingPurpose] ?? b.purpose}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={b.status === "paid" ? "default" : b.status === "rejected" || b.status === "cancelled" ? "destructive" : "secondary"}>{b.status}</Badge>
                  <p className="mt-1 text-xs">BHD {Number(b.total_amount).toFixed(3)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <BookDialog
          amenity={selected}
          onClose={() => setSelected(null)}
          onBooked={() => {
            qc.invalidateQueries({ queryKey: ["portal-my-bookings"] });
            setSelected(null);
          }}
          userId={user?.id ?? null}
        />
      )}
    </div>
  );
}

function BookDialog({ amenity, onClose, onBooked, userId }: {
  amenity: Amenity; onClose: () => void; onBooked: () => void; userId: string | null;
}) {
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [purpose, setPurpose] = useState<BookingPurpose>("personal");
  const [notes, setNotes] = useState("");
  const [extras, setExtras] = useState<ExtraService[]>([]);
  const [extraName, setExtraName] = useState("");
  const [extraAmount, setExtraAmount] = useState(0);

  const hours = useMemo(() => hoursBetween(startsAt, endsAt), [startsAt, endsAt]);
  const breakdown = useMemo(() => calcBooking({
    hourlyRate: amenity.hourly_rate, hours, purpose,
    deposit: amenity.deposit_amount, vatRate: amenity.vat_rate, extras,
  }), [amenity, hours, purpose, extras]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      if (!startsAt || !endsAt || hours <= 0) throw new Error("Pick a valid time range");
      const status = amenity.requires_approval ? "pending" : "confirmed";
      const { error } = await supabase.from("amenity_bookings").insert({
        amenity_id: amenity.id,
        requested_by: userId,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        status,
        purpose,
        notes: notes || null,
        hours,
        base_amount: breakdown.base,
        extras_amount: breakdown.extras,
        deposit_amount: breakdown.deposit,
        vat_rate: amenity.vat_rate,
        vat_amount: breakdown.vatAmount,
        total_amount: breakdown.total,
        extras: extras as never,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(amenity.requires_approval ? "Booking submitted for approval" : "Booking confirmed");
      onBooked();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addExtra() {
    if (!extraName || extraAmount <= 0) return;
    setExtras([...extras, { name: extraName, amount: Number(extraAmount) }]);
    setExtraName(""); setExtraAmount(0);
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Book {amenity.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
            <div><Label>End</Label><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
          </div>
          <div>
            <Label>Purpose</Label>
            <Select value={purpose} onValueChange={(v) => setPurpose(v as BookingPurpose)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PURPOSE_LABELS) as BookingPurpose[]).map((k) => (
                  <SelectItem key={k} value={k}>{PURPOSE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything we should know?" />
          </div>

          <div className="rounded-lg border border-border p-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Extra services</Label>
            <div className="mt-2 flex gap-2">
              <Input placeholder="e.g. Setup crew" value={extraName} onChange={(e) => setExtraName(e.target.value)} />
              <Input type="number" step="0.001" placeholder="BHD" className="w-28" value={extraAmount} onChange={(e) => setExtraAmount(Number(e.target.value))} />
              <Button type="button" size="sm" variant="outline" onClick={addExtra}>Add</Button>
            </div>
            {extras.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {extras.map((e, i) => (
                  <li key={i} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
                    <span>{e.name}</span>
                    <span className="flex items-center gap-2">BHD {e.amount.toFixed(3)}
                      <button onClick={() => setExtras(extras.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Calculator</p>
            <div className="flex justify-between"><span>{hours} hrs × BHD {amenity.hourly_rate.toFixed(3)} × {breakdown.multiplier}×</span><span>BHD {breakdown.base.toFixed(3)}</span></div>
            <div className="flex justify-between"><span>Extras</span><span>BHD {breakdown.extras.toFixed(3)}</span></div>
            <div className="flex justify-between"><span>VAT {amenity.vat_rate}%</span><span>BHD {breakdown.vatAmount.toFixed(3)}</span></div>
            <div className="flex justify-between"><span>Deposit</span><span>BHD {breakdown.deposit.toFixed(3)}</span></div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold"><span>Total</span><span>BHD {breakdown.total.toFixed(3)}</span></div>
          </div>

          {amenity.requires_approval && (
            <p className="rounded bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
              This amenity requires admin approval before confirmation.
            </p>
          )}

          <Button className="w-full" disabled={submit.isPending || hours <= 0} onClick={() => submit.mutate()}>
            {amenity.requires_approval ? "Submit for approval" : "Confirm booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
