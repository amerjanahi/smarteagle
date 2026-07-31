import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const listPendingSignups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, email, full_name, approval_status, created_at, requested_role")
      .eq("approval_status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const pendingSignupCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return 0;
    const [{ count: signupCount }, { count: villaCount }, { count: profileCount }] = await Promise.all([
      context.supabase.from("profiles").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
      context.supabase.from("resident_villa_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      context.supabase.from("profile_change_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    return (signupCount ?? 0) + (villaCount ?? 0) + (profileCount ?? 0);
  });

export const listAllSignups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, email, full_name, phone, approval_status, created_at, reviewed_at, requested_role")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (profiles ?? []).map((p: any) => p.id);
    if (ids.length === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: roles }, { data: villas }, { data: villaRequests }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("user_villas").select("user_id, villa_id, status").in("user_id", ids),
      supabaseAdmin
        .from("resident_villa_requests")
        .select("id, user_id, villa_id, relationship_type, status, submitted_at, units:villa_id(unit_number, building)")
        .in("user_id", ids)
        .order("submitted_at", { ascending: false }),
    ]);
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role); roleMap.set(r.user_id, arr);
    });
    const villaMap = new Map<string, number>();
    (villas ?? []).filter((v: any) => v.status === "active").forEach((v: any) => {
      villaMap.set(v.user_id, (villaMap.get(v.user_id) ?? 0) + 1);
    });
    const pendingVillaMap = new Map<string, number>();
    const pendingVillaRequestMap = new Map<string, any>();
    (villaRequests ?? []).filter((request: any) => request.status === "pending").forEach((request: any) => {
      pendingVillaMap.set(request.user_id, (pendingVillaMap.get(request.user_id) ?? 0) + 1);
      if (!pendingVillaRequestMap.has(request.user_id)) {
        pendingVillaRequestMap.set(request.user_id, request);
      }
    });
    return (profiles ?? []).map((p: any) => ({
      ...p,
      roles: roleMap.get(p.id) ?? [],
      villa_count: villaMap.get(p.id) ?? 0,
      pending_villa_count: pendingVillaMap.get(p.id) ?? 0,
      pending_villa_request: pendingVillaRequestMap.get(p.id) ?? null,
    }));
  });

export const approveSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "resident" | "property_manager" | "finance" | "accountant" | "hr" | "operations" | "security" | "viewer"; unitId?: string | null; fullName?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Approval is the single authority for an applicant's initial role. Clear
    // any legacy or accidental role first so a pending user can never retain
    // elevated access alongside the role selected by the administrator.
    const { error: clearRolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (clearRolesError) throw new Error(clearRolesError.message);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (roleError) throw new Error(roleError.message);

    if (data.role === "resident" && data.unitId) {
      const { data: existing } = await supabaseAdmin
        .from("residents").select("id").eq("user_id", data.userId).maybeSingle();
      if (!existing) {
        await supabaseAdmin.from("residents").insert({
          user_id: data.userId,
          unit_id: data.unitId,
          full_name: data.fullName ?? "Resident",
          resident_type: "tenant",
          is_active: true,
        });
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        approval_status: "approved",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; notes?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (roleError) throw new Error(roleError.message);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        approval_status: "rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_notes: data.notes ?? null,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: "admin" | "resident"; unitId?: string | null; fullName?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("invitations")
      .insert({
        email: data.email.toLowerCase().trim(),
        role: data.role,
        unit_id: data.unitId ?? null,
        full_name: data.fullName ?? null,
        invited_by: context.userId,
      })
      .select("id, token, email")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("invitations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("invitations").update({ status: "revoked" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type AppRole = "admin" | "property_manager" | "finance" | "accountant" | "hr" | "operations" | "security" | "viewer" | "resident";

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    roles: AppRole[];
    villaId?: string | null;
    relationshipType?: "owner" | "tenant" | "family_member" | "authorized_rep";
  }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase().trim(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");
    const uid = created.user.id;

    await supabaseAdmin.from("profiles").update({
      full_name: data.fullName,
      phone: data.phone ?? null,
      approval_status: "approved",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", uid);

    if (data.roles.length) {
      await supabaseAdmin.from("user_roles").insert(
        data.roles.map((r) => ({ user_id: uid, role: r }))
      ).then(() => {}, () => {});
    }

    if (data.villaId) {
      await supabaseAdmin.from("user_villas").upsert({
        user_id: uid,
        villa_id: data.villaId,
        relationship_type: data.relationshipType ?? "tenant",
        status: "active",
        approved_by: context.userId,
      }, { onConflict: "user_id,villa_id" });
    }
    return { ok: true, userId: uid };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    userId: string;
    fullName?: string;
    phone?: string | null;
    email?: string;
    password?: string;
    roles?: AppRole[];
    approvalStatus?: "approved" | "pending" | "rejected";
  }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.email || data.password) {
      const attrs: any = {};
      if (data.email) attrs.email = data.email.toLowerCase().trim();
      if (data.password) attrs.password = data.password;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, attrs);
      if (error) throw new Error(error.message);
    }

    const patch: any = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.email) patch.email = data.email.toLowerCase().trim();
    if (data.approvalStatus) {
      patch.approval_status = data.approvalStatus;
      patch.reviewed_by = context.userId;
      patch.reviewed_at = new Date().toISOString();
    }
    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    if (data.roles) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      if (data.roles.length) {
        await supabaseAdmin.from("user_roles").insert(
          data.roles.map((r) => ({ user_id: data.userId, role: r }))
        );
      }
    }
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Explicitly clean up all villa links so units free up immediately.
    // (auth.users cascades cover user_villas/requests, but residents.user_id is
    // ON DELETE SET NULL — leaving orphan resident rows that keep units occupied.)
    await supabaseAdmin.from("user_villas").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("resident_villa_requests").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("residents").delete().eq("user_id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListUserVillas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_villas")
      .select("id, villa_id, relationship_type, status, units:villa_id(unit_number, building)")
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminLinkVilla = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    userId: string;
    villaId: string;
    relationshipType: "owner" | "tenant" | "family_member" | "authorized_rep";
  }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_villas").upsert({
      user_id: data.userId,
      villa_id: data.villaId,
      relationship_type: data.relationshipType,
      status: "active",
      approved_by: context.userId,
    }, { onConflict: "user_id,villa_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUnlinkVilla = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { linkId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_villas").delete().eq("id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("units").select("id, unit_number, building").order("unit_number");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
