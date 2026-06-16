-- Restaura los permisos de admin_list_auth_users() que se perdieron al hacer
-- DROP + CREATE en 20260623000000_admin_list_users_banned.sql.
-- PostgreSQL resetea privilegios al recrear una función; sin este REVOKE/GRANT
-- cualquier usuario autenticado podía invocar la función y leer auth.users.

REVOKE ALL ON FUNCTION public.admin_list_auth_users() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_auth_users() TO service_role;
