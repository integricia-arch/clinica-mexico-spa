import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";
import { supabase } from "@/integrations/supabase/client";

export type SCEstatus = "borrador" | "enviada" | "aprobada" | "rechazada" | "convertida";

export interface SCItem {
  id: string;
  solicitud_id: string;
  medicamento_id: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string | null;
  precio_estimado: number | null;
  justificacion: string | null;
}

export interface SolicitudCompra {
  id: string;
  clinic_id: string;
  folio: string;
  solicitante_id: string | null;
  solicitante_nombre: string | null;
  area_solicitante: string | null;
  fecha_solicitud: string;
  fecha_requerida: string | null;
  motivo: string;
  estatus: SCEstatus;
  aprobador_id: string | null;
  aprobador_nombre: string | null;
  aprobado_at: string | null;
  rechazo_motivo: string | null;
  orden_compra_id: string | null;
  notas: string | null;
  created_at: string;
}

export interface SCItemInput {
  medicamento_id: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_estimado: number;
  justificacion: string;
}

export interface SCInput {
  area_solicitante: string;
  fecha_requerida: string;
  motivo: string;
  notas: string;
  items: SCItemInput[];
}

const nextFolio = (existing: string[]): string => {
  const nums = existing.map((f) => parseInt(f.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `SC-${String(max + 1).padStart(4, "0")}`;
};

export function useSolicitudesCompra(clinicId: string | null) {
  const [items, setItems] = useState<SolicitudCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) { setItems([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: qErr } = await untypedTable("solicitudes_compra")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setItems((data ?? []) as SolicitudCompra[]);
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar las solicitudes."));
    } finally { setLoading(false); }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (input: SCInput): Promise<string> => {
    if (!clinicId) throw new Error("No hay clínica activa.");
    const { data: user } = await supabase.auth.getUser();
    const folio = nextFolio(items.map((s) => s.folio));

    const { data, error: cErr } = await untypedTable("solicitudes_compra").insert({
      clinic_id: clinicId,
      folio,
      solicitante_id: user.user?.id ?? null,
      solicitante_nombre: user.user?.email ?? null,
      area_solicitante: input.area_solicitante.trim() || null,
      fecha_requerida: input.fecha_requerida || null,
      motivo: input.motivo.trim(),
      notas: input.notas.trim() || null,
      estatus: "borrador",
    }).select("id").single();
    if (cErr) throw new Error(friendlyError(cErr, "No se pudo crear la solicitud."));
    const scId = (data as { id: string }).id;

    if (input.items.length > 0) {
      const { error: iErr } = await untypedTable("solicitudes_compra_items").insert(
        input.items.map((it) => ({
          solicitud_id: scId,
          medicamento_id: it.medicamento_id,
          descripcion: it.descripcion.trim(),
          cantidad: it.cantidad,
          unidad: it.unidad.trim() || null,
          precio_estimado: it.precio_estimado || null,
          justificacion: it.justificacion.trim() || null,
        }))
      );
      if (iErr) throw new Error(friendlyError(iErr, "Error al guardar ítems."));
    }

    await load();
    return scId;
  }, [clinicId, items, load]);

  const enviar = useCallback(async (scId: string): Promise<void> => {
    await untypedTable("solicitudes_compra").update({ estatus: "enviada" }).eq("id", scId);
    await load();
  }, [load]);

  const aprobar = useCallback(async (scId: string): Promise<void> => {
    const { data: user } = await supabase.auth.getUser();
    await untypedTable("solicitudes_compra").update({
      estatus: "aprobada",
      aprobador_id: user.user?.id ?? null,
      aprobador_nombre: user.user?.email ?? null,
      aprobado_at: new Date().toISOString(),
    }).eq("id", scId);
    await load();
  }, [load]);

  const rechazar = useCallback(async (scId: string, motivo: string): Promise<void> => {
    await untypedTable("solicitudes_compra").update({
      estatus: "rechazada",
      rechazo_motivo: motivo.trim(),
    }).eq("id", scId);
    await load();
  }, [load]);

  const marcarConvertida = useCallback(async (scId: string, ocId: string): Promise<void> => {
    await untypedTable("solicitudes_compra").update({
      estatus: "convertida",
      orden_compra_id: ocId,
    }).eq("id", scId);
    await load();
  }, [load]);

  const getItems = useCallback(async (scId: string): Promise<SCItem[]> => {
    const { data, error: qErr } = await untypedTable("solicitudes_compra_items")
      .select("*")
      .eq("solicitud_id", scId)
      .order("created_at", { ascending: true });
    if (qErr) throw new Error(friendlyError(qErr, "No se pudieron cargar los ítems."));
    return (data ?? []) as SCItem[];
  }, []);

  const pendientes = items.filter((s) => s.estatus === "borrador" || s.estatus === "enviada");
  const paraAprobar = items.filter((s) => s.estatus === "enviada");

  return { items, loading, error, pendientes, paraAprobar, create, enviar, aprobar, rechazar, marcarConvertida, getItems, refresh: load };
}
