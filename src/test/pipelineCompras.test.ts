import { describe, it, expect } from "vitest";
import {
  calcularEtapa,
  calcularResponsable,
  calcularDiasEnEtapa,
  esAtrasado,
  type EtapaPipeline,
} from "../hooks/usePipelineCompras";
import type { CicloRow } from "../hooks/useCicloCompras";

function fila(overrides: Partial<CicloRow> = {}): CicloRow {
  return {
    solicitud_id: "sc-1",
    clinic_id: "clinic-1",
    folio_solicitud: "SC-0001",
    estatus_solicitud: "aprobada",
    fecha_solicitud: "2026-06-01T00:00:00.000Z",
    solicitante_nombre: "Ana",
    cotizacion_id: null,
    folio_cotizacion: null,
    cotizacion_total_centavos: null,
    orden_id: null,
    folio_orden: null,
    estatus_orden: null,
    orden_total_centavos: null,
    aprobada_by: null,
    aprobada_at: null,
    recepcion_id: null,
    folio_recepcion: null,
    estatus_recepcion: null,
    fecha_recepcion: null,
    factura_id: null,
    folio_factura: null,
    estatus_factura: null,
    factura_total_centavos: null,
    match_status: null,
    match_diferencia_centavos: null,
    match_revisado_by: null,
    match_revisado_at: null,
    pago_id: null,
    fecha_pago: null,
    pago_monto_centavos: null,
    metodo_pago: null,
    ...overrides,
  };
}

describe("calcularEtapa", () => {
  it("solicitud sin cotización", () => {
    expect(calcularEtapa(fila())).toBe("solicitud");
  });
  it("cotización sin OC", () => {
    expect(calcularEtapa(fila({ cotizacion_id: "cot-1" }))).toBe("cotizacion");
  });
  it("OC sin recepción", () => {
    expect(calcularEtapa(fila({ cotizacion_id: "cot-1", orden_id: "oc-1" }))).toBe("orden_compra");
  });
  it("recepción sin factura", () => {
    expect(
      calcularEtapa(fila({ cotizacion_id: "cot-1", orden_id: "oc-1", recepcion_id: "gr-1" }))
    ).toBe("recepcion");
  });
  it("factura sin pago", () => {
    expect(
      calcularEtapa(
        fila({ cotizacion_id: "cot-1", orden_id: "oc-1", recepcion_id: "gr-1", factura_id: "fac-1" })
      )
    ).toBe("factura");
  });
  it("ciclo completo con pago", () => {
    expect(
      calcularEtapa(
        fila({
          cotizacion_id: "cot-1", orden_id: "oc-1", recepcion_id: "gr-1",
          factura_id: "fac-1", pago_id: "pago-1",
        })
      )
    ).toBe("pago");
  });
});

describe("calcularResponsable", () => {
  it("solicitud → compras", () => {
    expect(calcularResponsable(fila(), "solicitud")).toBe("compras");
  });
  it("cotización → compras", () => {
    expect(calcularResponsable(fila({ cotizacion_id: "cot-1" }), "cotizacion")).toBe("compras");
  });
  it("OC pendiente_aprobacion → gerencia", () => {
    expect(
      calcularResponsable(fila({ orden_id: "oc-1", estatus_orden: "pendiente_aprobacion" }), "orden_compra")
    ).toBe("gerencia");
  });
  it("OC confirmada → almacen", () => {
    expect(
      calcularResponsable(fila({ orden_id: "oc-1", estatus_orden: "confirmada" }), "orden_compra")
    ).toBe("almacen");
  });
  it("recepción → almacen", () => {
    expect(calcularResponsable(fila({ recepcion_id: "gr-1" }), "recepcion")).toBe("almacen");
  });
  it("factura con diferencia sin aprobar → gerencia", () => {
    expect(
      calcularResponsable(
        fila({ factura_id: "fac-1", match_diferencia_centavos: 500, match_status: "diferencia" }),
        "factura"
      )
    ).toBe("gerencia");
  });
  it("factura ok esperando pago → finanzas", () => {
    expect(
      calcularResponsable(
        fila({ factura_id: "fac-1", match_diferencia_centavos: 0, match_status: "ok" }),
        "factura"
      )
    ).toBe("finanzas");
  });
  it("pago → sin responsable", () => {
    expect(calcularResponsable(fila({ pago_id: "pago-1" }), "pago")).toBeNull();
  });
});

describe("calcularDiasEnEtapa + esAtrasado", () => {
  it("cuenta días desde fecha_solicitud en etapa solicitud", () => {
    const ahora = new Date("2026-06-05T00:00:00.000Z");
    const dias = calcularDiasEnEtapa(fila({ fecha_solicitud: "2026-06-01T00:00:00.000Z" }), "solicitud", ahora);
    expect(dias).toBe(4);
    expect(esAtrasado(dias, "solicitud")).toBe(true); // umbral solicitud = 2
  });
  it("no atrasado dentro del umbral", () => {
    const ahora = new Date("2026-06-02T00:00:00.000Z");
    const dias = calcularDiasEnEtapa(fila({ fecha_solicitud: "2026-06-01T00:00:00.000Z" }), "solicitud", ahora);
    expect(esAtrasado(dias, "solicitud")).toBe(false);
  });
  it("etapa pago nunca está atrasada", () => {
    expect(esAtrasado(9999, "pago" as EtapaPipeline)).toBe(false);
  });
  it("cuenta días desde fecha_recepcion (no desde aprobada_at) en etapa recepcion", () => {
    const ahora = new Date("2026-06-20T00:00:00.000Z");
    const row = fila({
      cotizacion_id: "cot-1",
      orden_id: "oc-1",
      aprobada_at: "2026-05-01T00:00:00.000Z",
      recepcion_id: "gr-1",
      fecha_recepcion: "2026-06-15T00:00:00.000Z",
      factura_id: null,
    });
    const dias = calcularDiasEnEtapa(row, "recepcion", ahora);
    expect(dias).toBe(5); // desde fecha_recepcion (15 jun), no desde aprobada_at (1 may)
  });
});
