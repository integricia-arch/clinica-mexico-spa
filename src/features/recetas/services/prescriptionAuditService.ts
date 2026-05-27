import { supabase } from "@/integrations/supabase/client";

export type PrescriptionEvent =
  | "printed"
  | "reprinted"
  | "verified_scan"
  | "viewed_by_patient"
  | "issued"
  | "cancelled"
  | "dispensed";

export async function logPrescriptionEvent(
  prescriptionId: string,
  event: PrescriptionEvent,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.rpc("log_audit", {
      _accion: "actualizar",
      _tabla: "prescriptions",
      _registro_id: prescriptionId,
      _datos_nuevos: { event, at: new Date().toISOString(), ...(extra ?? {}) } as never,
    });
  } catch {
    /* mejor esfuerzo */
  }
}

/** Cuenta cuántas impresiones previas existen para detectar reimpresión. */
export async function countPrintEvents(prescriptionId: string): Promise<number> {
  const { data } = await supabase
    .from("audit_logs")
    .select("id, datos_nuevos")
    .eq("tabla", "prescriptions")
    .eq("registro_id", prescriptionId);
  if (!data) return 0;
  return data.filter((r: any) => {
    const ev = r.datos_nuevos?.event;
    return ev === "printed" || ev === "reprinted";
  }).length;
}

export interface PrescriptionAuditEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  accion: string;
  event: string | null;
  raw: any;
}

export async function getPrescriptionAudit(prescriptionId: string): Promise<PrescriptionAuditEntry[]> {
  const { data } = await supabase
    .from("audit_logs")
    .select("id, created_at, user_id, accion, datos_nuevos, datos_anteriores")
    .eq("tabla", "prescriptions")
    .eq("registro_id", prescriptionId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    user_id: r.user_id,
    accion: r.accion,
    event: r.datos_nuevos?.event ?? null,
    raw: r,
  }));
}
