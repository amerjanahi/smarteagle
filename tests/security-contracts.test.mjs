import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("villa discovery validates approved resident onboarding before admin access", async () => {
  const source = await read("src/lib/villa-link.functions.ts");

  assert.match(source, /profile\?\.approval_status !== "approved"/);
  assert.match(source, /!isResident \|\| activeVilla/);
  assert.match(source, /supabaseAdmin[\s\S]*?from\("units"\)/);
  assert.doesNotMatch(source, /export const linkSelfToUnit/);
});

test("security migration removes broad unit browsing", async () => {
  const migration = await read(
    "supabase/migrations/20260731102000_fix_security_review_warnings.sql",
  );

  assert.match(
    migration,
    /DROP POLICY IF EXISTS "authenticated can browse units for linking"/,
  );
  assert.match(
    migration,
    /DROP POLICY IF EXISTS "Unlinked users browse units for linking"/,
  );
  assert.doesNotMatch(migration, /CREATE POLICY "Unlinked users browse units for linking"/);
});

test("staff document access excludes admin-only documents", async () => {
  const migration = await read(
    "supabase/migrations/20260731102000_fix_security_review_warnings.sql",
  );

  assert.match(migration, /access_level = 'staff'/);
  assert.doesNotMatch(migration, /access_level IN \('staff','admin'\)/);
});

test("resident documents use approved villa links", async () => {
  const migration = await read(
    "supabase/migrations/20260731102000_fix_security_review_warnings.sql",
  );

  assert.match(migration, /SELECT uv\.villa_id/);
  assert.match(migration, /uv\.user_id = auth\.uid\(\) AND uv\.status = 'active'/);
});

test("top admin cannot be denied by a user override", async () => {
  const migration = await read(
    "supabase/migrations/20260731100000_harden_role_permissions.sql",
  );

  assert.match(migration, /WHEN public\.is_top_admin\(_user_id\) THEN true/);
});

test("account approval replaces legacy roles and admin routes validate roles before rendering", async () => {
  const approvals = await read("src/lib/approvals.functions.ts");
  const adminRoute = await read("src/routes/_authenticated/admin/route.tsx");

  assert.match(approvals, /from\("user_roles"\)[\s\S]*?delete\(\)[\s\S]*?eq\("user_id", data\.userId\)/);
  assert.match(approvals, /from\("user_roles"\)[\s\S]*?insert\(\{ user_id: data\.userId, role: data\.role \}\)/);
  assert.match(adminRoute, /beforeLoad: async \(\) =>/);
  assert.match(adminRoute, /!roleNames\.includes\("admin"\) && !roleNames\.includes\("property_manager"\)/);
});

test("display format choices are constrained and do not alter stored values", async () => {
  const migration = await read(
    "supabase/migrations/20260806090000_add_display_format_settings.sql",
  );

  assert.match(migration, /ADD COLUMN IF NOT EXISTS date_format/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS time_format/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS number_format/);
  assert.match(migration, /These change presentation only; stored/);
});
