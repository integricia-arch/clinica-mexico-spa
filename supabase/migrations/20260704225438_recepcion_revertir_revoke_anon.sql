-- El GRANT original no venía solo de PUBLIC: `anon` tenía un grant explícito
-- separado (visible en pg_proc.proacl como entrada propia, no solo `=X`),
-- así que REVOKE FROM PUBLIC no bastaba — hay que revocarlo también de `anon`.
REVOKE EXECUTE ON FUNCTION public.recepcion_revertir(uuid) FROM anon;
