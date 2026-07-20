import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertGateStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("security") && !roles.includes("admin")) throw new Error("Forbidden");
}

async function log(
  supabase: any, userId: string,
  action: string,
  meta: { visitor_id?: string | null; unit_id?: string | null; metadata?: any; device_info?: string; session_id?: string }
) {
  await supabase.from("gate_activity_log").insert({
    staff_id: userId,
    action,
    visitor_id: meta.visitor_id ?? null,
    unit_id: meta.unit_id ?? null,
    metadata: meta.metadata ?? {},
    device_info: meta.device_info ?? null,
    session_id: meta.session_id ?? null,
  });
}

export const checkInVisitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { visitorId: string; deviceInfo?: string; sessionId?: string; notes?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertGateStaff(context.supabase, context.userId);
    const { data: v, error: vErr } = await context.supabase.from("visitors").select("*").eq("id", data.visitorId).maybeSingle();
    if (vErr || !v) throw new Error("Visitor not found");
    if (v.blocked) throw new Error("Visitor is blocked");
    const { error } = await context.supabase.from("visitors").update({
      status: "checked_in",
      checked_in_at: new Date().toISOString(),
      checked_in_by: context.userId,
      gate_notes: data.notes ?? v.gate_notes,
    }).eq("id", data.visitorId);
    if (error) throw new Error(error.message);
    await log(context.supabase, context.userId, "check_in", {
      visitor_id: data.visitorId, unit_id: v.unit_id,
      device_info: data.deviceInfo, session_id: data.sessionId,
    });
    return { ok: true };
  });

export const checkOutVisitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { visitorId: string; deviceInfo?: string; sessionId?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertGateStaff(context.supabase, context.userId);
    const { data: v } = await context.supabase.from("visitors").select("unit_id").eq("id", data.visitorId).maybeSingle();
    const { error } = await context.supabase.from("visitors").update({
      status: "checked_out",
      checked_out_at: new Date().toISOString(),
      checked_out_by: context.userId,
    }).eq("id", data.visitorId);
    if (error) throw new Error(error.message);
    await log(context.supabase, context.userId, "check_out", {
      visitor_id: data.visitorId, unit_id: v?.unit_id ?? null,
      device_info: data.deviceInfo, session_id: data.sessionId,
    });
    return { ok: true };
  });

export const registerWalkIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    visitorName: string; visitorPhone?: string; plate?: string;
    unitId?: string | null; purpose?: string; visitorType?: string; company?: string;
    notes?: string; deviceInfo?: string; sessionId?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertGateStaff(context.supabase, context.userId);
    if (!data.visitorName?.trim()) throw new Error("Visitor name required");
    const nowIso = new Date().toISOString();
    const { data: row, error } = await context.supabase.from("visitors").insert({
      visitor_name: data.visitorName.trim(),
      visitor_phone: data.visitorPhone ?? null,
      car_plate: data.plate ?? null,
      unit_id: data.unitId ?? null,
      purpose: data.purpose ?? null,
      visitor_type: data.visitorType ?? "guest",
      company: data.company ?? null,
      expected_at: nowIso,
      status: "checked_in",
      approved_by: context.userId,
      approved_at: nowIso,
      checked_in_at: nowIso,
      checked_in_by: context.userId,
      requested_by: context.userId,
      gate_notes: data.notes ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await log(context.supabase, context.userId, "walk_in", {
      visitor_id: row.id, unit_id: data.unitId ?? null,
      device_info: data.deviceInfo, session_id: data.sessionId,
    });
    return { id: row.id };
  });

export const blockVisitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { visitorId: string; blocked: boolean; deviceInfo?: string; sessionId?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertGateStaff(context.supabase, context.userId);
    const { error } = await context.supabase.from("visitors").update({ blocked: data.blocked }).eq("id", data.visitorId);
    if (error) throw new Error(error.message);
    await log(context.supabase, context.userId, data.blocked ? "block" : "unblock", {
      visitor_id: data.visitorId, device_info: data.deviceInfo, session_id: data.sessionId,
    });
    return { ok: true };
  });

export const reportIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    title: string; description?: string; severity?: string;
    unitId?: string | null; photoUrls?: string[]; deviceInfo?: string; sessionId?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertGateStaff(context.supabase, context.userId);
    if (!data.title?.trim()) throw new Error("Title required");
    const { data: row, error } = await context.supabase.from("incidents").insert({
      reported_by: context.userId,
      unit_id: data.unitId ?? null,
      title: data.title.trim(),
      description: data.description ?? null,
      severity: data.severity ?? "low",
      photo_urls: data.photoUrls ?? [],
    }).select("id").single();
    if (error) throw new Error(error.message);
    await log(context.supabase, context.userId, "incident", {
      unit_id: data.unitId ?? null,
      metadata: { incident_id: row.id, severity: data.severity ?? "low" },
      device_info: data.deviceInfo, session_id: data.sessionId,
    });
    return { id: row.id };
  });

export const searchGate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data, context }) => {
    await assertGateStaff(context.supabase, context.userId);
    const q = (data.q ?? "").trim();
    if (!q) return { visitors: [], units: [] };
    const like = `%${q}%`;
    const [visRes, unitRes] = await Promise.all([
      context.supabase.from("visitors")
        .select("id, visitor_name, visitor_phone, car_plate, status, expected_at, blocked, unit_id, units(unit_number, building)")
        .or(`visitor_name.ilike.${like},visitor_phone.ilike.${like},car_plate.ilike.${like}`)
        .order("expected_at", { ascending: false }).limit(20),
      context.supabase.from("units")
        .select("id, unit_number, building")
        .ilike("unit_number", like).limit(10),
    ]);
    return { visitors: visRes.data ?? [], units: unitRes.data ?? [] };
  });
