-- Personal details remain live data. Published invoices, receipts and notices keep
-- their existing snapshot values and are deliberately never changed by this flow.
CREATE TABLE public.profile_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_email TEXT NOT NULL,
  requested_email TEXT NOT NULL,
  requested_full_name TEXT,
  requested_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT
);

CREATE INDEX profile_change_requests_pending_idx
  ON public.profile_change_requests (status, requested_at DESC);
CREATE INDEX profile_change_requests_user_idx
  ON public.profile_change_requests (user_id, requested_at DESC);

GRANT SELECT, INSERT ON public.profile_change_requests TO authenticated;
GRANT ALL ON public.profile_change_requests TO service_role;
ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own profile change requests"
  ON public.profile_change_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users submit their own pending email changes"
  ON public.profile_change_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins manage profile change requests"
  ON public.profile_change_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
