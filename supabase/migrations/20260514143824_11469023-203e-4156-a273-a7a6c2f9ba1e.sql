-- Enums
CREATE TYPE public.canal_tipo AS ENUM ('telegram','whatsapp','instagram','facebook');
CREATE TYPE public.conversacion_status AS ENUM ('activa','escalada','cerrada');
CREATE TYPE public.mensaje_rol AS ENUM ('user','assistant','tool','system');

-- identidades_canal
CREATE TABLE public.identidades_canal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id public.canal_tipo NOT NULL,
  external_id text NOT NULL,
  display_name text,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canal_id, external_id)
);

ALTER TABLE public.identidades_canal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage identidades" ON public.identidades_canal
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));

CREATE POLICY "Patient view own identidad" ON public.identidades_canal
  FOR SELECT TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

-- conversaciones
CREATE TABLE public.conversaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identidad_canal_id uuid NOT NULL REFERENCES public.identidades_canal(id) ON DELETE CASCADE,
  status public.conversacion_status NOT NULL DEFAULT 'activa',
  intencion_actual text,
  asignada_humano_id uuid,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_last_msg ON public.conversaciones(last_message_at DESC);
CREATE INDEX idx_conv_status ON public.conversaciones(status);

ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage conversaciones" ON public.conversaciones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));

CREATE POLICY "Patient view own conversaciones" ON public.conversaciones
  FOR SELECT TO authenticated
  USING (identidad_canal_id IN (
    SELECT ic.id FROM public.identidades_canal ic
    JOIN public.patients p ON p.id = ic.patient_id
    WHERE p.user_id = auth.uid()
  ));

-- mensajes
CREATE TABLE public.mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL REFERENCES public.conversaciones(id) ON DELETE CASCADE,
  rol public.mensaje_rol NOT NULL,
  contenido text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_msg_conv ON public.mensajes(conversacion_id, created_at);

ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage mensajes" ON public.mensajes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));

CREATE POLICY "Patient view own mensajes" ON public.mensajes
  FOR SELECT TO authenticated
  USING (conversacion_id IN (
    SELECT c.id FROM public.conversaciones c
    JOIN public.identidades_canal ic ON ic.id = c.identidad_canal_id
    JOIN public.patients p ON p.id = ic.patient_id
    WHERE p.user_id = auth.uid()
  ));

-- Trigger: actualizar last_message_at en conversaciones cuando llega mensaje
CREATE OR REPLACE FUNCTION public.touch_conversacion_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversaciones
    SET last_message_at = NEW.created_at, updated_at = now()
    WHERE id = NEW.conversacion_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_conversacion
AFTER INSERT ON public.mensajes
FOR EACH ROW EXECUTE FUNCTION public.touch_conversacion_last_message();

-- updated_at triggers
CREATE TRIGGER trg_identidades_updated BEFORE UPDATE ON public.identidades_canal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_conversaciones_updated BEFORE UPDATE ON public.conversaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auditoría sobre conversaciones
CREATE TRIGGER trg_audit_conversaciones
AFTER INSERT OR UPDATE OR DELETE ON public.conversaciones
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Realtime
ALTER TABLE public.mensajes REPLICA IDENTITY FULL;
ALTER TABLE public.conversaciones REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversaciones;