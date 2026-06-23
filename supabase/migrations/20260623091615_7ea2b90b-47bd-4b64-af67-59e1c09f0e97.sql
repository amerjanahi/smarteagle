
CREATE TYPE public.bank_txn_direction AS ENUM ('in','out');
CREATE TYPE public.bank_txn_status AS ENUM ('matched','partial','unmatched','review');

CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  currency TEXT NOT NULL DEFAULT 'BHD',
  opening_balance NUMERIC(14,3) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales managers manage bank accounts" ON public.bank_accounts FOR ALL TO authenticated
  USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  direction public.bank_txn_direction NOT NULL,
  amount NUMERIC(14,3) NOT NULL DEFAULT 0,
  status public.bank_txn_status NOT NULL DEFAULT 'unmatched',
  matched_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  matched_vendor_payment_id UUID REFERENCES public.vendor_payments(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sales managers manage bank txns" ON public.bank_transactions FOR ALL TO authenticated
  USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE INDEX idx_bank_txn_acct_date ON public.bank_transactions(account_id, txn_date DESC);
CREATE TRIGGER trg_bank_txns_updated BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
