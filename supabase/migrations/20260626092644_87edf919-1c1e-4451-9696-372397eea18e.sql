
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS annual_fee_rate NUMERIC(12,3) NOT NULL DEFAULT 0;

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS gfa_sqm NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS public.annual_fee_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  annual_rate NUMERIC(12,3) NOT NULL CHECK (annual_rate >= 0),
  gfa_sqm NUMERIC(12,2) NOT NULL CHECK (gfa_sqm >= 0),
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  gross_annual_fee NUMERIC(14,3) NOT NULL CHECK (gross_annual_fee >= 0),
  prorata_fee NUMERIC(14,3) NOT NULL CHECK (prorata_fee >= 0),
  waiver_from DATE,
  waiver_to DATE,
  waived_amount NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (waived_amount >= 0),
  net_payable NUMERIC(14,3) NOT NULL CHECK (net_payable >= 0),
  notes TEXT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_period CHECK (period_to >= period_from)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_fee_calculations TO authenticated;
GRANT ALL ON public.annual_fee_calculations TO service_role;

ALTER TABLE public.annual_fee_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage annual fee calcs" ON public.annual_fee_calculations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Residents view own annual fee calcs" ON public.annual_fee_calculations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.residents r
    WHERE r.unit_id = annual_fee_calculations.unit_id AND r.user_id = auth.uid()
  ));

CREATE TRIGGER annual_fee_calcs_set_updated
  BEFORE UPDATE ON public.annual_fee_calculations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS annual_fee_calcs_unit_idx ON public.annual_fee_calculations(unit_id);
