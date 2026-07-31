ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'property_manager';

CREATE TABLE IF NOT EXISTS public.vendor_compliance_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  file_path TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_compliance_documents TO authenticated;
GRANT ALL ON public.vendor_compliance_documents TO service_role;

ALTER TABLE public.vendor_compliance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance staff manage vendor compliance documents"
ON public.vendor_compliance_documents FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'accountant'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'accountant'));

CREATE INDEX IF NOT EXISTS vendor_compliance_documents_vendor_id_idx ON public.vendor_compliance_documents(vendor_id);