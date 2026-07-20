
-- Extend visitors
ALTER TABLE public.visitors
  ADD COLUMN IF NOT EXISTS visitor_type text NOT NULL DEFAULT 'guest',
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_by uuid,
  ADD COLUMN IF NOT EXISTS checked_out_by uuid,
  ADD COLUMN IF NOT EXISTS gate_notes text;

-- Security role read/update on visitors
DROP POLICY IF EXISTS "Security can read visitors" ON public.visitors;
CREATE POLICY "Security can read visitors" ON public.visitors FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'security') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Security can update visitor gate fields" ON public.visitors;
CREATE POLICY "Security can update visitor gate fields" ON public.visitors FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'security') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'security') OR public.has_role(auth.uid(), 'admin'));

-- Security read on units / residents / profiles (minimal, needed for lookup)
DROP POLICY IF EXISTS "Security can read units" ON public.units;
CREATE POLICY "Security can read units" ON public.units FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'security') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Security can read residents" ON public.residents;
CREATE POLICY "Security can read residents" ON public.residents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'security') OR public.has_role(auth.uid(), 'admin'));

-- Incidents
CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by uuid,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'low',
  photo_urls text[] NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Security and admins read incidents" ON public.incidents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'security') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Security and admins insert incidents" ON public.incidents FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(), 'security') OR public.has_role(auth.uid(), 'admin')) AND reported_by = auth.uid());
CREATE POLICY "Admins update incidents" ON public.incidents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER incidents_updated_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Emergency contacts
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role_label text,
  phone text NOT NULL,
  priority int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.emergency_contacts TO authenticated;
GRANT ALL ON public.emergency_contacts TO service_role;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read emergency contacts" ON public.emergency_contacts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'security') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage emergency contacts" ON public.emergency_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.emergency_contacts TO authenticated;
CREATE TRIGGER emergency_contacts_updated_at BEFORE UPDATE ON public.emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Gate activity log
CREATE TABLE IF NOT EXISTS public.gate_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid,
  action text NOT NULL,
  visitor_id uuid,
  unit_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  device_info text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.gate_activity_log TO authenticated;
GRANT ALL ON public.gate_activity_log TO service_role;
ALTER TABLE public.gate_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff insert own gate activity" ON public.gate_activity_log FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(), 'security') OR public.has_role(auth.uid(), 'admin')) AND staff_id = auth.uid());
CREATE POLICY "Admins read gate activity" ON public.gate_activity_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Security read own gate activity" ON public.gate_activity_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'security') AND staff_id = auth.uid());
