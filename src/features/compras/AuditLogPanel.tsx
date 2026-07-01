import { useEffect, useState } from "react";
import { useAuditLog, type AuditEntry, type AuditFilters } from "@/hooks/useAuditLog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const OP_COLOR: Record<string, string> = {
  INSERT: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

const TABLA_LABELS: Record<string, string> = {
  proveedores:       "Proveedores",
  ordenes_compra:    "Órdenes de Compra",
  facturas_proveedor:"Facturas Proveedor",
};

function EntryRow({ entry }: { entry: AuditEntry }) {
  const [exp, setExp] = useState(false);
  const hasDiff = entry.campo != null;

  return (
    <div className="border-b last:border-0">
      <button
        className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => hasDiff && setExp((e) => !e)}
      >
        <span className="text-xs text-muted-foreground font-mono w-32 shrink-0">
          {format(new Date(entry.created_at), "dd/MM/yy HH:mm:ss", { locale: es })}
        </span>
        <Badge className={`text-xs ${OP_COLOR[entry.operacion] ?? ""}`}>{entry.operacion}</Badge>
        <span className="text-xs font-medium text-muted-foreground w-32 shrink-0">
          {TABLA_LABELS[entry.tabla] ?? entry.tabla}
        </span>
        {entry.campo && (
          <span className="text-xs font-mono text-blue-700">{entry.campo}</span>
        )}
        <span className="flex-1 text-xs text-muted-foreground truncate">
          {entry.usuario_email ?? (entry.usuario_id ? entry.usuario_id.slice(0, 8) + "…" : "sistema")}
        </span>
        {hasDiff && (exp ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />)}
      </button>

      {exp && hasDiff && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-2 bg-muted/20 text-xs">
          <div className="space-y-0.5">
            <p className="text-muted-foreground font-medium uppercase text-[10px]">Antes</p>
            <p className="font-mono bg-red-50 text-red-800 rounded px-2 py-1 break-all">
              {entry.valor_antes ?? "(vacío)"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground font-medium uppercase text-[10px]">Después</p>
            <p className="font-mono bg-green-50 text-green-800 rounded px-2 py-1 break-all">
              {entry.valor_despues ?? "(vacío)"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditLogPanel() {
  const { fetchLog, loading, error } = useAuditLog();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filters, setFilters] = useState<AuditFilters>({ limit: 200 });
  const [tablaFilter, setTablaFilter] = useState("todas");
  const [opFilter, setOpFilter] = useState("todas");

  const cargar = async () => {
    const f: AuditFilters = { limit: 200 };
    if (tablaFilter !== "todas") f.tabla = tablaFilter;
    if (opFilter !== "todas")   f.operacion = opFilter;
    const rows = await fetchLog(f);
    setEntries(rows);
  };

  useEffect(() => { cargar(); }, [tablaFilter, opFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-semibold">Auditoría de Accesos y Cambios</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={tablaFilter} onValueChange={setTablaFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tabla" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las tablas</SelectItem>
              <SelectItem value="proveedores">Proveedores</SelectItem>
              <SelectItem value="ordenes_compra">Órdenes de Compra</SelectItem>
              <SelectItem value="facturas_proveedor">Facturas Proveedor</SelectItem>
            </SelectContent>
          </Select>
          <Select value={opFilter} onValueChange={setOpFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Operación" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="INSERT">INSERT</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={cargar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/30 grid grid-cols-[128px_70px_128px_100px_1fr] gap-3 text-xs font-medium text-muted-foreground">
          <span>Fecha/Hora</span>
          <span>Op.</span>
          <span>Tabla</span>
          <span>Campo</span>
          <span>Usuario</span>
        </div>
        <div>
          {entries.length === 0 && !loading && (
            <p className="text-center py-8 text-muted-foreground text-sm">Sin registros de auditoría</p>
          )}
          {entries.map((e) => <EntryRow key={e.id} entry={e} />)}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-right">
        {entries.length} registro{entries.length !== 1 ? "s" : ""} (máx. 200)
      </p>
    </div>
  );
}
