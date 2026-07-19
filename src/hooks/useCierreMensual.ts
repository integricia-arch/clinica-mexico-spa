import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedTable";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { friendlyError } from "@/lib/errors";

export interface CierreFila {
  id: string;
  periodo: string;
  poliza_cierre_id: string | null;
  cerrado_at: string | null;
}

export interface HuecoFila {
  tipo_hueco: "sin_referencia" | "sin_poliza";
  fecha: string;
  origen_id: string;
  descripcion: string | null;
  monto_centavos: number;
}

export interface ConciliaFila {
  turno_id: string;
  corte_id: string;
  corte_tipo: string;
  fecha_corte: string;
  total_corte_centavos: number;
  total_polizas_centavos: number;
  diferencia_centavos: number;
}

export function useCierresMensuales() {
  const { activeClinicId } = useActiveClinic();
  const [rows, setRows] = useState<CierreFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await untypedTable("contab_cierres")
      .select("id,periodo,poliza_cierre_id,cerrado_at")
      .eq("clinic_id", activeClinicId)
      .order("periodo", { ascending: false });
    if (err) setError(friendlyError(err));
    else setRows((data ?? []) as CierreFila[]);
    setLoading(false);
  }, [activeClinicId]);

  const cerrar = useCallback(async (periodo: string) => {
    if (!activeClinicId) return { error: "Sin clínica activa" };
    const { error: err } = await (supabase as any).rpc("cierre_mensual", {
      p_clinic_id: activeClinicId, p_periodo: periodo,
    });
    if (err) return { error: friendlyError(err) };
    await load();
    return { error: null };
  }, [activeClinicId, load]);

  return { rows, loading, error, load, cerrar };
}

export function useAuditoriaHuecos() {
  const { activeClinicId } = useActiveClinic();
  const [rows, setRows] = useState<HuecoFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (desde: string, hasta: string) => {
    if (!activeClinicId || !desde || !hasta) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await (supabase as any).rpc("contab_auditoria_huecos", {
      p_clinic_id: activeClinicId, p_desde: desde, p_hasta: hasta,
    });
    if (err) setError(friendlyError(err));
    else setRows((data ?? []) as HuecoFila[]);
    setLoading(false);
  }, [activeClinicId]);

  return { rows, loading, error, load };
}

export function useConciliaCortes() {
  const { activeClinicId } = useActiveClinic();
  const [rows, setRows] = useState<ConciliaFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (desde: string, hasta: string) => {
    if (!activeClinicId || !desde || !hasta) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await (supabase as any).rpc("contab_concilia_cortes", {
      p_clinic_id: activeClinicId, p_desde: desde, p_hasta: hasta,
    });
    if (err) setError(friendlyError(err));
    else setRows((data ?? []) as ConciliaFila[]);
    setLoading(false);
  }, [activeClinicId]);

  return { rows, loading, error, load };
}
