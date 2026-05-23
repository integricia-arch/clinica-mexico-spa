
-- ============================================================
-- Motor operativo del Camino del Paciente (aditivo)
-- ============================================================

-- Helper: check if current user is staff
CREATE OR REPLACE FUNCTION public.is_clinic_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'receptionist'::app_role)
      OR public.has_role(_user_id, 'doctor'::app_role)
      OR public.has_role(_user_id, 'nurse'::app_role);
$$;

-- ============================================================
-- 1) journey_instance_steps
-- ============================================================
CREATE TABLE IF NOT EXISTS public.journey_instance_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_instance_id uuid NOT NULL,
  step_key text NOT NULL,
  step_name text NOT NULL,
  step_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','open','in_progress','completed','blocked','needs_review','skipped','override_authorized')),
  opened_at timestamptz,
  opened_by uuid,
  assigned_to uuid,
  closed_at timestamptz,
  closed_by uuid,
  blocked_reason text,
  next_action text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_instance_id, step_key)
);
CREATE INDEX IF NOT EXISTS idx_jis_journey ON public.journey_instance_steps(journey_instance_id);
CREATE INDEX IF NOT EXISTS idx_jis_status ON public.journey_instance_steps(status);
ALTER TABLE public.journey_instance_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read steps" ON public.journey_instance_steps
  FOR SELECT TO authenticated USING (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff insert steps" ON public.journey_instance_steps
  FOR INSERT TO authenticated WITH CHECK (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff update steps" ON public.journey_instance_steps
  FOR UPDATE TO authenticated USING (public.is_clinic_staff(auth.uid()))
  WITH CHECK (public.is_clinic_staff(auth.uid()));

CREATE TRIGGER trg_jis_updated BEFORE UPDATE ON public.journey_instance_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) journey_instance_step_data
-- ============================================================
CREATE TABLE IF NOT EXISTS public.journey_instance_step_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_instance_step_id uuid NOT NULL,
  data_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_instance_step_id)
);
CREATE INDEX IF NOT EXISTS idx_jisd_step ON public.journey_instance_step_data(journey_instance_step_id);
ALTER TABLE public.journey_instance_step_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read step_data" ON public.journey_instance_step_data
  FOR SELECT TO authenticated USING (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff insert step_data" ON public.journey_instance_step_data
  FOR INSERT TO authenticated WITH CHECK (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff update step_data" ON public.journey_instance_step_data
  FOR UPDATE TO authenticated USING (public.is_clinic_staff(auth.uid()))
  WITH CHECK (public.is_clinic_staff(auth.uid()));

CREATE TRIGGER trg_jisd_updated BEFORE UPDATE ON public.journey_instance_step_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3) journey_instance_audit (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.journey_instance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_instance_id uuid NOT NULL,
  journey_instance_step_id uuid,
  action text NOT NULL,
  old_value_json jsonb,
  new_value_json jsonb,
  user_id uuid,
  role text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jia_journey ON public.journey_instance_audit(journey_instance_id);
CREATE INDEX IF NOT EXISTS idx_jia_step ON public.journey_instance_audit(journey_instance_step_id);
ALTER TABLE public.journey_instance_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read journey_audit" ON public.journey_instance_audit
  FOR SELECT TO authenticated USING (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff insert journey_audit" ON public.journey_instance_audit
  FOR INSERT TO authenticated WITH CHECK (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Deny update journey_audit" ON public.journey_instance_audit
  AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny delete journey_audit" ON public.journey_instance_audit
  AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

-- Trigger to auto-audit step changes
CREATE OR REPLACE FUNCTION public.journey_step_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'step_created';
    v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'step_updated';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_action := 'step_status_' || NEW.status;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'step_deleted';
    v_old := to_jsonb(OLD);
  END IF;

  INSERT INTO public.journey_instance_audit
    (journey_instance_id, journey_instance_step_id, action, old_value_json, new_value_json, user_id)
  VALUES
    (COALESCE(NEW.journey_instance_id, OLD.journey_instance_id),
     COALESCE(NEW.id, OLD.id), v_action, v_old, v_new, auth.uid());

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_jis_audit
AFTER INSERT OR UPDATE OR DELETE ON public.journey_instance_steps
FOR EACH ROW EXECUTE FUNCTION public.journey_step_audit_trigger();

-- ============================================================
-- 4) journey_instance_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS public.journey_instance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_instance_id uuid NOT NULL,
  journey_instance_step_id uuid,
  document_type text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jid_journey ON public.journey_instance_documents(journey_instance_id);
ALTER TABLE public.journey_instance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read journey_docs" ON public.journey_instance_documents
  FOR SELECT TO authenticated USING (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff insert journey_docs" ON public.journey_instance_documents
  FOR INSERT TO authenticated WITH CHECK (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff delete journey_docs" ON public.journey_instance_documents
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

-- ============================================================
-- 5) journey_instance_overrides
-- ============================================================
CREATE TABLE IF NOT EXISTS public.journey_instance_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_instance_id uuid NOT NULL,
  journey_instance_step_id uuid NOT NULL,
  requested_by uuid,
  authorized_by uuid,
  reason text NOT NULL,
  risk_acknowledgement text,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','authorized','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  authorized_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_jio_journey ON public.journey_instance_overrides(journey_instance_id);
ALTER TABLE public.journey_instance_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read overrides" ON public.journey_instance_overrides
  FOR SELECT TO authenticated USING (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff insert overrides" ON public.journey_instance_overrides
  FOR INSERT TO authenticated WITH CHECK (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Admin authorize overrides" ON public.journey_instance_overrides
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- ============================================================
-- 6) prescriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_instance_id uuid,
  appointment_id uuid,
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  expediente_id uuid,
  consultation_note_id uuid,
  prescription_number text UNIQUE,
  issue_date timestamptz,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued','cancelled','dispensed','partially_dispensed')),
  digital_signature_status text NOT NULL DEFAULT 'none',
  qr_code_value text,
  pdf_url text,
  diagnosis text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rx_patient ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_rx_doctor ON public.prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_rx_journey ON public.prescriptions(journey_instance_id);
CREATE INDEX IF NOT EXISTS idx_rx_status ON public.prescriptions(status);
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated USING (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Patient read own prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );
CREATE POLICY "Doctor or admin insert prescriptions" ON public.prescriptions
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role)
    OR (public.has_role(auth.uid(),'doctor'::app_role)
        AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()))
  );
CREATE POLICY "Doctor or admin update prescriptions" ON public.prescriptions
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR (public.has_role(auth.uid(),'doctor'::app_role)
        AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()))
    OR public.has_role(auth.uid(),'nurse'::app_role)
    OR public.has_role(auth.uid(),'receptionist'::app_role)
  ) WITH CHECK (true);
CREATE POLICY "Admin delete prescriptions" ON public.prescriptions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_rx_updated BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7) prescription_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL,
  medication_id uuid,
  generic_name text NOT NULL,
  brand_name text,
  pharmaceutical_form text,
  concentration text,
  presentation text,
  dose text NOT NULL,
  route text NOT NULL,
  frequency text NOT NULL,
  duration text NOT NULL,
  quantity numeric,
  instructions text NOT NULL,
  is_controlled boolean NOT NULL DEFAULT false,
  controlled_group text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rxi_rx ON public.prescription_items(prescription_id);
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read prescription_items" ON public.prescription_items
  FOR SELECT TO authenticated USING (
    public.is_clinic_staff(auth.uid())
    OR prescription_id IN (
      SELECT id FROM public.prescriptions
      WHERE patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "Doctor/admin manage prescription_items" ON public.prescription_items
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'doctor'::app_role)
  ) WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'doctor'::app_role)
  );

-- ============================================================
-- 8) patient_checkout_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patient_checkout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_instance_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  appointment_id uuid,
  checkout_type text NOT NULL
    CHECK (checkout_type IN ('alta_medica','alta_administrativa','referencia','alta_voluntaria','abandono','seguimiento_pendiente')),
  checkout_status text NOT NULL DEFAULT 'completado',
  checked_out_by uuid,
  checked_out_at timestamptz NOT NULL DEFAULT now(),
  discharge_summary text,
  followup_required boolean NOT NULL DEFAULT false,
  followup_date timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pco_journey ON public.patient_checkout_events(journey_instance_id);
CREATE INDEX IF NOT EXISTS idx_pco_patient ON public.patient_checkout_events(patient_id);
ALTER TABLE public.patient_checkout_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read checkouts" ON public.patient_checkout_events
  FOR SELECT TO authenticated USING (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Patient read own checkouts" ON public.patient_checkout_events
  FOR SELECT TO authenticated USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );
CREATE POLICY "Staff manage checkouts" ON public.patient_checkout_events
  FOR INSERT TO authenticated WITH CHECK (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff update checkouts" ON public.patient_checkout_events
  FOR UPDATE TO authenticated USING (public.is_clinic_staff(auth.uid()))
  WITH CHECK (public.is_clinic_staff(auth.uid()));

-- ============================================================
-- 9) post_consultation_followups
-- ============================================================
CREATE TABLE IF NOT EXISTS public.post_consultation_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_instance_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  prescription_id uuid,
  responsible_user_id uuid,
  followup_date timestamptz NOT NULL,
  channel text NOT NULL CHECK (channel IN ('llamada','whatsapp','correo','presencial')),
  status text NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente','en_proceso','completado','no_contactado','cancelado')),
  medication_adherence text,
  symptoms_reported text,
  adverse_effects text,
  requires_new_appointment boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pcf_patient ON public.post_consultation_followups(patient_id);
CREATE INDEX IF NOT EXISTS idx_pcf_journey ON public.post_consultation_followups(journey_instance_id);
ALTER TABLE public.post_consultation_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read followups" ON public.post_consultation_followups
  FOR SELECT TO authenticated USING (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Patient read own followups" ON public.post_consultation_followups
  FOR SELECT TO authenticated USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );
CREATE POLICY "Staff insert followups" ON public.post_consultation_followups
  FOR INSERT TO authenticated WITH CHECK (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff update followups" ON public.post_consultation_followups
  FOR UPDATE TO authenticated USING (public.is_clinic_staff(auth.uid()))
  WITH CHECK (public.is_clinic_staff(auth.uid()));

CREATE TRIGGER trg_pcf_updated BEFORE UPDATE ON public.post_consultation_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Helper: generate unique prescription number
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_prescription_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_count int;
BEGIN
  v_prefix := 'RX-' || to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO v_count
    FROM public.prescriptions
    WHERE prescription_number LIKE v_prefix || '%';
  RETURN v_prefix || '-' || lpad(v_count::text, 5, '0');
END;
$$;

-- ============================================================
-- Helper: recompute journey progress in snapshot_json
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_journey_progress(_journey_instance_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_done int;
  v_current text;
  v_status text;
  v_pct numeric;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('completed','skipped','override_authorized'))
    INTO v_total, v_done
    FROM public.journey_instance_steps WHERE journey_instance_id = _journey_instance_id;

  SELECT step_key INTO v_current
    FROM public.journey_instance_steps
    WHERE journey_instance_id = _journey_instance_id
      AND status IN ('open','in_progress','blocked','needs_review')
    ORDER BY step_order ASC LIMIT 1;

  IF v_current IS NULL THEN
    SELECT step_key INTO v_current
      FROM public.journey_instance_steps
      WHERE journey_instance_id = _journey_instance_id
        AND status = 'pending'
      ORDER BY step_order ASC LIMIT 1;
  END IF;

  IF v_total > 0 THEN
    v_pct := round((v_done::numeric / v_total::numeric) * 100, 0);
  ELSE
    v_pct := 0;
  END IF;

  IF v_done = v_total AND v_total > 0 THEN
    v_status := 'completado';
  ELSIF EXISTS (SELECT 1 FROM public.journey_instance_steps
                WHERE journey_instance_id = _journey_instance_id AND status = 'blocked') THEN
    v_status := 'bloqueado';
  ELSE
    v_status := 'en_proceso';
  END IF;

  UPDATE public.journey_instances
    SET snapshot_json = COALESCE(snapshot_json,'{}'::jsonb)
        || jsonb_build_object(
          'current_step_key', v_current,
          'progress_percent', v_pct,
          'total_steps', v_total,
          'completed_steps', v_done
        ),
        status = v_status,
        updated_at = now()
  WHERE id = _journey_instance_id;
END;
$$;
