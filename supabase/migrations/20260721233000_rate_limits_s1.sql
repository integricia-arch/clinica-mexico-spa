-- S1: rate limiting para Edge Functions anon-abusables / costosas por identidad
-- Ver memoria/proyectos/S1-rate-limiting-diseno.md (diseño Opus)

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket       text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;

-- Sin policies de cliente: solo accesible vía RPC SECURITY DEFINER / service_role.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _bucket text,
  _limit int,
  _window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamptz;
  _count int;
BEGIN
  _window_start := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);

  INSERT INTO public.rate_limits (bucket, window_start, count)
  VALUES (_bucket, _window_start, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO _count;

  RETURN _count <= _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) TO service_role;

-- Limpieza diaria de ventanas viejas
DO $$
BEGIN
  PERFORM cron.unschedule('rate-limits-cleanup');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'rate-limits-cleanup',
  '0 4 * * *',
  $$ DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day'; $$
);
