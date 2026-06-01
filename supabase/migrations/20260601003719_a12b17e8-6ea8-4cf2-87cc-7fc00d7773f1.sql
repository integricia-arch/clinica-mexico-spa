-- 1) Tabla de auditoría de enlace turno ↔ pharmacy_cash_shifts
CREATE TABLE IF NOT EXISTS public.turno_pharmacy_link_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  turno_id uuid NOT NULL,
  caja_id uuid NOT NULL,
  cajero_user_id uuid NOT NULL,
  pharmacy_shift_id uuid,
  action text NOT NULL CHECK (action IN ('linked_existing','created_new','skipped_not_pharmacy','blocked_close_pharmacy_open','manual_link','manual_unlink')),
  reason text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpla_turno ON public.turno_pharmacy_link_audit(turno_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tpla_clinic ON public.turno_pharmacy_link_audit(clinic_id, created_at DESC);

GRANT SELECT ON public.turno_pharmacy_link_audit TO authenticated;
GRANT ALL ON public.turno_pharmacy_link_audit TO service_role;

ALTER TABLE public.turno_pharmacy_link_audit ENABLE ROW LEVEL SECURITY;

-- Append-only: nadie inserta/actualiza/borra desde cliente; solo triggers SECURITY DEFINER
CREATE POLICY "tpla_select_clinic_members"
  ON public.turno_pharmacy_link_audit FOR SELECT TO authenticated
  USING (user_has_clinic_access(auth.uid(), clinic_id));

CREATE POLICY "tpla_no_insert" ON public.turno_pharmacy_link_audit AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "tpla_no_update" ON public.turno_pharmacy_link_audit AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "tpla_no_delete" ON public.turno_pharmacy_link_audit AS RESTRICTIVE
  FOR DELETE TO authenticated USING (false);

-- 2) Reescribir trigger AFTER INSERT para auditar TODOS los casos
--    (se mantiene el BEFORE INSERT existente que asigna pharmacy_shift_id)
CREATE OR REPLACE FUNCTION public.turnos_audit_pharmacy_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_es_farmacia boolean;
  v_action text;
  v_reason text;
BEGIN
  SELECT es_farmacia INTO v_es_farmacia FROM public.cajas WHERE id = NEW.caja_id;

  IF NOT COALESCE(v_es_farmacia, false) THEN
    v_action := 'skipped_not_pharmacy';
    v_reason := 'La caja no está marcada como de farmacia';
  ELSIF NEW.pharmacy_shift_id IS NOT NULL THEN
    -- Determinar si reusó o creó nuevo: comparar opened_at vs turno
    IF EXISTS (
      SELECT 1 FROM public.pharmacy_cash_shifts s
      WHERE s.id = NEW.pharmacy_shift_id
        AND s.opened_at < NEW.created_at - interval '2 seconds'
    ) THEN
      v_action := 'linked_existing';
      v_reason := 'Reutilizó corte de farmacia abierto previamente por el cajero';
    ELSE
      v_action := 'created_new';
      v_reason := 'Abrió automáticamente nuevo corte de POS Farmacia';
    END IF;
  ELSE
    v_action := 'skipped_not_pharmacy';
    v_reason := 'Sin enlace (caja farmacia sin shift asignado)';
  END IF;

  INSERT INTO public.turno_pharmacy_link_audit
    (clinic_id, turno_id, caja_id, cajero_user_id, pharmacy_shift_id, action, reason, actor_user_id)
  VALUES
    (NEW.clinic_id, NEW.id, NEW.caja_id, NEW.cajero_user_id,
     NEW.pharmacy_shift_id, v_action, v_reason, auth.uid());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_turnos_audit_pharmacy_link ON public.turnos;
CREATE TRIGGER trg_turnos_audit_pharmacy_link
AFTER INSERT ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.turnos_audit_pharmacy_link();

-- 3) Auditar bloqueo de cierre cuando pharmacy shift sigue abierto
CREATE OR REPLACE FUNCTION public.turnos_block_close_if_pharmacy_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.estado = 'cerrado' AND OLD.estado <> 'cerrado' AND NEW.pharmacy_shift_id IS NOT NULL THEN
    SELECT status INTO v_status FROM public.pharmacy_cash_shifts WHERE id = NEW.pharmacy_shift_id;
    IF v_status = 'open' THEN
      INSERT INTO public.turno_pharmacy_link_audit
        (clinic_id, turno_id, caja_id, cajero_user_id, pharmacy_shift_id, action, reason, actor_user_id)
      VALUES
        (NEW.clinic_id, NEW.id, NEW.caja_id, NEW.cajero_user_id,
         NEW.pharmacy_shift_id, 'blocked_close_pharmacy_open',
         'Intento de cierre rechazado: corte de POS Farmacia sigue abierto',
         auth.uid());
      RAISE EXCEPTION 'Debes cerrar primero el corte de caja desde POS Farmacia antes de cerrar este turno.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;