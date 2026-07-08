-- Task 4 (Fase B pagos SaaS): cron diario de alerta por gracia de pago vencida.
-- El bloqueo real ya lo aplica user_has_clinic_access() comparando
-- grace_period_ends_at > now() en cada request (Task 1) -- este cron
-- SOLO notifica/loggea la transicion para que no pase inadvertida.
--
-- Verificado antes de escribir esta migracion:
--   - No existe tabla de alertas generica reusable a nivel plataforma.
--     almacen_alertas/cxp_alertas son domain-specific (clinic_id NOT NULL,
--     columnas atadas a inventario/CxP); monitoring_alerts es de infra, no
--     de negocio. Se crea saas_billing_alerts nueva (YAGNI respetado: es
--     la opcion mas simple que cumple "clinic_id nullable, visible a
--     super_admin").
--   - vault.decrypted_secrets NO tiene un secret 'service_role_key' --
--     se usa el patron Bearer con secret dedicado (lock_grace_cron_secret),
--     mismo patron que whatsapp_audit_cron_secret / auto_reorder_cron_secret.

CREATE TABLE IF NOT EXISTS public.saas_billing_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'gracia_vencida',
  mensaje text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resuelta boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_saas_billing_alerts_unresolved
  ON public.saas_billing_alerts (clinic_id, tipo)
  WHERE resuelta = false;

ALTER TABLE public.saas_billing_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saas_billing_alerts_staff_all" ON public.saas_billing_alerts;
CREATE POLICY "saas_billing_alerts_staff_all" ON public.saas_billing_alerts
  FOR ALL TO authenticated
  USING (public.is_global_admin(auth.uid()))
  WITH CHECK (public.is_global_admin(auth.uid()));

GRANT ALL ON public.saas_billing_alerts TO service_role;
GRANT SELECT ON public.saas_billing_alerts TO authenticated;

-- Idempotente: unschedule antes de schedule (evita jobs duplicados si esta
-- migracion se re-aplica).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'lock-expired-grace-clinics';

SELECT cron.schedule(
  'lock-expired-grace-clinics',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://kyfkvdyxpvpiacyymldc.supabase.co/functions/v1/lock-expired-grace-clinics',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'lock_grace_cron_secret'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
