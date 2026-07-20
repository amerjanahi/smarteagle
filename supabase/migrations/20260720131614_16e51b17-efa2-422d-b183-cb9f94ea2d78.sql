
CREATE POLICY "Security and admin upload incident photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'incident-photos' AND (public.has_role(auth.uid(), 'security') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Security and admin read incident photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'incident-photos' AND (public.has_role(auth.uid(), 'security') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Admins delete incident photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'incident-photos' AND public.has_role(auth.uid(), 'admin'));
