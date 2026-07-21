import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import type { HuecoFila } from "@/hooks/useReportesContables";

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

interface CuentaRef { id: string; codigo: string; nombre: string }
interface Diagnostico {
  ok: boolean;
  motivo?: string;
  evento?: string;
  movimiento_id?: string;
  clinic_id?: string;
  reference_type?: string;
  reference_id?: string;
  monto_centavos?: number;
  fecha_devengo?: string;
  descripcion?: string;
  cuenta_cargo?: CuentaRef;
  cuenta_abono?: CuentaRef;
}

const JUSTIFICACION =
  "Partida doble (NIF A-2, postulado de dualidad económica; NIF C-1, presentación de " +
  "estados financieros): todo movimiento devengado debe registrarse con cargo y abono " +
  "iguales antes de poder aparecer en balanza o balance general. Este movimiento tiene " +
  "monto en devengo simple pero no tiene su asiento de partida doble — la regla dura de " +
  "crear_poliza() (SUM(debe)=SUM(haber)) exige generarlo con estas mismas cuentas que ya " +
  "usa el motor de asientos para este tipo de evento.";

export function PropuestaCorreccionCard({ hueco, onAplicado }: { hueco: HuecoFila; onAplicado: () => void }) {
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [loading, setLoading] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [descartado, setDescartado] = useState(false);
  const [aplicado, setAplicado] = useState(false);

  const diagnosticar = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("contab_diagnosticar_hueco", {
      p_movimiento_id: hueco.origen_id,
    });
    setLoading(false);
    if (error) { toast.error(friendlyError(error, "No se pudo diagnosticar el hueco.")); return; }
    setDiagnostico(data as Diagnostico);
  };

  const aplicar = async () => {
    if (!diagnostico?.ok || !diagnostico.cuenta_cargo || !diagnostico.cuenta_abono) return;
    setAplicando(true);
    const { error } = await (supabase as any).rpc("contab_generar_poliza_evento", {
      p_clinic_id: diagnostico.clinic_id,
      p_evento: diagnostico.evento,
      p_monto_centavos: diagnostico.monto_centavos,
      p_fecha: diagnostico.fecha_devengo,
      p_concepto: diagnostico.descripcion,
      p_reference_type: diagnostico.reference_type,
      p_reference_id: diagnostico.reference_id,
    });
    setAplicando(false);
    if (error) { toast.error(friendlyError(error, "No se pudo aplicar la corrección.")); return; }
    toast.success("Póliza generada");
    setAplicado(true);
    onAplicado();
  };

  if (descartado) return null;

  if (!diagnostico) {
    return (
      <div className="rounded-lg border p-3 text-sm flex items-center justify-between">
        <span>{hueco.descripcion} — {fmtMXN(hueco.monto_centavos)}</span>
        <Button size="sm" variant="outline" onClick={diagnosticar} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Diagnosticar
        </Button>
      </div>
    );
  }

  if (!diagnostico.ok) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        Sin regla contable configurada para el evento <span className="font-mono">{diagnostico.evento}</span> —
        requiere corrección manual (Pólizas → Nueva póliza).
      </div>
    );
  }

  if (aplicado) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" /> Póliza generada para este movimiento.
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3 text-sm space-y-2">
      <p className="font-medium">Propuesta de corrección</p>
      <table className="w-full text-xs">
        <tbody>
          <tr>
            <td className="py-1">{diagnostico.cuenta_cargo!.codigo} — {diagnostico.cuenta_cargo!.nombre}</td>
            <td className="py-1 text-right">Cargo {fmtMXN(diagnostico.monto_centavos!)}</td>
          </tr>
          <tr>
            <td className="py-1">{diagnostico.cuenta_abono!.codigo} — {diagnostico.cuenta_abono!.nombre}</td>
            <td className="py-1 text-right">Abono {fmtMXN(diagnostico.monto_centavos!)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">{JUSTIFICACION}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={aplicar} disabled={aplicando}>
          {aplicando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Aplicar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDescartado(true)}>
          <XCircle className="mr-1 h-4 w-4" /> Descartar
        </Button>
      </div>
    </div>
  );
}
