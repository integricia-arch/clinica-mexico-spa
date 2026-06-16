import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";

interface Medicamento { id: string; nombre: string; }
interface Props { medicamentos: Medicamento[]; }

interface SolicitudRow {
  id: string;
  medicamento_id: string;
  cantidad: number;
  motivo: string | null;
  status: "pendiente" | "aprobada" | "rechazada";
  solicitado_por: string | null;
  created_at: string;
  resolved_at: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700 border-0",
  aprobada: "bg-emerald-100 text-emerald-700 border-0",
  rechazada: "bg-red-100 text-red-700 border-0",
};

export default function SolicitudesInsumos({ medicamentos }: Props) {
  const { hasRole } = useAuth();
  const { activeClinicId } = useActiveClinic();
  const canApprove = hasRole("admin") || hasRole("manager");

  const [items, setItems] = useState<SolicitudRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [medicamentoId, setMedicamentoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("solicitudes_insumos")
      .select("id, medicamento_id, cantidad, motivo, status, solicitado_por, created_at, resolved_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setLoading(false);
    if (error) { toast.error("No se pudieron cargar las solicitudes"); return; }
    setItems((data ?? []) as SolicitudRow[]);
  };

  useEffect(() => { fetchItems(); }, []);

  const medNombre = (id: string) => medicamentos.find((m) => m.id === id)?.nombre ?? id;

  const handleCrear = async () => {
    if (!medicamentoId) { toast.error("Selecciona un insumo"); return; }
    const cant = Number(cantidad);
    if (!cant || cant <= 0) { toast.error("Cantidad inválida"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("solicitudes_insumos").insert({
      medicamento_id: medicamentoId,
      cantidad: cant,
      motivo: motivo.trim() || null,
      clinic_id: activeClinicId,
      solicitado_por: (await supabase.auth.getUser()).data.user?.id,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message || "No se pudo crear la solicitud"); return; }
    toast.success("Solicitud enviada");
    setMedicamentoId(""); setCantidad("1"); setMotivo("");
    fetchItems();
  };

  const handleAprobar = async (id: string) => {
    setResolvingId(id);
    const { error } = await supabase.rpc("aprobar_solicitud_insumo", { p_solicitud_id: id } as never);
    setResolvingId(null);
    if (error) { toast.error(error.message || "No se pudo aprobar"); return; }
    toast.success("Solicitud aprobada — inventario actualizado");
    fetchItems();
  };

  const handleRechazar = async (id: string) => {
    setResolvingId(id);
    const { error } = await supabase.rpc("rechazar_solicitud_insumo", { p_solicitud_id: id } as never);
    setResolvingId(null);
    if (error) { toast.error(error.message || "No se pudo rechazar"); return; }
    toast.success("Solicitud rechazada");
    fetchItems();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-medium text-sm flex items-center gap-1.5"><Send className="h-4 w-4" /> Nueva solicitud de insumos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Label>Insumo</Label>
            <Select value={medicamentoId} onValueChange={setMedicamentoId}>
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {medicamentos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cantidad</Label>
            <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={handleCrear} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Solicitar"}
            </Button>
          </div>
        </div>
        <div>
          <Label>Motivo (opcional)</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Ej. Reposición de carro de curaciones" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Insumo</th>
                <th className="text-left px-4 py-3 font-medium">Cantidad</th>
                <th className="text-left px-4 py-3 font-medium">Motivo</th>
                <th className="text-left px-4 py-3 font-medium">Estatus</th>
                {canApprove && <th className="text-right px-4 py-3 font-medium">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Sin solicitudes</td></tr>
              )}
              {items.map((s) => (
                <tr key={s.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-medium">{medNombre(s.medicamento_id)}</td>
                  <td className="px-4 py-3">{s.cantidad}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{s.motivo ?? "—"}</td>
                  <td className="px-4 py-3"><Badge className={STATUS_BADGE[s.status]}>{s.status}</Badge></td>
                  {canApprove && (
                    <td className="px-4 py-3">
                      {s.status === "pendiente" ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" disabled={resolvingId === s.id} onClick={() => handleAprobar(s.id)}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
                          </Button>
                          <Button size="sm" variant="outline" disabled={resolvingId === s.id} onClick={() => handleRechazar(s.id)}>
                            <X className="h-3.5 w-3.5 mr-1" /> Rechazar
                          </Button>
                        </div>
                      ) : <span className="text-xs text-muted-foreground text-right block">—</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
