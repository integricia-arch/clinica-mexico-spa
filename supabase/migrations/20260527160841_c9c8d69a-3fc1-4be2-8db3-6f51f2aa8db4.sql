
-- =========================================================
-- FASE 1: Machote editable de receta por doctor
-- =========================================================

-- 1) Tabla principal: machote actual del doctor
CREATE TABLE public.doctor_prescription_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL UNIQUE,

  -- Encabezado
  consultorio_nombre text,
  consultorio_direccion text,
  consultorio_telefono text,
  consultorio_email text,
  logo_path text,                       -- ruta en bucket doctor-assets
  firma_path text,                      -- ruta en bucket doctor-assets
  color_primario text DEFAULT '#0F766E',-- HEX

  -- Cuerpo / cierre
  encabezado_extra text,                -- líneas libres adicionales bajo encabezado
  pie_pagina text,                      -- texto de cierre/disclaimer
  indicaciones_default text,            -- indicaciones por defecto que precarga al crear receta

  -- Opciones de impresión
  mostrar_qr boolean NOT NULL DEFAULT true,
  mostrar_cedula boolean NOT NULL DEFAULT true,
  mostrar_especialidad boolean NOT NULL DEFAULT true,
  mostrar_firma boolean NOT NULL DEFAULT true,
  tamano_papel text NOT NULL DEFAULT 'carta',  -- 'carta' | 'media_carta'

  -- Versión publicada vigente
  current_version_id uuid,              -- FK lógica a doctor_prescription_template_versions
  current_version_number integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_prescription_templates TO authenticated;
GRANT ALL ON public.doctor_prescription_templates TO service_role;

ALTER TABLE public.doctor_prescription_templates ENABLE ROW LEVEL SECURITY;

-- Admin gestiona todo
CREATE POLICY "Admin manage prescription templates"
ON public.doctor_prescription_templates
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Doctor ve y edita SOLO su propio machote
CREATE POLICY "Doctor view own template"
ON public.doctor_prescription_templates
FOR SELECT TO authenticated
USING (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));

CREATE POLICY "Doctor insert own template"
ON public.doctor_prescription_templates
FOR INSERT TO authenticated
WITH CHECK (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));

CREATE POLICY "Doctor update own template"
ON public.doctor_prescription_templates
FOR UPDATE TO authenticated
USING (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()))
WITH CHECK (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));

-- Recepción y enfermería pueden VER los machotes (para imprimir)
CREATE POLICY "Staff read templates for printing"
ON public.doctor_prescription_templates
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'receptionist'::app_role)
  OR public.has_role(auth.uid(), 'nurse'::app_role)
);

CREATE TRIGGER trg_dpt_updated_at
BEFORE UPDATE ON public.doctor_prescription_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Historial inmutable de versiones publicadas
CREATE TABLE public.doctor_prescription_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.doctor_prescription_templates(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL,
  version_number integer NOT NULL,
  snapshot_json jsonb NOT NULL,  -- copia COMPLETA del machote
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  publish_reason text,
  UNIQUE (template_id, version_number)
);

GRANT SELECT, INSERT ON public.doctor_prescription_template_versions TO authenticated;
GRANT ALL ON public.doctor_prescription_template_versions TO service_role;

ALTER TABLE public.doctor_prescription_template_versions ENABLE ROW LEVEL SECURITY;

-- Lectura: dueño, admin, recepción, enfermería
CREATE POLICY "Read template versions"
ON public.doctor_prescription_template_versions
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'receptionist'::app_role)
  OR public.has_role(auth.uid(), 'nurse'::app_role)
  OR doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);

-- Inserción: el doctor dueño o un admin
CREATE POLICY "Insert template versions"
ON public.doctor_prescription_template_versions
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);

-- Sin UPDATE/DELETE: inmutable
CREATE POLICY "No update template versions"
ON public.doctor_prescription_template_versions
AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "No delete template versions"
ON public.doctor_prescription_template_versions
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (false);

-- 3) Columnas nuevas en prescriptions para amarrar machote + snapshot
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS template_version_id uuid,
  ADD COLUMN IF NOT EXISTS template_snapshot_json jsonb;

CREATE INDEX IF NOT EXISTS idx_prescriptions_template ON public.prescriptions(template_id);

-- 4) Storage: bucket privado para logos y firmas
INSERT INTO storage.buckets (id, name, public)
VALUES ('doctor-assets', 'doctor-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Convención de path: {doctor_id}/{logo|firma}.{ext}
-- (storage.foldername(name))[1] = doctor_id

CREATE POLICY "Doctor read own assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'doctor-assets'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'receptionist'::app_role)
    OR public.has_role(auth.uid(), 'nurse'::app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.doctors WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Doctor upload own assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'doctor-assets'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.doctors WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Doctor update own assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'doctor-assets'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.doctors WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Doctor delete own assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'doctor-assets'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.doctors WHERE user_id = auth.uid()
    )
  )
);
