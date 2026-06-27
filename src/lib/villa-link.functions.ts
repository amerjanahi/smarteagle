import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const listVillasForLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: units, error } = await context.supabase
      .from("units")
      .select("id, unit_number, building, floor, is_occupied")
      .order("unit_number");
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [linksRes, reqsRes] = await Promise.all([
      supabaseAdmin.from("user_villas").select("villa_id").eq("status", "active"),
      supabaseAdmin.from("resident_villa_requests").select("villa_id").eq("status", "pending"),
    ]);
    const linked = new Set((linksRes.data ?? []).map((r: any) => r.villa_id));
    const pending = new Set((reqsRes.data ?? []).map((r: any) => r.villa_id));
    return (units ?? []).map((u: any) => ({
      ...u,
      link_status: linked.has(u.id) ? "linked" : pending.has(u.id) ? "pending" : "available",
    }));
  });

export const myVillaRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("resident_villa_requests")
      .select("*, units:villa_id(unit_number, building)")
      .eq("user_id", context.userId)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const myVillas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_villas")
      .select("*, units:villa_id(unit_number, building)")
      .eq("user_id", context.userId)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const submitVillaRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { villaId: string; relationshipType: "owner" | "tenant" | "family_member" | "authorized_rep"; notes?: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: existing } = await context.supabase
      .from("resident_villa_requests").select("id")
      .eq("user_id", context.userId).eq("villa_id", data.villaId).eq("status", "pending").maybeSingle();
    if (existing) throw new Error("You already have a pending request for this villa.");
    const { error } = await context.supabase.from("resident_villa_requests").insert({
      user_id: context.userId,
      villa_id: data.villaId,
      relationship_type: data.relationshipType,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllVillaRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: "pending" | "approved" | "rejected" | "all" } = {}) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("resident_villa_requests")
      .select("*, units:villa_id(unit_number, building)")
      .order("submitted_at", { ascending: false });
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let profilesById: Record<string, any> = {};
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id, full_name, email, phone").in("id", userIds);
      profilesById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }
    return (rows ?? []).map((r: any) => ({ ...r, profiles: profilesById[r.user_id] ?? null }));
  });

export const approveVillaRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { requestId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req, error: rerr } = await supabaseAdmin
      .from("resident_villa_requests").select("*").eq("id", data.requestId).single();
    if (rerr || !req) throw new Error(rerr?.message ?? "Request not found");
    if (req.status !== "pending") throw new Error("Request already reviewed");

    // Insert user_villas link
    await supabaseAdmin.from("user_villas").upsert({
      user_id: req.user_id,
      villa_id: req.villa_id,
      relationship_type: req.relationship_type,
      status: "active",
      approved_by: context.userId,
    }, { onConflict: "user_id,villa_id" });

    // Ensure resident role
    await supabaseAdmin.from("user_roles").insert({ user_id: req.user_id, role: "resident" })
      .then(() => {}, () => {});

    // Approve profile if pending
    await supabaseAdmin.from("profiles").update({
      approval_status: "approved",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", req.user_id);

    // Mark request approved
    const { error } = await supabaseAdmin.from("resident_villa_requests").update({
      status: "approved",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", data.requestId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectVillaRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { requestId: string; reason: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("resident_villa_requests").update({
      status: "rejected",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: data.reason,
    }).eq("id", data.requestId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
