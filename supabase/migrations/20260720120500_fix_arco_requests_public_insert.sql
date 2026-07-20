-- Auditoría de acceso 2026-07-20: policy "arco_requests_public_insert" tenía
-- WITH CHECK(true) — cualquier anon podía insertar con `status`, `notas_internas`,
-- `respuesta`, `folio`, `resolved_at` arbitrarios (campos de uso exclusivo de
-- staff/ARCOAdmin.tsx). No hay formulario público en este repo que use esta
-- policy hoy (solo ARCOAdmin.tsx, panel de staff, la referencia), pero la anon
-- key es pública — cualquiera con la URL puede insertar vía REST directo sin
-- pasar por el frontend. Fix: forzar los valores seguros por default en el
-- INSERT público, staff sigue pudiendo escribir esos campos vía UPDATE
-- (policy arco_requests_admin_update, sin tocar).

DROP POLICY IF EXISTS "arco_requests_public_insert" ON public.arco_requests;

CREATE POLICY "arco_requests_public_insert" ON public.arco_requests
  FOR INSERT
  WITH CHECK (
    status = 'pendiente'
    AND notas_internas IS NULL
    AND respuesta IS NULL
    AND resolved_at IS NULL
  );
