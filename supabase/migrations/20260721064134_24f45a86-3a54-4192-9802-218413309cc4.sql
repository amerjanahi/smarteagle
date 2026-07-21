
-- Chart of accounts: restrict SELECT to sales/finance staff
DROP POLICY IF EXISTS "Signed in can view accounts" ON public.chart_of_accounts;
CREATE POLICY "Sales staff view accounts" ON public.chart_of_accounts
  FOR SELECT TO authenticated
  USING (public.can_manage_sales(auth.uid()));

-- Company settings: restrict SELECT to admin/finance/accountant roles
DROP POLICY IF EXISTS "company_settings authenticated read" ON public.company_settings;
CREATE POLICY "company_settings staff read" ON public.company_settings
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_manage_sales(auth.uid())
  );

-- Currencies: restrict from public role to authenticated only
DROP POLICY IF EXISTS "currencies read all" ON public.currencies;
CREATE POLICY "currencies read authenticated" ON public.currencies
  FOR SELECT TO authenticated
  USING (true);

-- Notices: scope SELECT to admins or users whose audience matches
DROP POLICY IF EXISTS "Signed in view notices" ON public.notices;
CREATE POLICY "View notices by audience" ON public.notices
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      status = 'published' AND (
        audience = 'all'
        OR (
          audience = 'group'
          AND group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.notice_group_members m
            WHERE m.group_id = notices.group_id AND m.user_id = auth.uid()
          )
        )
      )
    )
  );

-- Units: restrict broad browse to users who have not yet linked a villa (needed only for the villa-linking flow)
DROP POLICY IF EXISTS "authenticated can browse units for linking" ON public.units;
CREATE POLICY "Unlinked users browse units for linking" ON public.units
  FOR SELECT TO authenticated
  USING (NOT public.user_has_villa(auth.uid()));
