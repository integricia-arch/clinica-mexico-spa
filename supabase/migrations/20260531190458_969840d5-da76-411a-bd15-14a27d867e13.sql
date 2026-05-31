-- 1) Marca de caja de farmacia
ALTER TABLE public.cajas
  ADD COLUMN IF NOT EXISTS es_farmacia boolean NOT NULL DEFAULT false;

-- 2) Enlace turno → pharmacy_cash_shifts
ALTER TABLE public.turnos
  ADD COLUMN IF NOT EXISTS pharmacy_shift_id uuid REFERENCES public.pharmacy_cash_shifts(id);

CREATE INDEX IF NOT EXISTS idx_turnos_pharmacy_shift_id ON public.turnos(pharmacy_shift_id);

-- 3) Trigger BEFORE INSERT: si caja es de farmacia, abre turno de farmacia
CREATE OR REPLACE FUNCTION public.turnos_link_pharmacy_shift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_es_farmacia boolean;
  v_existing uuid;
  v_new_shift uuid;
BEGIN
  IF NEW.estado <> 'abierto' THEN
    RETURN NEW;
  END IF;

  SELECT es_farmacia INTO v_es_farmacia FROM public.cajas WHERE id = NEW.caja_id;
  IF NOT COALESCE(v_es_farmacia, false) THEN
    RETURN NEW;
  END IF;

  -- Reutilizar pharmacy_cash_shift abierto del mismo cajero/clínica si existe
  SELECT id INTO v_existing
    FROM public.pharmacy_cash_shifts
   WHERE cashier_user_id = NEW.cajero_user_id
     AND clinic_id = NEW.clinic_id
     AND status = 'open'
   ORDER BY opened_at DESC LIMIT 1;

  IF v_existing IS NOT NULL THEN
    NEW.pharmacy_shift_id := v_existing;
    RETURN NEW;
  END IF;

  INSERT INTO public.pharmacy_cash_shifts
    (clinic_id, cashier_user_id, opened_by, opening_amount, notes)
  VALUES
    (NEW.clinic_id, NEW.cajero_user_id, NEW.cajero_user_id,
     COALESCE(NEW.monto_apertura, 0),
     COALESCE(NEW.notas_apertura, 'Abierto desde turno general'))
  RETURNING id INTO v_new_shift;

  NEW.pharmacy_shift_id := v_new_shift;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_nuevos, clinic_id)
  VALUES (NEW.cajero_user_id, 'crear', 'pharmacy_cash_shifts', v_new_shift,
          jsonb_build_object('event','turno_abierto_auto_desde_turnos','caja_id',NEW.caja_id),
          NEW.clinic_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_turnos_link_pharmacy_shift ON public.turnos;
CREATE TRIGGER trg_turnos_link_pharmacy_shift
BEFORE INSERT ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.turnos_link_pharmacy_shift();

-- 4) Trigger BEFORE UPDATE: no permitir cerrar turno si pharmacy shift sigue abierto
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
      RAISE EXCEPTION 'Debes cerrar primero el corte de caja desde POS Farmacia antes de cerrar este turno.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_turnos_block_close_if_pharmacy_open ON public.turnos;
CREATE TRIGGER trg_turnos_block_close_if_pharmacy_open
BEFORE UPDATE ON public.turnos
FOR EACH ROW EXECUTE FUNCTION public.turnos_block_close_if_pharmacy_open();