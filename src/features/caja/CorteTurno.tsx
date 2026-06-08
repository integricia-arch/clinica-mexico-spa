import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Printer } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const formatMXN = (n: number) =>
  Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type TurnoRow = {
  id: string;
  caja_id: string;
  cajero_user_id: string;
  estado: "abierto" | "cerrado";
  monto_apertura: number;
  monto_cierre: number | null;
  notas_apertura: string | null;
  notas_cierre: string | null;
  abierto_at: string;
  cerrado_at: string | null;
  caja: { nombre: string } | null;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  );
}

export default function CorteTurno() {
  const { user } = useAuth();
  const { activeClinicId } = useActiveClinic();

  const [turnos, setTurnos] = useState<TurnoRow[]>([]);
  const [selected, setSelected] = useState<TurnoRow | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!activeClinicId || !user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("turnos")
      .select("id, caja_id, cajero_user_id, estado, monto_apertura, monto_cierre, notas_apertura, notas_cierre, abierto_at, cerrado_at, caja:cajas(nombre)")
      .eq("clinic_id", activeClinicId)
      .order("abierto_at", { ascending: false })
      .limit(30);
    const list = (data ?? []) as unknown as TurnoRow[];
    setTurnos(list);
    if (list.length > 0 && !selected) setSelected(list[0]);
    else if (list.length > 0 && selected) {
      const updated = list.find((t) => t.id === selected.id);
      if (updated) setSelected(updated);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [activeClinicId, user?.id]);

  const duracion = (t: TurnoRow) => {
    const a = new Date(t.abierto_at);
    const b = t.cerrado_at ? new Date(t.cerrado_at) : new Date();
    const mins = Math.round((b.getTime() - a.getTime()) / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}min`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Corte de turno</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />Imprimir
          </Button>
        </div>
      </div>

      {turnos.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">Sin turnos registrados aún.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* Lista */}
          <div className="rounded-xl border border-border bg-card p-2 space-y-1 max-h-[520px] overflow-auto">
            {loading && <p className="text-xs text-muted-foreground p-3">Cargando…</p>}
            {turnos.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t)}
                className={`w-full text-left rounded-md px-3 py-2 text-xs border transition-colors ${
                  selected?.id === t.id ? "bg-accent border-primary" : "border-transparent hover:bg-accent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate max-w-[140px]">{t.caja?.nombre ?? "Caja"}</span>
                  <Badge variant={t.estado === "abierto" ? "default" : "outline"} className="text-[10px] ml-1 shrink-0">
                    {t.estado}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {format(new Date(t.abierto_at), "dd/MM/yy HH:mm", { locale: es })}
                  {t.cerrado_at && ` → ${format(new Date(t.cerrado_at), "HH:mm", { locale: es })}`}
                </p>
                <p className="text-[11px]">Fondo: {formatMXN(t.monto_apertura)}</p>
              </button>
            ))}
          </div>

          {/* Detalle */}
          {selected ? (
            <div id="corte-print" className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-base">{selected.caja?.nombre ?? "Caja"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selected.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <Badge variant={selected.estado === "abierto" ? "default" : "outline"}>
                    {selected.estado === "abierto" ? "En curso" : "Cerrado"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Stat label="Fondo apertura" value={formatMXN(selected.monto_apertura)} />
                  <Stat
                    label="Abierto"
                    value={format(new Date(selected.abierto_at), "dd/MM/yy HH:mm", { locale: es })}
                  />
                  <Stat
                    label="Cerrado"
                    value={selected.cerrado_at
                      ? format(new Date(selected.cerrado_at), "dd/MM/yy HH:mm", { locale: es })
                      : "—"}
                  />
                  <Stat label="Duración" value={duracion(selected)} />
                  {selected.monto_cierre != null && (
                    <Stat label="Fondo cierre" value={formatMXN(selected.monto_cierre)} />
                  )}
                </div>

                {(selected.notas_apertura || selected.notas_cierre) && (
                  <div className="space-y-2 text-sm">
                    {selected.notas_apertura && (
                      <div className="rounded-md bg-muted px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Notas apertura</p>
                        <p>{selected.notas_apertura}</p>
                      </div>
                    )}
                    {selected.notas_cierre && (
                      <div className="rounded-md bg-muted px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Notas cierre</p>
                        <p>{selected.notas_cierre}</p>
                      </div>
                    )}
                  </div>
                )}

                {selected.estado === "abierto" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Turno aún activo. Ciérralo desde la pestaña Turno para generar el corte final.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Selecciona un turno para ver el corte.</p>
          )}
        </div>
      )}
    </div>
  );
}
