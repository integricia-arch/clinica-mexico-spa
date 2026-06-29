import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

export interface CicloRow {
  solicitud_id: string;
  clinic_id: string;
  folio_solicitud: string;
  estatus_solicitud: string;
  fecha_solicitud: string;
  solicitante_nombre: string | null;
  cotizacion_id: string | null;
  folio_cotizacion: string | null;
  cotizacion_total_centavos: number | null;
  orden_id: string | null;
  folio_orden: string | null;
  estatus_orden: string | null;
  orden_total_centavos: number | null;
  aprobada_by: string | null;
  aprobada_at: string | null;
  recepcion_id: string | null;
  folio_recepcion: string | null;
  estatus_recepcion: string | null;
  fecha_recepcion: string | null;
  factura_id: string | null;
  folio_factura: string | null;
  estatus_factura: string | null;
  factura_total_centavos: number | null;
  match_status: string | null;
  match_diferencia_centavos: number | null;
  match_revisado_by: string | null;
  match_revisado_at: string | null;
  pago_id: string | null;
  fecha_pago: string | null;
  pago_monto_centavos: number | null;
  metodo_pago: string | null;
}

export interface CicloStats {
  scSinConvertir: CicloRow[];
  diferenciasParaAprobar: CicloRow[];
  leadTimeScOcDias: number | null;
  leadTimeOcGrDias: number | null;
  ciclosCompletos: number;
  ciclosTotales: number;
}

export function useCicloCompras(clinicId: string | null) {
  const [rows, setRows] = useState<CicloRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      // ponytail: cast needed because v_ciclo_compras is a view not in generated types
      const { data, error: qErr } = await (supabase as never as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (col: string, val: string) => Promise<{ data: CicloRow[] | null; error: unknown }>;
          };
        };
      }).from("v_ciclo_compras")
        .select("*")
        .eq("clinic_id", clinicId);
      if (qErr) throw qErr;
      setRows(data ?? []);
    } catch (e) {
      setError(friendlyError(e as never, "No se pudo cargar el ciclo de compras."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const stats: CicloStats = (() => {
    const scSinConvertir = rows.filter(
      (r) => r.orden_id == null && ["aprobada", "enviada"].includes(r.estatus_solicitud)
    );

    const diferenciasParaAprobar = rows.filter(
      (r) =>
        r.match_diferencia_centavos !== null &&
        r.match_diferencia_centavos !== 0 &&
        r.match_status !== "aprobado_gerente" &&
        r.match_status !== "ok"
    );

    const scOcDias = rows
      .filter((r) => r.aprobada_at && r.fecha_solicitud)
      .map((r) => (new Date(r.aprobada_at!).getTime() - new Date(r.fecha_solicitud).getTime()) / 86400000)
      .filter((d) => d >= 0);
    const leadTimeScOcDias = scOcDias.length
      ? Math.round(scOcDias.reduce((a, b) => a + b, 0) / scOcDias.length)
      : null;

    const ocGrDias = rows
      .filter((r) => r.aprobada_at && r.fecha_recepcion)
      .map((r) => (new Date(r.fecha_recepcion!).getTime() - new Date(r.aprobada_at!).getTime()) / 86400000)
      .filter((d) => d >= 0);
    const leadTimeOcGrDias = ocGrDias.length
      ? Math.round(ocGrDias.reduce((a, b) => a + b, 0) / ocGrDias.length)
      : null;

    const ciclosCompletos = new Set(
      rows.filter((r) => r.pago_id != null).map((r) => r.solicitud_id)
    ).size;
    const ciclosTotales = new Set(rows.map((r) => r.solicitud_id)).size;

    return { scSinConvertir, diferenciasParaAprobar, leadTimeScOcDias, leadTimeOcGrDias, ciclosCompletos, ciclosTotales };
  })();

  return { rows, loading, error, stats, refresh: load };
}
