import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmt, DiffBadge, ResultRow } from "./shared";
import type { Caja, TurnoHistorial } from "./types";

export function HistorialTurnos({ turnos, cajas }: { turnos: TurnoHistorial[]; cajas: Caja[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (turnos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin turnos cerrados aún.</p>;
  }

  return (
    <ul className="space-y-2">
      {turnos.map((t) => {
        const cajaNombre = cajas.find((c) => c.id === t.caja_id)?.nombre ?? "Caja desconocida";
        const corteZ = t.cortes.find((c) => c.tipo === "Z") ?? null;
        const cortesX = t.cortes.filter((c) => c.tipo === "X");
        const isOpen = expanded === t.id;
        const estadoBadge =
          t.estado === "cerrado"
            ? "bg-muted text-muted-foreground"
            : "bg-red-100 text-red-700 dark:bg-red-900/20";

        return (
          <li key={t.id} className="rounded-lg border border-border bg-card text-sm">
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              onClick={() => setExpanded(isOpen ? null : t.id)}
            >
              {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="font-medium flex-1">{cajaNombre}</span>
              {corteZ && (
                <span className="text-xs font-mono text-primary">
                  Z-{String(corteZ.folio_secuencial ?? 0).padStart(6, "0")}
                </span>
              )}
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${estadoBadge}`}>
                {t.estado}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(t.abierto_at).toLocaleDateString("es-MX")}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  <ResultRow label="Apertura" value={fmt(t.monto_apertura)} />
                  {t.monto_cierre !== null && <ResultRow label="Contado" value={fmt(t.monto_cierre)} />}
                  {t.cerrado_at && (
                    <ResultRow label="Cierre" value={new Date(t.cerrado_at).toLocaleString("es-MX")} />
                  )}
                  {t.notas_cierre && (
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-[11px] text-muted-foreground">Notas cierre</p>
                      <p className="font-medium">{t.notas_cierre}</p>
                    </div>
                  )}
                </div>

                {corteZ && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Corte Z</p>
                    <div className="rounded-md border border-border bg-muted/30 p-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div>
                        <p className="text-muted-foreground">Folio</p>
                        <p className="font-mono font-semibold">Z-{String(corteZ.folio_secuencial ?? 0).padStart(6, "0")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Esperado</p>
                        <p className="font-medium">{fmt(corteZ.efectivo_esperado ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Contado</p>
                        <p className="font-medium">{corteZ.conteo_ciego !== null ? fmt(corteZ.conteo_ciego) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Diferencia</p>
                        <DiffBadge diff={corteZ.diferencia ?? null} />
                      </div>
                      {corteZ.requiere_autorizacion && (
                        <div className="col-span-2 sm:col-span-4">
                          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 text-[10px]">
                            Requirió autorización supervisor
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {cortesX.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Cortes X ({cortesX.length})</p>
                    <div className="space-y-1">
                      {cortesX.map((cx) => (
                        <div key={cx.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-xs">
                          <span className="font-mono text-muted-foreground">
                            X-{String(cx.folio_secuencial ?? 0).padStart(6, "0")}
                          </span>
                          <span className="flex-1 text-muted-foreground">
                            {new Date(cx.created_at).toLocaleString("es-MX")}
                          </span>
                          <span className="font-medium">{fmt(cx.efectivo_esperado ?? 0)}</span>
                          <span className="text-muted-foreground">{cx.conteo_movimientos} tickets</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
