import { useEffect, useState } from "react";
import { restInsert, restUpdate } from "@/lib/restClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  expedienteId: string;
  doctorId: string;
  nota?: any | null;
  onSaved: (n: any) => void;
}

const EMPTY = {
  subjetivo: "", objetivo: "", analisis: "", plan: "",
  diagnostico_principal: "", fecha_consulta: new Date().toISOString().slice(0, 16),
};

export default function NotaConsultaModal({ open, onClose, expedienteId, doctorId, nota, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const isEdit = !!nota;

  useEffect(() => {
    if (nota) {
      setForm({
        subjetivo: nota.subjetivo ?? "",
        objetivo: nota.objetivo ?? "",
        analisis: nota.analisis ?? "",
        plan: nota.plan ?? "",
        diagnostico_principal: nota.diagnostico_principal ?? "",
        fecha_consulta: nota.fecha_consulta?.slice(0, 16) ?? new Date().toISOString().slice(0, 16),
      });
    } else {
      setForm({ ...EMPTY, fecha_consulta: new Date().toISOString().slice(0, 16) });
    }
  }, [nota, open]);

  const set = (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.subjetivo.trim() && !form.objetivo.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Agrega al menos motivo u objetivo" });
      return;
    }
    setLoading(true);
    const payload = {
      expediente_id: expedienteId,
      doctor_id: doctorId,
      fecha_consulta: form.fecha_consulta,
      subjetivo: form.subjetivo || null,
      objetivo: form.objetivo || null,
      analisis: form.analisis || null,
      plan: form.plan || null,
      diagnostico_principal: form.diagnostico_principal || null,
    };

    try {
      let saved: any;
      if (isEdit) {
        saved = await restUpdate("notas_consulta", nota.id, payload);
      } else {
        saved = await restInsert("notas_consulta", payload);
      }
      toast({ title: isEdit ? "Nota actualizada" : "Nota guardada" });
      onSaved({ ...saved, doctors: { nombre: "", apellidos: "" } });
      onClose();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar nota de consulta" : "Nueva nota de consulta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Fecha y hora de consulta</Label>
            <Input type="datetime-local" value={form.fecha_consulta} onChange={set("fecha_consulta")} />
          </div>
          <div className="space-y-1.5">
            <Label>Diagnóstico principal</Label>
            <Input value={form.diagnostico_principal} onChange={set("diagnostico_principal")}
              placeholder="Ej: Hipertensión arterial, Z00.0..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-primary font-semibold">S — Subjetivo (motivo de consulta)</Label>
            <Textarea value={form.subjetivo} onChange={set("subjetivo")}
              placeholder="Lo que refiere el paciente..." rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-blue-600 font-semibold">O — Objetivo (exploración física)</Label>
            <Textarea value={form.objetivo} onChange={set("objetivo")}
              placeholder="Signos vitales, hallazgos físicos..." rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-orange-600 font-semibold">A — Análisis (diagnóstico)</Label>
            <Textarea value={form.analisis} onChange={set("analisis")}
              placeholder="Interpretación clínica..." rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-green-600 font-semibold">P — Plan (tratamiento)</Label>
            <Textarea value={form.plan} onChange={set("plan")}
              placeholder="Medicamentos, indicaciones, seguimiento..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar nota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
