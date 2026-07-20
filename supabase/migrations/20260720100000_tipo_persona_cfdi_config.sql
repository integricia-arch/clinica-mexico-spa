-- Tipo de persona de la clínica (física/moral) — determina tratamiento IVA de
-- consultas (Art. 15-XIV LIVA, exento solo aplica a persona física). Nullable,
-- sin default: nunca asumir, mismo espíritu que iva_tratamiento = 'sin_configurar'.
ALTER TABLE public.cfdi_config
  ADD COLUMN IF NOT EXISTS tipo_persona text
    CHECK (tipo_persona IN ('fisica', 'moral'));
