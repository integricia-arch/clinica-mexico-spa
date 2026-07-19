-- Módulo Contable — Fase 6B: motor de asientos automáticos.
-- Plan: docs/superpowers/plans/2026-07-19-fase6-partida-doble.md (§6B)
--       docs/superpowers/plans/2026-07-19-modulo-contable-completo.md (§5 mapa integración)
-- Depende de: 20260718170000 (triggers Fase 3), 20260719110000 (crear_poliza/cancelar_poliza,
--             catálogo numérico con códigos SAT).
--
-- Diseño: tabla contab_reglas_asiento (evento → cuenta cargo/abono, override por clínica)
-- en vez de cuentas hard-codeadas en los triggers (mejora aprobada sobre el plan original,
-- ver §4 del plan maestro). Fallas de regla NUNCA abortan la operación de negocio — se
-- encolan en contab_asientos_pendientes para reproceso posterior.

-- ---------------------------------------------------------------------------
-- 1. contab_reglas_asiento — mapeo evento → cuenta cargo/abono.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contab_reglas_asiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id), -- NULL = regla global (default)
  evento text NOT NULL,
  -- Nullable: 'egreso_manual' resuelve el cargo dinámicamente desde el movimiento
  -- (la cuenta que el cajero/admin eligió al capturar), no desde la regla.
  cuenta_cargo_id uuid REFERENCES public.cuentas_contables(id),
  cuenta_abono_id uuid REFERENCES public.cuentas_contables(id),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- "evento UNIQUE por clínica": una fila global (clinic_id NULL) y a lo más una
-- fila de override por clínica, cada una por evento.
CREATE UNIQUE INDEX IF NOT EXISTS uq_contab_reglas_global
  ON public.contab_reglas_asiento (evento) WHERE clinic_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contab_reglas_clinic
  ON public.contab_reglas_asiento (clinic_id, evento) WHERE clinic_id IS NOT NULL;

ALTER TABLE public.contab_reglas_asiento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read contab_reglas_asiento" ON public.contab_reglas_asiento;
-- Reglas globales (clinic_id NULL) son config no sensible, visibles a cualquier
-- autenticado (mismo criterio que cuentas_contables en Fase 3); las de override
-- por clínica solo a sus miembros.
CREATE POLICY "Members read contab_reglas_asiento"
  ON public.contab_reglas_asiento FOR SELECT TO authenticated
  USING (
    clinic_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = contab_reglas_asiento.clinic_id
    )
  );

DROP POLICY IF EXISTS "Admins write contab_reglas_asiento" ON public.contab_reglas_asiento;
CREATE POLICY "Admins write contab_reglas_asiento"
  ON public.contab_reglas_asiento FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (
      clinic_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.clinic_memberships
        WHERE user_id = auth.uid() AND clinic_id = contab_reglas_asiento.clinic_id
      )
    )
  );

DROP POLICY IF EXISTS "Admins update contab_reglas_asiento" ON public.contab_reglas_asiento;
CREATE POLICY "Admins update contab_reglas_asiento"
  ON public.contab_reglas_asiento FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (
      clinic_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.clinic_memberships
        WHERE user_id = auth.uid() AND clinic_id = contab_reglas_asiento.clinic_id
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (
      clinic_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.clinic_memberships
        WHERE user_id = auth.uid() AND clinic_id = contab_reglas_asiento.clinic_id
      )
    )
  );
-- Sin policy de DELETE (regla del plan): desactivar = activo = false.

-- Seed de reglas globales, usando los códigos numéricos sembrados en 6A.
INSERT INTO public.contab_reglas_asiento (clinic_id, evento, cuenta_cargo_id, cuenta_abono_id)
SELECT NULL, v.evento,
       (SELECT id FROM public.cuentas_contables WHERE codigo = v.cargo),
       (SELECT id FROM public.cuentas_contables WHERE codigo = v.abono)
FROM (VALUES
  ('cobro_caja_consulta',        '101',   '401'),
  ('cobro_caja_otros',           '101',   '403'),
  ('venta_farmacia',             '101',   '402'),
  ('factura_proveedor_subtotal', '115',   '201'),
  ('factura_proveedor_iva',      '118',   '201'),
  ('pago_factura',               '201',   '102'),
  ('honorario_devengo',          '601',   '205.01'),
  ('consumo_insumo',             '501',   '115.01'),
  ('egreso_manual',              NULL,    '101')
) AS v(evento, cargo, abono)
ON CONFLICT (evento) WHERE clinic_id IS NULL DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. contab_asientos_pendientes — cola de reproceso cuando falla la regla.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contab_asientos_pendientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  evento text NOT NULL,
  reference_type text,
  reference_id uuid,
  monto_centavos bigint,
  fecha date,
  concepto text,
  evento_poliza text NOT NULL DEFAULT 'registro' CHECK (evento_poliza IN ('registro', 'cancelacion')),
  tipo_poliza text,
  -- Datos extra para eventos que no caben en el helper genérico de 2 partidas
  -- (factura proveedor: subtotal/iva/total; egreso manual: resuelto en reproceso
  -- por reference_id porque el cargo es dinámico).
  partidas_extra jsonb,
  error text NOT NULL,
  resuelto_at timestamptz,
  resuelto_poliza_id uuid REFERENCES public.polizas(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contab_pendientes_ref
  ON public.contab_asientos_pendientes (reference_type, reference_id, evento_poliza)
  WHERE reference_id IS NOT NULL AND resuelto_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contab_pendientes_abiertas
  ON public.contab_asientos_pendientes (clinic_id) WHERE resuelto_at IS NULL;

ALTER TABLE public.contab_asientos_pendientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read contab_asientos_pendientes" ON public.contab_asientos_pendientes;
CREATE POLICY "Members read contab_asientos_pendientes"
  ON public.contab_asientos_pendientes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = contab_asientos_pendientes.clinic_id
    )
  );
-- Sin policies de escritura: solo triggers/RPCs SECURITY DEFINER (service_role).

-- ---------------------------------------------------------------------------
-- 3. contab_resolver_regla — regla de clínica si existe, si no la global.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_resolver_regla(p_clinic_id uuid, p_evento text)
RETURNS TABLE (cuenta_cargo_id uuid, cuenta_abono_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.cuenta_cargo_id, r.cuenta_abono_id
  FROM public.contab_reglas_asiento r
  WHERE r.evento = p_evento AND r.activo
    AND (r.clinic_id = p_clinic_id OR r.clinic_id IS NULL)
  ORDER BY r.clinic_id NULLS LAST
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.contab_resolver_regla(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contab_resolver_regla(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. contab_encolar_pendiente — helper para loguear fallas sin abortar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_encolar_pendiente(
  p_clinic_id uuid, p_evento text, p_reference_type text, p_reference_id uuid,
  p_monto_centavos bigint, p_fecha date, p_concepto text,
  p_evento_poliza text, p_tipo_poliza text, p_partidas_extra jsonb, p_error text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.contab_asientos_pendientes
    (clinic_id, evento, reference_type, reference_id, monto_centavos, fecha, concepto,
     evento_poliza, tipo_poliza, partidas_extra, error)
  VALUES
    (p_clinic_id, p_evento, p_reference_type, p_reference_id, p_monto_centavos, p_fecha, p_concepto,
     p_evento_poliza, p_tipo_poliza, p_partidas_extra, p_error)
  ON CONFLICT (reference_type, reference_id, evento_poliza) WHERE reference_id IS NOT NULL AND resuelto_at IS NULL
  DO UPDATE SET error = EXCLUDED.error, created_at = now();
EXCEPTION WHEN OTHERS THEN
  -- Ni siquiera loguear una falla debe poder tumbar la operación de negocio.
  NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_encolar_pendiente(uuid, text, text, uuid, bigint, date, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contab_encolar_pendiente(uuid, text, text, uuid, bigint, date, text, text, text, jsonb, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. contab_generar_poliza_evento — helper 2 partidas genérico (evento → regla).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_generar_poliza_evento(
  p_clinic_id uuid,
  p_evento text,
  p_monto_centavos bigint,
  p_fecha date,
  p_concepto text,
  p_reference_type text,
  p_reference_id uuid,
  p_evento_poliza text DEFAULT 'registro',
  p_tipo_poliza text DEFAULT 'diario',
  p_uuid_cfdi uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_regla record;
  v_payload jsonb;
BEGIN
  IF p_monto_centavos IS NULL OR p_monto_centavos <= 0 THEN
    RAISE EXCEPTION 'monto_invalido_para_poliza: %', p_monto_centavos;
  END IF;

  SELECT * INTO v_regla FROM public.contab_resolver_regla(p_clinic_id, p_evento);
  IF v_regla.cuenta_cargo_id IS NULL OR v_regla.cuenta_abono_id IS NULL THEN
    RAISE EXCEPTION 'regla_no_encontrada: %', p_evento;
  END IF;

  v_payload := jsonb_build_object(
    'clinic_id', p_clinic_id,
    'tipo', p_tipo_poliza,
    'fecha', p_fecha,
    'concepto', p_concepto,
    'uuid_cfdi', p_uuid_cfdi,
    'reference_type', p_reference_type,
    'reference_id', p_reference_id,
    'evento', p_evento_poliza,
    'partidas', jsonb_build_array(
      jsonb_build_object('cuenta_id', v_regla.cuenta_cargo_id, 'debe_centavos', p_monto_centavos, 'haber_centavos', 0, 'descripcion', p_concepto),
      jsonb_build_object('cuenta_id', v_regla.cuenta_abono_id, 'debe_centavos', 0, 'haber_centavos', p_monto_centavos, 'descripcion', p_concepto)
    )
  );

  RETURN public.crear_poliza(v_payload);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_generar_poliza_evento(uuid, text, bigint, date, text, text, uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contab_generar_poliza_evento(uuid, text, bigint, date, text, text, uuid, text, text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Extender crear_poliza: permitir llamadas service_role/cron sin auth.uid().
--    auth.uid() IS NULL solo ocurre para 'service_role' (EXECUTE ya restringido
--    a authenticated+service_role desde 6A) — mismo nivel de confianza que
--    contab_devengar_honorarios, que ya corre sin sesión de usuario.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_poliza(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clinic_id uuid := (p_payload->>'clinic_id')::uuid;
  v_tipo text := p_payload->>'tipo';
  v_reference_type text := p_payload->>'reference_type';
  v_reference_id uuid := NULLIF(p_payload->>'reference_id', '')::uuid;
  v_evento text := COALESCE(p_payload->>'evento', 'registro');
  v_partidas jsonb := p_payload->'partidas';
  v_partida jsonb;
  v_folio integer;
  v_poliza_id uuid;
  v_suma_debe bigint := 0;
  v_suma_haber bigint := 0;
  v_orden integer := 0;
BEGIN
  -- 1. Membership (checklist SECURITY DEFINER punto 3). auth.uid() IS NULL
  --    implica llamada service_role/cron (triggers/RPCs internos) — ver
  --    comentario arriba; se omite el check de membership en ese caso.
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_tipo NOT IN ('ingreso', 'egreso', 'diario') THEN
    RAISE EXCEPTION 'tipo_poliza_invalido: %', v_tipo;
  END IF;

  IF v_partidas IS NULL OR jsonb_array_length(v_partidas) < 2 THEN
    RAISE EXCEPTION 'poliza_requiere_al_menos_2_partidas';
  END IF;

  -- 2. Idempotencia: si ya existe una póliza con esta referencia+evento,
  --    devolver la existente sin duplicar (mismo patrón que movimientos_contables).
  IF v_reference_type IS NOT NULL AND v_reference_id IS NOT NULL THEN
    SELECT id INTO v_poliza_id FROM public.polizas
    WHERE reference_type = v_reference_type AND reference_id = v_reference_id AND evento = v_evento;
    IF v_poliza_id IS NOT NULL THEN
      RETURN v_poliza_id;
    END IF;
  END IF;

  -- 3. Validar cada partida y acumular sumas ANTES de insertar nada.
  FOR v_partida IN SELECT * FROM jsonb_array_elements(v_partidas)
  LOOP
    DECLARE
      v_debe bigint := COALESCE((v_partida->>'debe_centavos')::bigint, 0);
      v_haber bigint := COALESCE((v_partida->>'haber_centavos')::bigint, 0);
    BEGIN
      IF v_partida->>'cuenta_id' IS NULL THEN
        RAISE EXCEPTION 'partida_sin_cuenta_id';
      END IF;
      IF NOT ((v_debe > 0 AND v_haber = 0) OR (v_haber > 0 AND v_debe = 0)) THEN
        RAISE EXCEPTION 'partida_debe_tener_exactamente_un_lado_positivo';
      END IF;
      v_suma_debe := v_suma_debe + v_debe;
      v_suma_haber := v_suma_haber + v_haber;
    END;
  END LOOP;

  IF v_suma_debe <> v_suma_haber THEN
    RAISE EXCEPTION 'poliza_desbalanceada: debe=% haber=%', v_suma_debe, v_suma_haber;
  END IF;

  -- 4. Folio atómico por clinic_id+tipo (UPSERT = row lock, sin advisory lock manual).
  INSERT INTO public.poliza_folios (clinic_id, tipo, ultimo_folio)
  VALUES (v_clinic_id, v_tipo, 1)
  ON CONFLICT (clinic_id, tipo) DO UPDATE SET ultimo_folio = public.poliza_folios.ultimo_folio + 1
  RETURNING ultimo_folio INTO v_folio;

  -- 5. Insertar cabecera.
  INSERT INTO public.polizas
    (clinic_id, folio, tipo, fecha, concepto, uuid_cfdi, reference_type, reference_id, evento, created_by)
  VALUES
    (v_clinic_id, v_folio, v_tipo,
     COALESCE((p_payload->>'fecha')::date, current_date),
     p_payload->>'concepto',
     NULLIF(p_payload->>'uuid_cfdi', '')::uuid,
     v_reference_type, v_reference_id, v_evento, auth.uid())
  RETURNING id INTO v_poliza_id;

  -- 6. Insertar partidas.
  FOR v_partida IN SELECT * FROM jsonb_array_elements(v_partidas)
  LOOP
    v_orden := v_orden + 1;
    INSERT INTO public.poliza_partidas (poliza_id, orden, cuenta_id, debe_centavos, haber_centavos, descripcion)
    VALUES (
      v_poliza_id, v_orden, (v_partida->>'cuenta_id')::uuid,
      COALESCE((v_partida->>'debe_centavos')::bigint, 0),
      COALESCE((v_partida->>'haber_centavos')::bigint, 0),
      v_partida->>'descripcion'
    );
  END LOOP;

  RETURN v_poliza_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.crear_poliza(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_poliza(jsonb) TO authenticated, service_role;

-- Mismo bypass en cancelar_poliza: los triggers 6B (venta farmacia cancelada,
-- reversa de insumos) la invocan, y en algún escenario de reproceso/cron
-- también podría llamarse sin sesión de usuario.
CREATE OR REPLACE FUNCTION public.cancelar_poliza(p_poliza_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_poliza public.polizas%ROWTYPE;
  v_payload jsonb;
  v_partidas jsonb;
  v_reversa_id uuid;
BEGIN
  SELECT * INTO v_poliza FROM public.polizas WHERE id = p_poliza_id;
  IF v_poliza IS NULL THEN
    RAISE EXCEPTION 'poliza_no_encontrada';
  END IF;

  -- auth.uid() IS NULL implica service_role (ver crear_poliza arriba).
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_poliza.clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_reversa_id FROM public.polizas
  WHERE reference_type = 'poliza_reversa' AND reference_id = p_poliza_id AND evento = 'cancelacion';
  IF v_reversa_id IS NOT NULL THEN
    RETURN v_reversa_id;
  END IF;

  IF v_poliza.estado = 'cancelada' THEN
    RAISE EXCEPTION 'poliza_ya_cancelada_sin_reversa';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'cuenta_id', cuenta_id,
           'debe_centavos', haber_centavos,
           'haber_centavos', debe_centavos,
           'descripcion', COALESCE(descripcion, '') || ' (reversa)'
         ) ORDER BY orden)
  INTO v_partidas
  FROM public.poliza_partidas
  WHERE poliza_id = p_poliza_id;

  v_payload := jsonb_build_object(
    'clinic_id', v_poliza.clinic_id,
    'tipo', v_poliza.tipo,
    'fecha', current_date,
    'concepto', 'Cancelación póliza folio ' || v_poliza.folio || ' — ' || v_poliza.concepto,
    'reference_type', 'poliza_reversa',
    'reference_id', p_poliza_id,
    'evento', 'cancelacion',
    'partidas', v_partidas
  );

  v_reversa_id := public.crear_poliza(v_payload);

  UPDATE public.polizas SET estado = 'cancelada' WHERE id = p_poliza_id;

  RETURN v_reversa_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cancelar_poliza(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_poliza(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Extender trigger de cobro de caja: además del movimiento, genera póliza.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_movimiento_caja()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_evento text;
BEGIN
  IF NEW.estado = 'pagado' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'pagado')
     AND NEW.tipo IN ('cobro', 'ingreso') AND NEW.total > 0 THEN
    v_evento := CASE WHEN NEW.appointment_id IS NOT NULL THEN 'cobro_caja_consulta' ELSE 'cobro_caja_otros' END;

    INSERT INTO public.movimientos_contables
      (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
       evento, reference_type, reference_id, descripcion, created_by)
    VALUES
      (NEW.clinic_id,
       public.cuenta_contable_id(CASE WHEN NEW.appointment_id IS NOT NULL THEN 'ING_CONSULTAS' ELSE 'ING_OTROS' END),
       CASE WHEN NEW.appointment_id IS NOT NULL THEN 'consulta' ELSE 'manual' END,
       ROUND(NEW.total * 100)::bigint,
       (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
       (now() AT TIME ZONE 'America/Mexico_City')::date,
       'devengo', 'movimiento_caja', NEW.id,
       'Cobro caja folio ' || COALESCE(NEW.folio, NEW.id::text),
       NEW.cajero_user_id)
    ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
    DO NOTHING;

    BEGIN
      PERFORM public.contab_generar_poliza_evento(
        NEW.clinic_id, v_evento, ROUND(NEW.total * 100)::bigint,
        (now() AT TIME ZONE 'America/Mexico_City')::date,
        'Cobro caja folio ' || COALESCE(NEW.folio, NEW.id::text),
        'movimiento_caja', NEW.id, 'registro', 'ingreso'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        NEW.clinic_id, v_evento, 'movimiento_caja', NEW.id, ROUND(NEW.total * 100)::bigint,
        (now() AT TIME ZONE 'America/Mexico_City')::date,
        'Cobro caja folio ' || COALESCE(NEW.folio, NEW.id::text),
        'registro', 'ingreso', NULL, SQLERRM
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 8. Extender trigger de venta de farmacia: póliza al vender, cancelar_poliza
--    (reversa correcta cargo/abono) al cancelar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_pharmacy_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_poliza_id uuid;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'cancelled' AND NEW.total > 0 THEN
    INSERT INTO public.movimientos_contables
      (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
       evento, reference_type, reference_id, descripcion, created_by)
    VALUES
      (NEW.clinic_id, public.cuenta_contable_id('ING_FARMACIA'), 'farmacia',
       ROUND(NEW.total * 100)::bigint,
       (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
       (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
       'devengo', 'pharmacy_sale', NEW.id,
       'Venta farmacia', NEW.created_by)
    ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
    DO NOTHING;

    BEGIN
      PERFORM public.contab_generar_poliza_evento(
        NEW.clinic_id, 'venta_farmacia', ROUND(NEW.total * 100)::bigint,
        (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date,
        'Venta farmacia', 'pharmacy_sale', NEW.id, 'registro', 'ingreso'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        NEW.clinic_id, 'venta_farmacia', 'pharmacy_sale', NEW.id, ROUND(NEW.total * 100)::bigint,
        (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date, 'Venta farmacia',
        'registro', 'ingreso', NULL, SQLERRM
      );
    END;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    INSERT INTO public.movimientos_contables
      (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
       evento, reference_type, reference_id, descripcion, created_by)
    SELECT clinic_id, cuenta_id, origen, -monto_centavos,
           (now() AT TIME ZONE 'America/Mexico_City')::date,
           (now() AT TIME ZONE 'America/Mexico_City')::date,
           'cancelacion', reference_type, reference_id,
           'Cancelación venta farmacia', auth.uid()
    FROM public.movimientos_contables
    WHERE reference_type = 'pharmacy_sale' AND reference_id = NEW.id AND evento = 'devengo'
    ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
    DO NOTHING;

    BEGIN
      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type = 'pharmacy_sale' AND reference_id = NEW.id AND evento = 'registro' AND estado = 'contabilizada';
      IF v_poliza_id IS NOT NULL THEN
        PERFORM public.cancelar_poliza(v_poliza_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        NEW.clinic_id, 'venta_farmacia_cancelacion', 'pharmacy_sale', NEW.id, NULL, current_date,
        'Cancelación venta farmacia', 'cancelacion', 'ingreso', NULL, SQLERRM
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 9. Extender trigger de factura de proveedor: póliza con hasta 3 partidas
--    (subtotal Almacén + IVA acreditable / abono Proveedores). Pago → póliza
--    Proveedores/Bancos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_factura_proveedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_regla_sub record;
  v_regla_iva record;
  v_partidas jsonb;
BEGIN
  IF TG_OP = 'INSERT' AND COALESCE(NEW.total_centavos, 0) > 0 THEN
    INSERT INTO public.movimientos_contables
      (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
       evento, reference_type, reference_id, descripcion, created_by)
    VALUES
      (NEW.clinic_id, public.cuenta_contable_id('EGR_COMPRAS'), 'compra',
       NEW.total_centavos,
       COALESCE(NEW.fecha_factura, (NEW.created_at AT TIME ZONE 'America/Mexico_City')::date),
       CASE WHEN COALESCE(NEW.saldo_pendiente_centavos, NEW.total_centavos) = 0
            THEN (now() AT TIME ZONE 'America/Mexico_City')::date END,
       'devengo', 'factura_proveedor', NEW.id,
       'Factura proveedor ' || COALESCE(NEW.folio_interno, NEW.id::text),
       NEW.created_by)
    ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
    DO NOTHING;

    BEGIN
      SELECT * INTO v_regla_sub FROM public.contab_resolver_regla(NEW.clinic_id, 'factura_proveedor_subtotal');
      IF v_regla_sub.cuenta_cargo_id IS NULL THEN
        RAISE EXCEPTION 'regla_no_encontrada: factura_proveedor_subtotal';
      END IF;

      v_partidas := jsonb_build_array(
        jsonb_build_object('cuenta_id', v_regla_sub.cuenta_cargo_id, 'debe_centavos', NEW.subtotal_centavos, 'haber_centavos', 0, 'descripcion', 'Subtotal factura')
      );

      IF COALESCE(NEW.iva_centavos, 0) > 0 THEN
        SELECT * INTO v_regla_iva FROM public.contab_resolver_regla(NEW.clinic_id, 'factura_proveedor_iva');
        IF v_regla_iva.cuenta_cargo_id IS NULL THEN
          RAISE EXCEPTION 'regla_no_encontrada: factura_proveedor_iva';
        END IF;
        v_partidas := v_partidas || jsonb_build_array(
          jsonb_build_object('cuenta_id', v_regla_iva.cuenta_cargo_id, 'debe_centavos', NEW.iva_centavos, 'haber_centavos', 0, 'descripcion', 'IVA acreditable')
        );
      END IF;

      v_partidas := v_partidas || jsonb_build_array(
        jsonb_build_object('cuenta_id', v_regla_sub.cuenta_abono_id, 'debe_centavos', 0, 'haber_centavos', NEW.total_centavos, 'descripcion', 'Proveedores')
      );

      PERFORM public.crear_poliza(jsonb_build_object(
        'clinic_id', NEW.clinic_id, 'tipo', 'diario',
        'fecha', COALESCE(NEW.fecha_factura, current_date),
        'concepto', 'Factura proveedor ' || COALESCE(NEW.folio_interno, NEW.id::text),
        'uuid_cfdi', NULLIF(NEW.uuid_sat, '')::uuid,
        'reference_type', 'factura_proveedor', 'reference_id', NEW.id, 'evento', 'registro',
        'partidas', v_partidas
      ));
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        NEW.clinic_id, 'factura_proveedor', 'factura_proveedor', NEW.id, NEW.total_centavos,
        COALESCE(NEW.fecha_factura, current_date),
        'Factura proveedor ' || COALESCE(NEW.folio_interno, NEW.id::text),
        'registro', 'diario',
        jsonb_build_object('subtotal_centavos', NEW.subtotal_centavos, 'iva_centavos', NEW.iva_centavos,
                            'total_centavos', NEW.total_centavos, 'uuid_cfdi', NEW.uuid_sat),
        SQLERRM
      );
    END;
  ELSIF TG_OP = 'UPDATE'
        AND COALESCE(NEW.saldo_pendiente_centavos, 1) = 0
        AND COALESCE(OLD.saldo_pendiente_centavos, 1) <> 0 THEN
    -- Pago liquidado: fija fecha_pago del devengo (único UPDATE permitido, vía definer).
    UPDATE public.movimientos_contables
    SET fecha_pago = (now() AT TIME ZONE 'America/Mexico_City')::date
    WHERE reference_type = 'factura_proveedor' AND reference_id = NEW.id
      AND evento = 'devengo' AND fecha_pago IS NULL;

    BEGIN
      PERFORM public.contab_generar_poliza_evento(
        NEW.clinic_id, 'pago_factura', NEW.total_centavos,
        (now() AT TIME ZONE 'America/Mexico_City')::date,
        'Pago factura ' || COALESCE(NEW.folio_interno, NEW.id::text),
        'factura_proveedor_pago', NEW.id, 'registro', 'egreso'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        NEW.clinic_id, 'pago_factura', 'factura_proveedor_pago', NEW.id, NEW.total_centavos,
        (now() AT TIME ZONE 'America/Mexico_City')::date,
        'Pago factura ' || COALESCE(NEW.folio_interno, NEW.id::text),
        'registro', 'egreso', NULL, SQLERRM
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Extender cron de honorarios: cada fila devengada nueva genera su póliza.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_devengar_honorarios()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count integer := 0;
  v_row record;
BEGIN
  FOR v_row IN
    WITH ins AS (
      INSERT INTO public.movimientos_contables
        (clinic_id, cuenta_id, origen, monto_centavos, fecha_devengo, fecha_pago,
         evento, reference_type, reference_id, descripcion)
      SELECT d.clinic_id, public.cuenta_contable_id('EGR_HONORARIOS'), 'honorario',
             d.honorario_centavos, d.fecha, NULL,
             'devengo', 'honorario_appointment', d.appointment_id,
             'Honorario médico devengado'
      FROM public.doctor_honorarios_detalle d
      WHERE d.honorario_centavos > 0
        AND d.fecha < (now() AT TIME ZONE 'America/Mexico_City')::date
      ON CONFLICT (reference_type, reference_id, evento) WHERE reference_id IS NOT NULL
      DO NOTHING
      RETURNING clinic_id, reference_id, monto_centavos, fecha_devengo
    )
    SELECT * FROM ins
  LOOP
    v_count := v_count + 1;
    BEGIN
      PERFORM public.contab_generar_poliza_evento(
        v_row.clinic_id, 'honorario_devengo', v_row.monto_centavos, v_row.fecha_devengo,
        'Honorario médico devengado', 'honorario_appointment', v_row.reference_id, 'registro', 'diario'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        v_row.clinic_id, 'honorario_devengo', 'honorario_appointment', v_row.reference_id,
        v_row.monto_centavos, v_row.fecha_devengo, 'Honorario médico devengado',
        'registro', 'diario', NULL, SQLERRM
      );
    END;
  END LOOP;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_devengar_honorarios() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contab_devengar_honorarios() TO service_role;

-- ---------------------------------------------------------------------------
-- 11. Extender registrar_insumos_cita / revertir_insumos_cita (Fase 1) para
--     generar/cancelar su póliza (costo insumos ↔ almacén insumos).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_insumos_cita(
  p_appointment_id uuid,
  p_items jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clinic_id uuid;
  v_item record;
  v_insumo record;
  v_count integer := 0;
  v_ai_id uuid;
  v_monto bigint;
BEGIN
  SELECT clinic_id INTO v_clinic_id
  FROM public.appointments WHERE id = p_appointment_id;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Cita no encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Lista de insumos vacía';
  END IF;

  FOR v_item IN
    SELECT (elem->>'insumo_id')::uuid AS insumo_id,
           (elem->>'cantidad')::integer AS cantidad
    FROM jsonb_array_elements(p_items) elem
  LOOP
    IF v_item.insumo_id IS NULL OR v_item.cantidad IS NULL OR v_item.cantidad <= 0 THEN
      RAISE EXCEPTION 'Insumo o cantidad inválida';
    END IF;

    SELECT * INTO v_insumo FROM public.insumos
    WHERE id = v_item.insumo_id AND clinic_id = v_clinic_id AND activo
    FOR UPDATE;
    IF v_insumo IS NULL THEN
      RAISE EXCEPTION 'Insumo no encontrado o inactivo en esta clínica';
    END IF;
    IF v_insumo.costo_centavos IS NULL OR v_insumo.costo_centavos <= 0 THEN
      RAISE EXCEPTION 'El insumo "%" no tiene costo capturado; captúralo antes de consumir', v_insumo.nombre;
    END IF;
    IF v_insumo.stock < v_item.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente de "%" (disponible: %)', v_insumo.nombre, v_insumo.stock;
    END IF;

    UPDATE public.insumos
    SET stock = stock - v_item.cantidad, updated_at = now()
    WHERE id = v_insumo.id;

    INSERT INTO public.appointment_insumos
      (appointment_id, insumo_id, clinic_id, tipo, cantidad, costo_unitario_centavos, user_id)
    VALUES
      (p_appointment_id, v_item.insumo_id, v_clinic_id, 'consumo',
       v_item.cantidad, v_insumo.costo_centavos, auth.uid())
    RETURNING id INTO v_ai_id;

    v_monto := (v_item.cantidad * v_insumo.costo_centavos)::bigint;
    BEGIN
      PERFORM public.contab_generar_poliza_evento(
        v_clinic_id, 'consumo_insumo', v_monto, current_date,
        'Consumo insumo en cita', 'appointment_insumo', v_ai_id, 'registro', 'diario'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        v_clinic_id, 'consumo_insumo', 'appointment_insumo', v_ai_id, v_monto, current_date,
        'Consumo insumo en cita', 'registro', 'diario', NULL, SQLERRM
      );
    END;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revertir_insumos_cita(p_appointment_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_clinic_id uuid;
  v_row record;
  v_count integer := 0;
  v_poliza_id uuid;
BEGIN
  SELECT clinic_id INTO v_clinic_id
  FROM public.appointments WHERE id = p_appointment_id;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Cita no encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointment_insumos
    WHERE appointment_id = p_appointment_id AND tipo = 'reversa'
  ) THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT id, insumo_id, cantidad, costo_unitario_centavos
    FROM public.appointment_insumos
    WHERE appointment_id = p_appointment_id AND tipo = 'consumo'
  LOOP
    UPDATE public.insumos
    SET stock = stock + v_row.cantidad, updated_at = now()
    WHERE id = v_row.insumo_id;

    INSERT INTO public.appointment_insumos
      (appointment_id, insumo_id, clinic_id, tipo, cantidad, costo_unitario_centavos, user_id)
    VALUES
      (p_appointment_id, v_row.insumo_id, v_clinic_id, 'reversa',
       v_row.cantidad, v_row.costo_unitario_centavos, auth.uid());

    BEGIN
      SELECT id INTO v_poliza_id FROM public.polizas
      WHERE reference_type = 'appointment_insumo' AND reference_id = v_row.id
        AND evento = 'registro' AND estado = 'contabilizada';
      IF v_poliza_id IS NOT NULL THEN
        PERFORM public.cancelar_poliza(v_poliza_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        v_clinic_id, 'consumo_insumo_reversa', 'appointment_insumo', v_row.id,
        (v_row.cantidad * v_row.costo_unitario_centavos)::bigint, current_date,
        'Reversa consumo insumo', 'cancelacion', 'diario', NULL, SQLERRM
      );
    END;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.registrar_insumos_cita(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_insumos_cita(uuid, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.revertir_insumos_cita(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revertir_insumos_cita(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 12. Egreso manual (movimientos_contables origen='manual') → póliza propia.
--     Cargo = cuenta elegida en el movimiento (dinámico); abono = Caja (regla).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_egreso_manual_poliza()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_regla record;
  v_monto bigint;
BEGIN
  IF NEW.origen = 'manual' THEN
    v_monto := ABS(NEW.monto_centavos);
    BEGIN
      SELECT * INTO v_regla FROM public.contab_resolver_regla(NEW.clinic_id, 'egreso_manual');
      IF v_regla.cuenta_abono_id IS NULL THEN
        RAISE EXCEPTION 'regla_no_encontrada: egreso_manual';
      END IF;

      PERFORM public.crear_poliza(jsonb_build_object(
        'clinic_id', NEW.clinic_id, 'tipo', 'egreso', 'fecha', NEW.fecha_devengo,
        'concepto', COALESCE(NEW.descripcion, 'Egreso manual'),
        'reference_type', 'movimiento_manual', 'reference_id', NEW.id, 'evento', 'registro',
        'partidas', jsonb_build_array(
          jsonb_build_object('cuenta_id', NEW.cuenta_id, 'debe_centavos', v_monto, 'haber_centavos', 0, 'descripcion', COALESCE(NEW.descripcion, 'Egreso manual')),
          jsonb_build_object('cuenta_id', v_regla.cuenta_abono_id, 'debe_centavos', 0, 'haber_centavos', v_monto, 'descripcion', 'Salida de caja')
        )
      ));
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.contab_encolar_pendiente(
        NEW.clinic_id, 'egreso_manual', 'movimiento_manual', NEW.id, v_monto, NEW.fecha_devengo,
        COALESCE(NEW.descripcion, 'Egreso manual'), 'registro', 'egreso', NULL, SQLERRM
      );
    END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_contab_egreso_manual_poliza ON public.movimientos_contables;
CREATE TRIGGER trg_contab_egreso_manual_poliza
  AFTER INSERT ON public.movimientos_contables
  FOR EACH ROW EXECUTE FUNCTION public.contab_egreso_manual_poliza();

REVOKE EXECUTE ON FUNCTION public.contab_egreso_manual_poliza() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 13. Backfill histórico: movimientos_contables sin póliza → póliza de 2
--     partidas contra la cuenta puente (399). Idempotente. No toca filas que
--     tengan un pendiente ABIERTO (evita chocar con el reproceso normal si un
--     trigger en vivo falló y quedó encolado).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_backfill_polizas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row record;
  v_count integer := 0;
  v_puente_id uuid;
  v_cuenta_tipo text;
  v_es_ingreso boolean;
  v_monto bigint;
  v_partidas jsonb;
  v_poliza_evento text;
  v_tipo text;
BEGIN
  SELECT id INTO v_puente_id FROM public.cuentas_contables WHERE codigo = '399';
  IF v_puente_id IS NULL THEN
    RAISE EXCEPTION 'cuenta_puente_399_no_encontrada';
  END IF;

  FOR v_row IN
    SELECT m.* FROM public.movimientos_contables m
    WHERE m.reference_type IS NOT NULL AND m.reference_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.polizas p
        WHERE p.reference_type = m.reference_type AND p.reference_id = m.reference_id
          AND p.evento = (CASE WHEN m.evento = 'cancelacion' THEN 'cancelacion' ELSE 'registro' END)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.contab_asientos_pendientes pend
        WHERE pend.reference_type = m.reference_type AND pend.reference_id = m.reference_id
          AND pend.resuelto_at IS NULL
      )
  LOOP
    SELECT tipo INTO v_cuenta_tipo FROM public.cuentas_contables WHERE id = v_row.cuenta_id;
    v_es_ingreso := (v_cuenta_tipo = 'ingreso');
    v_monto := ABS(v_row.monto_centavos);
    v_poliza_evento := CASE WHEN v_row.evento = 'cancelacion' THEN 'cancelacion' ELSE 'registro' END;
    v_tipo := CASE WHEN v_es_ingreso THEN 'ingreso' ELSE 'egreso' END;

    IF v_row.monto_centavos > 0 THEN
      IF v_es_ingreso THEN
        v_partidas := jsonb_build_array(
          jsonb_build_object('cuenta_id', v_puente_id, 'debe_centavos', v_monto, 'haber_centavos', 0, 'descripcion', 'Backfill histórico'),
          jsonb_build_object('cuenta_id', v_row.cuenta_id, 'debe_centavos', 0, 'haber_centavos', v_monto, 'descripcion', 'Backfill histórico')
        );
      ELSE
        v_partidas := jsonb_build_array(
          jsonb_build_object('cuenta_id', v_row.cuenta_id, 'debe_centavos', v_monto, 'haber_centavos', 0, 'descripcion', 'Backfill histórico'),
          jsonb_build_object('cuenta_id', v_puente_id, 'debe_centavos', 0, 'haber_centavos', v_monto, 'descripcion', 'Backfill histórico')
        );
      END IF;
    ELSE
      IF v_es_ingreso THEN
        v_partidas := jsonb_build_array(
          jsonb_build_object('cuenta_id', v_row.cuenta_id, 'debe_centavos', v_monto, 'haber_centavos', 0, 'descripcion', 'Backfill histórico (reversa)'),
          jsonb_build_object('cuenta_id', v_puente_id, 'debe_centavos', 0, 'haber_centavos', v_monto, 'descripcion', 'Backfill histórico (reversa)')
        );
      ELSE
        v_partidas := jsonb_build_array(
          jsonb_build_object('cuenta_id', v_puente_id, 'debe_centavos', v_monto, 'haber_centavos', 0, 'descripcion', 'Backfill histórico (reversa)'),
          jsonb_build_object('cuenta_id', v_row.cuenta_id, 'debe_centavos', 0, 'haber_centavos', v_monto, 'descripcion', 'Backfill histórico (reversa)')
        );
      END IF;
    END IF;

    PERFORM public.crear_poliza(jsonb_build_object(
      'clinic_id', v_row.clinic_id, 'tipo', v_tipo, 'fecha', v_row.fecha_devengo,
      'concepto', COALESCE(v_row.descripcion, 'Backfill ' || v_row.reference_type),
      'reference_type', v_row.reference_type, 'reference_id', v_row.reference_id, 'evento', v_poliza_evento,
      'partidas', v_partidas
    ));
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_backfill_polizas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contab_backfill_polizas() TO service_role;

-- ---------------------------------------------------------------------------
-- 14. Reproceso de pendientes: reintenta cada evento encolado con su lógica
--     original (helper genérico, o el armado especial de factura/egreso manual).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contab_reprocesar_pendientes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row record;
  v_count integer := 0;
  v_poliza_id uuid;
  v_regla record;
  v_regla_iva record;
  v_cuenta_id uuid;
  v_partidas jsonb;
BEGIN
  FOR v_row IN SELECT * FROM public.contab_asientos_pendientes WHERE resuelto_at IS NULL ORDER BY created_at
  LOOP
    BEGIN
      IF v_row.evento = 'factura_proveedor' THEN
        SELECT * INTO v_regla FROM public.contab_resolver_regla(v_row.clinic_id, 'factura_proveedor_subtotal');
        IF v_regla.cuenta_cargo_id IS NULL THEN
          RAISE EXCEPTION 'regla_no_encontrada: factura_proveedor_subtotal';
        END IF;

        v_partidas := jsonb_build_array(
          jsonb_build_object('cuenta_id', v_regla.cuenta_cargo_id,
            'debe_centavos', (v_row.partidas_extra->>'subtotal_centavos')::bigint, 'haber_centavos', 0)
        );

        IF COALESCE((v_row.partidas_extra->>'iva_centavos')::bigint, 0) > 0 THEN
          SELECT * INTO v_regla_iva FROM public.contab_resolver_regla(v_row.clinic_id, 'factura_proveedor_iva');
          IF v_regla_iva.cuenta_cargo_id IS NULL THEN
            RAISE EXCEPTION 'regla_no_encontrada: factura_proveedor_iva';
          END IF;
          v_partidas := v_partidas || jsonb_build_array(
            jsonb_build_object('cuenta_id', v_regla_iva.cuenta_cargo_id,
              'debe_centavos', (v_row.partidas_extra->>'iva_centavos')::bigint, 'haber_centavos', 0)
          );
        END IF;

        v_partidas := v_partidas || jsonb_build_array(
          jsonb_build_object('cuenta_id', v_regla.cuenta_abono_id, 'debe_centavos', 0,
            'haber_centavos', (v_row.partidas_extra->>'total_centavos')::bigint)
        );

        v_poliza_id := public.crear_poliza(jsonb_build_object(
          'clinic_id', v_row.clinic_id, 'tipo', v_row.tipo_poliza, 'fecha', v_row.fecha,
          'concepto', v_row.concepto,
          'uuid_cfdi', NULLIF(v_row.partidas_extra->>'uuid_cfdi', '')::uuid,
          'reference_type', v_row.reference_type, 'reference_id', v_row.reference_id, 'evento', v_row.evento_poliza,
          'partidas', v_partidas
        ));

      ELSIF v_row.evento = 'egreso_manual' THEN
        SELECT cuenta_id INTO v_cuenta_id FROM public.movimientos_contables WHERE id = v_row.reference_id;
        IF v_cuenta_id IS NULL THEN
          RAISE EXCEPTION 'movimiento_manual_no_encontrado';
        END IF;
        SELECT * INTO v_regla FROM public.contab_resolver_regla(v_row.clinic_id, 'egreso_manual');
        IF v_regla.cuenta_abono_id IS NULL THEN
          RAISE EXCEPTION 'regla_no_encontrada: egreso_manual';
        END IF;

        v_poliza_id := public.crear_poliza(jsonb_build_object(
          'clinic_id', v_row.clinic_id, 'tipo', v_row.tipo_poliza, 'fecha', v_row.fecha, 'concepto', v_row.concepto,
          'reference_type', v_row.reference_type, 'reference_id', v_row.reference_id, 'evento', v_row.evento_poliza,
          'partidas', jsonb_build_array(
            jsonb_build_object('cuenta_id', v_cuenta_id, 'debe_centavos', v_row.monto_centavos, 'haber_centavos', 0),
            jsonb_build_object('cuenta_id', v_regla.cuenta_abono_id, 'debe_centavos', 0, 'haber_centavos', v_row.monto_centavos)
          )
        ));

      ELSE
        v_poliza_id := public.contab_generar_poliza_evento(
          v_row.clinic_id, v_row.evento, v_row.monto_centavos, v_row.fecha, v_row.concepto,
          v_row.reference_type, v_row.reference_id, v_row.evento_poliza, v_row.tipo_poliza
        );
      END IF;

      UPDATE public.contab_asientos_pendientes
      SET resuelto_at = now(), resuelto_poliza_id = v_poliza_id
      WHERE id = v_row.id;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.contab_asientos_pendientes SET error = SQLERRM WHERE id = v_row.id;
    END;
  END LOOP;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_reprocesar_pendientes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contab_reprocesar_pendientes() TO service_role;
