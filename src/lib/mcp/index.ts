import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listUnits from "./tools/list-units";
import listResidents from "./tools/list-residents";
import listInvoices from "./tools/list-invoices";
import listMaintenance from "./tools/list-maintenance-requests";
import createMaintenance from "./tools/create-maintenance-request";
import listAnnouncements from "./tools/list-announcements";

// Use the direct Supabase host as the OAuth issuer (see app-mcp-server-authoring).
// VITE_SUPABASE_PROJECT_ID is inlined at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "hayy-mcp",
  title: "Hayy Community MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Hayy community management app. Read units, residents, invoices, announcements, and maintenance requests, and create new maintenance requests. All calls act as the signed-in user and are scoped by row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listUnits, listResidents, listInvoices, listMaintenance, createMaintenance, listAnnouncements],
});
