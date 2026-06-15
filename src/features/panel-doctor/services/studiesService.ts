import { supabase } from "@/integrations/supabase/client";

// Tipos locales (la tabla puede no estar aún regenerada en types.ts)
export interface PatientStudy {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  journey_instance_id: string | null;
  expediente_id: string | null;
  consultation_note_id: string | null;
  tipo: "lab" | "imagen" | "otro";
  nombre: string;
  motivo: string | null;
  prioridad: "rutina" | "urgente" | "stat";
  area_laboratorio: string | null;
  requiere_ayuno: boolean;
  indicaciones_paciente: string | null;
  observaciones: string | null;
  status: "solicitado" | "recibido" | "revisado" | "reutilizado" | "descartado";
  solicitado_at: string;
  solicitado_por: string | null;
  recibido_at: string | null;
  recibido_por: string | null;
  revisado_at: string | null;
  revisado_por: string | null;
  resultado_resumen: string | null;
  interpretacion_medica: string | null;
  archivo_url: string | null;
  laboratorio_origen: string | null;
  replaces_study_id: string | null;
  justificacion_repeticion: string | null;
  created_at: string;
  updated_at: string;
}

// patient_studies is not yet in the generated Supabase types — suppress until regenerated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => supabase.from(name as any);

export async function listStudiesByPatient(patientId: string): Promise<PatientStudy[]> {
  const { data, error } = await tbl("patient_studies")
    .select("*")
    .eq("patient_id", patientId)
    .order("solicitado_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PatientStudy[];
}

export async function listStudiesByJourney(journeyId: string): Promise<PatientStudy[]> {
  const { data, error } = await tbl("patient_studies")
    .select("*")
    .eq("journey_instance_id", journeyId)
    .order("solicitado_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PatientStudy[];
}

export async function requestStudy(input: {
  patient_id: string;
  doctor_id: string;
  appointment_id?: string | null;
  journey_instance_id?: string | null;
  expediente_id?: string | null;
  consultation_note_id?: string | null;
  tipo: "lab" | "imagen" | "otro";
  nombre: string;
  motivo?: string | null;
  prioridad?: "rutina" | "urgente" | "stat";
  area_laboratorio?: string | null;
  requiere_ayuno?: boolean;
  indicaciones_paciente?: string | null;
  observaciones?: string | null;
  replaces_study_id?: string | null;
  justificacion_repeticion?: string | null;
}): Promise<PatientStudy> {
  const { data: u } = await supabase.auth.getUser();
  const payload = {
    ...input,
    prioridad: input.prioridad ?? "rutina",
    requiere_ayuno: input.requiere_ayuno ?? false,
    status: "solicitado",
    solicitado_por: u.user?.id ?? null,
  };
  const { data, error } = await tbl("patient_studies")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(payload as any)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as PatientStudy;
}

export async function registerStudyResult(
  studyId: string,
  payload: {
    resultado_resumen?: string | null;
    archivo_url?: string | null;
    laboratorio_origen?: string | null;
    observaciones?: string | null;
  },
): Promise<PatientStudy> {
  const { data: u } = await supabase.auth.getUser();
  const updatePayload = {
    ...payload,
    status: "recibido",
    recibido_at: new Date().toISOString(),
    recibido_por: u.user?.id ?? null,
  };
  const { data, error } = await tbl("patient_studies")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updatePayload as any)
    .eq("id", studyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as PatientStudy;
}

export async function reviewStudy(
  studyId: string,
  payload: { interpretacion_medica: string },
): Promise<PatientStudy> {
  const { data: u } = await supabase.auth.getUser();
  const updatePayload = {
    interpretacion_medica: payload.interpretacion_medica,
    status: "revisado",
    revisado_at: new Date().toISOString(),
    revisado_por: u.user?.id ?? null,
  };
  const { data, error } = await tbl("patient_studies")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updatePayload as any)
    .eq("id", studyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as PatientStudy;
}

export function hasPendingStudies(studies: PatientStudy[]): boolean {
  return studies.some((s) => s.status === "solicitado");
}

export function hasUnreviewedResults(studies: PatientStudy[]): boolean {
  return studies.some((s) => s.status === "recibido");
}
