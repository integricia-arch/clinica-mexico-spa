import { useMemo } from "react";
import { differenceInDays, parseISO } from "date-fns";
import { useCicloCompras, CicloRow } from "@/hooks/useCicloCompras";

export type EtapaPipeline =
  | "solicitud"
  | "cotizacion"
  | "orden_compra"
  | "recepcion"
  | "factura"
  | "pago";

export type RolResponsable = "compras" | "gerencia" | "almacen" | "finanzas";

export interface PipelineItem extends CicloRow {
  etapa: EtapaPipeline;
  diasEnEtapa: number;
  responsable: RolResponsable | null;
  atrasado: boolean;
}

export const UMBRAL_DIAS: Record<EtapaPipeline, number> = {
  solicitud: 2,
  cotizacion: 3,
  orden_compra: 5,
  recepcion: 2,
  factura: 7,
  pago: Infinity,
};

export function calcularEtapa(row: CicloRow): EtapaPipeline {
  if (row.pago_id != null) return "pago";
  if (row.factura_id != null) return "factura";
  if (row.recepcion_id != null) return "recepcion";
  if (row.orden_id != null) return "orden_compra";
  if (row.cotizacion_id != null) return "cotizacion";
  return "solicitud";
}

function tieneDiferenciaSinAprobar(row: CicloRow): boolean {
  return (
    row.match_diferencia_centavos !== null &&
    row.match_diferencia_centavos !== 0 &&
    row.match_status !== "aprobado_gerente" &&
    row.match_status !== "ok"
  );
}

export function calcularResponsable(row: CicloRow, etapa: EtapaPipeline): RolResponsable | null {
  switch (etapa) {
    case "solicitud":
    case "cotizacion":
      return "compras";
    case "orden_compra":
      return row.estatus_orden === "pendiente_aprobacion" ? "gerencia" : "almacen";
    case "recepcion":
      return "almacen";
    case "factura":
      return tieneDiferenciaSinAprobar(row) ? "gerencia" : "finanzas";
    case "pago":
      return null;
  }
}

// v_ciclo_compras no expone una fecha propia de creación de la cotización;
// se usa fecha_solicitud como referencia de antigüedad del ciclo en esa etapa.
function fechaReferencia(row: CicloRow, etapa: EtapaPipeline): string | null {
  switch (etapa) {
    case "solicitud":
    case "cotizacion":
      return row.fecha_solicitud;
    case "orden_compra":
      return row.aprobada_at ?? row.fecha_solicitud;
    case "recepcion":
      return row.fecha_recepcion ?? row.aprobada_at ?? row.fecha_solicitud;
    case "factura":
      return row.fecha_recepcion ?? row.aprobada_at ?? row.fecha_solicitud;
    case "pago":
      return null;
  }
}

export function calcularDiasEnEtapa(
  row: CicloRow,
  etapa: EtapaPipeline,
  ahora: Date = new Date()
): number {
  const fecha = fechaReferencia(row, etapa);
  if (!fecha) return 0;
  return Math.max(0, differenceInDays(ahora, parseISO(fecha)));
}

export function esAtrasado(diasEnEtapa: number, etapa: EtapaPipeline): boolean {
  return diasEnEtapa > UMBRAL_DIAS[etapa];
}

export function usePipelineCompras(clinicId: string | null) {
  const { rows, loading, error, refresh } = useCicloCompras(clinicId);

  const items: PipelineItem[] = useMemo(() => {
    const ahora = new Date();
    return rows
      .filter((r) => r.pago_id == null)
      .map((r) => {
        const etapa = calcularEtapa(r);
        const diasEnEtapa = calcularDiasEnEtapa(r, etapa, ahora);
        return {
          ...r,
          etapa,
          diasEnEtapa,
          responsable: calcularResponsable(r, etapa),
          atrasado: esAtrasado(diasEnEtapa, etapa),
        };
      });
  }, [rows]);

  const completados = useMemo(
    () => rows.filter((r) => r.pago_id != null).length,
    [rows]
  );

  return { items, completados, loading, error, refresh };
}
