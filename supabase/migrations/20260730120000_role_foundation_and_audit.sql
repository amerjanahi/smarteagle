-- Step 1: role foundation.  The existing `admin` role is the protected Top Admin.
-- `property_manager` is intentionally separate and never inherits Top Admin access.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'property_manager';

CREATE OR REPLACE FUNCTION public.is_top_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'admin'::public.app_role) $$;

REVOKE EXECUTE ON FUNCTION public.is_top_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_top_admin(uuid) TO authenticated, service_role;

-- One central permission decision for new or migrated protected actions.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_top_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role = ur.role
      WHERE ur.user_id = _user_id
        AND rp.module = _module
        AND CASE _action
          WHEN 'view' THEN rp.can_view
          WHEN 'create' THEN rp.can_create
          WHEN 'edit' THEN rp.can_edit
          WHEN 'delete' THEN rp.can_delete
          WHEN 'approve' THEN rp.can_approve
          WHEN 'apply_txn' THEN rp.can_apply_txn
          WHEN 'export' THEN rp.can_export
          ELSE false
        END
    );
$$;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated, service_role;

-- Fill matrix rows for every active staff role. Existing Top Admin bypasses the matrix.
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve, can_apply_txn, can_export)
SELECT r::public.app_role, m,
  CASE WHEN r IN ('property_manager','finance','accountant','hr','operations','security','viewer','resident') THEN true ELSE false END,
  CASE
    WHEN r = 'property_manager' AND m IN ('property','operations','communication') THEN true
    WHEN r IN ('finance','accountant') AND m IN ('sales','purchases','bank') THEN true
    WHEN r = 'hr' AND m = 'operations' THEN true
    WHEN r = 'operations' AND m IN ('property','operations','communication') THEN true
    WHEN r = 'security' AND m = 'operations' THEN true
    ELSE false END,
  CASE
    WHEN r = 'property_manager' AND m IN ('property','operations','communication') THEN true
    WHEN r IN ('finance','accountant') AND m IN ('sales','purchases','bank') THEN true
    WHEN r = 'hr' AND m = 'operations' THEN true
    WHEN r = 'operations' AND m IN ('property','operations','communication') THEN true
    WHEN r = 'security' AND m = 'operations' THEN true
    ELSE false END,
  false,
  CASE WHEN r IN ('property_manager','finance') AND m IN ('property','sales','purchases','bank','operations') THEN true ELSE false END,
  CASE WHEN r = 'finance' AND m IN ('sales','purchases','bank') THEN true ELSE false END,
  CASE WHEN r IN ('property_manager','finance','accountant','hr','operations','viewer') THEN true ELSE false END
FROM unnest(ARRAY['property_manager','finance','accountant','hr','operations','security','viewer','resident']) r,
     unnest(ARRAY['property','sales','purchases','bank','operations','communication','settings']) m
ON CONFLICT (role, module) DO NOTHING;

-- Only Top Admin can read or change the role matrix.
DROP POLICY IF EXISTS "role_perm admin read" ON public.role_permissions;
DROP POLICY IF EXISTS "role_perm admin write" ON public.role_permissions;
CREATE POLICY "role_perm top_admin read" ON public.role_permissions FOR SELECT TO authenticated
  USING (public.is_top_admin(auth.uid()));
CREATE POLICY "role_perm top_admin write" ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_top_admin(auth.uid())) WITH CHECK (public.is_top_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.security_audit_log TO service_role;
CREATE POLICY "security_audit_top_admin_read" ON public.security_audit_log FOR SELECT TO authenticated
  USING (public.is_top_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.audit_role_permission_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.security_audit_log (actor_id, action, target_type, target_id, before_state, after_state)
  VALUES (auth.uid(), TG_OP, 'role_permission', COALESCE(NEW.id, OLD.id)::text,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_role_permission_change ON public.role_permissions;
CREATE TRIGGER trg_audit_role_permission_change
AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.audit_role_permission_change();
