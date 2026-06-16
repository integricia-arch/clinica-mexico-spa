-- Expone banned_until en admin_list_auth_users() para poder mostrar y
-- alternar el estado habilitado/deshabilitado de una cuenta desde
-- AdminUsuarios.tsx (usado para gatear el acceso de la cuenta de pruebas
-- QA sin tener que eliminarla).

DROP FUNCTION public.admin_list_auth_users();

CREATE FUNCTION public.admin_list_auth_users()
RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, banned_until timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at, u.last_sign_in_at, u.banned_until
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$function$;
