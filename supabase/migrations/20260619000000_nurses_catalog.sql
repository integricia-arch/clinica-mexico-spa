-- Catálogo de enfermeras (espejo de doctors) — valida la función operativa
-- de enfermería: cédula profesional, categoría, horario. Ver investigación
-- memoria/proyectos/investigacion-enfermeria-operativa.md Prioridad 1.

CREATE TYPE public.nurse_categoria AS ENUM ('licenciada', 'tecnica', 'auxiliar');

CREATE TABLE public.nurses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  nombre text NOT NULL,
  apellidos text NOT NULL,
  categoria public.nurse_categoria NOT NULL DEFAULT 'auxiliar',
  especialidad text,
  cedula_profesional text,
  telefono text,
  horario_inicio time NOT NULL DEFAULT '08:00:00',
  horario_fin time NOT NULL DEFAULT '18:00:00',
  activo boolean NOT NULL DEFAULT true,
  clinic_id uuid REFERENCES public.clinics(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nurses_user_id ON public.nurses(user_id);
CREATE INDEX idx_nurses_clinic_id ON public.nurses(clinic_id);

ALTER TABLE public.nurses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View nurses" ON public.nurses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage nurses" ON public.nurses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Nurses update own" ON public.nurses
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- list_nurses() ahora devuelve identidad real en vez de solo email.
-- LEFT JOIN: si una enfermera con rol asignado aún no tiene fila en `nurses`,
-- sigue apareciendo en el selector (con email como fallback) en vez de desaparecer.
CREATE OR REPLACE FUNCTION public.list_nurses()
RETURNS TABLE(id uuid, email text, nombre text, apellidos text, categoria public.nurse_categoria)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'receptionist')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text, n.nombre, n.apellidos, n.categoria
  FROM auth.users u
  JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.nurses n ON n.user_id = u.id
  WHERE ur.role = 'nurse'
  ORDER BY n.apellidos NULLS LAST, u.email;
END;
$function$;
