import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { FileText, Printer, QrCode, Pill, ShieldCheck, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Receta {
  id: string;
  prescription_number: string | null;
  issue_date: string | null;
  status: string;
  diagnosis: string | null;
  qr_code_value: string | null;
  doctors?: { nombre: string; apellidos: string; cedula_profesional: string | null; especialidad: string | null };
  prescription_items?: Array<{
    id: string;
    generic_name: string;
    brand_name: string | null;
    concentration: string | null;
    dose: string;
    route: string;
    frequency: string;
    duration: string;
    instructions: string;
    is_controlled: boolean;
  }>;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-muted text-muted-foreground" },
  issued: { label: "Emitida", cls: "bg-primary/10 text-primary" },
  partially_dispensed: { label: "Surtida parcial", cls: "bg-warning/10 text-warning" },
  dispensed: { label: "Surtida", cls: "bg-success/10 text-success" },
  cancelled: { label: "Cancelada", cls: "bg-destructive/10 text-destructive" },
};

export default function MisRecetas() {
  const { user } = useAuth();
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("prescriptions")
        .select(`
          id, prescription_number, issue_date, status, diagnosis, qr_code_value,
          doctors:doctor_id (nombre, apellidos, cedula_profesional, especialidad),
          prescription_items (id, generic_name, brand_name, concentration, dose, route, frequency, duration, instructions, is_controlled)
        `)
        .neq("status", "draft")
        .order("issue_date", { ascending: false, nullsFirst: false });
      setRecetas((data ?? []) as unknown as Receta[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Pill className="h-6 w-6 text-primary" /> Mis recetas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {recetas.length === 0 ? "Aún no tienes recetas emitidas" : `${recetas.length} receta(s) en tu historial`}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <ShieldCheck className="inline h-4 w-4 mr-1 text-primary" />
        Cada receta tiene un folio único y un código QR de verificación interna. Muéstralo a la farmacia para validar la prescripción.
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : recetas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>No tienes recetas en tu historial todavía.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recetas.map((r) => {
            const s = STATUS_LABELS[r.status] ?? STATUS_LABELS.issued;
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="rounded-lg border border-border bg-card overflow-hidden">
                <button
                  className="w-full p-4 text-left flex items-start justify-between gap-3 hover:bg-muted/30 transition"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{r.prescription_number ?? "Sin folio"}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {r.issue_date ? format(new Date(r.issue_date), "dd/MM/yyyy HH:mm", { locale: es }) : "Sin fecha"}
                      {r.doctors && (
                        <span className="ml-2">· Dr(a). {r.doctors.nombre} {r.doctors.apellidos}{r.doctors.especialidad ? ` — ${r.doctors.especialidad}` : ""}</span>
                      )}
                    </p>
                    {r.diagnosis && <p className="mt-1 text-xs text-foreground">Dx: {r.diagnosis}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">{r.prescription_items?.length ?? 0} medicamento(s)</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4 space-y-3 bg-muted/20">
                    {(r.prescription_items ?? []).map((it) => (
                      <div key={it.id} className="rounded border border-border bg-card p-3 text-sm">
                        <p className="font-semibold text-foreground">
                          {it.generic_name}
                          {it.brand_name && <span className="ml-1 text-muted-foreground">({it.brand_name})</span>}
                          {it.concentration && <span className="ml-1 text-muted-foreground">— {it.concentration}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {it.dose} · {it.route} · cada {it.frequency} · por {it.duration}
                        </p>
                        <p className="text-xs mt-1">{it.instructions}</p>
                        {it.is_controlled && (
                          <p className="mt-1 text-xs text-destructive font-medium">⚠ Medicamento controlado</p>
                        )}
                      </div>
                    ))}

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button asChild size="sm">
                        <Link to={`/receta/${r.id}`} target="_blank">
                          <Printer className="mr-1.5 h-4 w-4" /> Ver e imprimir
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/verificar-receta/${r.id}`} target="_blank">
                          <QrCode className="mr-1.5 h-4 w-4" /> Verificar autenticidad
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
