import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "documents";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    q?: string;
    folder?: string | null;
    category?: string | null;
    archived?: boolean;
    unit_id?: string | null;
    resident_id?: string | null;
    vendor_id?: string | null;
    from?: string | null;
    to?: string | null;
  }) => d)
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("documents")
      .select("*, units(unit_number, building), vendors(name), invoices(invoice_number), purchase_invoices(bill_number)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (typeof data.archived === "boolean") q = q.eq("archived", data.archived);
    if (data.folder) q = q.eq("folder", data.folder);
    if (data.category) q = q.eq("category", data.category);
    if (data.unit_id) q = q.eq("unit_id", data.unit_id);
    if (data.resident_id) q = q.eq("resident_id", data.resident_id);
    if (data.vendor_id) q = q.eq("vendor_id", data.vendor_id);
    if (data.from) q = q.gte("document_date", data.from);
    if (data.to) q = q.lte("document_date", data.to);
    if (data.q) q = q.or(`title.ilike.%${data.q}%,description.ilike.%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("documents").select("folder, category").limit(2000);
    const folders = Array.from(new Set((data ?? []).map((r: any) => r.folder).filter(Boolean))).sort();
    const categories = Array.from(new Set((data ?? []).map((r: any) => r.category).filter(Boolean))).sort();
    return { folders, categories };
  });

export const saveDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    title: string;
    description?: string | null;
    file_url?: string | null;
    folder?: string | null;
    category?: string | null;
    tags?: string[];
    document_date?: string | null;
    access_level?: "admin" | "staff" | "resident";
    archived?: boolean;
    unit_id?: string | null;
    resident_id?: string | null;
    vendor_id?: string | null;
    invoice_id?: string | null;
    purchase_invoice_id?: string | null;
  }) => d)
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Admin only");
    const payload: any = { ...data };
    delete payload.id;
    payload.tags = data.tags ?? [];
    if (!data.id) payload.uploaded_by = context.userId;
    const { data: row, error } = data.id
      ? await context.supabase.from("documents").update(payload).eq("id", data.id).select("id").single()
      : await context.supabase.from("documents").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Admin only");
    const { data: doc } = await context.supabase.from("documents").select("file_url").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    // best-effort remove file
    if (doc?.file_url) {
      const path = extractPath(doc.file_url);
      if (path) await context.supabase.storage.from(BUCKET).remove([path]);
    }
    return { ok: true };
  });

export const setArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; archived: boolean }) => d)
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Admin only");
    const { error } = await context.supabase.from("documents").update({ archived: data.archived }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: signed, error } = await context.supabase.storage.from(BUCKET).createSignedUrl(data.path, 60 * 30);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

function extractPath(url: string): string | null {
  const m = url.match(/\/documents\/(.+)$/);
  return m ? m[1] : null;
}
