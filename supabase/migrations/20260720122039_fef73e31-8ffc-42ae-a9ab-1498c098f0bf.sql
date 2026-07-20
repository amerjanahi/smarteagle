
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS folder text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS document_date date,
  ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resident_id uuid,
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchase_invoice_id uuid REFERENCES public.purchase_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS documents_folder_idx ON public.documents(folder);
CREATE INDEX IF NOT EXISTS documents_archived_idx ON public.documents(archived);
CREATE INDEX IF NOT EXISTS documents_unit_idx ON public.documents(unit_id);
CREATE INDEX IF NOT EXISTS documents_resident_idx ON public.documents(resident_id);
CREATE INDEX IF NOT EXISTS documents_vendor_idx ON public.documents(vendor_id);

DROP TRIGGER IF EXISTS documents_updated_at ON public.documents;
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Admins can manage documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated can read documents" ON public.documents;
DROP POLICY IF EXISTS "documents_admin_all" ON public.documents;
DROP POLICY IF EXISTS "documents_staff_read" ON public.documents;
DROP POLICY IF EXISTS "documents_resident_read" ON public.documents;

CREATE POLICY "documents_admin_all" ON public.documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "documents_staff_read" ON public.documents FOR SELECT TO authenticated
  USING (
    archived = false AND (
      public.has_role(auth.uid(), 'accountant'::app_role)
      OR public.has_role(auth.uid(), 'finance'::app_role)
      OR public.has_role(auth.uid(), 'operations'::app_role)
    )
  );

CREATE POLICY "documents_resident_read" ON public.documents FOR SELECT TO authenticated
  USING (
    archived = false
    AND access_level = 'resident'
    AND (
      resident_id = auth.uid()
      OR unit_id IN (SELECT unit_id FROM public.user_villas WHERE user_id = auth.uid() AND status = 'active')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
