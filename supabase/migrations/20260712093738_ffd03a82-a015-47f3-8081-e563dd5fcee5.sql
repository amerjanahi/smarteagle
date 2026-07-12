
-- Merge signup + villa-link approvals into a single step.
-- New signups are auto-approved at the profile level; the villa-link request
-- is now the sole gate for portal access.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _admin_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, approval_status, reviewed_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'approved',
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  SELECT COUNT(*) INTO _admin_count FROM public.user_roles WHERE role = 'admin';
  IF _admin_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Auto-approve any legacy pending profiles so admins see only the villa queue.
UPDATE public.profiles SET approval_status = 'approved', reviewed_at = COALESCE(reviewed_at, now())
WHERE approval_status = 'pending';
