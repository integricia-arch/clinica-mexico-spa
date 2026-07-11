import { supabase } from "@/integrations/supabase/client";

export function buildPhiAccessLogArgs(
  clinicId: string,
  patientId: string,
  tabla: string,
  accion: "select" | "export" = "select",
) {
  return {
    p_clinic_id: clinicId,
    p_patient_id: patientId,
    p_tabla: tabla,
    p_accion: accion,
  };
}

export async function logPhiAccess(
  clinicId: string,
  patientId: string,
  tabla: string,
  accion: "select" | "export" = "select",
): Promise<void> {
  const { error } = await supabase.rpc(
    "log_phi_access",
    buildPhiAccessLogArgs(clinicId, patientId, tabla, accion),
  );
  if (error) {
    console.error("[phi_access_log]", tabla, patientId, error);
  }
}
