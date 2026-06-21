
-- Purchases module schema

-- Enums
CREATE TYPE public.approval_status AS ENUM ('draft','pending','approved','rejected');
CREATE TYPE public.purchase_invoice_status AS ENUM ('unpaid','partial','paid','cancelled','overdue');

-- Expand expenses with attachments, VAT, approval, payment tracking
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_status public.approval_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS reference TEXT;

-- Vendors
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors_select" ON public.vendors FOR SELECT TO authenticated USING (public.can_manage_sales(auth.uid()));
CREATE POLICY "vendors_modify" ON public.vendors FOR ALL TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Purchase Invoices (bills from vendors)
CREATE TABLE public.purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.purchase_invoice_status NOT NULL DEFAULT 'unpaid',
  approval_status public.approval_status NOT NULL DEFAULT 'draft',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  category public.expense_category,
  description TEXT,
  notes TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_terms TEXT,
  reference TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoices TO authenticated;
GRANT ALL ON public.purchase_invoices TO service_role;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi_select" ON public.purchase_invoices FOR SELECT TO authenticated USING (public.can_manage_sales(auth.uid()));
CREATE POLICY "pi_modify" ON public.purchase_invoices FOR ALL TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE TRIGGER trg_pi_updated BEFORE UPDATE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vendor Payments
CREATE TABLE public.vendor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL UNIQUE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  purchase_invoice_id UUID REFERENCES public.purchase_invoices(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT,
  reference TEXT,
  notes TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_payments TO authenticated;
GRANT ALL ON public.vendor_payments TO service_role;
ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vp_select" ON public.vendor_payments FOR SELECT TO authenticated USING (public.can_manage_sales(auth.uid()));
CREATE POLICY "vp_modify" ON public.vendor_payments FOR ALL TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE TRIGGER trg_vp_updated BEFORE UPDATE ON public.vendor_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto number triggers reusing existing counter helper
CREATE OR REPLACE FUNCTION public.set_bill_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.bill_number IS NULL OR NEW.bill_number = '' THEN
    NEW.bill_number := public.next_document_number('purchase_invoice','BILL');
  END IF;
  NEW.total_amount := COALESCE(NEW.subtotal,0) + COALESCE(NEW.vat_amount,0) - COALESCE(NEW.discount_amount,0);
  NEW.balance_due := GREATEST(NEW.total_amount - COALESCE(NEW.amount_paid,0), 0);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_bill_number BEFORE INSERT OR UPDATE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.set_bill_number();

CREATE OR REPLACE FUNCTION public.set_vendor_payment_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.payment_number IS NULL OR NEW.payment_number = '' THEN
    NEW.payment_number := public.next_document_number('vendor_payment','VPAY');
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_vpay_number BEFORE INSERT ON public.vendor_payments FOR EACH ROW EXECUTE FUNCTION public.set_vendor_payment_number();

-- Recompute purchase invoice from payments
CREATE OR REPLACE FUNCTION public.recompute_purchase_invoice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _pid UUID; _total NUMERIC(12,2); _amt NUMERIC(12,2);
BEGIN
  _pid := COALESCE(NEW.purchase_invoice_id, OLD.purchase_invoice_id);
  IF _pid IS NULL THEN RETURN COALESCE(NEW,OLD); END IF;
  SELECT COALESCE(SUM(amount),0) INTO _total FROM public.vendor_payments WHERE purchase_invoice_id = _pid;
  SELECT total_amount INTO _amt FROM public.purchase_invoices WHERE id = _pid;
  UPDATE public.purchase_invoices SET
    amount_paid = _total,
    balance_due = GREATEST(COALESCE(_amt,0) - _total, 0),
    status = CASE WHEN _total >= COALESCE(_amt,0) AND COALESCE(_amt,0) > 0 THEN 'paid'::public.purchase_invoice_status
                  WHEN _total > 0 THEN 'partial'::public.purchase_invoice_status
                  ELSE 'unpaid'::public.purchase_invoice_status END,
    updated_at = now()
  WHERE id = _pid;
  RETURN COALESCE(NEW,OLD);
END;$$;
CREATE TRIGGER trg_recompute_pi AFTER INSERT OR UPDATE OR DELETE ON public.vendor_payments FOR EACH ROW EXECUTE FUNCTION public.recompute_purchase_invoice();

-- Audit triggers
CREATE TRIGGER trg_audit_vendors AFTER INSERT OR UPDATE OR DELETE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_audit_pi AFTER INSERT OR UPDATE OR DELETE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER trg_audit_vp AFTER INSERT OR UPDATE OR DELETE ON public.vendor_payments FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
