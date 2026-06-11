-- pharmacy_shift_id debe ser nullable para que fondos_movimientos
-- soporte tanto turnos farmacia (pharmacy_shift_id set) como turnos generales (turno_id set)
ALTER TABLE public.fondos_movimientos
  ALTER COLUMN pharmacy_shift_id DROP NOT NULL;
