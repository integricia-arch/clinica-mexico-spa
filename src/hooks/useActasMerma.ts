import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";
import { supabase } from "@/integrations/supabase/client";

export interface ActaMermaItem {
  id?: string;
  medicamento_id: string;
  medicamento_nombre?: string;
  lote_id: string | null;
  numero_lote?: string;
  cantidad: number;
  costo_unitario_centavos: number;
  subtotal_centavos?: number;
  observacion: string;
}

export interface ActaMerma {
  id: string;
  clinic_id: string;
  folio: string;
  fecha_merma: string;
  motivo: string;
  descripcion: string;
  estatus: "borrador" | "pendiente_firma" | "firmada" | "rechazada";
  total_costo_centavos: number;
  autorizada_by: string | null;
  autorizada_at: string | null;
  rechazada_motivo: string | null;
  created_at: string;
}

export interface ActaMermaInput {
  fecha_merma: string;
  motivo: string;
  descripcion: string;
  items: ActaMermaItem[];
}

interface ActaRow {
  id: string;
  clinic_id: string;
  folio: string;
  fecha_merma: string;
  motivo: string;
  descripcion: string | null;
  estatus: string;
  total_costo_centavos: number;
  autorizada_by: string | null;
  autorizada_at: string | null;
  rechazada_motivo: string | null;
  created_at: string;
}

const toActa = (row: ActaRow): ActaMerma => ({
  id: row.id,
  clinic_id: row.clinic_id,
  folio: row.folio,
  fecha_merma: row.fecha_merma,
  motivo: row.motivo,
  descripcion: row.descripcion ?? "",
  estatus: row.estatus as ActaMerma["estatus"],
  total_costo_centavos: row.total_costo_centavos,
  autorizada_by: row.autorizada_by,
  autorizada_at: row.autorizada_at,
  rechazada_motivo: row.rechazada_motivo,
  created_at: row.created_at,
});

const nextFolio = (existing: string[]): string => {
  const nums = existing
    .map((f) => parseInt(f.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `MERMA-${String(max + 1).padStart(4, "0")}`;
};

export function useActasMerma(clinicId: string | null) {
  const [items, setItems] = useState<ActaMerma[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await untypedTable("actas_merma")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setItems(((data ?? []) as ActaRow[]).map(toActa));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar las actas de merma."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (input: ActaMermaInput): Promise<string> => {
    if (!clinicId) throw new Error("No hay clínica activa.");
    const user = (await supabase.auth.getUser()).data.user;
    const total = input.items.reduce((s, it) => s + it.cantidad * it.costo_unitario_centavos, 0);
    const folio = nextFolio(items.map((a) => a.folio));

    const { data: actaData, error: aErr } = await untypedTable("actas_merma")
      .insert({
        clinic_id: clinicId,
        folio,
        fecha_merma: input.fecha_merma || new Date().toISOString().split("T")[0],
        motivo: input.motivo,
        descripcion: input.descripcion.trim() || null,
        total_costo_centavos: total,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (aErr) throw new Error(friendlyError(aErr, "No se pudo crear el acta."));

    const acta_id = (actaData as { id: string }).id;
    const itemRows = input.items.map((it) => ({
      acta_id,
      medicamento_id: it.medicamento_id,
      lote_id: it.lote_id || null,
      medicamento_nombre: it.medicamento_nombre ?? null,
      numero_lote: it.numero_lote ?? null,
      cantidad: it.cantidad,
      costo_unitario_centavos: it.costo_unitario_centavos,
      observacion: it.observacion.trim() || null,
    }));
    const { error: iErr } = await untypedTable("actas_merma_items").insert(itemRows);
    if (iErr) throw new Error(friendlyError(iErr, "No se pudieron agregar los ítems."));

    await load();
    return acta_id;
  }, [clinicId, items, load]);

  const solicitarFirma = useCallback(async (id: string) => {
    const { error: uErr } = await untypedTable("actas_merma")
      .update({ estatus: "pendiente_firma" })
      .eq("id", id)
      .eq("estatus", "borrador");
    if (uErr) throw new Error(friendlyError(uErr, "No se pudo solicitar la firma."));
    await load();
  }, [load]);

  const firmar = useCallback(async (id: string, supervisorId: string, pin: string) => {
    const { error: rErr } = await (supabase.rpc as unknown as (
      fn: string, args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: unknown }>)(
      "firmar_acta_merma",
      { p_acta_id: id, p_supervisor_id: supervisorId, p_pin: pin }
    );
    if (rErr) throw rErr;
    await load();
  }, [load]);

  const rechazar = useCallback(async (id: string, motivo: string) => {
    const { error: uErr } = await untypedTable("actas_merma")
      .update({ estatus: "rechazada", rechazada_motivo: motivo.trim() || null })
      .eq("id", id)
      .eq("estatus", "pendiente_firma");
    if (uErr) throw new Error(friendlyError(uErr, "No se pudo rechazar el acta."));
    await load();
  }, [load]);

  const getItems = useCallback(async (actaId: string): Promise<ActaMermaItem[]> => {
    const { data, error: qErr } = await untypedTable("actas_merma_items")
      .select("*")
      .eq("acta_id", actaId);
    if (qErr) throw new Error(friendlyError(qErr, "No se pudieron cargar los ítems."));
    return (data ?? []) as ActaMermaItem[];
  }, []);

  return { items, loading, error, create, solicitarFirma, firmar, rechazar, getItems, refresh: load };
}
