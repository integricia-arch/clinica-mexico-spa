import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createFollowup } from "@/features/camino-paciente/services/followupService";
import { advancePatientJourneyFromClinicalEvent } from "@/features/camino-paciente/services/clinicalEvents";
import { friendlyError } from "@/lib/errors";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  journeyInstanceId: string;
  onCreated?: () => void;
}

export default function FollowupDrawer({ open, onClose, patientId, journeyInstanceId, onCreated }: Props) {
  const { toast } = useToast();
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [channel, setChannel] = useState<"llamada" | "whatsapp" | "correo" | "presencial">("whatsapp");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const r = await createFollowup({
        journey_instance_id: journeyInstanceId,
        patient_id: patientId,
        followup_date: date,
        channel,
        notes: notes || undefined,
      });
      if (!r.ok) throw new Error(r.error);
      await advancePatientJourneyFromClinicalEvent("followup_created", {
        journey_instance_id: journeyInstanceId,
        data: { followup_date: date, channel, notes },
      });
      toast({ title: "Seguimiento programado" });
      onCreated?.();
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: friendlyError(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Programar seguimiento</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 py-4">
          <div>
            <Label className="text-xs">Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Canal</Label>
            <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="llamada">Llamada</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="correo">Correo</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Programar"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
