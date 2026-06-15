import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";

export interface AlertaMatch {
  tipo: string;
  severidad: "CRITICA" | "ALTA" | "MEDIA" | "BAJA";
  descripcion: string;
  valorCFDI: number;
  valorReferencia: number;
  diferencia: number;
  porcentajeDiferencia: number;
}

export interface LineaMatch {
  lineaNumero: number;
  descripcion: string;
  noIdentificacion: string;
  cantidad: number;
  valorUnitarioCentavos: number;
  importeCentavos: number;
  ivaCentavos: number;
  totalCentavos: number;
  tasaIva: number;
  medicamentoId: string | null;
  matchMethod: string;
  matchScore: number;
  ocCantidadPedida: number | null;
  ocPrecioUnitCentavos: number | null;
  recepcionCantidadRecibida: number | null;
  difCantidadVsOc: number | null;
  difCantidadVsRecepcion: number | null;
  difPrecioPct: number | null;
  alertas: AlertaMatch[];
  tieneAlertaCritica: boolean;
}

export interface CfdiParseResult {
  fp_cfdi_id: string;
  uuid: string;
  total: number;
  estado_sat: string;
  errores_aritmeticos: string[];
  lineas_count: number;
  alertas_criticas: number;
  alertas_total: number;
  recomendacion: string;
  lineas: LineaMatch[];
}

interface ParseInput {
  facturaProveedorId: string;
  ordenCompraId?: string;
  recepcionId?: string;
  proveedorId?: string;
}

export function useFpCfdi() {
  const { activeClinicId } = useActiveClinic();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsearXML = useCallback(
    async (xmlFile: File, input: ParseInput): Promise<CfdiParseResult> => {
      if (!activeClinicId) throw new Error("Sin clínica activa");
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("No autenticado");

        const formData = new FormData();
        formData.append("cfdi_xml", xmlFile);
        formData.append("factura_proveedor_id", input.facturaProveedorId);
        formData.append("clinic_id", activeClinicId);
        if (input.ordenCompraId) formData.append("orden_compra_id", input.ordenCompraId);
        if (input.recepcionId) formData.append("recepcion_id", input.recepcionId);
        if (input.proveedorId) formData.append("proveedor_id", input.proveedorId);

        const { data: urlData } = await supabase.functions.invoke("cfdi-parse", {
          body: formData,
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!urlData?.success) {
          throw new Error(urlData?.error || "Error al parsear CFDI");
        }

        return urlData.data as CfdiParseResult;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [activeClinicId]
  );

  const obtenerLineas = useCallback(
    async (fpCfdiId: string): Promise<LineaMatch[]> => {
      const { data, error: err } = await supabase
        .from("fp_cfdi_lineas" as never)
        .select("*")
        .eq("fp_cfdi_id", fpCfdiId)
        .order("linea_numero");
      if (err) throw err;
      return (data || []) as LineaMatch[];
    },
    []
  );

  return { parsearXML, obtenerLineas, loading, error };
}
