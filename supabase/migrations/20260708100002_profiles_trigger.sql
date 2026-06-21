-- supabase/migrations/20260708100002_profiles_trigger.sql
-- Add updated_at trigger to profiles table.
-- The update_updated_at_column() function is already defined in 20260403013133_0dd988d2-42ca-46ff-a969-3046eec6e9fc.sql

BEGIN;

-- Idempotent trigger creation
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
