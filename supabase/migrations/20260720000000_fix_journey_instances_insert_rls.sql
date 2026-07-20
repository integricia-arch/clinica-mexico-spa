-- Fix: journey_instances_clinic_scoped (FOR ALL, USING/WITH CHECK vía
-- user_can_access_journey_instance(id)) se auto-referencia -- busca su
-- propia fila por id dentro de journey_instances. Funciona para
-- UPDATE/DELETE de filas ya existentes, pero rompe:
--   1. INSERT (WITH CHECK evalúa contra una fila que aún no existe)
--   2. El RETURNING que supabase-js siempre agrega tras .insert().select()
--      (evalúa el USING de SELECT contra la fila recién insertada, mismo
--      self-lookup roto -- ni journey_instances ni journey_instance_steps
--      podían crearse desde la UI, "Iniciar camino" fallaba con
--      "new row violates row-level security policy" para TODO usuario,
--      incluido admin). Hallazgo real vía prueba end-to-end reserva->salida.
--
-- Fix: función separada que valida acceso por patient_id (columna que sí
-- viene en la fila nueva, sin necesidad de auto-referenciar la tabla) y la
-- policy principal reescrita para usarla en vez del self-lookup.

CREATE OR REPLACE FUNCTION public.user_can_access_patient_clinic(_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = _patient_id
      AND (
        EXISTS (
          SELECT 1 FROM clinic_memberships cm
          WHERE cm.user_id = auth.uid() AND cm.clinic_id = p.clinic_id AND cm.status = 'active'
        )
        OR public.is_global_admin(auth.uid())
      )
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.user_can_access_patient_clinic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_patient_clinic(uuid) TO authenticated;

DROP POLICY IF EXISTS "journey_instances_insert" ON public.journey_instances;
DROP POLICY IF EXISTS "journey_instances_clinic_scoped" ON public.journey_instances;
CREATE POLICY "journey_instances_clinic_scoped" ON public.journey_instances
  FOR ALL TO authenticated
  USING (public.user_can_access_patient_clinic(patient_id))
  WITH CHECK (public.user_can_access_patient_clinic(patient_id));
