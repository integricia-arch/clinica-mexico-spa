import { useState, useEffect } from "react";
import { Timer, PlayCircle, StopCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Caja {
  id: string;
  nombre: string;
  fondo_default: number;
}

interface Turno {
  id: string;
  caja_id: string;
  estado: string;
  monto_apertura: number;
  abierto_at: string;
  pharmacy_shift_id: string | null;
}

export default function CajaTurno() {
  const { user } = useAuth();
  const { activeClinic } = useActiveClinic();

  const [cajas, setCajas] = useState<Caja[]>([]);
  const [turnoActivo, setTurnoActivo] = useState<Turno | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cajaId, setCajaId] = useState("");
  const [montoApertura, setMontoApertura] = useState(0);
  const [notas, setNotas] = useState("");

  const load = async () => {
    if (!activeClinic?.id || !user?.id) return;
    setLoading(true);

    const [{ data: cajasData }, { data: turnoData }] = await Promise.all([
      supabase.from("cajas").select("id, nombre, fondo_default").eq("clinic_id", activeClinic.id).eq("activo", true).order("nombre"),
      supabase.from("turnos").select("*").eq("clinic_id", activeClinic.id).eq("cajero_user_id", user.id).eq("estado", "abierto").maybeSingle(),
    ]);

    const cajasList = (cajasData as Caja[]) ?? [];
    setCajas(cajasList);
    setTurnoActivo((turnoData as Turno | null) ?? null);

    if (cajasList[0] && !cajaId) {
      setCajaId(cajasList[0].id);
      setMontoApertura(cajasList[0].fondo_default);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeClinic?.id, user?.id]);

  const onCajaChange = (id: string) => {
    setCajaId(id);
    const caja = cajas.find((c) => c.id === id);
    if (caja) setMontoApertura(caja.fondo_default);
  };

  const abrirTurno = async () => {
    if (!cajaId) { toast.error("Selecciona una caja"); return; }
    if (!activeClinic?.id || !user?.id) return;
    setSaving(true);
    const { error } = await supabase.from("turnos").insert({
      clinic_id: activeClinic.id,
      caja_id: cajaId,
      cajero_user_id: user.id,
      monto_apertura: montoApertura,
      notas_apertura: notas.trim() || null,
      estado: "abierto",
    });
    setSaving(false);
    if (error) { toast.error("No se pudo abrir el turno"); return; }
    toast.success("Turno abierto");
    setNotas("");
    load();
  };

  const cerrarTurno = async () => {
    if (!turnoActivo) return;
    setSaving(true);
    const { error } = await supabase
      .from("turnos")
      .update({ estado: "cerrado", cerrado_at: new Date().toISOString(), notas_cierre: notas.trim() || null })
      .eq("id", turnoActivo.id);
    setSaving(false);
    if (error) { toast.error("No se pudo cerrar el turno"); return; }
    toast.success("Turno cerrado");
    setNotas("");
    load();
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground">Turno de Caja</h1>
        <p className="mt-1 text-sm text-muted-foreground">Abre o cierra tu turno de trabajo en caja</p>
      </div>

      {cajas.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-300/50 bg-yellow-50/50 p-5 dark:border-yellow-800/30 dark:bg-yellow-900/10">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Sin cajas configuradas</p>
            <p className="text-sm text-muted-foreground mt-1">Pide al administrador que configure al menos una caja en <strong>Configuración → Caja</strong>.</p>
          </div>
        </div>
      ) : turnoActivo ? (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Turno activo</p>
              <p className="text-xs text-muted-foreground">
                Abierto: {new Date(turnoActivo.abierto_at).toLocaleString("es-MX")} — Fondo: ${turnoActivo.monto_apertura.toFixed(2)} MXN
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="notas-cierre">Notas de cierre (opcional)</Label>
            <Input
              id="notas-cierre"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones al cerrar el turno…"
              className="mt-1"
            />
          </div>
          <Button variant="destructive" onClick={cerrarTurno} disabled={saving} className="w-full sm:w-auto">
            <StopCircle className="h-4 w-4 mr-2" />
            {saving ? "Cerrando…" : "Cerrar turno"}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <PlayCircle className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-card-foreground">Abrir turno</h2>
          </div>
          <div>
            <Label htmlFor="caja">Caja *</Label>
            <Select value={cajaId} onValueChange={onCajaChange}>
              <SelectTrigger id="caja" className="mt-1">
                <SelectValue placeholder="Selecciona una caja…" />
              </SelectTrigger>
              <SelectContent>
                {cajas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="monto">Monto de apertura (MXN) *</Label>
            <Input
              id="monto"
              type="number"
              min={0}
              step={0.01}
              value={montoApertura}
              onChange={(e) => setMontoApertura(parseFloat(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="notas-apertura">Notas de apertura (opcional)</Label>
            <Input
              id="notas-apertura"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones al abrir el turno…"
              className="mt-1"
            />
          </div>
          <Button onClick={abrirTurno} disabled={saving} className="w-full sm:w-auto">
            <PlayCircle className="h-4 w-4 mr-2" />
            {saving ? "Abriendo…" : "Abrir turno"}
          </Button>
        </div>
      )}
    </div>
  );
}
