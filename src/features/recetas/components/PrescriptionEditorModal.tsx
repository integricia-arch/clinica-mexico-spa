import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, FileCheck2, Printer, AlertCircle } from "lucide-react";
import {
  createPrescriptionFromConsultation,
  addPrescriptionItem,
  removePrescriptionItem,
  issuePrescription,
  type RxItem,
} from "@/features/camino-paciente/services/prescriptionService";
import { friendlyError } from "@/lib/errors";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId: string;
  doctorId: string;
  expedienteId: string;
  consultationNoteId?: string;
  appointmentId?: string;
  journeyInstanceId?: string;
  diagnosis?: string;
  onIssued?: (prescriptionId: string, number: string) => void;
}

const EMPTY_ITEM: RxItem = {
  generic_name: "",
  brand_name: "",
  pharmaceutical_form: "",
  concentration: "",
  presentation: "",
  dose: "",
  route: "Oral",
  frequency: "",
  duration: "",
  quantity: undefined,
  instructions: "",
  is_controlled: false,
  controlled_group: "",
};

const ROUTES = ["Oral", "Sublingual", "Tópica", "Intramuscular", "Intravenosa", "Subcutánea", "Oftálmica", "Ótica", "Nasal", "Rectal", "Inhalada"];

export default function PrescriptionEditorModal({
  open,
  onClose,
  patientId,
  doctorId,
  expedienteId,
  consultationNoteId,
  appointmentId,
  journeyInstanceId,
  diagnosis,
  onIssued,
}: Props) {
  const { toast } = useToast();
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [diag, setDiag] = useState(diagnosis ?? "");
  const [draft, setDraft] = useState<RxItem>(EMPTY_ITEM);
  const [meds, setMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issuedNumber, setIssuedNumber] = useState<string | null>(null);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});

  async function fetchStockForIds(medIds: string[]) {
    if (medIds.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("lotes_medicamento")
      .select("medicamento_id, existencia")
      .in("medicamento_id", medIds)
      .gt("existencia", 0)
      .gte("fecha_caducidad", today);
    if (!data) return;
    const totals: Record<string, number> = {};
    for (const l of data) {
      totals[l.medicamento_id] = (totals[l.medicamento_id] ?? 0) + l.existencia;
    }
    setStockMap((prev) => ({ ...prev, ...totals }));
  }

  // Cargar receta existente (draft para esta nota) o preparar nueva
  useEffect(() => {
    if (!open) return;
    setIssuedNumber(null);
    setStockMap({});
    setDraft(EMPTY_ITEM);
    setDiag(diagnosis ?? "");
    (async () => {
      setLoading(true);
      try {
        // Buscar borrador existente ligado a la nota
        let rxId: string | null = null;
        if (consultationNoteId) {
          const { data } = await supabase
            .from("prescriptions")
            .select("id, diagnosis")
            .eq("consultation_note_id", consultationNoteId)
            .eq("status", "draft")
            .maybeSingle();
          if (data) {
            rxId = data.id;
            setDiag(data.diagnosis ?? diagnosis ?? "");
          }
        }
        setPrescriptionId(rxId);
        if (rxId) {
          const { data: its } = await supabase
            .from("prescription_items")
            .select("*")
            .eq("prescription_id", rxId)
            .order("created_at");
          setItems(its ?? []);
          const existingMedIds = (its ?? [])
            .map((i: any) => i.medication_id)
            .filter(Boolean) as string[];
          if (existingMedIds.length > 0) fetchStockForIds(existingMedIds);
        } else {
          setItems([]);
        }
        const { data: m } = await supabase
          .from("medicamentos")
          .select("id, nombre, descripcion, categoria, unidad")
          .eq("activo", true)
          .order("nombre");
        setMeds(m ?? []);
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: friendlyError(e) });
      } finally {
        setLoading(false);
      }
    })();
  }, [open, consultationNoteId, diagnosis, toast]);

  async function ensurePrescription(): Promise<string | null> {
    if (prescriptionId) {
      // Actualizar diagnóstico (incluyendo string vacío para limpiar)
      await supabase.from("prescriptions").update({ diagnosis: diag || null }).eq("id", prescriptionId);
      return prescriptionId;
    }
    const res = await createPrescriptionFromConsultation({
      patient_id: patientId,
      doctor_id: doctorId,
      expediente_id: expedienteId,
      consultation_note_id: consultationNoteId,
      appointment_id: appointmentId,
      journey_instance_id: journeyInstanceId,
      diagnosis: diag,
    });
    if (!res.ok || !res.data) {
      toast({ variant: "destructive", title: "Error", description: res.error ?? "No se pudo crear la receta" });
      return null;
    }
    setPrescriptionId(res.data.id);
    return res.data.id;
  }

  async function handleAddItem() {
    if (!draft.generic_name || !draft.dose || !draft.route || !draft.frequency || !draft.duration || !draft.instructions) {
      toast({ variant: "destructive", title: "Faltan campos", description: "Nombre genérico, dosis, vía, frecuencia, duración e indicaciones son obligatorios." });
      return;
    }
    setLoading(true);
    const rxId = await ensurePrescription();
    if (!rxId) { setLoading(false); return; }
    const res = await addPrescriptionItem(rxId, draft);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Error", description: res.error });
    } else {
      const { data: its } = await supabase.from("prescription_items").select("*").eq("prescription_id", rxId).order("created_at");
      setItems(its ?? []);
      setDraft(EMPTY_ITEM);
      toast({ title: "Medicamento agregado" });
    }
    setLoading(false);
  }

  async function handleRemoveItem(id: string) {
    setLoading(true);
    const res = await removePrescriptionItem(id);
    if (!res.ok) toast({ variant: "destructive", title: "Error", description: res.error });
    else setItems((prev) => prev.filter((i) => i.id !== id));
    setLoading(false);
  }

  async function handleIssue() {
    if (!prescriptionId) {
      toast({ variant: "destructive", title: "Sin receta", description: "Agrega al menos un medicamento primero." });
      return;
    }
    setIssuing(true);
    await supabase.from("prescriptions").update({ diagnosis: diag || null }).eq("id", prescriptionId);
    const res = await issuePrescription(prescriptionId);
    setIssuing(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "No se pudo emitir", description: res.error });
      return;
    }
    setIssuedNumber(res.data!.number);
    toast({ title: "Receta emitida", description: `Folio: ${res.data!.number}` });
    onIssued?.(prescriptionId, res.data!.number);
  }

  function handlePrint() {
    if (!prescriptionId) return;
    window.open(`/receta/${prescriptionId}`, "_blank");
  }

  function pickMedicamento(id: string) {
    const m = meds.find((x) => x.id === id);
    if (!m) return;
    setDraft((d) => ({ ...d, medication_id: m.id, generic_name: m.nombre, presentation: m.descripcion ?? d.presentation }));
    fetchStockForIds([m.id]);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" />
            {issuedNumber ? `Receta emitida — ${issuedNumber}` : "Receta médica"}
          </DialogTitle>
        </DialogHeader>

        {issuedNumber ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
              <p className="font-semibold text-success">Folio: {issuedNumber}</p>
              <p className="mt-1 text-muted-foreground">La receta fue emitida y ligada al expediente. Ya no se puede modificar.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label>Diagnóstico</Label>
              <Input value={diag} onChange={(e) => setDiag(e.target.value)} placeholder="Ej: Faringitis aguda (J02.9)" />
            </div>

            {/* Lista de medicamentos */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Medicamentos en esta receta ({items.length})</p>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aún no hay medicamentos. Agrega uno abajo.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((it) => (
                    <div key={it.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">
                            {it.generic_name}
                            {it.brand_name && <span className="ml-1 text-muted-foreground">({it.brand_name})</span>}
                            {it.concentration && <span className="ml-1 text-muted-foreground">— {it.concentration}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {it.dose} · {it.route} · cada {it.frequency} · por {it.duration}
                            {it.quantity ? ` · Cantidad: ${it.quantity}` : ""}
                          </p>
                          <p className="text-xs mt-1">{it.instructions}</p>
                          {it.is_controlled && (
                            <p className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
                              <AlertCircle className="h-3 w-3" /> Controlado {it.controlled_group ? `(${it.controlled_group})` : ""}
                            </p>
                          )}
                          {it.medication_id && (
                            <span className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
                              (stockMap[it.medication_id] ?? 0) >= (it.quantity ?? 1)
                                ? "text-green-600"
                                : "text-destructive"
                            }`}>
                              {stockMap[it.medication_id] !== undefined ? (
                                (stockMap[it.medication_id] ?? 0) >= (it.quantity ?? 1)
                                  ? `🟢 ${stockMap[it.medication_id]} en stock`
                                  : `🔴 solo ${stockMap[it.medication_id] ?? 0} disponibles`
                              ) : null}
                            </span>
                          )}
                          {!it.medication_id && (
                            <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-destructive">
                              🔴 sin ligar a inventario
                            </span>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveItem(it.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form agregar */}
            <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
              <p className="text-sm font-semibold">Agregar medicamento</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Buscar en inventario (opcional)</Label>
                  <Select value={draft.medication_id ?? ""} onValueChange={pickMedicamento}>
                    <SelectTrigger><SelectValue placeholder="Selecciona del catálogo o escribe abajo" /></SelectTrigger>
                    <SelectContent>
                      {meds.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nombre}{m.categoria ? ` — ${m.categoria}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre genérico *</Label>
                  <Input value={draft.generic_name} onChange={(e) => setDraft({ ...draft, generic_name: e.target.value })} placeholder="Paracetamol" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre comercial</Label>
                  <Input value={draft.brand_name ?? ""} onChange={(e) => setDraft({ ...draft, brand_name: e.target.value })} placeholder="Tempra" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Concentración</Label>
                  <Input value={draft.concentration ?? ""} onChange={(e) => setDraft({ ...draft, concentration: e.target.value })} placeholder="500 mg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Forma farmacéutica</Label>
                  <Input value={draft.pharmaceutical_form ?? ""} onChange={(e) => setDraft({ ...draft, pharmaceutical_form: e.target.value })} placeholder="Tableta" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Presentación</Label>
                  <Input value={draft.presentation ?? ""} onChange={(e) => setDraft({ ...draft, presentation: e.target.value })} placeholder="Caja con 10 tabletas" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cantidad</Label>
                  <Input type="number" min={1} value={draft.quantity ?? ""} onChange={(e) => setDraft({ ...draft, quantity: e.target.value ? Number(e.target.value) : undefined })} placeholder="10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dosis *</Label>
                  <Input value={draft.dose} onChange={(e) => setDraft({ ...draft, dose: e.target.value })} placeholder="1 tableta" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Vía *</Label>
                  <Select value={draft.route} onValueChange={(v) => setDraft({ ...draft, route: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ROUTES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Frecuencia *</Label>
                  <Input value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value })} placeholder="8 horas" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Duración *</Label>
                  <Input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} placeholder="5 días" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Indicaciones *</Label>
                  <Textarea rows={2} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} placeholder="Tomar después de los alimentos..." />
                </div>
                <div className="space-y-1.5 sm:col-span-2 flex items-center gap-2">
                  <input
                    id="ctrl"
                    type="checkbox"
                    checked={!!draft.is_controlled}
                    onChange={(e) => setDraft({ ...draft, is_controlled: e.target.checked })}
                  />
                  <Label htmlFor="ctrl" className="text-xs cursor-pointer">Medicamento controlado</Label>
                  {draft.is_controlled && (
                    <Input
                      className="ml-2 h-8 max-w-[180px]"
                      placeholder="Grupo (I, II, III...)"
                      value={draft.controlled_group ?? ""}
                      onChange={(e) => setDraft({ ...draft, controlled_group: e.target.value })}
                    />
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleAddItem} disabled={loading}>
                  <Plus className="mr-1.5 h-4 w-4" />Agregar a la receta
                </Button>
              </div>
            </div>

            {items.some((i) => i.is_controlled) && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                <AlertCircle className="inline h-4 w-4 mr-1" />
                Esta receta contiene medicamentos controlados. La emisión aquí es para registro interno; el cumplimiento oficial (formatos COFEPRIS) debe gestionarse fuera del sistema.
              </div>
            )}
          </div>
        )}

        {!issuedNumber && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={issuing}>Cerrar</Button>
            <Button onClick={handleIssue} disabled={issuing || items.length === 0}>
              {issuing ? "Emitiendo..." : <><FileCheck2 className="mr-2 h-4 w-4" />Emitir receta</>}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
