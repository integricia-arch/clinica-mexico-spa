import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useAuth } from "@/hooks/useAuth";

export interface CotizacionItem {
  id?: string;
  cotizacion_id?: string;
  medicamento_id?: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario_centavos: number;
  descuento_pct?: number;
  iva_aplica?: boolean;
  subtotal_centavos?: number;
  linea_numero?: number;
}

export interface Cotizacion {
  id: string;
  clinic_id: string;
  folio: string;
  solicitud_compra_id: string | null;
  proveedor_id: string;
  fecha_cotizacion: string;
  vigente_hasta: string | null;
  subtotal_centavos: number;
  iva_centavos: number;
  total_centavos: number;
  plazo_entrega_dias: number | null;
  notas: string | null;
  seleccionada: boolean;
  orden_compra_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: CotizacionItem[];
  proveedor?: { nombre: string; rfc: string | null };
}

export interface NuevaCotizacion {
  solicitud_compra_id?: string;
  proveedor_id: string;
  fecha_cotizacion?: string;
  vigente_hasta?: string;
  plazo_entrega_dias?: number;
  notas?: string;
  items: CotizacionItem[];
}

function calcTotales(items: CotizacionItem[]) {
  let subtotal = 0;
  let iva = 0;
  for (const it of items) {
    const desc = 1 - (it.descuento_pct ?? 0) / 100;
    const sub = Math.round(it.cantidad * it.precio_unitario_centavos * desc);
    subtotal += sub;
    if (it.iva_aplica !== false) iva += Math.round(sub * 0.16);
  }
  return { subtotal, iva, total: subtotal + iva };
}

function folioGen() {
  return `COT-${Date.now().toString(36).toUpperCase()}`;
}

export function useCotizaciones() {
  const { activeClinicId } = useActiveClinic();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCotizaciones = useCallback(
    async (solicitudCompraId?: string): Promise<Cotizacion[]> => {
      if (!activeClinicId) return [];
      setLoading(true);
      setError(null);
      try {
        const db = supabase.from("cotizaciones");
        let q = db
          .select("*, proveedor:proveedores(nombre, rfc), items:cotizaciones_items(*)")
          .eq("clinic_id", activeClinicId)
          .order("created_at", { ascending: false });
        if (solicitudCompraId) q = q.eq("solicitud_compra_id", solicitudCompraId);
        const { data, error: err } = await q;
        if (err) throw err;
        return (data || []) as Cotizacion[];
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [activeClinicId]
  );

  const crearCotizacion = useCallback(
    async (input: NuevaCotizacion): Promise<Cotizacion> => {
      if (!activeClinicId) throw new Error("Sin clínica activa");
      if (!input.items.length) throw new Error("La cotización necesita al menos un concepto.");
      const itemInvalido = input.items.find(
        (it) => !it.descripcion.trim() || it.cantidad <= 0 || it.precio_unitario_centavos <= 0
      );
      if (itemInvalido) {
        throw new Error("Todos los conceptos deben tener descripción, cantidad y precio unitario mayores a cero.");
      }
      setLoading(true);
      setError(null);
      try {
        const { subtotal, iva, total } = calcTotales(input.items);
        const db = supabase.from("cotizaciones");
        const { data: cot, error: errCot } = await db
          .insert({
            clinic_id:           activeClinicId,
            folio:               folioGen(),
            solicitud_compra_id: input.solicitud_compra_id ?? null,
            proveedor_id:        input.proveedor_id,
            fecha_cotizacion:    input.fecha_cotizacion ?? new Date().toISOString().slice(0, 10),
            vigente_hasta:       input.vigente_hasta ?? null,
            plazo_entrega_dias:  input.plazo_entrega_dias ?? null,
            notas:               input.notas ?? null,
            subtotal_centavos:   subtotal,
            iva_centavos:        iva,
            total_centavos:      total,
            created_by:          user?.id ?? null,
          })
          .select()
          .single();
        if (errCot) throw errCot;

        const cotizacion = cot as Cotizacion;

        if (input.items.length > 0) {
          const dbItems = supabase.from("cotizaciones_items");
          const { error: errItems } = await dbItems.insert(
            input.items.map((it, idx) => {
              const desc = 1 - (it.descuento_pct ?? 0) / 100;
              return {
                cotizacion_id:            cotizacion.id,
                medicamento_id:           it.medicamento_id ?? null,
                descripcion:              it.descripcion,
                cantidad:                 it.cantidad,
                precio_unitario_centavos: it.precio_unitario_centavos,
                descuento_pct:            it.descuento_pct ?? 0,
                iva_aplica:               it.iva_aplica !== false,
                subtotal_centavos:        Math.round(it.cantidad * it.precio_unitario_centavos * desc),
                linea_numero:             idx + 1,
              };
            })
          );
          if (errItems) throw errItems;
        }

        return cotizacion;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [activeClinicId, user]
  );

  const seleccionarCotizacion = useCallback(
    async (cotizacionId: string, solicitudCompraId?: string): Promise<void> => {
      if (!activeClinicId) throw new Error("Sin clínica activa");
      setLoading(true);
      try {
        const db = supabase.from("cotizaciones");
        // Deselect all in same solicitud
        if (solicitudCompraId) {
          await db
            .update({ seleccionada: false })
            .eq("clinic_id", activeClinicId)
            .eq("solicitud_compra_id", solicitudCompraId);
        }
        const { error: err } = await db
          .update({ seleccionada: true })
          .eq("id", cotizacionId)
          .eq("clinic_id", activeClinicId);
        if (err) throw err;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [activeClinicId]
  );

  const marcarSeleccionadas = useCallback(
    async (cotizacionIds: string[]): Promise<void> => {
      if (!activeClinicId || !cotizacionIds.length) return;
      const { error: err } = await supabase
        .from("cotizaciones")
        .update({ seleccionada: true })
        .in("id", cotizacionIds)
        .eq("clinic_id", activeClinicId);
      if (err) throw new Error(err.message);
    },
    [activeClinicId]
  );

  const deseleccionarCotizacion = useCallback(
    async (cotizacionId: string): Promise<void> => {
      if (!activeClinicId) throw new Error("Sin clínica activa");
      const { data: cot } = await supabase
        .from("cotizaciones")
        .select("orden_compra_id")
        .eq("id", cotizacionId)
        .single();
      const ordenId = (cot as { orden_compra_id: string | null } | null)?.orden_compra_id;
      if (ordenId) {
        const { data: orden } = await supabase
          .from("ordenes_compra")
          .select("estatus")
          .eq("id", ordenId)
          .single();
        const estatus = (orden as { estatus: string } | null)?.estatus;
        if (estatus && estatus !== "borrador") {
          throw new Error("No se puede deshacer: la orden de compra generada ya avanzó de borrador.");
        }
      }
      const { error: err } = await supabase
        .from("cotizaciones")
        .update({ seleccionada: false })
        .eq("id", cotizacionId)
        .eq("clinic_id", activeClinicId);
      if (err) throw new Error(err.message);
    },
    [activeClinicId]
  );

  return { fetchCotizaciones, crearCotizacion, seleccionarCotizacion, marcarSeleccionadas, deseleccionarCotizacion, loading, error };
}
