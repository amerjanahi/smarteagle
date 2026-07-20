import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertFinance(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("can_manage_sales", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export type ReportRow = Record<string, any>;
export type ReportResult = { columns: { key: string; label: string }[]; rows: ReportRow[] };

type Filters = {
  from?: string;
  to?: string;
  unit_id?: string;
  resident_id?: string;
  category?: string;
  status?: string;
};

function dateRange(f: Filters) {
  const from = f.from ? `${f.from}T00:00:00.000Z` : "1970-01-01T00:00:00.000Z";
  const to = f.to ? `${f.to}T23:59:59.999Z` : new Date().toISOString();
  return { from, to };
}

// ---- Reports ----

export const rptInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters) => d)
  .handler(async ({ data, context }): Promise<ReportResult> => {
    await assertFinance(context.supabase, context.userId);
    const { from, to } = dateRange(data);
    let q = context.supabase
      .from("invoices")
      .select("invoice_number, customer_name, unit_id, resident_id, amount, amount_paid, status, due_date, created_at")
      .gte("created_at", from).lte("created_at", to)
      .order("created_at", { ascending: false });
    if (data.unit_id) q = q.eq("unit_id", data.unit_id);
    if (data.resident_id) q = q.eq("resident_id", data.resident_id);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return {
      columns: [
        { key: "invoice_number", label: "Invoice #" },
        { key: "customer_name", label: "Customer" },
        { key: "created_at", label: "Date" },
        { key: "due_date", label: "Due" },
        { key: "amount", label: "Amount" },
        { key: "amount_paid", label: "Paid" },
        { key: "balance", label: "Balance" },
        { key: "status", label: "Status" },
      ],
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        created_at: r.created_at?.slice(0, 10),
        balance: Number(r.amount || 0) - Number(r.amount_paid || 0),
      })),
    };
  });

export const rptPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters) => d)
  .handler(async ({ data, context }): Promise<ReportResult> => {
    await assertFinance(context.supabase, context.userId);
    const { from, to } = dateRange(data);
    const { data: rows, error } = await context.supabase
      .from("payments")
      .select("receipt_number, amount, payment_method, paid_at, invoice_id, notes")
      .gte("paid_at", from).lte("paid_at", to)
      .order("paid_at", { ascending: false });
    if (error) throw new Error(error.message);
    return {
      columns: [
        { key: "receipt_number", label: "Receipt #" },
        { key: "paid_at", label: "Date" },
        { key: "payment_method", label: "Method" },
        { key: "amount", label: "Amount" },
        { key: "notes", label: "Notes" },
      ],
      rows: (rows ?? []).map((r: any) => ({ ...r, paid_at: r.paid_at?.slice(0, 10) })),
    };
  });

export const rptExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters) => d)
  .handler(async ({ data, context }): Promise<ReportResult> => {
    await assertFinance(context.supabase, context.userId);
    let q = context.supabase
      .from("expenses")
      .select("expense_date, category, description, amount, vat_amount, total_amount, vendor_name, status")
      .order("expense_date", { ascending: false });
    if (data.from) q = q.gte("expense_date", data.from);
    if (data.to) q = q.lte("expense_date", data.to);
    if (data.category) q = q.eq("category", data.category);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return {
      columns: [
        { key: "expense_date", label: "Date" },
        { key: "category", label: "Category" },
        { key: "vendor_name", label: "Vendor" },
        { key: "description", label: "Description" },
        { key: "amount", label: "Amount" },
        { key: "vat_amount", label: "VAT" },
        { key: "total_amount", label: "Total" },
        { key: "status", label: "Status" },
      ],
      rows: rows ?? [],
    };
  });

export const rptPurchaseInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters) => d)
  .handler(async ({ data, context }): Promise<ReportResult> => {
    await assertFinance(context.supabase, context.userId);
    let q = context.supabase
      .from("purchase_invoices")
      .select("bill_number, vendor_name, invoice_date, due_date, total_amount, amount_paid, balance_due, status")
      .order("invoice_date", { ascending: false });
    if (data.from) q = q.gte("invoice_date", data.from);
    if (data.to) q = q.lte("invoice_date", data.to);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return {
      columns: [
        { key: "bill_number", label: "Bill #" },
        { key: "vendor_name", label: "Vendor" },
        { key: "invoice_date", label: "Date" },
        { key: "due_date", label: "Due" },
        { key: "total_amount", label: "Total" },
        { key: "amount_paid", label: "Paid" },
        { key: "balance_due", label: "Balance" },
        { key: "status", label: "Status" },
      ],
      rows: rows ?? [],
    };
  });

export const rptResidents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters) => d)
  .handler(async ({ context }): Promise<ReportResult> => {
    await assertFinance(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("residents")
      .select("full_name, email, phone, is_active, move_in_date, move_out_date, unit_id")
      .order("full_name");
    if (error) throw new Error(error.message);
    return {
      columns: [
        { key: "full_name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "unit_id", label: "Unit" },
        { key: "move_in_date", label: "Move-in" },
        { key: "move_out_date", label: "Move-out" },
        { key: "is_active", label: "Active" },
      ],
      rows: rows ?? [],
    };
  });

export const rptUnits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters) => d)
  .handler(async ({ context }): Promise<ReportResult> => {
    await assertFinance(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("units")
      .select("unit_number, unit_type, bedrooms, bathrooms, size_sqft, service_charge_rate, is_occupied")
      .order("unit_number");
    if (error) throw new Error(error.message);
    return {
      columns: [
        { key: "unit_number", label: "Unit #" },
        { key: "unit_type", label: "Type" },
        { key: "bedrooms", label: "Beds" },
        { key: "bathrooms", label: "Baths" },
        { key: "size_sqft", label: "Size (sqft)" },
        { key: "service_charge_rate", label: "Service Rate" },
        { key: "is_occupied", label: "Occupied" },
      ],
      rows: rows ?? [],
    };
  });

export const rptBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters) => d)
  .handler(async ({ data, context }): Promise<ReportResult> => {
    await assertFinance(context.supabase, context.userId);
    let q = context.supabase
      .from("bank_transactions")
      .select("transaction_date, description, reference, amount, direction, status, account_id")
      .order("transaction_date", { ascending: false });
    if (data.from) q = q.gte("transaction_date", data.from);
    if (data.to) q = q.lte("transaction_date", data.to);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return {
      columns: [
        { key: "transaction_date", label: "Date" },
        { key: "description", label: "Description" },
        { key: "reference", label: "Reference" },
        { key: "direction", label: "Direction" },
        { key: "amount", label: "Amount" },
        { key: "status", label: "Status" },
      ],
      rows: rows ?? [],
    };
  });

export const rptAnnualFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters) => d)
  .handler(async ({ context }): Promise<ReportResult> => {
    await assertFinance(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("annual_fee_calculations")
      .select("year, unit_id, resident_id, base_amount, vat_amount, total_amount, frequency, status, generated_at")
      .order("year", { ascending: false });
    if (error) throw new Error(error.message);
    return {
      columns: [
        { key: "year", label: "Year" },
        { key: "unit_id", label: "Unit" },
        { key: "resident_id", label: "Resident" },
        { key: "frequency", label: "Frequency" },
        { key: "base_amount", label: "Base" },
        { key: "vat_amount", label: "VAT" },
        { key: "total_amount", label: "Total" },
        { key: "status", label: "Status" },
      ],
      rows: rows ?? [],
    };
  });

export const rptAging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters) => d)
  .handler(async ({ data, context }): Promise<ReportResult> => {
    await assertFinance(context.supabase, context.userId);
    const { data: invs, error } = await context.supabase
      .from("invoices")
      .select("invoice_number, customer_name, due_date, amount, amount_paid, status")
      .neq("status", "cancelled").neq("status", "paid");
    if (error) throw new Error(error.message);
    const today = data.to ? new Date(`${data.to}T23:59:59Z`) : new Date();
    const rows = (invs ?? []).map((i: any) => {
      const balance = Number(i.amount || 0) - Number(i.amount_paid || 0);
      const due = i.due_date ? new Date(i.due_date) : today;
      const days = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
      const bucket = days <= 0 ? "Current" : days <= 30 ? "1-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
      return { ...i, balance, days_overdue: days, bucket };
    }).filter((r: any) => r.balance > 0);
    return {
      columns: [
        { key: "invoice_number", label: "Invoice #" },
        { key: "customer_name", label: "Customer" },
        { key: "due_date", label: "Due" },
        { key: "days_overdue", label: "Days" },
        { key: "bucket", label: "Bucket" },
        { key: "balance", label: "Balance" },
      ],
      rows,
    };
  });

export const rptProfitLoss = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters) => d)
  .handler(async ({ data, context }): Promise<ReportResult> => {
    await assertFinance(context.supabase, context.userId);
    const { from, to } = dateRange(data);
    const [pay, exp] = await Promise.all([
      (context.supabase as any).from("payments").select("amount").gte("paid_at", from).lte("paid_at", to),
      (context.supabase as any).from("expenses").select("category, total_amount, amount")
        .gte("expense_date", data.from ?? "1970-01-01").lte("expense_date", data.to ?? "2999-12-31"),
    ]);
    if (pay.error) throw new Error(pay.error.message);
    if (exp.error) throw new Error(exp.error.message);
    const income = (pay.data ?? []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const byCat = new Map<string, number>();
    for (const e of exp.data ?? []) {
      const k = e.category ?? "other";
      byCat.set(k, (byCat.get(k) ?? 0) + Number(e.total_amount ?? e.amount ?? 0));
    }
    const rows: ReportRow[] = [{ line: "Income", detail: "Collections", amount: income }];
    let totalExp = 0;
    for (const [k, v] of byCat) {
      rows.push({ line: "Expense", detail: k, amount: v });
      totalExp += v;
    }
    rows.push({ line: "Net Profit", detail: "Income - Expenses", amount: income - totalExp });
    return {
      columns: [
        { key: "line", label: "Line" },
        { key: "detail", label: "Detail" },
        { key: "amount", label: "Amount" },
      ],
      rows,
    };
  });

export const rptBalanceSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters) => d)
  .handler(async ({ context }): Promise<ReportResult> => {
    await assertFinance(context.supabase, context.userId);
    const [banks, ar, ap] = await Promise.all([
      (context.supabase as any).from("bank_accounts").select("account_name, current_balance"),
      (context.supabase as any).from("invoices").select("amount, amount_paid, status").neq("status", "cancelled"),
      (context.supabase as any).from("purchase_invoices").select("total_amount, amount_paid, status").neq("status", "cancelled"),
    ]);
    if (banks.error) throw new Error(banks.error.message);
    if (ar.error) throw new Error(ar.error.message);
    if (ap.error) throw new Error(ap.error.message);
    const cash = (banks.data ?? []).reduce((s: number, b: any) => s + Number(b.current_balance || 0), 0);
    const receivable = (ar.data ?? []).reduce((s: number, i: any) => s + (Number(i.amount || 0) - Number(i.amount_paid || 0)), 0);
    const payable = (ap.data ?? []).reduce((s: number, i: any) => s + (Number(i.total_amount || 0) - Number(i.amount_paid || 0)), 0);
    const assets = cash + receivable;
    const equity = assets - payable;
    return {
      columns: [
        { key: "section", label: "Section" },
        { key: "item", label: "Item" },
        { key: "amount", label: "Amount" },
      ],
      rows: [
        { section: "Assets", item: "Cash & Bank", amount: cash },
        { section: "Assets", item: "Accounts Receivable", amount: receivable },
        { section: "Assets", item: "Total Assets", amount: assets },
        { section: "Liabilities", item: "Accounts Payable", amount: payable },
        { section: "Equity", item: "Retained Equity", amount: equity },
      ],
    };
  });

export const rptCashFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Filters) => d)
  .handler(async ({ data, context }): Promise<ReportResult> => {
    await assertFinance(context.supabase, context.userId);
    const { from, to } = dateRange(data);
    const [pay, vp, exp] = await Promise.all([
      (context.supabase as any).from("payments").select("amount, paid_at").gte("paid_at", from).lte("paid_at", to),
      (context.supabase as any).from("vendor_payments").select("amount, payment_date")
        .gte("payment_date", data.from ?? "1970-01-01").lte("payment_date", data.to ?? "2999-12-31"),
      (context.supabase as any).from("expenses").select("total_amount, amount, expense_date")
        .gte("expense_date", data.from ?? "1970-01-01").lte("expense_date", data.to ?? "2999-12-31"),
    ]);
    if (pay.error) throw new Error(pay.error.message);
    const inflow = (pay.data ?? []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const outVp = (vp.data ?? []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const outExp = (exp.data ?? []).reduce((s: number, e: any) => s + Number(e.total_amount ?? e.amount ?? 0), 0);
    return {
      columns: [
        { key: "type", label: "Type" },
        { key: "detail", label: "Detail" },
        { key: "amount", label: "Amount" },
      ],
      rows: [
        { type: "Inflow", detail: "Customer Receipts", amount: inflow },
        { type: "Outflow", detail: "Vendor Payments", amount: outVp },
        { type: "Outflow", detail: "Expenses", amount: outExp },
        { type: "Net", detail: "Net Cash Flow", amount: inflow - outVp - outExp },
      ],
    };
  });
