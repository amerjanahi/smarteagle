import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * One-shot bootstrap: if no admin exists yet, promote the calling user to admin.
 * Safe to call repeatedly — becomes a no-op once an admin is present.
 */
export const bootstrapAdminIfEmpty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) return { promoted: false };

    const { error: insertErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (insertErr) throw new Error(insertErr.message);
    return { promoted: true };
  });

/**
 * Link the calling user to a unit as a resident. Used when a resident signs up
 * via the demo flow and needs to be attached to one of the seeded units.
 */
export const linkSelfToUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { unitId: string; fullName: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("residents")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) return { ok: true, residentId: existing.id };

    const { data: inserted, error } = await supabaseAdmin
      .from("residents")
      .insert({
        user_id: context.userId,
        unit_id: data.unitId,
        full_name: data.fullName,
        resident_type: "tenant",
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, residentId: inserted.id };
  });
