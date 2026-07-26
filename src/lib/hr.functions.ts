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

async function assertRunUnlocked(ctx: Ctx, runId: string) {
  const { data: run } = await ctx.supabase.from("payroll_runs").select("status").eq("id", runId).maybeSingle();
  if (!run) throw new Error("Run not found");
  if (["approved", "posted", "paid"].includes(run.status)) throw new Error("Run is locked. Use adjustments instead.");
  return run;
}

// ============ EMPLOYEES ============
export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("employees").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyEmployee = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("employees").select("*").eq("user_id", context.userId).maybeSingle();
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
  currency: z.string().default("AED"),
  iban: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
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
      .from("employees").upsert(payload).select().single();
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

// ============ HR CONFIG: ALLOWANCE / DEDUCTION / GRANT TYPES + SS ============
const typeInput = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  default_amount: z.number().default(0),
  is_active: z.boolean().default(true),
});

export const listAllowanceTypes = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await context.supabase.from("allowance_types").select("*").order("name")).data ?? []);
export const upsertAllowanceType = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v) => typeInput.extend({ is_taxable: z.boolean().default(true) }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { data: row, error } = await context.supabase.from("allowance_types").upsert(data).select().single();
    if (error) throw new Error(error.message); return row;
  });
export const deleteAllowanceType = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { error } = await context.supabase.from("allowance_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message); return { ok: true };
  });

export const listDeductionTypes = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await context.supabase.from("deduction_types").select("*").order("name")).data ?? []);
export const upsertDeductionType = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v) => typeInput.extend({ is_statutory: z.boolean().default(false) }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { data: row, error } = await context.supabase.from("deduction_types").upsert(data).select().single();
    if (error) throw new Error(error.message); return row;
  });
export const deleteDeductionType = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { error } = await context.supabase.from("deduction_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message); return { ok: true };
  });

export const listGrantTypes = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await context.supabase.from("grant_types").select("*").order("name")).data ?? []);
export const upsertGrantType = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({
    id: z.string().uuid().optional(),
    code: z.string().min(1), name: z.string().min(1),
    calc_type: z.enum(["fixed", "rate"]).default("fixed"),
    rate_or_amount: z.number().default(0),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    is_active: z.boolean().default(true),
  }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const payload: any = { ...data };
    if (!payload.start_date) delete payload.start_date;
    if (!payload.end_date) delete payload.end_date;
    const { data: row, error } = await context.supabase.from("grant_types").upsert(payload).select().single();
    if (error) throw new Error(error.message); return row;
  });
export const deleteGrantType = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { error } = await context.supabase.from("grant_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message); return { ok: true };
  });

export const getSsConfig = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await context.supabase.from("social_security_config").select("*").eq("is_active", true).order("effective_from", { ascending: false }).limit(1).maybeSingle()).data);
export const upsertSsConfig = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({
    id: z.string().uuid().optional(),
    scheme_name: z.string().default("default"),
    employee_rate: z.number().min(0).max(1),
    employer_rate: z.number().min(0).max(1),
    cap_amount: z.number().nullable().optional(),
    effective_from: z.string(),
    is_active: z.boolean().default(true),
  }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { data: row, error } = await context.supabase.from("social_security_config").upsert(data).select().single();
    if (error) throw new Error(error.message); return row;
  });

// ============ LEAVE TYPES CRUD ============
export const upsertLeaveType = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({
    id: z.string().uuid().optional(),
    code: z.string().min(1), name: z.string().min(1),
    days_per_year: z.number().min(0).default(0),
    paid: z.boolean().default(true),
    carry_forward: z.boolean().default(false),
    max_carry_days: z.number().min(0).default(0),
    requires_document: z.boolean().default(false),
    allow_half_day: z.boolean().default(false),
    is_active: z.boolean().default(true),
  }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { data: row, error } = await context.supabase.from("leave_types").upsert(data).select().single();
    if (error) throw new Error(error.message); return row;
  });
export const deleteLeaveType = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { error } = await context.supabase.from("leave_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message); return { ok: true };
  });

// ============ EMPLOYEE COMPENSATION COMPONENTS ============
export const listEmployeeComponents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ employee_id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const [a, d, g] = await Promise.all([
      context.supabase.from("employee_allowances").select("*, allowance_types(code,name)").eq("employee_id", data.employee_id),
      context.supabase.from("employee_deductions").select("*, deduction_types(code,name)").eq("employee_id", data.employee_id),
      context.supabase.from("employee_grants").select("*, grant_types(code,name,calc_type,rate_or_amount)").eq("employee_id", data.employee_id),
    ]);
    return { allowances: a.data ?? [], deductions: d.data ?? [], grants: g.data ?? [] };
  });

function makeCompFn(table: string, refField: string) {
  return {
    upsert: createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
      .inputValidator((v) => z.object({
        id: z.string().uuid().optional(),
        employee_id: z.string().uuid(),
        [refField]: z.string().uuid(),
        amount: z.number().optional(),
        amount_override: z.number().nullable().optional(),
        start_date: z.string(),
        end_date: z.string().nullable().optional(),
        is_active: z.boolean().default(true),
      }).parse(v))
      .handler(async ({ data, context }) => {
        await assertHR(context);
        const payload: any = { ...data };
        if (!payload.end_date) payload.end_date = null;
        const { data: row, error } = await context.supabase.from(table).upsert(payload).select().single();
        if (error) throw new Error(error.message); return row;
      }),
    del: createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
      .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
      .handler(async ({ data, context }) => {
        await assertHR(context);
        const { error } = await context.supabase.from(table).delete().eq("id", data.id);
        if (error) throw new Error(error.message); return { ok: true };
      }),
  };
}
const _al = makeCompFn("employee_allowances", "allowance_type_id");
const _dd = makeCompFn("employee_deductions", "deduction_type_id");
const _gr = makeCompFn("employee_grants", "grant_type_id");
export const upsertEmployeeAllowance = _al.upsert;
export const deleteEmployeeAllowance = _al.del;
export const upsertEmployeeDeduction = _dd.upsert;
export const deleteEmployeeDeduction = _dd.del;
export const upsertEmployeeGrant = _gr.upsert;
export const deleteEmployeeGrant = _gr.del;

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
      .from("attendance").upsert(data, { onConflict: "employee_id,date" }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const bulkImportAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({
    rows: z.array(z.object({
      employee_no: z.string(),
      date: z.string(),
      check_in: z.string().optional().nullable(),
      check_out: z.string().optional().nullable(),
      hours: z.number().optional().nullable(),
      status: z.string(),
      notes: z.string().optional(),
    })),
  }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { data: emps } = await context.supabase.from("employees").select("id, employee_no");
    const byNo = new Map<string, string>((emps ?? []).map((e: any) => [String(e.employee_no).trim(), e.id]));
    let ok = 0; const errors: string[] = [];
    for (const r of data.rows) {
      const id = byNo.get(String(r.employee_no).trim());
      if (!id) { errors.push(`Unknown employee_no: ${r.employee_no}`); continue; }
      const status = ["present","absent","leave","holiday","weekend"].includes(r.status) ? r.status : "present";
      const { error } = await context.supabase.from("attendance").upsert({
        employee_id: id, date: r.date,
        check_in: r.check_in || null, check_out: r.check_out || null,
        hours: r.hours ?? null, status, notes: r.notes ?? null,
      }, { onConflict: "employee_id,date" });
      if (error) errors.push(`${r.employee_no} ${r.date}: ${error.message}`);
      else ok++;
    }
    return { inserted: ok, errors };
  });

// ============ LEAVE ============
export const listLeaveTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("leave_types").select("*").order("name");
    return data ?? [];
  });

export const listLeaveRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ status: z.string().optional(), mine: z.boolean().optional() }).parse(v))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("leave_requests")
      .select("*, employees(full_name, employee_no), leave_types(name, code, paid, requires_document, allow_half_day)")
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
      is_half_day: z.boolean().default(false),
      document_url: z.string().optional().nullable(),
      reason: z.string().optional(),
    }).parse(v)
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("leave_requests").insert({ ...data, status: "pending" }).select().single();
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
    const { data: req } = await context.supabase.from("leave_requests").select("*, leave_types(paid)").eq("id", data.id).single();
    const unpaid_days = data.decision === "approved" && req.leave_types && !req.leave_types.paid ? Number(req.days) : 0;
    const { data: updated, error } = await context.supabase
      .from("leave_requests")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_notes: data.review_notes,
        unpaid_days,
      })
      .eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    if (data.decision === "approved") {
      const year = new Date(req.from_date).getFullYear();
      const { data: bal } = await context.supabase
        .from("leave_balances").select("*")
        .eq("employee_id", req.employee_id).eq("leave_type_id", req.leave_type_id).eq("year", year).maybeSingle();
      if (bal) {
        await context.supabase.from("leave_balances").update({ used: Number(bal.used) + Number(req.days) }).eq("id", bal.id);
      }
    }
    return updated;
  });

export const myLeaveBalances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: emp } = await context.supabase.from("employees").select("id").eq("user_id", context.userId).maybeSingle();
    if (!emp) return [];
    const { data } = await context.supabase
      .from("leave_balances").select("*, leave_types(name, code, paid)")
      .eq("employee_id", emp.id).eq("year", new Date().getFullYear());
    return data ?? [];
  });

// ============ PAYROLL ============
export const listPayrollRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payroll_runs").select("*")
      .order("period_year", { ascending: false }).order("period_month", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function computePayslipForEmployee(
  ctx: Ctx, emp: any, period: { year: number; month: number }, ssConfig: any, totalDays: number, from: string, to: string
) {
  const [attRes, alRes, ddRes, grRes, unpaidRes] = await Promise.all([
    ctx.supabase.from("attendance").select("status").eq("employee_id", emp.id).gte("date", from).lte("date", to),
    ctx.supabase.from("employee_allowances").select("amount, start_date, end_date, is_active, allowance_types(name)").eq("employee_id", emp.id).eq("is_active", true),
    ctx.supabase.from("employee_deductions").select("amount, start_date, end_date, is_active, deduction_types(name)").eq("employee_id", emp.id).eq("is_active", true),
    ctx.supabase.from("employee_grants").select("amount_override, start_date, end_date, is_active, grant_types(name, calc_type, rate_or_amount)").eq("employee_id", emp.id).eq("is_active", true),
    ctx.supabase.from("leave_requests").select("days, leave_types(paid)").eq("employee_id", emp.id).eq("status", "approved").gte("from_date", from).lte("to_date", to),
  ]);

  const active = (rows: any[]) => (rows ?? []).filter((r: any) => (!r.start_date || r.start_date <= to) && (!r.end_date || r.end_date >= from));
  const allowances = active(alRes.data).map((r: any) => ({ label: r.allowance_types?.name ?? "Allowance", amount: Number(r.amount || 0) }));
  const deductions = active(ddRes.data).map((r: any) => ({ label: r.deduction_types?.name ?? "Deduction", amount: Number(r.amount || 0) }));

  const basic = Number(emp.basic_salary || 0);
  const grants = active(grRes.data).map((r: any) => {
    const t = r.grant_types;
    const amt = r.amount_override != null ? Number(r.amount_override)
      : t?.calc_type === "rate" ? basic * Number(t.rate_or_amount || 0)
      : Number(t?.rate_or_amount || 0);
    return { label: t?.name ?? "Grant", amount: amt };
  });

  const unpaid_leave_days = (unpaidRes.data ?? [])
    .filter((r: any) => r.leave_types && !r.leave_types.paid)
    .reduce((s: number, r: any) => s + Number(r.days || 0), 0);
  const daily = basic / totalDays;
  const unpaid_leave_amount = daily * unpaid_leave_days;

  const days_worked = (attRes.data ?? []).filter((a: any) => a.status === "present").length;
  const days_absent = (attRes.data ?? []).filter((a: any) => a.status === "absent").length;
  const days_leave = (attRes.data ?? []).filter((a: any) => a.status === "leave").length;

  const allowances_total = allowances.reduce((s, x) => s + x.amount, 0);
  const deductions_total = deductions.reduce((s, x) => s + x.amount, 0);
  const grants_amount = grants.reduce((s, x) => s + x.amount, 0);

  const ssBase = Math.min(basic + allowances_total, Number(ssConfig?.cap_amount ?? Infinity));
  const social_security_ee = ssBase * Number(ssConfig?.employee_rate ?? 0);
  const social_security_er = ssBase * Number(ssConfig?.employer_rate ?? 0);

  const gross = basic + allowances_total + grants_amount;
  const net_pay = gross - deductions_total - social_security_ee - unpaid_leave_amount;

  return {
    payslip: {
      employee_id: emp.id,
      basic,
      allowances_total,
      deductions_total,
      grants_amount,
      social_security_ee,
      social_security_er,
      overtime: 0, overtime_hours: 0,
      unpaid_leave_days, unpaid_leave_amount,
      leave_adjustment: -unpaid_leave_amount,
      gross, net_pay,
      days_worked, days_absent, days_leave,
      currency: emp.currency ?? "AED",
      approval_status: "draft",
      payment_status: "unpaid",
      is_locked: false,
      snapshot: {
        full_name: emp.full_name, employee_no: emp.employee_no,
        position: emp.position, department: emp.department,
        period: `${period.year}-${String(period.month).padStart(2, "0")}`,
      },
    },
    lines: [
      { kind: "basic", label: "Basic Salary", amount: basic },
      ...allowances.map(a => ({ kind: "allowance", label: a.label, amount: a.amount })),
      ...grants.map(g => ({ kind: "grant", label: g.label, amount: g.amount })),
      ...deductions.map(d => ({ kind: "deduction", label: d.label, amount: -d.amount })),
      ...(social_security_ee ? [{ kind: "ss_ee", label: "Social Security (Employee)", amount: -social_security_ee }] : []),
      ...(social_security_er ? [{ kind: "ss_er", label: "Social Security (Employer)", amount: social_security_er }] : []),
      ...(unpaid_leave_amount ? [{ kind: "unpaid_leave", label: `Unpaid Leave (${unpaid_leave_days}d)`, amount: -unpaid_leave_amount }] : []),
    ],
  };
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
    const { data: employees } = await context.supabase.from("employees").select("*").eq("employment_status", "active");
    const { data: ssConfig } = await context.supabase.from("social_security_config").select("*").eq("is_active", true).order("effective_from", { ascending: false }).limit(1).maybeSingle();

    const from = new Date(data.period_year, data.period_month - 1, 1).toISOString().slice(0, 10);
    const to = new Date(data.period_year, data.period_month, 0).toISOString().slice(0, 10);
    const totalDays = new Date(data.period_year, data.period_month, 0).getDate();

    const { data: run, error: rErr } = await context.supabase
      .from("payroll_runs").insert({
        period_month: data.period_month, period_year: data.period_year, status: "draft",
        notes: data.notes, created_by: context.userId, employee_count: employees?.length ?? 0,
        currency: employees?.[0]?.currency ?? "AED",
      }).select().single();
    if (rErr) throw new Error(rErr.message);

    let totalGross = 0, totalDed = 0, totalNet = 0;
    for (const emp of employees ?? []) {
      const { payslip, lines } = await computePayslipForEmployee(context, emp, { year: data.period_year, month: data.period_month }, ssConfig, totalDays, from, to);
      const { data: ps, error: pErr } = await context.supabase.from("payslips").insert({ ...payslip, payroll_run_id: run.id }).select().single();
      if (pErr) throw new Error(pErr.message);
      if (lines.length) await context.supabase.from("payslip_lines").insert(lines.map(l => ({ ...l, payslip_id: ps.id })));
      totalGross += payslip.gross; totalDed += payslip.deductions_total + payslip.social_security_ee + payslip.unpaid_leave_amount; totalNet += payslip.net_pay;
    }
    await context.supabase.from("payroll_runs").update({
      total_gross: totalGross, total_deductions: totalDed, total_net: totalNet,
    }).eq("id", run.id);
    return { ...run, total_gross: totalGross, total_deductions: totalDed, total_net: totalNet };
  });

export const recalculatePayslip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ payslip_id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { data: ps } = await context.supabase.from("payslips").select("*, payroll_runs(*), employees(*)").eq("id", data.payslip_id).single();
    if (!ps) throw new Error("Not found");
    if (ps.is_locked) throw new Error("Payslip is locked");
    await assertRunUnlocked(context, ps.payroll_run_id);

    const { data: ssConfig } = await context.supabase.from("social_security_config").select("*").eq("is_active", true).order("effective_from", { ascending: false }).limit(1).maybeSingle();
    const { period_month, period_year } = ps.payroll_runs;
    const from = new Date(period_year, period_month - 1, 1).toISOString().slice(0, 10);
    const to = new Date(period_year, period_month, 0).toISOString().slice(0, 10);
    const totalDays = new Date(period_year, period_month, 0).getDate();
    const { payslip, lines } = await computePayslipForEmployee(context, ps.employees, { year: period_year, month: period_month }, ssConfig, totalDays, from, to);
    await context.supabase.from("payslip_lines").delete().eq("payslip_id", data.payslip_id);
    await context.supabase.from("payslip_lines").insert(lines.map(l => ({ ...l, payslip_id: data.payslip_id })));
    const { data: updated, error } = await context.supabase.from("payslips").update({ ...payslip, payroll_run_id: ps.payroll_run_id }).eq("id", data.payslip_id).select().single();
    if (error) throw new Error(error.message);
    return updated;
  });

export const deletePayslip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { data: ps } = await context.supabase.from("payslips").select("payroll_run_id, is_locked").eq("id", data.id).single();
    if (!ps) throw new Error("Not found");
    if (ps.is_locked) throw new Error("Locked payslip cannot be deleted");
    await assertRunUnlocked(context, ps.payroll_run_id);
    const { error } = await context.supabase.from("payslips").delete().eq("id", data.id);
    if (error) throw new Error(error.message); return { ok: true };
  });

export const listPayslips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ run_id: z.string().uuid().optional(), mine: z.boolean().optional() }).parse(v))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("payslips")
      .select("*, employees(full_name, employee_no, position, iban, bank_name), payroll_runs(period_month, period_year, currency, status)")
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

export const getPayslipDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: ps } = await context.supabase
      .from("payslips")
      .select("*, employees(full_name, employee_no, position, department, iban, bank_name), payroll_runs(period_month, period_year, status, currency)")
      .eq("id", data.id).single();
    const { data: lines } = await context.supabase.from("payslip_lines").select("*").eq("payslip_id", data.id).order("created_at");
    const { data: adjustments } = await context.supabase.from("payroll_adjustments").select("*").eq("payslip_id", data.id).order("created_at");
    return { ...ps, lines: lines ?? [], adjustments: adjustments ?? [] };
  });

export const submitPayrollForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { error } = await context.supabase.from("payroll_runs")
      .update({ status: "review" as any })
      .eq("id", data.id).eq("status", "draft");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const approvePayrollRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { data: run, error } = await context.supabase.from("payroll_runs").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    if (!["draft", "review"].includes(run.status)) throw new Error("Only draft/review runs can be approved");

    // Lock payslips & lines
    await context.supabase.from("payslips").update({ is_locked: true, approval_status: "approved" }).eq("payroll_run_id", data.id);
    await context.supabase.from("payslip_lines").update({ is_locked: true }).in("payslip_id",
      (await context.supabase.from("payslips").select("id").eq("payroll_run_id", data.id)).data?.map((p: any) => p.id) ?? []);

    // Look up accounts
    const { data: accounts } = await context.supabase.from("chart_of_accounts").select("id, code, name, account_type");
    const findAcc = (needle: string, type?: string) =>
      accounts?.find((a: any) => a.name.toLowerCase().includes(needle) && (!type || a.account_type === type));
    const salaryExpense = findAcc("salary", "expense") || findAcc("wage", "expense") || findAcc("payroll", "expense");
    const payable = findAcc("payroll", "liability") || findAcc("salary", "liability") || findAcc("payable", "liability");

    const lines = [
      { account_id: salaryExpense?.id ?? null, account_name: salaryExpense?.name ?? "Salary Expense (unmapped)", debit: Number(run.total_gross), credit: 0, memo: `Payroll ${run.period_year}-${String(run.period_month).padStart(2, "0")}` },
      { account_id: payable?.id ?? null, account_name: payable?.name ?? "Salaries Payable (unmapped)", debit: 0, credit: Number(run.total_net), memo: `Net payable` },
    ];
    if (Number(run.total_deductions) > 0) {
      const dedPayable = findAcc("deduction", "liability") || payable;
      lines.push({ account_id: dedPayable?.id ?? null, account_name: dedPayable?.name ?? "Deductions Payable (unmapped)", debit: 0, credit: Number(run.total_deductions), memo: "Deductions withheld" });
    }

    await context.supabase.from("payroll_runs").update({
      status: "approved", approved_by: context.userId, approved_at: new Date().toISOString(), locked_at: new Date().toISOString(),
    }).eq("id", data.id);

    const { data: draft, error: dErr } = await context.supabase
      .from("payroll_journal_drafts")
      .upsert({ payroll_run_id: data.id, lines, status: "pending_review" }, { onConflict: "payroll_run_id" })
      .select().single();
    if (dErr) throw new Error(dErr.message);
    return draft;
  });

export const addPayrollAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({
    payslip_id: z.string().uuid(),
    reason: z.string().min(1),
    amount: z.number(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    await assertHR(context);
    const { data: adj, error } = await context.supabase.from("payroll_adjustments").insert({ ...data, created_by: context.userId }).select().single();
    if (error) throw new Error(error.message);
    // Add an adjustment line for visibility (not locked so it stays traceable)
    await context.supabase.from("payslip_lines").insert({ payslip_id: data.payslip_id, kind: "adjustment", label: `Adj: ${data.reason}`, amount: data.amount, is_locked: false });
    // Update net_pay
    const { data: ps } = await context.supabase.from("payslips").select("net_pay").eq("id", data.payslip_id).single();
    await context.supabase.from("payslips").update({ net_pay: Number(ps.net_pay) + Number(data.amount) }).eq("id", data.payslip_id);
    return adj;
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
        status: data.decision, reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(), review_notes: data.review_notes,
      })
      .eq("id", data.id).select().single();
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
    const { error } = await context.supabase.from("payroll_runs")
      .update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("payslips").update({ payment_status: "paid" }).eq("payroll_run_id", data.id);
    return { ok: true };
  });
