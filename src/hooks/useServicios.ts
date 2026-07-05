import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

/**
 * CRUD de la sección "Servicios" de /ajustes contra la tabla `servicios`.
 * Precios se manejan en pesos (MXN) en la UI y se persisten en centavos.
 * Las columnas consentimiento/checklist no existen aún en la tabla → la UI
 * las muestra como demo (no se guardan).
 */

export interface Servicio {
  id: string;
  nombre: string;
  especialidad: string;
  duracionMin: number;
  precioMxn: number;
  activo: boolean;
}

export interface ServicioInput {
  nombre: string;
  especialidad: string;
  duracionMin: number;
  precioMxn: number;
  activo: boolean;
}

const toServicio = (row: {
  id: string;
  nombre: string;
  especialidad: string | null;
  duracion_minutos: number;
  precio_centavos: number;
  activo: boolean;
}): Servicio => ({
  id: row.id,
  nombre: row.nombre,
  especialidad: row.especialidad ?? "",
  duracionMin: row.duracion_minutos,
  precioMxn: Math.round(row.precio_centavos) / 100,
  activo: row.activo,
});

const toRow = (input: ServicioInput) => ({
  nombre: input.nombre.trim(),
  especialidad: input.especialidad.trim() || null,
  duracion_minutos: Math.max(0, Math.round(input.duracionMin)),
  precio_centavos: Math.max(0, Math.round(input.precioMxn * 100)),
  activo: input.activo,
});

export function useServicios(clinicId: string | null) {
  const [items, setItems] = useState<Servicio[]>([]);
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
      const { data, error: qErr } = await (supabase as any)
        .from("servicios")
        .select("id, nombre, especialidad, duracion_minutos, precio_centavos, activo")
        .eq("clinic_id", clinicId)
        .order("nombre");
      if (qErr) throw qErr;
      setItems((data ?? []).map(toServicio));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar los servicios."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: ServicioInput) => {
      if (!clinicId) throw new Error("No hay clínica activa seleccionada.");
      const { error: cErr } = await (supabase as any)
        .from("servicios")
        .insert({ ...toRow(input), clinic_id: clinicId });
      if (cErr) throw new Error(friendlyError(cErr, "No se pudo crear el servicio."));
      await load();
    },
    [clinicId, load],
  );

  const update = useCallback(
    async (id: string, input: ServicioInput) => {
      const { error: uErr } = await (supabase as any).from("servicios").update(toRow(input)).eq("id", id);
      if (uErr) throw new Error(friendlyError(uErr, "No se pudo actualizar el servicio."));
      await load();
    },
    [load],
  );

  const toggleActivo = useCallback(
    async (id: string, activo: boolean) => {
      const { error: tErr } = await (supabase as any).from("servicios").update({ activo }).eq("id", id);
      if (tErr) throw new Error(friendlyError(tErr, "No se pudo cambiar el estado."));
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: dErr } = await (supabase as any).from("servicios").delete().eq("id", id);
      if (dErr) throw new Error(friendlyError(dErr, "No se pudo eliminar el servicio."));
      await load();
    },
    [load],
  );

  return { items, loading, error, create, update, toggleActivo, remove, refresh: load };
}
