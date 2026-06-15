import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";

export interface MedicamentoProveedor {
  id: string;
  medicamento_id: string;
  proveedor_id: string;
  proveedor_nombre?: string;
  proveedor_orden: number;
  precio_pactado_centavos: number;
  precio_vigente_desde: string;
  precio_vigente_hasta: string | null;
  minimo_pedido: number;
  multiplo_pedido: number;
  maximo_pedido: number | null;
  plazo_entrega_dias: number;
  codigo_proveedor: string | null;
  iva_aplica: boolean;
  activo: boolean;
  notas: string | null;
  created_at: string;
}

export interface MedicamentoProveedorInput {
  proveedor_id: string;
  proveedor_orden: number;
  precio_pactado_centavos: number;
  precio_vigente_desde: string;
  precio_vigente_hasta: string;
  minimo_pedido: number;
  multiplo_pedido: number;
  maximo_pedido: number | null;
  plazo_entrega_dias: number;
  codigo_proveedor: string;
  iva_aplica: boolean;
  notas: string;
}

interface MpRow {
  id: string;
  medicamento_id: string;
  proveedor_id: string;
  proveedores?: { nombre: string } | null;
  proveedor_orden: number;
  precio_pactado_centavos: number;
  precio_vigente_desde: string;
  precio_vigente_hasta: string | null;
  minimo_pedido: number;
  multiplo_pedido: number;
  maximo_pedido: number | null;
  plazo_entrega_dias: number;
  codigo_proveedor: string | null;
  iva_aplica: boolean;
  activo: boolean;
  notas: string | null;
  created_at: string;
}

const toMp = (row: MpRow): MedicamentoProveedor => ({
  id: row.id,
  medicamento_id: row.medicamento_id,
  proveedor_id: row.proveedor_id,
  proveedor_nombre: row.proveedores?.nombre ?? "",
  proveedor_orden: row.proveedor_orden,
  precio_pactado_centavos: row.precio_pactado_centavos,
  precio_vigente_desde: row.precio_vigente_desde,
  precio_vigente_hasta: row.precio_vigente_hasta,
  minimo_pedido: row.minimo_pedido,
  multiplo_pedido: row.multiplo_pedido,
  maximo_pedido: row.maximo_pedido,
  plazo_entrega_dias: row.plazo_entrega_dias,
  codigo_proveedor: row.codigo_proveedor,
  iva_aplica: row.iva_aplica,
  activo: row.activo,
  notas: row.notas,
  created_at: row.created_at,
});

export function useMedicamentoProveedores(medicamentoId: string | null) {
  const [items, setItems] = useState<MedicamentoProveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!medicamentoId) { setItems([]); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await untypedTable("medicamento_proveedores")
        .select("*, proveedores(nombre)")
        .eq("medicamento_id", medicamentoId)
        .order("proveedor_orden", { ascending: true });
      if (qErr) throw qErr;
      setItems(((data ?? []) as MpRow[]).map(toMp));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar los proveedores del medicamento."));
    } finally {
      setLoading(false);
    }
  }, [medicamentoId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (input: MedicamentoProveedorInput): Promise<void> => {
    if (!medicamentoId) throw new Error("Sin medicamento.");
    const { error: cErr } = await untypedTable("medicamento_proveedores").insert({
      medicamento_id: medicamentoId,
      proveedor_id: input.proveedor_id,
      proveedor_orden: input.proveedor_orden,
      precio_pactado_centavos: input.precio_pactado_centavos,
      precio_vigente_desde: input.precio_vigente_desde,
      precio_vigente_hasta: input.precio_vigente_hasta || null,
      minimo_pedido: input.minimo_pedido,
      multiplo_pedido: input.multiplo_pedido,
      maximo_pedido: input.maximo_pedido,
      plazo_entrega_dias: input.plazo_entrega_dias,
      codigo_proveedor: input.codigo_proveedor.trim() || null,
      iva_aplica: input.iva_aplica,
      notas: input.notas.trim() || null,
    });
    if (cErr) throw new Error(friendlyError(cErr, "No se pudo agregar el proveedor."));
    await load();
  }, [medicamentoId, load]);

  const update = useCallback(async (id: string, input: Partial<MedicamentoProveedorInput>): Promise<void> => {
    const patch: Record<string, unknown> = {};
    if (input.proveedor_id !== undefined) patch.proveedor_id = input.proveedor_id;
    if (input.proveedor_orden !== undefined) patch.proveedor_orden = input.proveedor_orden;
    if (input.precio_pactado_centavos !== undefined) patch.precio_pactado_centavos = input.precio_pactado_centavos;
    if (input.precio_vigente_desde !== undefined) patch.precio_vigente_desde = input.precio_vigente_desde;
    if (input.precio_vigente_hasta !== undefined) patch.precio_vigente_hasta = input.precio_vigente_hasta || null;
    if (input.minimo_pedido !== undefined) patch.minimo_pedido = input.minimo_pedido;
    if (input.multiplo_pedido !== undefined) patch.multiplo_pedido = input.multiplo_pedido;
    if (input.maximo_pedido !== undefined) patch.maximo_pedido = input.maximo_pedido;
    if (input.plazo_entrega_dias !== undefined) patch.plazo_entrega_dias = input.plazo_entrega_dias;
    if (input.codigo_proveedor !== undefined) patch.codigo_proveedor = input.codigo_proveedor.trim() || null;
    if (input.iva_aplica !== undefined) patch.iva_aplica = input.iva_aplica;
    if (input.notas !== undefined) patch.notas = (input.notas as string).trim() || null;
    const { error: uErr } = await untypedTable("medicamento_proveedores").update(patch).eq("id", id);
    if (uErr) throw new Error(friendlyError(uErr, "No se pudo actualizar."));
    await load();
  }, [load]);

  const remove = useCallback(async (id: string): Promise<void> => {
    const { error: dErr } = await untypedTable("medicamento_proveedores").delete().eq("id", id);
    if (dErr) throw new Error(friendlyError(dErr, "No se pudo eliminar."));
    await load();
  }, [load]);

  const toggleActivo = useCallback(async (id: string, activo: boolean): Promise<void> => {
    await untypedTable("medicamento_proveedores").update({ activo }).eq("id", id);
    await load();
  }, [load]);

  const primario = items.find((mp) => mp.proveedor_orden === 1 && mp.activo);

  return { items, loading, error, primario, create, update, remove, toggleActivo, refresh: load };
}
