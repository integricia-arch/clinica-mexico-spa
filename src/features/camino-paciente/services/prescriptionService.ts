import { supabase } from "@/integrations/supabase/client";

export interface RxItem {
  generic_name: string;
  brand_name?: string;
  pharmaceutical_form?: string;
  concentration?: string;
  presentation?: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity?: number;
  instructions: string;
  is_controlled?: boolean;
  controlled_group?: string;
  medication_id?: string;
}

export interface RxResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Crear receta en borrador */
export async function createPrescriptionFromConsultation(opts: {
  journey_instance_id?: string;
  appointment_id?: string;
  patient_id: string;
  doctor_id: string;
  expediente_id?: string;
  consultation_note_id?: string;
  diagnosis?: string;
}): Promise<RxResult<{ id: string }>> {
  const { data, error } = await supabase
    .from("prescriptions")
    .insert({
      journey_instance_id: opts.journey_instance_id ?? null,
      appointment_id: opts.appointment_id ?? null,
      patient_id: opts.patient_id,
      doctor_id: opts.doctor_id,
      expediente_id: opts.expediente_id ?? null,
      consultation_note_id: opts.consultation_note_id ?? null,
      diagnosis: opts.diagnosis ?? null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message };
  return { ok: true, data };
}

export async function addPrescriptionItem(
  prescription_id: string,
  item: RxItem,
): Promise<RxResult> {
  if (!item.generic_name || !item.dose || !item.route || !item.frequency || !item.duration || !item.instructions) {
    return { ok: false, error: "Faltan campos obligatorios del medicamento" };
  }
  const { error } = await supabase.from("prescription_items").insert({
    prescription_id,
    ...item,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removePrescriptionItem(itemId: string): Promise<RxResult> {
  const { error } = await supabase.from("prescription_items").delete().eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Emitir receta: validar campos críticos antes */
export async function issuePrescription(prescription_id: string): Promise<RxResult<{ number: string }>> {
  const { data: rx } = await supabase
    .from("prescriptions")
    .select("id, patient_id, doctor_id, status, clinic_id")
    .eq("id", prescription_id)
    .maybeSingle();
  if (!rx) return { ok: false, error: "Receta no encontrada" };
  if (rx.status !== "draft") return { ok: false, error: "La receta ya fue emitida o cancelada" };

  // Validar doctor con cédula
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, nombre, apellidos, cedula_profesional")
    .eq("id", rx.doctor_id)
    .maybeSingle();
  if (!doctor) return { ok: false, error: "Médico no encontrado" };
  if (!doctor.cedula_profesional) {
    return { ok: false, error: "El médico no tiene cédula profesional registrada. Complete sus datos antes de emitir." };
  }

  // Validar paciente
  const { data: patient } = await supabase
    .from("patients")
    .select("id, nombre, apellidos, fecha_nacimiento")
    .eq("id", rx.patient_id)
    .maybeSingle();
  if (!patient) return { ok: false, error: "Paciente no encontrado" };

  // Validar al menos un item
  const { data: items } = await supabase
    .from("prescription_items")
    .select("id, generic_name, dose, route, frequency, duration, instructions, medication_id, quantity")
    .eq("prescription_id", prescription_id);
  if (!items || items.length === 0) {
    return { ok: false, error: "La receta no tiene medicamentos" };
  }
  const incompleto = items.find(
    (i) => !i.generic_name || !i.dose || !i.route || !i.frequency || !i.duration || !i.instructions,
  );
  if (incompleto) return { ok: false, error: "Hay medicamentos con campos obligatorios incompletos" };

  // Generar folio por doctor (formato RX-AAAAMMDD-CODIGO-NNNNN)
  const { data: numberRpc, error: nErr } = await supabase.rpc(
    "generate_prescription_number_for_doctor",
    { _doctor_id: rx.doctor_id },
  );
  if (nErr) return { ok: false, error: nErr.message };
  const prescription_number = (numberRpc as unknown as string) || `RX-${Date.now()}`;
  const qr_code_value = `${prescription_number}|${rx.patient_id}|${rx.doctor_id}`;

  // Snapshot del machote del doctor (si tiene versión publicada)
  const { data: tpl } = await supabase
    .from("doctor_prescription_templates")
    .select("*")
    .eq("doctor_id", rx.doctor_id)
    .maybeSingle();

  let template_id: string | null = null;
  let template_version_id: string | null = null;
  let template_snapshot_json: unknown = null;

  if (tpl?.current_version_id) {
    template_id = tpl.id;
    template_version_id = tpl.current_version_id;
    const { data: ver } = await supabase
      .from("doctor_prescription_template_versions")
      .select("snapshot_json")
      .eq("id", tpl.current_version_id)
      .maybeSingle();
    template_snapshot_json = ver?.snapshot_json ?? tpl;
  } else if (tpl) {
    // Sin versión publicada: usamos el borrador como snapshot de respaldo.
    template_id = tpl.id;
    template_snapshot_json = tpl;
  }

  const { error } = await supabase
    .from("prescriptions")
    .update({
      status: "issued",
      issue_date: new Date().toISOString(),
      prescription_number,
      qr_code_value,
      digital_signature_status: "internal_validated",
      template_id,
      template_version_id,
      template_snapshot_json: template_snapshot_json as never,
    })
    .eq("id", prescription_id);
  if (error) return { ok: false, error: error.message };

  // Best-effort: insert shortage alerts for items with insufficient stock
  try {
    const today = new Date().toISOString().slice(0, 10);
    for (const item of items as Array<{ id: string; generic_name: string; medication_id: string | null; quantity: number | null }>) {
      const needed = Number(item.quantity ?? 0);
      if (needed <= 0) continue;
      let stockActual = 0;
      if (item.medication_id) {
        const { data: lotes } = await supabase
          .from("lotes_medicamento")
          .select("existencia")
          .eq("medicamento_id", item.medication_id)
          .gt("existencia", 0)
          .gte("fecha_caducidad", today);
        stockActual = (lotes ?? []).reduce((s, l: { existencia: number }) => s + l.existencia, 0);
      }
      if (stockActual < needed) {
        await supabase.from("almacen_alertas" as never).insert({
          clinic_id: (rx as unknown as { clinic_id: string | null }).clinic_id ?? null,
          tipo: "faltante_receta",
          medicamento_id: item.medication_id ?? null,
          generic_name: item.medication_id ? null : item.generic_name,
          quantity_needed: needed,
          quantity_available: stockActual,
          prescription_id,
          prescription_item_id: item.id,
        });
      }
    }
  } catch {
    /* best-effort — never blocks prescription issuance */
  }

  return { ok: true, data: { number: prescription_number } };
}

export async function cancelPrescription(prescription_id: string, reason: string): Promise<RxResult> {
  const { error } = await supabase
    .from("prescriptions")
    .update({ status: "cancelled", notes: `Cancelada: ${reason}` })
    .eq("id", prescription_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Dispensar receta: descuenta inventario si hay lotes vinculados */
export async function dispensePrescription(
  prescription_id: string,
  dispenseLog: Array<{ item_id: string; lote_id?: string; quantity: number }>,
  partial = false,
): Promise<RxResult> {
  const { data: rx } = await supabase
    .from("prescriptions")
    .select("status")
    .eq("id", prescription_id)
    .maybeSingle();
  if (!rx) return { ok: false, error: "Receta no encontrada" };
  if (rx.status !== "issued" && rx.status !== "partially_dispensed") {
    return { ok: false, error: "Solo se pueden dispensar recetas emitidas" };
  }

  for (const log of dispenseLog) {
    const { data: item } = await supabase
      .from("prescription_items")
      .select("medication_id")
      .eq("id", log.item_id)
      .maybeSingle();
    if (item?.medication_id) {
      await supabase.from("movimientos_inventario").insert({
        medicamento_id: item.medication_id,
        lote_id: log.lote_id ?? null,
        cantidad: -Math.abs(log.quantity),
        tipo: "salida",
        motivo: `Surtido receta ${prescription_id}`,
      });
    }
  }

  const newStatus = partial ? "partially_dispensed" : "dispensed";
  const { error } = await supabase
    .from("prescriptions")
    .update({ status: newStatus })
    .eq("id", prescription_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
