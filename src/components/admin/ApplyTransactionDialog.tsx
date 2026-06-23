import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ApplyTxn = {
  id: string;
  amount: number;
  applied_amount?: number | null;
  direction: "in" | "out";
  description: string;
  status: string;
  applied_to_type?: string | null;
  applied_to_id?: string | null;
  apply_notes?: string | null;
};

type TargetKind = "invoice" | "receipt" | "vendor_payment" | "expense";

const KIND_LABEL: Record<TargetKind, string> = {
  invoice: "Invoice",
  receipt: "Receipt",
  vendor_payment: "Vendor Payment",
  expense: "Expense",
};

export function ApplyTransactionDialog({
  txn,
  open,
  onOpenChange,
}: {
  txn: ApplyTxn | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<TargetKind>("invoice");
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!txn) return;
    setKind((txn.applied_to_type as TargetKind) || (txn.direction === "in" ? "invoice" : "vendor_payment"));
    setTargetId(txn.applied_to_id || "");
    const remaining = Number(txn.amount) - Number(txn.applied_amount || 0);
    setAmount(remaining > 0 ? remaining : Number(txn.amount));
    setNotes(txn.apply_notes || "");
  }, [txn]);

  const { data: options = [] } = useQuery({
    queryKey: ["apply-options", kind],
    enabled: open,
    queryFn: async () => {
      if (kind === "invoice") {
        const { data } = await (supabase.from("invoices").select("id,invoice_number,amount,amount_paid,status").neq("status","paid").order("issue_date",{ascending:false}).limit(100) as any);
        return (data ?? []).map((r: any) => ({ id: r.id, label: `${r.invoice_number} · ${Number(r.amount-r.amount_paid).toFixed(3)} due` }));
      }
      if (kind === "receipt") {
        const { data } = await (supabase.from("payments").select("id,receipt_number,amount,payment_date").order("payment_date",{ascending:false}).limit(100) as any);
        return (data ?? []).map((r: any) => ({ id: r.id, label: `${r.receipt_number ?? r.id.slice(0,8)} · ${Number(r.amount).toFixed(3)}` }));
      }
      if (kind === "vendor_payment") {
        const { data } = await (supabase.from("vendor_payments").select("id,payment_number,amount,payment_date").order("payment_date",{ascending:false}).limit(100) as any);
        return (data ?? []).map((r: any) => ({ id: r.id, label: `${r.payment_number ?? r.id.slice(0,8)} · ${Number(r.amount).toFixed(3)}` }));
      }
      const { data } = await (supabase.from("expenses").select("id,description,amount,expense_date").order("expense_date",{ascending:false}).limit(100) as any);
      return (data ?? []).map((r: any) => ({ id: r.id, label: `${r.description} · ${Number(r.amount).toFixed(3)}` }));
    },
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!txn) return;
      const amt = Number(amount) || 0;
      const total = Number(txn.amount);
      if (amt <= 0) throw new Error("Amount must be > 0");
      if (amt > total) throw new Error("Cannot exceed transaction amount");
      const newApplied = Number(txn.applied_amount || 0) + amt;
      const status = newApplied >= total ? "applied" : "partially_applied";
      const update: any = {
        applied_amount: newApplied,
        applied_to_type: kind,
        applied_to_id: targetId || null,
        apply_notes: notes || null,
        applied_at: new Date().toISOString(),
        status,
      };
      // Match column links
      if (kind === "receipt") update.matched_payment_id = targetId;
      if (kind === "vendor_payment") update.matched_vendor_payment_id = targetId;
      const { error } = await (supabase.from("bank_transactions" as any).update(update).eq("id", txn.id) as any);
      if (error) throw error;

      // Side effects on related record
      if (targetId) {
        if (kind === "invoice") {
          // Create a payment allocation-style update by adding to amount_paid
          const { data: inv } = await (supabase.from("invoices").select("amount,amount_paid").eq("id", targetId).maybeSingle() as any);
          if (inv) {
            const paid = Number(inv.amount_paid || 0) + amt;
            const invStatus = paid >= Number(inv.amount) ? "paid" : paid > 0 ? "partial" : "unpaid";
            await (supabase.from("invoices").update({ amount_paid: paid, status: invStatus }).eq("id", targetId) as any);
          }
        } else if (kind === "expense") {
          await (supabase.from("expenses").update({ status: "paid" }).eq("id", targetId) as any);
        }
      }
    },
    onSuccess: () => {
      toast.success("Transaction applied");
      qc.invalidateQueries({ queryKey: ["bank-txns"] });
      qc.invalidateQueries({ queryKey: ["bank-recon-txns"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reverse = useMutation({
    mutationFn: async () => {
      if (!txn) return;
      const amt = Number(txn.applied_amount || 0);
      if (kind === "invoice" && txn.applied_to_id && amt > 0) {
        const { data: inv } = await (supabase.from("invoices").select("amount,amount_paid").eq("id", txn.applied_to_id).maybeSingle() as any);
        if (inv) {
          const paid = Math.max(Number(inv.amount_paid || 0) - amt, 0);
          const invStatus = paid >= Number(inv.amount) ? "paid" : paid > 0 ? "partial" : "unpaid";
          await (supabase.from("invoices").update({ amount_paid: paid, status: invStatus }).eq("id", txn.applied_to_id) as any);
        }
      }
      const { error } = await (supabase.from("bank_transactions" as any).update({
        applied_amount: 0, applied_to_type: null, applied_to_id: null,
        matched_payment_id: null, matched_vendor_payment_id: null,
        status: "reversed", applied_at: null,
      }).eq("id", txn.id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reversed");
      qc.invalidateQueries({ queryKey: ["bank-txns"] });
      qc.invalidateQueries({ queryKey: ["bank-recon-txns"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!txn) return null;
  const remaining = Number(txn.amount) - Number(txn.applied_amount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="font-medium">{txn.description}</div>
            <div className="text-xs text-muted-foreground">
              Total: {Number(txn.amount).toFixed(3)} · Already applied: {Number(txn.applied_amount || 0).toFixed(3)} · Remaining: {remaining.toFixed(3)}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Apply to</Label>
              <Select value={kind} onValueChange={(v: any) => { setKind(v); setTargetId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["invoice","receipt","vendor_payment","expense"] as TargetKind[]).map(k => (
                    <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.001" value={amount} onChange={e => setAmount(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Target {KIND_LABEL[kind]}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder={`Select ${KIND_LABEL[kind].toLowerCase()}`} /></SelectTrigger>
              <SelectContent>
                {options.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Button size="sm" variant="outline" type="button" onClick={() => setAmount(remaining)}>Full</Button>
            <Button size="sm" variant="outline" type="button" onClick={() => setAmount(remaining / 2)}>Half</Button>
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {Number(txn.applied_amount || 0) > 0 && (
            <Button variant="destructive" onClick={() => reverse.mutate()} disabled={reverse.isPending}>Reverse / Unapply</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => apply.mutate()} disabled={apply.isPending || !targetId}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
