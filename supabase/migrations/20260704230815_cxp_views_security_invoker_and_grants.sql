-- Las 5 vistas de KPIs de CxP corrían como SECURITY DEFINER (comportamiento
-- por default de vistas en Postgres: se ejecutan con los permisos del dueño,
-- lo que salta el RLS de las tablas base). Además tenían grant ALL
-- (arwdDxtm, incluye DELETE) a anon Y authenticated -- cualquier usuario de
-- cualquier clínica podía ver datos financieros de proveedores de OTRAS
-- clínicas. Fix: security_invoker=on (respeta RLS del que consulta) +
-- grants mínimos (solo SELECT, solo authenticated).

ALTER VIEW public.v_ciclo_compras SET (security_invoker = on);
ALTER VIEW public.kpi_dpo_proveedor SET (security_invoker = on);
ALTER VIEW public.concentracion_proveedores SET (security_invoker = on);
ALTER VIEW public.kpi_descuento_pronto_pago SET (security_invoker = on);
ALTER VIEW public.resumen_alertas_cxp SET (security_invoker = on);

REVOKE ALL ON public.v_ciclo_compras FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.kpi_dpo_proveedor FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.concentracion_proveedores FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.kpi_descuento_pronto_pago FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.resumen_alertas_cxp FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.v_ciclo_compras TO authenticated;
GRANT SELECT ON public.kpi_dpo_proveedor TO authenticated;
GRANT SELECT ON public.concentracion_proveedores TO authenticated;
GRANT SELECT ON public.kpi_descuento_pronto_pago TO authenticated;
GRANT SELECT ON public.resumen_alertas_cxp TO authenticated;
