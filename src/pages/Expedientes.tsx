import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedTable";
import { restSelect, restInsert } from "@/lib/restClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, FileText } from "lucide-react";
import NotaConsultaModal from "@/components/NotaConsultaModal";
import PrescriptionEditorModal from "@/features/recetas/components/PrescriptionEditorModal";
import { listStudiesByPatient, type PatientStudy } from "@/features/panel-doctor/services/studiesService";
import StudyResultDrawer from "@/features/panel-doctor/components/StudyResultDrawer";
import { useActiveClinic } from "@/hooks/useActiveClinic";

import type { PersonaMini, DoctorMini, Expediente, NotaConsulta, ExpPermRow } from "./expedientes/types";
import { ExpedienteCard } from "./expedientes/ExpedienteCard";
import { NewExpedienteDialog } from "./expedientes/NewExpedienteDialog";
import { EditExpedienteDialog } from "./expedientes/EditExpedienteDialog";
import { PermissionsDialog } from "./expedientes/PermissionsDialog";

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

  const [permModal, setPermModal] = useState(false);
  const [permTarget, setPermTarget] = useState<Expediente | null>(null);
  const [expPermissions, setExpPermissions] = useState<ExpPermRow[]>([]);
  const [newPermDoctorId, setNewPermDoctorId] = useState("");
  const [newPermLevel, setNewPermLevel] = useState<"view" | "edit">("view");
  const [permSaving, setPermSaving] = useState(false);

  useEffect(() => {
    loadExpedientes();
    (supabase as any).from("doctors").select("id, nombre, apellidos").eq("activo", true).order("apellidos")
      .then(({ data }) => setDoctors(data ?? []));
  }, [myDoctorId]); // re-run when doctor profile resolves

  useEffect(() => {
    if (!user?.id) return;
    (supabase as any)
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
        const { data: shared } = await untypedTable("expediente_permissions")
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
      console.error("[loadExpedientes]", e);
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
    const { data } = await untypedTable("expediente_permissions")
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

      await (supabase as any)
        .from("expedientes")
        .update({ doctor_id: editForm.doctor_id, tipo: editForm.tipo as "primera_vez" | "seguimiento" | "urgencia" | "cirugia" | "cronico" })
        .eq("id", editTarget.id);

      // If doctor reassigned and "keep access" checked, grant edit to previous owner
      const granterId = myDoctorId;
      if (doctorChanged && keepPrevAccess && granterId) {
        await untypedTable("expediente_permissions")
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

  async function loadExpPermissions(expId: string) {
    const { data } = await untypedTable("expediente_permissions")
      .select("id, expediente_id, doctor_id, permission, doctors:doctor_id(nombre, apellidos)")
      .eq("expediente_id", expId);
    setExpPermissions((data ?? []) as unknown as ExpPermRow[]);
  }

  async function handleAddPerm() {
    if (!permTarget || !newPermDoctorId || !activeClinicId || !myDoctorId) return;
    setPermSaving(true);
    try {
      await untypedTable("expediente_permissions")
        .insert({
          expediente_id: permTarget.id,
          doctor_id: newPermDoctorId,
          permission: newPermLevel,
          granted_by: myDoctorId,
          clinic_id: activeClinicId,
        });
      setNewPermDoctorId("");
      await loadExpPermissions(permTarget.id);
      // Refresh sharedPermissions in case current user was just granted access
      await loadSharedPermissions(expedientes.map((e) => e.id));
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo añadir el permiso" });
    }
    setPermSaving(false);
  }

  async function handleRemovePerm(permId: string) {
    if (!permTarget) return;
    try {
      await untypedTable("expediente_permissions")
        .delete()
        .eq("id", permId);
      setExpPermissions((prev) => prev.filter((p) => p.id !== permId));
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo quitar el permiso" });
    }
  }

  async function handleChangePermLevel(permId: string, level: "view" | "edit") {
    try {
      await untypedTable("expediente_permissions")
        .update({ permission: level })
        .eq("id", permId);
      setExpPermissions((prev) =>
        prev.map((p) => p.id === permId ? { ...p, permission: level } : p)
      );
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el permiso" });
    }
  }

  async function handleDelete(exp: Expediente) {
    const name = `${exp.patients?.nombre ?? ""} ${exp.patients?.apellidos ?? ""}`.trim();
    if (!window.confirm(
      `¿Eliminar expediente de ${name}?\n\n` +
      `El expediente se ocultará del sistema. ` +
      `NOM-004-SSA3-2012 requiere retención de 5 años — no se borra de la base de datos.`
    )) return;
    try {
      const { error } = await (supabase as any)
        .from("expedientes")
        .update({ activo: false } as never)
        .eq("id", exp.id);
      if (error) throw error;
      setExpedientes((prev) => prev.filter((e) => e.id !== exp.id));
      if (expanded === exp.id) setExpanded(null);
      toast({ title: "Expediente eliminado", description: `${name} — ocultado del sistema` });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el expediente" });
    }
  }

  function toggleExpand(expId: string, patientId: string) {
    if (expanded === expId) { setExpanded(null); return; }
    setExpanded(expId);
    loadNotas(expId);
    loadEstudios(expId, patientId);
  }

  async function openNewExpModal() {
    const [pd, dd] = await Promise.all([
      (supabase as any).from("patients").select("id, nombre, apellidos").eq("activo", true).order("apellidos"),
      (supabase as any).from("doctors").select("id, nombre, apellidos").eq("activo", true).order("apellidos"),
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
            <ExpedienteCard
              key={exp.id}
              exp={exp}
              expanded={expanded === exp.id}
              notas={notas[exp.id]}
              estudios={estudios[exp.id]}
              canWrite={canWrite}
              canManagePerms={canManagePerms(exp)}
              canEditExp={canEditExp(exp)}
              canDeleteExp={canDeleteExp(exp)}
              canRegisterStudy={hasRole("admin") || hasRole("receptionist")}
              onToggle={() => toggleExpand(exp.id, exp.patient_id)}
              onManagePerms={() => {
                setPermTarget(exp);
                setExpPermissions([]);
                setNewPermDoctorId("");
                setNewPermLevel("view");
                setPermModal(true);
                loadExpPermissions(exp.id);
              }}
              onEdit={() => openEditModal(exp)}
              onDelete={() => handleDelete(exp)}
              onNewNota={() => openNota(exp.id, exp.doctor_id)}
              onEditNota={(n) => openNota(exp.id, exp.doctor_id, n)}
              onGenerateRx={(n) => {
                setRxContext({
                  patientId: exp.patient_id,
                  doctorId: exp.doctor_id,
                  expedienteId: exp.id,
                  consultationNoteId: n.id,
                  diagnosis: n.diagnostico_principal ?? "",
                });
                setRxModal(true);
              }}
              onRegisterStudy={(study) => {
                setStudySelected(study);
                setCurrentExpPatientId(exp.patient_id);
                setStudyResultOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <NewExpedienteDialog
        open={newExpModal}
        onClose={() => setNewExpModal(false)}
        patients={patients}
        doctors={doctors}
        form={newExpForm}
        onFormChange={setNewExpForm}
        saving={saving}
        onCreate={handleCreateExpediente}
      />

      <EditExpedienteDialog
        open={editModal}
        onClose={() => setEditModal(false)}
        editTarget={editTarget}
        canEdit={!!editTarget && canEditExp(editTarget)}
        canReassign={!!editTarget && canReassign(editTarget)}
        doctors={doctors}
        form={editForm}
        onFormChange={setEditForm}
        keepPrevAccess={keepPrevAccess}
        onKeepPrevAccessChange={setKeepPrevAccess}
        saving={saving}
        onSave={handleSaveEdit}
      />

      <PermissionsDialog
        open={permModal}
        onClose={() => { setPermModal(false); setPermTarget(null); setExpPermissions([]); }}
        permTarget={permTarget}
        expPermissions={expPermissions}
        doctors={doctors}
        newPermDoctorId={newPermDoctorId}
        onNewPermDoctorIdChange={setNewPermDoctorId}
        newPermLevel={newPermLevel}
        onNewPermLevelChange={setNewPermLevel}
        permSaving={permSaving}
        onAdd={handleAddPerm}
        onRemove={handleRemovePerm}
        onChangeLevel={handleChangePermLevel}
      />

      <NotaConsultaModal
        open={notaModal}
        onClose={() => setNotaModal(false)}
        expedienteId={currentExpId}
        doctorId={currentDoctorId}
        clinicId={activeClinicId}
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
