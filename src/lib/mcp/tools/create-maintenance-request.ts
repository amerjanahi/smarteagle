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
  name: "create_maintenance_request",
  title: "Create maintenance request",
  description: "Create a maintenance request for the signed-in user (subject to RLS).",
  inputSchema: {
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    category: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    unit_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await db(ctx)
      .from("maintenance_requests")
      .insert({
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority ?? "medium",
        unit_id: input.unit_id,
        requested_by: ctx.getUserId(),
        status: "open",
      })
      .select()
      .single();
    return error
      ? { content: [{ type: "text", text: error.message }], isError: true }
      : { content: [{ type: "text", text: `Created request ${data.id}` }], structuredContent: { request: data } };
  },
});
