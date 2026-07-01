import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { untypedTable } from "@/lib/untypedTable";

export interface CxpAlerta {
  id: string;
  clinic_id: string;
  tipo: "duplicado" | "limite_excedido" | "clabe_sin_verificar" | "vencimiento_hoy" | "pago_sin_gr" | "fraccionamiento_sospechoso";
  proveedor_id: string | null;
  proveedor_nombre?: string;
  factura_id: string | null;
  factura_folio?: string;
  descripcion: string;
  severidad: "critica" | "alta" | "media" | "baja";
  resuelta: boolean;
  resuelta_por: string | null;
  resuelta_at: string | null;
  created_at: string;
}

interface AlertaRow {
  id: string;
  clinic_id: string;
  tipo: string;
  proveedor_id: string | null;
  proveedores?: { nombre: string } | null;
  factura_id: string | null;
  facturas_proveedor?: { folio_interno: string } | null;
  descripcion: string;
  severidad: string;
  resuelta: boolean;
  resuelta_por: string | null;
  resuelta_at: string | null;
  created_at: string;
}

const toAlerta = (row: AlertaRow): CxpAlerta => ({
  id: row.id,
  clinic_id: row.clinic_id,
  tipo: row.tipo as CxpAlerta["tipo"],
  proveedor_id: row.proveedor_id,
  proveedor_nombre: row.proveedores?.nombre ?? "",
  factura_id: row.factura_id,
  factura_folio: row.facturas_proveedor?.folio_interno ?? "",
  descripcion: row.descripcion,
  severidad: row.severidad as CxpAlerta["severidad"],
  resuelta: row.resuelta,
  resuelta_por: row.resuelta_por,
  resuelta_at: row.resuelta_at,
  created_at: row.created_at,
});

export function useCxpAlertas(clinicId: string | null) {
  const [items, setItems] = useState<CxpAlerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await untypedTable("cxp_alertas")
        .select("*, proveedores(nombre), facturas_proveedor(folio_interno)")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setItems(((data ?? []) as AlertaRow[]).map(toAlerta));
    } catch (e) {
      setError(friendlyError(e as never, "No se pudieron cargar las alertas de CxP."));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const resolver = useCallback(async (alertaId: string, userId: string): Promise<void> => {
    const { error: uErr } = await untypedTable("cxp_alertas").update({
      resuelta: true,
      resuelta_por: userId,
      resuelta_at: new Date().toISOString(),
    }).eq("id", alertaId);
    if (uErr) throw new Error(friendlyError(uErr, "No se pudo resolver la alerta."));
    await load();
  }, [load]);

  const pendientes = items.filter((a) => !a.resuelta);
  const criticas = pendientes.filter((a) => a.severidad === "critica");

  return { items, loading, error, pendientes, criticas, resolver, refresh: load };
}
