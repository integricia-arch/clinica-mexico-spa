import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";

/**
 * CRUD de la pestaña "Kits por tratamiento" del Inventario en /ajustes contra
 * la tabla `kits` (migración 20260605010000). v1 plano: costo/precio se capturan
 * directo (sin join a insumos). El margen se deriva en la UI de costo/precio.
 */

export interface Kit {
  id: string;
  tratamiento: string;
  numInsumos: number;
  costoMxn: number;
  precioMxn: number;
  activo: boolean;
}

export interface KitInput {
  tratamiento: string;
  numInsumos: number;
  costoMxn: number;
  precioMxn: number;
  activo: boolean;
}

interface KitRow {
  id: string;
  tratamiento: string;
  num_insumos: number;
  costo_centavos: number;
  precio_centavos: number;
  activo: boolean;
}

const toKit = (row: KitRow): Kit => ({
  id: row.id,
  tratamiento: row.tratamiento,
  numInsumos: row.num_insumos,
  costoMxn: Math.round(row.costo_centavos) / 100,
  precioMxn: Math.round(row.precio_centavos) / 100,
  activo: row.activo,
});

const toRow = (input: KitInput) => ({
  tratamiento: input.tratamiento.trim(),
  num_insumos: Math.max(0, Math.round(input.numInsumos)),
  costo_centavos: Math.max(0, Math.round(input.costoMxn * 100)),
  precio_centavos: Math.max(0, Math.round(input.precioMxn * 100)),
  activo: input.activo,
});

export function useKits(clinicId: string | null) {
  const [items, setItems] = useState<Kit[]>([]);
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
      const { data, error: qErr } = await untypedTable("kits")
        .select("id, tratamiento, num_insumos, costo_centavos, precio_centavos, activo")
        .eq("clinic_id", clinicId)
        .order("tratamiento");
      if (qErr) throw qErr;
      setItems(((data ?? []) as KitRow[]).map(toKit));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar los kits."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: KitInput) => {
      if (!clinicId) throw new Error("No hay clínica activa seleccionada.");
      const { error: cErr } = await untypedTable("kits").insert({
        ...toRow(input),
        clinic_id: clinicId,
      });
      if (cErr) throw new Error(friendlyError(cErr, "No se pudo crear el kit."));
      await load();
    },
    [clinicId, load],
  );

  const update = useCallback(
    async (id: string, input: KitInput) => {
      const { error: uErr } = await untypedTable("kits").update(toRow(input)).eq("id", id);
      if (uErr) throw new Error(friendlyError(uErr, "No se pudo actualizar el kit."));
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: dErr } = await untypedTable("kits").delete().eq("id", id);
      if (dErr) throw new Error(friendlyError(dErr, "No se pudo eliminar el kit."));
      await load();
    },
    [load],
  );

  return { items, loading, error, create, update, remove, refresh: load };
}
