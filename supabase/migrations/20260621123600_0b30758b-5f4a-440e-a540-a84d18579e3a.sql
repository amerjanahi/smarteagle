
-- Visitors: add car plate
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS car_plate TEXT;

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset','liability','equity','income','expense')),
  parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO authenticated;
GRANT ALL ON public.chart_of_accounts TO service_role;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in can view accounts" ON public.chart_of_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sales staff manage accounts" ON public.chart_of_accounts FOR ALL TO authenticated
  USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));
CREATE TRIGGER chart_of_accounts_updated_at BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Communication: Groups
CREATE TABLE IF NOT EXISTS public.notice_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notice_groups TO authenticated;
GRANT ALL ON public.notice_groups TO service_role;
ALTER TABLE public.notice_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in view groups" ON public.notice_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage groups" ON public.notice_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER notice_groups_updated_at BEFORE UPDATE ON public.notice_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Group Members
CREATE TABLE IF NOT EXISTS public.notice_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.notice_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notice_group_members TO authenticated;
GRANT ALL ON public.notice_group_members TO service_role;
ALTER TABLE public.notice_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in view group members" ON public.notice_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage group members" ON public.notice_group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- Notices
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'notice' CHECK (channel IN ('notice','email','sms','whatsapp')),
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','group')),
  group_id UUID REFERENCES public.notice_groups(id) ON DELETE SET NULL,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notices TO authenticated;
GRANT ALL ON public.notices TO service_role;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in view notices" ON public.notices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage notices" ON public.notices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER notices_updated_at BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default chart of accounts
INSERT INTO public.chart_of_accounts (code, name, account_type) VALUES
  ('1000','Cash','asset'),
  ('1100','Bank','asset'),
  ('1200','Accounts Receivable','asset'),
  ('2000','Accounts Payable','liability'),
  ('2100','VAT Payable','liability'),
  ('3000','Owner Equity','equity'),
  ('4000','Rental Income','income'),
  ('4100','Service Fees Income','income'),
  ('5000','Maintenance Expense','expense'),
  ('5100','Utilities Expense','expense'),
  ('5200','Salaries Expense','expense')
ON CONFLICT (code) DO NOTHING;
