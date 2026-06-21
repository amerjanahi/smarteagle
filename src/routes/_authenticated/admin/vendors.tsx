import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listVendors, upsertVendor, deleteVendor } from "@/lib/purchases.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/vendors")({
  head: () => ({ meta: [{ title: "Vendors — Hayy Admin" }] }),
  component: VendorsPage,
});

function VendorsPage() {
  const fetchList = useServerFn(listVendors);
  const save = useServerFn(upsertVendor);
  const del = useServerFn(deleteVendor);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["vendors"], queryFn: () => fetchList() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  function startNew() {
    setEditing({ name: "", email: "", phone: "", address: "", tax_id: "", notes: "", is_active: true });
    setOpen(true);
  }
  function startEdit(v: any) {
    setEditing({ ...v });
    setOpen(true);
  }
  async function submit() {
    try {
      await save({ data: editing });
      toast.success("Vendor saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["vendors"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function remove(id: string) {
    if (!confirm("Delete vendor?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["vendors"] });
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Vendors</h2>
          <p className="text-sm text-muted-foreground">Suppliers you purchase from.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={startNew}><Plus className="mr-2 h-4 w-4" />New Vendor</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing?.id ? "Edit Vendor" : "New Vendor"}</DialogTitle></DialogHeader>
            {editing && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                <div className="col-span-2"><Label>Address</Label><Input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
                <div><Label>Tax / TRN</Label><Input value={editing.tax_id ?? ""} onChange={(e) => setEditing({ ...editing, tax_id: e.target.value })} /></div>
                <div className="col-span-2"><Label>Notes</Label><Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
              </div>
            )}
            <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>TRN</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow> :
              data.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No vendors yet</TableCell></TableRow> :
              data.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.email}</TableCell>
                  <TableCell>{v.phone}</TableCell>
                  <TableCell>{v.tax_id}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(v)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(v.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
