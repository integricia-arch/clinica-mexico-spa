-- Hueco encontrado al validar el ciclo completo cita→honorario→pago: existía
-- regla 'honorario_devengo' (601 cargo / 205.01 abono, acumula el pasivo) pero
-- ninguna para pagarlo. Análogo a 'pago_factura' (201/102): cargo al pasivo
-- que se salda, abono a Bancos.
INSERT INTO public.contab_reglas_asiento (clinic_id, evento, cuenta_cargo_id, cuenta_abono_id)
SELECT NULL, 'honorario_pago',
       (SELECT id FROM public.cuentas_contables WHERE codigo = '205.01'),
       (SELECT id FROM public.cuentas_contables WHERE codigo = '102')
ON CONFLICT (evento) WHERE clinic_id IS NULL DO NOTHING;
