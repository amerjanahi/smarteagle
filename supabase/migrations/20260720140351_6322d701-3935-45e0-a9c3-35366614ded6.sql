
DROP POLICY IF EXISTS "All view documents" ON public.documents;
DROP POLICY IF EXISTS "Admins manage documents" ON public.documents;

DROP POLICY IF EXISTS "documents_bucket_read_auth" ON storage.objects;

CREATE POLICY "documents_bucket_read_scoped" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.file_url LIKE '%' || storage.objects.name
      AND d.archived = false
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
        OR (
          d.access_level IN ('staff','admin')
          AND (
            has_role(auth.uid(), 'accountant'::app_role)
            OR has_role(auth.uid(), 'finance'::app_role)
            OR has_role(auth.uid(), 'operations'::app_role)
          )
        )
        OR (
          d.access_level = 'resident'
          AND (
            d.resident_id = auth.uid()
            OR d.unit_id IN (
              SELECT unit_id FROM public.user_villas
              WHERE user_id = auth.uid() AND status = 'active'
            )
          )
        )
      )
  )
);
