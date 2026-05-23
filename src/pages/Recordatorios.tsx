import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Phone, Send, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Estado = "pendiente" | "enviado" | "fallido" | "cancelado";
type Canal = "whatsapp" | "sms" | "email" | "telegram";

const ESTADO_META: Record<Estado, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  enviado: { label: "Enviado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  fallido: { label: "Fallido", cls: "bg-destructive/15 text-destructive" },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};

const CANAL_META: Record<string, { label: string; Icon: any; cls: string }> = {
  whatsapp: { label: "WhatsApp", Icon: Phone, cls: "text-emerald-500" },
  sms: { label: "SMS", Icon: Phone, cls: "text-blue-500" },
  email: { label: "Correo", Icon: Mail, cls: "text-primary" },
  telegram: { label: "Telegram", Icon: Send, cls: "text-sky-500" },
};

interface Reminder {
  id: string;
  appointment_id: string;
  canal: Canal;
  estado: Estado;
  programado_para: string;
  enviado_en: string | null;
  intentos: number;
  mensaje: string | null;
  created_at: string;
  appointments: {
    fecha_inicio: string;
    patients: { nombre: string; apellidos: string } | null;
    servicios: { nombre: string } | null;
  } | null;
}

function toMX(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Recordatorios() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoF, setEstadoF] = useState<string>("all");
  const [canalF, setCanalF] = useState<string>("all");
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reminders")
      .select("*, appointments(fecha_inicio, patients(nombre,apellidos), servicios(nombre))")
      .order("programado_para", { ascending: true })
      .limit(500);
    if (error) { toast.error("Error cargando recordatorios"); setLoading(false); return; }
    setItems((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (estadoF !== "all") list = list.filter((r) => r.estado === estadoF);
    if (canalF !== "all") list = list.filter((r) => r.canal === canalF);
    // Pendientes primero, luego por programado_para
    return [...list].sort((a, b) => {
      if (a.estado === "pendiente" && b.estado !== "pendiente") return -1;
      if (b.estado === "pendiente" && a.estado !== "pendiente") return 1;
      return new Date(a.programado_para).getTime() - new Date(b.programado_para).getTime();
    });
  }, [items, estadoF, canalF]);

  const reintentar = async (r: Reminder) => {
    setRetrying(r.id);
    const { error } = await supabase
      .from("reminders")
      .update({ estado: "pendiente", intentos: (r.intentos ?? 0) + 1 })
      .eq("id", r.id);
    setRetrying(null);
    if (error) { toast.error("No se pudo reintentar"); return; }
    toast.success("Recordatorio marcado como pendiente");
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-2xl font-bold">Recordatorios</h1>
        <p className="text-sm text-muted-foreground">Recordatorios programados de citas</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={estadoF} onValueChange={setEstadoF}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="fallido">Fallido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Canal</label>
          <Select value={canalF} onValueChange={setCanalF}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="email">Correo</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={fetchData} className="w-full">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Actualizar
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3">Paciente</th>
                <th className="text-left px-4 py-3">Cita</th>
                <th className="text-left px-4 py-3">Canal</th>
                <th className="text-left px-4 py-3">Programado para</th>
                <th className="text-left px-4 py-3">Intentos</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sin recordatorios</td></tr>
              )}
              {filtered.map((r) => {
                const p = r.appointments?.patients;
                const s = r.appointments?.servicios?.nombre ?? "—";
                const cm = CANAL_META[r.canal] ?? CANAL_META.whatsapp;
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {p ? `${p.nombre} ${p.apellidos}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{s}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.appointments ? toMX(r.appointments.fecha_inicio) : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <cm.Icon className={cn("h-3.5 w-3.5", cm.cls)} />
                        {cm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">{toMX(r.programado_para)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.intentos}</td>
                    <td className="px-4 py-3">
                      <Badge className={cn("border-transparent", ESTADO_META[r.estado].cls)}>
                        {ESTADO_META[r.estado].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.estado === "fallido" && (
                        <Button size="sm" variant="outline" disabled={retrying === r.id} onClick={() => reintentar(r)}>
                          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", retrying === r.id && "animate-spin")} />
                          Reintentar
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
