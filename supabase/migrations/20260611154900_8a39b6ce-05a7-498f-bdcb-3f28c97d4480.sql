
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'resident');
CREATE TYPE public.resident_type AS ENUM ('owner', 'tenant');
CREATE TYPE public.invoice_status AS ENUM ('unpaid', 'paid', 'partial', 'cancelled', 'overdue');
CREATE TYPE public.payment_method AS ENUM ('card', 'bank_transfer', 'cash', 'cheque', 'mock');
CREATE TYPE public.maintenance_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.maintenance_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE public.visitor_status AS ENUM ('pending', 'approved', 'rejected', 'checked_in', 'checked_out');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- TABLES (no RLS policies yet, just structure + grants + enable RLS)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, full_name TEXT, phone TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_set_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'resident')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building TEXT NOT NULL, unit_number TEXT NOT NULL,
  floor INT, bedrooms INT, area_sqm NUMERIC,
  monthly_service_charge NUMERIC(12,3) NOT NULL DEFAULT 0,
  is_occupied BOOLEAN NOT NULL DEFAULT false, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(building, unit_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER units_set_updated BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL, email TEXT, phone TEXT,
  resident_type public.resident_type NOT NULL DEFAULT 'tenant',
  move_in_date DATE, move_out_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX residents_user_idx ON public.residents(user_id);
CREATE INDEX residents_unit_idx ON public.residents(unit_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.residents TO authenticated;
GRANT ALL ON public.residents TO service_role;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER residents_set_updated BEFORE UPDATE ON public.residents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_unit_occupancy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_unit UUID;
BEGIN
  target_unit := COALESCE(NEW.unit_id, OLD.unit_id);
  UPDATE public.units SET is_occupied = EXISTS(
    SELECT 1 FROM public.residents WHERE unit_id = target_unit AND is_active = true
  ) WHERE id = target_unit;
  RETURN NEW;
END; $$;
CREATE TRIGGER residents_sync_occupancy AFTER INSERT OR UPDATE OR DELETE ON public.residents
  FOR EACH ROW EXECUTE FUNCTION public.sync_unit_occupancy();

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  description TEXT, period_start DATE, period_end DATE,
  due_date DATE NOT NULL,
  amount NUMERIC(12,3) NOT NULL,
  amount_paid NUMERIC(12,3) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX invoices_unit_idx ON public.invoices(unit_id);
CREATE INDEX invoices_status_idx ON public.invoices(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER invoices_set_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,3) NOT NULL,
  payment_method public.payment_method NOT NULL DEFAULT 'mock',
  gateway_provider TEXT NOT NULL DEFAULT 'mock',
  gateway_reference TEXT,
  paid_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(), notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_invoice_idx ON public.payments(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_payment_to_invoice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total NUMERIC; inv_amount NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO total FROM public.payments WHERE invoice_id = NEW.invoice_id;
  SELECT amount INTO inv_amount FROM public.invoices WHERE id = NEW.invoice_id;
  UPDATE public.invoices SET amount_paid = total,
    status = CASE
      WHEN total >= inv_amount THEN 'paid'::public.invoice_status
      WHEN total > 0 THEN 'partial'::public.invoice_status
      ELSE 'unpaid'::public.invoice_status END
  WHERE id = NEW.invoice_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER payments_apply AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.apply_payment_to_invoice();

CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT NOT NULL UNIQUE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  amount NUMERIC(12,3) NOT NULL, reason TEXT NOT NULL,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_notes TO authenticated;
GRANT ALL ON public.credit_notes TO service_role;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL, description TEXT, category TEXT,
  priority public.maintenance_priority NOT NULL DEFAULT 'normal',
  status public.maintenance_status NOT NULL DEFAULT 'pending',
  assigned_vendor TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX maintenance_unit_idx ON public.maintenance_requests(unit_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_requests TO authenticated;
GRANT ALL ON public.maintenance_requests TO service_role;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER maintenance_set_updated BEFORE UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL, visitor_phone TEXT,
  expected_at TIMESTAMPTZ NOT NULL, purpose TEXT,
  status public.visitor_status NOT NULL DEFAULT 'pending',
  qr_code TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ, checked_in_at TIMESTAMPTZ, checked_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitors TO authenticated;
GRANT ALL ON public.visitors TO service_role;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER visitors_set_updated BEFORE UPDATE ON public.visitors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, body TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT,
  file_url TEXT NOT NULL, category TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES (all created after tables exist) ============
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage units" ON public.units FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Residents view own units" ON public.units FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.residents r WHERE r.unit_id = units.id AND r.user_id = auth.uid()));

CREATE POLICY "Admins manage residents" ON public.residents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Residents view own record" ON public.residents FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins manage invoices" ON public.invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Residents view own invoices" ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.residents r WHERE r.unit_id = invoices.unit_id AND r.user_id = auth.uid()));

CREATE POLICY "Admins manage payments" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Residents view own payments" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i JOIN public.residents r ON r.unit_id = i.unit_id
    WHERE i.id = payments.invoice_id AND r.user_id = auth.uid()));
CREATE POLICY "Residents pay own invoices" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i JOIN public.residents r ON r.unit_id = i.unit_id
    WHERE i.id = payments.invoice_id AND r.user_id = auth.uid()));

CREATE POLICY "Admins manage credit notes" ON public.credit_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Residents view own credit notes" ON public.credit_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.residents r WHERE r.unit_id = credit_notes.unit_id AND r.user_id = auth.uid()));

CREATE POLICY "Admins manage maintenance" ON public.maintenance_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Residents view own maintenance" ON public.maintenance_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.residents r WHERE r.unit_id = maintenance_requests.unit_id AND r.user_id = auth.uid()));
CREATE POLICY "Residents create maintenance" ON public.maintenance_requests FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.residents r WHERE r.unit_id = maintenance_requests.unit_id AND r.user_id = auth.uid()));

CREATE POLICY "Admins manage visitors" ON public.visitors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Residents view own visitors" ON public.visitors FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.residents r WHERE r.unit_id = visitors.unit_id AND r.user_id = auth.uid()));
CREATE POLICY "Residents create visitors" ON public.visitors FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.residents r WHERE r.unit_id = visitors.unit_id AND r.user_id = auth.uid()));

CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "All view announcements" ON public.announcements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage documents" ON public.documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "All view documents" ON public.documents FOR SELECT TO authenticated USING (true);
