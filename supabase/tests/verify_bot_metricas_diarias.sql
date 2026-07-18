-- Verificación de la vista bot_metricas_diarias
-- Script para verificar que la vista existe y se puede consultar

-- 1. Verificar que la vista existe en el esquema public
SELECT EXISTS(
  SELECT 1
  FROM information_schema.views
  WHERE table_schema = 'public'
  AND table_name = 'bot_metricas_diarias'
) AS vista_existe;

-- 2. Obtener definición de la vista
SELECT view_definition
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name = 'bot_metricas_diarias';

-- 3. Verificar que se puede hacer SELECT en la vista (con límite de 7 días)
SELECT
  fecha,
  conversaciones_count,
  citas_creadas_count,
  escaladas_count,
  expedientes_nuevos
FROM public.bot_metricas_diarias
WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY fecha DESC;
