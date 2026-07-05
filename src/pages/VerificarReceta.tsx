import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldAlert, ShieldX, Calendar, User2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";

interface Verification {
  found: boolean;
  number: string | null;
  status: string | null;
  issue_date: string | null;
  doctor_name: string | null;
  cedula: string | null;
  especialidad: string | null;
  patient_initials: string | null;
  items_count: number;
}

export default function VerificarReceta() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: rx } = await (supabase as any)
        .from("prescriptions")
        .select("prescription_number, status, issue_date, doctor_id, patient_id")
        .eq("id", id)
        .maybeSingle();

      if (!rx) {
        setData({ found: false, number: null, status: null, issue_date: null, doctor_name: null, cedula: null, especialidad: null, patient_initials: null, items_count: 0 });
        setLoading(false);
        return;
      }

      const [{ data: doctor }, { data: patient }, { count }] = await Promise.all([
        (supabase as any).from("doctors").select("nombre, apellidos, cedula_profesional, especialidad").eq("id", rx.doctor_id).maybeSingle(),
        (supabase as any).from("patients").select("nombre, apellidos").eq("id", rx.patient_id).maybeSingle(),
        (supabase as any).from("prescription_items").select("id", { count: "exact", head: true }).eq("prescription_id", id),
      ]);

      setData({
        found: true,
        number: rx.prescription_number,
        status: rx.status,
        issue_date: rx.issue_date,
        doctor_name: doctor ? `Dr(a). ${doctor.nombre} ${doctor.apellidos}` : null,
        cedula: doctor?.cedula_profesional ?? null,
        especialidad: doctor?.especialidad ?? null,
        patient_initials: patient ? `${(patient.nombre ?? "?")[0]}.${(patient.apellidos ?? "?")[0]}.` : null,
        items_count: count ?? 0,
      });
      setLoading(false);
      // Registrar evento de verificación (mejor esfuerzo, ignora errores de permisos)
      import("@/features/recetas/services/prescriptionAuditService").then(({ logPrescriptionEvent }) =>
        logPrescriptionEvent(id, "verified_scan"),
      );
    })();
  }, [id]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg space-y-5">
        <div className="flex justify-center">
          {loading ? (
            <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
          ) : !data?.found ? (
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
          ) : data.status === "cancelled" ? (
            <div className="h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-warning" />
            </div>
          ) : (
            <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-success" />
            </div>
          )}
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-display text-xl font-bold text-foreground">
            {loading ? "Verificando..." :
              !data?.found ? "Receta no encontrada" :
              data.status === "cancelled" ? "Receta cancelada" :
              data.status === "issued" || data.status === "dispensed" || data.status === "partially_dispensed"
                ? "Receta válida" : "Receta en borrador"}
          </h1>
          {data?.found && (
            <p className="text-sm text-muted-foreground">Folio: <span className="font-mono font-semibold text-foreground">{data.number ?? "—"}</span></p>
          )}
        </div>

        {data?.found && (
          <div className="space-y-3 border-t border-border pt-4 text-sm">
            {data.issue_date && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de emisión</p>
                  <p className="font-medium text-foreground">{format(new Date(data.issue_date), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                </div>
              </div>
            )}
            {data.doctor_name && (
              <div className="flex items-start gap-2">
                <User2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Médico</p>
                  <p className="font-medium text-foreground">{data.doctor_name}</p>
                  {data.especialidad && <p className="text-xs text-muted-foreground">{data.especialidad}</p>}
                  {data.cedula && <p className="text-xs text-muted-foreground">Céd. Prof.: {data.cedula}</p>}
                </div>
              </div>
            )}
            {data.patient_initials && (
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Paciente (anónimo)</p>
                  <p className="font-medium text-foreground">{data.patient_initials}</p>
                </div>
              </div>
            )}
            <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
              {data.items_count} medicamento(s) prescritos. Por confidencialidad, el contenido clínico solo es visible para el paciente y el equipo médico.
            </div>
          </div>
        )}

        <div className="pt-2 text-center">
          <Button asChild variant="outline" size="sm">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
