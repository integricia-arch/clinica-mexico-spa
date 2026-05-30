import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Channel = "phone" | "whatsapp" | "email" | "internal";
type Result =
  | "answered"
  | "no_answer"
  | "busy"
  | "could_attend"
  | "could_not_attend"
  | "callback_requested";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointmentId: string;
  doctorId: string;
  clinicId: string;
  onRegistered?: () => void;
}

const RESULTS: { value: Result; label: string }[] = [
  { value: "answered", label: "Contestó" },
  { value: "no_answer", label: "No contestó" },
  { value: "busy", label: "Ocupado" },
  { value: "could_attend", label: "Puede atender" },
  { value: "could_not_attend", label: "No puede atender" },
  { value: "callback_requested", label: "Pidió devolver llamada" },
];

export function DoctorCallDialog({ open, onOpenChange, appointmentId, doctorId, clinicId, onRegistered }: Props) {
  const [channel, setChannel] = useState<Channel>("phone");
  const [result, setResult] = useState<Result>("answered");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setChannel("phone"); setResult("answered"); setNotes(""); };

  const submit = async () => {
    if (result === "could_not_attend" && notes.trim().length === 0) {
      toast.error("Las notas son obligatorias cuando el doctor no puede atender.");
      return;
    }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;

    const { error: insErr } = await supabase
      .from("doctor_contact_attempts")
      .insert({
        clinic_id: clinicId,
        appointment_id: appointmentId,
        doctor_id: doctorId,
        contacted_by: userId,
        channel,
        status: result,
        notes: notes || null,
      });
    if (insErr) { setSaving(false); toast.error("No se pudo registrar la llamada: " + insErr.message); return; }

    await supabase.from("audit_logs").insert({
      tabla: "doctor_contact_attempts",
      registro_id: appointmentId,
      accion: "doctor_contact_attempt_created",
      datos_nuevos: { appointment_id: appointmentId, doctor_id: doctorId, channel, status: result, notes },
      clinic_id: clinicId,
    });

    // Efectos sobre la cita
    if (result === "could_attend") {
      const { error } = await supabase.functions.invoke("notify-doctor-confirmation", {
        body: { appointment_id: appointmentId, decision: "confirmed", reason: "Confirmado por llamada telefónica" },
      });
      if (error) toast.message("Llamada registrada, pero la notificación falló: " + error.message);
      await supabase.from("audit_logs").insert({
        tabla: "appointments", registro_id: appointmentId,
        accion: "doctor_confirmo_por_llamada",
        datos_nuevos: { channel, notes }, clinic_id: clinicId,
      });
      toast.success("Doctor confirmó por llamada. Paciente notificado.");
    } else if (result === "could_not_attend") {
      const { error } = await supabase.functions.invoke("notify-doctor-confirmation", {
        body: { appointment_id: appointmentId, decision: "declined", reason: notes },
      });
      if (error) toast.message("Llamada registrada, pero la notificación falló: " + error.message);
      await supabase.from("audit_logs").insert({
        tabla: "appointments", registro_id: appointmentId,
        accion: "doctor_rechazo_por_llamada",
        datos_nuevos: { channel, reason: notes }, clinic_id: clinicId,
      });
      toast.success("Cita marcada como rechazada. Reasigna desde Inbox.");
    } else if (result === "no_answer" || result === "busy" || result === "callback_requested") {
      await supabase.from("audit_logs").insert({
        tabla: "appointments", registro_id: appointmentId,
        accion: "doctor_no_contesto",
        datos_nuevos: { channel, status: result, notes }, clinic_id: clinicId,
      });
      toast.success("Llamada registrada. Cita sigue pendiente.");
    } else {
      toast.success("Llamada registrada.");
    }

    setSaving(false);
    reset();
    onRegistered?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar llamada al doctor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Canal</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Teléfono</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="internal">Interno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Resultado</Label>
            <Select value={result} onValueChange={(v) => setResult(v as Result)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESULTS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Notas {result === "could_not_attend" && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={result === "could_not_attend" ? "Motivo del rechazo (obligatorio)" : "Observaciones (opcional)"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Guardar llamada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
