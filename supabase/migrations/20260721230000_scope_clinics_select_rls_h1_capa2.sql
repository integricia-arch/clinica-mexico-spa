-- H1 capa 2 (S4 pen-test onboarding tenants, 2026-07-21)
-- La policy SELECT de `clinics` era USING(true) para rol authenticated, filtrando
-- PII/billing (verification_code, pending_admin_email, pending_modulo_ids, rfc,
-- contacto_facturacion_email, stripe_*) de TODAS las clínicas a cualquier usuario
-- autenticado (doctor, enfermera, recepción, paciente PWA). Antipatrón que CLAUDE.md
-- prohíbe. Scoping por membership + platform staff (is_global_admin es SECURITY
-- DEFINER con search_path=public → sin recursión RLS).
--
-- Verificado antes de aplicar: los 4 reads del front van scoped por membership
-- (useActiveClinic join embebido, useClinicGeneral por clinicId activo) o gated a
-- isGlobalAdmin (AdminTenants, fallback default). getActiveClinicId (fallback a
-- clínica default sin membership) es código muerto — sin callers en src.
--
-- Idempotente: drop de ambos nombres (viejo + nuevo).
DROP POLICY IF EXISTS "Authenticated users can read clinics" ON public.clinics;
DROP POLICY IF EXISTS "Members and global admins can read clinics" ON public.clinics;

CREATE POLICY "Members and global admins can read clinics"
  ON public.clinics
  FOR SELECT
  TO authenticated
  USING (
    public.is_global_admin((select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.clinic_memberships m
      WHERE m.clinic_id = clinics.id
        AND m.user_id = (select auth.uid())
    )
  );
