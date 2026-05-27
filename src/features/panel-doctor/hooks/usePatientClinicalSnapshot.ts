import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listStudiesByPatient, type PatientStudy } from "../services/studiesService";

export interface PatientSnapshot {
  patient: any | null;
  expediente: any | null;
  notas: any[];
  recetas: any[];
  studies: PatientStudy[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function usePatientClinicalSnapshot(patientId: string | null, doctorId: string | null): PatientSnapshot {
  const [patient, setPatient] = useState<any | null>(null);
  const [expediente, setExpediente] = useState<any | null>(null);
  const [notas, setNotas] = useState<any[]>([]);
  const [recetas, setRecetas] = useState<any[]>([]);
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
        supabase.from("patients").select("*").eq("id", patientId).maybeSingle(),
        doctorId
          ? supabase
              .from("expedientes")
              .select("*")
              .eq("patient_id", patientId)
              .eq("doctor_id", doctorId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("prescriptions")
          .select("id, prescription_number, created_at, status, diagnosis")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(10),
        listStudiesByPatient(patientId),
      ]);
      setPatient(p.data ?? null);
      const exp = (e as any)?.data ?? null;
      setExpediente(exp);
      setRecetas((r.data ?? []) as any[]);
      setStudies(st);

      if (exp?.id) {
        const { data: n } = await supabase
          .from("notas_consulta")
          .select("*")
          .eq("expediente_id", exp.id)
          .order("fecha_consulta", { ascending: false })
          .limit(10);
        setNotas((n ?? []) as any[]);
      } else {
        setNotas([]);
      }
    } catch (err: any) {
      setError(err?.message ?? "Error cargando contexto");
    } finally {
      setLoading(false);
    }
  }, [patientId, doctorId]);

  useEffect(() => {
    load();
  }, [load]);

  return { patient, expediente, notas, recetas, studies, loading, error, reload: load };
}
