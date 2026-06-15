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
        const db = supabase.from("cotizaciones" as never) as ReturnType<typeof supabase.from>;
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
      setLoading(true);
      setError(null);
      try {
        const { subtotal, iva, total } = calcTotales(input.items);
        const db = supabase.from("cotizaciones" as never) as ReturnType<typeof supabase.from>;
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
          const dbItems = supabase.from("cotizaciones_items" as never) as ReturnType<typeof supabase.from>;
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
        const db = supabase.from("cotizaciones" as never) as ReturnType<typeof supabase.from>;
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

  return { fetchCotizaciones, crearCotizacion, seleccionarCotizacion, loading, error };
}
