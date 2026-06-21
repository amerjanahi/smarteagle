import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PURPOSE_LABELS } from "@/lib/booking-calculator";

export const Route = createFileRoute("/_authenticated/admin/amenity-bookings")({
  head: () => ({ meta: [{ title: "Amenity Bookings — Hayy Admin" }] }),
  component: BookingsPage,
});

type Status = "pending" | "confirmed" | "approved" | "rejected" | "cancelled" | "paid" | "completed";

type Booking = {
  id: string;
  amenity_id: string;
  status: Status;
  purpose: string;
  starts_at: string;
  ends_at: string;
  hours: number | null;
  base_amount: number;
  extras_amount: number;
  deposit_amount: number;
  vat_amount: number;
  total_amount: number;
  notes: string | null;
  requested_by: string | null;
  amenities?: { name: string } | null;
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", confirmed: "secondary", approved: "secondary",
  rejected: "destructive", cancelled: "destructive", paid: "default", completed: "default",
};

function BookingsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const { data: bookings = [] } = useQuery({
    queryKey: ["admin-bookings", filter],
    queryFn: async () => {
      let q = supabase.from("amenity_bookings").select("*, amenities(name)").order("starts_at", { ascending: false });
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

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Amenity Bookings</h1>
          <p className="text-sm text-muted-foreground">Approve, reject, or mark bookings as paid.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending approval</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </header>

      <div className="rounded-xl border border-border bg-card">
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
                <TableCell className="font-medium">{b.amenities?.name ?? "—"}</TableCell>
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
                      <Button size="sm" variant="default" onClick={() => setStatus.mutate({ id: b.id, status: "confirmed" })}>Confirm</Button>
                      <Button size="sm" variant="destructive" onClick={() => setStatus.mutate({ id: b.id, status: "rejected" })}>Reject</Button>
                    </>
                  )}
                  {b.status === "confirmed" && (
                    <Button size="sm" onClick={() => setStatus.mutate({ id: b.id, status: "paid" })}>Mark paid</Button>
                  )}
                  {(b.status === "pending" || b.status === "confirmed") && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: b.id, status: "cancelled" })}>Cancel</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
