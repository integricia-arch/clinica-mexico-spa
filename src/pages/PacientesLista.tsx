import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Phone, Mail, Pencil, CalendarDays, FileText, ShoppingCart, ClipboardList, ExternalLink } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import PacienteModal from "@/components/PacienteModal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Patient = Tables<"patients">;

type Appointment = {
  id: string;
  fecha_inicio: string | null;
  status: string | null;
  origen: string | null;
  motivo_consulta: string | null;
  doctors: { nombre: string; apellidos: string } | null;
};

type NotaConsulta = {
  id: string;
  fecha_consulta: string;
  subjetivo: string | null;
  diagnostico_principal: string | null;
  plan: string | null;
};

type Prescription = {
  id: string;
  prescription_number: string | null;
  created_at: string | null;
  status: string | null;
  diagnosis: string | null;
};

type PharmacySale = {
  id: string;
  created_at: string | null;
  total: number | null;
  status: string | null;
  payment_method: string | null;
};

type JourneyInstance = {
  id: string;
  created_at: string | null;
  status: string | null;
  journey_templates: { name: string } | null;
};

function apptStatusColor(status: string | null): string {
  if (!status) return "text-muted-foreground";
  if (["confirmada", "confirmada_medico", "confirmada_paciente"].includes(status)) return "text-green-600";
  if (status === "cancelada") return "text-red-600";
  if (status === "no_show") return "text-orange-500";
  return "text-muted-foreground";
}

function rxStatusColor(status: string | null): string {
  if (!status) return "text-muted-foreground";
  if (["issued", "active"].includes(status)) return "text-green-600";
  if (status === "cancelled") return "text-red-600";
  return "text-muted-foreground";
}

function journeyStatusColor(status: string | null): string {
  if (!status) return "text-muted-foreground";
  if (status === "completed") return "text-green-600";
  if (status === "in_progress") return "text-blue-600";
  if (status === "cancelled") return "text-red-600";
  return "text-muted-foreground";
}

function saleStatusColor(status: string | null): string {
  if (!status) return "text-muted-foreground";
  if (status === "completed") return "text-green-600";
  if (status === "pending") return "text-orange-500";
  if (status === "cancelled") return "text-red-600";
  return "text-muted-foreground";
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function PacienteHistorialDrawer({
  patient,
  open,
  onClose,
}: {
  patient: Patient | null;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [rxs, setRxs] = useState<Prescription[]>([]);
  const [sales, setSales] = useState<PharmacySale[]>([]);
  const [journeys, setJourneys] = useState<JourneyInstance[]>([]);
  const [notas, setNotas] = useState<NotaConsulta[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    if (!open || !patient) return;
    setLoadingAll(true);

    Promise.all([
      supabase
        .from("appointments")
        .select("id,fecha_inicio,status,origen,motivo_consulta,doctors(nombre,apellidos)")
        .eq("patient_id", patient.id)
        .order("fecha_inicio", { ascending: false })
        .limit(30),
      supabase
        .from("prescriptions")
        .select("id,prescription_number,created_at,status,diagnosis")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("pharmacy_sales")
        .select("id,created_at,total,status,payment_method")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("journey_instances")
        .select("id,created_at,status,journey_templates(name)")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("expedientes")
        .select("id")
        .eq("patient_id", patient.id),
    ]).then(async ([apptRes, rxRes, saleRes, journeyRes, expRes]) => {
      setAppts((apptRes.data as unknown as Appointment[]) ?? []);
      setRxs((rxRes.data as Prescription[]) ?? []);
      setSales((saleRes.data as PharmacySale[]) ?? []);
      setJourneys((journeyRes.data as unknown as JourneyInstance[]) ?? []);

      const expIds = (expRes.data ?? []).map((e: { id: string }) => e.id);
      if (expIds.length > 0) {
        const { data: notasData } = await supabase
          .from("notas_consulta")
          .select("id,fecha_consulta,subjetivo,diagnostico_principal,plan")
          .in("expediente_id", expIds)
          .order("fecha_consulta", { ascending: false })
          .limit(20);
        setNotas((notasData as NotaConsulta[]) ?? []);
      } else {
        setNotas([]);
      }
      setLoadingAll(false);
    });
  }, [open, patient]);

  // Computed stats
  const ultimaVisita = appts[0]?.fecha_inicio ?? null;
  const gastoFarmacia = sales
    .filter(s => s.status === "completed")
    .reduce((sum, s) => sum + (s.total ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="truncate">
              {patient ? `${patient.nombre} ${patient.apellidos}` : "Historial"}
            </SheetTitle>
            {patient && (
              <button
                onClick={() => { onClose(); navigate(`/expediente/${patient.id}`); }}
                className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Expediente completo
              </button>
            )}
          </div>
        </SheetHeader>

        {/* Stats row */}
        {!loadingAll && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-lg font-bold">{appts.length}</p>
              <p className="text-[10px] text-muted-foreground">Citas</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-lg font-bold">{rxs.length}</p>
              <p className="text-[10px] text-muted-foreground">Recetas</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-lg font-bold">${gastoFarmacia.toFixed(0)}</p>
              <p className="text-[10px] text-muted-foreground">Farmacia</p>
            </div>
            {ultimaVisita && (
              <div className="col-span-3 flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                <CalendarDays className="h-3 w-3" />
                Última visita: {format(new Date(ultimaVisita), "dd 'de' MMMM yyyy", { locale: es })}
              </div>
            )}
          </div>
        )}

        <Tabs defaultValue="citas" className="mt-4">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="citas" className="text-xs px-1">
              <CalendarDays className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Citas</span>
            </TabsTrigger>
            <TabsTrigger value="notas" className="text-xs px-1">
              <ClipboardList className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Notas</span>
            </TabsTrigger>
            <TabsTrigger value="recetas" className="text-xs px-1">
              <FileText className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Recetas</span>
            </TabsTrigger>
            <TabsTrigger value="pagos" className="text-xs px-1">
              <ShoppingCart className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Pagos</span>
            </TabsTrigger>
            <TabsTrigger value="caminos" className="text-xs px-1">
              <span className="text-xs">Caminos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="citas" className="mt-4 space-y-2">
            {loadingAll ? <Spinner /> : appts.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Sin registros</p>
            ) : appts.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {a.fecha_inicio ? format(new Date(a.fecha_inicio), "dd/MM/yyyy HH:mm", { locale: es }) : "—"}
                  </span>
                  <span className={`text-xs font-medium ${apptStatusColor(a.status)}`}>{a.status ?? "—"}</span>
                </div>
                {a.doctors && (
                  <p className="mt-0.5 text-xs text-blue-600">Dr. {a.doctors.nombre} {a.doctors.apellidos}</p>
                )}
                {a.motivo_consulta && (
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{a.motivo_consulta}</p>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="notas" className="mt-4 space-y-2">
            {loadingAll ? <Spinner /> : notas.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Sin notas clínicas</p>
            ) : notas.map((n) => (
              <div key={n.id} className="rounded-lg border border-border p-3 text-sm space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  {format(new Date(n.fecha_consulta), "dd/MM/yyyy", { locale: es })}
                </p>
                {n.diagnostico_principal && (
                  <p className="font-medium text-sm">{n.diagnostico_principal}</p>
                )}
                {n.subjetivo && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.subjetivo}</p>
                )}
                {n.plan && (
                  <p className="text-xs text-blue-600 line-clamp-1">Plan: {n.plan}</p>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="recetas" className="mt-4 space-y-2">
            {loadingAll ? <Spinner /> : rxs.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Sin registros</p>
            ) : rxs.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.prescription_number ?? r.id.slice(0, 8)}</span>
                  <span className={`text-xs font-medium ${rxStatusColor(r.status)}`}>{r.status ?? "—"}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: es }) : "—"}
                  </span>
                  {r.diagnosis && (
                    <span className="text-xs text-muted-foreground truncate max-w-[60%]">{r.diagnosis}</span>
                  )}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="pagos" className="mt-4 space-y-2">
            {loadingAll ? <Spinner /> : sales.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Sin registros</p>
            ) : sales.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">${s.total != null ? s.total.toFixed(2) : "—"}</span>
                  <span className={`text-xs font-medium ${saleStatusColor(s.status)}`}>{s.status ?? "—"}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {s.created_at ? format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: es }) : "—"}
                  </span>
                  {s.payment_method && <span className="text-xs text-muted-foreground">{s.payment_method}</span>}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="caminos" className="mt-4 space-y-2">
            {loadingAll ? <Spinner /> : journeys.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Sin registros</p>
            ) : journeys.map((j) => (
              <div key={j.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{j.journey_templates?.name ?? "Camino"}</span>
                  <span className={`text-xs font-medium ${journeyStatusColor(j.status)}`}>{j.status ?? "—"}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {j.created_at ? format(new Date(j.created_at), "dd/MM/yyyy HH:mm", { locale: es }) : "—"}
                </span>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

export default function PacientesLista() {
  const { hasRole } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialPaciente, setHistorialPaciente] = useState<Patient | null>(null);

  const canEdit = hasRole("admin") || hasRole("receptionist");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(search), search ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  async function load(term: string) {
    setLoading(true);
    let q = supabase
      .from("patients")
      .select("*", { count: "exact" })
      .eq("activo", true)
      .order("apellidos", { ascending: true })
      .limit(100);
    if (term.trim().length >= 2) {
      const t = term.trim();
      q = q.or(`nombre.ilike.%${t}%,apellidos.ilike.%${t}%,telefono.ilike.%${t}%,curp.ilike.%${t}%`);
    }
    const { data, count } = await q;
    setPatients(data ?? []);
    setTotal(count ?? null);
    setLoading(false);
  }

  const filtered = patients;

  const openNew = () => { setSelected(null); setModalOpen(true); };
  const openEdit = (p: Patient) => { setSelected(p); setModalOpen(true); };

  const handleSaved = (p: Patient) => {
    setPatients((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = p;
        return next;
      }
      return [p, ...prev];
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Pacientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total !== null ? `${total} pacientes` : "Cargando…"}{patients.length === 100 && total !== null && total > 100 ? ` (mostrando primeros 100)` : ""}
          </p>
        </div>
        {canEdit && (
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo paciente
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono o CURP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No se encontraron pacientes</p>
          {canEdit && (
            <Button variant="outline" className="mt-4" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar primer paciente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-border bg-card p-4 shadow-card hover:shadow-elevated transition-shadow cursor-pointer"
              onClick={() => { setHistorialPaciente(p); setHistorialOpen(true); }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  {p.nombre[0]}{p.apellidos[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-card-foreground truncate">
                    {p.apellidos}, {p.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.fecha_nacimiento
                      ? format(new Date(p.fecha_nacimiento), "dd/MM/yyyy", { locale: es })
                      : "Sin fecha de nacimiento"}{" "}
                    · {p.sexo === "M" ? "Masculino" : p.sexo === "F" ? "Femenino" : p.sexo || "—"}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="mt-3 space-y-1">
                {p.telefono && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{p.telefono}</span>
                  </div>
                )}
                {p.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{p.email}</span>
                  </div>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {p.tipo_sangre && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    {p.tipo_sangre}
                  </span>
                )}
                {p.alergias && (
                  <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    Alergias
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <PacienteModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        patient={selected}
        onSaved={handleSaved}
      />

      <PacienteHistorialDrawer
        open={historialOpen}
        patient={historialPaciente}
        onClose={() => setHistorialOpen(false)}
      />
    </div>
  );
}
