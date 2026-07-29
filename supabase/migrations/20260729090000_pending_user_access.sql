-- New accounts exist immediately for administration and audit purposes, but
-- receive no application role or portal capability until an admin approves them.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, phone, approval_status, requested_role, reviewed_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'pending',
    CASE
      WHEN NEW.raw_user_meta_data->>'requested_role' = 'staff' THEN 'staff'
      ELSE 'resident'
    END,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        requested_role = COALESCE(EXCLUDED.requested_role, public.profiles.requested_role);

  -- Deliberately do not insert into user_roles here. Authentication alone never
  -- grants application access.
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

