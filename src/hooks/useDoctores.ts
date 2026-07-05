import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

/**
 * CRUD de la sección "Doctores" de /ajustes contra la tabla `doctors`.
 * La columna "consultorio" de la UI no existe en la tabla (la relación
 * doctor↔room no está modelada aquí) → no se persiste.
 */

export interface Doctor {
  id: string;
  nombre: string;
  apellidos: string;
  especialidad: string;
  cedula: string;
  telefono: string;
  horarioInicio: string; // "HH:MM"
  horarioFin: string; // "HH:MM"
  activo: boolean;
}

export interface DoctorInput {
  nombre: string;
  apellidos: string;
  especialidad: string;
  cedula: string;
  telefono: string;
  horarioInicio: string;
  horarioFin: string;
  activo: boolean;
}

// La columna time puede venir como "09:00:00"; la UI usa "HH:MM".
const trimTime = (t: string | null): string => (t ? t.slice(0, 5) : "");

const toDoctor = (row: {
  id: string;
  nombre: string;
  apellidos: string;
  especialidad: string;
  cedula_profesional: string | null;
  telefono: string | null;
  horario_inicio: string;
  horario_fin: string;
  activo: boolean;
}): Doctor => ({
  id: row.id,
  nombre: row.nombre,
  apellidos: row.apellidos,
  especialidad: row.especialidad,
  cedula: row.cedula_profesional ?? "",
  telefono: row.telefono ?? "",
  horarioInicio: trimTime(row.horario_inicio),
  horarioFin: trimTime(row.horario_fin),
  activo: row.activo,
});

const toRow = (input: DoctorInput) => ({
  nombre: input.nombre.trim(),
  apellidos: input.apellidos.trim(),
  especialidad: input.especialidad.trim(),
  cedula_profesional: input.cedula.trim() || null,
  telefono: input.telefono.trim() || null,
  horario_inicio: input.horarioInicio || "09:00",
  horario_fin: input.horarioFin || "19:00",
  activo: input.activo,
});

export function useDoctores(clinicId: string | null) {
  const [items, setItems] = useState<Doctor[]>([]);
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
        .from("doctors")
        .select(
          "id, nombre, apellidos, especialidad, cedula_profesional, telefono, horario_inicio, horario_fin, activo",
        )
        .eq("clinic_id", clinicId)
        .order("apellidos");
      if (qErr) throw qErr;
      setItems((data ?? []).map(toDoctor));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar los doctores."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: DoctorInput) => {
      if (!clinicId) throw new Error("No hay clínica activa seleccionada.");
      const { error: cErr } = await (supabase as any)
        .from("doctors")
        .insert({ ...toRow(input), clinic_id: clinicId } as never);
      if (cErr) throw new Error(friendlyError(cErr, "No se pudo crear el doctor."));
      await load();
    },
    [clinicId, load],
  );

  const update = useCallback(
    async (id: string, input: DoctorInput) => {
      const { error: uErr } = await (supabase as any).from("doctors").update(toRow(input)).eq("id", id);
      if (uErr) throw new Error(friendlyError(uErr, "No se pudo actualizar el doctor."));
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: dErr } = await (supabase as any).from("doctors").delete().eq("id", id);
      if (dErr) throw new Error(friendlyError(dErr, "No se pudo eliminar el doctor."));
      await load();
    },
    [load],
  );

  return { items, loading, error, create, update, remove, refresh: load };
}
