import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Clock, User } from "lucide-react";

const horas = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"];

const consultorios = ["Consultorio 1 — Dr. Mendoza", "Consultorio 2 — Dra. Ramírez", "Consultorio 3 — Dra. Ortiz"];

interface Cita {
  hora: string;
  consultorio: number;
  paciente: string;
  tipo: string;
  estado: string;
  duracion: number; // slots
}

const citasDia: Cita[] = [
  { hora: "09:00", consultorio: 0, paciente: "María González H.", tipo: "Consulta general", estado: "Confirmada", duracion: 2 },
  { hora: "09:30", consultorio: 1, paciente: "José Luis Pérez V.", tipo: "Seguimiento", estado: "Confirmada por paciente", duracion: 2 },
  { hora: "10:00", consultorio: 0, paciente: "Guadalupe Torres R.", tipo: "Primera vez", estado: "Pendiente de formulario", duracion: 3 },
  { hora: "10:30", consultorio: 2, paciente: "Roberto Sánchez D.", tipo: "Estudios", estado: "Recordatorio enviado", duracion: 2 },
  { hora: "11:00", consultorio: 1, paciente: "Fernanda Castillo L.", tipo: "Consulta general", estado: "Solicitada", duracion: 2 },
  { hora: "11:30", consultorio: 0, paciente: "Miguel Á. Ruiz F.", tipo: "Seguimiento", estado: "Confirmada", duracion: 2 },
  { hora: "14:00", consultorio: 1, paciente: "Ana Sofía Morales V.", tipo: "Control", estado: "Confirmada", duracion: 2 },
  { hora: "15:00", consultorio: 2, paciente: "Carlos E. Jiménez R.", tipo: "Consulta general", estado: "Tentativa", duracion: 2 },
  { hora: "16:00", consultorio: 0, paciente: "Lucía Hernández M.", tipo: "Seguimiento", estado: "Confirmada por médico", duracion: 2 },
];

const estadoColor: Record<string, string> = {
  "Confirmada": "border-l-success bg-success/5",
  "Confirmada por paciente": "border-l-success bg-success/5",
  "Confirmada por médico": "border-l-success bg-success/5",
  "Pendiente de formulario": "border-l-warning bg-warning/5",
  "Recordatorio enviado": "border-l-info bg-info/5",
  "Solicitada": "border-l-muted-foreground bg-muted/50",
  "Tentativa": "border-l-muted-foreground bg-muted/30",
  "Cancelada": "border-l-destructive bg-destructive/5",
};

export default function Agenda() {
  const [vista, setVista] = useState<"dia" | "semana">("dia");

  const getCita = (hora: string, consultorio: number) =>
    citasDia.find((c) => c.hora === hora && c.consultorio === consultorio);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestión de citas y consultorios</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4" />
          Nueva cita
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-border bg-card p-2 hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground px-2">Lunes 30 de marzo, 2026</span>
          <button className="rounded-lg border border-border bg-card p-2 hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button className="ml-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
            Hoy
          </button>
        </div>
        <div className="flex rounded-lg border border-border bg-card overflow-hidden">
          {(["dia", "semana"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                vista === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {v === "dia" ? "Día" : "Semana"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <div className="min-w-[700px]">
          {/* Header */}
          <div className="grid grid-cols-[80px_1fr_1fr_1fr] border-b border-border bg-muted/50">
            <div className="px-3 py-3 text-xs font-semibold text-muted-foreground">Hora</div>
            {consultorios.map((c, i) => (
              <div key={i} className="px-3 py-3 text-xs font-semibold text-muted-foreground border-l border-border">
                {c}
              </div>
            ))}
          </div>

          {/* Rows */}
          {horas.map((hora) => {
            const esHoraCompleta = hora.endsWith(":00");
            return (
              <div
                key={hora}
                className={`grid grid-cols-[80px_1fr_1fr_1fr] ${esHoraCompleta ? "border-t border-border" : "border-t border-border/40"}`}
              >
                <div className={`px-3 py-2 text-xs ${esHoraCompleta ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {hora}
                </div>
                {consultorios.map((_, ci) => {
                  const cita = getCita(hora, ci);
                  return (
                    <div key={ci} className="border-l border-border px-1.5 py-1 min-h-[44px]">
                      {cita && (
                        <div className={`rounded-md border-l-[3px] p-2 cursor-pointer hover:shadow-card transition-shadow ${estadoColor[cita.estado] || "border-l-muted bg-muted/30"}`}>
                          <p className="text-xs font-semibold text-card-foreground truncate">{cita.paciente}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{cita.tipo} · {cita.estado}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Confirmada</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> Pendiente</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-info" /> Recordatorio</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" /> Solicitada / Tentativa</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Cancelada</span>
      </div>
    </div>
  );
}
