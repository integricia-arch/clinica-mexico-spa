-- Módulo Contable — Fase 2: honorarios por paciente/doctor/día.
-- Plan: docs/superpowers/plans/2026-07-18-modulo-contable.md
--
-- doctor_honorarios_config es HISTÓRICO append-only (vigencias): cambiar el
-- esquema de honorarios = INSERT con nueva vigente_desde, nunca UPDATE/DELETE
-- (sin policies de UPDATE/DELETE ⇒ negado para clientes).
-- Sin config vigente, el honorario es 100% del precio del servicio — la regla
-- de negocio actual que ya asume doctor_earnings_by_period.

CREATE TABLE IF NOT EXISTS public.doctor_honorarios_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  tipo text NOT NULL CHECK (tipo IN ('porcentaje', 'fijo_por_consulta')),
  -- porcentaje: 0 < valor <= 100 (sobre precio del servicio).
  -- fijo_por_consulta: valor en centavos, entero > 0.
  valor numeric(12,2) NOT NULL,
  vigente_desde date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  CONSTRAINT doctor_honorarios_valor_valido CHECK (
    (tipo = 'porcentaje' AND valor > 0 AND valor <= 100)
    OR (tipo = 'fijo_por_consulta' AND valor > 0 AND valor = trunc(valor))
  ),
  CONSTRAINT doctor_honorarios_config_unica UNIQUE (doctor_id, clinic_id, vigente_desde)
);

CREATE INDEX IF NOT EXISTS idx_doctor_honorarios_config_lookup
  ON public.doctor_honorarios_config (doctor_id, clinic_id, vigente_desde DESC);

ALTER TABLE public.doctor_honorarios_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read honorarios config" ON public.doctor_honorarios_config;
CREATE POLICY "Members read honorarios config"
  ON public.doctor_honorarios_config FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = doctor_honorarios_config.clinic_id
    )
  );

DROP POLICY IF EXISTS "Admins insert honorarios config" ON public.doctor_honorarios_config;
CREATE POLICY "Admins insert honorarios config"
  ON public.doctor_honorarios_config FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    AND EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = doctor_honorarios_config.clinic_id
    )
  );

-- Detalle a grano cita. Agregable por paciente, doctor o día.
-- Mismos filtros de cita que doctor_earnings_by_period para que las sumas cuadren.
DROP VIEW IF EXISTS public.doctor_honorarios_detalle;
CREATE VIEW public.doctor_honorarios_detalle
WITH (security_invoker = on) AS
SELECT
  a.id AS appointment_id,
  a.doctor_id,
  a.patient_id,
  a.clinic_id,
  (a.fecha_inicio AT TIME ZONE 'America/Mexico_City')::date AS fecha,
  a.servicio_id,
  COALESCE(s.precio_centavos, 0)::bigint AS precio_servicio_centavos,
  cfg.tipo AS config_tipo,
  cfg.valor AS config_valor,
  cfg.vigente_desde AS config_vigente_desde,
  CASE
    WHEN cfg.tipo = 'porcentaje'
      THEN ROUND(COALESCE(s.precio_centavos, 0) * cfg.valor / 100)::bigint
    WHEN cfg.tipo = 'fijo_por_consulta'
      THEN cfg.valor::bigint
    ELSE COALESCE(s.precio_centavos, 0)::bigint -- sin config: 100% (regla actual)
  END AS honorario_centavos
FROM public.appointments a
LEFT JOIN public.servicios s ON s.id = a.servicio_id
LEFT JOIN LATERAL (
  SELECT c.tipo, c.valor, c.vigente_desde
  FROM public.doctor_honorarios_config c
  WHERE c.doctor_id = a.doctor_id
    AND c.clinic_id = a.clinic_id
    AND c.vigente_desde <= (a.fecha_inicio AT TIME ZONE 'America/Mexico_City')::date
  ORDER BY c.vigente_desde DESC
  LIMIT 1
) cfg ON true
WHERE a.status NOT IN ('cancelada','liberada','solicitada','tentativa')
  AND a.fecha_fin < now()
  AND a.doctor_id IS NOT NULL;

GRANT SELECT ON public.doctor_honorarios_detalle TO authenticated;
GRANT SELECT ON public.doctor_honorarios_detalle TO service_role;

COMMENT ON VIEW public.doctor_honorarios_detalle IS
  'Honorario por cita atendida usando la config vigente a la fecha de la cita (histórico con vigencias). Sin config: 100% del precio del servicio. Agregable por paciente/doctor/día. RLS de tablas subyacentes (security_invoker).';
