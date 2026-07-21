-- Pendiente #5 (memoria): reference_type 'honorario_pago_manual' existía como
-- póliza de PRUEBA capturada a mano (sin trigger, sin tabla propia) porque no
-- había flujo real para pagar un honorario devengado. La regla contable
-- 'honorario_pago' (205.01 Honorarios por pagar → 102 Bancos) ya existía desde
-- 20260719200000 pero nada la disparaba. Se construye aquí: tabla de pagos +
-- RPC de saldo por doctor + RPC de registro de pago, mismo patrón que
-- registrar_activo_fijo (payload jsonb, membership check, crear_poliza vía
-- contab_generar_poliza_evento).

CREATE TABLE public.honorario_pagos_manual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id),
  monto_centavos bigint NOT NULL CHECK (monto_centavos > 0),
  fecha date NOT NULL DEFAULT current_date,
  concepto text,
  poliza_id uuid REFERENCES public.polizas(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.honorario_pagos_manual ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "honorario_pagos_manual_select_member" ON public.honorario_pagos_manual;
CREATE POLICY "honorario_pagos_manual_select_member" ON public.honorario_pagos_manual
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = honorario_pagos_manual.clinic_id
  ));
-- Sin policy de INSERT/UPDATE/DELETE: escritura solo vía honorario_registrar_pago()
-- (SECURITY DEFINER), igual que el resto de tablas append-only del módulo contable.

-- Saldo por doctor: devengado (honorario_appointment, neto de cancelaciones) menos
-- pagado (esta tabla). Solo doctores con movimiento en alguno de los dos lados.
CREATE OR REPLACE FUNCTION public.honorarios_saldo_por_doctor(p_clinic_id uuid)
RETURNS TABLE (
  doctor_id uuid,
  doctor_nombre text,
  devengado_centavos bigint,
  pagado_centavos bigint,
  saldo_centavos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = p_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH devengado AS (
    SELECT a.doctor_id AS did, SUM(mc.monto_centavos) AS total
    FROM public.movimientos_contables mc
    JOIN public.appointments a ON a.id = mc.reference_id
    WHERE mc.clinic_id = p_clinic_id AND mc.reference_type = 'honorario_appointment'
    GROUP BY a.doctor_id
  ),
  pagado AS (
    SELECT hp.doctor_id AS did, SUM(hp.monto_centavos) AS total
    FROM public.honorario_pagos_manual hp
    WHERE hp.clinic_id = p_clinic_id
    GROUP BY hp.doctor_id
  )
  SELECT
    d.id,
    trim(d.nombre || ' ' || COALESCE(d.apellidos, '')),
    COALESCE(dev.total, 0)::bigint,
    COALESCE(pag.total, 0)::bigint,
    (COALESCE(dev.total, 0) - COALESCE(pag.total, 0))::bigint
  FROM public.doctors d
  LEFT JOIN devengado dev ON dev.did = d.id
  LEFT JOIN pagado pag ON pag.did = d.id
  WHERE d.clinic_id = p_clinic_id AND (dev.total IS NOT NULL OR pag.total IS NOT NULL)
  ORDER BY (COALESCE(dev.total, 0) - COALESCE(pag.total, 0)) DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.honorarios_saldo_por_doctor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.honorarios_saldo_por_doctor(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.honorario_registrar_pago(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_clinic_id uuid := (p_payload->>'clinic_id')::uuid;
  v_doctor_id uuid := (p_payload->>'doctor_id')::uuid;
  v_monto_centavos bigint := (p_payload->>'monto_centavos')::bigint;
  v_concepto text := COALESCE(p_payload->>'concepto', 'Pago de honorarios');
  v_devengado bigint;
  v_pagado bigint;
  v_saldo bigint;
  v_pago_id uuid;
  v_poliza_id uuid;
BEGIN
  IF v_clinic_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_doctor_id IS NULL OR v_monto_centavos IS NULL OR v_monto_centavos <= 0 THEN
    RAISE EXCEPTION 'datos_invalidos_pago_honorario';
  END IF;

  SELECT COALESCE(SUM(mc.monto_centavos), 0) INTO v_devengado
  FROM public.movimientos_contables mc
  JOIN public.appointments a ON a.id = mc.reference_id
  WHERE mc.clinic_id = v_clinic_id AND mc.reference_type = 'honorario_appointment' AND a.doctor_id = v_doctor_id;

  SELECT COALESCE(SUM(hp.monto_centavos), 0) INTO v_pagado
  FROM public.honorario_pagos_manual hp
  WHERE hp.clinic_id = v_clinic_id AND hp.doctor_id = v_doctor_id;

  v_saldo := v_devengado - v_pagado;

  IF v_monto_centavos > v_saldo THEN
    RAISE EXCEPTION 'excede_saldo_pendiente: saldo_centavos=%', v_saldo;
  END IF;

  INSERT INTO public.honorario_pagos_manual (clinic_id, doctor_id, monto_centavos, concepto, created_by)
  VALUES (v_clinic_id, v_doctor_id, v_monto_centavos, v_concepto, auth.uid())
  RETURNING id INTO v_pago_id;

  v_poliza_id := public.contab_generar_poliza_evento(
    v_clinic_id, 'honorario_pago', v_monto_centavos, current_date, v_concepto,
    'honorario_pago_manual', v_pago_id, 'registro', 'diario'
  );

  UPDATE public.honorario_pagos_manual SET poliza_id = v_poliza_id WHERE id = v_pago_id;

  RETURN v_pago_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.honorario_registrar_pago(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.honorario_registrar_pago(jsonb) TO authenticated;
