import { useState, useEffect } from "react";
import { Timer, StopCircle, AlertCircle, ArrowUpDown, FileBarChart2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { restSelect } from "@/lib/restClient";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import TurnoOpenWizard from "@/components/turno/TurnoOpenWizard";
import { exceedsLimiteEfectivo } from "@/lib/cajaLimits";

import { fmt, ACTION_LABELS } from "./cajaTurno/shared";
import { CloseTurnoDialog } from "./cajaTurno/CloseTurnoDialog";
import { FondoMovimientoDialog } from "./cajaTurno/FondoMovimientoDialog";
import { CorteXDialog } from "./cajaTurno/CorteXDialog";
import { HistorialTurnos } from "./cajaTurno/HistorialTurnos";
import type { Caja, Turno, FondoMovimiento, CorteRow, TurnoHistorial, LinkAudit } from "./cajaTurno/types";

export default function CajaTurno({ onTurnoCerrado }: { onTurnoCerrado?: () => void } = {}) {
  const { user } = useAuth();
  const { activeClinic } = useActiveClinic();

  const [cajas, setCajas] = useState<Caja[]>([]);
  const [turnoActivo, setTurnoActivo] = useState<Turno | null>(null);
  const [fondos, setFondos] = useState<FondoMovimiento[]>([]);
  const [historial, setHistorial] = useState<TurnoHistorial[]>([]);
  const [auditLog, setAuditLog] = useState<LinkAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [fondoDialogOpen, setFondoDialogOpen] = useState(false);
  const [corteXDialogOpen, setCorteXDialogOpen] = useState(false);
  const [limiteEfectivo, setLimiteEfectivo] = useState<string>("");

  const load = async () => {
    if (!activeClinic?.id || !user?.id) return;
    setLoading(true);

    const [{ data: cajasData }, { data: turnoData }, auditRows] = await Promise.all([
      (supabase as any).from("cajas").select("id, nombre, fondo_default, es_farmacia")
        .eq("clinic_id", activeClinic.id).eq("activo", true).order("nombre"),
      (supabase as any).from("turnos").select("*")
        .eq("clinic_id", activeClinic.id).eq("cajero_user_id", user.id)
        .eq("estado", "abierto").maybeSingle(),
      restSelect(
        "turno_pharmacy_link_audit",
        `select=id,turno_id,caja_id,pharmacy_shift_id,action,reason,created_at&clinic_id=eq.${activeClinic.id}&order=created_at.desc&limit=20`,
      ).catch(() => [] as LinkAudit[]),
    ]);

    const cajasList = (cajasData as Caja[]) ?? [];
    const activeTurno = (turnoData as Turno | null) ?? null;

    setCajas(cajasList);
    setTurnoActivo(activeTurno);
    setAuditLog((auditRows as LinkAudit[]) ?? []);

    const { data: settingsData } = await (supabase as any)
      .from("clinic_settings")
      .select("data")
      .eq("clinic_id", activeClinic.id)
      .eq("section", "caja")
      .maybeSingle();
    setLimiteEfectivo(settingsData?.data?.limite_efectivo ?? "");

    // Fondos del turno activo
    if (activeTurno) {
      const { data: fondosData } = await (supabase as any)
        .from("fondos_movimientos")
        .select("id, tipo, monto, motivo, destino, created_at")
        .eq("turno_id", activeTurno.id)
        .order("created_at", { ascending: false });
      setFondos((fondosData as FondoMovimiento[]) ?? []);
    } else {
      setFondos([]);
    }

    // Historial de turnos cerrados/cancelados
    const { data: turnosHist } = await (supabase as any).from("turnos")
      .select("id, caja_id, estado, monto_apertura, monto_cierre, abierto_at, cerrado_at, notas_cierre")
      .eq("clinic_id", activeClinic.id)
      .neq("estado", "abierto")
      .order("abierto_at", { ascending: false })
      .limit(20);

    if (turnosHist && turnosHist.length > 0) {
      const ids = turnosHist.map((t: any) => t.id);
      const cortesData = await restSelect(
        "cortes",
        `select=id,tipo,folio_secuencial,created_at,efectivo_esperado,conteo_ciego,diferencia,total_general,conteo_movimientos,requiere_autorizacion,turno_id&turno_id=in.(${ids.join(",")})&order=created_at`,
      ).catch(() => []);

      const cortesByTurno: Record<string, CorteRow[]> = {};
      for (const c of (cortesData as CorteRow[]) ?? []) {
        if (!cortesByTurno[c.turno_id]) cortesByTurno[c.turno_id] = [];
        cortesByTurno[c.turno_id].push(c as CorteRow);
      }

      setHistorial(
        turnosHist.map((t: any) => ({ ...t, cortes: cortesByTurno[t.id] ?? [] }))
      );
    } else {
      setHistorial([]);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [activeClinic?.id, user?.id]);

  const handleTurnoCerrado = () => { setCloseDialogOpen(false); load(); onTurnoCerrado?.(); };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground">Turno de Caja</h1>
        <p className="mt-1 text-sm text-muted-foreground">Abre o cierra tu turno de trabajo en caja</p>
      </div>

      {cajas.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-300/50 bg-yellow-50/50 p-5 dark:border-yellow-800/30 dark:bg-yellow-900/10">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Sin cajas configuradas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Pide al administrador que configure al menos una caja en <strong>Configuración → Caja</strong>.
            </p>
          </div>
        </div>
      ) : turnoActivo ? (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Turno activo</p>
              <p className="text-xs text-muted-foreground">
                Abierto: {new Date(turnoActivo.abierto_at).toLocaleString("es-MX")} — Fondo: {fmt(turnoActivo.monto_apertura)}
              </p>
              {turnoActivo.pharmacy_shift_id && (
                <p className="text-xs text-primary mt-1">
                  Vinculado al POS Farmacia. Cierra primero el corte en <strong>Farmacia</strong> antes de cerrar este turno.
                </p>
              )}
            </div>
          </div>

          {(() => {
            const netoFondos = fondos.reduce((s, f) => s + (f.tipo === "ingreso" ? f.monto : -f.monto), 0);
            const efectivoAprox = turnoActivo.monto_apertura + netoFondos;
            return exceedsLimiteEfectivo(efectivoAprox, limiteEfectivo) ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Efectivo en caja (~{fmt(efectivoAprox)}) supera el límite configurado — considera un cash drop.</span>
              </div>
            ) : null;
          })()}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setFondoDialogOpen(true)}>
              <ArrowUpDown className="h-4 w-4 mr-1.5" /> Egreso / Ingreso
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCorteXDialogOpen(true)}>
              <FileBarChart2 className="h-4 w-4 mr-1.5" /> Corte X
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setCloseDialogOpen(true)} disabled={saving}>
              <StopCircle className="h-4 w-4 mr-1.5" /> Cerrar turno
            </Button>
          </div>

          {fondos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Movimientos de fondo del turno</p>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Hora</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Motivo</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fondos.map((f) => (
                      <tr key={f.id}>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(f.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-medium ${f.tipo === "egreso" ? "text-red-600" : f.tipo === "cash_drop" ? "text-amber-600" : "text-green-600"}`}>
                            {f.tipo === "egreso" ? "Retiro" : f.tipo === "cash_drop" ? "Cash drop" : "Depósito"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-foreground">{f.motivo}</td>
                        <td className={`px-3 py-2 text-right font-medium ${f.tipo === "ingreso" ? "text-green-600" : "text-red-600"}`}>
                          {f.tipo === "ingreso" ? "+" : "−"}{fmt(f.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <TurnoOpenWizard
          cajaFilter="general"
          onOpened={() => load()}
        />
      )}

      {/* Historial de turnos */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold text-card-foreground mb-1">Historial de turnos</h2>
        <p className="text-xs text-muted-foreground mb-4">Últimos 20 turnos cerrados con sus cortes de arqueo.</p>
        <HistorialTurnos turnos={historial} cajas={cajas} />
      </div>

      {/* Audit log farmacia */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-semibold text-card-foreground mb-1">Historial de enlace con POS Farmacia</h2>
        <p className="text-xs text-muted-foreground mb-4">Últimos 20 eventos de vinculación entre turnos de caja y cortes de farmacia en esta clínica.</p>
        {auditLog.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin eventos registrados aún.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {auditLog.map((a) => {
              const meta = ACTION_LABELS[a.action] ?? { label: a.action, tone: "text-muted-foreground bg-muted" };
              return (
                <li key={a.id} className="py-3 flex items-start gap-3">
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${meta.tone}`}>{meta.label}</span>
                  <div className="flex-1 min-w-0">
                    {a.reason && <p className="text-foreground">{a.reason}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(a.created_at).toLocaleString("es-MX")}
                      {a.pharmacy_shift_id && <> · corte <code className="font-mono">{a.pharmacy_shift_id.slice(0, 8)}</code></>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CloseTurnoDialog
        open={closeDialogOpen}
        turno={turnoActivo}
        cajaNombre={cajas.find((c) => c.id === turnoActivo?.caja_id)?.nombre}
        onClose={() => setCloseDialogOpen(false)}
        onClosed={handleTurnoCerrado}
      />
      <FondoMovimientoDialog
        open={fondoDialogOpen}
        turnoId={turnoActivo?.id ?? null}
        clinicId={activeClinic?.id ?? ""}
        onClose={() => setFondoDialogOpen(false)}
        onDone={() => { setFondoDialogOpen(false); load(); }}
      />
      <CorteXDialog
        open={corteXDialogOpen}
        turnoId={turnoActivo?.id ?? null}
        onClose={() => setCorteXDialogOpen(false)}
      />
    </div>
  );
}
