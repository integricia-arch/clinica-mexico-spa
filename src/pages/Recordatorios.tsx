import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Phone, Send, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status = "pendiente" | "enviado" | "fallido" | "cancelado";
type Tipo = "T-24h" | "T-2h" | "manual";

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  enviado: { label: "Enviado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  fallido: { label: "Fallido", cls: "bg-destructive/15 text-destructive" },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};

const TIPO_META: Record<string, { label: string; cls: string }> = {
  "T-24h": { label: "T-24h", cls: "bg-primary/10 text-primary" },
  "T-2h": { label: "T-2h", cls: "bg-primary/15 text-primary" },
  manual: { label: "Manual", cls: "bg-muted text-foreground" },
};

const CANAL_META: Record<string, { label: string; Icon: any; cls: string }> = {
  whatsapp: { label: "WhatsApp", Icon: Phone, cls: "text-emerald-500" },
  sms: { label: "SMS", Icon: Phone, cls: "text-blue-500" },
  email: { label: "Correo", Icon: Mail, cls: "text-primary" },
  telegram: { label: "Telegram", Icon: Send, cls: "text-sky-500" },
};

interface Recordatorio {
  id: string;
  appointment_id: string;
  identidad_canal_id: string | null;
  programado_para: string;
  status: Status;
  tipo: Tipo | string;
  enviado_at: string | null;
  ultimo_error: string | null;
  mensaje: string | null;
  intentos: number;
  identidades_canal: {
    canal_id: string;
    display_name: string | null;
    patients: { nombre: string; apellidos: string } | null;
  } | null;
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
  const [items, setItems] = useState<Recordatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusF, setStatusF] = useState<string>("all");
  const [tipoF, setTipoF] = useState<string>("all");
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("recordatorios_cita")
      .select(
        "*, identidades_canal(canal_id, display_name, patients(nombre,apellidos)), appointments(fecha_inicio, patients(nombre,apellidos), servicios(nombre))"
      )
      .order("programado_para", { ascending: true })
      .limit(500);
    if (error) { toast.error("Error cargando recordatorios"); setLoading(false); return; }
    setItems((data ?? []) as Recordatorio[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (statusF !== "all") list = list.filter((r) => r.status === statusF);
    if (tipoF !== "all") list = list.filter((r) => r.tipo === tipoF);
    return [...list].sort((a, b) => {
      if (a.status === "pendiente" && b.status !== "pendiente") return -1;
      if (b.status === "pendiente" && a.status !== "pendiente") return 1;
      return new Date(a.programado_para).getTime() - new Date(b.programado_para).getTime();
    });
  }, [items, statusF, tipoF]);

  const reintentar = async (r: Recordatorio) => {
    setRetrying(r.id);
    const { error } = await supabase.functions.invoke("enviar-recordatorios", {
      body: { recordatorio_id: r.id },
    });
    setRetrying(null);
    if (error) { toast.error("No se pudo reintentar"); return; }
    toast.success("Reintento solicitado");
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
          <Select value={statusF} onValueChange={setStatusF}>
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
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <Select value={tipoF} onValueChange={setTipoF}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="T-24h">T-24h</SelectItem>
              <SelectItem value="T-2h">T-2h</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
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
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Programado para</th>
                <th className="text-left px-4 py-3">Intentos</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Sin recordatorios</td></tr>
              )}
              {filtered.map((r) => {
                const p = r.identidades_canal?.patients ?? r.appointments?.patients;
                const s = r.appointments?.servicios?.nombre ?? "—";
                const canalKey = r.identidades_canal?.canal_id ?? "";
                const cm = CANAL_META[canalKey] ?? { label: canalKey || "—", Icon: MessageCircle, cls: "text-muted-foreground" };
                const tm = TIPO_META[r.tipo] ?? { label: String(r.tipo), cls: "bg-muted text-foreground" };
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {p ? `${p.nombre} ${p.apellidos}` : (r.identidades_canal?.display_name ?? "—")}
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
                    <td className="px-4 py-3">
                      <Badge className={cn("border-transparent", tm.cls)}>{tm.label}</Badge>
                    </td>
                    <td className="px-4 py-3">{toMX(r.programado_para)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.intentos}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge className={cn("border-transparent w-fit", STATUS_META[r.status].cls)}>
                          {STATUS_META[r.status].label}
                        </Badge>
                        {r.status === "fallido" && r.ultimo_error && (
                          <span className="text-[10px] text-destructive truncate max-w-[200px]" title={r.ultimo_error}>
                            {r.ultimo_error}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(r.status === "fallido" || r.status === "pendiente") && (
                        <Button size="sm" variant="outline" disabled={retrying === r.id} onClick={() => reintentar(r)}>
                          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", retrying === r.id && "animate-spin")} />
                          {r.status === "fallido" ? "Reintentar" : "Enviar ahora"}
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
