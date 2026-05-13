CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action public.audit_action;
  v_old jsonb;
  v_new jsonb;
  v_id uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_action := 'crear';
    v_new := to_jsonb(NEW);
    v_id := NEW.id;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_action := 'actualizar';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_id := NEW.id;
  ELSIF (TG_OP = 'DELETE') THEN
    v_action := 'eliminar';
    v_old := to_jsonb(OLD);
    v_id := OLD.id;
  END IF;

  INSERT INTO public.audit_logs (user_id, accion, tabla, registro_id, datos_anteriores, datos_nuevos)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_id, v_old, v_new);

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;

-- Attach triggers
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['appointments','expedientes','notas_consulta','medicamentos','lotes_medicamento','movimientos_inventario'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger()', t);
  END LOOP;
END $$;