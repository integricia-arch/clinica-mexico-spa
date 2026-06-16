-- list_nurses() ahora incluye horario_inicio/horario_fin para que el
-- selector de NuevaCitaDialog pueda advertir "fuera de horario" al asignar.
-- Ver investigación memoria/proyectos/investigacion-enfermeria-operativa.md
-- Prioridad 5.

DROP FUNCTION public.list_nurses();

CREATE FUNCTION public.list_nurses()
RETURNS TABLE(id uuid, email text, nombre text, apellidos text, categoria public.nurse_categoria, horario_inicio time, horario_fin time)
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
  SELECT u.id, u.email::text, n.nombre, n.apellidos, n.categoria, n.horario_inicio, n.horario_fin
  FROM auth.users u
  JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.nurses n ON n.user_id = u.id
  WHERE ur.role = 'nurse'
  ORDER BY n.apellidos NULLS LAST, u.email;
END;
$function$;
