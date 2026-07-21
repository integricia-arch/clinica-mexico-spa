-- Catálogo mínimo: cuentas que faltaban para operaciones ya modeladas en el
-- sistema (nómina, comisiones de pago, depreciación NIF C-6) pero sin cuenta
-- contable donde registrarse. Solo alta de catálogo -- no se wire-ea lógica
-- de negocio nueva aquí (retención ISR/IMSS y depreciación automática quedan
-- pendientes como features aparte, documentado en memoria técnica §11).

INSERT INTO public.cuentas_contables (codigo, nombre, tipo, naturaleza, es_fijo)
VALUES
  ('131', 'Depreciación acumulada de mobiliario y equipo', 'activo', 'acreedora', false),
  ('210', 'ISR retenido por pagar', 'pasivo', 'acreedora', false),
  ('211', 'IMSS / INFONAVIT por pagar', 'pasivo', 'acreedora', false),
  ('605', 'Comisiones bancarias y financieras', 'egreso', 'deudora', false),
  ('606', 'Depreciación', 'egreso', 'deudora', false)
ON CONFLICT (codigo) DO NOTHING;
