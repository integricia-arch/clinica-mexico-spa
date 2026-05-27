import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { FileText, Printer, QrCode, Pill, ShieldCheck, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Item {
  id: string;
  prescription_id: string;
  generic_name: string;
  brand_name: string | null;
  concentration: string | null;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
  is_controlled: boolean;
}

interface Doctor {
  id: string;
  nombre: string;
  apellidos: string;
  cedula_profesional: string | null;
  especialidad: string | null;
}

interface Receta {
  id: string;
  prescription_number: string | null;
  issue_date: string | null;
  status: string;
  diagnosis: string | null;
  doctor_id: string;
  doctor?: Doctor;
  items: Item[];
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
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
      const { data: rxs } = await supabase
        .from("prescriptions")
        .select("id, prescription_number, issue_date, status, diagnosis, doctor_id")
        .neq("status", "draft")
        .order("issue_date", { ascending: false, nullsFirst: false });

      const list = (rxs ?? []) as Receta[];
      if (list.length === 0) { setRecetas([]); setLoading(false); return; }

      const ids = list.map((r) => r.id);
      const doctorIds = Array.from(new Set(list.map((r) => r.doctor_id)));
      const [{ data: items }, { data: docs }] = await Promise.all([
        supabase.from("prescription_items").select("*").in("prescription_id", ids),
        supabase.from("doctors").select("id, nombre, apellidos, cedula_profesional, especialidad").in("id", doctorIds),
      ]);

      const itemsByRx = new Map<string, Item[]>();
      (items ?? []).forEach((it: any) => {
        const arr = itemsByRx.get(it.prescription_id) ?? [];
        arr.push(it);
        itemsByRx.set(it.prescription_id, arr);
      });
      const docMap = new Map<string, Doctor>();
      (docs ?? []).forEach((d: any) => docMap.set(d.id, d));

      setRecetas(list.map((r) => ({
        ...r,
        items: itemsByRx.get(r.id) ?? [],
        doctor: docMap.get(r.doctor_id),
      })));
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
                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                      <Calendar className="h-3 w-3" />
                      {r.issue_date ? format(new Date(r.issue_date), "dd/MM/yyyy HH:mm", { locale: es }) : "Sin fecha"}
                      {r.doctor && (
                        <span className="ml-2">· Dr(a). {r.doctor.nombre} {r.doctor.apellidos}{r.doctor.especialidad ? ` — ${r.doctor.especialidad}` : ""}</span>
                      )}
                    </p>
                    {r.diagnosis && <p className="mt-1 text-xs text-foreground">Dx: {r.diagnosis}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">{r.items.length} medicamento(s)</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4 space-y-3 bg-muted/20">
                    {r.items.map((it) => (
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
