-- anon tenía EXECUTE en las 2 RPCs nuevas de 20260721210000 por default privilege
-- de Postgres/Supabase (REVOKE FROM PUBLIC en la migración original no alcanza a
-- un grant explícito ya existente por default). Funcionalmente ya estaba bloqueado
-- por el check de auth.uid() en cada función, pero se revoca explícito por
-- checklist del proyecto (CLAUDE.md, sección SECURITY DEFINER).
REVOKE EXECUTE ON FUNCTION public.honorarios_saldo_por_doctor(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.honorario_registrar_pago(jsonb) FROM anon;
