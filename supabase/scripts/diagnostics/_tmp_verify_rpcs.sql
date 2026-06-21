SELECT proname, pg_get_function_identity_arguments(oid) as args
FROM pg_proc
WHERE proname IN ('turno_fondo_movimiento','turno_corte_x','turno_close')
AND pronamespace = 'public'::regnamespace
ORDER BY proname;
