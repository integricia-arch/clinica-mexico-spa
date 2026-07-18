-- Módulo Contable — Fase 1: insumos por cita.
-- Plan: docs/superpowers/plans/2026-07-18-modulo-contable.md
--
-- Nota de diseño (desviación consciente del plan): movimientos_inventario es
-- exclusivo de medicamentos (medicamento_id NOT NULL). appointment_insumos ES
-- el log de movimientos de insumos: cada fila registra quién, cuándo, cantidad,
-- costo snapshot y cita. El stock de public.insumos se descuenta/restaura
-- atómicamente vía las RPCs de abajo; nunca por DML directo del cliente.

CREATE TABLE IF NOT EXISTS public.appointment_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE RESTRICT,
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  -- 'consumo' descuenta stock; 'reversa' lo restaura (cita cancelada). Nunca DELETE.
  tipo text NOT NULL DEFAULT 'consumo' CHECK (tipo IN ('consumo', 'reversa')),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  -- Snapshot del costo al momento del consumo; inmutable aunque insumos.costo_centavos cambie.
  costo_unitario_centavos integer NOT NULL CHECK (costo_unitario_centavos > 0),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointment_insumos_appointment
  ON public.appointment_insumos (appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_insumos_clinic_created
  ON public.appointment_insumos (clinic_id, created_at);

ALTER TABLE public.appointment_insumos ENABLE ROW LEVEL SECURITY;

-- Lectura: solo miembros de la clínica. Escritura: solo vía RPCs SECURITY DEFINER
-- (sin policies de INSERT/UPDATE/DELETE ⇒ DML directo del cliente queda negado).
DROP POLICY IF EXISTS "Members read appointment_insumos" ON public.appointment_insumos;
CREATE POLICY "Members read appointment_insumos"
  ON public.appointment_insumos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_memberships
      WHERE user_id = auth.uid() AND clinic_id = appointment_insumos.clinic_id
    )
  );

-- Registra el consumo de insumos de una cita y descuenta stock, todo o nada.
-- p_items: [{"insumo_id": uuid, "cantidad": int}, ...]
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
BEGIN
  -- Orden deliberado: hay que resolver la clínica de la cita ANTES de poder
  -- validar membership (chicken-egg). v_clinic_id nunca se retorna al cliente
  -- y el fallo lanza 'forbidden' genérico — no filtra datos cross-tenant.
  SELECT clinic_id INTO v_clinic_id
  FROM public.appointments WHERE id = p_appointment_id;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Cita no encontrada';
  END IF;

  -- Control de acceso: primera operación tras resolver la clínica.
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
       v_item.cantidad, v_insumo.costo_centavos, auth.uid());

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- Reversa total de los consumos de una cita (cita cancelada). Inserta filas
-- 'reversa' con el MISMO costo snapshot y restaura stock. Idempotente: si ya
-- hay reversa para la cita, no duplica.
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
BEGIN
  -- Mismo orden deliberado que registrar_insumos_cita (ver comentario arriba).
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
    SELECT insumo_id, cantidad, costo_unitario_centavos
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

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.registrar_insumos_cita(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_insumos_cita(uuid, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.revertir_insumos_cita(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revertir_insumos_cita(uuid) TO authenticated;
