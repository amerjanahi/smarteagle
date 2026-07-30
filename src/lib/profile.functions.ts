import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const clean = (value?: string | null) => value?.trim() || null;

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("profiles")
      .select("id, email, full_name, phone")
      .eq("id", context.userId).single();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateMyPersonalDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fullName: string; phone?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const fullName = clean(data.fullName);
    if (!fullName) throw new Error("Your name is required.");
    const phone = clean(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("profiles")
      .update({ full_name: fullName, phone }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    // Active resident records are operational data, so they reflect current contact details.
    await supabaseAdmin.from("residents")
      .update({ full_name: fullName, phone, updated_at: now })
      .eq("user_id", context.userId).eq("is_active", true);
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      user_metadata: { full_name: fullName },
    });
    if (authError) throw new Error(authError.message);
    return { ok: true };
  });

export const requestMyEmailChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { newEmail: string; currentPassword: string; fullName?: string | null; phone?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const newEmail = data.newEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) throw new Error("Enter a valid email address.");
    if (!data.currentPassword) throw new Error("Confirm your current password to request an email change.");
    const { data: profile, error: profileError } = await context.supabase.from("profiles")
      .select("email, full_name, phone").eq("id", context.userId).single();
    if (profileError || !profile?.email) throw new Error(profileError?.message ?? "Current email was not found.");
    if (profile.email.toLowerCase() === newEmail) throw new Error("That is already your current email address.");

    // This verifies the current password on the server before a request is stored.
    const { data: verified, error: passwordError } = await context.supabase.auth.signInWithPassword({
      email: profile.email, password: data.currentPassword,
    });
    if (passwordError || verified.user?.id !== context.userId) throw new Error("Your current password could not be confirmed.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profile_change_requests").update({ status: "cancelled" })
      .eq("user_id", context.userId).eq("status", "pending");
    const { error } = await supabaseAdmin.from("profile_change_requests").insert({
      user_id: context.userId,
      current_email: profile.email,
      requested_email: newEmail,
      requested_full_name: clean(data.fullName) ?? profile.full_name,
      requested_phone: clean(data.phone) ?? profile.phone,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyEmailChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("profile_change_requests")
      .select("id, current_email, requested_email, status, requested_at, reviewed_at, review_notes")
      .eq("user_id", context.userId).order("requested_at", { ascending: false }).limit(10);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listProfileChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("profile_change_requests")
      .select("id, user_id, current_email, requested_email, requested_full_name, requested_phone, status, requested_at, profiles:user_id(full_name)")
      .order("requested_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const reviewProfileChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { requestId: string; approve: boolean; notes?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: request, error } = await supabaseAdmin.from("profile_change_requests")
      .select("*").eq("id", data.requestId).single();
    if (error || !request) throw new Error(error?.message ?? "Request not found.");
    if (request.status !== "pending") throw new Error("This request has already been reviewed.");
    const now = new Date().toISOString();
    if (data.approve) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(request.user_id, {
        email: request.requested_email,
        user_metadata: { full_name: request.requested_full_name ?? undefined },
      });
      if (authError) throw new Error(authError.message);
      const { error: profileError } = await supabaseAdmin.from("profiles").update({
        email: request.requested_email, full_name: request.requested_full_name, phone: request.requested_phone,
      }).eq("id", request.user_id);
      if (profileError) throw new Error(profileError.message);
      await supabaseAdmin.from("residents").update({
        full_name: request.requested_full_name ?? undefined,
        email: request.requested_email,
        phone: request.requested_phone ?? undefined,
        updated_at: now,
      }).eq("user_id", request.user_id).eq("is_active", true);
    }
    const { error: reviewError } = await supabaseAdmin.from("profile_change_requests").update({
      status: data.approve ? "approved" : "rejected", reviewed_by: context.userId, reviewed_at: now, review_notes: clean(data.notes),
    }).eq("id", request.id);
    if (reviewError) throw new Error(reviewError.message);
    return { ok: true };
  });
