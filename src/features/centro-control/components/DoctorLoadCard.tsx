import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope } from "lucide-react";

export interface DoctorLoad {
  doctor: { id: string; nombre: string; apellidos: string; especialidad: string };
  citasHoy: number;
  enEspera: number;
  enConsulta: number;
  seguimiento: number;
  proximoPaciente?: { nombre: string; hora: string } | null;
  estado: "disponible" | "en_consulta" | "con_retraso" | "sin_citas" | "saturado";
}

const STATE_LABEL: Record<DoctorLoad["estado"], { label: string; cls: string }> = {
  disponible: { label: "Disponible", cls: "bg-success/10 text-success" },
  en_consulta: { label: "En consulta", cls: "bg-info/10 text-info" },
  con_retraso: { label: "Con retraso", cls: "bg-warning/10 text-warning" },
  sin_citas: { label: "Sin citas", cls: "bg-muted text-muted-foreground" },
  saturado: { label: "Saturado", cls: "bg-destructive/10 text-destructive" },
};

export default function DoctorLoadCard({ load }: { load: DoctorLoad }) {
  const st = STATE_LABEL[load.estado];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Stethoscope className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              Dr(a). {load.doctor.nombre} {load.doctor.apellidos}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{load.doctor.especialidad}</p>
          </div>
        </div>
        <Badge variant="outline" className={st.cls}>{st.label}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <Stat label="Citas" value={load.citasHoy} />
        <Stat label="Espera" value={load.enEspera} />
        <Stat label="Consulta" value={load.enConsulta} />
        <Stat label="Seguim." value={load.seguimiento} />
      </div>
      {load.proximoPaciente && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Próximo: <span className="text-foreground font-medium">{load.proximoPaciente.nombre}</span> · {load.proximoPaciente.hora}
        </p>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 px-1 py-1">
      <p className="text-sm font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
