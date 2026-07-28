import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  deleteVendor, deleteVendorComplianceDocument, getVendorOverview, listVendors,
  saveVendorComplianceDocument, upsertVendor,
} from "@/lib/purchases.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, Building2, CheckCircle2, Eye, FileCheck2, Mail, Pencil,
  Phone, Plus, Search, Star, Trash2, Upload, WalletCards,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/vendors")({
  head: () => ({ meta: [{ title: "Vendors — Hayy Admin" }] }),
  component: VendorsPage,
});

const emptyVendor = {
  name: "", contact_person: "", category: "", email: "", phone: "", address: "",
  tax_id: "", commercial_registration: "", bank_name: "", iban: "",
  payment_terms_days: 30, status: "active", is_preferred: false, is_active: true, notes: "",
};
const emptyDocument = {
  document_type: "Commercial Registration", document_number: "", issue_date: "",
  expiry_date: "", notes: "",
};
const money = (value: number) => new Intl.NumberFormat("en-BH", {
  style: "currency", currency: "BHD", minimumFractionDigits: 3,
}).format(Number(value || 0));

function VendorsPage() {
  const fetchList = useServerFn(listVendors);
  const save = useServerFn(upsertVendor);
  const del = useServerFn(deleteVendor);
  const overview = useServerFn(getVendorOverview);
  const saveCompliance = useServerFn(saveVendorComplianceDocument);
  const removeCompliance = useServerFn(deleteVendorComplianceDocument);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["vendors"], queryFn: () => fetchList() });
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(emptyVendor);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [document, setDocument] = useState<any>(emptyDocument);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const vendorDetail = useQuery({
    queryKey: ["vendor-overview", selectedId],
    queryFn: () => overview({ data: { vendor_id: selectedId! } }),
    enabled: !!selectedId,
  });
  const filtered = data.filter((vendor: any) => {
    const text = `${vendor.name} ${vendor.contact_person ?? ""} ${vendor.category ?? ""} ${vendor.email ?? ""}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (status === "all" || vendor.status === status);
  });
  const expiringCount = data.filter((vendor: any) => {
    if (!vendor.next_expiry) return false;
    const days = (new Date(vendor.next_expiry).getTime() - Date.now()) / 86400000;
    return days <= 30;
  }).length;

  function startNew() {
    setEditing({ ...emptyVendor });
    setEditOpen(true);
  }
  function startEdit(vendor: any) {
    setEditing({ ...vendor });
    setSelectedId(null);
    setEditOpen(true);
  }
  async function submit() {
    try {
      await save({ data: editing });
      toast.success("Vendor profile saved");
      setEditOpen(false);
      await qc.invalidateQueries({ queryKey: ["vendors"] });
      if (editing.id) await qc.invalidateQueries({ queryKey: ["vendor-overview", editing.id] });
    } catch (error: any) { toast.error(error.message); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this vendor? Existing purchase records will keep their vendor snapshot.")) return;
    try {
      await del({ data: { id } });
      setSelectedId(null);
      await qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor deleted");
    } catch (error: any) { toast.error(error.message); }
  }
  async function addCompliance() {
    if (!selectedId) return;
    try {
      let file_path: string | null = null;
      if (documentFile) {
        const extension = documentFile.name.split(".").pop();
        file_path = `vendors/${selectedId}/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("documents").upload(file_path, documentFile);
        if (error) throw error;
      }
      await saveCompliance({ data: {
        ...document, vendor_id: selectedId, issue_date: document.issue_date || null,
        expiry_date: document.expiry_date || null, file_path,
      } });
      setDocument({ ...emptyDocument }); setDocumentFile(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["vendor-overview", selectedId] }),
        qc.invalidateQueries({ queryKey: ["vendors"] }),
      ]);
      toast.success("Compliance document added");
    } catch (error: any) { toast.error(error.message); }
  }
  async function openDocument(path: string) {
    const { data: signed, error } = await supabase.storage.from("documents").createSignedUrl(path, 1800);
    if (error) return toast.error(error.message);
    window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function deleteCompliance(id: string) {
    if (!confirm("Remove this compliance record?")) return;
    await removeCompliance({ data: { id } });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["vendor-overview", selectedId] }),
      qc.invalidateQueries({ queryKey: ["vendors"] }),
    ]);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Vendors</h2>
          <p className="text-sm text-muted-foreground">Supplier profiles, compliance and purchasing activity.</p>
        </div>
        <Button onClick={startNew}><Plus className="mr-2 h-4 w-4" />New vendor</Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Active vendors" value={data.filter((v: any) => v.status === "active").length} icon={Building2} />
        <Summary label="Outstanding" value={money(data.reduce((s: number, v: any) => s + Number(v.outstanding_balance || 0), 0))} icon={WalletCards} />
        <Summary label="Expired / due soon" value={expiringCount} icon={AlertTriangle} warning={expiringCount > 0} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search vendor, contact, category…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
        filtered.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No vendors found.</div> :
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((vendor: any) => <article key={vendor.id} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{vendor.name}</h3>
                  {vendor.is_preferred && <Star className="h-4 w-4 fill-amber-400 text-amber-500" />}
                </div>
                <p className="text-xs text-muted-foreground">{vendor.category || "Uncategorized supplier"}</p>
              </div>
              <Badge variant={vendor.status === "active" ? "default" : "outline"} className="capitalize">{vendor.status || "active"}</Badge>
            </div>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              {vendor.contact_person && <p>{vendor.contact_person}</p>}
              {vendor.phone && <a className="flex items-center gap-2 hover:text-foreground" href={`tel:${vendor.phone}`}><Phone className="h-3.5 w-3.5" />{vendor.phone}</a>}
              {vendor.email && <a className="flex items-center gap-2 truncate hover:text-foreground" href={`mailto:${vendor.email}`}><Mail className="h-3.5 w-3.5" />{vendor.email}</a>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Total spend</p><p className="font-medium">{money(vendor.total_spend)}</p></div>
              <div><p className="text-xs text-muted-foreground">Outstanding</p><p className="font-medium">{money(vendor.outstanding_balance)}</p></div>
              <div><p className="text-xs text-muted-foreground">Purchases</p><p className="font-medium">{vendor.purchase_count}</p></div>
              <div><p className="text-xs text-muted-foreground">Documents</p><p className="font-medium">{vendor.compliance_count}</p></div>
            </div>
            {vendor.next_expiry && <ExpiryNotice date={vendor.next_expiry} />}
            <div className="mt-3 flex gap-1">
              <Button className="flex-1" variant="outline" onClick={() => setSelectedId(vendor.id)}><Eye className="mr-2 h-4 w-4" />View</Button>
              <Button size="icon" variant="ghost" onClick={() => startEdit(vendor)}><Pencil className="h-4 w-4" /></Button>
            </div>
          </article>)}
        </div>}

      <VendorForm open={editOpen} setOpen={setEditOpen} editing={editing} setEditing={setEditing} submit={submit} />

      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>{vendorDetail.data?.vendor?.name || "Vendor details"}</DialogTitle></DialogHeader>
          {vendorDetail.isLoading ? <p className="text-sm text-muted-foreground">Loading vendor profile…</p> :
            vendorDetail.data && <div className="space-y-6">
              <VendorOverview detail={vendorDetail.data} />
              <section className="space-y-3">
                <div className="flex items-center justify-between"><h3 className="font-semibold">Compliance documents</h3><Badge variant="outline">{vendorDetail.data.compliance.length}</Badge></div>
                <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div><Label>Type</Label><Select value={document.document_type} onValueChange={(value) => setDocument({ ...document, document_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Commercial Registration", "VAT Certificate", "Insurance", "Contract", "Trade Licence", "Other"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Number</Label><Input value={document.document_number} onChange={(e) => setDocument({ ...document, document_number: e.target.value })} /></div>
                  <div><Label>Issue date</Label><Input type="date" value={document.issue_date} onChange={(e) => setDocument({ ...document, issue_date: e.target.value })} /></div>
                  <div><Label>Expiry date</Label><Input type="date" value={document.expiry_date} onChange={(e) => setDocument({ ...document, expiry_date: e.target.value })} /></div>
                  <div className="sm:col-span-2"><Label>File</Label><Input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)} /></div>
                  <div className="sm:col-span-2"><Label>Notes</Label><Input value={document.notes} onChange={(e) => setDocument({ ...document, notes: e.target.value })} /></div>
                  <Button className="sm:col-span-2 lg:col-span-4" onClick={addCompliance}><Upload className="mr-2 h-4 w-4" />Add compliance document</Button>
                </div>
                <div className="space-y-2">
                  {vendorDetail.data.compliance.length === 0 && <p className="text-sm text-muted-foreground">No compliance documents recorded.</p>}
                  {vendorDetail.data.compliance.map((doc: any) => <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div><p className="font-medium">{doc.document_type}</p><p className="text-xs text-muted-foreground">{doc.document_number || "No reference"} · {doc.expiry_date ? `Expires ${new Date(doc.expiry_date).toLocaleDateString()}` : "No expiry date"}</p></div>
                    <div className="flex gap-1">{doc.file_path && <Button size="sm" variant="outline" onClick={() => openDocument(doc.file_path)}><FileCheck2 className="mr-1 h-4 w-4" />Open</Button>}<Button size="icon" variant="ghost" onClick={() => deleteCompliance(doc.id)}><Trash2 className="h-4 w-4" /></Button></div>
                  </div>)}
                </div>
              </section>
              <section><h3 className="mb-3 font-semibold">Purchase history</h3><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[620px] text-sm"><thead className="bg-muted/50 text-left"><tr><th className="p-3">Bill</th><th className="p-3">Date</th><th className="p-3">Status</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Balance</th></tr></thead><tbody>{vendorDetail.data.bills.map((bill: any) => <tr key={bill.id} className="border-t"><td className="p-3 font-medium">{bill.bill_number}</td><td className="p-3">{new Date(bill.issue_date).toLocaleDateString()}</td><td className="p-3 capitalize">{bill.status}</td><td className="p-3 text-right">{money(bill.total_amount)}</td><td className="p-3 text-right">{money(bill.balance_due)}</td></tr>)}{vendorDetail.data.bills.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No purchase invoices.</td></tr>}</tbody></table></div></section>
              <section><h3 className="mb-3 font-semibold">Recent payments</h3><div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[520px] text-sm"><thead className="bg-muted/50 text-left"><tr><th className="p-3">Payment</th><th className="p-3">Date</th><th className="p-3">Method</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{vendorDetail.data.payments.map((payment: any) => <tr key={payment.id} className="border-t"><td className="p-3 font-medium">{payment.payment_number}</td><td className="p-3">{new Date(payment.payment_date).toLocaleDateString()}</td><td className="p-3 capitalize">{payment.method || "—"}</td><td className="p-3 text-right">{money(payment.amount)}</td></tr>)}{vendorDetail.data.payments.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No vendor payments.</td></tr>}</tbody></table></div></section>
              <div className="flex justify-between"><Button variant="destructive" onClick={() => remove(selectedId!)}><Trash2 className="mr-2 h-4 w-4" />Delete vendor</Button><Button variant="outline" onClick={() => startEdit(vendorDetail.data.vendor)}><Pencil className="mr-2 h-4 w-4" />Edit profile</Button></div>
            </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Summary({ label, value, icon: Icon, warning = false }: any) {
  return <div className="flex items-center gap-3 rounded-xl border bg-card p-4"><div className={`grid h-10 w-10 place-items-center rounded-lg ${warning ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}><Icon className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div></div>;
}
function ExpiryNotice({ date }: { date: string }) {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  const danger = days <= 30;
  return <div className={`mt-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${danger ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{danger ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Next document expiry: {new Date(date).toLocaleDateString()}</div>;
}
function VendorOverview({ detail }: any) {
  const total = detail.bills.reduce((sum: number, bill: any) => sum + Number(bill.total_amount || 0), 0);
  const outstanding = detail.bills.reduce((sum: number, bill: any) => sum + Number(bill.balance_due || 0), 0);
  return <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Summary label="Purchase invoices" value={detail.bills.length} icon={FileCheck2} /><Summary label="Total spend" value={money(total)} icon={WalletCards} /><Summary label="Outstanding" value={money(outstanding)} icon={AlertTriangle} warning={outstanding > 0} /><Summary label="Payment terms" value={`${detail.vendor.payment_terms_days ?? 30} days`} icon={CheckCircle2} /></section>;
}
function VendorForm({ open, setOpen, editing, setEditing, submit }: any) {
  const field = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditing({ ...editing, [key]: event.target.value });
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editing?.id ? "Edit vendor" : "New vendor"}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2">
    <div className="sm:col-span-2"><Label>Vendor name</Label><Input value={editing.name} onChange={field("name")} required /></div>
    <div><Label>Contact person</Label><Input value={editing.contact_person ?? ""} onChange={field("contact_person")} /></div>
    <div><Label>Category</Label><Input placeholder="Cleaning, maintenance…" value={editing.category ?? ""} onChange={field("category")} /></div>
    <div><Label>Email</Label><Input type="email" value={editing.email ?? ""} onChange={field("email")} /></div>
    <div><Label>Phone</Label><Input value={editing.phone ?? ""} onChange={field("phone")} /></div>
    <div className="sm:col-span-2"><Label>Address</Label><Input value={editing.address ?? ""} onChange={field("address")} /></div>
    <div><Label>VAT / TRN</Label><Input value={editing.tax_id ?? ""} onChange={field("tax_id")} /></div>
    <div><Label>Commercial registration</Label><Input value={editing.commercial_registration ?? ""} onChange={field("commercial_registration")} /></div>
    <div><Label>Bank name</Label><Input value={editing.bank_name ?? ""} onChange={field("bank_name")} /></div>
    <div><Label>IBAN</Label><Input value={editing.iban ?? ""} onChange={field("iban")} /></div>
    <div><Label>Payment terms (days)</Label><Input type="number" min={0} max={365} value={editing.payment_terms_days ?? 30} onChange={(e) => setEditing({ ...editing, payment_terms_days: Number(e.target.value) })} /></div>
    <div><Label>Status</Label><Select value={editing.status ?? "active"} onValueChange={(value) => setEditing({ ...editing, status: value, is_active: value === "active" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="pending">Pending approval</SelectItem><SelectItem value="blocked">Blocked</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select></div>
    <label className="sm:col-span-2 flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={!!editing.is_preferred} onChange={(e) => setEditing({ ...editing, is_preferred: e.target.checked })} /><Star className="h-4 w-4 text-amber-500" />Preferred supplier</label>
    <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={editing.notes ?? ""} onChange={field("notes")} /></div>
  </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>Save vendor</Button></DialogFooter></DialogContent></Dialog>;
}
