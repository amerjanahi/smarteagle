
ALTER TYPE public.bank_txn_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.bank_txn_status ADD VALUE IF NOT EXISTS 'applied';
ALTER TYPE public.bank_txn_status ADD VALUE IF NOT EXISTS 'partially_applied';
ALTER TYPE public.bank_txn_status ADD VALUE IF NOT EXISTS 'reversed';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operations';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'security';
