-- Secure two-stage onboarding
-- 1. Email verification creates a pending profile with no application role.
-- 2. An admin approves the account and chooses Resident or Staff.
-- 3. Approved residents may only submit a villa relationship request.
-- 4. An admin approves that request before an active user_villas link exists.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    approval_status,
    requested_role,
    reviewed_at,
    reviewed_by,
    review_notes
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
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        approval_status = 'pending',
        requested_role = EXCLUDED.requested_role,
        reviewed_at = NULL,
        reviewed_by = NULL,
        review_notes = NULL;

  -- Authentication never creates a role or an active villa link.
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- A user may update ordinary personal details, but cannot approve themselves,
-- select their own application role, forge reviewer fields, or change email
-- outside the verified profile-change workflow.
CREATE OR REPLACE FUNCTION public.enforce_profile_self_update_boundaries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() = OLD.id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND (
       NEW.email IS DISTINCT FROM OLD.email
       OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.requested_role IS DISTINCT FROM OLD.requested_role
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
     )
  THEN
    RAISE EXCEPTION 'Approval, role, reviewer, and email fields require administrator review';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_profile_self_update_boundaries ON public.profiles;
CREATE TRIGGER enforce_profile_self_update_boundaries
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_self_update_boundaries();

REVOKE EXECUTE ON FUNCTION public.enforce_profile_self_update_boundaries()
  FROM PUBLIC, anon, authenticated;

-- Defence in depth for profile-change requests: their owner may never change
-- review state, reviewer, or review notes. Admin/service operations still work.
CREATE OR REPLACE FUNCTION public.enforce_profile_request_review_boundaries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() = OLD.user_id
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
     )
  THEN
    RAISE EXCEPTION 'Only an administrator may review a profile change request';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_profile_request_review_boundaries
  ON public.profile_change_requests;
CREATE TRIGGER enforce_profile_request_review_boundaries
BEFORE UPDATE ON public.profile_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_request_review_boundaries();

REVOKE EXECUTE ON FUNCTION public.enforce_profile_request_review_boundaries()
  FROM PUBLIC, anon, authenticated;

-- Applicants can submit and read their own villa request. Only the top admin
-- role can review it or create the final active link. Existing policies remain
-- in place; these grants prevent direct client-side privilege escalation.
REVOKE UPDATE, DELETE ON public.resident_villa_requests FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_villas FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;

GRANT SELECT, INSERT ON public.resident_villa_requests TO authenticated;
GRANT SELECT ON public.user_villas TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

