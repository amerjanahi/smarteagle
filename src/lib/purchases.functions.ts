import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertManager(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("can_manage_sales", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: finance access required");
}

// ---------- Vendors ----------
export const listVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("vendors")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; email?: string; phone?: string; address?: string; tax_id?: string; notes?: string; is_active?: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertManager(context.supabase, context.userId);
    const payload: any = { ...data };
    if (!payload.id) payload.created_by = context.userId;
    const { data: res, error } = await context.supabase.from("vendors").upsert(payload).select().single();
    if (error) throw new Error(error.message);
    return res;
  });

export const deleteVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertManager(context.supabase, context.userId);
    const { error } = await context.supabase.from("vendors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Purchase Invoices (Bills) ----------
export const listPurchaseInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("purchase_invoices")
      .select("*, vendors(name, email)")
      .order("issue_date", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPurchaseInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    vendor_id?: string | null;
    vendor_name: string;
    issue_date?: string;
    due_date?: string | null;
    subtotal: number;
    vat_amount?: number;
    discount_amount?: number;
    category?: string | null;
    description?: string;
    notes?: string;
    payment_terms?: string;
    reference?: string;
    attachments?: any[];
  }) => d)
  .handler(async ({ context, data }) => {
    await assertManager(context.supabase, context.userId);
    const payload: any = {
      vendor_id: data.vendor_id || null,
      vendor_name: data.vendor_name,
      issue_date: data.issue_date || new Date().toISOString().slice(0, 10),
      due_date: data.due_date || null,
      subtotal: Number(data.subtotal || 0),
      vat_amount: Number(data.vat_amount || 0),
      discount_amount: Number(data.discount_amount || 0),
      category: data.category || null,
      description: data.description || null,
      notes: data.notes || null,
      payment_terms: data.payment_terms || null,
      reference: data.reference || null,
      attachments: data.attachments || [],
      approval_status: "pending",
      created_by: context.userId,
    };
    const { data: res, error } = await context.supabase.from("purchase_invoices").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return res;
  });

export const approvePurchaseInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; decision: "approved" | "rejected" }) => d)
  .handler(async ({ context, data }) => {
    await assertManager(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("purchase_invoices")
      .update({
        approval_status: data.decision,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePurchaseInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertManager(context.supabase, context.userId);
    const { error } = await context.supabase.from("purchase_invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Vendor Payments ----------
export const listVendorPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("vendor_payments")
      .select("*, vendors(name), purchase_invoices(bill_number, total_amount)")
      .order("payment_date", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const recordVendorPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    vendor_id?: string | null;
    purchase_invoice_id?: string | null;
    payment_date?: string;
    amount: number;
    method?: string;
    reference?: string;
    notes?: string;
  }) => d)
  .handler(async ({ context, data }) => {
    await assertManager(context.supabase, context.userId);
    const payload: any = {
      vendor_id: data.vendor_id || null,
      purchase_invoice_id: data.purchase_invoice_id || null,
      payment_date: data.payment_date || new Date().toISOString().slice(0, 10),
      amount: Number(data.amount),
      method: data.method || null,
      reference: data.reference || null,
      notes: data.notes || null,
      created_by: context.userId,
    };
    const { data: res, error } = await context.supabase.from("vendor_payments").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return res;
  });

// ---------- Reports ----------
export const purchasesDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.supabase, context.userId);
    const { data: bills } = await context.supabase
      .from("purchase_invoices")
      .select("total_amount, amount_paid, balance_due, status, due_date, approval_status");
    const list = bills ?? [];
    const totalBilled = list.reduce((s: number, b: any) => s + Number(b.total_amount || 0), 0);
    const outstanding = list.reduce((s: number, b: any) => s + Number(b.balance_due || 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const overdue = list
      .filter((b: any) => b.due_date && b.due_date < today && Number(b.balance_due) > 0)
      .reduce((s: number, b: any) => s + Number(b.balance_due || 0), 0);
    const pendingApproval = list.filter((b: any) => b.approval_status === "pending").length;
    return { totalBilled, outstanding, overdue, pendingApproval, count: list.length };
  });

export const vendorStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { vendor_id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertManager(context.supabase, context.userId);
    const { data: vendor } = await context.supabase.from("vendors").select("*").eq("id", data.vendor_id).single();
    const { data: bills } = await context.supabase
      .from("purchase_invoices")
      .select("*")
      .eq("vendor_id", data.vendor_id)
      .order("issue_date");
    const { data: pays } = await context.supabase
      .from("vendor_payments")
      .select("*")
      .eq("vendor_id", data.vendor_id)
      .order("payment_date");
    const lines: any[] = [];
    let bal = 0;
    (bills ?? []).forEach((b: any) => {
      bal += Number(b.total_amount || 0);
      lines.push({ date: b.issue_date, type: "Bill", ref: b.bill_number, debit: Number(b.total_amount || 0), credit: 0, balance: bal });
    });
    (pays ?? []).forEach((p: any) => {
      bal -= Number(p.amount || 0);
      lines.push({ date: p.payment_date, type: "Payment", ref: p.payment_number, debit: 0, credit: Number(p.amount || 0), balance: bal });
    });
    lines.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { vendor, lines, balance: bal };
  });

export const agingReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("purchase_invoices")
      .select("vendor_name, vendor_id, bill_number, issue_date, due_date, balance_due, total_amount")
      .gt("balance_due", 0);
    const today = new Date();
    const buckets: Record<string, { current: number; d30: number; d60: number; d90: number; d90plus: number; total: number }> = {};
    (data ?? []).forEach((b: any) => {
      const v = b.vendor_name || "Unknown";
      buckets[v] ??= { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0, total: 0 };
      const due = b.due_date ? new Date(b.due_date) : today;
      const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
      const amt = Number(b.balance_due || 0);
      buckets[v].total += amt;
      if (days <= 0) buckets[v].current += amt;
      else if (days <= 30) buckets[v].d30 += amt;
      else if (days <= 60) buckets[v].d60 += amt;
      else if (days <= 90) buckets[v].d90 += amt;
      else buckets[v].d90plus += amt;
    });
    return Object.entries(buckets).map(([vendor, v]) => ({ vendor, ...v }));
  });
