
DO $$ BEGIN
  CREATE TYPE public.expense_category AS ENUM ('admin','security','utility','fm','maintenance','other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.expense_category NOT NULL,
  vendor text,
  description text NOT NULL,
  amount numeric(12,3) NOT NULL CHECK (amount >= 0),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  is_paid boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS expenses_date_idx ON public.expenses (expense_date);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON public.expenses (category);

-- Seed demo data
INSERT INTO public.expenses (category, vendor, description, amount, expense_date) VALUES
  ('admin','Office Depot','Office stationery & printing', 145.500, CURRENT_DATE - INTERVAL '5 days'),
  ('admin','Zain Telecom','Internet & phone lines', 89.750, CURRENT_DATE - INTERVAL '12 days'),
  ('admin','LegalCo','Legal retainer', 350.000, CURRENT_DATE - INTERVAL '45 days'),
  ('security','SecureGuard W.L.L.','Guard services - monthly', 1850.000, CURRENT_DATE - INTERVAL '3 days'),
  ('security','SecureGuard W.L.L.','Guard services - monthly', 1850.000, CURRENT_DATE - INTERVAL '34 days'),
  ('security','CCTV Pro','CCTV maintenance', 220.500, CURRENT_DATE - INTERVAL '60 days'),
  ('utility','EWA','Electricity bill', 1240.750, CURRENT_DATE - INTERVAL '8 days'),
  ('utility','EWA','Water bill', 410.250, CURRENT_DATE - INTERVAL '8 days'),
  ('utility','EWA','Electricity bill', 1180.500, CURRENT_DATE - INTERVAL '38 days'),
  ('utility','EWA','Electricity bill', 1320.000, CURRENT_DATE - INTERVAL '68 days'),
  ('fm','CleanPro','Cleaning services - monthly', 980.000, CURRENT_DATE - INTERVAL '4 days'),
  ('fm','CleanPro','Cleaning services - monthly', 980.000, CURRENT_DATE - INTERVAL '35 days'),
  ('fm','GreenScape','Landscaping & gardening', 450.000, CURRENT_DATE - INTERVAL '20 days'),
  ('fm','LiftCare','Elevator AMC', 575.500, CURRENT_DATE - INTERVAL '50 days'),
  ('maintenance','FixIt Co','Plumbing repairs', 215.750, CURRENT_DATE - INTERVAL '10 days'),
  ('maintenance','FixIt Co','HVAC repair', 480.000, CURRENT_DATE - INTERVAL '25 days'),
  ('other','Misc','Welcome event refreshments', 95.250, CURRENT_DATE - INTERVAL '15 days');
