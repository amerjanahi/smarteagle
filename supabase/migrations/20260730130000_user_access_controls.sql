-- Step 2: controlled, community-wide user exceptions. Building/villa scopes are
-- reserved for a future release; no existing user data or role is changed.

CREATE TYPE public.access_scope_type AS ENUM ('community', 'building', 'villa');
CREATE TYPE public.access_override_effect AS ENUM ('grant', 'deny');

CREATE TABLE public.user_access_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL,
  action text NOT NULL CHECK (action IN ('view','create','edit','delete','approve','apply_txn','export')),
  effect public.access_override_effect NOT NULL,
  scope_type public.access_scope_type NOT NULL DEFAULT 'community',
  scope_reference text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  CHECK (expires_at IS NULL OR expires_at > starts_at)
);
CREATE INDEX user_access_overrides_active_idx ON public.user_access_overrides(user_id, module, action)
  WHERE revoked_at IS NULL;
ALTER TABLE public.user_access_overrides ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.user_access_overrides TO service_role;
CREATE POLICY "access_overrides_top_admin" ON public.user_access_overrides FOR ALL TO authenticated
  USING (public.is_top_admin(auth.uid())) WITH CHECK (public.is_top_admin(auth.uid()));

CREATE TABLE public.user_approval_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL,
  limit_amount numeric(18,3) NOT NULL CHECK (limit_amount >= 0),
  currency_code text NOT NULL DEFAULT 'BHD',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  reason text NOT NULL,
  set_by uuid NOT NULL REFERENCES auth.users(id),
  revoked_at timestamptz,
  UNIQUE(user_id, module)
);
ALTER TABLE public.user_approval_limits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.user_approval_limits TO service_role;
CREATE POLICY "approval_limits_top_admin" ON public.user_approval_limits FOR ALL TO authenticated
  USING (public.is_top_admin(auth.uid())) WITH CHECK (public.is_top_admin(auth.uid()));

CREATE TABLE public.access_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delegate_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL,
  approved_by uuid NOT NULL REFERENCES auth.users(id),
  revoked_at timestamptz,
  CHECK (delegate_id <> delegator_id AND ends_at > starts_at)
);
ALTER TABLE public.access_delegations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.access_delegations TO service_role;
CREATE POLICY "delegations_top_admin" ON public.access_delegations FOR ALL TO authenticated
  USING (public.is_top_admin(auth.uid())) WITH CHECK (public.is_top_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.has_effective_permission(_user_id uuid, _module text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_access_overrides o
      WHERE o.user_id = _user_id AND o.module = _module AND o.action = _action
        AND o.effect = 'deny' AND o.revoked_at IS NULL AND o.starts_at <= now()
        AND (o.expires_at IS NULL OR o.expires_at > now())) THEN false
    WHEN public.has_permission(_user_id, _module, _action) THEN true
    WHEN EXISTS (SELECT 1 FROM public.user_access_overrides o
      WHERE o.user_id = _user_id AND o.module = _module AND o.action = _action
        AND o.effect = 'grant' AND o.revoked_at IS NULL AND o.starts_at <= now()
        AND (o.expires_at IS NULL OR o.expires_at > now())) THEN true
    ELSE false END;
$$;
REVOKE EXECUTE ON FUNCTION public.has_effective_permission(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_effective_permission(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.audit_user_access_control()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.security_audit_log(actor_id, action, target_type, target_id, before_state, after_state)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id)::text,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_audit_user_access_overrides AFTER INSERT OR UPDATE OR DELETE ON public.user_access_overrides
FOR EACH ROW EXECUTE FUNCTION public.audit_user_access_control();
CREATE TRIGGER trg_audit_user_approval_limits AFTER INSERT OR UPDATE OR DELETE ON public.user_approval_limits
FOR EACH ROW EXECUTE FUNCTION public.audit_user_access_control();
CREATE TRIGGER trg_audit_access_delegations AFTER INSERT OR UPDATE OR DELETE ON public.access_delegations
FOR EACH ROW EXECUTE FUNCTION public.audit_user_access_control();
