import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";
import { supabase } from "@/integrations/supabase/client";

export type DevMotivo =
  | "producto_danado"
  | "producto_incorrecto"
  | "caducidad_proxima"
  | "exceso_pedido"
  | "precio_incorrecto"
  | "otro";

export type DevEstatus =
  | "borrador"
  | "enviada"
  | "aceptada"
  | "rechazada"
  | "nota_credito_emitida";

export interface DevolucionItem {
  id: string;
  devolucion_id: string;
  medicamento_id: string;
  medicamento_nombre?: string;
  lote_id: string | null;
  numero_lote?: string | null;
  cantidad_devuelta: number;
  precio_unitario_centavos: number;
  motivo_item: string | null;
}

export interface DevolucionProveedor {
  id: string;
  clinic_id: string;
  folio: string;
  proveedor_id: string;
  proveedor_nombre?: string;
  recepcion_id: string | null;
  orden_id: string | null;
  motivo: DevMotivo;
  estatus: DevEstatus;
  fecha_devolucion: string;
  nota_credito_folio: string | null;
  nota_credito_monto_centavos: number | null;
  nota_credito_fecha: string | null;
  notas: string | null;
  inventario_revertido: boolean;
  created_at: string;
}

export interface DevolucionItemInput {
  medicamento_id: string;
  lote_id: string | null;
  cantidad_devuelta: number;
  precio_unitario_centavos: number;
  motivo_item?: string;
}

export interface DevolucionInput {
  proveedor_id: string;
  recepcion_id: string | null;
  orden_id: string | null;
  motivo: DevMotivo;
  fecha_devolucion: string;
  notas: string;
  items: DevolucionItemInput[];
}

interface DevRow {
  id: string;
  clinic_id: string;
  folio: string;
  proveedor_id: string;
  proveedores?: { nombre: string } | null;
  recepcion_id: string | null;
  orden_id: string | null;
  motivo: string;
  estatus: string;
  fecha_devolucion: string;
  nota_credito_folio: string | null;
  nota_credito_monto_centavos: number | null;
  nota_credito_fecha: string | null;
  notas: string | null;
  inventario_revertido: boolean;
  created_at: string;
}

const toDev = (row: DevRow): DevolucionProveedor => ({
  id: row.id,
  clinic_id: row.clinic_id,
  folio: row.folio,
  proveedor_id: row.proveedor_id,
  proveedor_nombre: row.proveedores?.nombre ?? "",
  recepcion_id: row.recepcion_id,
  orden_id: row.orden_id,
  motivo: row.motivo as DevMotivo,
  estatus: row.estatus as DevEstatus,
  fecha_devolucion: row.fecha_devolucion,
  nota_credito_folio: row.nota_credito_folio,
  nota_credito_monto_centavos: row.nota_credito_monto_centavos,
  nota_credito_fecha: row.nota_credito_fecha,
  notas: row.notas,
  inventario_revertido: row.inventario_revertido,
  created_at: row.created_at,
});

const nextFolio = (existing: string[]): string => {
  const nums = existing.map((f) => parseInt(f.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `DEV-${String(max + 1).padStart(4, "0")}`;
};

export function useDevolucionesProveedor(clinicId: string | null) {
  const [items, setItems] = useState<DevolucionProveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await untypedTable("devoluciones_proveedor")
        .select("*, proveedores(nombre)")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setItems(((data ?? []) as DevRow[]).map(toDev));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar las devoluciones."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (input: DevolucionInput): Promise<string> => {
    if (!clinicId) throw new Error("No hay clínica activa.");
    const { data: user } = await supabase.auth.getUser();
    const folio = nextFolio(items.map((d) => d.folio));

    const { data, error: cErr } = await untypedTable("devoluciones_proveedor").insert({
      clinic_id: clinicId,
      folio,
      proveedor_id: input.proveedor_id,
      recepcion_id: input.recepcion_id,
      orden_id: input.orden_id,
      motivo: input.motivo,
      fecha_devolucion: input.fecha_devolucion,
      notas: input.notas.trim() || null,
      created_by: user.user?.id ?? null,
    }).select("id").single();
    if (cErr) throw new Error(friendlyError(cErr, "No se pudo crear la devolución."));

    const devId = (data as { id: string }).id;

    if (input.items.length > 0) {
      const { error: iErr } = await untypedTable("devoluciones_items").insert(
        input.items.map((item) => ({
          devolucion_id: devId,
          medicamento_id: item.medicamento_id,
          lote_id: item.lote_id,
          cantidad_devuelta: item.cantidad_devuelta,
          precio_unitario_centavos: item.precio_unitario_centavos,
          motivo_item: item.motivo_item?.trim() || null,
        }))
      );
      if (iErr) throw new Error(friendlyError(iErr, "Error al guardar ítems de devolución."));
    }

    await load();
    return devId;
  }, [clinicId, items, load]);

  /** Sends the return: marks as 'enviada', decrements inventory, logs movement */
  const enviar = useCallback(async (devolucionId: string): Promise<void> => {
    const dev = items.find((d) => d.id === devolucionId);
    if (!dev || dev.estatus !== "borrador") throw new Error("Solo se pueden enviar devoluciones en borrador.");

    const devItems = await getItems(devolucionId);

    // Decrement lotes existencia + insert movimientos
    for (const item of devItems) {
      if (item.lote_id) {
        // Fetch current existencia
        const { data: lote } = await untypedTable("lotes_medicamento")
          .select("existencia")
          .eq("id", item.lote_id)
          .single();
        const current = (lote as { existencia: number } | null)?.existencia ?? 0;
        const nueva = Math.max(0, current - item.cantidad_devuelta);
        await untypedTable("lotes_medicamento")
          .update({ existencia: nueva })
          .eq("id", item.lote_id);
      }

      // Audit movement
      await (supabase as any).from("movimientos_inventario" as never).insert({
        clinic_id: clinicId,
        medicamento_id: item.medicamento_id,
        lote_id: item.lote_id,
        tipo: "devolucion_proveedor",
        cantidad: -item.cantidad_devuelta,
        motivo: `Devolución ${dev.folio} — ${dev.motivo}`,
        reference_type: "devolucion_proveedor",
        reference_id: devolucionId,
      } as never);
    }

    await untypedTable("devoluciones_proveedor").update({
      estatus: "enviada",
      inventario_revertido: true,
    }).eq("id", devolucionId);

    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, items, load]);

  const actualizarEstatus = useCallback(async (
    devolucionId: string,
    estatus: DevEstatus,
  ): Promise<void> => {
    await untypedTable("devoluciones_proveedor").update({ estatus }).eq("id", devolucionId);
    await load();
  }, [load]);

  const registrarNotaCredito = useCallback(async (
    devolucionId: string,
    folio: string,
    montoCentavos: number,
    fecha: string,
  ): Promise<void> => {
    await untypedTable("devoluciones_proveedor").update({
      nota_credito_folio: folio.trim() || null,
      nota_credito_monto_centavos: montoCentavos,
      nota_credito_fecha: fecha || null,
      estatus: "nota_credito_emitida",
    }).eq("id", devolucionId);
    await load();
  }, [load]);

  const getItems = useCallback(async (devolucionId: string): Promise<DevolucionItem[]> => {
    const { data, error: qErr } = await untypedTable("devoluciones_items")
      .select("*, medicamentos(nombre), lotes_medicamento(numero_lote)")
      .eq("devolucion_id", devolucionId);
    if (qErr) throw new Error(friendlyError(qErr, "No se pudieron cargar los ítems."));
    return ((data ?? []) as (DevolucionItem & {
      medicamentos?: { nombre: string } | null;
      lotes_medicamento?: { numero_lote: string } | null;
    })[]).map((r) => ({
      ...r,
      medicamento_nombre: r.medicamentos?.nombre ?? "",
      numero_lote: r.lotes_medicamento?.numero_lote ?? null,
    }));
  }, []);

  const pendientes = items.filter((d) => d.estatus === "borrador" || d.estatus === "enviada");

  return { items, loading, error, pendientes, create, enviar, actualizarEstatus, registrarNotaCredito, getItems, refresh: load };
}
