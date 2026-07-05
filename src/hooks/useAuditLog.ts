import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";

export interface AuditEntry {
  id: string;
  clinic_id: string;
  tabla: string;
  registro_id: string | null;
  operacion: "INSERT" | "UPDATE" | "DELETE";
  campo: string | null;
  valor_antes: string | null;
  valor_despues: string | null;
  usuario_id: string | null;
  usuario_email: string | null;
  created_at: string;
}

export interface AuditFilters {
  tabla?: string;
  registro_id?: string;
  operacion?: string;
  desde?: string;
  hasta?: string;
  limit?: number;
}

export function useAuditLog() {
  const { activeClinicId } = useActiveClinic();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLog = useCallback(
    async (filters: AuditFilters = {}): Promise<AuditEntry[]> => {
      if (!activeClinicId) return [];
      setLoading(true);
      setError(null);
      try {
        const db = (supabase as any).from("audit_log");
        let q = db.select("*").eq("clinic_id", activeClinicId).order("created_at", { ascending: false });
        if (filters.tabla)       q = q.eq("tabla", filters.tabla);
        if (filters.registro_id) q = q.eq("registro_id", filters.registro_id);
        if (filters.operacion)   q = q.eq("operacion", filters.operacion);
        if (filters.desde)       q = q.gte("created_at", filters.desde);
        if (filters.hasta)       q = q.lte("created_at", filters.hasta);
        q = q.limit(filters.limit ?? 200);

        const { data, error: err } = await q;
        if (err) throw err;
        return (data || []) as AuditEntry[];
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [activeClinicId]
  );

  return { fetchLog, loading, error };
}
