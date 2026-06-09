import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Filter, Bug, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

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
  accion: "crear" | "actualizar" | "cancelar" | "eliminar";
  tabla: string;
  registro_id: string | null;
  datos_anteriores: any;
  datos_nuevos: any;
};

const ACCION_LABEL: Record<string, string> = {
  crear: "Creación",
  actualizar: "Actualización",
  cancelar: "Cancelación",
  eliminar: "Eliminación",
};

const ACCION_COLOR: Record<string, string> = {
  crear: "bg-success/10 text-success",
  actualizar: "bg-info/10 text-info",
  cancelar: "bg-warning/10 text-warning",
  eliminar: "bg-destructive/10 text-destructive",
};

const TABLA_LABEL: Record<string, { modulo: string; nombre: string }> = {
  appointments: { modulo: "Agenda", nombre: "Cita" },
  expedientes: { modulo: "Expedientes", nombre: "Expediente" },
  notas_consulta: { modulo: "Expedientes", nombre: "Nota de consulta" },
  medicamentos: { modulo: "Farmacia", nombre: "Medicamento" },
  lotes_medicamento: { modulo: "Farmacia", nombre: "Lote" },
  movimientos_inventario: { modulo: "Farmacia", nombre: "Movimiento de inventario" },
};

const MODULOS = ["Todos", "Agenda", "Expedientes", "Farmacia", "Facturación"] as const;

export default function Auditoria() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modulo, setModulo] = useState<(typeof MODULOS)[number]>("Todos");
  const [errors, setErrors] = useState<PosErrorRow[]>([]);
  const [errLoading, setErrLoading] = useState(false);

  const loadErrors = async () => {
    setErrLoading(true);
    const { data } = await (supabase as any)
      .from("pos_error_logs")
      .select("id, created_at, funcion, error_msg, error_detail, payload")
      .order("created_at", { ascending: false })
      .limit(20);
    setErrors((data ?? []) as PosErrorRow[]);
    setErrLoading(false);
  };

  const copyError = (e: PosErrorRow) => {
    const txt = JSON.stringify({
      fecha: e.created_at,
      funcion: e.funcion,
      error: e.error_msg,
      sqlstate: e.error_detail,
      payload: e.payload,
    }, null, 2);
    navigator.clipboard.writeText(txt);
    toast.success("Log copiado al portapapeles");
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

  const filtradas = rows.filter((r) => {
    if (modulo === "Todos") return true;
    const meta = TABLA_LABEL[r.tabla];
    return meta?.modulo === modulo;
  });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
            Historial de accesos y cambios en agenda, expedientes, farmacia y facturación
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={modulo}
            onChange={(e) => setModulo(e.target.value as any)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            {MODULOS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
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
                      <td className="px-4 py-3 whitespace-nowrap">{fmt(r.created_at)}</td>
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
            Errores POS (últimos 20)
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
            {errors.map((e) => (
              <div key={e.id} className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("es-MX")} · {e.funcion}</p>
                    <p className="text-sm font-medium text-destructive mt-0.5">{e.error_msg}</p>
                    {e.error_detail && <p className="text-xs text-muted-foreground font-mono">SQLSTATE: {e.error_detail}</p>}
                  </div>
                  <button onClick={() => copyError(e)}
                    className="shrink-0 flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted">
                    <Copy className="h-3 w-3" /> Copiar
                  </button>
                </div>
                {e.payload && (
                  <pre className="mt-2 text-[10px] bg-muted rounded p-2 overflow-x-auto max-h-24">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
