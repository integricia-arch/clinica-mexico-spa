import { useState, useEffect } from "react";
import { CreditCard, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Caja {
  id: string;
  nombre: string;
  descripcion: string | null;
  fondo_default: number;
  activo: boolean;
  es_farmacia: boolean;
}

export default function CajaConfiguracion() {
  const { hasRole } = useAuth();
  const { activeClinic } = useActiveClinic();
  const canWrite = hasRole("admin") || hasRole("manager" as any);

  const [cajas, setCajas] = useState<Caja[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: "", descripcion: "", fondo_default: 0, es_farmacia: false });

  const load = async () => {
    if (!activeClinic?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cajas")
      .select("*")
      .eq("clinic_id", activeClinic.id)
      .order("nombre");
    if (error) toast.error("No se pudieron cargar las cajas");
    else setCajas((data as Caja[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeClinic?.id]);

  const toggleActivo = async (caja: Caja) => {
    const { error } = await supabase
      .from("cajas")
      .update({ activo: !caja.activo })
      .eq("id", caja.id);
    if (error) { toast.error("No se pudo actualizar"); return; }
    setCajas((prev) => prev.map((c) => c.id === caja.id ? { ...c, activo: !c.activo } : c));
  };

  const save = async () => {
    if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (!activeClinic?.id) { toast.error("Sin clínica activa"); return; }
    setSaving(true);
    const { error } = await supabase.from("cajas").insert({
      clinic_id: activeClinic.id,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      fondo_default: form.fondo_default,
      es_farmacia: form.es_farmacia,
    });
    setSaving(false);
    if (error) { toast.error("No se pudo crear la caja"); return; }
    toast.success("Caja creada");
    setModalOpen(false);
    setForm({ nombre: "", descripcion: "", fondo_default: 0, es_farmacia: false });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground">Configuración de Caja</h1>
        <p className="mt-1 text-sm text-muted-foreground">Administra las cajas registradoras de la clínica</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-display font-semibold text-card-foreground">Cajas registradas</h2>
            <span className="text-xs text-muted-foreground">({cajas.length})</span>
          </div>
          {canWrite && (
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nueva caja
            </Button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : cajas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cajas registradas. Crea la primera caja para comenzar.</p>
        ) : (
          <div className="space-y-2">
            {cajas.map((caja) => (
              <div key={caja.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{caja.nombre}</p>
                  {caja.descripcion && <p className="text-xs text-muted-foreground">{caja.descripcion}</p>}
                  <p className="text-xs text-muted-foreground">Fondo inicial: ${caja.fondo_default.toFixed(2)} MXN</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${caja.activo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {caja.activo ? "Activa" : "Inactiva"}
                  </span>
                  {canWrite && (
                    <Button size="sm" variant="outline" onClick={() => toggleActivo(caja)}>
                      {caja.activo ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Caja 1 — Recepción"
              />
            </div>
            <div>
              <Label htmlFor="descripcion">Descripción (opcional)</Label>
              <Input
                id="descripcion"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Ej. Caja principal de planta baja"
              />
            </div>
            <div>
              <Label htmlFor="fondo">Fondo de apertura predeterminado (MXN)</Label>
              <Input
                id="fondo"
                type="number"
                min={0}
                step={0.01}
                value={form.fondo_default}
                onChange={(e) => setForm({ ...form, fondo_default: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
