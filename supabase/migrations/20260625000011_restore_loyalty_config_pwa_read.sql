-- Restaura política anon que permite al PWA leer loyalty_config por slug_farmacia.
-- Se perdió en alguna migración de fix de Etapa 1.
DROP POLICY IF EXISTS "loyalty_config_pwa_read" ON loyalty_config;
CREATE POLICY "loyalty_config_pwa_read" ON loyalty_config
  FOR SELECT TO anon
  USING (programa_activo = true);
