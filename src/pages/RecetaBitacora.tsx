import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShieldCheck, Printer, FileCheck2, Eye, QrCode, Ban, Pill } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getPrescriptionAudit, type PrescriptionAuditEntry } from "@/features/recetas/services/prescriptionAuditService";

const EVENT_META: Record<string, { label: string; icon: any; cls: string }> = {
  printed: { label: "Impresión", icon: Printer, cls: "text-primary bg-primary/10" },
  reprinted: { label: "Reimpresión", icon: Printer, cls: "text-warning bg-warning/10" },
  verified_scan: { label: "Verificación por QR", icon: QrCode, cls: "text-success bg-success/10" },
  viewed_by_patient: { label: "Vista por paciente", icon: Eye, cls: "text-muted-foreground bg-muted" },
  issued: { label: "Emitida", icon: FileCheck2, cls: "text-success bg-success/10" },
  cancelled: { label: "Cancelada", icon: Ban, cls: "text-destructive bg-destructive/10" },
  dispensed: { label: "Surtida", icon: Pill, cls: "text-success bg-success/10" },
};

export default function RecetaBitacora() {
  const { id } = useParams<{ id: string }>();
  const [entries, setEntries] = useState<PrescriptionAuditEntry[]>([]);
  const [folio, setFolio] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [list, { data: rx }] = await Promise.all([
        getPrescriptionAudit(id),
        supabase.from("prescriptions").select("prescription_number").eq("id", id).maybeSingle(),
      ]);
      setEntries(list);
      setFolio(rx?.prescription_number ?? null);
      setLoading(false);
    })();
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/expedientes" className="inline-flex items-center gap-1 text-sm text-primary mb-2">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          <h1 className="text-display text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Bitácora de receta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Folio: <span className="font-mono font-semibold text-foreground">{folio ?? "—"}</span> · {entries.length} evento(s) registrados
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
        <ShieldCheck className="inline h-4 w-4 mr-1 text-primary" />
        Bitácora apéndice-solo: los eventos no se pueden modificar ni eliminar. Cubre emisión, impresiones, reimpresiones, verificaciones por QR y cancelaciones.
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Sin eventos registrados todavía.</div>
      ) : (
        <ol className="relative border-l-2 border-border ml-3 space-y-4">
          {entries.map((e) => {
            const meta = (e.event && EVENT_META[e.event]) || { label: e.accion, icon: FileCheck2, cls: "text-muted-foreground bg-muted" };
            const Icon = meta.icon;
            return (
              <li key={e.id} className="ml-4">
                <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${meta.cls}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                    </p>
                  </div>
                  {e.user_id && (
                    <p className="text-xs text-muted-foreground mt-1">Usuario: <span className="font-mono">{e.user_id.slice(0, 8)}…</span></p>
                  )}
                  {e.payload && Object.keys(e.payload).filter((k) => k !== "event" && k !== "at").length > 0 && (
                    <pre className="mt-2 text-[10px] bg-muted/40 rounded p-2 overflow-x-auto">
                      {JSON.stringify(Object.fromEntries(Object.entries(e.payload).filter(([k]) => k !== "event" && k !== "at")), null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
