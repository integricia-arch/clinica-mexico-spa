import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";
import { supabase } from "@/integrations/supabase/client";

export interface FacturaProveedor {
  id: string;
  clinic_id: string;
  proveedor_id: string;
  proveedor_nombre?: string;
  orden_id: string | null;
  recepcion_id: string | null;
  recepcion_estatus: string | null;
  folio_interno: string;
  uuid_sat: string | null;
  serie_folio_proveedor: string;
  fecha_factura: string;
  fecha_vencimiento: string;
  subtotal_centavos: number;
  iva_centavos: number;
  total_centavos: number;
  saldo_pendiente_centavos: number;
  estatus: "provisional" | "pendiente" | "parcial" | "pagada" | "cancelada" | "en_disputa";
  es_provisional: boolean;
  moneda: string;
  concepto: string;
  notas: string;
  created_at: string;
  match_status: string;
  match_oc_total_centavos: number | null;
  match_recepcion_total_centavos: number | null;
  match_diferencia_centavos: number | null;
  match_notas: string | null;
}

export interface PagoProveedor {
  id: string;
  factura_id: string;
  proveedor_id: string;
  fecha_pago: string;
  monto_centavos: number;
  metodo_pago: "transferencia" | "cheque" | "efectivo" | "otro";
  referencia_bancaria: string;
  banco_origen: string;
  notas: string;
  created_at: string;
}

export interface FacturaInput {
  proveedor_id: string;
  orden_id: string | null;
  recepcion_id: string | null;
  uuid_sat: string;
  serie_folio_proveedor: string;
  fecha_factura: string;
  fecha_vencimiento: string;
  subtotal_centavos: number;
  iva_centavos: number;
  total_centavos: number;
  concepto: string;
  notas: string;
}

export interface PagoInput {
  fecha_pago: string;
  monto_centavos: number;
  metodo_pago: PagoProveedor["metodo_pago"];
  referencia_bancaria: string;
  banco_origen: string;
  notas: string;
}

interface FacturaRow {
  id: string;
  clinic_id: string;
  proveedor_id: string;
  proveedores?: { nombre: string } | null;
  orden_id: string | null;
  recepcion_id: string | null;
  recepciones_mercancia?: { estatus: string } | null;
  folio_interno: string;
  uuid_sat: string | null;
  serie_folio_proveedor: string | null;
  fecha_factura: string;
  fecha_vencimiento: string;
  subtotal_centavos: number;
  iva_centavos: number;
  total_centavos: number;
  saldo_pendiente_centavos: number;
  estatus: string;
  es_provisional: boolean | null;
  moneda: string;
  concepto: string | null;
  notas: string | null;
  created_at: string;
  match_status: string | null;
  match_oc_total_centavos: number | null;
  match_recepcion_total_centavos: number | null;
  match_diferencia_centavos: number | null;
  match_notas: string | null;
}

const toFactura = (row: FacturaRow): FacturaProveedor => ({
  id: row.id,
  clinic_id: row.clinic_id,
  proveedor_id: row.proveedor_id,
  proveedor_nombre: row.proveedores?.nombre ?? "",
  orden_id: row.orden_id,
  recepcion_id: row.recepcion_id,
  recepcion_estatus: row.recepciones_mercancia?.estatus ?? null,
  folio_interno: row.folio_interno,
  uuid_sat: row.uuid_sat,
  serie_folio_proveedor: row.serie_folio_proveedor ?? "",
  fecha_factura: row.fecha_factura,
  fecha_vencimiento: row.fecha_vencimiento,
  subtotal_centavos: row.subtotal_centavos,
  iva_centavos: row.iva_centavos,
  total_centavos: row.total_centavos,
  saldo_pendiente_centavos: row.saldo_pendiente_centavos,
  estatus: row.estatus as FacturaProveedor["estatus"],
  es_provisional: row.es_provisional ?? false,
  moneda: row.moneda,
  concepto: row.concepto ?? "",
  notas: row.notas ?? "",
  created_at: row.created_at,
  match_status: row.match_status ?? "sin_oc",
  match_oc_total_centavos: row.match_oc_total_centavos ?? null,
  match_recepcion_total_centavos: row.match_recepcion_total_centavos ?? null,
  match_diferencia_centavos: row.match_diferencia_centavos ?? null,
  match_notas: row.match_notas ?? null,
});

const nextFolioFact = (existing: string[]): string => {
  const nums = existing.map((f) => parseInt(f.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `FP-${String(max + 1).padStart(4, "0")}`;
};

export function useFacturasProveedor(clinicId: string | null) {
  const [items, setItems] = useState<FacturaProveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await untypedTable("facturas_proveedor")
        .select("*, proveedores(nombre), recepciones_mercancia!recepcion_id(estatus)")
        .eq("clinic_id", clinicId)
        .order("fecha_vencimiento", { ascending: true });
      if (qErr) throw qErr;
      setItems(((data ?? []) as FacturaRow[]).map(toFactura));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar las facturas."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (input: FacturaInput): Promise<string> => {
    if (!clinicId) throw new Error("No hay clínica activa.");

    // Detección de CFDI duplicado — bloquea si UUID ya existe en cualquier clínica
    const uuidTrimmed = input.uuid_sat.trim();
    if (uuidTrimmed) {
      const { data: dup } = await untypedTable("facturas_proveedor")
        .select("folio_interno, fecha_factura, proveedores(nombre)")
        .eq("uuid_sat", uuidTrimmed)
        .maybeSingle() as { data: { folio_interno: string; fecha_factura: string; proveedores: { nombre: string } | null } | null };
      if (dup) {
        const prov = dup.proveedores?.nombre ?? "proveedor desconocido";
        throw new Error(
          `UUID duplicado: este CFDI ya está registrado en ${dup.folio_interno} (${prov}, ${dup.fecha_factura}). No se puede registrar dos veces el mismo folio fiscal.`
        );
      }
    }

    const folio = nextFolioFact(items.map((f) => f.folio_interno));

    // Fecha límite de pronto pago = fecha_factura + días configurados en el proveedor.
    // Sin esto el KPI kpi_descuento_pronto_pago nunca detecta pagos a tiempo (columna
    // siempre NULL) aunque el proveedor sí tenga descuento configurado.
    const { data: provData } = await untypedTable("proveedores")
      .select("dias_pronto_pago")
      .eq("id", input.proveedor_id)
      .maybeSingle() as { data: { dias_pronto_pago: number | null } | null };
    const diasProntoPago = provData?.dias_pronto_pago;
    const fechaLimiteProntoPago = diasProntoPago && diasProntoPago > 0
      ? new Date(new Date(input.fecha_factura).getTime() + diasProntoPago * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      : null;

    const { data, error: cErr } = await untypedTable("facturas_proveedor")
      .insert({
        clinic_id: clinicId,
        folio_interno: folio,
        proveedor_id: input.proveedor_id,
        orden_id: input.orden_id,
        recepcion_id: input.recepcion_id,
        uuid_sat: input.uuid_sat.trim() || null,
        serie_folio_proveedor: input.serie_folio_proveedor.trim() || null,
        fecha_factura: input.fecha_factura,
        fecha_vencimiento: input.fecha_vencimiento,
        fecha_limite_pronto_pago: fechaLimiteProntoPago,
        subtotal_centavos: input.subtotal_centavos,
        iva_centavos: input.iva_centavos,
        total_centavos: input.total_centavos,
        saldo_pendiente_centavos: input.total_centavos,
        concepto: input.concepto.trim() || null,
        notas: input.notas.trim() || null,
      })
      .select("id")
      .single();
    if (cErr) throw new Error(friendlyError(cErr, "No se pudo registrar la factura."));
    await load();
    return (data as { id: string }).id;
  }, [clinicId, items, load]);

  const registrarPago = useCallback(async (facturaId: string, input: PagoInput): Promise<void> => {
    if (!clinicId) throw new Error("No hay clínica activa.");

    // Insertar pago
    const { error: pErr } = await untypedTable("pagos_proveedor").insert({
      clinic_id: clinicId,
      factura_id: facturaId,
      proveedor_id: items.find((f) => f.id === facturaId)?.proveedor_id ?? "",
      fecha_pago: input.fecha_pago,
      monto_centavos: input.monto_centavos,
      metodo_pago: input.metodo_pago,
      referencia_bancaria: input.referencia_bancaria.trim() || null,
      banco_origen: input.banco_origen.trim() || null,
      notas: input.notas.trim() || null,
    });
    if (pErr) throw new Error(friendlyError(pErr, "No se pudo registrar el pago."));

    // Actualizar saldo y estatus de la factura
    const factura = items.find((f) => f.id === facturaId);
    if (factura) {
      const nuevoSaldo = Math.max(0, factura.saldo_pendiente_centavos - input.monto_centavos);
      const nuevoEstatus = nuevoSaldo === 0 ? "pagada" : "parcial";
      await untypedTable("facturas_proveedor").update({
        saldo_pendiente_centavos: nuevoSaldo,
        estatus: nuevoEstatus,
      }).eq("id", facturaId);
    }

    await load();
  }, [clinicId, items, load]);

  const getPagos = useCallback(async (facturaId: string): Promise<PagoProveedor[]> => {
    const { data, error: qErr } = await untypedTable("pagos_proveedor")
      .select("*")
      .eq("factura_id", facturaId)
      .order("fecha_pago", { ascending: false });
    if (qErr) throw new Error(friendlyError(qErr, "No se pudieron cargar los pagos."));
    return (data ?? []) as PagoProveedor[];
  }, []);

  const confirmarProvisional = useCallback(async (provId: string, input: FacturaInput): Promise<void> => {
    if (!clinicId) throw new Error("No hay clínica activa.");
    const uuidTrimmed = input.uuid_sat.trim();
    if (uuidTrimmed) {
      const { data: dup } = await untypedTable("facturas_proveedor")
        .select("folio_interno, fecha_factura, proveedores(nombre)")
        .eq("uuid_sat", uuidTrimmed)
        .neq("id", provId)
        .maybeSingle() as { data: { folio_interno: string; fecha_factura: string; proveedores: { nombre: string } | null } | null };
      if (dup) {
        const prov = dup.proveedores?.nombre ?? "proveedor desconocido";
        throw new Error(`UUID duplicado: ya registrado en ${dup.folio_interno} (${prov}, ${dup.fecha_factura}).`);
      }
    }
    const { error: uErr } = await untypedTable("facturas_proveedor").update({
      uuid_sat: uuidTrimmed || null,
      serie_folio_proveedor: input.serie_folio_proveedor.trim() || null,
      fecha_factura: input.fecha_factura,
      fecha_vencimiento: input.fecha_vencimiento,
      subtotal_centavos: input.subtotal_centavos,
      iva_centavos: input.iva_centavos,
      total_centavos: input.total_centavos,
      saldo_pendiente_centavos: input.total_centavos,
      concepto: input.concepto.trim() || null,
      notas: input.notas.trim() || null,
      estatus: "pendiente",
      es_provisional: false,
    }).eq("id", provId);
    if (uErr) throw new Error(friendlyError(uErr, "No se pudo confirmar la factura provisional."));
    await load();
  }, [clinicId, load]);

  const pendientes = items.filter((f) => f.estatus === "pendiente" || f.estatus === "parcial" || f.estatus === "provisional");
  const vencidas = items.filter((f) => (f.estatus === "pendiente" || f.estatus === "parcial") && new Date(f.fecha_vencimiento) < new Date());
  const provisionales = items.filter((f) => f.es_provisional);

  // COSO: aprobar factura con diferencia 4-way match — solo admin/manager vía RPC
  const aprobarDiferencia = useCallback(async (facturaId: string, notas?: string): Promise<void> => {
    const { error: rErr } = await (supabase as any).rpc(
      "aprobar_diferencia_factura" as never,
      { p_factura_id: facturaId, p_notas: notas ?? null } as never
    );
    if (rErr) throw new Error(friendlyError(rErr as never, "No se pudo aprobar la diferencia."));
    await load();
  }, [load]);

  return { items, loading, error, create, registrarPago, getPagos, confirmarProvisional, aprobarDiferencia, pendientes, vencidas, provisionales, refresh: load };
}
