
-- =========================================================
-- FASE 2: Datos fiscales del doctor + emisor CFDI
-- =========================================================
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS rfc text,
  ADD COLUMN IF NOT EXISTS razon_social text,
  ADD COLUMN IF NOT EXISTS regimen_fiscal_sat text,
  ADD COLUMN IF NOT EXISTS codigo_postal_fiscal text,
  ADD COLUMN IF NOT EXISTS emite_cfdi_propio boolean NOT NULL DEFAULT false;

ALTER TABLE public.doctors
  DROP CONSTRAINT IF EXISTS doctors_rfc_format;
ALTER TABLE public.doctors
  ADD CONSTRAINT doctors_rfc_format
  CHECK (rfc IS NULL OR rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$');

ALTER TABLE public.doctors
  DROP CONSTRAINT IF EXISTS doctors_cp_fiscal_format;
ALTER TABLE public.doctors
  ADD CONSTRAINT doctors_cp_fiscal_format
  CHECK (codigo_postal_fiscal IS NULL OR codigo_postal_fiscal ~ '^[0-9]{5}$');

COMMENT ON COLUMN public.doctors.emite_cfdi_propio IS
  'Si TRUE, el doctor factura honorarios bajo su propio RFC (persona física). Si FALSE, la clínica factura por él.';

-- Selector de emisor CFDI por cita (honorarios) — default doctor por regla de negocio (100% honorario al doctor)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cfdi_emisor text NOT NULL DEFAULT 'doctor';
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_cfdi_emisor_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_cfdi_emisor_check
  CHECK (cfdi_emisor IN ('doctor','clinic'));

-- Atribución de venta de farmacia al doctor recetante (para reporte de ganancias)
ALTER TABLE public.pharmacy_sales
  ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cfdi_emisor text NOT NULL DEFAULT 'clinic';
ALTER TABLE public.pharmacy_sales
  DROP CONSTRAINT IF EXISTS pharmacy_sales_cfdi_emisor_check;
ALTER TABLE public.pharmacy_sales
  ADD CONSTRAINT pharmacy_sales_cfdi_emisor_check
  CHECK (cfdi_emisor IN ('doctor','clinic'));

-- Backfill doctor_id en pharmacy_sales existentes desde la receta
UPDATE public.pharmacy_sales ps
   SET doctor_id = p.doctor_id
  FROM public.prescriptions p
 WHERE ps.doctor_id IS NULL
   AND ps.prescription_id = p.id;

CREATE INDEX IF NOT EXISTS idx_pharmacy_sales_doctor_id ON public.pharmacy_sales(doctor_id);

-- =========================================================
-- FASE 1: Vista de ganancias por doctor (honorarios + ventas atribuidas)
-- security_invoker=on para respetar RLS del usuario que consulta
-- =========================================================
DROP VIEW IF EXISTS public.doctor_earnings_by_period;
CREATE VIEW public.doctor_earnings_by_period
WITH (security_invoker = on) AS
WITH honorarios AS (
  SELECT
    a.doctor_id,
    a.clinic_id,
    date_trunc('month', a.fecha_inicio AT TIME ZONE 'America/Mexico_City')::date AS periodo,
    COUNT(*)::int AS consultas,
    COALESCE(SUM(s.precio_centavos), 0)::bigint AS honorarios_centavos
  FROM public.appointments a
  LEFT JOIN public.servicios s ON s.id = a.servicio_id
  WHERE a.status NOT IN ('cancelada','liberada','solicitada','tentativa')
    AND a.fecha_fin < now()
    AND a.doctor_id IS NOT NULL
  GROUP BY a.doctor_id, a.clinic_id, periodo
),
ventas AS (
  SELECT
    ps.doctor_id,
    ps.clinic_id,
    date_trunc('month', ps.created_at AT TIME ZONE 'America/Mexico_City')::date AS periodo,
    COUNT(*)::int AS ventas_cnt,
    COALESCE(SUM(ROUND(ps.total * 100)), 0)::bigint AS ventas_atribuidas_centavos
  FROM public.pharmacy_sales ps
  WHERE ps.status <> 'cancelled'
    AND ps.doctor_id IS NOT NULL
  GROUP BY ps.doctor_id, ps.clinic_id, periodo
)
SELECT
  d.id AS doctor_id,
  d.nombre || ' ' || COALESCE(d.apellidos,'') AS doctor_nombre,
  COALESCE(h.clinic_id, v.clinic_id) AS clinic_id,
  COALESCE(h.periodo, v.periodo) AS periodo,
  COALESCE(h.consultas, 0) AS consultas,
  COALESCE(h.honorarios_centavos, 0) AS honorarios_centavos,
  COALESCE(v.ventas_cnt, 0) AS ventas_atribuidas,
  COALESCE(v.ventas_atribuidas_centavos, 0) AS ventas_atribuidas_centavos,
  (COALESCE(h.honorarios_centavos, 0) + COALESCE(v.ventas_atribuidas_centavos, 0))::bigint AS total_centavos
FROM public.doctors d
LEFT JOIN honorarios h ON h.doctor_id = d.id
FULL JOIN ventas v ON v.doctor_id = d.id AND v.periodo = h.periodo AND v.clinic_id = h.clinic_id
WHERE COALESCE(h.periodo, v.periodo) IS NOT NULL;

GRANT SELECT ON public.doctor_earnings_by_period TO authenticated;
GRANT SELECT ON public.doctor_earnings_by_period TO service_role;

COMMENT ON VIEW public.doctor_earnings_by_period IS
  'Ganancias mensuales por doctor: honorarios de consultas atendidas + ventas de farmacia atribuidas por receta. Se respeta RLS de las tablas subyacentes (security_invoker).';
