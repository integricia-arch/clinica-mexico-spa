import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  createJourneyFromAppointment,
  openJourneyStepByKey,
} from "@/features/camino-paciente/services/journeyEngine";
import ArrivalForm from "@/features/camino-paciente/operativo/StepForms/ArrivalForm";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointmentId: string | null;
  patientName?: string;
  onCompleted?: () => void;
}

export default function QuickArrivalModal({
  open, onOpenChange, appointmentId, patientName, onCompleted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [stepId, setStepId] = useState<string | null>(null);
  const [stepStatus, setStepStatus] = useState<string>("open");
  const [existingData, setExistingData] = useState<Record<string, any>>({});
  const [journeyInstanceId, setJourneyInstanceId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !appointmentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const r = await createJourneyFromAppointment(appointmentId);
      if (!r.ok || !r.data) {
        toast.error(r.error ?? "No se pudo iniciar el camino");
        setLoading(false);
        onOpenChange(false);
        return;
      }
      const jid = r.data.journey_instance_id;
      if (cancelled) return;
      setJourneyInstanceId(jid);

      // Ensure arrival step is open
      await openJourneyStepByKey(jid, "arrival");

      const { data: step } = await supabase
        .from("journey_instance_steps")
        .select("id,status")
        .eq("journey_instance_id", jid)
        .eq("step_key", "arrival")
        .maybeSingle();

      if (cancelled || !step) { setLoading(false); return; }
      setStepId(step.id);
      setStepStatus(step.status);

      const { data: sd } = await supabase
        .from("journey_instance_step_data")
        .select("data_json")
        .eq("journey_instance_step_id", step.id)
        .maybeSingle();
      setExistingData((sd?.data_json as Record<string, any>) ?? {});
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, appointmentId, onOpenChange]);

  const handleSaved = async () => {
    if (!stepId) return;
    const { data: step } = await supabase
      .from("journey_instance_steps")
      .select("status")
      .eq("id", stepId)
      .maybeSingle();
    if (step?.status === "completed") {
      toast.success("Llegada registrada");
      onCompleted?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar llegada</DialogTitle>
          <DialogDescription>
            {patientName ?? "Paciente"} — Recepción
          </DialogDescription>
        </DialogHeader>
        {loading || !stepId ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <ArrivalForm
            stepId={stepId}
            stepStatus={stepStatus}
            existingData={existingData as never}
            onSaved={handleSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
