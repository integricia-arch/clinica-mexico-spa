import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";
import { supabase } from "@/integrations/supabase/client";

export interface RecepcionItem {
  id?: string;
  orden_item_id: string | null;
  medicamento_id: string;
  medicamento_nombre?: string;
  lote_id: string | null;
  cantidad_recibida: number;
  numero_lote: string;
  fecha_caducidad: string;
  precio_unitario_centavos: number;
  diferencia_nota: string;
}

export interface Recepcion {
  id: string;
  clinic_id: string;
  orden_id: string | null;
  orden_folio?: string;
  proveedor_id: string;
  proveedor_nombre?: string;
  folio_recepcion: string;
  fecha_recepcion: string;
  numero_remision: string;
  estatus: "pendiente" | "verificada" | "con_diferencias" | "rechazada";
  notas: string;
  created_at: string;
}

export interface RecepcionInput {
  orden_id: string | null;
  proveedor_id: string;
  fecha_recepcion: string;
  numero_remision: string;
  notas: string;
  items: RecepcionItem[];
}

interface RecepcionRow {
  id: string;
  clinic_id: string;
  orden_id: string | null;
  ordenes_compra?: { folio: string } | null;
  proveedor_id: string;
  proveedores?: { nombre: string } | null;
  folio_recepcion: string;
  fecha_recepcion: string;
  numero_remision: string | null;
  estatus: string;
  notas: string | null;
  created_at: string;
}

const toRecepcion = (row: RecepcionRow): Recepcion => ({
  id: row.id,
  clinic_id: row.clinic_id,
  orden_id: row.orden_id,
  orden_folio: row.ordenes_compra?.folio ?? undefined,
  proveedor_id: row.proveedor_id,
  proveedor_nombre: row.proveedores?.nombre ?? "",
  folio_recepcion: row.folio_recepcion,
  fecha_recepcion: row.fecha_recepcion,
  numero_remision: row.numero_remision ?? "",
  estatus: row.estatus as Recepcion["estatus"],
  notas: row.notas ?? "",
  created_at: row.created_at,
});

const nextFolioRec = (existing: string[]): string => {
  const nums = existing
    .map((f) => parseInt(f.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `REC-${String(max + 1).padStart(4, "0")}`;
};

export function useRecepcionesMercancia(clinicId: string | null) {
  const [items, setItems] = useState<Recepcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await untypedTable("recepciones_mercancia")
        .select("*, proveedores(nombre), ordenes_compra(folio)")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setItems(((data ?? []) as RecepcionRow[]).map(toRecepcion));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar las recepciones."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (input: RecepcionInput): Promise<string> => {
    if (!clinicId) throw new Error("No hay clínica activa.");
    const folio = nextFolioRec(items.map((r) => r.folio_recepcion));

    // Detectar diferencias: si todos los items tienen cantidad_recibida >= pedida → verificada
    const tieneDiferencias = input.items.some((it) => it.diferencia_nota.trim() !== "");
    const estatus = tieneDiferencias ? "con_diferencias" : "pendiente";

    const { data: recData, error: rErr } = await untypedTable("recepciones_mercancia")
      .insert({
        clinic_id: clinicId,
        orden_id: input.orden_id || null,
        proveedor_id: input.proveedor_id,
        folio_recepcion: folio,
        fecha_recepcion: input.fecha_recepcion || new Date().toISOString().split("T")[0],
        numero_remision: input.numero_remision.trim() || null,
        notas: input.notas.trim() || null,
        estatus,
      })
      .select("id")
      .single();
    if (rErr) throw new Error(friendlyError(rErr, "No se pudo crear la recepción."));

    const recepcion_id = (recData as { id: string }).id;

    // Por cada item: upsert lote (create-or-increment) vía RPC atómica
    // Esto actualiza existencia en lotes_medicamento y registra movimiento_inventario
    const itemRows: {
      recepcion_id: string; orden_item_id: string | null; medicamento_id: string;
      lote_id: string | null; cantidad_recibida: number; numero_lote: string | null;
      fecha_caducidad: string | null; precio_unitario_centavos: number; diferencia_nota: string | null;
    }[] = [];

    for (const it of input.items) {
      let loteId: string | null = it.lote_id || null;
      const numLote = it.numero_lote.trim();
      if (numLote && it.medicamento_id) {
        const { data: loteRpc, error: loteErr } = await (supabase.rpc as unknown as (
          fn: string, args: Record<string, unknown>
        ) => Promise<{ data: string | null; error: unknown }>)(
          "recepcion_entrada_lote",
          {
            p_clinic_id: clinicId,
            p_medicamento_id: it.medicamento_id,
            p_numero_lote: numLote,
            p_fecha_caducidad: it.fecha_caducidad || null,
            p_cantidad: it.cantidad_recibida,
            p_costo_unitario_centavos: it.precio_unitario_centavos,
            p_proveedor_id: input.proveedor_id || null,
          }
        );
        if (loteErr) throw new Error(friendlyError(loteErr as never, `Error al actualizar lote ${numLote}.`));
        loteId = loteRpc;
      }

      itemRows.push({
        recepcion_id,
        orden_item_id: it.orden_item_id || null,
        medicamento_id: it.medicamento_id,
        lote_id: loteId,
        cantidad_recibida: it.cantidad_recibida,
        numero_lote: numLote || null,
        fecha_caducidad: it.fecha_caducidad || null,
        precio_unitario_centavos: it.precio_unitario_centavos,
        diferencia_nota: it.diferencia_nota.trim() || null,
      });
    }

    const { error: iErr } = await untypedTable("recepciones_items").insert(itemRows);
    if (iErr) throw new Error(friendlyError(iErr, "No se pudieron registrar los productos recibidos."));

    // Actualizar cantidad_recibida en ordenes_compra_items y estatus OC
    if (input.orden_id) {
      for (const it of input.items) {
        if (it.orden_item_id) {
          await untypedTable("ordenes_compra_items")
            .update({ cantidad_recibida: it.cantidad_recibida })
            .eq("id", it.orden_item_id);
        }
      }
      // Si todos los items de la OC tienen cantidad_recibida >= pedida → recibida, si no → parcial
      const { data: allItems } = await untypedTable("ordenes_compra_items")
        .select("cantidad_pedida, cantidad_recibida")
        .eq("orden_id", input.orden_id);
      const ocs = (allItems ?? []) as { cantidad_pedida: number; cantidad_recibida: number }[];
      const allReceived = ocs.every((o) => o.cantidad_recibida >= o.cantidad_pedida);
      await untypedTable("ordenes_compra")
        .update({ estatus: allReceived ? "recibida" : "parcial" })
        .eq("id", input.orden_id);
    }

    await load();
    return recepcion_id;
  }, [clinicId, items, load]);

  const verificar = useCallback(async (id: string) => {
    const { error: uErr } = await untypedTable("recepciones_mercancia")
      .update({ estatus: "verificada" })
      .eq("id", id);
    if (uErr) throw new Error(friendlyError(uErr, "No se pudo verificar la recepción."));
    await load();
  }, [load]);

  const getItems = useCallback(async (recepcionId: string): Promise<RecepcionItem[]> => {
    const { data, error: qErr } = await untypedTable("recepciones_items")
      .select("*, medicamentos(nombre_generico)")
      .eq("recepcion_id", recepcionId);
    if (qErr) throw new Error(friendlyError(qErr, "No se pudieron cargar los productos."));
    return ((data ?? []) as (RecepcionItem & { medicamentos?: { nombre_generico: string } })[])
      .map((r) => ({ ...r, medicamento_nombre: r.medicamentos?.nombre_generico ?? "" }));
  }, []);

  return { items, loading, error, create, verificar, getItems, refresh: load };
}
