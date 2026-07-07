-- Fase A follow-up (whole-branch review finding 1): suspender una clinica
-- (clinics.status <> 'active') debia bloquear TODO el acceso operativo, pero
-- solo lo hacia para las tablas que ya enrutaban por user_has_clinic_access/
-- user_has_clinic_role. Estas tablas checaban clinic_memberships directo o un
-- rol global, sin pasar por clinics.status. Se extiende aqui el mismo patron
-- RESTRICTIVE ya usado en 20260530033746 (lotes_medicamento,
-- movimientos_inventario, pharmacy_sales) al resto de las tablas clinicas.
--
-- Una policy RESTRICTIVE se combina con AND sobre todas las policies
-- permisivas existentes de la tabla, sin necesidad de reescribirlas: basta con
-- que la tabla tenga columna clinic_id (confirmado NOT NULL o sin filas NULL
-- en produccion para las 16 tablas de abajo).

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'patients','prescriptions','prescription_items','patient_studies',
    'expediente_permissions','almacen_alertas',
    'loyalty_config','loyalty_members','loyalty_planes','loyalty_movimientos',
    'loyalty_planes_progreso','loyalty_campanas',
    'recepciones_mercancia','facturas_proveedor','solicitudes_compra','ordenes_compra'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS multiclinic_access_restrictive ON public.%I', v_table
    );
    EXECUTE format(
      'CREATE POLICY multiclinic_access_restrictive ON public.%I
         AS RESTRICTIVE FOR ALL TO authenticated
         USING (public.user_has_clinic_access(auth.uid(), clinic_id))
         WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id))',
      v_table
    );
  END LOOP;
END $$;

-- Storage: bucket estudios-resultados (patient_studies) tenia el mismo hueco
-- (chequeaba clinic_memberships directo en el path del archivo, sin status).
DROP POLICY IF EXISTS "multiclinic_access_restrictive estudios" ON storage.objects;
CREATE POLICY "multiclinic_access_restrictive estudios"
ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (
  bucket_id <> 'estudios-resultados'
  OR public.user_has_clinic_access(auth.uid(), (storage.foldername(name))[1]::uuid)
)
WITH CHECK (
  bucket_id <> 'estudios-resultados'
  OR public.user_has_clinic_access(auth.uid(), (storage.foldername(name))[1]::uuid)
);
