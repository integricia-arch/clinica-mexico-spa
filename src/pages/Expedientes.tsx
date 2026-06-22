import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { restSelect, restInsert } from "@/lib/restClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, FileText, ChevronDown, ChevronUp, Pencil, Stethoscope, FlaskConical, ExternalLink, Users, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import NotaConsultaModal from "@/components/NotaConsultaModal";
import PrescriptionEditorModal from "@/features/recetas/components/PrescriptionEditorModal";
import { FileCheck2 } from "lucide-react";
import { listStudiesByPatient, getStudyFileUrl, isStoragePath, type PatientStudy } from "@/features/panel-doctor/services/studiesService";
import StudyResultDrawer from "@/features/panel-doctor/components/StudyResultDrawer";
import { useActiveClinic } from "@/hooks/useActiveClinic";

interface PersonaMini { id: string; nombre: string; apellidos: string; }
interface DoctorMini extends PersonaMini { especialidad?: string; }
interface PatientMini extends PersonaMini { tipo_sangre?: string | null; alergias?: string | null; }
interface NotaConsulta {
  id: string;
  fecha_consulta: string;
  subjetivo?: string | null;
  objetivo?: string | null;
  analisis?: string | null;
  plan?: string | null;
  diagnostico_principal?: string | null;
  doctors?: { nombre: string; apellidos: string } | null;
}
interface Expediente {
  id: string;
  patient_id: string;
  doctor_id: string;
  tipo: string;
  updated_at: string;
  patients?: PatientMini | null;
  doctors?: DoctorMini | null;
}

const TIPO_LABELS: Record<string, string> = {
  primera_vez: "Primera vez", seguimiento: "Seguimiento",
  urgencia: "Urgencia", cirugia: "Cirugía", cronico: "Crónico",
};

export default function Expedientes() {
  const { hasRole, user } = useAuth();
  const { toast } = useToast();
  const canWrite = hasRole("admin") || hasRole("doctor");
  const { activeClinicId } = useActiveClinic();

  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notas, setNotas] = useState<Record<string, NotaConsulta[]>>({});
  const [notaModal, setNotaModal] = useState(false);
  const [notaSelected, setNotaSelected] = useState<NotaConsulta | null>(null);
  const [currentExpId, setCurrentExpId] = useState<string>("");
  const [currentDoctorId, setCurrentDoctorId] = useState<string>("");
  const [rxModal, setRxModal] = useState(false);
  const [rxContext, setRxContext] = useState<{ patientId: string; doctorId: string; expedienteId: string; consultationNoteId?: string; diagnosis?: string } | null>(null);
  const [newExpModal, setNewExpModal] = useState(false);
  const [patients, setPatients] = useState<PersonaMini[]>([]);
  const [doctors, setDoctors] = useState<DoctorMini[]>([]);
  const [newExpForm, setNewExpForm] = useState({ patient_id: "", doctor_id: "", tipo: "primera_vez" });
  const [saving, setSaving] = useState(false);
  const [estudios, setEstudios] = useState<Record<string, PatientStudy[]>>({});
  const [studyResultOpen, setStudyResultOpen] = useState(false);
  const [studySelected, setStudySelected] = useState<PatientStudy | null>(null);
  const [currentExpPatientId, setCurrentExpPatientId] = useState<string>("");
  const [myDoctorId, setMyDoctorId] = useState<string | null>(null);
  const [sharedPermissions, setSharedPermissions] = useState<Record<string, "view" | "edit">>({});
  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Expediente | null>(null);
  const [editForm, setEditForm] = useState({ doctor_id: "", tipo: "primera_vez" });
  const [keepPrevAccess, setKeepPrevAccess] = useState(false);

  useEffect(() => {
    loadExpedientes();
    supabase.from("doctors").select("id, nombre, apellidos").eq("activo", true).order("apellidos")
      .then(({ data }) => setDoctors(data ?? []));
  }, [myDoctorId]); // re-run when doctor profile resolves

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("doctors")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setMyDoctorId(data?.id ?? null));
  }, [user?.id]);

  async function loadExpedientes() {
    setLoading(true);
    try {
      const isAdmin = hasRole("admin");
      const isReceptionist = hasRole("receptionist");

      let filterQuery = "select=*,patients(nombre,apellidos,tipo_sangre,alergias),doctors(nombre,apellidos,especialidad)&activo=eq.true&order=updated_at.desc";

      if (!isAdmin && !isReceptionist) {
        // Doctor-only: show own expedientes + shared ones
        if (!myDoctorId) {
          // Doctor role but no linked doctor profile — show nothing
          setExpedientes([]);
          setLoading(false);
          return;
        }
        // Fetch shared expediente IDs first
        const { data: shared } = await supabase
          .from("expediente_permissions" as never)
          .select("expediente_id")
          .eq("doctor_id", myDoctorId);
        const sharedIds = (shared ?? []).map((r: { expediente_id: string }) => r.expediente_id);
        const ownFilter = `doctor_id.eq.${myDoctorId}`;
        const sharedFilter = sharedIds.length > 0 ? `,id.in.(${sharedIds.join(",")})` : "";
        filterQuery += `&or=(${ownFilter}${sharedFilter})`;
      }

      const data = await restSelect("expedientes", filterQuery);
      const expList = (data ?? []) as Expediente[];
      setExpedientes(expList);
      // Load shared permissions for the current doctor
      await loadSharedPermissions(expList.map((e) => e.id));
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los expedientes" });
    }
    setLoading(false);
  }

  async function loadNotas(expId: string) {
    // No cache guard: always reload to reflect changes from other sessions
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

  async function loadEstudios(expId: string, patientId: string) {
    if (!activeClinicId) return;
    try {
      const data = await listStudiesByPatient(patientId, activeClinicId);
      setEstudios((e) => ({ ...e, [expId]: data }));
    } catch (e) {
      console.error("[loadEstudios] Failed to load studies:", e);
      setEstudios((e2) => ({ ...e2, [expId]: [] }));
    }
  }

  async function loadSharedPermissions(expIds: string[]) {
    if (!myDoctorId || expIds.length === 0) { setSharedPermissions({}); return; }
    const { data } = await supabase
      .from("expediente_permissions" as never)
      .select("expediente_id, permission")
      .eq("doctor_id", myDoctorId)
      .in("expediente_id", expIds);
    const map: Record<string, "view" | "edit"> = {};
    (data ?? []).forEach((r: { expediente_id: string; permission: string }) => {
      map[r.expediente_id] = r.permission as "view" | "edit";
    });
    setSharedPermissions(map);
  }

  function canEditExp(exp: Expediente): boolean {
    if (hasRole("admin")) return true;
    if (myDoctorId && myDoctorId === exp.doctor_id) return true;
    return sharedPermissions[exp.id] === "edit";
  }

  function canManagePerms(exp: Expediente): boolean {
    return hasRole("admin") || (!!myDoctorId && myDoctorId === exp.doctor_id);
  }

  function canDeleteExp(exp: Expediente): boolean {
    return hasRole("admin") || (!!myDoctorId && myDoctorId === exp.doctor_id);
  }

  function canReassign(exp: Expediente): boolean {
    return hasRole("admin") || (!!myDoctorId && myDoctorId === exp.doctor_id);
  }

  function openEditModal(exp: Expediente) {
    setEditTarget(exp);
    setEditForm({ doctor_id: exp.doctor_id, tipo: exp.tipo });
    setKeepPrevAccess(false);
    setEditModal(true);
  }

  async function handleSaveEdit() {
    if (!editTarget || !activeClinicId) return;
    setSaving(true);
    try {
      const prevDoctorId = editTarget.doctor_id;
      const doctorChanged = editForm.doctor_id !== prevDoctorId;

      await supabase
        .from("expedientes")
        .update({ doctor_id: editForm.doctor_id, tipo: editForm.tipo })
        .eq("id", editTarget.id);

      // If doctor reassigned and "keep access" checked, grant edit to previous owner
      const granterId = myDoctorId;
      if (doctorChanged && keepPrevAccess && granterId) {
        await supabase
          .from("expediente_permissions" as never)
          .upsert({
            expediente_id: editTarget.id,
            doctor_id: prevDoctorId,
            permission: "edit",
            granted_by: granterId,
            clinic_id: activeClinicId,
          }, { onConflict: "expediente_id,doctor_id" });
      }

      const updatedDoctor = doctors.find((d) => d.id === editForm.doctor_id) ?? null;
      setExpedientes((prev) =>
        prev.map((e) =>
          e.id === editTarget.id
            ? { ...e, doctor_id: editForm.doctor_id, tipo: editForm.tipo, doctors: updatedDoctor }
            : e
        )
      );
      setEditModal(false);
      toast({ title: "Expediente actualizado" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el expediente" });
    }
    setSaving(false);
  }

  function toggleExpand(expId: string, patientId: string) {
    if (expanded === expId) { setExpanded(null); return; }
    setExpanded(expId);
    loadNotas(expId);
    loadEstudios(expId, patientId);
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
    } catch (e: unknown) {
      const msg = e instanceof Error && e.message?.includes("23505") ? "Este paciente ya tiene un expediente" : (e instanceof Error ? e.message : "Error inesperado");
      toast({ variant: "destructive", title: "Error", description: msg });
    }
    setSaving(false);
  }

  function openNota(expId: string, doctorId: string, nota?: NotaConsulta) {
    setCurrentExpId(expId);
    setCurrentDoctorId(doctorId);
    setNotaSelected(nota ?? null);
    setNotaModal(true);
  }

  function handleNotaSaved(n: NotaConsulta) {
    const doc = doctors.find((d) => d.id === currentDoctorId);
    const enriched = { ...n, doctors: doc ? { nombre: doc.nombre, apellidos: doc.apellidos } : { nombre: "", apellidos: "" } };
    setNotas((prev) => {
      const list = prev[currentExpId] ?? [];
      const idx = list.findIndex((x) => x.id === enriched.id);
      if (idx >= 0) { const next = [...list]; next[idx] = enriched; return { ...prev, [currentExpId]: next }; }
      return { ...prev, [currentExpId]: [enriched, ...list] };
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
                onClick={() => toggleExpand(exp.id, exp.patient_id)}>
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
                {(() => {
                  const pending = (estudios[exp.id] ?? []).filter(
                    (s) => s.status === "solicitado" || s.status === "recibido"
                  ).length;
                  return pending > 0 ? (
                    <span className="flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
                      <FlaskConical className="h-3 w-3" />
                      {pending}
                    </span>
                  ) : null;
                })()}
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
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Generar receta"
                                    onClick={() => {
                                      setRxContext({
                                        patientId: exp.patient_id,
                                        doctorId: exp.doctor_id,
                                        expedienteId: exp.id,
                                        consultationNoteId: n.id,
                                        diagnosis: n.diagnostico_principal ?? "",
                                      });
                                      setRxModal(true);
                                    }}>
                                    <FileCheck2 className="h-3.5 w-3.5 text-primary" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7"
                                    onClick={() => openNota(exp.id, exp.doctor_id, n)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </>
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

                  {/* Estudios / Laboratorio */}
                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <FlaskConical className="h-4 w-4 text-muted-foreground" />
                        Estudios / Laboratorio
                      </p>
                    </div>
                    {!estudios[exp.id] ? (
                      <p className="text-xs text-muted-foreground">Cargando...</p>
                    ) : estudios[exp.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin estudios solicitados</p>
                    ) : (
                      <div className="space-y-2">
                        {estudios[exp.id].map((study) => (
                          <StudyRow
                            key={study.id}
                            study={study}
                            canRegister={hasRole("admin") || hasRole("receptionist")}
                            onRegister={() => {
                              setStudySelected(study);
                              setCurrentExpPatientId(exp.patient_id);
                              setStudyResultOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
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

      <Dialog open={editModal} onOpenChange={(v) => !v && setEditModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar expediente</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {editTarget && canEditExp(editTarget) && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tipo</label>
                <Select value={editForm.tipo} onValueChange={(v) => setEditForm((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editTarget && canReassign(editTarget) && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Médico responsable</label>
                <Select value={editForm.doctor_id} onValueChange={(v) => setEditForm((f) => ({ ...f, doctor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar médico" /></SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>Dr(a). {d.nombre} {d.apellidos}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editTarget && editForm.doctor_id !== editTarget.doctor_id && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepPrevAccess}
                  onChange={(e) => setKeepPrevAccess(e.target.checked)}
                  className="rounded"
                />
                Mantener acceso de edición al médico anterior
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
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

      {rxContext && (
        <PrescriptionEditorModal
          open={rxModal}
          onClose={() => setRxModal(false)}
          patientId={rxContext.patientId}
          doctorId={rxContext.doctorId}
          expedienteId={rxContext.expedienteId}
          consultationNoteId={rxContext.consultationNoteId}
          diagnosis={rxContext.diagnosis}
        />
      )}

      <StudyResultDrawer
        open={studyResultOpen}
        onClose={() => setStudyResultOpen(false)}
        study={studySelected}
        clinicId={activeClinicId ?? ""}
        onSaved={() => {
          if (expanded && currentExpPatientId) {
            loadEstudios(expanded, currentExpPatientId);
          }
        }}
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

const STUDY_STATUS_COLORS: Record<string, string> = {
  solicitado: "bg-warning/10 text-warning",
  recibido: "bg-blue-500/10 text-blue-600",
  revisado: "bg-success/10 text-success",
  reutilizado: "bg-muted text-muted-foreground",
  descartado: "bg-muted text-muted-foreground",
};

const STUDY_STATUS_LABELS: Record<string, string> = {
  solicitado: "Pendiente",
  recibido: "Resultado recibido",
  revisado: "Revisado",
  reutilizado: "Reutilizado",
  descartado: "Descartado",
};

const STUDY_TIPO_LABELS: Record<string, string> = {
  lab: "Lab",
  imagen: "Imagen",
  otro: "Otro",
};

function StudyRow({
  study,
  canRegister,
  onRegister,
}: {
  study: PatientStudy;
  canRegister: boolean;
  onRegister: () => void;
}) {
  const handleOpenFile = async () => {
    if (!study.archivo_url) return;
    try {
      const url = await getStudyFileUrl(study.archivo_url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      /* silently ignore — UI shows no error for read-only view */
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-card-foreground truncate">{study.nombre}</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
            {STUDY_TIPO_LABELS[study.tipo] ?? study.tipo}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STUDY_STATUS_COLORS[study.status] ?? "bg-muted text-muted-foreground"}`}
          >
            {STUDY_STATUS_LABELS[study.status] ?? study.status}
          </span>
        </div>
        {study.motivo && (
          <p className="text-xs text-muted-foreground truncate">{study.motivo}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          Solicitado: {format(new Date(study.solicitado_at), "dd/MM/yyyy HH:mm", { locale: es })}
          {study.prioridad !== "rutina" && (
            <span className="ml-2 font-semibold text-destructive uppercase">{study.prioridad}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {study.archivo_url && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={isStoragePath(study.archivo_url) ? "Ver archivo (nube)" : "Ver archivo"}
            onClick={handleOpenFile}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
        {canRegister && study.status === "solicitado" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={onRegister}
          >
            Registrar resultado
          </Button>
        )}
      </div>
    </div>
  );
}
