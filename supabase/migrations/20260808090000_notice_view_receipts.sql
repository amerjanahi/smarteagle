-- Privacy-safe notice read receipts. Residents can only record their own view;
-- only Top Admin can see the identities behind a notice's view count.
CREATE TABLE IF NOT EXISTS public.notice_views (
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id)
);

CREATE INDEX IF NOT EXISTS notice_views_notice_id_idx ON public.notice_views(notice_id, viewed_at);
ALTER TABLE public.notice_views ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.notice_views TO authenticated;

DROP POLICY IF EXISTS "users view own notice receipts" ON public.notice_views;
CREATE POLICY "users view own notice receipts" ON public.notice_views
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "top admin views notice receipts" ON public.notice_views;
CREATE POLICY "top admin views notice receipts" ON public.notice_views
  FOR SELECT TO authenticated USING (public.is_top_admin(auth.uid()));

-- Published notices are visible only to their intended audience. This policy
-- complements existing staff permission policies rather than widening them.
DROP POLICY IF EXISTS "recipients view published notices" ON public.notices;
CREATE POLICY "recipients view published notices" ON public.notices
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND (
      audience = 'all'
      OR (audience = 'group' AND EXISTS (
        SELECT 1 FROM public.notice_group_members member
        WHERE member.group_id = notices.group_id AND member.user_id = auth.uid()
      ))
    )
  );

CREATE OR REPLACE FUNCTION public.record_notice_view(p_notice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.notices notice
    WHERE notice.id = p_notice_id
      AND notice.status = 'published'
      AND (
        notice.audience = 'all'
        OR (notice.audience = 'group' AND EXISTS (
          SELECT 1 FROM public.notice_group_members member
          WHERE member.group_id = notice.group_id AND member.user_id = auth.uid()
        ))
      )
  ) THEN
    RAISE EXCEPTION 'Notice is not available to this user';
  END IF;

  INSERT INTO public.notice_views (notice_id, user_id)
  VALUES (p_notice_id, auth.uid())
  ON CONFLICT (notice_id, user_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.record_notice_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_notice_view(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_notice_viewers(p_notice_id uuid)
RETURNS TABLE (user_id uuid, full_name text, email text, viewed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_top_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Top Admin access required';
  END IF;

  RETURN QUERY
  SELECT receipt.user_id, profile.full_name, profile.email, receipt.viewed_at
  FROM public.notice_views receipt
  JOIN public.profiles profile ON profile.id = receipt.user_id
  WHERE receipt.notice_id = p_notice_id
  ORDER BY receipt.viewed_at ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_notice_viewers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_notice_viewers(uuid) TO authenticated;
