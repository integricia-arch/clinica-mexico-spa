import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";
import { supabase } from "@/integrations/supabase/client";

export type TipoControl = "otc" | "rx_simple" | "psicotropico_iii" | "psicotropico_i_ii" | "estupefaciente";
export type TipoMovimiento = "entrada" | "salida" | "ajuste" | "destruccion";

export const ETIQUETAS_CONTROL: Record<TipoControl, string> = {
  otc: "OTC / Sin receta",
  rx_simple: "Receta simple",
  psicotropico_iii: "Psicotrópico Grupo III",
  psicotropico_i_ii: "Psicotrópico Grupo I-II",
  estupefaciente: "Estupefaciente",
};

export interface LibroControl {
  id: string;
  clinic_id: string;
  medicamento_id: string;
  medicamento_nombre?: string;
  tipo_control?: TipoControl;
  periodo_inicio: string;
  periodo_fin: string | null;
  responsable_sanitario: string | null;
  folio_cofepris: string | null;
  notas: string | null;
  cerrado: boolean;
  saldo_actual?: number;
  created_at: string;
}

export interface LibroMovimiento {
  id: string;
  libro_id: string;
  clinic_id: string;
  fecha_movimiento: string;
  tipo: TipoMovimiento;
  medicamento_id: string;
  medicamento_nombre?: string;
  lote_id: string | null;
  numero_lote: string | null;
  fecha_caducidad: string | null;
  cantidad: number;
  recepcion_id: string | null;
  orden_id: string | null;
  proveedor_id: string | null;
  numero_factura: string | null;
  numero_receta: string | null;
  cedula_medico: string | null;
  nombre_medico: string | null;
  nombre_paciente: string | null;
  diagnostico: string | null;
  saldo_anterior: number;
  saldo_posterior: number;
  firmado_by: string | null;
  firmado_at: string | null;
  notas: string | null;
  created_at: string;
}

export interface LibroInput {
  medicamento_id: string;
  periodo_inicio: string;
  responsable_sanitario: string;
  folio_cofepris: string;
  notas: string;
}

export interface MovimientoEntradaInput {
  libro_id: string;
  medicamento_id: string;
  fecha_movimiento: string;
  cantidad: number;
  lote_id: string | null;
  numero_lote: string;
  fecha_caducidad: string;
  recepcion_id: string | null;
  orden_id: string | null;
  proveedor_id: string | null;
  numero_factura: string;
  notas: string;
}

export interface MovimientoSalidaInput {
  libro_id: string;
  medicamento_id: string;
  fecha_movimiento: string;
  cantidad: number;
  lote_id: string | null;
  numero_lote: string;
  numero_receta: string;
  cedula_medico: string;
  nombre_medico: string;
  nombre_paciente: string;
  diagnostico: string;
  notas: string;
}

interface LibroRow {
  id: string;
  clinic_id: string;
  medicamento_id: string;
  medicamentos?: { nombre: string; tipo_control: string } | null;
  periodo_inicio: string;
  periodo_fin: string | null;
  responsable_sanitario: string | null;
  folio_cofepris: string | null;
  notas: string | null;
  cerrado: boolean;
  created_at: string;
}

const toLibro = (row: LibroRow): LibroControl => ({
  id: row.id,
  clinic_id: row.clinic_id,
  medicamento_id: row.medicamento_id,
  medicamento_nombre: row.medicamentos?.nombre ?? "",
  tipo_control: (row.medicamentos?.tipo_control as TipoControl) ?? "otc",
  periodo_inicio: row.periodo_inicio,
  periodo_fin: row.periodo_fin,
  responsable_sanitario: row.responsable_sanitario,
  folio_cofepris: row.folio_cofepris,
  notas: row.notas,
  cerrado: row.cerrado,
  created_at: row.created_at,
});

export function useLibroControlControlados(clinicId: string | null) {
  const [libros, setLibros] = useState<LibroControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) { setLibros([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await untypedTable("libro_control_controlados")
        .select("*, medicamentos(nombre, tipo_control)")
        .eq("clinic_id", clinicId)
        .order("periodo_inicio", { ascending: false });
      if (qErr) throw qErr;
      setLibros(((data ?? []) as LibroRow[]).map(toLibro));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar los libros de control."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const createLibro = useCallback(async (input: LibroInput): Promise<string> => {
    if (!clinicId) throw new Error("No hay clínica activa.");
    const { data, error: cErr } = await untypedTable("libro_control_controlados").insert({
      clinic_id: clinicId,
      medicamento_id: input.medicamento_id,
      periodo_inicio: input.periodo_inicio,
      responsable_sanitario: input.responsable_sanitario.trim() || null,
      folio_cofepris: input.folio_cofepris.trim() || null,
      notas: input.notas.trim() || null,
    }).select("id").single();
    if (cErr) throw new Error(friendlyError(cErr, "No se pudo crear el libro de control."));
    await load();
    return (data as { id: string }).id;
  }, [clinicId, load]);

  const cerrarLibro = useCallback(async (libroId: string, periodoFin: string): Promise<void> => {
    await untypedTable("libro_control_controlados").update({
      cerrado: true,
      periodo_fin: periodoFin,
    }).eq("id", libroId);
    await load();
  }, [load]);

  const registrarEntrada = useCallback(async (input: MovimientoEntradaInput): Promise<void> => {
    if (!clinicId) throw new Error("No hay clínica activa.");
    const saldo = await getSaldoActual(input.libro_id, input.medicamento_id);
    const { error: mErr } = await untypedTable("libro_control_movimientos").insert({
      libro_id: input.libro_id,
      clinic_id: clinicId,
      fecha_movimiento: input.fecha_movimiento,
      tipo: "entrada",
      medicamento_id: input.medicamento_id,
      lote_id: input.lote_id,
      numero_lote: input.numero_lote.trim() || null,
      fecha_caducidad: input.fecha_caducidad || null,
      cantidad: input.cantidad,
      recepcion_id: input.recepcion_id,
      orden_id: input.orden_id,
      proveedor_id: input.proveedor_id,
      numero_factura: input.numero_factura.trim() || null,
      saldo_anterior: saldo,
      saldo_posterior: saldo + input.cantidad,
      notas: input.notas.trim() || null,
    });
    if (mErr) throw new Error(friendlyError(mErr, "No se pudo registrar la entrada."));
  }, [clinicId]);

  const registrarSalida = useCallback(async (input: MovimientoSalidaInput): Promise<void> => {
    if (!clinicId) throw new Error("No hay clínica activa.");
    if (!input.numero_receta.trim()) throw new Error("El número de receta es obligatorio para salidas.");
    if (!input.cedula_medico.trim()) throw new Error("La cédula del médico es obligatoria.");
    if (!input.nombre_paciente.trim()) throw new Error("El nombre del paciente es obligatorio.");
    const saldo = await getSaldoActual(input.libro_id, input.medicamento_id);
    if (input.cantidad > saldo) throw new Error(`Saldo insuficiente: existe ${saldo} unidades en el libro.`);
    const { error: mErr } = await untypedTable("libro_control_movimientos").insert({
      libro_id: input.libro_id,
      clinic_id: clinicId,
      fecha_movimiento: input.fecha_movimiento,
      tipo: "salida",
      medicamento_id: input.medicamento_id,
      lote_id: input.lote_id,
      numero_lote: input.numero_lote.trim() || null,
      cantidad: input.cantidad,
      numero_receta: input.numero_receta.trim(),
      cedula_medico: input.cedula_medico.trim(),
      nombre_medico: input.nombre_medico.trim() || null,
      nombre_paciente: input.nombre_paciente.trim(),
      diagnostico: input.diagnostico.trim() || null,
      saldo_anterior: saldo,
      saldo_posterior: saldo - input.cantidad,
      notas: input.notas.trim() || null,
    });
    if (mErr) throw new Error(friendlyError(mErr, "No se pudo registrar la salida."));
  }, [clinicId]);

  const firmarMovimiento = useCallback(async (movimientoId: string): Promise<void> => {
    const { data: user } = await supabase.auth.getUser();
    await untypedTable("libro_control_movimientos").update({
      firmado_by: user.user?.id ?? null,
      firmado_at: new Date().toISOString(),
    }).eq("id", movimientoId);
  }, []);

  const getMovimientos = useCallback(async (libroId: string): Promise<LibroMovimiento[]> => {
    const { data, error: qErr } = await untypedTable("libro_control_movimientos")
      .select("*, medicamentos(nombre)")
      .eq("libro_id", libroId)
      .order("fecha_movimiento", { ascending: true })
      .order("created_at", { ascending: true });
    if (qErr) throw new Error(friendlyError(qErr, "No se pudieron cargar los movimientos."));
    return ((data ?? []) as (LibroMovimiento & { medicamentos?: { nombre: string } | null })[]).map((r) => ({
      ...r,
      medicamento_nombre: r.medicamentos?.nombre ?? "",
    }));
  }, []);

  const getSaldoActual = useCallback(async (libroId: string, _medId: string): Promise<number> => {
    const { data } = await untypedTable("libro_control_movimientos")
      .select("saldo_posterior")
      .eq("libro_id", libroId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { saldo_posterior: number } | null };
    return data?.saldo_posterior ?? 0;
  }, []);

  const librosActivos = libros.filter((l) => !l.cerrado);

  return {
    libros, librosActivos, loading, error,
    createLibro, cerrarLibro,
    registrarEntrada, registrarSalida, firmarMovimiento,
    getMovimientos, refresh: load,
  };
}
