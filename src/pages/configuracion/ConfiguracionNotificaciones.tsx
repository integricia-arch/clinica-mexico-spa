import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface Rule {
  id: string;
  role: string;
  event_type: string;
  channel: string;
  enabled: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador", manager: "Gerente", receptionist: "Recepción",
  doctor: "Médico", nurse: "Enfermería", cajero: "Cajero", patient: "Paciente",
};

const EVENT_LABELS: Record<string, string> = {
  cita_asignada_enfermera: "Asignación de cita a enfermera",
  cxp_vencimiento: "Vencimiento de cuenta por pagar",
  usuario_nuevo: "Nuevo usuario registrado",
};

// Canales disponibles hoy: Telegram y email (gratis, ya en uso).
// SMS/WhatsApp tiene costo recurrente con proveedor -- no se ofrece todavía,
// pero el esquema (channel es texto libre en BD) no bloquea agregarlo.
const CHANNELS = ["telegram", "email"];
const ROLES = Object.keys(ROLE_LABELS);
const EVENTS = Object.keys(EVENT_LABELS);

export default function ConfiguracionNotificaciones() {
  const navigate = useNavigate();
  const { activeClinicId } = useActiveClinic();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [newRole, setNewRole] = useState(ROLES[0]);
  const [newEvent, setNewEvent] = useState(EVENTS[0]);
  const [newChannel, setNewChannel] = useState(CHANNELS[0]);
  const [creating, setCreating] = useState(false);

  const fetchRules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notification_rules")
      .select("id, role, event_type, channel, enabled")
      .eq("clinic_id", activeClinicId)
      .order("role");
    setLoading(false);
    if (error) { toast.error("No se pudieron cargar las reglas"); return; }
    setRules((data ?? []) as Rule[]);
  };

  useEffect(() => { if (activeClinicId) fetchRules(); }, [activeClinicId]);

  const toggleEnabled = async (rule: Rule) => {
    setSavingId(rule.id);
    const { error } = await supabase
      .from("notification_rules")
      .update({ enabled: !rule.enabled })
      .eq("id", rule.id);
    setSavingId(null);
    if (error) { toast.error("No se pudo actualizar"); return; }
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
  };

  const handleCreate = async () => {
    setCreating(true);
    const { error } = await supabase.from("notification_rules").insert({
      clinic_id: activeClinicId, role: newRole, event_type: newEvent, channel: newChannel, enabled: true,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message?.includes("duplicate") ? "Esa regla ya existe" : "No se pudo crear la regla");
      return;
    }
    toast.success("Regla creada");
    setNewOpen(false);
    fetchRules();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/configuracion")} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-display text-xl font-bold text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" /> Notificaciones por rol
            </h1>
            <p className="text-sm text-muted-foreground">
              Qué rol recibe cada tipo de aviso y por qué canal (Telegram / email).
            </p>
          </div>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Nueva regla
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Rol</th>
                  <th className="text-left px-4 py-3 font-medium">Evento</th>
                  <th className="text-left px-4 py-3 font-medium">Canal</th>
                  <th className="text-right px-4 py-3 font-medium">Activa</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Sin reglas configuradas</td></tr>
                )}
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{ROLE_LABELS[r.role] ?? r.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">{EVENT_LABELS[r.event_type] ?? r.event_type}</td>
                    <td className="px-4 py-3 capitalize">{r.channel}</td>
                    <td className="px-4 py-3 text-right">
                      <Switch checked={r.enabled} disabled={savingId === r.id} onCheckedChange={() => toggleEnabled(r)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-muted/60 border border-border px-4 py-3 text-xs text-muted-foreground">
        Canales disponibles hoy: <strong>Telegram</strong> y <strong>email</strong> (sin costo). SMS/WhatsApp requeriría
        un proveedor externo con costo recurrente — no está activo todavía.
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva regla de notificación</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={newEvent} onValueChange={setNewEvent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENTS.map((e) => <SelectItem key={e} value={e}>{EVENT_LABELS[e]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={newChannel} onValueChange={setNewChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Creando…" : "Crear regla"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
