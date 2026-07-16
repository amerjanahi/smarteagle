import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertFinance(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("can_manage_sales", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: finance access required");
}

export type FinanceReport = {
  range: { from: string; to: string };
  income: {
    invoiced: number;
    collected: number;
    outstanding: number;
    invoice_count: number;
    payment_count: number;
  };
  expenses: {
    total: number;
    count: number;
    by_category: { category: string; amount: number }[];
  };
  net: number;
  aging: { bucket: string; amount: number; count: number }[];
  collections_by_method: { method: string; amount: number; count: number }[];
  monthly: { month: string; invoiced: number; collected: number; expenses: number }[];
};

export const financeReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from: string; to: string }) => d)
  .handler(async ({ data, context }): Promise<FinanceReport> => {
    await assertFinance(context.supabase, context.userId);
    const { supabase } = context;
    const from = data.from;
    const to = data.to;
    // pad "to" to end of day
    const toEnd = `${to}T23:59:59.999Z`;
    const fromStart = `${from}T00:00:00.000Z`;

    const [invRes, payRes, expRes] = await Promise.all([
      supabase.from("invoices").select("id, amount, amount_paid, status, created_at, due_date").gte("created_at", fromStart).lte("created_at", toEnd),
      supabase.from("payments").select("amount, payment_method, paid_at").gte("paid_at", fromStart).lte("paid_at", toEnd),
      supabase.from("expenses").select("category, amount, total_amount, expense_date").gte("expense_date", from).lte("expense_date", to),
    ]);
    if (invRes.error) throw new Error(invRes.error.message);
    if (payRes.error) throw new Error(payRes.error.message);
    if (expRes.error) throw new Error(expRes.error.message);

    const invoices = invRes.data ?? [];
    const payments = payRes.data ?? [];
    const expenses = expRes.data ?? [];

    const invoiced = invoices.filter((i: any) => i.status !== "cancelled").reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const collected = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const outstanding = invoices.filter((i: any) => i.status !== "cancelled").reduce((s: number, i: any) => s + (Number(i.amount || 0) - Number(i.amount_paid || 0)), 0);

    const expenseTotal = expenses.reduce((s: number, e: any) => s + Number(e.total_amount ?? e.amount ?? 0), 0);
    const byCat = new Map<string, number>();
    for (const e of expenses) {
      const key = e.category ?? "other";
      byCat.set(key, (byCat.get(key) ?? 0) + Number(e.total_amount ?? e.amount ?? 0));
    }

    // Aging: uses ALL unpaid invoices as-of "to"
    const { data: openInvs, error: agingErr } = await supabase
      .from("invoices").select("amount, amount_paid, due_date, status").neq("status", "cancelled").neq("status", "paid");
    if (agingErr) throw new Error(agingErr.message);
    const today = new Date(toEnd);
    const buckets = { Current: { amount: 0, count: 0 }, "1-30": { amount: 0, count: 0 }, "31-60": { amount: 0, count: 0 }, "61-90": { amount: 0, count: 0 }, "90+": { amount: 0, count: 0 } };
    for (const i of openInvs ?? []) {
      const bal = Number(i.amount || 0) - Number(i.amount_paid || 0);
      if (bal <= 0) continue;
      const due = i.due_date ? new Date(i.due_date) : today;
      const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
      const key = days <= 0 ? "Current" : days <= 30 ? "1-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
      buckets[key].amount += bal;
      buckets[key].count += 1;
    }

    const collMap = new Map<string, { amount: number; count: number }>();
    for (const p of payments) {
      const m = p.payment_method ?? "other";
      const cur = collMap.get(m) ?? { amount: 0, count: 0 };
      cur.amount += Number(p.amount || 0);
      cur.count += 1;
      collMap.set(m, cur);
    }

    // Monthly trend
    const monthMap = new Map<string, { invoiced: number; collected: number; expenses: number }>();
    const key = (d: string | Date) => new Date(d).toISOString().slice(0, 7);
    for (const i of invoices) {
      if (i.status === "cancelled") continue;
      const k = key(i.created_at);
      const c = monthMap.get(k) ?? { invoiced: 0, collected: 0, expenses: 0 };
      c.invoiced += Number(i.amount || 0);
      monthMap.set(k, c);
    }
    for (const p of payments) {
      const k = key(p.paid_at);
      const c = monthMap.get(k) ?? { invoiced: 0, collected: 0, expenses: 0 };
      c.collected += Number(p.amount || 0);
      monthMap.set(k, c);
    }
    for (const e of expenses) {
      const k = key(e.expense_date);
      const c = monthMap.get(k) ?? { invoiced: 0, collected: 0, expenses: 0 };
      c.expenses += Number(e.total_amount ?? e.amount ?? 0);
      monthMap.set(k, c);
    }

    return {
      range: { from, to },
      income: {
        invoiced,
        collected,
        outstanding,
        invoice_count: invoices.length,
        payment_count: payments.length,
      },
      expenses: {
        total: expenseTotal,
        count: expenses.length,
        by_category: [...byCat.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
      },
      net: collected - expenseTotal,
      aging: Object.entries(buckets).map(([bucket, v]) => ({ bucket, ...v })),
      collections_by_method: [...collMap.entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.amount - a.amount),
      monthly: [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
    };
  });
