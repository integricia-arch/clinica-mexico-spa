import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { restSelect, restInsert } from "@/lib/restClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, FileText, ChevronDown, ChevronUp, Pencil, Stethoscope } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import NotaConsultaModal from "@/components/NotaConsultaModal";

const TIPO_LABELS: Record<string, string> = {
  primera_vez: "Primera vez", seguimiento: "Seguimiento",
  urgencia: "Urgencia", cirugia: "Cirugía", cronico: "Crónico",
};

export default function Expedientes() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const canWrite = hasRole("admin") || hasRole("doctor");

  const [expedientes, setExpedientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notas, setNotas] = useState<Record<string, any[]>>({});
  const [notaModal, setNotaModal] = useState(false);
  const [notaSelected, setNotaSelected] = useState<any | null>(null);
  const [currentExpId, setCurrentExpId] = useState<string>("");
  const [currentDoctorId, setCurrentDoctorId] = useState<string>("");
  const [newExpModal, setNewExpModal] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [newExpForm, setNewExpForm] = useState({ patient_id: "", doctor_id: "", tipo: "primera_vez" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadExpedientes(); }, []);

  async function loadExpedientes() {
    setLoading(true);
    try {
      const data = await restSelect(
        "expedientes",
        "select=*,patients(nombre,apellidos,tipo_sangre,alergias),doctors(nombre,apellidos,especialidad)&activo=eq.true&order=updated_at.desc"
      );
      setExpedientes(data ?? []);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
    setLoading(false);
  }

  async function loadNotas(expId: string) {
    if (notas[expId]) return;
    try {
      const data = await restSelect(
        "notas_consulta",
        `select=*,doctors(nombre,apellidos)&expediente_id=eq.${expId}&order=fecha_consulta.desc`
      );
      setNotas((n) => ({ ...n, [expId]: data ?? [] }));
    } catch {
      setNotas((n) => ({ ...n, [expId]: [] }));
    }
  }

  function toggleExpand(expId: string) {
    if (expanded === expId) { setExpanded(null); return; }
    setExpanded(expId);
    loadNotas(expId);
  }

  async function openNewExpModal() {
    const [pd, dd] = await Promise.all([
      supabase.from("patients").select("id, nombre, apellidos").eq("activo", true).order("apellidos"),
      supabase.from("doctors").select("id, nombre, apellidos").eq("activo", true).order("apellidos"),
    ]);
    setPatients(pd.data ?? []);
    setDoctors(dd.data ?? []);
    setNewExpForm({ patient_id: "", doctor_id: "", tipo: "primera_vez" });
    setNewExpModal(true);
  }

  async function handleCreateExpediente() {
    if (!newExpForm.patient_id || !newExpForm.doctor_id) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona paciente y médico" });
      return;
    }
    setSaving(true);
    try {
      const exp = await restInsert("expedientes", {
        patient_id: newExpForm.patient_id,
        doctor_id: newExpForm.doctor_id,
        tipo: newExpForm.tipo,
      });
      // Enriquecer con datos relacionados
      const patient = patients.find((p) => p.id === newExpForm.patient_id);
      const doctor = doctors.find((d) => d.id === newExpForm.doctor_id);
      setExpedientes((e) => [{ ...exp, patients: patient, doctors: doctor }, ...e]);
      setNewExpModal(false);
      toast({ title: "Expediente creado" });
    } catch (e: any) {
      const msg = e.message?.includes("23505") ? "Este paciente ya tiene un expediente" : e.message;
      toast({ variant: "destructive", title: "Error", description: msg });
    }
    setSaving(false);
  }

  function openNota(expId: string, doctorId: string, nota?: any) {
    setCurrentExpId(expId);
    setCurrentDoctorId(doctorId);
    setNotaSelected(nota ?? null);
    setNotaModal(true);
  }

  function handleNotaSaved(n: any) {
    setNotas((prev) => {
      const list = prev[currentExpId] ?? [];
      const idx = list.findIndex((x) => x.id === n.id);
      if (idx >= 0) { const next = [...list]; next[idx] = n; return { ...prev, [currentExpId]: next }; }
      return { ...prev, [currentExpId]: [n, ...list] };
    });
    setExpedientes((e) => e.map((x) => x.id === currentExpId ? { ...x, updated_at: new Date().toISOString() } : x));
  }

  const filtered = expedientes.filter((e) => {
    const term = search.toLowerCase();
    return `${e.patients?.nombre} ${e.patients?.apellidos}`.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Expedientes clínicos</h1>
          <p className="mt-1 text-sm text-muted-foreground">{expedientes.length} expedientes activos</p>
        </div>
        {canWrite && (
          <Button onClick={openNewExpModal}>
            <Plus className="mr-2 h-4 w-4" />Nuevo expediente
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nombre del paciente..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p>No se encontraron expedientes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((exp) => (
            <div key={exp.id} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(exp.id)}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {exp.patients?.nombre?.[0]}{exp.patients?.apellidos?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-card-foreground truncate">
                    {exp.patients?.apellidos}, {exp.patients?.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dr(a). {exp.doctors?.nombre} {exp.doctors?.apellidos} · {exp.doctors?.especialidad}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {TIPO_LABELS[exp.tipo] ?? exp.tipo}
                  </span>
                  {exp.patients?.tipo_sangre && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      {exp.patients.tipo_sangre}
                    </span>
                  )}
                </div>
                <p className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(exp.updated_at), "dd/MM/yyyy", { locale: es })}
                </p>
                {expanded === exp.id
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>

              {expanded === exp.id && (
                <div className="border-t border-border px-5 py-4 space-y-4 bg-muted/20">
                  {exp.patients?.alergias && (
                    <div className="rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning font-medium">
                      ⚠ Alergias: {exp.patients.alergias}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Notas de consulta (SOAP)</p>
                    {canWrite && (
                      <Button size="sm" variant="outline" onClick={() => openNota(exp.id, exp.doctor_id)}>
                        <Stethoscope className="mr-1.5 h-3.5 w-3.5" />Nueva nota
                      </Button>
                    )}
                  </div>
                  {!notas[exp.id] ? (
                    <p className="text-xs text-muted-foreground">Cargando...</p>
                  ) : notas[exp.id].length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin notas registradas</p>
                  ) : (
                    <div className="space-y-3">
                      {notas[exp.id].map((n) => (
                        <div key={n.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-foreground">
                                {format(new Date(n.fecha_consulta), "dd/MM/yyyy HH:mm", { locale: es })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Dr(a). {n.doctors?.nombre} {n.doctors?.apellidos}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {n.diagnostico_principal && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  {n.diagnostico_principal}
                                </span>
                              )}
                              {canWrite && (
                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={() => openNota(exp.id, exp.doctor_id, n)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {n.subjetivo && <SoapField label="S" color="text-primary" text={n.subjetivo} />}
                            {n.objetivo && <SoapField label="O" color="text-blue-600" text={n.objetivo} />}
                            {n.analisis && <SoapField label="A" color="text-orange-600" text={n.analisis} />}
                            {n.plan && <SoapField label="P" color="text-green-600" text={n.plan} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={newExpModal} onOpenChange={(v) => !v && setNewExpModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuevo expediente</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Paciente *</label>
              <Select value={newExpForm.patient_id} onValueChange={(v) => setNewExpForm((f) => ({ ...f, patient_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar paciente" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.apellidos}, {p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Médico responsable *</label>
              <Select value={newExpForm.doctor_id} onValueChange={(v) => setNewExpForm((f) => ({ ...f, doctor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar médico" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => <SelectItem key={d.id} value={d.id}>Dr(a). {d.nombre} {d.apellidos}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={newExpForm.tipo} onValueChange={(v) => setNewExpForm((f) => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewExpModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateExpediente} disabled={saving}>
              {saving ? "Creando..." : "Crear expediente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NotaConsultaModal
        open={notaModal}
        onClose={() => setNotaModal(false)}
        expedienteId={currentExpId}
        doctorId={currentDoctorId}
        nota={notaSelected}
        onSaved={handleNotaSaved}
      />
    </div>
  );
}

function SoapField({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <div className="rounded bg-muted/50 p-2">
      <span className={`font-bold ${color}`}>{label}: </span>
      <span className="text-foreground">{text}</span>
    </div>
  );
}
