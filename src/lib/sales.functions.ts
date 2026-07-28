import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  account_id?: string | null;
};

async function assertSalesManager(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("can_manage_sales", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: sales access required");
}

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

// ---------- Lists ----------
export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesManager(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("invoices")
      .select("*, units(unit_number, building), invoice_line_items(*)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesManager(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("payments")
      .select("*, invoices(invoice_number, unit_id, units(unit_number)), payment_allocations(*)")
      .order("paid_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCreditNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesManager(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("credit_notes")
      .select("*, units(unit_number, building), credit_note_line_items(*)")
      .order("issued_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("units")
      .select("id, unit_number, building, residents(full_name, email, is_active)")
      .order("unit_number");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listInvoiceAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesManager(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("chart_of_accounts")
      .select("id, code, name, account_type")
      .eq("is_active", true)
      .order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const salesDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesManager(context.supabase, context.userId);
    const { data: invoices, error } = await context.supabase
      .from("invoices")
      .select("amount, amount_paid, status, due_date, currency");
    if (error) throw new Error(error.message);
    const today = new Date();
    let outstanding = 0, overdue = 0, paidThisMonth = 0, totalInvoiced = 0;
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    for (const inv of invoices ?? []) {
      const due = inv.due_date ? new Date(inv.due_date) : null;
      const bal = Number(inv.amount) - Number(inv.amount_paid || 0);
      totalInvoiced += Number(inv.amount);
      if (bal > 0) outstanding += bal;
      if (bal > 0 && due && due < today) overdue += bal;
      if (inv.status === "paid") paidThisMonth += Number(inv.amount_paid);
    }
    const { data: recent } = await context.supabase
      .from("audit_log").select("*")
      .in("table_name", ["invoices", "payments", "credit_notes"])
      .order("created_at", { ascending: false }).limit(20);
    return { outstanding, overdue, paidThisMonth, totalInvoiced, recent: recent ?? [] };
  });

// ---------- Invoices ----------
export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    unit_id: string;
    description: string;
    period_start?: string | null;
    period_end?: string | null;
    due_date: string;
    currency?: string;
    discount_amount?: number;
    payment_terms?: string | null;
    notes?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    attachments?: { name: string; url: string }[];
    line_items: LineItemInput[];
  }) => d)
  .handler(async ({ context, data }) => {
    await assertSalesManager(context.supabase, context.userId);
    const accountIds = [...new Set(data.line_items.map((line) => line.account_id).filter(Boolean))] as string[];
    if (accountIds.length) {
      const { data: accounts, error: accountsError } = await context.supabase
        .from("chart_of_accounts")
        .select("id")
        .in("id", accountIds)
        .eq("is_active", true);
      if (accountsError) throw new Error(accountsError.message);
      if ((accounts ?? []).length !== accountIds.length) {
        throw new Error("Each selected invoice account must be an active General Ledger account.");
      }
    }
    let subtotal = 0, tax = 0;
    const items = data.line_items.map((li, i) => {
      const lineSub = Number(li.quantity) * Number(li.unit_price);
      const lineTax = lineSub * (Number(li.tax_rate) / 100);
      subtotal += lineSub; tax += lineTax;
      return { ...li, position: i + 1, line_total: +(lineSub + lineTax).toFixed(2) };
    });
    const discount = Number(data.discount_amount ?? 0);
    const amount = +Math.max(subtotal + tax - discount, 0).toFixed(2);
    const { data: inv, error } = await context.supabase
      .from("invoices")
      .insert({
        unit_id: data.unit_id,
        description: data.description,
        period_start: data.period_start,
        period_end: data.period_end,
        due_date: data.due_date,
        amount,
        subtotal: +subtotal.toFixed(2),
        tax_amount: +tax.toFixed(2),
        discount_amount: discount,
        payment_terms: data.payment_terms,
        notes: data.notes,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        attachments: data.attachments ?? [],
        currency: data.currency ?? (await context.supabase.from("company_settings").select("default_currency").maybeSingle()).data?.default_currency ?? "AED",
        status: "unpaid",
        invoice_number: "",
      } as any)
      .select("id").single();
    if (error) throw new Error(error.message);
    if (items.length) {
      const { error: liErr } = await context.supabase
      .from("invoice_line_items" as any)
        .insert(items.map((li) => ({ ...li, invoice_id: inv.id })) as any);
      if (liErr) throw new Error(liErr.message);
    }
    return { id: inv.id };
  });

export const voidInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Admin only");
    const { error } = await context.supabase
      .from("invoices")
      .update({ status: "cancelled", voided_at: new Date().toISOString(), voided_by: context.userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Payments ----------
export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    unit_id: string;
    amount: number;
    payment_method: "card" | "bank_transfer" | "cash" | "cheque" | "mock";
    paid_at?: string;
    notes?: string;
    allocations?: { invoice_id: string; amount_applied: number }[];
  }) => d)
  .handler(async ({ context, data }) => {
    await assertSalesManager(context.supabase, context.userId);

    // Auto-allocate FIFO across open invoices if not specified
    let allocations = data.allocations ?? [];
    if (allocations.length === 0) {
      const { data: openInv } = await context.supabase
        .from("invoices")
        .select("id, amount, amount_paid")
        .eq("unit_id", data.unit_id)
        .in("status", ["unpaid", "partial", "overdue"])
        .order("due_date");
      let remaining = data.amount;
      for (const inv of openInv ?? []) {
        if (remaining <= 0) break;
        const bal = Number(inv.amount) - Number(inv.amount_paid);
        const apply = Math.min(bal, remaining);
        if (apply > 0) {
          allocations.push({ invoice_id: inv.id, amount_applied: +apply.toFixed(2) });
          remaining -= apply;
        }
      }
    }

    // Pick a primary invoice for legacy column (required by existing schema)
    const firstInvoice = allocations[0]?.invoice_id ?? null;

    const { data: pay, error } = await context.supabase
      .from("payments")
      .insert({
        invoice_id: firstInvoice,
        amount: data.amount,
        payment_method: data.payment_method,
        paid_by_user_id: context.userId,
        paid_at: data.paid_at ?? new Date().toISOString(),
        notes: data.notes,
        receipt_number: "", // trigger fills this in
      } as any)
      .select("id").single();
    if (error) throw new Error(error.message);

    if (allocations.length) {
      const { error: aErr } = await context.supabase
        .from("payment_allocations")
        .insert(allocations.map((a) => ({
          payment_id: pay.id,
          invoice_id: a.invoice_id,
          amount_applied: a.amount_applied,
          created_by: context.userId,
        })));
      if (aErr) throw new Error(aErr.message);
    }
    return { id: pay.id };
  });

// ---------- Credit Notes ----------
export const issueCreditNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    unit_id: string;
    invoice_id?: string | null;
    amount: number;
    reason: string;
    line_items?: LineItemInput[];
  }) => d)
  .handler(async ({ context, data }) => {
    await assertSalesManager(context.supabase, context.userId);
    const { data: cn, error } = await context.supabase
      .from("credit_notes")
      .insert({
        unit_id: data.unit_id,
        invoice_id: data.invoice_id,
        amount: data.amount,
        reason: data.reason,
        issued_by: context.userId,
        status: "issued",
        applied_amount: 0,
        balance: data.amount,
        credit_note_number: "", // trigger fills this in
      } as any)
      .select("id").single();
    if (error) throw new Error(error.message);
    if (data.line_items?.length) {
      const items = data.line_items.map((li, i) => {
        const sub = Number(li.quantity) * Number(li.unit_price);
        return {
          credit_note_id: cn.id,
          position: i + 1,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          tax_rate: li.tax_rate,
          line_total: +(sub * (1 + Number(li.tax_rate) / 100)).toFixed(2),
        };
      });
      const { error: liErr } = await context.supabase
        .from("credit_note_line_items").insert(items);
      if (liErr) throw new Error(liErr.message);
    }
    return { id: cn.id };
  });

// ---------- Statement ----------
export const getCustomerStatement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { unit_id: string; from?: string; to?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSalesManager(context.supabase, context.userId);
    const [{ data: unit }, { data: invoices }, { data: payments }, { data: credits }] = await Promise.all([
      context.supabase.from("units")
        .select("*, residents(full_name, email, is_active)")
        .eq("id", data.unit_id).single(),
      context.supabase.from("invoices").select("*").eq("unit_id", data.unit_id).order("created_at"),
      context.supabase.from("payments")
        .select("*, payment_allocations(invoice_id, amount_applied)")
        .order("paid_at"),
      context.supabase.from("credit_notes").select("*").eq("unit_id", data.unit_id).order("issued_at"),
    ]);
    // Filter payments to this unit via allocations
    const unitInvoiceIds = new Set((invoices ?? []).map((i: any) => i.id));
    const unitPayments = (payments ?? []).filter((p: any) =>
      (p.payment_allocations ?? []).some((a: any) => unitInvoiceIds.has(a.invoice_id))
    );
    return { unit, invoices: invoices ?? [], payments: unitPayments, credits: credits ?? [] };
  });

// ---------- Templates ----------
export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSalesManager(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("document_templates").select("*").order("template_type, name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    template_type: "invoice" | "credit_note" | "receipt" | "statement" | "work_order" | "purchase_order";
    name: string;
    logo_url?: string | null;
    primary_color: string;
    accent_color: string;
    header_text?: string | null;
    footer_text?: string | null;
    fields_json: Record<string, any>;
    layout: "compact" | "standard" | "detailed";
    is_default: boolean;
  }) => d)
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Admin only");
    if (data.is_default) {
      await context.supabase.from("document_templates")
        .update({ is_default: false })
        .eq("template_type", data.template_type);
    }
    const payload = { ...data, created_by: context.userId };
    const { data: row, error } = data.id
      ? await context.supabase.from("document_templates").update(payload).eq("id", data.id).select("id").single()
      : await context.supabase.from("document_templates").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Admin only");
    const { error } = await context.supabase.from("document_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Admin only");
    const { data: src, error: e1 } = await context.supabase
      .from("document_templates").select("*").eq("id", data.id).single();
    if (e1 || !src) throw new Error(e1?.message ?? "Not found");
    const { id: _omitId, created_at: _c, updated_at: _u, ...rest } = src as any;
    const copy = { ...rest, name: `${src.name} (copy)`, is_default: false, created_by: context.userId };
    const { data: row, error } = await context.supabase
      .from("document_templates").insert(copy).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });


// ---------- Audit ----------
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table?: string; limit?: number }) => d)
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Admin only");
    let q = context.supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(data.limit ?? 100);
    if (data.table) q = q.eq("table_name", data.table);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- PDF generation ----------
type DocKind = "invoice" | "credit_note" | "receipt" | "statement";

export const generateDocumentPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: DocKind; id: string; unit_id?: string; from?: string; to?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertSalesManager(context.supabase, context.userId);
    const { generatePdf } = await import("./pdf.server");

    const { data: template } = await context.supabase
      .from("document_templates").select("*")
      .eq("template_type", data.kind).eq("is_default", true).maybeSingle();

    let docData: any = {};
    if (data.kind === "invoice") {
      const { data: inv } = await context.supabase.from("invoices")
        .select("*, units(unit_number, building, residents(full_name, email)), invoice_line_items(*)")
        .eq("id", data.id).single();
      docData = inv;
    } else if (data.kind === "receipt") {
      const { data: pay } = await context.supabase.from("payments")
        .select("*, payment_allocations(*, invoices(invoice_number, unit_id, units(unit_number, building, residents(full_name, email))))")
        .eq("id", data.id).single();
      docData = pay;
    } else if (data.kind === "credit_note") {
      const { data: cn } = await context.supabase.from("credit_notes")
        .select("*, units(unit_number, building, residents(full_name, email)), credit_note_line_items(*)")
        .eq("id", data.id).single();
      docData = cn;
    } else if (data.kind === "statement") {
      const [{ data: unit }, { data: invoices }, { data: credits }, { data: payments }] = await Promise.all([
        context.supabase.from("units").select("*, residents(full_name, email)").eq("id", data.unit_id!).single(),
        context.supabase.from("invoices").select("*").eq("unit_id", data.unit_id!),
        context.supabase.from("credit_notes").select("*").eq("unit_id", data.unit_id!),
        context.supabase.from("payments").select("*, payment_allocations(invoice_id, amount_applied)"),
      ]);
      const ids = new Set((invoices ?? []).map((i: any) => i.id));
      const unitPayments = (payments ?? []).filter((p: any) =>
        (p.payment_allocations ?? []).some((a: any) => ids.has(a.invoice_id))
      );
      docData = { unit, invoices, credits, payments: unitPayments, from: data.from, to: data.to };
    }

    const bytes = await generatePdf(data.kind, docData, (template as any) ?? null);
    return { base64: Buffer.from(bytes).toString("base64"), filename: filenameFor(data.kind, docData) };
  });

function filenameFor(kind: DocKind, d: any): string {
  if (kind === "invoice") return `${d?.invoice_number ?? "invoice"}.pdf`;
  if (kind === "receipt") return `${d?.receipt_number ?? "receipt"}.pdf`;
  if (kind === "credit_note") return `${d?.credit_note_number ?? "credit-note"}.pdf`;
  return `statement-${d?.unit?.unit_number ?? "customer"}.pdf`;
}
