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
  name: "list_residents",
  title: "List residents",
  description: "List residents visible to the signed-in user (scoped by RLS).",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional(),
    unit_id: z.string().uuid().optional().describe("Filter to a specific unit."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, unit_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = db(ctx)
      .from("residents")
      .select("id, full_name, email, phone, unit_id, is_active, resident_type")
      .limit(limit ?? 50);
    if (unit_id) q = q.eq("unit_id", unit_id);
    const { data, error } = await q;
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { residents: data } };
  },
});
