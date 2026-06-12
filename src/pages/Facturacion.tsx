import { useCallback, useEffect, useState } from "react";
import {
  Search, Plus, Download, FileText, MoreHorizontal,
  ExternalLink, Loader2, RefreshCw, Copy, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { toast } from "sonner";
import TimbrarCFDIDialog from "@/features/facturacion/TimbrarCFDIDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CfdiDoc {
  id: string;
  uuid_fiscal: string | null;
  serie: string | null;
  folio: string | null;
  tipo: string;
  fecha_emision: string;
  rfc_emisor: string;
  rfc_receptor: string;
  nombre_receptor: string;
  subtotal: number;
  total: number;
  metodo_pago: string | null;
  forma_pago: string | null;
  status: string;
  pac_id_externo: string | null;
}

const TIPO_LABEL: Record<string, string> = { I: "Ingreso", E: "Egreso", P: "Pago", N: "Nómina" };
const STATUS_COLOR: Record<string, string> = {
  vigente:   "bg-success/10 text-success",
  cancelado: "bg-destructive/10 text-destructive",
};

const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

function shortUUID(uuid: string | null) {
  if (!uuid) return "—";
  return uuid.substring(0, 8).toUpperCase() + "…";
}

export default function Facturacion() {
  const { activeClinicId } = useActiveClinic();
  const [docs, setDocs] = useState<CfdiDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeClinicId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cfdi_documentos" as any)
      .select("id,uuid_fiscal,serie,folio,tipo,fecha_emision,rfc_emisor,rfc_receptor,nombre_receptor,subtotal,total,metodo_pago,forma_pago,status,pac_id_externo")
      .eq("clinic_id", activeClinicId)
      .order("fecha_emision", { ascending: false })
      .limit(200);
    if (error) toast.error("Error al cargar CFDIs: " + error.message);
    setDocs((data ?? []) as CfdiDoc[]);
    setLoading(false);
  }, [activeClinicId]);

  useEffect(() => { load(); }, [load]);

  const filtrados = docs.filter((d) => {
    const q = busqueda.toLowerCase();
    return (
      d.nombre_receptor.toLowerCase().includes(q) ||
      d.rfc_receptor.toLowerCase().includes(q) ||
      (d.uuid_fiscal ?? "").toLowerCase().includes(q) ||
      (d.folio ?? "").toLowerCase().includes(q)
    );
  });

  const totalVigente  = docs.filter((d) => d.status === "vigente").reduce((s, d) => s + d.total, 0);
  const totalCancelado = docs.filter((d) => d.status === "cancelado").reduce((s, d) => s + d.total, 0);
  const countVigente  = docs.filter((d) => d.status === "vigente").length;

  const copyUUID = async (uuid: string | null, id: string) => {
    if (!uuid) return;
    await navigator.clipboard.writeText(uuid);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDownload = async (doc: CfdiDoc, format: "xml" | "pdf") => {
    if (!doc.pac_id_externo && format === "pdf") {
      toast.error("Sin ID del PAC — no se puede descargar el PDF");
      return;
    }
    // XML: si no hay pac_id pero hay xml en BD, el edge function lo sirve
    setDownloadingId(doc.id + format);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sin sesión");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cfdi-download?cfdi_id=${doc.id}&format=${format}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      const blob  = await res.blob();
      const link  = document.createElement("a");
      link.href   = URL.createObjectURL(blob);
      link.download = `CFDI_${doc.serie ?? "A"}_${doc.folio ?? ""}_${(doc.uuid_fiscal ?? doc.id).substring(0, 8)}.${format}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      toast.error("Error al descargar: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSuccess = (_cfdiId: string, uuid: string) => {
    toast.success(`CFDI registrado — UUID: ${uuid}`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Facturación CFDI</h1>
          <p className="mt-1 text-sm text-muted-foreground">Comprobantes fiscales digitales emitidos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            title="Recargar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Nueva factura CFDI
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-medium text-muted-foreground">CFDIs vigentes</p>
          <p className="mt-1 text-display text-xl font-bold text-foreground">{countVigente}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{fmt(totalVigente)} total</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-medium text-muted-foreground">Cancelados</p>
          <p className="mt-1 text-display text-xl font-bold text-destructive">
            {docs.filter((d) => d.status === "cancelado").length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{fmt(totalCancelado)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-medium text-muted-foreground">Total emitido (mes)</p>
          <p className="mt-1 text-display text-xl font-bold text-foreground">{fmt(totalVigente)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{docs.length} documentos</p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, RFC, UUID o folio…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Cargando CFDIs…</span>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {docs.length === 0
              ? "Sin CFDIs emitidos. Usa \"Nueva factura CFDI\" para timbrar el primero."
              : "Sin resultados para la búsqueda."}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 font-semibold text-muted-foreground">Folio / UUID</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Fecha</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Receptor</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Total</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-card-foreground">
                        {d.serie ?? "A"}-{d.folio ?? "—"}
                      </span>
                    </div>
                    <button
                      onClick={() => copyUUID(d.uuid_fiscal, d.id)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-0.5"
                      title={d.uuid_fiscal ?? "Sin UUID"}
                    >
                      {copiedId === d.id
                        ? <Check className="h-3 w-3 text-success" />
                        : <Copy className="h-3 w-3" />}
                      {shortUUID(d.uuid_fiscal)}
                    </button>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    {new Date(d.fecha_emision).toLocaleString("es-MX", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="font-medium text-card-foreground text-xs">{d.nombre_receptor}</div>
                    <div className="text-muted-foreground text-[11px]">{d.rfc_receptor}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      {TIPO_LABEL[d.tipo] ?? d.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-card-foreground">
                    {fmt(d.total)}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_COLOR[d.status] ?? "bg-muted text-muted-foreground"}`}>
                      {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                          {downloadingId?.startsWith(d.id)
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <MoreHorizontal className="h-4 w-4" />}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleDownload(d, "xml")}
                          className="gap-2 cursor-pointer"
                        >
                          <Download className="h-4 w-4" /> Descargar XML
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDownload(d, "pdf")}
                          className="gap-2 cursor-pointer"
                          disabled={!d.pac_id_externo}
                        >
                          <FileText className="h-4 w-4" /> Descargar PDF
                        </DropdownMenuItem>
                        {d.uuid_fiscal && (
                          <DropdownMenuItem
                            onClick={() => copyUUID(d.uuid_fiscal, d.id)}
                            className="gap-2 cursor-pointer"
                          >
                            <Copy className="h-4 w-4" /> Copiar UUID fiscal
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          {filtrados.length} de {docs.length} documentos
        </div>
      </div>

      <TimbrarCFDIDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
