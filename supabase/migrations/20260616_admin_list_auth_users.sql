-- RPC para listar auth.users directo via SQL.
-- GoTrue's GET /auth/v1/admin/users (bulk list) devuelve 500
-- "Database error finding users" en este proyecto. admin-users y
-- notify-new-user dependían de ese endpoint y fallaban silenciosamente.
-- Esta función bypasea el endpoint roto. Solo service_role puede ejecutarla
-- (la llaman edge functions con la service role key, nunca clientes directos).

CREATE OR REPLACE FUNCTION public.admin_list_auth_users()
RETURNS TABLE(id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at, u.last_sign_in_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_auth_users() FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_auth_users() TO service_role;
