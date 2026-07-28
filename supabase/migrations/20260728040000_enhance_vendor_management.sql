-- Extend vendor master data without changing existing purchase invoices or payments.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS commercial_registration TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 365),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'blocked', 'inactive')),
  ADD COLUMN IF NOT EXISTS is_preferred BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS vendors_tax_id_idx
  ON public.vendors (lower(tax_id)) WHERE tax_id IS NOT NULL AND btrim(tax_id) <> '';
CREATE INDEX IF NOT EXISTS vendors_iban_idx
  ON public.vendors (lower(iban)) WHERE iban IS NOT NULL AND btrim(iban) <> '';

CREATE TABLE public.vendor_compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  file_path TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vendor_compliance_vendor_idx ON public.vendor_compliance_documents(vendor_id, expiry_date);
ALTER TABLE public.vendor_compliance_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_compliance_documents TO authenticated;
GRANT ALL ON public.vendor_compliance_documents TO service_role;
CREATE POLICY "vendor_compliance_select" ON public.vendor_compliance_documents FOR SELECT TO authenticated
  USING (public.can_manage_sales(auth.uid()));
CREATE POLICY "vendor_compliance_modify" ON public.vendor_compliance_documents FOR ALL TO authenticated
  USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE TRIGGER vendor_compliance_updated BEFORE UPDATE ON public.vendor_compliance_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
