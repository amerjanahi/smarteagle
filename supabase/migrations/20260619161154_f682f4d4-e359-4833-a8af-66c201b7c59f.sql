
-- =========================================================
-- Helper: can_manage_sales
-- =========================================================
CREATE OR REPLACE FUNCTION public.can_manage_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::app_role, 'accountant'::app_role)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_sales(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_sales(uuid) TO authenticated, service_role;

-- =========================================================
-- 2. Column additions
-- =========================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id);

ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS applied_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unallocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- =========================================================
-- 3. invoice_line_items
-- =========================================================
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_line_items TO authenticated;
GRANT ALL ON public.invoice_line_items TO service_role;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales managers manage invoice line items"
  ON public.invoice_line_items FOR ALL TO authenticated
  USING (public.can_manage_sales(auth.uid()))
  WITH CHECK (public.can_manage_sales(auth.uid()));

CREATE POLICY "Residents read their own invoice line items"
  ON public.invoice_line_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.residents r ON r.unit_id = i.unit_id
    WHERE i.id = invoice_line_items.invoice_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  ));

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON public.invoice_line_items(invoice_id);

-- =========================================================
-- 4. credit_note_line_items
-- =========================================================
CREATE TABLE IF NOT EXISTS public.credit_note_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_note_line_items TO authenticated;
GRANT ALL ON public.credit_note_line_items TO service_role;
ALTER TABLE public.credit_note_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales managers manage credit note line items"
  ON public.credit_note_line_items FOR ALL TO authenticated
  USING (public.can_manage_sales(auth.uid()))
  WITH CHECK (public.can_manage_sales(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_credit_note_line_items_cn ON public.credit_note_line_items(credit_note_id);

-- =========================================================
-- 5. payment_allocations
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_applied NUMERIC(12,2) NOT NULL CHECK (amount_applied > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_allocations TO authenticated;
GRANT ALL ON public.payment_allocations TO service_role;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales managers manage payment allocations"
  ON public.payment_allocations FOR ALL TO authenticated
  USING (public.can_manage_sales(auth.uid()))
  WITH CHECK (public.can_manage_sales(auth.uid()));

CREATE POLICY "Residents read allocations on own invoices"
  ON public.payment_allocations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.residents r ON r.unit_id = i.unit_id
    WHERE i.id = payment_allocations.invoice_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  ));

CREATE INDEX IF NOT EXISTS idx_payment_alloc_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_alloc_invoice ON public.payment_allocations(invoice_id);

-- =========================================================
-- 6. document_templates
-- =========================================================
CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL CHECK (template_type IN ('invoice','credit_note','receipt','statement')),
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0F172A',
  accent_color TEXT NOT NULL DEFAULT '#3B82F6',
  header_text TEXT,
  footer_text TEXT,
  fields_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout TEXT NOT NULL DEFAULT 'standard' CHECK (layout IN ('compact','standard','detailed')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales managers read templates"
  ON public.document_templates FOR SELECT TO authenticated
  USING (public.can_manage_sales(auth.uid()));

CREATE POLICY "Admins manage templates"
  ON public.document_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_document_templates_updated
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 7. audit_log
-- =========================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  actor_user_id UUID,
  before_json JSONB,
  after_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

-- =========================================================
-- 8. document_counters (per year sequential numbering)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.document_counters (
  doc_type TEXT NOT NULL,
  year INT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, year)
);
GRANT SELECT ON public.document_counters TO authenticated;
GRANT ALL ON public.document_counters TO service_role;
ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales read counters" ON public.document_counters
  FOR SELECT TO authenticated USING (public.can_manage_sales(auth.uid()));

-- =========================================================
-- 9. Numbering function & triggers
-- =========================================================
CREATE OR REPLACE FUNCTION public.next_document_number(_doc_type TEXT, _prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _year INT := EXTRACT(YEAR FROM now())::INT;
  _n INT;
BEGIN
  INSERT INTO public.document_counters(doc_type, year, last_number)
    VALUES (_doc_type, _year, 1)
  ON CONFLICT (doc_type, year) DO UPDATE
    SET last_number = public.document_counters.last_number + 1
  RETURNING last_number INTO _n;
  RETURN _prefix || '-' || _year || '-' || LPAD(_n::TEXT, 5, '0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_document_number(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.next_document_number('invoice', 'INV');
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_invoice_number() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_receipt_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := public.next_document_number('receipt', 'RCP');
  END IF;
  NEW.unallocated_amount := COALESCE(NEW.amount,0) - COALESCE(NEW.allocated_amount,0);
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_receipt_number() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_credit_note_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.credit_note_number IS NULL OR NEW.credit_note_number = '' THEN
    NEW.credit_note_number := public.next_document_number('credit_note', 'CN');
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_credit_note_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_invoice_number ON public.invoices;
CREATE TRIGGER trg_invoice_number BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();

DROP TRIGGER IF EXISTS trg_receipt_number ON public.payments;
CREATE TRIGGER trg_receipt_number BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_receipt_number();

DROP TRIGGER IF EXISTS trg_credit_note_number ON public.credit_notes;
CREATE TRIGGER trg_credit_note_number BEFORE INSERT ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_credit_note_number();

-- =========================================================
-- 10. Replace apply_payment_to_invoice with allocation-based recomputation
-- =========================================================
CREATE OR REPLACE FUNCTION public.recompute_invoice_from_allocations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _invoice_id UUID;
  _total NUMERIC(12,2);
  _amount NUMERIC(12,2);
BEGIN
  _invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount_applied),0) INTO _total
    FROM public.payment_allocations WHERE invoice_id = _invoice_id;
  SELECT amount INTO _amount FROM public.invoices WHERE id = _invoice_id;
  UPDATE public.invoices SET
    amount_paid = _total,
    status = CASE
      WHEN _total >= _amount THEN 'paid'::public.invoice_status
      WHEN _total > 0 THEN 'partial'::public.invoice_status
      ELSE 'unpaid'::public.invoice_status END,
    updated_at = now()
  WHERE id = _invoice_id;
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE EXECUTE ON FUNCTION public.recompute_invoice_from_allocations() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.recompute_payment_allocated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _payment_id UUID;
  _total NUMERIC(12,2);
BEGIN
  _payment_id := COALESCE(NEW.payment_id, OLD.payment_id);
  SELECT COALESCE(SUM(amount_applied),0) INTO _total
    FROM public.payment_allocations WHERE payment_id = _payment_id;
  UPDATE public.payments SET
    allocated_amount = _total,
    unallocated_amount = GREATEST(COALESCE(amount,0) - _total, 0)
  WHERE id = _payment_id;
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE EXECUTE ON FUNCTION public.recompute_payment_allocated() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_alloc_recompute_invoice ON public.payment_allocations;
CREATE TRIGGER trg_alloc_recompute_invoice
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.recompute_invoice_from_allocations();

DROP TRIGGER IF EXISTS trg_alloc_recompute_payment ON public.payment_allocations;
CREATE TRIGGER trg_alloc_recompute_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.recompute_payment_allocated();

-- Replace the old payment->invoice trigger to avoid double counting
DROP TRIGGER IF EXISTS apply_payment_to_invoice ON public.payments;
DROP TRIGGER IF EXISTS trg_apply_payment_to_invoice ON public.payments;

-- =========================================================
-- 11. Credit note recompute
-- =========================================================
CREATE OR REPLACE FUNCTION public.recompute_credit_note_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.balance := GREATEST(COALESCE(NEW.amount,0) - COALESCE(NEW.applied_amount,0), 0);
  IF NEW.balance = 0 AND COALESCE(NEW.amount,0) > 0 THEN
    NEW.status := 'applied';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.recompute_credit_note_balance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cn_recompute ON public.credit_notes;
CREATE TRIGGER trg_cn_recompute BEFORE INSERT OR UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.recompute_credit_note_balance();

-- =========================================================
-- 12. Audit log trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log(table_name, record_id, action, actor_user_id, before_json, after_json)
  VALUES (
    TG_TABLE_NAME,
    COALESCE((NEW).id, (OLD).id),
    LOWER(TG_OP),
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_invoices ON public.invoices;
CREATE TRIGGER trg_audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_credit_notes ON public.credit_notes;
CREATE TRIGGER trg_audit_credit_notes AFTER INSERT OR UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_allocations ON public.payment_allocations;
CREATE TRIGGER trg_audit_allocations AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
