
-- ENUMS
CREATE TYPE public.journey_step_type AS ENUM (
  'administrativa','clinica','legal','farmacia','facturacion','seguimiento','auditoria'
);

CREATE TYPE public.journey_version_status AS ENUM ('draft','active','archived');

CREATE TYPE public.journey_field_type AS ENUM (
  'texto_corto','texto_largo','numero','fecha','fecha_hora','seleccion_unica',
  'seleccion_multiple','si_no','archivo','firma','usuario_responsable','medicamento',
  'diagnostico','servicio','metodo_pago','resultado_laboratorio','signos_vitales','checklist'
);

CREATE TYPE public.journey_template_type AS ENUM (
  'consulta_general','consulta_seguimiento','urgencia','procedimiento_menor',
  'laboratorio','farmacia','teleconsulta','alta_administrativa'
);

CREATE TYPE public.journey_rule_severity AS ENUM ('info','warning','blocking');

-- TABLE: journey_templates
CREATE TABLE public.journey_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type public.journey_template_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  active_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- TABLE: journey_template_versions
CREATE TABLE public.journey_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.journey_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status public.journey_version_status NOT NULL DEFAULT 'draft',
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  published_by uuid,
  publish_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE(template_id, version_number)
);

ALTER TABLE public.journey_templates
  ADD CONSTRAINT journey_templates_active_version_fk
  FOREIGN KEY (active_version_id) REFERENCES public.journey_template_versions(id) ON DELETE SET NULL;

-- TABLE: journey_step_definitions
CREATE TABLE public.journey_step_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id uuid NOT NULL REFERENCES public.journey_template_versions(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  step_name text NOT NULL,
  step_description text,
  step_type public.journey_step_type NOT NULL,
  step_order integer NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  is_critical boolean NOT NULL DEFAULT false,
  allow_not_applicable boolean NOT NULL DEFAULT false,
  requires_responsible boolean NOT NULL DEFAULT false,
  blocks_progress boolean NOT NULL DEFAULT true,
  requires_document boolean NOT NULL DEFAULT false,
  max_recommended_minutes integer,
  allowed_edit_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_complete_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_override_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_version_id, step_key)
);

-- TABLE: journey_step_fields
CREATE TABLE public.journey_step_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_definition_id uuid NOT NULL REFERENCES public.journey_step_definitions(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type public.journey_field_type NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  validation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  options_source text,
  visible_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  editable_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  help_text text,
  default_value jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(step_definition_id, field_key)
);

-- TABLE: journey_option_catalogs
CREATE TABLE public.journey_option_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_key text NOT NULL UNIQUE,
  catalog_name text NOT NULL,
  applies_to_step_type public.journey_step_type,
  applies_to_step_key text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TABLE: journey_option_items
CREATE TABLE public.journey_option_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES public.journey_option_catalogs(id) ON DELETE CASCADE,
  option_key text NOT NULL,
  option_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_critical boolean NOT NULL DEFAULT false,
  requires_special_role boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(catalog_id, option_key)
);

-- TABLE: journey_validation_rules
CREATE TABLE public.journey_validation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id uuid NOT NULL REFERENCES public.journey_template_versions(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  source_step_key text NOT NULL,
  condition_json jsonb NOT NULL,
  action_json jsonb NOT NULL,
  severity public.journey_rule_severity NOT NULL DEFAULT 'warning',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TABLE: journey_configuration_audit (append-only)
CREATE TABLE public.journey_configuration_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid,
  version_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  old_value_json jsonb,
  new_value_json jsonb,
  user_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TABLE: journey_instances (snapshot for in-progress patients)
CREATE TABLE public.journey_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.journey_templates(id),
  template_version_id uuid NOT NULL REFERENCES public.journey_template_versions(id),
  patient_id uuid,
  appointment_id uuid,
  snapshot_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'en_proceso',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_jtv_template ON public.journey_template_versions(template_id);
CREATE INDEX idx_jsd_version ON public.journey_step_definitions(template_version_id);
CREATE INDEX idx_jsf_step ON public.journey_step_fields(step_definition_id);
CREATE INDEX idx_joi_catalog ON public.journey_option_items(catalog_id);
CREATE INDEX idx_jvr_version ON public.journey_validation_rules(template_version_id);
CREATE INDEX idx_jca_template ON public.journey_configuration_audit(template_id);
CREATE INDEX idx_ji_patient ON public.journey_instances(patient_id);
CREATE INDEX idx_ji_appointment ON public.journey_instances(appointment_id);

-- TIMESTAMPS TRIGGERS (reuse existing update_updated_at_column)
CREATE TRIGGER trg_jt_updated BEFORE UPDATE ON public.journey_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_jsd_updated BEFORE UPDATE ON public.journey_step_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ji_updated BEFORE UPDATE ON public.journey_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROTECTION: prevent deleting critical steps
CREATE OR REPLACE FUNCTION public.prevent_critical_step_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status public.journey_version_status;
BEGIN
  IF OLD.is_critical THEN
    SELECT status INTO v_status FROM public.journey_template_versions WHERE id = OLD.template_version_id;
    IF v_status = 'active' THEN
      RAISE EXCEPTION 'No se puede eliminar una etapa crítica (%) de una versión activa', OLD.step_key;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_jsd_protect_critical BEFORE DELETE ON public.journey_step_definitions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_critical_step_deletion();

-- PROTECTION: step_key immutable
CREATE OR REPLACE FUNCTION public.enforce_step_key_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.step_key <> OLD.step_key THEN
    RAISE EXCEPTION 'La clave interna de la etapa (step_key) no se puede modificar';
  END IF;
  IF OLD.is_critical AND NEW.is_critical = false THEN
    RAISE EXCEPTION 'No se puede desmarcar una etapa crítica';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jsd_immutable BEFORE UPDATE ON public.journey_step_definitions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_step_key_immutable();

-- PROTECTION: cannot deactivate or delete an option item that's used
CREATE OR REPLACE FUNCTION public.prevent_option_item_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'No se permite eliminar elementos del catálogo. Desactívelos en su lugar.';
END;
$$;

CREATE TRIGGER trg_joi_no_delete BEFORE DELETE ON public.journey_option_items
  FOR EACH ROW EXECUTE FUNCTION public.prevent_option_item_deletion();

-- AUDIT TRIGGER for journey_* changes
CREATE OR REPLACE FUNCTION public.journey_audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_template uuid;
  v_version uuid;
BEGIN
  IF TG_TABLE_NAME = 'journey_template_versions' THEN
    v_template := COALESCE(NEW.template_id, OLD.template_id);
    v_version := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'journey_step_definitions' THEN
    v_version := COALESCE(NEW.template_version_id, OLD.template_version_id);
  ELSIF TG_TABLE_NAME = 'journey_templates' THEN
    v_template := COALESCE(NEW.id, OLD.id);
  END IF;

  INSERT INTO public.journey_configuration_audit(template_id, version_id, action, entity, entity_id, old_value_json, new_value_json, user_id)
  VALUES (
    v_template, v_version, TG_OP, TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_jt AFTER INSERT OR UPDATE OR DELETE ON public.journey_templates
  FOR EACH ROW EXECUTE FUNCTION public.journey_audit_trigger();
CREATE TRIGGER trg_audit_jtv AFTER INSERT OR UPDATE OR DELETE ON public.journey_template_versions
  FOR EACH ROW EXECUTE FUNCTION public.journey_audit_trigger();
CREATE TRIGGER trg_audit_jsd AFTER INSERT OR UPDATE OR DELETE ON public.journey_step_definitions
  FOR EACH ROW EXECUTE FUNCTION public.journey_audit_trigger();

-- ENABLE RLS
ALTER TABLE public.journey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_step_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_step_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_option_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_option_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_validation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_configuration_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_instances ENABLE ROW LEVEL SECURITY;

-- RLS: staff can read config; admin manages
CREATE POLICY "Staff read journey_templates" ON public.journey_templates FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));
CREATE POLICY "Admin manage journey_templates" ON public.journey_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "Staff read journey_template_versions" ON public.journey_template_versions FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));
CREATE POLICY "Admin manage journey_template_versions" ON public.journey_template_versions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "Staff read journey_step_definitions" ON public.journey_step_definitions FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));
CREATE POLICY "Admin manage journey_step_definitions" ON public.journey_step_definitions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "Staff read journey_step_fields" ON public.journey_step_fields FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));
CREATE POLICY "Admin manage journey_step_fields" ON public.journey_step_fields FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "Staff read journey_option_catalogs" ON public.journey_option_catalogs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));
CREATE POLICY "Admin manage journey_option_catalogs" ON public.journey_option_catalogs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "Staff read journey_option_items" ON public.journey_option_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));
CREATE POLICY "Admin manage journey_option_items" ON public.journey_option_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "Staff read journey_validation_rules" ON public.journey_validation_rules FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));
CREATE POLICY "Admin manage journey_validation_rules" ON public.journey_validation_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- AUDIT is append-only and read-only (insert allowed only via SECURITY DEFINER trigger)
CREATE POLICY "Staff read journey_configuration_audit" ON public.journey_configuration_audit FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist'));
CREATE POLICY "Deny insert journey_configuration_audit" ON public.journey_configuration_audit AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "Deny update journey_configuration_audit" ON public.journey_configuration_audit AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny delete journey_configuration_audit" ON public.journey_configuration_audit AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

CREATE POLICY "Staff read journey_instances" ON public.journey_instances FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));
CREATE POLICY "Staff create journey_instances" ON public.journey_instances FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));
CREATE POLICY "Staff update journey_instances" ON public.journey_instances FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));

-- SEED: base template "Consulta general" with 10 critical steps
DO $$
DECLARE
  v_template_id uuid;
  v_version_id uuid;
BEGIN
  INSERT INTO public.journey_templates(name, description, type, is_default)
  VALUES ('Consulta general', 'Plantilla base segura para consulta general', 'consulta_general', true)
  RETURNING id INTO v_template_id;

  INSERT INTO public.journey_template_versions(template_id, version_number, status, publish_reason, published_at, config_json)
  VALUES (v_template_id, 1, 'active', 'Versión inicial sembrada por el sistema', now(), '{"seed":true}'::jsonb)
  RETURNING id INTO v_version_id;

  UPDATE public.journey_templates SET active_version_id = v_version_id WHERE id = v_template_id;

  INSERT INTO public.journey_step_definitions
    (template_version_id, step_key, step_name, step_description, step_type, step_order, is_required, is_critical, requires_responsible, blocks_progress, allowed_complete_roles)
  VALUES
    (v_version_id,'identification','Identificación del paciente','Validar identidad e INE','administrativa',1,true,true,true,true,'["receptionist","admin"]'::jsonb),
    (v_version_id,'consent','Aviso de privacidad y consentimiento','Aviso de privacidad y consentimiento informado','legal',2,true,true,true,true,'["receptionist","admin","doctor"]'::jsonb),
    (v_version_id,'record','Expediente clínico','Apertura o actualización del expediente','clinica',3,true,true,true,true,'["doctor","nurse","admin"]'::jsonb),
    (v_version_id,'consultation','Consulta médica','Atención médica del paciente','clinica',4,true,true,true,true,'["doctor","admin"]'::jsonb),
    (v_version_id,'diagnosis','Diagnóstico / valoración médica','Impresión diagnóstica y CIE-10','clinica',5,true,true,true,true,'["doctor","admin"]'::jsonb),
    (v_version_id,'prescription','Receta / indicaciones','Emisión de receta cuando aplique','clinica',6,false,true,true,false,'["doctor","admin"]'::jsonb),
    (v_version_id,'billing','Cobro / facturación','Cobro y CFDI cuando aplique','facturacion',7,false,true,true,false,'["receptionist","admin"]'::jsonb),
    (v_version_id,'followup','Seguimiento','Programación de seguimiento','seguimiento',8,false,true,false,false,'["receptionist","doctor","admin"]'::jsonb),
    (v_version_id,'discharge','Alta / cierre','Cierre clínico o administrativo con nota final','clinica',9,true,true,true,true,'["doctor","admin"]'::jsonb),
    (v_version_id,'audit','Auditoría','Registro de auditoría del flujo','auditoria',10,true,true,false,false,'["admin"]'::jsonb);
END $$;

-- SEED basic catalogs
INSERT INTO public.journey_option_catalogs(catalog_key, catalog_name, applies_to_step_type) VALUES
  ('tipos_visita','Tipos de visita','administrativa'),
  ('tipos_consentimiento','Tipos de consentimiento','legal'),
  ('tipos_alta','Tipos de alta','clinica'),
  ('motivos_override','Motivos de override',NULL),
  ('metodos_pago','Métodos de pago','facturacion'),
  ('tipos_receta','Tipos de receta','farmacia');

INSERT INTO public.journey_option_items(catalog_id, option_key, option_label, sort_order)
SELECT id, k.key, k.label, k.ord FROM public.journey_option_catalogs c
JOIN (VALUES
  ('tipos_visita','primera_vez','Primera vez',1),
  ('tipos_visita','subsecuente','Subsecuente',2),
  ('tipos_visita','urgencia','Urgencia',3),
  ('tipos_consentimiento','aviso_privacidad','Aviso de privacidad',1),
  ('tipos_consentimiento','consentimiento_informado','Consentimiento informado',2),
  ('tipos_alta','voluntaria','Alta voluntaria',1),
  ('tipos_alta','medica','Alta médica',2),
  ('tipos_alta','administrativa','Alta administrativa',3),
  ('motivos_override','urgencia_medica','Urgencia médica',1),
  ('motivos_override','autorizacion_admin','Autorización del administrador',2),
  ('metodos_pago','efectivo','Efectivo',1),
  ('metodos_pago','tarjeta','Tarjeta',2),
  ('metodos_pago','transferencia','Transferencia',3),
  ('tipos_receta','simple','Receta simple',1),
  ('tipos_receta','controlada','Receta controlada',2)
) AS k(cat,key,label,ord) ON k.cat = c.catalog_key;
