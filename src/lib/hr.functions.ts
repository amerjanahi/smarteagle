import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Ctx = { supabase: any; userId: string };

async function assertHR(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_hr_staff", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: HR staff only");
}

async function assertFinance(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("can_manage_sales", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: Finance staff only");
}

// ============ EMPLOYEES ============
export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyEmployee = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("employees")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data;
  });

const employeeInput = z.object({
  id: z.string().uuid().optional(),
  employee_no: z.string().min(1),
  full_name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  national_id: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  hire_date: z.string(),
  employment_status: z.enum(["active", "on_leave", "terminated", "suspended"]).default("active"),
  basic_salary: z.number().min(0),
  allowances: z.array(z.object({ label: z.string(), amount: z.number() })).default([]),
  deductions: z.array(z.object({ label: z.string(), amount: z.number() })).default([]),
  currency: z.string().default("AED"),
  user_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
});

export const upsertEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => employeeInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const payload: any = { ...data };
    if (payload.email === "") delete payload.email;
    if (!payload.user_id) delete payload.user_id;
    const { data: row, error } = await context.supabase
      .from("employees")
      .upsert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { error } = await context.supabase.from("employees").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ATTENDANCE ============
export const listAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      employee_id: z.string().uuid().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("attendance").select("*, employees(full_name, employee_no)").order("date", { ascending: false }).limit(500);
    if (data.employee_id) q = q.eq("employee_id", data.employee_id);
    if (data.from) q = q.gte("date", data.from);
    if (data.to) q = q.lte("date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      id: z.string().uuid().optional(),
      employee_id: z.string().uuid(),
      date: z.string(),
      check_in: z.string().nullable().optional(),
      check_out: z.string().nullable().optional(),
      hours: z.number().nullable().optional(),
      status: z.enum(["present", "absent", "leave", "holiday", "weekend"]),
      notes: z.string().optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { data: row, error } = await context.supabase
      .from("attendance")
      .upsert(data, { onConflict: "employee_id,date" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============ LEAVE ============
export const listLeaveTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("leave_types").select("*").eq("is_active", true).order("name");
    return data ?? [];
  });

export const listLeaveRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ status: z.string().optional(), mine: z.boolean().optional() }).parse(v))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("leave_requests")
      .select("*, employees(full_name, employee_no), leave_types(name, code)")
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status as any);
    if (data.mine) {
      const { data: emp } = await context.supabase.from("employees").select("id").eq("user_id", context.userId).maybeSingle();
      if (!emp) return [];
      q = q.eq("employee_id", emp.id);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      employee_id: z.string().uuid(),
      leave_type_id: z.string().uuid(),
      from_date: z.string(),
      to_date: z.string(),
      days: z.number().min(0.5),
      reason: z.string().optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("leave_requests")
      .insert({ ...data, status: "pending" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const reviewLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      review_notes: z.string().optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { data: req, error } = await context.supabase
      .from("leave_requests")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_notes: data.review_notes,
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    // If approved, bump balance used
    if (data.decision === "approved") {
      const year = new Date(req.from_date).getFullYear();
      const { data: bal } = await context.supabase
        .from("leave_balances")
        .select("*")
        .eq("employee_id", req.employee_id)
        .eq("leave_type_id", req.leave_type_id)
        .eq("year", year)
        .maybeSingle();
      if (bal) {
        await context.supabase
          .from("leave_balances")
          .update({ used: Number(bal.used) + Number(req.days) })
          .eq("id", bal.id);
      }
    }
    return req;
  });

export const myLeaveBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: emp } = await context.supabase.from("employees").select("id").eq("user_id", context.userId).maybeSingle();
    if (!emp) return [];
    const { data } = await context.supabase
      .from("leave_balances")
      .select("*, leave_types(name, code, paid)")
      .eq("employee_id", emp.id)
      .eq("year", new Date().getFullYear());
    return data ?? [];
  });

// ============ PAYROLL ============
export const listPayrollRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payroll_runs")
      .select("*")
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

function sumItems(items: Array<{ amount: number }>) {
  return (items ?? []).reduce((s, x) => s + Number(x.amount || 0), 0);
}

export const createPayrollRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      period_month: z.number().int().min(1).max(12),
      period_year: z.number().int().min(2000).max(2100),
      notes: z.string().optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { data: employees, error: eErr } = await context.supabase
      .from("employees")
      .select("*")
      .eq("employment_status", "active");
    if (eErr) throw new Error(eErr.message);

    const from = new Date(data.period_year, data.period_month - 1, 1).toISOString().slice(0, 10);
    const to = new Date(data.period_year, data.period_month, 0).toISOString().slice(0, 10);
    const totalDays = new Date(data.period_year, data.period_month, 0).getDate();

    const { data: run, error: rErr } = await context.supabase
      .from("payroll_runs")
      .insert({
        period_month: data.period_month,
        period_year: data.period_year,
        status: "draft",
        notes: data.notes,
        created_by: context.userId,
        employee_count: employees.length,
        currency: employees[0]?.currency ?? "AED",
      })
      .select()
      .single();
    if (rErr) throw new Error(rErr.message);

    let totalGross = 0, totalDed = 0, totalNet = 0;
    const payslips: any[] = [];
    for (const emp of employees) {
      const { data: att } = await context.supabase
        .from("attendance")
        .select("status")
        .eq("employee_id", emp.id).gte("date", from).lte("date", to);
      const days_worked = (att ?? []).filter((a: any) => a.status === "present").length;
      const days_absent = (att ?? []).filter((a: any) => a.status === "absent").length;
      const days_leave = (att ?? []).filter((a: any) => a.status === "leave").length;
      const basic = Number(emp.basic_salary || 0);
      const allowances_total = sumItems((emp.allowances as any) || []);
      const deductions_total = sumItems((emp.deductions as any) || []);
      const daily = basic / totalDays;
      const leave_adjustment = -daily * days_absent;
      const gross = basic + allowances_total;
      const net_pay = gross + leave_adjustment - deductions_total;
      totalGross += gross;
      totalDed += deductions_total;
      totalNet += net_pay;
      payslips.push({
        payroll_run_id: run.id,
        employee_id: emp.id,
        basic, allowances_total, deductions_total, leave_adjustment,
        gross, net_pay, days_worked, days_absent, days_leave,
        snapshot: {
          full_name: emp.full_name, employee_no: emp.employee_no,
          position: emp.position, department: emp.department,
          allowances: emp.allowances, deductions: emp.deductions,
          period: `${data.period_year}-${String(data.period_month).padStart(2, "0")}`,
        },
      });
    }
    if (payslips.length) {
      const { error: pErr } = await context.supabase.from("payslips").insert(payslips);
      if (pErr) throw new Error(pErr.message);
    }
    await context.supabase
      .from("payroll_runs")
      .update({ total_gross: totalGross, total_deductions: totalDed, total_net: totalNet })
      .eq("id", run.id);
    return { ...run, total_gross: totalGross, total_deductions: totalDed, total_net: totalNet };
  });

export const listPayslips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ run_id: z.string().uuid().optional(), mine: z.boolean().optional() }).parse(v))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("payslips")
      .select("*, employees(full_name, employee_no, position), payroll_runs(period_month, period_year, currency)")
      .order("created_at", { ascending: false });
    if (data.run_id) q = q.eq("payroll_run_id", data.run_id);
    if (data.mine) {
      const { data: emp } = await context.supabase.from("employees").select("id").eq("user_id", context.userId).maybeSingle();
      if (!emp) return [];
      q = q.eq("employee_id", emp.id);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const approvePayrollRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    // Load run + totals
    const { data: run, error } = await context.supabase.from("payroll_runs").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    if (run.status !== "draft") throw new Error("Only draft runs can be approved");

    // Look up accounts (best-effort by name)
    const { data: accounts } = await context.supabase.from("chart_of_accounts").select("id, code, name, account_type");
    const findAcc = (needle: string, type?: string) =>
      accounts?.find((a: any) => a.name.toLowerCase().includes(needle) && (!type || a.account_type === type));
    const salaryExpense = findAcc("salary", "expense") || findAcc("wage", "expense") || findAcc("payroll", "expense");
    const payable = findAcc("payroll", "liability") || findAcc("salary", "liability") || findAcc("payable", "liability");

    const lines = [
      { account_id: salaryExpense?.id ?? null, account_name: salaryExpense?.name ?? "Salary Expense (unmapped)", debit: Number(run.total_gross), credit: 0, memo: `Payroll ${run.period_year}-${String(run.period_month).padStart(2, "0")} — gross salaries` },
      { account_id: payable?.id ?? null, account_name: payable?.name ?? "Salaries Payable (unmapped)", debit: 0, credit: Number(run.total_net), memo: `Payroll ${run.period_year}-${String(run.period_month).padStart(2, "0")} — net payable` },
    ];
    if (Number(run.total_deductions) > 0) {
      const dedPayable = findAcc("deduction", "liability") || payable;
      lines.push({ account_id: dedPayable?.id ?? null, account_name: dedPayable?.name ?? "Deductions Payable (unmapped)", debit: 0, credit: Number(run.total_deductions), memo: "Deductions withheld" });
    }

    await context.supabase.from("payroll_runs").update({
      status: "approved", approved_by: context.userId, approved_at: new Date().toISOString(),
    }).eq("id", data.id);

    const { data: draft, error: dErr } = await context.supabase
      .from("payroll_journal_drafts")
      .upsert({ payroll_run_id: data.id, lines, status: "pending_review" }, { onConflict: "payroll_run_id" })
      .select()
      .single();
    if (dErr) throw new Error(dErr.message);
    return draft;
  });

// ============ PAYROLL JOURNALS (Finance side) ============
export const listPayrollJournalDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertFinance(context);
    const { data, error } = await context.supabase
      .from("payroll_journal_drafts")
      .select("*, payroll_runs(period_month, period_year, total_gross, total_net, total_deductions, currency, status)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const reviewPayrollDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      review_notes: z.string().optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    const { data: draft, error } = await context.supabase
      .from("payroll_journal_drafts")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_notes: data.review_notes,
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (data.decision === "approved") {
      await context.supabase.from("payroll_runs").update({
        status: "posted", posted_at: new Date().toISOString(),
      }).eq("id", draft.payroll_run_id);
    }
    return draft;
  });

export const markPayrollPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { error } = await context.supabase
      .from("payroll_runs")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
