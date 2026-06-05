import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";

/**
 * CRUD de la pestaña "Proveedores" del Inventario en /ajustes contra la tabla
 * `proveedores` (migración 20260605010000).
 */

export interface Proveedor {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  activo: boolean;
}

export interface ProveedorInput {
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  activo: boolean;
}

interface ProveedorRow {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  activo: boolean;
}

const toProveedor = (row: ProveedorRow): Proveedor => ({
  id: row.id,
  nombre: row.nombre,
  contacto: row.contacto ?? "",
  telefono: row.telefono ?? "",
  email: row.email ?? "",
  activo: row.activo,
});

const toRow = (input: ProveedorInput) => ({
  nombre: input.nombre.trim(),
  contacto: input.contacto.trim() || null,
  telefono: input.telefono.trim() || null,
  email: input.email.trim() || null,
  activo: input.activo,
});

export function useProveedores(clinicId: string | null) {
  const [items, setItems] = useState<Proveedor[]>([]);
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
      const { data, error: qErr } = await untypedTable("proveedores")
        .select("id, nombre, contacto, telefono, email, activo")
        .eq("clinic_id", clinicId)
        .order("nombre");
      if (qErr) throw qErr;
      setItems(((data ?? []) as ProveedorRow[]).map(toProveedor));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar los proveedores."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: ProveedorInput) => {
      if (!clinicId) throw new Error("No hay clínica activa seleccionada.");
      const { error: cErr } = await untypedTable("proveedores").insert({
        ...toRow(input),
        clinic_id: clinicId,
      });
      if (cErr) throw new Error(friendlyError(cErr, "No se pudo crear el proveedor."));
      await load();
    },
    [clinicId, load],
  );

  const update = useCallback(
    async (id: string, input: ProveedorInput) => {
      const { error: uErr } = await untypedTable("proveedores").update(toRow(input)).eq("id", id);
      if (uErr) throw new Error(friendlyError(uErr, "No se pudo actualizar el proveedor."));
      await load();
    },
    [load],
  );

  const toggleActivo = useCallback(
    async (id: string, activo: boolean) => {
      const { error: tErr } = await untypedTable("proveedores").update({ activo }).eq("id", id);
      if (tErr) throw new Error(friendlyError(tErr, "No se pudo cambiar el estado."));
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: dErr } = await untypedTable("proveedores").delete().eq("id", id);
      if (dErr) throw new Error(friendlyError(dErr, "No se pudo eliminar el proveedor."));
      await load();
    },
    [load],
  );

  return { items, loading, error, create, update, toggleActivo, remove, refresh: load };
}
