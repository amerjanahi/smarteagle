import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function db(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_maintenance_requests",
  title: "List maintenance requests",
  description: "List maintenance requests visible to the signed-in user (scoped by RLS).",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional(),
    status: z.string().optional().describe("Optional status filter (e.g. open, in_progress, resolved)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = db(ctx)
      .from("maintenance_requests")
      .select("id, title, description, category, priority, status, unit_id, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { requests: data } };
  },
});
