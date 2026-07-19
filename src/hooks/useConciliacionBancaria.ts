import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { friendlyError } from "@/lib/errors";

export interface MatchFila {
  estado_cuenta_id: string;
  fecha: string;
  concepto: string | null;
  monto_centavos: number;
  sugerido_poliza_partida_id: string | null;
  sugerido_poliza_id: string | null;
  sugerido_folio: number | null;
  sugerido_fecha: string | null;
  dias_diferencia: number | null;
}

export function useConciliacionBancaria() {
  const { activeClinicId } = useActiveClinic();
  const [rows, setRows] = useState<MatchFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async (cuentaId: string) => {
    if (!activeClinicId || !cuentaId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await (supabase as any).rpc("contab_matching_bancario", {
      p_clinic_id: activeClinicId, p_cuenta_id: cuentaId,
    });
    if (err) setError(friendlyError(err));
    else setRows((data ?? []) as MatchFila[]);
    setLoading(false);
  }, [activeClinicId]);

  const importar = useCallback(async (cuentaId: string, lineas: { fecha: string; concepto: string; monto_centavos: number; referencia_banco: string }[]) => {
    if (!activeClinicId) return { error: "Sin clínica activa", insertadas: 0 };
    setImporting(true);
    const { data, error: err } = await (supabase as any).rpc("contab_importar_estado_cuenta", {
      p_clinic_id: activeClinicId, p_cuenta_id: cuentaId, p_lineas: lineas,
    });
    setImporting(false);
    if (err) return { error: friendlyError(err), insertadas: 0 };
    return { error: null, insertadas: (data ?? 0) as number };
  }, [activeClinicId]);

  const conciliar = useCallback(async (estadoCuentaId: string, polizaPartidaId: string) => {
    const { error: err } = await (supabase as any).rpc("contab_conciliar_linea", {
      p_estado_cuenta_id: estadoCuentaId, p_poliza_partida_id: polizaPartidaId,
    });
    return { error: err ? friendlyError(err) : null };
  }, []);

  return { rows, loading, error, load, importar, importing, conciliar };
}
