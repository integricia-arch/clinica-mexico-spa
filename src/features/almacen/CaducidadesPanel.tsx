import type { Tables } from "@/integrations/supabase/types";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";

type Medicamento = Tables<"medicamentos">;
type Lote = Tables<"lotes_medicamento">;

interface Props {
  medicamentos: Medicamento[];
  lotes: Lote[];
}

export default function CaducidadesPanel({ medicamentos, lotes }: Props) {
  const hoy = new Date();
  const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30);
  const en60 = new Date(hoy); en60.setDate(hoy.getDate() + 60);
  const en90 = new Date(hoy); en90.setDate(hoy.getDate() + 90);

  const lotesCriticos = lotes.filter(l => l.fecha_caducidad && new Date(l.fecha_caducidad) <= en30 && l.existencia > 0);
  const lotesAlerta   = lotes.filter(l => l.fecha_caducidad && new Date(l.fecha_caducidad) > en30 && new Date(l.fecha_caducidad) <= en60 && l.existencia > 0);
  const lotesAtencion = lotes.filter(l => l.fecha_caducidad && new Date(l.fecha_caducidad) > en60 && new Date(l.fecha_caducidad) <= en90 && l.existencia > 0);
  const proxCaducidad = [...lotesCriticos, ...lotesAlerta, ...lotesAtencion];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lotes próximos a vencer</h2>
        <p className="text-xs text-muted-foreground">Protocolo FEFO — despachar el más próximo a vencer primero</p>
      </div>

      {proxCaducidad.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="mx-auto h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">Sin lotes próximos a vencer en los próximos 90 días</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[
            { label: "🔴 Crítico — menos de 30 días", lotes: lotesCriticos, color: "border-destructive/40 bg-destructive/5", badge: "bg-destructive text-destructive-foreground" },
            { label: "🟠 Alerta — 30 a 60 días", lotes: lotesAlerta, color: "border-orange-400/40 bg-orange-50 dark:bg-orange-950/20", badge: "bg-orange-500 text-white" },
            { label: "🟡 Atención — 60 a 90 días", lotes: lotesAtencion, color: "border-yellow-400/40 bg-yellow-50 dark:bg-yellow-950/20", badge: "bg-yellow-500 text-white" },
          ].map(({ label, lotes: tier, color, badge }) => tier.length > 0 && (
            <div key={label} className={`rounded-xl border ${color} overflow-hidden`}>
              <div className="px-4 py-2 border-b border-inherit flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${badge}`}>{tier.length}</span>
                <span className="text-sm font-semibold">{label}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-inherit">
                    <th className="px-4 py-2 text-left font-medium">Medicamento</th>
                    <th className="px-4 py-2 text-left font-medium">Lote</th>
                    <th className="px-4 py-2 text-center font-medium">Caducidad</th>
                    <th className="px-4 py-2 text-center font-medium">Días</th>
                    <th className="px-4 py-2 text-center font-medium">Existencia</th>
                    <th className="px-4 py-2 text-left font-medium">Acción sugerida</th>
                  </tr>
                </thead>
                <tbody>
                  {tier.map(lote => {
                    const med = medicamentos.find(m => m.id === lote.medicamento_id);
                    const diasRestantes = Math.ceil((new Date(lote.fecha_caducidad).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                    const accion = diasRestantes <= 15
                      ? "Destrucción COFEPRIS"
                      : diasRestantes <= 30
                      ? "Oferta / devolución proveedor"
                      : diasRestantes <= 60
                      ? "Priorizar despacho (FEFO)"
                      : "Monitorear";
                    return (
                      <tr key={lote.id} className="border-b border-inherit/50 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2 font-medium">{med?.nombre ?? "—"}</td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{lote.numero_lote}</td>
                        <td className="px-4 py-2 text-center text-xs">
                          {format(new Date(lote.fecha_caducidad), "dd/MM/yyyy")}
                        </td>
                        <td className="px-4 py-2 text-center font-bold">
                          <span className={diasRestantes <= 30 ? "text-destructive" : diasRestantes <= 60 ? "text-orange-600" : "text-yellow-600"}>
                            {diasRestantes}d
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">{lote.existencia}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{accion}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
