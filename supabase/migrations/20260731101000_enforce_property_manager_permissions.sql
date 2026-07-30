-- Enforce the central permission model for the Property Manager's supported
-- operational modules. These policies are additive to existing resident and
-- Top Admin policies and intentionally do not grant delete access.

DROP POLICY IF EXISTS "permission_units_select" ON public.units;
CREATE POLICY "permission_units_select" ON public.units FOR SELECT TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'property', 'view'));
DROP POLICY IF EXISTS "permission_units_insert" ON public.units;
CREATE POLICY "permission_units_insert" ON public.units FOR INSERT TO authenticated
  WITH CHECK (public.has_effective_permission(auth.uid(), 'property', 'create'));
DROP POLICY IF EXISTS "permission_units_update" ON public.units;
CREATE POLICY "permission_units_update" ON public.units FOR UPDATE TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'property', 'edit'))
  WITH CHECK (public.has_effective_permission(auth.uid(), 'property', 'edit'));

DROP POLICY IF EXISTS "permission_residents_select" ON public.residents;
CREATE POLICY "permission_residents_select" ON public.residents FOR SELECT TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'property', 'view'));
DROP POLICY IF EXISTS "permission_residents_insert" ON public.residents;
CREATE POLICY "permission_residents_insert" ON public.residents FOR INSERT TO authenticated
  WITH CHECK (public.has_effective_permission(auth.uid(), 'property', 'create'));
DROP POLICY IF EXISTS "permission_residents_update" ON public.residents;
CREATE POLICY "permission_residents_update" ON public.residents FOR UPDATE TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'property', 'edit'))
  WITH CHECK (public.has_effective_permission(auth.uid(), 'property', 'edit'));

DROP POLICY IF EXISTS "permission_amenities_select" ON public.amenities;
CREATE POLICY "permission_amenities_select" ON public.amenities FOR SELECT TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'property', 'view'));
DROP POLICY IF EXISTS "permission_amenities_insert" ON public.amenities;
CREATE POLICY "permission_amenities_insert" ON public.amenities FOR INSERT TO authenticated
  WITH CHECK (public.has_effective_permission(auth.uid(), 'property', 'create'));
DROP POLICY IF EXISTS "permission_amenities_update" ON public.amenities;
CREATE POLICY "permission_amenities_update" ON public.amenities FOR UPDATE TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'property', 'edit'))
  WITH CHECK (public.has_effective_permission(auth.uid(), 'property', 'edit'));

DROP POLICY IF EXISTS "permission_maintenance_select" ON public.maintenance_requests;
CREATE POLICY "permission_maintenance_select" ON public.maintenance_requests FOR SELECT TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'operations', 'view'));
DROP POLICY IF EXISTS "permission_maintenance_insert" ON public.maintenance_requests;
CREATE POLICY "permission_maintenance_insert" ON public.maintenance_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_effective_permission(auth.uid(), 'operations', 'create'));
DROP POLICY IF EXISTS "permission_maintenance_update" ON public.maintenance_requests;
CREATE POLICY "permission_maintenance_update" ON public.maintenance_requests FOR UPDATE TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'operations', 'edit'))
  WITH CHECK (public.has_effective_permission(auth.uid(), 'operations', 'edit'));

DROP POLICY IF EXISTS "permission_visitors_select" ON public.visitors;
CREATE POLICY "permission_visitors_select" ON public.visitors FOR SELECT TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'operations', 'view'));
DROP POLICY IF EXISTS "permission_visitors_insert" ON public.visitors;
CREATE POLICY "permission_visitors_insert" ON public.visitors FOR INSERT TO authenticated
  WITH CHECK (public.has_effective_permission(auth.uid(), 'operations', 'create'));
DROP POLICY IF EXISTS "permission_visitors_update" ON public.visitors;
CREATE POLICY "permission_visitors_update" ON public.visitors FOR UPDATE TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'operations', 'edit'))
  WITH CHECK (public.has_effective_permission(auth.uid(), 'operations', 'edit'));

DROP POLICY IF EXISTS "permission_notices_select" ON public.notices;
CREATE POLICY "permission_notices_select" ON public.notices FOR SELECT TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'communication', 'view'));
DROP POLICY IF EXISTS "permission_notices_insert" ON public.notices;
CREATE POLICY "permission_notices_insert" ON public.notices FOR INSERT TO authenticated
  WITH CHECK (public.has_effective_permission(auth.uid(), 'communication', 'create'));
DROP POLICY IF EXISTS "permission_notices_update" ON public.notices;
CREATE POLICY "permission_notices_update" ON public.notices FOR UPDATE TO authenticated
  USING (public.has_effective_permission(auth.uid(), 'communication', 'edit'))
  WITH CHECK (public.has_effective_permission(auth.uid(), 'communication', 'edit'));
