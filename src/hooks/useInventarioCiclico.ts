import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";

export interface ConteoItem {
  id: string;
  conteo_id: string;
  medicamento_id: string;
  medicamento_nombre?: string;
  lote_id: string | null;
  numero_lote: string;
  existencia_sistema: number;
  existencia_contada: number | null;
  diferencia: number | null;
  fue_ajustado: boolean;
  nota_diferencia: string;
  contado_at: string | null;
}

export interface Conteo {
  id: string;
  clinic_id: string;
  folio: string;
  tipo: "ciclico" | "completo" | "aleatorio" | "turno";
  estatus: "en_progreso" | "pendiente_revision" | "cerrado" | "cancelado";
  fecha_inicio: string;
  fecha_cierre: string | null;
  categoria_filtro: string | null;
  notas: string;
  created_at: string;
  total_items?: number;
  items_contados?: number;
  items_con_diferencia?: number;
}

interface ConteoRow {
  id: string;
  clinic_id: string;
  folio: string;
  tipo: string;
  estatus: string;
  fecha_inicio: string;
  fecha_cierre: string | null;
  categoria_filtro: string | null;
  notas: string | null;
  created_at: string;
}

const toConteo = (row: ConteoRow): Conteo => ({
  id: row.id,
  clinic_id: row.clinic_id,
  folio: row.folio,
  tipo: row.tipo as Conteo["tipo"],
  estatus: row.estatus as Conteo["estatus"],
  fecha_inicio: row.fecha_inicio,
  fecha_cierre: row.fecha_cierre,
  categoria_filtro: row.categoria_filtro,
  notas: row.notas ?? "",
  created_at: row.created_at,
});

const nextFolioConteo = (existing: string[]): string => {
  const nums = existing.map((f) => parseInt(f.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `INV-${String(max + 1).padStart(4, "0")}`;
};

export function useInventarioCiclico(clinicId: string | null) {
  const [items, setItems] = useState<Conteo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await untypedTable("conteos_inventario")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setItems(((data ?? []) as ConteoRow[]).map(toConteo));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar los conteos."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const iniciarConteo = useCallback(async (tipo: Conteo["tipo"], categoriaFiltro: string, notas: string): Promise<{ conteoId: string; items: ConteoItem[] }> => {
    if (!clinicId) throw new Error("No hay clínica activa.");
    const folio = nextFolioConteo(items.map((c) => c.folio));

    const { data: conteoData, error: cErr } = await untypedTable("conteos_inventario")
      .insert({
        clinic_id: clinicId,
        folio,
        tipo,
        categoria_filtro: categoriaFiltro || null,
        notas: notas.trim() || null,
        estatus: "en_progreso",
      })
      .select("id")
      .single();
    if (cErr) throw new Error(friendlyError(cErr, "No se pudo iniciar el conteo."));
    const conteoId = (conteoData as { id: string }).id;

    // Cargar lotes con existencia > 0 (conteo ciego: SIN mostrar existencia_sistema al contador)
    let lotesQuery = untypedTable("lotes_medicamento")
      .select("id, medicamento_id, numero_lote, existencia, medicamentos(nombre, categoria)")
      .eq("clinic_id", clinicId)
      .gt("existencia", 0);
    if (categoriaFiltro) {
      lotesQuery = lotesQuery.eq("medicamentos.categoria", categoriaFiltro);
    }
    const { data: lotes } = await lotesQuery;

    const itemRows = ((lotes ?? []) as {
      id: string; medicamento_id: string; numero_lote: string | null; existencia: number;
      medicamentos?: { nombre: string } | null;
    }[]).map((l) => ({
      conteo_id: conteoId,
      medicamento_id: l.medicamento_id,
      lote_id: l.id,
      numero_lote: l.numero_lote ?? "",
      existencia_sistema: l.existencia,
      existencia_contada: null,
    }));

    if (itemRows.length > 0) {
      const { error: iErr } = await untypedTable("conteos_items").insert(itemRows);
      if (iErr) throw new Error(friendlyError(iErr, "No se pudieron crear los items del conteo."));
    }

    await load();

    const createdItems: ConteoItem[] = itemRows.map((r, i) => ({
      id: "", conteo_id: conteoId, medicamento_id: r.medicamento_id,
      medicamento_nombre: ((lotes ?? []) as { id: string; medicamentos?: { nombre: string } | null }[])[i]?.medicamentos?.nombre ?? "",
      lote_id: r.lote_id, numero_lote: r.numero_lote,
      existencia_sistema: r.existencia_sistema, existencia_contada: null,
      diferencia: null, fue_ajustado: false, nota_diferencia: "", contado_at: null,
    }));
    return { conteoId, items: createdItems };
  }, [clinicId, items, load]);

  const registrarConteo = useCallback(async (itemId: string, existenciaContada: number, notaDiferencia: string): Promise<void> => {
    const { error: uErr } = await untypedTable("conteos_items").update({
      existencia_contada: existenciaContada,
      nota_diferencia: notaDiferencia.trim() || null,
      contado_at: new Date().toISOString(),
    }).eq("id", itemId);
    if (uErr) throw new Error(friendlyError(uErr, "No se pudo registrar el conteo."));
  }, []);

  const cerrarConteo = useCallback(async (conteoId: string): Promise<void> => {
    const { error: uErr } = await untypedTable("conteos_inventario").update({
      estatus: "pendiente_revision",
      fecha_cierre: new Date().toISOString(),
    }).eq("id", conteoId);
    if (uErr) throw new Error(friendlyError(uErr, "No se pudo cerrar el conteo."));
    await load();
  }, [load]);

  const getItems = useCallback(async (conteoId: string): Promise<ConteoItem[]> => {
    const { data, error: qErr } = await untypedTable("conteos_items")
      .select("*, medicamentos(nombre)")
      .eq("conteo_id", conteoId)
      .order("medicamentos(nombre)");
    if (qErr) throw new Error(friendlyError(qErr, "No se pudieron cargar los items."));
    return ((data ?? []) as (ConteoItem & { medicamentos?: { nombre: string } })[])
      .map((r) => ({ ...r, medicamento_nombre: r.medicamentos?.nombre ?? "" }));
  }, []);

  return { items, loading, error, iniciarConteo, registrarConteo, cerrarConteo, getItems, refresh: load };
}
