
CREATE TABLE IF NOT EXISTS public.amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  capacity INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.amenities TO authenticated;
GRANT ALL ON public.amenities TO service_role;
ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can view amenities" ON public.amenities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage amenities" ON public.amenities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER amenities_updated_at BEFORE UPDATE ON public.amenities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM ('pending','approved','rejected','cancelled','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.amenity_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amenity_id UUID NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.amenity_bookings TO authenticated;
GRANT ALL ON public.amenity_bookings TO service_role;
ALTER TABLE public.amenity_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents see own bookings, admins see all" ON public.amenity_bookings FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Residents create their own bookings" ON public.amenity_bookings FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Residents cancel own pending bookings" ON public.amenity_bookings FOR UPDATE TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete bookings" ON public.amenity_bookings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER amenity_bookings_updated_at BEFORE UPDATE ON public.amenity_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS amenity_bookings_amenity_idx ON public.amenity_bookings(amenity_id, starts_at);
CREATE INDEX IF NOT EXISTS amenity_bookings_user_idx ON public.amenity_bookings(requested_by, starts_at);
