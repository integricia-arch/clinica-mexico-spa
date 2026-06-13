import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Pill, Printer, QrCode, History, Search, FileText, Calendar, FilePlus2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Doctor {
  id: string;
  nombre: string;
  apellidos: string;
  especialidad: string | null;
}
interface Patient {
  id: string;
  nombre: string;
  apellidos: string;
}
interface Item {
  id: string;
  prescription_id: string;
  generic_name: string;
  is_controlled: boolean;
}
interface Receta {
  id: string;
  prescription_number: string | null;
  issue_date: string | null;
  status: string;
  diagnosis: string | null;
  doctor_id: string;
  patient_id: string;
  doctor?: Doctor;
  patient?: Patient;
  items: Item[];
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-muted text-muted-foreground" },
  issued: { label: "Emitida", cls: "bg-primary/10 text-primary" },
  partially_dispensed: { label: "Surtida parcial", cls: "bg-warning/10 text-warning" },
  dispensed: { label: "Surtida", cls: "bg-success/10 text-success" },
  cancelled: { label: "Cancelada", cls: "bg-destructive/10 text-destructive" },
};

export default function Recetas() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const isDoctor = roles.includes("doctor");
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: rxs } = await supabase
        .from("prescriptions")
        .select("id, prescription_number, issue_date, status, diagnosis, doctor_id, patient_id, created_at")
        .order("issue_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);

      const list = (rxs ?? []) as unknown as Receta[];
      if (list.length === 0) {
        setRecetas([]);
        setLoading(false);
        return;
      }

      const ids = list.map((r) => r.id);
      const docIds = Array.from(new Set(list.map((r) => r.doctor_id)));
      const patIds = Array.from(new Set(list.map((r) => r.patient_id)));

      const [{ data: items }, { data: docs }, { data: pats }] = await Promise.all([
        supabase.from("prescription_items").select("id, prescription_id, generic_name, is_controlled").in("prescription_id", ids),
        supabase.from("doctors").select("id, nombre, apellidos, especialidad").in("id", docIds),
        supabase.from("patients").select("id, nombre, apellidos").in("id", patIds),
      ]);

      const itemsByRx = new Map<string, Item[]>();
      (items ?? []).forEach((it: any) => {
        const arr = itemsByRx.get(it.prescription_id) ?? [];
        arr.push(it);
        itemsByRx.set(it.prescription_id, arr);
      });
      const docMap = new Map<string, Doctor>();
      (docs ?? []).forEach((d: any) => docMap.set(d.id, d));
      const patMap = new Map<string, Patient>();
      (pats ?? []).forEach((p: any) => patMap.set(p.id, p));

      setDoctorsList(docs ?? []);
      setRecetas(list.map((r) => ({
        ...r,
        items: itemsByRx.get(r.id) ?? [],
        doctor: docMap.get(r.doctor_id),
        patient: patMap.get(r.patient_id),
      })));
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return recetas.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (doctorFilter !== "all" && r.doctor_id !== doctorFilter) return false;
      if (!term) return true;
      const hay = [
        r.prescription_number,
        r.diagnosis,
        r.patient && `${r.patient.nombre} ${r.patient.apellidos}`,
        r.doctor && `${r.doctor.nombre} ${r.doctor.apellidos}`,
        ...r.items.map((it) => it.generic_name),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [recetas, q, statusFilter, doctorFilter]);

  const stats = useMemo(() => {
    return {
      total: recetas.length,
      issued: recetas.filter((r) => r.status === "issued").length,
      dispensed: recetas.filter((r) => r.status === "dispensed" || r.status === "partially_dispensed").length,
      draft: recetas.filter((r) => r.status === "draft").length,
    };
  }, [recetas]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Pill className="h-6 w-6 text-primary" /> Recetas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de recetas médicas — emisión, impresión y bitácora
          </p>
        </div>
        <div className="flex gap-2">
          {(isAdmin || isDoctor) && (
            <Button asChild variant="outline">
              <Link to="/configuracion/recetas">
                <FileText className="mr-1.5 h-4 w-4" /> Machote
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link to="/expedientes">
              <FilePlus2 className="mr-1.5 h-4 w-4" /> Nueva receta
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, cls: "text-foreground" },
          { label: "Emitidas", value: stats.issued, cls: "text-primary" },
          { label: "Surtidas", value: stats.dispensed, cls: "text-success" },
          { label: "Borradores", value: stats.draft, cls: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por folio, paciente, médico o medicamento…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="issued">Emitida</SelectItem>
            <SelectItem value="partially_dispensed">Surtida parcial</SelectItem>
            <SelectItem value="dispensed">Surtida</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Médico" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los médicos</SelectItem>
              {doctorsList.map((d) => (
                <SelectItem key={d.id} value={d.id}>Dr(a). {d.nombre} {d.apellidos}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p>No se encontraron recetas con los filtros actuales.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const s = STATUS_LABELS[r.status] ?? { label: r.status, cls: "bg-muted text-muted-foreground" };
            const hasControlled = r.items.some((i) => i.is_controlled);
            return (
              <div key={r.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{r.prescription_number ?? "Sin folio"}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                      {hasControlled && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
                          Controlado
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                      <Calendar className="h-3 w-3" />
                      {r.issue_date ? format(new Date(r.issue_date), "dd/MM/yyyy HH:mm", { locale: es }) : "Sin emitir"}
                      {r.patient && (
                        <span className="ml-2">· {r.patient.nombre} {r.patient.apellidos}</span>
                      )}
                      {r.doctor && (
                        <span className="ml-2">· Dr(a). {r.doctor.nombre} {r.doctor.apellidos}</span>
                      )}
                    </p>
                    {r.diagnosis && <p className="mt-1 text-xs text-foreground">Dx: {r.diagnosis}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.items.length} medicamento(s){r.items.length > 0 ? ": " + r.items.map((i) => i.generic_name).join(", ") : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/receta/${r.id}`} target="_blank">
                        <Printer className="mr-1.5 h-4 w-4" /> Imprimir
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/verificar-receta/${r.id}`} target="_blank">
                        <QrCode className="mr-1.5 h-4 w-4" /> Verificar
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/receta/${r.id}/bitacora`}>
                        <History className="mr-1.5 h-4 w-4" /> Bitácora
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
