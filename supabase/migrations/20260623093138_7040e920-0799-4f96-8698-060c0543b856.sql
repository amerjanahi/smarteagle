
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS applied_amount NUMERIC(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_to_type TEXT,
  ADD COLUMN IF NOT EXISTS applied_to_id UUID,
  ADD COLUMN IF NOT EXISTS apply_notes TEXT,
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applied_by UUID;

CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'My Company',
  cr_number TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  default_currency TEXT NOT NULL DEFAULT 'BHD',
  vat_number TEXT,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  vat_effective_date DATE,
  tax_invoice_footer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_settings TO anon, authenticated;
GRANT ALL ON public.company_settings TO authenticated, service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_settings read all" ON public.company_settings FOR SELECT USING (true);
CREATE POLICY "company_settings admin write" ON public.company_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.company_settings (company_name) SELECT 'Hayy Residences' WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);
CREATE TRIGGER trg_company_settings_updated BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  decimals INT NOT NULL DEFAULT 2,
  exchange_rate NUMERIC(14,6) NOT NULL DEFAULT 1,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.currencies TO anon, authenticated;
GRANT ALL ON public.currencies TO authenticated, service_role;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "currencies read all" ON public.currencies FOR SELECT USING (true);
CREATE POLICY "currencies admin write" ON public.currencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.currencies (code, name, decimals, exchange_rate, is_default) VALUES
  ('BHD','Bahraini Dinar',3,1,true),
  ('AED','UAE Dirham',2,9.95,false),
  ('SAR','Saudi Riyal',2,10.16,false),
  ('USD','US Dollar',2,2.65,false),
  ('QAR','Qatari Riyal',2,9.85,false),
  ('KWD','Kuwaiti Dinar',3,0.81,false)
ON CONFLICT (code) DO NOTHING;
CREATE TRIGGER trg_currencies_updated BEFORE UPDATE ON public.currencies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_approve BOOLEAN NOT NULL DEFAULT false,
  can_apply_txn BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, module)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO authenticated, service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_perm read auth" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_perm admin write" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_role_permissions_updated BEFORE UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve, can_apply_txn, can_export)
SELECT r::public.app_role, m,
  true,
  CASE WHEN r IN ('admin','finance','operations') THEN true ELSE false END,
  CASE WHEN r IN ('admin','finance','operations') THEN true ELSE false END,
  CASE WHEN r = 'admin' THEN true ELSE false END,
  CASE WHEN r IN ('admin','finance') THEN true ELSE false END,
  CASE WHEN r IN ('admin','finance') THEN true ELSE false END,
  CASE WHEN r IN ('admin','finance') THEN true ELSE false END
FROM unnest(ARRAY['admin','finance','operations','security','viewer','resident']) AS r,
     unnest(ARRAY['property','sales','purchases','bank','operations','communication','settings']) AS m
ON CONFLICT (role, module) DO NOTHING;
