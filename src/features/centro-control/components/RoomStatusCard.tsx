import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DoorOpen, DoorClosed } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export interface RoomStatus {
  room: { id: string; nombre: string; piso: string | null };
  estado: "disponible" | "ocupado";
  pacienteActual?: string | null;
  doctorActual?: string | null;
  proximaHoraLibre?: Date | null;
  proximaCita?: { paciente: string; hora: Date } | null;
}

export default function RoomStatusCard({ status }: { status: RoomStatus }) {
  const ocupado = status.estado === "ocupado";
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${ocupado ? "bg-info/10 text-info" : "bg-success/10 text-success"}`}>
            {ocupado ? <DoorClosed className="h-4 w-4" /> : <DoorOpen className="h-4 w-4" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{status.room.nombre}</p>
            {status.room.piso && <p className="text-[11px] text-muted-foreground">Piso {status.room.piso}</p>}
          </div>
        </div>
        <Badge variant="outline" className={ocupado ? "bg-info/10 text-info" : "bg-success/10 text-success"}>
          {ocupado ? "Ocupado" : "Disponible"}
        </Badge>
      </div>
      <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
        {ocupado ? (
          <>
            {status.pacienteActual && <p>Paciente: <span className="text-foreground font-medium">{status.pacienteActual}</span></p>}
            {status.doctorActual && <p>Médico: <span className="text-foreground">{status.doctorActual}</span></p>}
            {status.proximaHoraLibre && (
              <p>Libre desde: <span className="text-foreground">{format(status.proximaHoraLibre, "HH:mm", { locale: es })}</span></p>
            )}
          </>
        ) : status.proximaCita ? (
          <p>Próxima cita: <span className="text-foreground">{status.proximaCita.paciente}</span> · {format(status.proximaCita.hora, "HH:mm", { locale: es })}</p>
        ) : (
          <p>Sin citas programadas hoy</p>
        )}
      </div>
    </Card>
  );
}
