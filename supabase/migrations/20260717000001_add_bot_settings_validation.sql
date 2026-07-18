-- Add bot section to clinic_settings with validation.
-- Constraint: instrucciones_extra NEVER contains "diagnostica" or "consejo médico".

-- ─────────────────────────────────────────────────────────────
-- Trigger: validate bot section instrucciones_extra
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_bot_settings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  instrs text;
BEGIN
  -- Only validate when section = 'bot'
  IF NEW.section = 'bot' THEN
    instrs := (NEW.data->>'instrucciones_extra')::text;

    -- Check for prohibited keywords (case-insensitive)
    IF instrs IS NOT NULL AND (
      instrs ~* 'diagnostica' OR
      instrs ~* 'consejo médico'
    ) THEN
      RAISE EXCEPTION 'instrucciones_extra no puede contener "diagnostica" o "consejo médico"';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_bot_settings ON public.clinic_settings;
CREATE TRIGGER trg_validate_bot_settings
  BEFORE INSERT OR UPDATE ON public.clinic_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_bot_settings();
