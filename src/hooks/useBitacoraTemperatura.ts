import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useAuth } from "@/hooks/useAuth";

export type ZonaTemp = "refrigeracion" | "congelacion" | "ambiente" | "cuarto_frio";

export const RANGOS_TEMP: Record<ZonaTemp, { min: number; max: number; label: string }> = {
  refrigeracion: { min: 2,   max: 8,   label: "Refrigeración (2–8 °C)" },
  congelacion:   { min: -25, max: -15, label: "Congelación (−25 a −15 °C)" },
  cuarto_frio:   { min: 2,   max: 15,  label: "Cuarto frío (2–15 °C)" },
  ambiente:      { min: 15,  max: 30,  label: "Temperatura ambiente (15–30 °C)" },
};

export interface LecturaTemp {
  id: string;
  clinic_id: string;
  zona: ZonaTemp;
  temperatura_celsius: number;
  humedad_pct: number | null;
  registrado_by: string | null;
  registrado_nombre: string | null;
  observaciones: string | null;
  fuera_de_rango: boolean;
  alerta_enviada: boolean;
  created_at: string;
}

export interface NuevaLectura {
  zona: ZonaTemp;
  temperatura_celsius: number;
  humedad_pct?: number;
  observaciones?: string;
}

export function useBitacoraTemperatura() {
  const { activeClinicId } = useActiveClinic();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLecturas = useCallback(
    async (zona?: ZonaTemp, limit = 100): Promise<LecturaTemp[]> => {
      if (!activeClinicId) return [];
      setLoading(true);
      setError(null);
      try {
        const db = supabase.from("bitacora_temperatura");
        let q = db.select("*").eq("clinic_id", activeClinicId).order("created_at", { ascending: false }).limit(limit);
        if (zona) q = q.eq("zona", zona);
        const { data, error: err } = await q;
        if (err) throw err;
        return (data || []) as LecturaTemp[];
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [activeClinicId]
  );

  const registrarLectura = useCallback(
    async (lectura: NuevaLectura): Promise<LecturaTemp> => {
      if (!activeClinicId) throw new Error("Sin clínica activa");
      setLoading(true);
      setError(null);
      try {
        const db = supabase.from("bitacora_temperatura");
        const { data, error: err } = await db
          .insert({
            clinic_id:           activeClinicId,
            zona:                lectura.zona,
            temperatura_celsius: lectura.temperatura_celsius,
            humedad_pct:         lectura.humedad_pct ?? null,
            observaciones:       lectura.observaciones ?? null,
            registrado_by:       user?.id ?? null,
            registrado_nombre:   user?.email ?? null,
          })
          .select()
          .single();
        if (err) throw err;
        return data as LecturaTemp;
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

  const fetchUltimaPorZona = useCallback(
    async (): Promise<Record<ZonaTemp, LecturaTemp | null>> => {
      if (!activeClinicId) return { refrigeracion: null, congelacion: null, ambiente: null, cuarto_frio: null };
      const zonas: ZonaTemp[] = ["refrigeracion", "congelacion", "ambiente", "cuarto_frio"];
      const result: Record<ZonaTemp, LecturaTemp | null> = {
        refrigeracion: null, congelacion: null, ambiente: null, cuarto_frio: null,
      };
      await Promise.all(
        zonas.map(async (zona) => {
          const db = supabase.from("bitacora_temperatura");
          const { data } = await db
            .select("*")
            .eq("clinic_id", activeClinicId)
            .eq("zona", zona)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          result[zona] = (data as LecturaTemp | null);
        })
      );
      return result;
    },
    [activeClinicId]
  );

  return { fetchLecturas, registrarLectura, fetchUltimaPorZona, loading, error };
}
