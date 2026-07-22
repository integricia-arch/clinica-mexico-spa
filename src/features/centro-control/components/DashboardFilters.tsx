import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, RefreshCw, Plus, UserCheck, AlertOctagon, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { KANBAN_COLUMNS } from "../lib/journeyHelpers";

export interface DashboardFiltersState {
  date: Date;
  doctorId: string;
  roomId: string;
  apptStatus: string;
  stageKey: string;
  risk: string;
  search: string;
}

interface Props {
  value: DashboardFiltersState;
  onChange: (next: Partial<DashboardFiltersState>) => void;
  onReload: () => void;
  onNewAppointment: () => void;
  onShowBlocked: () => void;
  doctors: { id: string; nombre: string; apellidos: string }[];
  rooms: { id: string; nombre: string }[];
}

const APPT_STATUSES = [
  ["all", "Todos los estados"],
  ["solicitada", "Solicitada"],
  ["confirmada", "Confirmada"],
  ["confirmada_paciente", "Conf. paciente"],
  ["confirmada_medico", "Conf. médico"],
  ["pendiente_formulario", "Pend. formulario"],
  ["cancelada", "Cancelada"],
];

const RISKS = [
  ["all", "Cualquier riesgo"],
  ["bajo", "Bajo"],
  ["medio", "Medio"],
  ["alto", "Alto"],
];

export default function DashboardFilters({ value, onChange, onReload, onNewAppointment, onShowBlocked, doctors, rooms }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left", !value.date && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(value.date, "dd 'de' MMMM yyyy", { locale: es })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value.date}
              onSelect={(d) => d && onChange({ date: d })}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
              locale={es}
            />
          </PopoverContent>
        </Popover>

        <Select value={value.doctorId} onValueChange={(v) => onChange({ doctorId: v })}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Médico" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los médicos</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>Dr(a). {d.nombre} {d.apellidos}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={value.roomId} onValueChange={(v) => onChange({ roomId: v })}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Consultorio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los consultorios</SelectItem>
            {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={value.apptStatus} onValueChange={(v) => onChange({ apptStatus: v })}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado cita" /></SelectTrigger>
          <SelectContent>
            {APPT_STATUSES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={value.stageKey} onValueChange={(v) => onChange({ stageKey: v })}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las etapas</SelectItem>
            {KANBAN_COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={value.risk} onValueChange={(v) => onChange({ risk: v })}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Riesgo" /></SelectTrigger>
          <SelectContent>
            {RISKS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="relative ml-auto min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente..."
            aria-label="Buscar paciente"
            className="pl-9"
            value={value.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onNewAppointment} size="sm"><Plus className="h-4 w-4" />Nueva cita</Button>
        <Button onClick={() => onChange({ stageKey: "arrival" })} variant="outline" size="sm">
          <UserCheck className="h-4 w-4" />Registrar llegada
        </Button>
        <Button onClick={onShowBlocked} variant="outline" size="sm">
          <AlertOctagon className="h-4 w-4" />Ver bloqueados
        </Button>
        <Button onClick={onReload} variant="ghost" size="sm" className="ml-auto">
          <RefreshCw className="h-4 w-4" />Actualizar
        </Button>
      </div>
    </div>
  );
}
