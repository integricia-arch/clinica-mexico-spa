-- Catálogos contables — permitir a admin mantener cuentas_contables (INSERT/UPDATE).
-- Catálogo global (sin clinic_id): no hay DELETE, se desactiva vía columna `activo`
-- para no romper movimientos_contables.cuenta_id (FK) que ya referencian filas viejas.

DROP POLICY IF EXISTS "Admins insert cuentas contables" ON public.cuentas_contables;
CREATE POLICY "Admins insert cuentas contables"
  ON public.cuentas_contables FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update cuentas contables" ON public.cuentas_contables;
CREATE POLICY "Admins update cuentas contables"
  ON public.cuentas_contables FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
