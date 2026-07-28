-- Track credit applications separately from cash receipts so invoices show both
-- the cash paid and credits applied without changing historical document totals.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS credit_applied NUMERIC(12,3) NOT NULL DEFAULT 0;

CREATE TABLE public.credit_note_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_applied NUMERIC(12,3) NOT NULL CHECK (amount_applied > 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(credit_note_id, invoice_id)
);
CREATE INDEX credit_note_allocations_invoice_idx ON public.credit_note_allocations(invoice_id);
ALTER TABLE public.credit_note_allocations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_note_allocations TO authenticated;
GRANT ALL ON public.credit_note_allocations TO service_role;
CREATE POLICY "credit_note_allocations_manage" ON public.credit_note_allocations FOR ALL TO authenticated
  USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE POLICY "credit_note_allocations_resident_read" ON public.credit_note_allocations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.residents r ON r.unit_id = i.unit_id
    WHERE i.id = credit_note_allocations.invoice_id AND r.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.recompute_invoice_from_allocations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _invoice_id UUID;
  _payments NUMERIC(12,3);
  _credits NUMERIC(12,3);
  _amount NUMERIC(12,3);
  _current_status public.invoice_status;
BEGIN
  _invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount_applied),0) INTO _payments
    FROM public.payment_allocations WHERE invoice_id = _invoice_id;
  SELECT COALESCE(SUM(amount_applied),0) INTO _credits
    FROM public.credit_note_allocations WHERE invoice_id = _invoice_id;
  SELECT amount, status INTO _amount, _current_status FROM public.invoices WHERE id = _invoice_id;
  UPDATE public.invoices SET
    amount_paid = _payments,
    credit_applied = _credits,
    status = CASE
      WHEN _current_status = 'cancelled' THEN 'cancelled'::public.invoice_status
      WHEN (_payments + _credits) >= _amount THEN 'paid'::public.invoice_status
      WHEN (_payments + _credits) > 0 THEN 'partial'::public.invoice_status
      WHEN due_date < CURRENT_DATE THEN 'overdue'::public.invoice_status
      ELSE 'unpaid'::public.invoice_status END,
    updated_at = now()
  WHERE id = _invoice_id;
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE EXECUTE ON FUNCTION public.recompute_invoice_from_allocations() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.recompute_credit_note_from_allocations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _credit_note_id UUID;
  _total NUMERIC(12,3);
BEGIN
  _credit_note_id := COALESCE(NEW.credit_note_id, OLD.credit_note_id);
  SELECT COALESCE(SUM(amount_applied),0) INTO _total
    FROM public.credit_note_allocations WHERE credit_note_id = _credit_note_id;
  UPDATE public.credit_notes SET
    applied_amount = _total,
    balance = GREATEST(amount - _total, 0),
    status = CASE WHEN _total >= amount THEN 'applied' ELSE 'issued' END
  WHERE id = _credit_note_id;
  RETURN COALESCE(NEW, OLD);
END; $$;
REVOKE EXECUTE ON FUNCTION public.recompute_credit_note_from_allocations() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER credit_alloc_recompute_invoice
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_note_allocations
  FOR EACH ROW EXECUTE FUNCTION public.recompute_invoice_from_allocations();
CREATE TRIGGER credit_alloc_recompute_note
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_note_allocations
  FOR EACH ROW EXECUTE FUNCTION public.recompute_credit_note_from_allocations();

-- Recalculate existing invoice settlement fields under the new definition.
UPDATE public.invoices i SET
  amount_paid = COALESCE((SELECT SUM(pa.amount_applied) FROM public.payment_allocations pa WHERE pa.invoice_id = i.id), 0),
  credit_applied = COALESCE((SELECT SUM(ca.amount_applied) FROM public.credit_note_allocations ca WHERE ca.invoice_id = i.id), 0);
