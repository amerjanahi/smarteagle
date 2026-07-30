-- Resolve production security review warnings.

-- Villa discovery is now performed by a validated server function that returns
-- only the columns needed by onboarding. Direct table browsing is unnecessary.
DROP POLICY IF EXISTS "authenticated can browse units for linking" ON public.units;
DROP POLICY IF EXISTS "Unlinked users browse units for linking" ON public.units;

-- Staff may read staff documents, never documents explicitly marked admin-only.
DROP POLICY IF EXISTS "documents_staff_read" ON public.documents;
CREATE POLICY "documents_staff_read" ON public.documents FOR SELECT TO authenticated
  USING (
    archived = false
    AND access_level = 'staff'
    AND (
      public.has_role(auth.uid(), 'property_manager'::public.app_role)
      OR public.has_role(auth.uid(), 'accountant'::public.app_role)
      OR public.has_role(auth.uid(), 'finance'::public.app_role)
      OR public.has_role(auth.uid(), 'operations'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "documents_resident_read" ON public.documents;
CREATE POLICY "documents_resident_read" ON public.documents FOR SELECT TO authenticated
  USING (
    archived = false
    AND access_level = 'resident'
    AND (
      resident_id = auth.uid()
      OR unit_id IN (
        SELECT uv.villa_id
        FROM public.user_villas uv
        WHERE uv.user_id = auth.uid() AND uv.status = 'active'
      )
    )
  );

-- Keep storage authorization identical to the document-row authorization.
DROP POLICY IF EXISTS "documents_bucket_read_scoped" ON storage.objects;
CREATE POLICY "documents_bucket_read_scoped" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.file_url LIKE '%' || storage.objects.name
      AND d.archived = false
      AND (
        public.is_top_admin(auth.uid())
        OR (
          d.access_level = 'staff'
          AND (
            public.has_role(auth.uid(), 'property_manager'::public.app_role)
            OR public.has_role(auth.uid(), 'accountant'::public.app_role)
            OR public.has_role(auth.uid(), 'finance'::public.app_role)
            OR public.has_role(auth.uid(), 'operations'::public.app_role)
          )
        )
        OR (
          d.access_level = 'resident'
          AND (
            d.resident_id = auth.uid()
            OR d.unit_id IN (
              SELECT uv.villa_id
              FROM public.user_villas uv
              WHERE uv.user_id = auth.uid() AND uv.status = 'active'
            )
          )
        )
      )
  )
);
