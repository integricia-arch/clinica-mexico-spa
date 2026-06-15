import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useAuth } from "@/hooks/useAuth";

export interface PresupuestoCategoria {
  id: string;
  clinic_id: string;
  categoria: string;
  periodo_mes: number;
  periodo_anio: number;
  monto_presupuestado_centavos: number;
  alerta_pct: number;
  created_at: string;
  updated_at: string;
}

export interface PresupuestoEjecucion extends PresupuestoCategoria {
  ejecutado_centavos: number;
  pct_ejecutado: number;
}

export interface NuevoPresupuesto {
  categoria: string;
  periodo_mes: number;
  periodo_anio: number;
  monto_presupuestado_centavos: number;
  alerta_pct?: number;
}

export function usePresupuesto() {
  const { activeClinicId } = useActiveClinic();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEjecucion = useCallback(
    async (mes?: number, anio?: number): Promise<PresupuestoEjecucion[]> => {
      if (!activeClinicId) return [];
      setLoading(true);
      setError(null);
      try {
        const hoy = new Date();
        const m = mes   ?? hoy.getMonth() + 1;
        const a = anio  ?? hoy.getFullYear();

        const db = supabase.from("v_presupuesto_ejecucion" as never) as ReturnType<typeof supabase.from>;
        const { data, error: err } = await db
          .select("*")
          .eq("clinic_id", activeClinicId)
          .eq("periodo_mes", m)
          .eq("periodo_anio", a)
          .order("pct_ejecutado", { ascending: false });
        if (err) throw err;
        return (data || []) as PresupuestoEjecucion[];
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [activeClinicId]
  );

  const upsertPresupuesto = useCallback(
    async (input: NuevoPresupuesto): Promise<PresupuestoCategoria> => {
      if (!activeClinicId) throw new Error("Sin clínica activa");
      setLoading(true);
      setError(null);
      try {
        const db = supabase.from("presupuesto_categorias" as never) as ReturnType<typeof supabase.from>;
        const { data, error: err } = await db
          .upsert(
            {
              clinic_id:                    activeClinicId,
              categoria:                    input.categoria,
              periodo_mes:                  input.periodo_mes,
              periodo_anio:                 input.periodo_anio,
              monto_presupuestado_centavos: input.monto_presupuestado_centavos,
              alerta_pct:                   input.alerta_pct ?? 80,
              created_by:                   user?.id ?? null,
            },
            { onConflict: "clinic_id,categoria,periodo_mes,periodo_anio" }
          )
          .select()
          .single();
        if (err) throw err;
        return data as PresupuestoCategoria;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [activeClinicId, user]
  );

  const deletePresupuesto = useCallback(
    async (id: string): Promise<void> => {
      if (!activeClinicId) throw new Error("Sin clínica activa");
      const db = supabase.from("presupuesto_categorias" as never) as ReturnType<typeof supabase.from>;
      const { error: err } = await db.delete().eq("id", id).eq("clinic_id", activeClinicId);
      if (err) throw err;
    },
    [activeClinicId]
  );

  return { fetchEjecucion, upsertPresupuesto, deletePresupuesto, loading, error };
}
