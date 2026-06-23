import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PURPOSE_LABELS, calcBooking, hoursBetween } from "@/lib/booking-calculator";

export const Route = createFileRoute("/_authenticated/admin/amenity-bookings")({
  head: () => ({ meta: [{ title: "Amenity Bookings — Hayy Admin" }] }),
  component: BookingsPage,
});

type Status = "pending" | "confirmed" | "approved" | "rejected" | "cancelled" | "paid" | "completed";

type Booking = {
  id: string; amenity_id: string; status: Status; purpose: string;
  starts_at: string; ends_at: string; hours: number | null;
  base_amount: number; extras_amount: number; deposit_amount: number;
  vat_amount: number; total_amount: number; notes: string | null;
  requested_by: string | null; unit_id: string | null;
  amenities?: { name: string; requires_approval?: boolean } | null;
};

type Amenity = { id: string; name: string; hourly_rate: number; deposit_amount: number; vat_rate: number; requires_approval: boolean };
type Resident = { id: string; full_name: string; unit_id: string | null; user_id: string | null };

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", confirmed: "secondary", approved: "secondary",
  rejected: "destructive", cancelled: "destructive", paid: "default", completed: "default",
};

function localDT(iso: string) { return new Date(iso).toISOString().slice(0,16); }

function BookingsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [reschedule, setReschedule] = useState<Booking | null>(null);

  const { data: bookings = [] } = useQuery({
    queryKey: ["admin-bookings", filter],
    queryFn: async () => {
      let q = supabase.from("amenity_bookings").select("*, amenities(name,requires_approval)").order("starts_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter as never);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Booking[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("amenity_bookings").update({ status } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-bookings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rescheduleMut = useMutation({
    mutationFn: async ({ id, starts_at, ends_at }: { id: string; starts_at: string; ends_at: string }) => {
      const { error } = await supabase.from("amenity_bookings").update({ starts_at, ends_at } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rescheduled"); qc.invalidateQueries({ queryKey: ["admin-bookings"] }); setReschedule(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Amenity Bookings</h1>
          <p className="text-sm text-muted-foreground">Approve, reject, reschedule, or book on behalf of residents.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending approval</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New booking</Button></DialogTrigger>
            <NewBookingDialog onClose={() => setCreateOpen(false)} />
          </Dialog>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Amenity</TableHead><TableHead>When</TableHead><TableHead>Purpose</TableHead>
            <TableHead>Hours</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {bookings.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No bookings</TableCell></TableRow>
            ) : bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  {b.amenities?.name ?? "—"}
                  {b.amenities?.requires_approval && <Badge variant="outline" className="ml-2 text-xs">Needs approval</Badge>}
                </TableCell>
                <TableCell className="text-xs">
                  {new Date(b.starts_at).toLocaleString()}<br />
                  → {new Date(b.ends_at).toLocaleString()}
                </TableCell>
                <TableCell>{PURPOSE_LABELS[b.purpose as keyof typeof PURPOSE_LABELS] ?? b.purpose}</TableCell>
                <TableCell>{b.hours ?? "—"}</TableCell>
                <TableCell>BHD {Number(b.total_amount).toFixed(3)}</TableCell>
                <TableCell><Badge variant={STATUS_COLORS[b.status] ?? "outline"}>{b.status}</Badge></TableCell>
                <TableCell className="space-x-1 text-right">
                  {b.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => setStatus.mutate({ id: b.id, status: "approved" })}>Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => setStatus.mutate({ id: b.id, status: "rejected" })}>Reject</Button>
                    </>
                  )}
                  {(b.status === "approved" || b.status === "confirmed") && (
                    <Button size="sm" onClick={() => setStatus.mutate({ id: b.id, status: "paid" })}>Mark paid</Button>
                  )}
                  {(b.status === "pending" || b.status === "confirmed" || b.status === "approved") && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setReschedule(b)}><CalendarIcon className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: b.id, status: "cancelled" })}>Cancel</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!reschedule} onOpenChange={(v) => !v && setReschedule(null)}>
        <RescheduleDialog booking={reschedule} onSave={(s,e) => reschedule && rescheduleMut.mutate({ id: reschedule.id, starts_at: s, ends_at: e })} />
      </Dialog>
    </div>
  );
}

function RescheduleDialog({ booking, onSave }: { booking: Booking | null; onSave: (s: string, e: string) => void }) {
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  useEffect(() => { if (booking) { setStarts(localDT(booking.starts_at)); setEnds(localDT(booking.ends_at)); } }, [booking]);
  if (!booking) return null;
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Reschedule booking</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Starts</Label><Input type="datetime-local" value={starts} onChange={e => setStarts(e.target.value)} /></div>
        <div><Label>Ends</Label><Input type="datetime-local" value={ends} onChange={e => setEnds(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(new Date(starts).toISOString(), new Date(ends).toISOString())}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function NewBookingDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [amenityId, setAmenityId] = useState("");
  const [residentId, setResidentId] = useState("");
  const [purpose, setPurpose] = useState<keyof typeof PURPOSE_LABELS>("personal");
  const [starts, setStarts] = useState(new Date().toISOString().slice(0,16));
  const [ends, setEnds] = useState(new Date(Date.now()+3600000).toISOString().slice(0,16));
  const [notes, setNotes] = useState("");

  const { data: amenities = [] } = useQuery({
    queryKey: ["amenities-for-booking"],
    queryFn: async () => {
      const { data } = await supabase.from("amenities").select("id,name,hourly_rate,deposit_amount,vat_rate,requires_approval").eq("is_active", true).order("name");
      return (data ?? []) as Amenity[];
    },
  });
  const { data: residents = [] } = useQuery({
    queryKey: ["residents-for-booking"],
    queryFn: async () => {
      const { data } = await supabase.from("residents").select("id,full_name,unit_id,user_id").eq("is_active", true).order("full_name");
      return (data ?? []) as Resident[];
    },
  });

  const amenity = amenities.find(a => a.id === amenityId);
  const resident = residents.find(r => r.id === residentId);
  const hours = useMemo(() => hoursBetween(new Date(starts).toISOString(), new Date(ends).toISOString()), [starts, ends]);
  const calc = useMemo(() => amenity ? calcBooking({
    hourlyRate: Number(amenity.hourly_rate), hours, purpose,
    deposit: Number(amenity.deposit_amount), vatRate: Number(amenity.vat_rate), extras: [],
  }) : null, [amenity, hours, purpose]);

  const create = useMutation({
    mutationFn: async () => {
      if (!amenity) throw new Error("Pick an amenity");
      const status: Status = amenity.requires_approval ? "pending" : "confirmed";
      const payload: any = {
        amenity_id: amenity.id,
        unit_id: resident?.unit_id ?? null,
        requested_by: resident?.user_id ?? null,
        starts_at: new Date(starts).toISOString(),
        ends_at: new Date(ends).toISOString(),
        purpose, status, notes: notes || null,
        hours: calc?.hours ?? 0,
        base_amount: calc?.baseAmount ?? 0,
        extras_amount: calc?.extrasAmount ?? 0,
        deposit_amount: calc?.depositAmount ?? 0,
        vat_rate: amenity.vat_rate,
        vat_amount: calc?.vatAmount ?? 0,
        total_amount: calc?.totalAmount ?? 0,
        extras: [],
      };
      const { error } = await supabase.from("amenity_bookings").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Booking created"); qc.invalidateQueries({ queryKey: ["admin-bookings"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>New booking</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Amenity</Label>
          <Select value={amenityId} onValueChange={setAmenityId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{amenities.map(a => <SelectItem key={a.id} value={a.id}>{a.name}{a.requires_approval ? " (approval)" : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Resident / Owner</Label>
          <Select value={residentId} onValueChange={setResidentId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{residents.map(r => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Starts</Label><Input type="datetime-local" value={starts} onChange={e => setStarts(e.target.value)} /></div>
        <div><Label>Ends</Label><Input type="datetime-local" value={ends} onChange={e => setEnds(e.target.value)} /></div>
        <div className="sm:col-span-2">
          <Label>Purpose</Label>
          <Select value={purpose} onValueChange={(v: any) => setPurpose(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PURPOSE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      </div>
      {calc && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Hours</span><span>{calc.hours}</span></div>
          <div className="flex justify-between"><span>Base</span><span>BHD {calc.baseAmount.toFixed(3)}</span></div>
          <div className="flex justify-between"><span>Deposit</span><span>BHD {calc.depositAmount.toFixed(3)}</span></div>
          <div className="flex justify-between"><span>VAT</span><span>BHD {calc.vatAmount.toFixed(3)}</span></div>
          <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>BHD {calc.totalAmount.toFixed(3)}</span></div>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => create.mutate()} disabled={!amenityId || create.isPending}>Create</Button>
      </DialogFooter>
    </DialogContent>
  );
}
