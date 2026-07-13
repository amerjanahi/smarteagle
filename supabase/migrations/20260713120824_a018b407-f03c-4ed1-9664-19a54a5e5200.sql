
ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_status_check;
ALTER TABLE public.notices ADD CONSTRAINT notices_status_check CHECK (status IN ('draft','published'));

-- Backfill: existing rows treated as published
UPDATE public.notices SET status = 'published', published_at = COALESCE(published_at, sent_at) WHERE status = 'draft' AND sent_at IS NOT NULL;

-- Storage policies for notice-images (private bucket)
DROP POLICY IF EXISTS "Admins manage notice images" ON storage.objects;
CREATE POLICY "Admins manage notice images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'notice-images' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'notice-images' AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Auth view notice images" ON storage.objects;
CREATE POLICY "Auth view notice images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'notice-images');
