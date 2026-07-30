-- Production hardening for the dedicated-client release.
-- Top Admin remains an explicit bypass. Lower roles receive only intentional access.

UPDATE public.role_permissions
SET can_view = false,
    can_create = false,
    can_edit = false,
    can_delete = false,
    can_approve = false,
    can_apply_txn = false,
    can_export = false
WHERE role <> 'admin'::public.app_role;

UPDATE public.role_permissions
SET can_view = true,
    can_create = true,
    can_edit = true,
    can_approve = module IN ('property', 'operations'),
    can_export = true
WHERE role = 'property_manager'::public.app_role
  AND module IN ('property', 'operations', 'communication');

UPDATE public.role_permissions
SET can_view = true,
    can_create = true,
    can_edit = true,
    can_approve = true,
    can_apply_txn = true,
    can_export = true
WHERE role = 'finance'::public.app_role
  AND module IN ('sales', 'purchases', 'bank');

UPDATE public.role_permissions
SET can_view = true,
    can_create = true,
    can_edit = true,
    can_export = true
WHERE role = 'accountant'::public.app_role
  AND module IN ('sales', 'purchases', 'bank');

UPDATE public.role_permissions
SET can_view = true,
    can_create = true,
    can_edit = true,
    can_export = true
WHERE role = 'hr'::public.app_role
  AND module = 'operations';

UPDATE public.role_permissions
SET can_view = true,
    can_create = true,
    can_edit = true,
    can_export = true
WHERE role = 'operations'::public.app_role
  AND module IN ('property', 'operations', 'communication');

UPDATE public.role_permissions
SET can_view = true,
    can_create = true,
    can_edit = true
WHERE role = 'security'::public.app_role
  AND module = 'operations';

-- A Top Admin can never be denied by a per-user override. Building/villa
-- overrides are reserved and intentionally inactive until scoped RLS exists.
CREATE OR REPLACE FUNCTION public.has_effective_permission(
  _user_id uuid,
  _module text,
  _action text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_top_admin(_user_id) THEN true
    WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _user_id AND p.approval_status = 'approved'
    ) THEN false
    WHEN EXISTS (
      SELECT 1
      FROM public.user_access_overrides o
      WHERE o.user_id = _user_id
        AND o.module = _module
        AND o.action = _action
        AND o.effect = 'deny'
        AND o.scope_type = 'community'
        AND o.revoked_at IS NULL
        AND o.starts_at <= now()
        AND (o.expires_at IS NULL OR o.expires_at > now())
    ) THEN false
    WHEN public.has_permission(_user_id, _module, _action) THEN true
    WHEN EXISTS (
      SELECT 1
      FROM public.user_access_overrides o
      WHERE o.user_id = _user_id
        AND o.module = _module
        AND o.action = _action
        AND o.effect = 'grant'
        AND o.scope_type = 'community'
        AND o.revoked_at IS NULL
        AND o.starts_at <= now()
        AND (o.expires_at IS NULL OR o.expires_at > now())
    ) THEN true
    ELSE false
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_effective_permission(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_effective_permission(uuid, text, text)
  TO authenticated, service_role;
