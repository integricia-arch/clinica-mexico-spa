import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PendingAppt {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo_consulta: string | null;
  notas: string | null;
  origen: string;
  patients: { nombre: string; apellidos: string } | null;
  servicios: { nombre: string } | null;
  rooms: { nombre: string } | null;
}

interface Props { doctorId: string | null }

export function DoctorConfirmationPanel({ doctorId }: Props) {
  const [items, setItems] = useState<PendingAppt[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingAppt | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    if (!doctorId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id, fecha_inicio, fecha_fin, motivo_consulta, notas, origen,
        patients:patient_id ( nombre, apellidos ),
        servicios:servicio_id ( nombre ),
        rooms:room_id ( nombre )
      `)
      .eq("doctor_id", doctorId)
      .eq("doctor_confirmation_status", "pending")
      .gte("fecha_inicio", new Date().toISOString())
      .order("fecha_inicio", { ascending: true })
      .limit(20);
    if (error) toast.error("No se pudieron cargar citas pendientes");
    setItems((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [doctorId]);

  useEffect(() => {
    if (!doctorId) return;
    const ch = supabase
      .channel(`doc-pending-${doctorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [doctorId]);

  const decide = async (apptId: string, decision: "confirmed" | "declined", motivo?: string) => {
    setProcessing(apptId);
    const { error } = await supabase.functions.invoke("notify-doctor-confirmation", {
      body: { appointment_id: apptId, decision, reason: motivo },
    });
    setProcessing(null);
    if (error) { toast.error("No se pudo guardar: " + error.message); return false; }
    toast.success(decision === "confirmed" ? "Cita confirmada" : "Cita rechazada — recepción notificada");
    setItems((prev) => prev.filter((a) => a.id !== apptId));
    return true;
  };

  if (!doctorId) return null;
  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <>
      <Card className="border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold">Citas por confirmar ({items.length})</h2>
          </div>
          <ul className="space-y-2">
            {items.map((a) => {
              const fecha = new Date(a.fecha_inicio).toLocaleString("es-MX", {
                weekday: "short", day: "numeric", month: "short",
                hour: "2-digit", minute: "2-digit",
              });
              const pn = a.patients ? `${a.patients.nombre} ${a.patients.apellidos}` : "Sin paciente";
              return (
                <li key={a.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-2.5">
                  <div className="text-xs min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{pn}</span>
                      <Badge variant="outline" className="text-[10px]">{a.origen}</Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {fecha} · {a.servicios?.nombre ?? "Consulta"} · {a.rooms?.nombre ?? "—"}
                    </p>
                    {(a.motivo_consulta || a.notas) && (
                      <p className="text-foreground truncate" title={a.notas ?? ""}>
                        {a.motivo_consulta ?? a.notas}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col gap-1.5">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => decide(a.id, "confirmed")}
                      disabled={processing === a.id}
                    >
                      {processing === a.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                      Confirmar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setRejecting(a); setReason(""); }}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Rechazar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rechazar cita</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Indica el motivo. Recepción lo verá para reasignar. El paciente recibirá un mensaje neutral.
            </p>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Quirófano programado, horario no disponible..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3 || processing === rejecting?.id}
              onClick={async () => {
                if (!rejecting) return;
                const ok = await decide(rejecting.id, "declined", reason.trim());
                if (ok) setRejecting(null);
              }}
            >
              {processing === rejecting?.id && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Rechazar cita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
