-- Extend profiles with phone
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Extend app_role enum with new roles (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='super_admin') THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='finance') THEN
    ALTER TYPE public.app_role ADD VALUE 'finance';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='operations') THEN
    ALTER TYPE public.app_role ADD VALUE 'operations';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='security') THEN
    ALTER TYPE public.app_role ADD VALUE 'security';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='owner') THEN
    ALTER TYPE public.app_role ADD VALUE 'owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='tenant') THEN
    ALTER TYPE public.app_role ADD VALUE 'tenant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='family_member') THEN
    ALTER TYPE public.app_role ADD VALUE 'family_member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='authorized_rep') THEN
    ALTER TYPE public.app_role ADD VALUE 'authorized_rep';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='read_only') THEN
    ALTER TYPE public.app_role ADD VALUE 'read_only';
  END IF;
END$$;

-- Relationship type enum
DO $$ BEGIN
  CREATE TYPE public.villa_relationship AS ENUM ('owner','tenant','family_member','authorized_rep');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.villa_request_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- resident_villa_requests
CREATE TABLE IF NOT EXISTS public.resident_villa_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  villa_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  relationship_type public.villa_relationship NOT NULL,
  status public.villa_request_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_request_per_user_villa
  ON public.resident_villa_requests(user_id, villa_id)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resident_villa_requests TO authenticated;
GRANT ALL ON public.resident_villa_requests TO service_role;
ALTER TABLE public.resident_villa_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own requests" ON public.resident_villa_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "users create own requests" ON public.resident_villa_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins manage requests" ON public.resident_villa_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete requests" ON public.resident_villa_requests
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_rvr_updated BEFORE UPDATE ON public.resident_villa_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_villas (approved links)
CREATE TABLE IF NOT EXISTS public.user_villas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  villa_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  relationship_type public.villa_relationship NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, villa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_villas TO authenticated;
GRANT ALL ON public.user_villas TO service_role;
ALTER TABLE public.user_villas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own villas" ON public.user_villas
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage user_villas" ON public.user_villas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_uv_updated BEFORE UPDATE ON public.user_villas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function: does user have any approved villa link?
CREATE OR REPLACE FUNCTION public.user_has_villa(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_villas WHERE user_id = _user_id AND status = 'active')
$$;

-- Allow authenticated to read units list for villa picker (needed for signup linking)
DO $$ BEGIN
  CREATE POLICY "authenticated can browse units for linking" ON public.units
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
