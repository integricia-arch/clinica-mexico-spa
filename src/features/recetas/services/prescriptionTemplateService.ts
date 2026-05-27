import { supabase } from "@/integrations/supabase/client";

export interface DoctorPrescriptionTemplate {
  id: string;
  doctor_id: string;
  consultorio_nombre: string | null;
  consultorio_direccion: string | null;
  consultorio_telefono: string | null;
  consultorio_email: string | null;
  logo_path: string | null;
  firma_path: string | null;
  color_primario: string | null;
  encabezado_extra: string | null;
  pie_pagina: string | null;
  indicaciones_default: string | null;
  mostrar_qr: boolean;
  mostrar_cedula: boolean;
  mostrar_especialidad: boolean;
  mostrar_firma: boolean;
  tamano_papel: string;
  current_version_id: string | null;
  current_version_number: number;
  updated_at: string;
}

export type TemplatePatch = Partial<Omit<DoctorPrescriptionTemplate, "id" | "doctor_id" | "updated_at">>;

/** Obtiene el doctor_id ligado al usuario actual (o null si no es doctor). */
export async function getCurrentDoctorId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("doctors")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.id ?? null;
}

/** Carga el machote del doctor; si no existe, lo crea con defaults. */
export async function getOrCreateTemplate(doctorId: string): Promise<DoctorPrescriptionTemplate> {
  const { data: existing } = await supabase
    .from("doctor_prescription_templates")
    .select("*")
    .eq("doctor_id", doctorId)
    .maybeSingle();
  if (existing) return existing as DoctorPrescriptionTemplate;

  const { data: created, error } = await supabase
    .from("doctor_prescription_templates")
    .insert({ doctor_id: doctorId })
    .select("*")
    .single();
  if (error) throw error;
  return created as DoctorPrescriptionTemplate;
}

export async function saveTemplate(id: string, patch: TemplatePatch): Promise<void> {
  const { error } = await supabase
    .from("doctor_prescription_templates")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

/** Publica una nueva versión inmutable a partir del estado actual del machote. */
export async function publishTemplateVersion(
  template: DoctorPrescriptionTemplate,
  reason?: string,
): Promise<{ version_id: string; version_number: number }> {
  const nextNumber = (template.current_version_number ?? 0) + 1;
  const { data: { user } } = await supabase.auth.getUser();

  const snapshot = { ...template, snapshot_taken_at: new Date().toISOString() };

  const { data: ver, error: vErr } = await supabase
    .from("doctor_prescription_template_versions")
    .insert({
      template_id: template.id,
      doctor_id: template.doctor_id,
      version_number: nextNumber,
      snapshot_json: snapshot,
      published_by: user?.id ?? null,
      publish_reason: reason ?? null,
    })
    .select("id, version_number")
    .single();
  if (vErr || !ver) throw vErr ?? new Error("No se pudo publicar la versión");

  const { error: uErr } = await supabase
    .from("doctor_prescription_templates")
    .update({
      current_version_id: ver.id,
      current_version_number: ver.version_number,
    })
    .eq("id", template.id);
  if (uErr) throw uErr;

  return { version_id: ver.id, version_number: ver.version_number };
}

/** Sube un asset (logo/firma) al bucket doctor-assets bajo {doctor_id}/{kind}.{ext} */
export async function uploadDoctorAsset(
  doctorId: string,
  kind: "logo" | "firma",
  file: File,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${doctorId}/${kind}.${ext}`;
  const { error } = await supabase.storage
    .from("doctor-assets")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function getAssetSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from("doctor-assets")
    .createSignedUrl(path, 60 * 60); // 1h
  return data?.signedUrl ?? null;
}

export async function listVersions(templateId: string) {
  const { data } = await supabase
    .from("doctor_prescription_template_versions")
    .select("id, version_number, published_at, publish_reason")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false });
  return data ?? [];
}
