import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { friendlyError } from "@/lib/errors";

export interface BalanzaFila {
  cuenta_id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
  saldo_inicial_centavos: number;
  cargos_centavos: number;
  abonos_centavos: number;
  saldo_final_centavos: number;
}

export interface LibroDiarioFila {
  poliza_id: string;
  folio: number;
  tipo: string;
  fecha: string;
  concepto: string;
  estado: string;
  orden: number;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe_centavos: number;
  haber_centavos: number;
  descripcion: string | null;
}

export interface AuxiliarFila {
  poliza_id: string;
  folio: number;
  fecha: string;
  concepto: string;
  debe_centavos: number;
  haber_centavos: number;
  saldo_acumulado_centavos: number;
}

export interface BalanceFila {
  cuenta_id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  saldo_centavos: number;
}

// ponytail: cuatro hooks casi idénticos (load/loading/error) — un solo hook
// genérico sería más abstracción que la que este número de reportes justifica.

export function useBalanzaComprobacion() {
  const { activeClinicId } = useActiveClinic();
  const [rows, setRows] = useState<BalanzaFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (desde: string, hasta: string) => {
    if (!activeClinicId || !desde || !hasta) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await (supabase as any).rpc("balanza_comprobacion", {
      p_clinic_id: activeClinicId, p_desde: desde, p_hasta: hasta,
    });
    if (err) setError(friendlyError(err));
    else setRows((data ?? []) as BalanzaFila[]);
    setLoading(false);
  }, [activeClinicId]);

  return { rows, loading, error, load };
}

export function useLibroDiario() {
  const { activeClinicId } = useActiveClinic();
  const [rows, setRows] = useState<LibroDiarioFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (desde: string, hasta: string) => {
    if (!activeClinicId || !desde || !hasta) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await (supabase as any).rpc("libro_diario", {
      p_clinic_id: activeClinicId, p_desde: desde, p_hasta: hasta,
    });
    if (err) setError(friendlyError(err));
    else setRows((data ?? []) as LibroDiarioFila[]);
    setLoading(false);
  }, [activeClinicId]);

  return { rows, loading, error, load };
}

export function useAuxiliaresCuenta() {
  const { activeClinicId } = useActiveClinic();
  const [rows, setRows] = useState<AuxiliarFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cuentaId: string, desde: string, hasta: string) => {
    if (!activeClinicId || !cuentaId || !desde || !hasta) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await (supabase as any).rpc("auxiliares_cuenta", {
      p_clinic_id: activeClinicId, p_cuenta_id: cuentaId, p_desde: desde, p_hasta: hasta,
    });
    if (err) setError(friendlyError(err));
    else setRows((data ?? []) as AuxiliarFila[]);
    setLoading(false);
  }, [activeClinicId]);

  return { rows, loading, error, load };
}

export function useBalanceGeneral() {
  const { activeClinicId } = useActiveClinic();
  const [rows, setRows] = useState<BalanceFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (al: string) => {
    if (!activeClinicId || !al) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await (supabase as any).rpc("balance_general", {
      p_clinic_id: activeClinicId, p_al: al,
    });
    if (err) setError(friendlyError(err));
    else setRows((data ?? []) as BalanceFila[]);
    setLoading(false);
  }, [activeClinicId]);

  return { rows, loading, error, load };
}
