import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";

/**
 * CRUD de la pestaña "Insumos" del Inventario en /ajustes contra la tabla
 * `insumos` (migración 20260605010000). Costo en centavos; `caducidad` es una
 * fecha SQL `YYYY-MM-DD` (o null). `proveedorId` es FK opcional a `proveedores`.
 */

export interface Insumo {
  id: string;
  nombre: string;
  stock: number;
  stockMinimo: number;
  caducidad: string; // "YYYY-MM-DD" o ""
  costoMxn: number;
  proveedorId: string | null;
  activo: boolean;
}

export interface InsumoInput {
  nombre: string;
  stock: number;
  stockMinimo: number;
  caducidad: string; // "YYYY-MM-DD" o ""
  costoMxn: number;
  proveedorId: string | null;
  activo: boolean;
}

interface InsumoRow {
  id: string;
  nombre: string;
  stock: number;
  stock_minimo: number;
  caducidad: string | null;
  costo_centavos: number;
  proveedor_id: string | null;
  activo: boolean;
}

const toInsumo = (row: InsumoRow): Insumo => ({
  id: row.id,
  nombre: row.nombre,
  stock: row.stock,
  stockMinimo: row.stock_minimo,
  caducidad: row.caducidad ?? "",
  costoMxn: Math.round(row.costo_centavos) / 100,
  proveedorId: row.proveedor_id,
  activo: row.activo,
});

const toRow = (input: InsumoInput) => ({
  nombre: input.nombre.trim(),
  stock: Math.max(0, Math.round(input.stock)),
  stock_minimo: Math.max(0, Math.round(input.stockMinimo)),
  caducidad: input.caducidad.trim() || null,
  costo_centavos: Math.max(0, Math.round(input.costoMxn * 100)),
  proveedor_id: input.proveedorId || null,
  activo: input.activo,
});

export function useInsumos(clinicId: string | null) {
  const [items, setItems] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await untypedTable("insumos")
        .select("id, nombre, stock, stock_minimo, caducidad, costo_centavos, proveedor_id, activo")
        .eq("clinic_id", clinicId)
        .order("nombre");
      if (qErr) throw qErr;
      setItems(((data ?? []) as InsumoRow[]).map(toInsumo));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar los insumos."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: InsumoInput) => {
      if (!clinicId) throw new Error("No hay clínica activa seleccionada.");
      const { error: cErr } = await untypedTable("insumos").insert({
        ...toRow(input),
        clinic_id: clinicId,
      });
      if (cErr) throw new Error(friendlyError(cErr, "No se pudo crear el insumo."));
      await load();
    },
    [clinicId, load],
  );

  const update = useCallback(
    async (id: string, input: InsumoInput) => {
      const { error: uErr } = await untypedTable("insumos").update(toRow(input)).eq("id", id);
      if (uErr) throw new Error(friendlyError(uErr, "No se pudo actualizar el insumo."));
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: dErr } = await untypedTable("insumos").delete().eq("id", id);
      if (dErr) throw new Error(friendlyError(dErr, "No se pudo eliminar el insumo."));
      await load();
    },
    [load],
  );

  return { items, loading, error, create, update, remove, refresh: load };
}
