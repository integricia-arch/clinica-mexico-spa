-- Reglas de notificación configurables por rol/evento/canal.
-- Alcance confirmado por negocio: solo Telegram + email por ahora (gratis).
-- SMS/WhatsApp tiene costo recurrente -- no se implementa hoy, pero el
-- esquema queda extensible (channel es texto libre, no enum) para agregarlo
-- después sin migración de tipo. Ver investigación
-- memoria/proyectos/investigacion-enfermeria-operativa.md.

CREATE TABLE public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id),
  role text NOT NULL,
  event_type text NOT NULL,
  channel text NOT NULL DEFAULT 'telegram',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, role, event_type, channel)
);

CREATE INDEX idx_notification_rules_lookup ON public.notification_rules(role, event_type, channel);

ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notification_rules" ON public.notification_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Semilla: refleja el comportamiento actual hardcodeado, para que activar
-- el panel no cambie nada por default.
INSERT INTO public.notification_rules (clinic_id, role, event_type, channel, enabled)
SELECT c.id, v.role, v.event_type, v.channel, true
FROM public.clinics c
CROSS JOIN (VALUES
  ('nurse', 'cita_asignada_enfermera', 'telegram'),
  ('admin', 'cxp_vencimiento', 'telegram'),
  ('admin', 'cxp_vencimiento', 'email'),
  ('admin', 'usuario_nuevo', 'email')
) AS v(role, event_type, channel)
ON CONFLICT DO NOTHING;
