import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";

/**
 * CRUD de la sección "Checklists clínicos" de /ajustes contra la tabla
 * `checklists` (migración 20260605010000). Una fila por checklist de servicio.
 */

export interface Checklist {
  id: string;
  servicio: string;
  pasos: number;
  responsable: string;
  bloquearAvance: boolean;
  permitirJustificacion: boolean;
  activo: boolean;
}

export interface ChecklistInput {
  servicio: string;
  pasos: number;
  responsable: string;
  bloquearAvance: boolean;
  permitirJustificacion: boolean;
  activo: boolean;
}

interface ChecklistRow {
  id: string;
  servicio: string;
  pasos: number;
  responsable: string | null;
  bloquear_avance: boolean;
  permitir_justificacion: boolean;
  activo: boolean;
}

const toChecklist = (row: ChecklistRow): Checklist => ({
  id: row.id,
  servicio: row.servicio,
  pasos: row.pasos,
  responsable: row.responsable ?? "",
  bloquearAvance: row.bloquear_avance,
  permitirJustificacion: row.permitir_justificacion,
  activo: row.activo,
});

const toRow = (input: ChecklistInput) => ({
  servicio: input.servicio.trim(),
  pasos: Math.max(0, Math.round(input.pasos)),
  responsable: input.responsable.trim() || null,
  bloquear_avance: input.bloquearAvance,
  permitir_justificacion: input.permitirJustificacion,
  activo: input.activo,
});

export function useChecklists(clinicId: string | null) {
  const [items, setItems] = useState<Checklist[]>([]);
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
      const { data, error: qErr } = await untypedTable("checklists")
        .select("id, servicio, pasos, responsable, bloquear_avance, permitir_justificacion, activo")
        .eq("clinic_id", clinicId)
        .order("servicio");
      if (qErr) throw qErr;
      setItems(((data ?? []) as ChecklistRow[]).map(toChecklist));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar los checklists."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: ChecklistInput) => {
      if (!clinicId) throw new Error("No hay clínica activa seleccionada.");
      const { error: cErr } = await untypedTable("checklists").insert({
        ...toRow(input),
        clinic_id: clinicId,
      });
      if (cErr) throw new Error(friendlyError(cErr, "No se pudo crear el checklist."));
      await load();
    },
    [clinicId, load],
  );

  const update = useCallback(
    async (id: string, input: ChecklistInput) => {
      const { error: uErr } = await untypedTable("checklists").update(toRow(input)).eq("id", id);
      if (uErr) throw new Error(friendlyError(uErr, "No se pudo actualizar el checklist."));
      await load();
    },
    [load],
  );

  const toggleActivo = useCallback(
    async (id: string, activo: boolean) => {
      const { error: tErr } = await untypedTable("checklists").update({ activo }).eq("id", id);
      if (tErr) throw new Error(friendlyError(tErr, "No se pudo cambiar el estado."));
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: dErr } = await untypedTable("checklists").delete().eq("id", id);
      if (dErr) throw new Error(friendlyError(dErr, "No se pudo eliminar el checklist."));
      await load();
    },
    [load],
  );

  return { items, loading, error, create, update, toggleActivo, remove, refresh: load };
}
