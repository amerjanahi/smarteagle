-- Link invoice revenue lines to the Chart of Accounts.
-- Existing line items remain valid and are intentionally left unmapped.

ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS account_id UUID
  REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_account
  ON public.invoice_line_items(account_id);

COMMENT ON COLUMN public.invoice_line_items.account_id IS
  'Income account credited by this invoice line. Existing historical lines may be null.';
