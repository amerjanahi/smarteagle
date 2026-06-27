
DROP POLICY "company_settings read all" ON public.company_settings;
CREATE POLICY "company_settings authenticated read" ON public.company_settings FOR SELECT TO authenticated USING (true);

DROP POLICY "Signed in view groups" ON public.notice_groups;
CREATE POLICY "Admins view groups" ON public.notice_groups FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Signed in view group members" ON public.notice_group_members;
CREATE POLICY "Members view own or admin" ON public.notice_group_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

REVOKE EXECUTE ON FUNCTION public.set_bill_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_vendor_payment_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_purchase_invoice() FROM PUBLIC, anon, authenticated;
