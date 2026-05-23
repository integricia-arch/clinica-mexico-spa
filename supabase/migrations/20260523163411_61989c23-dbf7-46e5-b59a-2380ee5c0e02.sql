
-- ============== PARTE 4: schema patients NOM-004 ==============
-- Drop old sexo check (uses 'M'/'F'/'Otro'), normalize values, add new check
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_sexo_check;
UPDATE public.patients SET sexo = CASE
  WHEN sexo = 'M' THEN 'masculino'
  WHEN sexo = 'F' THEN 'femenino'
  WHEN sexo = 'Otro' THEN 'otro'
  WHEN sexo IN ('masculino','femenino','otro') THEN sexo
  ELSE NULL
END WHERE sexo IS NOT NULL;
ALTER TABLE public.patients ADD CONSTRAINT patients_sexo_check
  CHECK (sexo IS NULL OR sexo IN ('masculino','femenino','otro'));

-- New columns
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS domicilio_ciudad text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS domicilio_estado text DEFAULT 'Jalisco';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS nacionalidad text DEFAULT 'Mexicana';
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS ocupacion text;

-- Unique CURP (allow nulls)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='patients_curp_unique'
  ) THEN
    CREATE UNIQUE INDEX patients_curp_unique ON public.patients(curp) WHERE curp IS NOT NULL;
  END IF;
END $$;

-- tipo_sangre check
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_tipo_sangre_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_tipo_sangre_check
  CHECK (tipo_sangre IS NULL OR tipo_sangre IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','desconocido'));

-- ============== PARTE 1: doctors.user_id nullable (demo doctors sin auth) ==============
ALTER TABLE public.doctors ALTER COLUMN user_id DROP NOT NULL;

-- ============== PARTE 5: bot_sesiones state machine ==============
ALTER TABLE public.bot_sesiones ADD COLUMN IF NOT EXISTS flow_step text;
ALTER TABLE public.bot_sesiones ADD COLUMN IF NOT EXISTS flow_data jsonb NOT NULL DEFAULT '{}'::jsonb;
