-- Keep generated finance PDFs in Document Management without granting access
-- to unrelated documents or storage paths.

DROP POLICY IF EXISTS "sales generated documents read" ON public.documents;
DROP POLICY IF EXISTS "sales generated documents insert" ON public.documents;
DROP POLICY IF EXISTS "sales generated documents update" ON public.documents;

CREATE POLICY "sales generated documents read" ON public.documents
FOR SELECT TO authenticated
USING (
  archived = false
  AND folder = 'Finance / Sales'
  AND tags @> ARRAY['system-generated']::text[]
  AND public.can_manage_sales(auth.uid())
);

CREATE POLICY "sales generated documents insert" ON public.documents
FOR INSERT TO authenticated
WITH CHECK (
  folder = 'Finance / Sales'
  AND tags @> ARRAY['system-generated']::text[]
  AND access_level = 'staff'
  AND public.can_manage_sales(auth.uid())
);

CREATE POLICY "sales generated documents update" ON public.documents
FOR UPDATE TO authenticated
USING (
  folder = 'Finance / Sales'
  AND tags @> ARRAY['system-generated']::text[]
  AND public.can_manage_sales(auth.uid())
)
WITH CHECK (
  folder = 'Finance / Sales'
  AND tags @> ARRAY['system-generated']::text[]
  AND access_level = 'staff'
  AND public.can_manage_sales(auth.uid())
);

DROP POLICY IF EXISTS "sales generated finance PDF upload" ON storage.objects;
DROP POLICY IF EXISTS "sales generated finance PDF update" ON storage.objects;

CREATE POLICY "sales generated finance PDF upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND name LIKE 'system/finance/%'
  AND public.can_manage_sales(auth.uid())
);

CREATE POLICY "sales generated finance PDF update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND name LIKE 'system/finance/%'
  AND public.can_manage_sales(auth.uid())
)
WITH CHECK (
  bucket_id = 'documents'
  AND name LIKE 'system/finance/%'
  AND public.can_manage_sales(auth.uid())
);
