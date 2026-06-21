-- Migration: Add clinic_id Foreign Key constraints to financial tables
-- Purpose: Enforce referential integrity from financial tables to clinics
-- ON DELETE RESTRICT: Prevents deletion of clinics with associated financial data (per policy)
-- All constraints use IF NOT EXISTS (Postgres 15+) for idempotency

-- Caja management tables
ALTER TABLE public.cajas
  ADD CONSTRAINT IF NOT EXISTS cajas_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

ALTER TABLE public.turnos
  ADD CONSTRAINT IF NOT EXISTS turnos_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- Payment method catalogs
ALTER TABLE public.metodos_pago
  ADD CONSTRAINT IF NOT EXISTS metodos_pago_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- Service/product concept catalog
ALTER TABLE public.conceptos
  ADD CONSTRAINT IF NOT EXISTS conceptos_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- Movement/transaction tables
ALTER TABLE public.movimientos
  ADD CONSTRAINT IF NOT EXISTS movimientos_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

ALTER TABLE public.cortes
  ADD CONSTRAINT IF NOT EXISTS cortes_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- Printer configuration
ALTER TABLE public.impresoras
  ADD CONSTRAINT IF NOT EXISTS impresoras_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- Pharmacy cash management
ALTER TABLE public.pharmacy_cash_shifts
  ADD CONSTRAINT IF NOT EXISTS pharmacy_cash_shifts_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- Pharmacy sales
ALTER TABLE public.pharmacy_sales
  ADD CONSTRAINT IF NOT EXISTS pharmacy_sales_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- Pharmacy sale line items
ALTER TABLE public.pharmacy_sale_items
  ADD CONSTRAINT IF NOT EXISTS pharmacy_sale_items_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;

-- Pharmacy returns
ALTER TABLE public.pharmacy_returns
  ADD CONSTRAINT IF NOT EXISTS pharmacy_returns_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE RESTRICT;
