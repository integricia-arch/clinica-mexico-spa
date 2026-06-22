import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Scale, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type ARCOStatus = "pendiente" | "en_proceso" | "resuelto" | "rechazado";
type ARCOTipo = "acceso" | "rectificacion" | "cancelacion" | "oposicion";

interface ARCORequest {
  id: string;
  folio: string;
  tipo: ARCOTipo;
  nombre: string;
  email: string;
  telefono: string | null;
  descripcion: string;
  clinic_name: string | null;
  created_at: string;
  deadline_at: string;
  status: ARCOStatus;
  resolved_at: string | null;
  notas_internas: string | null;
  respuesta: string | null;
}

const TIPO_LABEL: Record<ARCOTipo, string> = {
  acceso:        "Acceso",
  rectificacion: "Rectificación",
  cancelacion:   "Cancelación",
  oposicion:     "Oposición",
};

const STATUS_BADGE: Record<ARCOStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendiente:   { label: "Pendiente",   variant: "destructive" },
  en_proceso:  { label: "En proceso",  variant: "default" },
  resuelto:    { label: "Resuelto",    variant: "secondary" },
  rechazado:   { label: "Rechazado",   variant: "outline" },
};

function diasRestantes(deadline: string) {
  return differenceInDays(new Date(deadline), new Date());
}

export default function ARCOAdmin() {
  const [requests, setRequests] = useState<ARCORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<ARCOStatus | "todos">("todos");
  const [selected, setSelected] = useState<ARCORequest | null>(null);
  const [notas, setNotas] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    const q = supabase
      .from("arco_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const { data, error } = await q;
    if (error) toast.error("Error cargando solicitudes ARCO");
    else setRequests((data ?? []) as ARCORequest[]);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const filtered = filterStatus === "todos"
    ? requests
    : requests.filter((r) => r.status === filterStatus);

  const openDetail = (r: ARCORequest) => {
    setSelected(r);
    setNotas(r.notas_internas ?? "");
    setRespuesta(r.respuesta ?? "");
  };

  const saveChanges = async (newStatus: ARCOStatus) => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("arco_requests")
      .update({
        status: newStatus,
        notas_internas: notas || null,
        respuesta: respuesta || null,
        resolved_at: ["resuelto", "rechazado"].includes(newStatus)
          ? new Date().toISOString()
          : null,
      })
      .eq("id", selected.id);

    if (error) {
      toast.error("Error al guardar");
    } else {
      toast.success("Solicitud actualizada");
      setSelected(null);
      fetchRequests();
    }
    setSaving(false);
  };

  const pendientes = requests.filter((r) => r.status === "pendiente").length;
  const vencidas   = requests.filter(
    (r) => r.status !== "resuelto" && r.status !== "rechazado" && diasRestantes(r.deadline_at) < 0
  ).length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Scale className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Solicitudes ARCO</h1>
          <p className="text-sm text-muted-foreground">LFPDPPP Arts. 21-34 · Plazo: 20 días hábiles</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{pendientes}</p>
          <p className="text-xs text-muted-foreground">Pendientes</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{vencidas}</p>
          <p className="text-xs text-muted-foreground">Vencidas (riesgo legal)</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{requests.length}</p>
          <p className="text-xs text-muted-foreground">Total históricas</p>
        </div>
      </div>

      {vencidas > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {vencidas} solicitud{vencidas > 1 ? "es" : ""} vencida{vencidas > 1 ? "s" : ""}.
            No responder en plazo es infracción directa (LFPDPPP Art. 64). Atender de inmediato.
          </span>
        </div>
      )}

      {/* Filtro */}
      <div className="flex gap-2 items-center">
        <span className="text-sm font-medium">Filtrar:</span>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as ARCOStatus | "todos")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="en_proceso">En proceso</SelectItem>
            <SelectItem value="resuelto">Resueltos</SelectItem>
            <SelectItem value="rechazado">Rechazados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin solicitudes.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Folio</th>
                <th className="px-4 py-2 text-left font-medium">Tipo</th>
                <th className="px-4 py-2 text-left font-medium">Solicitante</th>
                <th className="px-4 py-2 text-left font-medium">Fecha</th>
                <th className="px-4 py-2 text-left font-medium">Plazo</th>
                <th className="px-4 py-2 text-left font-medium">Estado</th>
                <th className="px-4 py-2 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => {
                const dias = diasRestantes(r.deadline_at);
                const isActive = r.status !== "resuelto" && r.status !== "rechazado";
                const isUrgent = isActive && dias <= 3;
                const isOverdue = isActive && dias < 0;
                return (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{r.folio}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{TIPO_LABEL[r.tipo]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.nombre}</p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "dd MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {isActive ? (
                        <span className={isOverdue ? "text-destructive font-bold" : isUrgent ? "text-orange-600 font-medium" : "text-muted-foreground"}>
                          {isOverdue ? `Vencida hace ${Math.abs(dias)}d` : `${dias}d restantes`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {format(new Date(r.deadline_at), "dd MMM", { locale: es })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[r.status].variant}>
                        {STATUS_BADGE[r.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" onClick={() => openDetail(r)}>
                        Ver
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail dialog */}
      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                {selected.folio} — {TIPO_LABEL[selected.tipo]}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              {/* Info del titular */}
              <div className="rounded-md bg-muted/30 p-3 space-y-1">
                <p><span className="font-medium">Nombre:</span> {selected.nombre}</p>
                <p><span className="font-medium">Email:</span> {selected.email}</p>
                {selected.telefono && <p><span className="font-medium">Tel:</span> {selected.telefono}</p>}
                {selected.clinic_name && <p><span className="font-medium">Clínica:</span> {selected.clinic_name}</p>}
                <p><span className="font-medium">Recibida:</span> {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                <p className={diasRestantes(selected.deadline_at) < 0 ? "text-destructive font-bold" : ""}>
                  <span className="font-medium">Plazo legal:</span>{" "}
                  {format(new Date(selected.deadline_at), "dd/MM/yyyy", { locale: es })}
                  {" "}({diasRestantes(selected.deadline_at) < 0
                    ? `VENCIDA hace ${Math.abs(diasRestantes(selected.deadline_at))} días`
                    : `${diasRestantes(selected.deadline_at)} días restantes`})
                </p>
              </div>

              {/* Descripción */}
              <div>
                <p className="font-medium mb-1">Descripción del titular:</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{selected.descripcion}</p>
              </div>

              {/* Notas internas */}
              <div className="space-y-1">
                <p className="font-medium">Notas internas (no se envían al titular):</p>
                <Textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Notas de gestión interna..."
                  rows={3}
                />
              </div>

              {/* Respuesta al titular */}
              <div className="space-y-1">
                <p className="font-medium">Respuesta al titular:</p>
                <Textarea
                  value={respuesta}
                  onChange={(e) => setRespuesta(e.target.value)}
                  placeholder="Texto de la respuesta formal que se enviará al titular..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Después de guardar, enviar esta respuesta manualmente al email: {selected.email}
                </p>
              </div>
            </div>

            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={() => setSelected(null)}>Cerrar</Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => saveChanges("en_proceso")}
              >
                <Clock className="mr-1 h-3.5 w-3.5" />
                En proceso
              </Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => saveChanges("rechazado")}
              >
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Rechazar
              </Button>
              <Button
                disabled={saving}
                onClick={() => saveChanges("resuelto")}
              >
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Marcar resuelto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
