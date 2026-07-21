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
  name: "list_units",
  title: "List units",
  description: "List villas/units the signed-in user can see (scoped by RLS).",
  inputSchema: {
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 50)."),
    search: z.string().optional().describe("Optional substring match on unit_number."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = db(ctx).from("units").select("id, unit_number, unit_type, bedrooms, is_occupied, gfa_sqm").limit(limit ?? 50);
    if (search) q = q.ilike("unit_number", `%${search}%`);
    const { data, error } = await q;
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { units: data } };
  },
});
