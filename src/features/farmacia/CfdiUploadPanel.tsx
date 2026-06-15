import { useCallback, useRef, useState } from "react";
import { useFpCfdi, type CfdiParseResult, type LineaMatch, type AlertaMatch } from "@/hooks/useFpCfdi";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";

const formatMXN = (c: number) =>
  (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const SEVERIDAD_COLOR: Record<string, string> = {
  CRITICA: "bg-red-100 border-red-400 text-red-800",
  ALTA: "bg-orange-100 border-orange-400 text-orange-800",
  MEDIA: "bg-yellow-100 border-yellow-400 text-yellow-800",
  BAJA: "bg-blue-50 border-blue-300 text-blue-700",
};

const SEVERIDAD_ICON: Record<string, React.ReactNode> = {
  CRITICA: <XCircle className="h-4 w-4 shrink-0" />,
  ALTA: <AlertTriangle className="h-4 w-4 shrink-0" />,
  MEDIA: <Info className="h-4 w-4 shrink-0" />,
  BAJA: <Info className="h-4 w-4 shrink-0" />,
};

function AlertaBadge({ alerta }: { alerta: AlertaMatch }) {
  return (
    <div
      className={`flex items-start gap-1.5 rounded border px-2 py-1.5 text-xs ${SEVERIDAD_COLOR[alerta.severidad] || ""}`}
    >
      {SEVERIDAD_ICON[alerta.severidad]}
      <span>{alerta.descripcion}</span>
    </div>
  );
}

function LineaRow({ linea }: { linea: LineaMatch }) {
  const [expanded, setExpanded] = useState(linea.tieneAlertaCritica);

  const rowClass = linea.tieneAlertaCritica
    ? "bg-red-50 border-red-200"
    : linea.alertas.length > 0
    ? "bg-orange-50 border-orange-200"
    : "border-border";

  return (
    <div className={`rounded border mb-1 ${rowClass}`}>
      <button
        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-black/5 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-xs text-muted-foreground w-5 font-mono">{linea.lineaNumero}</span>
        <span className="flex-1 text-sm font-medium truncate">{linea.descripcion}</span>
        <span className="text-xs text-muted-foreground">×{linea.cantidad}</span>
        <span className="text-xs font-mono">{formatMXN(linea.totalCentavos)}</span>
        {linea.tieneAlertaCritica && (
          <Badge className="bg-red-600 text-white text-xs">CRÍTICA</Badge>
        )}
        {!linea.tieneAlertaCritica && linea.alertas.length > 0 && (
          <Badge variant="outline" className="text-orange-700 border-orange-400 text-xs">
            {linea.alertas.length} alerta{linea.alertas.length > 1 ? "s" : ""}
          </Badge>
        )}
        {linea.alertas.length === 0 && (
          <CheckCircle className="h-4 w-4 text-green-500" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-inherit pt-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="text-muted-foreground">Código prov: </span>
              <span className="font-mono">{linea.noIdentificacion || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Match: </span>
              <span className={linea.matchScore >= 95 ? "text-green-700" : linea.matchScore >= 75 ? "text-yellow-700" : "text-red-600"}>
                {linea.matchMethod} ({linea.matchScore}%)
              </span>
            </div>
            {linea.ocCantidadPedida != null && (
              <div>
                <span className="text-muted-foreground">OC cantidad: </span>
                <span>{linea.ocCantidadPedida}</span>
              </div>
            )}
            {linea.recepcionCantidadRecibida != null && (
              <div>
                <span className="text-muted-foreground">Recibido: </span>
                <span>{linea.recepcionCantidadRecibida}</span>
              </div>
            )}
            {linea.ocPrecioUnitCentavos != null && (
              <div>
                <span className="text-muted-foreground">Precio OC: </span>
                <span>{formatMXN(linea.ocPrecioUnitCentavos)}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Precio CFDI: </span>
              <span>{formatMXN(linea.valorUnitarioCentavos)}</span>
            </div>
          </div>

          {linea.alertas.length > 0 && (
            <div className="space-y-1">
              {linea.alertas.map((a, i) => (
                <AlertaBadge key={i} alerta={a} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  facturaProveedorId: string;
  ordenCompraId?: string;
  recepcionId?: string;
  proveedorId?: string;
  onParsed?: (result: CfdiParseResult) => void;
}

export default function CfdiUploadPanel({
  facturaProveedorId,
  ordenCompraId,
  recepcionId,
  proveedorId,
  onParsed,
}: Props) {
  const { parsearXML, loading } = useFpCfdi();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<CfdiParseResult | null>(null);

  const procesarArchivo = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".xml") && file.type !== "text/xml") {
        toast({ title: "Solo se aceptan archivos .xml (CFDI)", variant: "destructive" });
        return;
      }
      try {
        const data = await parsearXML(file, {
          facturaProveedorId,
          ordenCompraId,
          recepcionId,
          proveedorId,
        });
        setResult(data);
        onParsed?.(data);
        toast({
          title: data.alertas_criticas > 0
            ? `CFDI con ${data.alertas_criticas} alerta(s) CRÍTICA(S)`
            : data.alertas_total > 0
            ? `CFDI con ${data.alertas_total} alerta(s) — revisar`
            : "CFDI procesado — sin discrepancias",
          variant: data.alertas_criticas > 0 ? "destructive" : "default",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({ title: msg, variant: "destructive" });
      }
    },
    [parsearXML, facturaProveedorId, ordenCompraId, recepcionId, proveedorId, onParsed, toast]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) procesarArchivo(file);
    },
    [procesarArchivo]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) procesarArchivo(file);
    },
    [procesarArchivo]
  );

  if (result) {
    const colorRec = result.alertas_criticas > 0
      ? "bg-red-50 border-red-300 text-red-800"
      : result.alertas_total > 0
      ? "bg-orange-50 border-orange-300 text-orange-800"
      : "bg-green-50 border-green-300 text-green-800";

    return (
      <div className="space-y-3">
        {/* Header resumen */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">CFDI {result.uuid}</p>
              <p className="text-xs text-muted-foreground">
                SAT: {result.estado_sat} · Total: {result.total.toLocaleString("es-MX", { style: "currency", currency: "MXN" })} · {result.lineas_count} concepto{result.lineas_count !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setResult(null)} disabled={loading}>
            Cargar otro
          </Button>
        </div>

        {/* Recomendación */}
        <div className={`rounded border px-3 py-2 text-sm font-medium ${colorRec}`}>
          {result.alertas_criticas > 0 ? <XCircle className="inline h-4 w-4 mr-1" /> : result.alertas_total > 0 ? <AlertTriangle className="inline h-4 w-4 mr-1" /> : <CheckCircle className="inline h-4 w-4 mr-1" />}
          {result.recomendacion}
        </div>

        {/* Errores aritméticos */}
        {result.errores_aritmeticos.length > 0 && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 space-y-1">
            <p className="font-medium">Errores aritméticos en el CFDI:</p>
            {result.errores_aritmeticos.map((e, i) => (
              <p key={i} className="font-mono">{e}</p>
            ))}
          </div>
        )}

        {/* Líneas */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Conceptos ({result.lineas_count})
          </p>
          {result.lineas.map((l) => (
            <LineaRow key={l.lineaNumero} linea={l} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Sube el XML del CFDI 4.0 del proveedor para validar y ejecutar 4-way match automático.
      </p>

      <div
        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer
          ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xml,text/xml"
          className="hidden"
          onChange={onFileChange}
        />
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Procesando CFDI…</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Arrastra el XML aquí o haz clic para seleccionar</p>
            <p className="text-xs text-muted-foreground">Solo archivos .xml · CFDI 4.0</p>
          </div>
        )}
      </div>
    </div>
  );
}
