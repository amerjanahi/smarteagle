
DROP POLICY IF EXISTS "documents_bucket_admin_all" ON storage.objects;
CREATE POLICY "documents_bucket_admin_all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK (bucket_id = 'documents' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin'::app_role)));

DROP POLICY IF EXISTS "documents_bucket_read_auth" ON storage.objects;
CREATE POLICY "documents_bucket_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');
