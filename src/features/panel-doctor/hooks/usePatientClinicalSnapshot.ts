import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listStudiesByPatient, type PatientStudy } from "../services/studiesService";

export interface PatientRow {
  id?: string;
  nombre?: string | null;
  apellidos?: string | null;
  fecha_nacimiento?: string | null;
  sexo?: string | null;
  telefono?: string | null;
  tipo_sangre?: string | null;
  alergias?: string | null;
  notas?: string | null;
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
  [key: string]: unknown;
}
export interface ExpedienteRow {
  id?: string;
  patient_id?: string | null;
  doctor_id?: string | null;
  [key: string]: unknown;
}
export interface NotaRow {
  id?: string;
  expediente_id?: string | null;
  fecha_consulta?: string | null;
  diagnostico_principal?: string | null;
  subjetivo?: string | null;
  [key: string]: unknown;
}
export interface RecetaRow {
  id?: string;
  prescription_number?: string | null;
  created_at?: string | null;
  status?: string | null;
  diagnosis?: string | null;
  [key: string]: unknown;
}

export interface PatientSnapshot {
  patient: PatientRow | null;
  expediente: ExpedienteRow | null;
  notas: NotaRow[];
  recetas: RecetaRow[];
  studies: PatientStudy[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function usePatientClinicalSnapshot(patientId: string | null, doctorId: string | null, clinicId: string | null): PatientSnapshot {
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [expediente, setExpediente] = useState<ExpedienteRow | null>(null);
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [recetas, setRecetas] = useState<RecetaRow[]>([]);
  const [studies, setStudies] = useState<PatientStudy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!patientId) {
      setPatient(null);
      setExpediente(null);
      setNotas([]);
      setRecetas([]);
      setStudies([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [p, e, r, st] = await Promise.all([
        (supabase as any).from("patients").select("*").eq("id", patientId).maybeSingle(),
        doctorId
          ? (supabase as any)
              .from("expedientes")
              .select("*")
              .eq("patient_id", patientId)
              .eq("doctor_id", doctorId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        (supabase as any)
          .from("prescriptions")
          .select("id, prescription_number, created_at, status, diagnosis")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(10),
        clinicId ? listStudiesByPatient(patientId, clinicId) : Promise.resolve([]),
      ]);
      setPatient(p.data as PatientRow ?? null);
      const exp = (e.data as ExpedienteRow) ?? null;
      setExpediente(exp);
      setRecetas((r.data ?? []) as RecetaRow[]);
      setStudies(st);

      if (exp?.id) {
        const { data: n } = await (supabase as any)
          .from("notas_consulta")
          .select("*")
          .eq("expediente_id", exp.id as string)
          .order("fecha_consulta", { ascending: false })
          .limit(10);
        setNotas((n ?? []) as NotaRow[]);
      } else {
        setNotas([]);
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Error cargando contexto");
    } finally {
      setLoading(false);
    }
  }, [patientId, doctorId, clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  return { patient, expediente, notas, recetas, studies, loading, error, reload: load };
}
