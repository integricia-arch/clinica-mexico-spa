-- Fix: Agregar SECURITY_INVOKER a vista bot_metricas_diarias
-- Issue: Vista sobre datos multi-tenant debe usar security_invoker = on

DROP VIEW IF EXISTS public.bot_metricas_diarias;

CREATE VIEW public.bot_metricas_diarias WITH (security_invoker = on) AS
SELECT
  CAST(c.created_at AS DATE) AS fecha,
  COUNT(DISTINCT c.id) AS conversaciones_count,
  COALESCE(SUM(CASE WHEN a.origen = 'telegram' THEN 1 ELSE 0 END), 0) AS citas_creadas_count,
  COUNT(DISTINCT CASE WHEN c.status = 'escalada' THEN c.id END) AS escaladas_count,
  COALESCE(COUNT(DISTINCT p.id) FILTER (WHERE p.created_at::date = CAST(c.created_at AS DATE)), 0) AS expedientes_nuevos
FROM public.conversaciones c
LEFT JOIN public.identidades_canal ic ON ic.id = c.identidad_canal_id
LEFT JOIN public.patients p ON p.id = ic.patient_id
LEFT JOIN public.appointments a ON a.patient_id = p.id AND a.created_at::date = CAST(c.created_at AS DATE) AND a.origen = 'telegram'
WHERE c.status IN ('activa', 'escalada', 'cerrada')
GROUP BY CAST(c.created_at AS DATE)
ORDER BY fecha DESC;

-- Grant permisos
GRANT SELECT ON public.bot_metricas_diarias TO authenticated;
GRANT SELECT ON public.bot_metricas_diarias TO service_role;

-- Comentario documentando las métricas
COMMENT ON VIEW public.bot_metricas_diarias IS 'Métricas diarias del bot Telegram: conversaciones activas, citas creadas, escaladas y pacientes nuevos registrados por el bot (security_invoker: on)';
