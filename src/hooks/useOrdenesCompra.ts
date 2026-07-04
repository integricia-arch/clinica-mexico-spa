import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";
import { supabase } from "@/integrations/supabase/client";

export interface OrdenCompraItem {
  id: string;
  orden_id: string;
  medicamento_id: string;
  medicamento_nombre?: string;
  cantidad_pedida: number;
  cantidad_recibida: number;
  precio_unitario_centavos: number;
  tasa_iva: number;
  subtotal_centavos: number;
}

export interface OrdenCompra {
  id: string;
  clinic_id: string;
  folio: string;
  proveedor_id: string;
  proveedor_nombre?: string;
  estatus: "borrador" | "pendiente_aprobacion" | "confirmada" | "parcial" | "recibida" | "cancelada" | "rechazada";
  fecha_emision: string;
  fecha_entrega_est: string | null;
  terminos_pago: number;
  moneda: string;
  subtotal_centavos: number;
  iva_centavos: number;
  total_centavos: number;
  notas: string;
  requiere_anticipo: boolean;
  created_at: string;
  items?: OrdenCompraItem[];
}

export interface OrdenCompraItemInput {
  medicamento_id: string;
  cantidad_pedida: number;
  precio_unitario_centavos: number;
  tasa_iva: number;
}

export interface OrdenCompraInput {
  proveedor_id: string;
  fecha_entrega_est: string;
  terminos_pago: number;
  notas: string;
  requiere_anticipo?: boolean;
  items: OrdenCompraItemInput[];
}

interface OrdenRow {
  id: string;
  clinic_id: string;
  folio: string;
  proveedor_id: string;
  proveedores?: { nombre: string } | null;
  estatus: string;
  fecha_emision: string;
  fecha_entrega_est: string | null;
  terminos_pago: number;
  moneda: string;
  subtotal_centavos: number;
  iva_centavos: number;
  total_centavos: number;
  notas: string | null;
  requiere_anticipo: boolean;
  created_at: string;
}

const toOrden = (row: OrdenRow): OrdenCompra => ({
  id: row.id,
  clinic_id: row.clinic_id,
  folio: row.folio,
  proveedor_id: row.proveedor_id,
  proveedor_nombre: row.proveedores?.nombre ?? "",
  estatus: row.estatus as OrdenCompra["estatus"],
  fecha_emision: row.fecha_emision,
  fecha_entrega_est: row.fecha_entrega_est,
  terminos_pago: row.terminos_pago,
  moneda: row.moneda,
  subtotal_centavos: row.subtotal_centavos,
  iva_centavos: row.iva_centavos,
  total_centavos: row.total_centavos,
  notas: row.notas ?? "",
  requiere_anticipo: row.requiere_anticipo ?? false,
  created_at: row.created_at,
});

const calcTotales = (items: OrdenCompraItemInput[]) => {
  let subtotal = 0;
  let iva = 0;
  for (const item of items) {
    const sub = item.cantidad_pedida * item.precio_unitario_centavos;
    subtotal += sub;
    iva += Math.round(sub * item.tasa_iva);
  }
  return { subtotal_centavos: subtotal, iva_centavos: iva, total_centavos: subtotal + iva };
};

const nextFolio = (existing: string[]): string => {
  const nums = existing
    .map((f) => parseInt(f.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `OC-${String(max + 1).padStart(4, "0")}`;
};

export function useOrdenesCompra(clinicId: string | null) {
  const [items, setItems] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await untypedTable("ordenes_compra")
        .select("*, proveedores(nombre)")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setItems(((data ?? []) as OrdenRow[]).map(toOrden));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar las órdenes de compra."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const getUmbral = useCallback(async (): Promise<number | null> => {
    const { data } = await untypedTable("clinic_settings")
      .select("data")
      .eq("clinic_id", clinicId)
      .eq("section", "compras")
      .single();
    const d = (data as { data?: { umbral_aprobacion_oc_centavos?: number } } | null)?.data;
    return d?.umbral_aprobacion_oc_centavos ?? null;
  }, [clinicId]);

  const create = useCallback(async (input: OrdenCompraInput) => {
    if (!clinicId) throw new Error("No hay clínica activa.");
    const totales = calcTotales(input.items);
    const folio = nextFolio(items.map((o) => o.folio));

    // Si total supera umbral → pendiente_aprobacion; si no → borrador
    const umbral = await getUmbral();
    const estatus = umbral !== null && totales.total_centavos > umbral
      ? "pendiente_aprobacion"
      : "borrador";

    const { data: ordenData, error: oErr } = await untypedTable("ordenes_compra")
      .insert({
        clinic_id: clinicId,
        folio,
        proveedor_id: input.proveedor_id,
        terminos_pago: input.terminos_pago,
        fecha_entrega_est: input.fecha_entrega_est || null,
        notas: input.notas.trim() || null,
        requiere_anticipo: input.requiere_anticipo ?? false,
        estatus,
        ...totales,
      })
      .select("id")
      .single();
    if (oErr) throw new Error(friendlyError(oErr, "No se pudo crear la orden."));

    const orden_id = (ordenData as { id: string }).id;
    const itemRows = input.items.map((it) => ({
      orden_id,
      medicamento_id: it.medicamento_id,
      cantidad_pedida: it.cantidad_pedida,
      precio_unitario_centavos: it.precio_unitario_centavos,
      tasa_iva: it.tasa_iva,
      subtotal_centavos: it.cantidad_pedida * it.precio_unitario_centavos,
    }));
    const { error: iErr } = await untypedTable("ordenes_compra_items").insert(itemRows);
    if (iErr) throw new Error(friendlyError(iErr, "No se pudieron agregar los productos a la orden."));

    await load();
    return orden_id;
  }, [clinicId, items, load]);

  const confirmar = useCallback(async (id: string) => {
    const { error: uErr } = await untypedTable("ordenes_compra")
      .update({ estatus: "confirmada" })
      .eq("id", id)
      .in("estatus", ["borrador", "pendiente_aprobacion"]);
    if (uErr) throw new Error(friendlyError(uErr, "No se pudo confirmar la orden."));
    await load();
  }, [load]);

  const aprobar = useCallback(async (id: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    const { error: uErr } = await untypedTable("ordenes_compra")
      .update({
        estatus: "confirmada",
        aprobada_by: user?.id ?? null,
        aprobada_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("estatus", "pendiente_aprobacion");
    if (uErr) throw new Error(friendlyError(uErr, "No se pudo aprobar la orden."));
    await load();
  }, [load]);

  const rechazar = useCallback(async (id: string, motivo: string) => {
    const { error: uErr } = await untypedTable("ordenes_compra")
      .update({ estatus: "rechazada", rechazada_motivo: motivo.trim() || null })
      .eq("id", id)
      .eq("estatus", "pendiente_aprobacion");
    if (uErr) throw new Error(friendlyError(uErr, "No se pudo rechazar la orden."));
    await load();
  }, [load]);

  const cancelar = useCallback(async (id: string) => {
    const { error: uErr } = await untypedTable("ordenes_compra")
      .update({ estatus: "cancelada" })
      .eq("id", id)
      .in("estatus", ["borrador", "confirmada"]);
    if (uErr) throw new Error(friendlyError(uErr, "No se pudo cancelar la orden."));
    await load();
  }, [load]);

  const getItems = useCallback(async (ordenId: string): Promise<OrdenCompraItem[]> => {
    const { data, error: qErr } = await untypedTable("ordenes_compra_items")
      .select("*, medicamentos(nombre)")
      .eq("orden_id", ordenId);
    if (qErr) throw new Error(friendlyError(qErr, "No se pudieron cargar los productos."));
    return ((data ?? []) as (OrdenCompraItem & { medicamentos?: { nombre: string } })[])
      .map((r) => ({ ...r, medicamento_nombre: r.medicamentos?.nombre ?? "" }));
  }, []);

  return { items, loading, error, create, confirmar, aprobar, rechazar, cancelar, getItems, refresh: load };
}
