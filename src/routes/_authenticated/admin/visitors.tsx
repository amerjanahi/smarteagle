import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, UserCheck, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/visitors")({
  head: () => ({ meta: [{ title: "Visitors — Hayy Admin" }] }),
  component: VisitorsAdminPage,
});

const qrUrl = (code: string) => `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(code)}`;

function VisitorsAdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [qrFor, setQrFor] = useState<any | null>(null);
  const [form, setForm] = useState({ unit_id: "", visitor_name: "", visitor_phone: "", car_plate: "", expected_at: "", purpose: "" });

  const { data: units = [] } = useQuery({
    queryKey: ["units-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("id, unit_number, building").order("unit_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: visitors = [] } = useQuery({
    queryKey: ["admin-visitors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("visitors").select("*, units(unit_number, building)").order("expected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("visitors").insert({
        unit_id: form.unit_id,
        visitor_name: form.visitor_name,
        visitor_phone: form.visitor_phone || null,
        car_plate: form.car_plate || null,
        expected_at: form.expected_at,
        purpose: form.purpose || null,
        requested_by: user?.id ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visitor registered");
      setOpen(false);
      setForm({ unit_id: "", visitor_name: "", visitor_phone: "", car_plate: "", expected_at: "", purpose: "" });
      qc.invalidateQueries({ queryKey: ["admin-visitors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "checked_in") patch.checked_in_at = new Date().toISOString();
      if (status === "checked_out") patch.checked_out_at = new Date().toISOString();
      const { error } = await supabase.from("visitors").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-visitors"] }),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Visitors</h1>
          <p className="text-sm text-muted-foreground">Pre-register visitors and generate QR codes for gate access.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Add visitor</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Pre-register a visitor</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Unit</Label>
                <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.building ? `${u.building} · ` : ""}{u.unit_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Visitor name</Label><Input value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.visitor_phone} onChange={(e) => setForm({ ...form, visitor_phone: e.target.value })} /></div>
              <div><Label>Car plate</Label><Input value={form.car_plate} onChange={(e) => setForm({ ...form, car_plate: e.target.value })} placeholder="e.g. 123456" /></div>
              <div><Label>Expected at</Label><Input type="datetime-local" value={form.expected_at} onChange={(e) => setForm({ ...form, expected_at: e.target.value })} /></div>
              <div className="col-span-2"><Label>Purpose</Label><Textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
              <Button onClick={() => create.mutate()} disabled={!form.unit_id || !form.visitor_name || !form.expected_at || create.isPending} className="col-span-2">
                Register & generate QR
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {visitors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <UserCheck className="mx-auto mb-2 h-6 w-6" /> No visitors yet
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Visitor</TableHead><TableHead>Unit</TableHead><TableHead>Plate</TableHead><TableHead>Expected</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {visitors.map((v) => (
                <TableRow key={v.id}>
                  <TableCell><div className="font-medium">{v.visitor_name}</div><div className="text-xs text-muted-foreground">{v.visitor_phone ?? "—"}</div></TableCell>
                  <TableCell>{v.units?.unit_number ?? "—"}</TableCell>
                  <TableCell>{v.car_plate ?? "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(v.expected_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Select value={v.status} onValueChange={(s) => updateStatus.mutate({ id: v.id, status: s })}>
                      <SelectTrigger className="h-7 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="checked_in">Checked in</SelectItem>
                        <SelectItem value="checked_out">Checked out</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setQrFor(v)}><QrCode className="mr-1 h-4 w-4" />QR</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!qrFor} onOpenChange={(v) => !v && setQrFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Gate access QR</DialogTitle></DialogHeader>
          {qrFor && (
            <div className="space-y-3 text-center">
              <img src={qrUrl(qrFor.qr_code)} alt="QR" className="mx-auto rounded-lg border border-border" />
              <div>
                <p className="font-medium">{qrFor.visitor_name}</p>
                <p className="text-xs text-muted-foreground">{new Date(qrFor.expected_at).toLocaleString()}</p>
                {qrFor.car_plate && <Badge variant="outline" className="mt-1">Plate: {qrFor.car_plate}</Badge>}
              </div>
              <p className="break-all rounded-md bg-muted p-2 text-xs">{qrFor.qr_code}</p>
              <Button asChild variant="outline" className="w-full"><a href={qrUrl(qrFor.qr_code)} target="_blank" rel="noreferrer">Open / print</a></Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
