-- Fix auth_rls_initplan performance advisor finding: 264 RLS policies on public schema
-- call auth.uid()/auth.role()/auth.jwt() directly in USING/WITH CHECK, causing Postgres
-- to re-evaluate the function once per row instead of once per query.
-- This migration rewrites each affected policy so every bare auth.uid()/auth.role()/auth.jwt()
-- call is wrapped as (select auth.uid()) etc. Authorization semantics are unchanged --
-- only the evaluation plan improves. Detection/wrapping is case-insensitive and idempotent:
-- any call already wrapped in (select ...) (any case, with or without an alias) is left as-is
-- (normalized to canonical lowercase form), never double-wrapped.
--
-- NOTE: scope is limited to auth.uid()/auth.role()/auth.jwt() per the backlog item.
-- One remaining auth_rls_initplan finding was left untouched by design:
-- public.loyalty_members / policy "loyalty_members_pwa_auth_read" uses auth.email()
-- (a 4th auth.* function, out of this migration's scope) -- follow-up ticket if desired.
DO $$
DECLARE
  r record;
  new_qual text;
  new_wc text;
  ddl text;
  n int := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname = 'public'
  LOOP
    new_qual := r.qual;
    new_wc := r.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, '\(\s*select\s+auth\.(uid|role|jwt)\s*\(\)\s*(as\s+\w+\s*)?\)', '@@WRAP_\1@@', 'gi');
      new_qual := regexp_replace(new_qual, 'auth\.(uid|role|jwt)\s*\(\)', '(select auth.\1())', 'gi');
      new_qual := regexp_replace(new_qual, '@@WRAP_(uid|role|jwt)@@', '(select auth.\1())', 'gi');
    END IF;

    IF new_wc IS NOT NULL THEN
      new_wc := regexp_replace(new_wc, '\(\s*select\s+auth\.(uid|role|jwt)\s*\(\)\s*(as\s+\w+\s*)?\)', '@@WRAP_\1@@', 'gi');
      new_wc := regexp_replace(new_wc, 'auth\.(uid|role|jwt)\s*\(\)', '(select auth.\1())', 'gi');
      new_wc := regexp_replace(new_wc, '@@WRAP_(uid|role|jwt)@@', '(select auth.\1())', 'gi');
    END IF;

    IF new_qual IS DISTINCT FROM r.qual OR new_wc IS DISTINCT FROM r.with_check THEN
      EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
      ddl := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
                     r.policyname, r.schemaname, r.tablename,
                     r.permissive, r.cmd, array_to_string(r.roles, ', '));
      IF new_qual IS NOT NULL THEN
        ddl := ddl || format(' USING (%s)', new_qual);
      END IF;
      IF new_wc IS NOT NULL THEN
        ddl := ddl || format(' WITH CHECK (%s)', new_wc);
      END IF;
      EXECUTE ddl;
      n := n + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Policies rewritten: %', n;
END $$;
