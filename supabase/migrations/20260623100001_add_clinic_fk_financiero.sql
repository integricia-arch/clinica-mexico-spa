-- Migration: Add clinic_id Foreign Key constraints to financial tables
-- Purpose: Enforce referential integrity from financial tables to clinics
-- ON DELETE RESTRICT: Prevents deletion of clinics with associated financial data (per policy)
-- Idempotent via DO blocks (pg_constraint check — standard PostgreSQL)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cajas_clinic_id_fkey') THEN
    ALTER TABLE public.cajas
      ADD CONSTRAINT cajas_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turnos_clinic_id_fkey') THEN
    ALTER TABLE public.turnos
      ADD CONSTRAINT turnos_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metodos_pago_clinic_id_fkey') THEN
    ALTER TABLE public.metodos_pago
      ADD CONSTRAINT metodos_pago_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conceptos_clinic_id_fkey') THEN
    ALTER TABLE public.conceptos
      ADD CONSTRAINT conceptos_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_clinic_id_fkey') THEN
    ALTER TABLE public.movimientos
      ADD CONSTRAINT movimientos_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cortes_clinic_id_fkey') THEN
    ALTER TABLE public.cortes
      ADD CONSTRAINT cortes_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'impresoras_clinic_id_fkey') THEN
    ALTER TABLE public.impresoras
      ADD CONSTRAINT impresoras_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacy_cash_shifts_clinic_id_fkey') THEN
    ALTER TABLE public.pharmacy_cash_shifts
      ADD CONSTRAINT pharmacy_cash_shifts_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacy_sales_clinic_id_fkey') THEN
    ALTER TABLE public.pharmacy_sales
      ADD CONSTRAINT pharmacy_sales_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacy_sale_items_clinic_id_fkey') THEN
    ALTER TABLE public.pharmacy_sale_items
      ADD CONSTRAINT pharmacy_sale_items_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacy_returns_clinic_id_fkey') THEN
    ALTER TABLE public.pharmacy_returns
      ADD CONSTRAINT pharmacy_returns_clinic_id_fkey
      FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
  END IF;
END $$;
