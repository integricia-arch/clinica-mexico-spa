import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";

/**
 * CRUD de la pestaña "Kits por tratamiento" del Inventario en /ajustes.
 *
 * v2 (Opción A): el kit se compone de líneas de insumo (`kit_items`,
 * migración 20260606000000). El costo ya NO se teclea: se deriva live de
 * SUMA(insumo.costo × cantidad) al cargar, así un cambio en el costo de un
 * insumo se refleja en todos los kits que lo usan. `numInsumos` = nº de líneas.
 * El precio sigue siendo manual (la Opción B lo automatizará con reglas).
 *
 * Guardado: replace-all de las líneas (borra las del kit y reinserta las
 * actuales). Volumen bajo de settings; mantiene el hook simple y consistente.
 */

export interface KitItem {
  insumoId: string;
  insumoNombre: string;
  cantidad: number;
  costoUnitMxn: number; // costo unitario del insumo al momento de cargar
}

export interface Kit {
  id: string;
  tratamiento: string;
  precioMxn: number;
  activo: boolean;
  items: KitItem[];
  numInsumos: number; // derivado: items.length
  costoMxn: number; // derivado: Σ cantidad × costoUnitMxn
}

export interface KitItemInput {
  insumoId: string;
  cantidad: number;
}

export interface KitInput {
  tratamiento: string;
  precioMxn: number;
  activo: boolean;
  items: KitItemInput[];
}

interface KitItemRow {
  id: string;
  insumo_id: string;
  cantidad: number;
  insumos: { nombre: string; costo_centavos: number } | null;
}

interface KitRow {
  id: string;
  tratamiento: string;
  precio_centavos: number;
  activo: boolean;
  kit_items: KitItemRow[] | null;
}

const toItem = (row: KitItemRow): KitItem => ({
  insumoId: row.insumo_id,
  insumoNombre: row.insumos?.nombre ?? "(insumo eliminado)",
  cantidad: row.cantidad,
  costoUnitMxn: Math.round(row.insumos?.costo_centavos ?? 0) / 100,
});

const toKit = (row: KitRow): Kit => {
  const items = (row.kit_items ?? []).map(toItem);
  const costoMxn = items.reduce((sum, it) => sum + it.cantidad * it.costoUnitMxn, 0);
  return {
    id: row.id,
    tratamiento: row.tratamiento,
    precioMxn: Math.round(row.precio_centavos) / 100,
    activo: row.activo,
    items,
    numInsumos: items.length,
    costoMxn: Math.round(costoMxn * 100) / 100,
  };
};

const KIT_SELECT =
  "id, tratamiento, precio_centavos, activo, " +
  "kit_items(id, insumo_id, cantidad, insumos(nombre, costo_centavos))";

const kitFields = (input: KitInput) => ({
  tratamiento: input.tratamiento.trim(),
  precio_centavos: Math.max(0, Math.round(input.precioMxn * 100)),
  activo: input.activo,
});

const cleanItems = (items: KitItemInput[]) =>
  items
    .filter((it) => it.insumoId)
    .map((it) => ({ insumoId: it.insumoId, cantidad: Math.max(1, Math.round(it.cantidad)) }));

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
        .select(KIT_SELECT)
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

  // Reemplaza todas las líneas del kit por las actuales.
  const syncItems = useCallback(
    async (kitId: string, lines: KitItemInput[]) => {
      const { error: dErr } = await untypedTable("kit_items").delete().eq("kit_id", kitId);
      if (dErr) throw new Error(friendlyError(dErr, "No se pudieron actualizar los insumos del kit."));
      const rows = cleanItems(lines).map((it) => ({
        clinic_id: clinicId,
        kit_id: kitId,
        insumo_id: it.insumoId,
        cantidad: it.cantidad,
      }));
      if (rows.length > 0) {
        const { error: iErr } = await untypedTable("kit_items").insert(rows);
        if (iErr) throw new Error(friendlyError(iErr, "No se pudieron guardar los insumos del kit."));
      }
    },
    [clinicId],
  );

  const create = useCallback(
    async (input: KitInput) => {
      if (!clinicId) throw new Error("No hay clínica activa seleccionada.");
      const { data, error: cErr } = await untypedTable("kits")
        .insert({ ...kitFields(input), clinic_id: clinicId })
        .select("id")
        .single();
      if (cErr) throw new Error(friendlyError(cErr, "No se pudo crear el kit."));
      await syncItems((data as { id: string }).id, input.items);
      await load();
    },
    [clinicId, load, syncItems],
  );

  const update = useCallback(
    async (id: string, input: KitInput) => {
      const { error: uErr } = await untypedTable("kits").update(kitFields(input)).eq("id", id);
      if (uErr) throw new Error(friendlyError(uErr, "No se pudo actualizar el kit."));
      await syncItems(id, input.items);
      await load();
    },
    [load, syncItems],
  );

  const remove = useCallback(
    async (id: string) => {
      // kit_items se borra en cascada (FK ON DELETE CASCADE).
      const { error: dErr } = await untypedTable("kits").delete().eq("id", id);
      if (dErr) throw new Error(friendlyError(dErr, "No se pudo eliminar el kit."));
      await load();
    },
    [load],
  );

  return { items, loading, error, create, update, remove, refresh: load };
}
