-- Auditoría de acceso 2026-07-20, grupo C: funciones predicado usadas dentro de
-- policies RLS (is_staff, is_global_admin, user_has_clinic_access, etc.).
-- Verificado con pg_policies: TODAS las policies que las referencian están
-- scopeadas a rol {authenticated}, ninguna a {public}/{anon} (booking público no
-- las usa). is_global_admin también se llama directo vía .rpc() desde
-- AdminTenants.tsx/AdminTenantDetail.tsx (siempre con sesión). Seguro cerrar anon
-- y dejar solo authenticated.

REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_caja_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_caja_staff(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_clinic_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_clinic_staff(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_global_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_global_admin(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_configure_caja(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_configure_caja(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_has_clinic_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_clinic_access(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_has_clinic_role(uuid, uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_clinic_role(uuid, uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_can_access_patient_clinic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_patient_clinic(uuid) TO authenticated;
