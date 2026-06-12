import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldCheck, Filter, Bug, Copy, RefreshCw, Store, ChevronDown, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useActiveClinic } from "@/hooks/useActiveClinic";

// ─── Types ────────────────────────────────────────────────────────────────────

type PosErrorRow = {
  id: string;
  created_at: string;
  funcion: string;
  error_msg: string;
  error_detail: string | null;
  payload: any;
};

type AuditRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  accion: string;
  tabla: string;
  registro_id: string | null;
  datos_anteriores: any;
  datos_nuevos: any;
  clinic_id: string | null;
};

// ─── Config ───────────────────────────────────────────────────────────────────

const ACCION_LABEL: Record<string, string> = {
  crear: "Creación", actualizar: "Actualización",
  cancelar: "Cancelación", eliminar: "Eliminación", consultar: "Consulta",
};
const ACCION_COLOR: Record<string, string> = {
  crear: "bg-success/10 text-success",
  actualizar: "bg-info/10 text-info",
  cancelar: "bg-warning/10 text-warning",
  eliminar: "bg-destructive/10 text-destructive",
  consultar: "bg-muted text-muted-foreground",
};
const TABLA_LABEL: Record<string, { modulo: string; nombre: string }> = {
  appointments: { modulo: "Agenda", nombre: "Cita" },
  expedientes: { modulo: "Expedientes", nombre: "Expediente" },
  notas_consulta: { modulo: "Expedientes", nombre: "Nota de consulta" },
  medicamentos: { modulo: "Farmacia", nombre: "Medicamento" },
  lotes_medicamento: { modulo: "Farmacia", nombre: "Lote" },
  movimientos_inventario: { modulo: "Farmacia", nombre: "Movimiento de inventario" },
  pharmacy_cash_shifts: { modulo: "Farmacia/Caja", nombre: "Turno farmacia" },
  pharmacy_sales: { modulo: "Farmacia/Caja", nombre: "Venta farmacia" },
  fondos_movimientos: { modulo: "Farmacia/Caja", nombre: "Movimiento de fondo" },
  turnos: { modulo: "Caja", nombre: "Turno caja" },
  cortes: { modulo: "Caja", nombre: "Corte" },
};

const EVENT_LABEL: Record<string, { label: string; color: string }> = {
  pharmacy_shift_opened: { label: "Turno farmacia abierto", color: "text-green-700 bg-green-50" },
  pharmacy_shift_closed: { label: "Turno farmacia cerrado", color: "text-blue-700 bg-blue-50" },
  corte_x_generado: { label: "Corte X generado", color: "text-violet-700 bg-violet-50" },
  turno_cerrado: { label: "Turno caja cerrado", color: "text-blue-700 bg-blue-50" },
  turno_fondo_movimiento: { label: "Movimiento de fondo", color: "text-amber-700 bg-amber-50" },
};

const PHARMACY_TABLAS = new Set([
  "pharmacy_cash_shifts", "pharmacy_sales", "fondos_movimientos",
  "turnos", "cortes",
]);

const MODULOS = ["Todos", "Agenda", "Expedientes", "Farmacia", "Caja", "Farmacia/Caja"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function copyText(txt: string) {
  navigator.clipboard.writeText(txt);
  toast.success("Log copiado al portapapeles");
}

// ─── PosErrorCard ─────────────────────────────────────────────────────────────

function PosErrorCard({ e }: { e: PosErrorRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{fmtDate(e.created_at)} · <code className="font-mono">{e.funcion}</code></p>
          <p className="text-sm font-medium text-destructive mt-0.5">{e.error_msg}</p>
          {e.error_detail && <p className="text-xs text-muted-foreground font-mono">SQLSTATE: {e.error_detail}</p>}
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <button onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-0.5 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Payload
          </button>
          <button onClick={() => copyText(JSON.stringify({
            fecha: e.created_at, funcion: e.funcion, error: e.error_msg,
            sqlstate: e.error_detail, payload: e.payload,
          }, null, 2))}
            className="flex items-center gap-0.5 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted">
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </div>
      {open && e.payload && (
        <pre className="mt-2 text-[10px] bg-muted rounded p-2 overflow-x-auto max-h-48">
          {JSON.stringify(e.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── FarmaciaLogCard ──────────────────────────────────────────────────────────

function FarmaciaLogCard({ r }: { r: AuditRow }) {
  const [open, setOpen] = useState(false);
  const evento = r.datos_nuevos?.event as string | undefined;
  const evMeta = evento ? EVENT_LABEL[evento] : undefined;
  const meta = TABLA_LABEL[r.tabla] ?? { modulo: r.tabla, nombre: r.tabla };
  const accionColor = ACCION_COLOR[r.accion] ?? "";

  const hasData = r.datos_nuevos && Object.keys(r.datos_nuevos).length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1 text-sm">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {evMeta ? (
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${evMeta.color}`}>{evMeta.label}</span>
            ) : (
              <>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${accionColor}`}>
                  {ACCION_LABEL[r.accion] ?? r.accion}
                </span>
                <span className="text-xs text-muted-foreground">{meta.nombre}</span>
              </>
            )}
            <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {r.user_id && <span>Usuario: <code className="font-mono">{r.user_id.slice(0, 8)}</code></span>}
            {r.registro_id && <span>ID: <code className="font-mono">{r.registro_id.slice(0, 8)}</code></span>}
          </div>
          {/* Quick summary from datos_nuevos */}
          {r.datos_nuevos?.folio_corte && (
            <p className="text-xs">Folio: <span className="font-medium">{r.datos_nuevos.folio_corte}</span></p>
          )}
          {r.datos_nuevos?.monto != null && (
            <p className="text-xs">Monto: <span className="font-medium">${Number(r.datos_nuevos.monto).toFixed(2)}</span>
              {r.datos_nuevos.motivo && <> · {r.datos_nuevos.motivo}</>}
            </p>
          )}
          {r.datos_nuevos?.difference != null && (
            <p className="text-xs">Diferencia: <span className={`font-medium ${Number(r.datos_nuevos.difference) < 0 ? "text-red-600" : Number(r.datos_nuevos.difference) > 0 ? "text-amber-600" : "text-green-600"}`}>
              ${Number(r.datos_nuevos.difference).toFixed(2)}
            </span></p>
          )}
        </div>
        {hasData && (
          <div className="shrink-0 flex items-center gap-1">
            <button onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-0.5 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted">
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} JSON
            </button>
            <button onClick={() => copyText(JSON.stringify(r.datos_nuevos, null, 2))}
              className="flex items-center gap-0.5 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted">
              <Copy className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      {open && hasData && (
        <pre className="mt-2 text-[10px] bg-muted rounded p-2 overflow-x-auto max-h-48">
          {JSON.stringify(r.datos_nuevos, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = "general" | "farmacia";

export default function Auditoria() {
  const { activeClinic } = useActiveClinic();
  const [tab, setTab] = useState<Tab>("general");

  // General audit
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modulo, setModulo] = useState<(typeof MODULOS)[number]>("Todos");

  // POS errors
  const [errors, setErrors] = useState<PosErrorRow[]>([]);
  const [errLoading, setErrLoading] = useState(false);

  // Farmacia tech logs
  const [farmLogs, setFarmLogs] = useState<AuditRow[]>([]);
  const [farmLoading, setFarmLoading] = useState(false);
  const [farmFilter, setFarmFilter] = useState<string>("todos");

  const loadErrors = async () => {
    setErrLoading(true);
    const { data } = await (supabase as any)
      .from("pos_error_logs")
      .select("id, created_at, funcion, error_msg, error_detail, payload")
      .order("created_at", { ascending: false })
      .limit(50);
    setErrors((data ?? []) as PosErrorRow[]);
    setErrLoading(false);
  };

  const loadFarmLogs = async () => {
    if (!activeClinic?.id) return;
    setFarmLoading(true);
    const { data } = await (supabase as any)
      .from("audit_logs")
      .select("id, created_at, user_id, accion, tabla, registro_id, datos_nuevos, datos_anteriores, clinic_id")
      .eq("clinic_id", activeClinic.id)
      .in("tabla", ["pharmacy_cash_shifts", "pharmacy_sales", "fondos_movimientos", "turnos", "cortes"])
      .order("created_at", { ascending: false })
      .limit(100);
    setFarmLogs((data ?? []) as AuditRow[]);
    setFarmLoading(false);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data ?? []) as AuditRow[]);
      setLoading(false);
    })();
    loadErrors();
  }, []);

  useEffect(() => {
    if (tab === "farmacia") loadFarmLogs();
  }, [tab, activeClinic?.id]);

  const filtradas = rows.filter((r) => {
    if (modulo === "Todos") return true;
    const meta = TABLA_LABEL[r.tabla];
    if (!meta) return modulo === "Todos";
    return meta.modulo === modulo || meta.modulo.startsWith(modulo);
  });

  const farmFiltered = farmLogs.filter((r) => {
    if (farmFilter === "todos") return true;
    if (farmFilter === "errores") return false;
    return r.tabla === farmFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Registro de auditoría
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Historial de accesos y cambios en agenda, expedientes, farmacia y caja
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-border">
        {(["general", "farmacia"] as const).map((t) => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t === "general" ? "General" : "Farmacia / Caja"}
          </button>
        ))}
      </div>

      {/* ── Tab: General ── */}
      {tab === "general" && (
        <>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select value={modulo} onChange={(e) => setModulo(e.target.value as any)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
              {MODULOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha y hora</th>
                    <th className="px-4 py-3 text-left">Módulo</th>
                    <th className="px-4 py-3 text-left">Recurso</th>
                    <th className="px-4 py-3 text-left">Acción</th>
                    <th className="px-4 py-3 text-left">Usuario</th>
                    <th className="px-4 py-3 text-left">Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Cargando eventos…</td></tr>
                  ) : filtradas.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No hay eventos registrados</td></tr>
                  ) : (
                    filtradas.map((r) => {
                      const meta = TABLA_LABEL[r.tabla] ?? { modulo: r.tabla, nombre: r.tabla };
                      return (
                        <tr key={r.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                          <td className="px-4 py-3">{meta.modulo}</td>
                          <td className="px-4 py-3">{meta.nombre}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCION_COLOR[r.accion] ?? ""}`}>
                              {ACCION_LABEL[r.accion] ?? r.accion}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {r.user_id ? r.user_id.slice(0, 8) + "…" : "Sistema"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {r.registro_id ? r.registro_id.slice(0, 8) + "…" : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Errores POS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Bug className="h-4 w-4 text-destructive" />
                Errores POS (últimos 50)
              </h2>
              <button onClick={loadErrors} disabled={errLoading}
                className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">
                <RefreshCw className={`h-3 w-3 ${errLoading ? "animate-spin" : ""}`} />
                Actualizar
              </button>
            </div>
            {errors.length === 0 && !errLoading ? (
              <p className="text-sm text-muted-foreground">Sin errores registrados.</p>
            ) : (
              <div className="space-y-2">
                {errors.map((e) => <PosErrorCard key={e.id} e={e} />)}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Tab: Farmacia / Caja ── */}
      {tab === "farmacia" && (
        <div className="space-y-6">
          {/* Errores POS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Bug className="h-4 w-4 text-destructive" />
                Errores POS
              </h2>
              <button onClick={loadErrors} disabled={errLoading}
                className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">
                <RefreshCw className={`h-3 w-3 ${errLoading ? "animate-spin" : ""}`} />
                Actualizar
              </button>
            </div>
            {errors.length === 0 && !errLoading ? (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                Sin errores POS registrados — el sistema funciona correctamente.
              </div>
            ) : (
              <div className="space-y-2">
                {errors.map((e) => <PosErrorCard key={e.id} e={e} />)}
              </div>
            )}
          </div>

          {/* Operaciones farmacia/caja */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                Operaciones Farmacia / Caja
              </h2>
              <div className="flex items-center gap-2">
                <select value={farmFilter} onChange={(e) => setFarmFilter(e.target.value)}
                  className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs">
                  <option value="todos">Todos</option>
                  <option value="turnos">Turnos caja</option>
                  <option value="cortes">Cortes</option>
                  <option value="pharmacy_cash_shifts">Turnos farmacia</option>
                  <option value="fondos_movimientos">Movimientos de fondo</option>
                  <option value="pharmacy_sales">Ventas farmacia</option>
                </select>
                <button onClick={loadFarmLogs} disabled={farmLoading}
                  className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted">
                  <RefreshCw className={`h-3 w-3 ${farmLoading ? "animate-spin" : ""}`} />
                  Actualizar
                </button>
              </div>
            </div>
            {farmLoading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : farmFiltered.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                Sin eventos registrados para este filtro.
              </div>
            ) : (
              <div className="space-y-2">
                {farmFiltered.map((r) => <FarmaciaLogCard key={r.id} r={r} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
