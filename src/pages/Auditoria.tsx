import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Filter } from "lucide-react";

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
    </div>
  );
}
