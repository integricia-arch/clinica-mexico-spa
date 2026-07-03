import { useState, useCallback, useRef } from "react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useInventarioCiclico, type Conteo, type ConteoItem } from "@/hooks/useInventarioCiclico";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ChevronDown, ChevronUp, ClipboardList, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ESTATUS_BADGE: Record<Conteo["estatus"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  en_progreso:        { label: "En progreso",        variant: "secondary" },
  pendiente_revision: { label: "Pte. revisión",      variant: "outline" },
  cerrado:            { label: "Cerrado",             variant: "default" },
  cancelado:          { label: "Cancelado",           variant: "destructive" },
};

const CATEGORIAS = [
  "","Analgésico","Antibiótico","Antiinflamatorio","Antihipertensivo","Antidiabético",
  "Gastrointestinal","Antihistamínico","Broncodilatador","Neurológico","Soluciones","Vitaminas","Tópico","Otro",
];

// Conteo ciego: el contador ingresa el valor sin ver el sistema
function ConteoBlindoRow({
  item, onSave,
}: {
  item: ConteoItem;
  onSave: (itemId: string, contada: number, nota: string) => Promise<void>;
}) {
  const [val, setVal] = useState(item.existencia_contada !== null ? String(item.existencia_contada) : "");
  const [nota, setNota] = useState(item.nota_diferencia ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    if (val === "") return;
    setSaving(true);
    try {
      await onSave(item.id, Number(val), nota);
    } finally {
      setSaving(false);
    }
  };

  const contado = item.existencia_contada !== null;
  const diferencia = contado ? Number(val) - item.existencia_sistema : null;

  return (
    <div className={`flex items-center gap-3 py-2 border-b last:border-0 ${diferencia !== null && diferencia !== 0 ? "bg-yellow-50/50" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.medicamento_nombre}</p>
        <p className="text-xs text-muted-foreground font-mono">{item.numero_lote || "Sin lote"}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          ref={inputRef}
          type="number"
          min={0}
          className="w-20 h-8 text-sm text-center"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="—"
        />
        {contado && diferencia !== null && (
          <span className={`text-xs font-semibold w-12 text-right ${diferencia === 0 ? "text-green-600" : "text-yellow-600"}`}>
            {diferencia > 0 ? `+${diferencia}` : diferencia}
          </span>
        )}
        {contado && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
        {saving && <span className="text-xs text-muted-foreground">…</span>}
      </div>
    </div>
  );
}

export default function InventarioCiclico() {
  const { activeClinicId } = useActiveClinic();
  const { toast } = useToast();
  const { items: conteos, loading, error, iniciarConteo, registrarConteo, cerrarConteo, getItems } = useInventarioCiclico(activeClinicId);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, ConteoItem[]>>({});
  const [activeConteoId, setActiveConteoId] = useState<string | null>(null);
  const [activeItems, setActiveItems] = useState<ConteoItem[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [form, setForm] = useState({
    tipo: "ciclico" as Conteo["tipo"],
    categoriaFiltro: "",
    notas: "",
  });

  const toggleExpand = useCallback(async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!expandedItems[id]) {
      try {
        const items = await getItems(id);
        setExpandedItems((prev) => ({ ...prev, [id]: items }));
      } catch { /* non-critical */ }
    }
  }, [expanded, expandedItems, getItems]);

  const handleIniciar = async () => {
    setStarting(true);
    try {
      const { conteoId, items } = await iniciarConteo(form.tipo, form.categoriaFiltro, form.notas);
      if (items.length === 0) {
        toast({ title: "No hay productos con existencia en esa categoría", variant: "destructive" });
        setStarting(false);
        return;
      }
      setDialogOpen(false);
      // Recargar items con IDs reales
      const realItems = await getItems(conteoId);
      setActiveConteoId(conteoId);
      setActiveItems(realItems);
      toast({ title: `Conteo iniciado: ${realItems.length} productos a contar` });
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const handleRegistrarConteo = async (itemId: string, contada: number, nota: string) => {
    try {
      await registrarConteo(itemId, contada, nota);
      setActiveItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? { ...it, existencia_contada: contada, diferencia: contada - it.existencia_sistema, nota_diferencia: nota }
            : it
        )
      );
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    }
  };

  const handleCerrar = async () => {
    if (!activeConteoId) return;
    const sinContar = activeItems.filter((i) => i.existencia_contada === null).length;
    if (sinContar > 0) {
      toast({ title: `${sinContar} producto(s) sin contar. ¿Deseas cerrar de todas formas?`, variant: "destructive" });
    }
    try {
      await cerrarConteo(activeConteoId);
      toast({ title: "Conteo cerrado. Pendiente de revisión por supervisor." });
      setActiveConteoId(null);
      setActiveItems([]);
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    }
  };

  const contados = activeItems.filter((i) => i.existencia_contada !== null).length;
  const conDiferencias = activeItems.filter((i) => i.diferencia !== null && i.diferencia !== 0).length;

  // Vista activa de conteo
  if (activeConteoId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Conteo Ciego en Progreso</h3>
            <p className="text-sm text-muted-foreground">
              {contados}/{activeItems.length} contados · {conDiferencias} diferencias
            </p>
          </div>
          <Button variant="outline" onClick={handleCerrar}>
            <CheckCircle className="h-4 w-4 mr-1" /> Cerrar conteo
          </Button>
        </div>

        {conDiferencias > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{conDiferencias} diferencia(s) detectada(s). Serán revisadas por el supervisor antes de ajustar inventario.</span>
          </div>
        )}

        <div className="rounded-md border bg-card p-1">
          <div className="flex items-center gap-2 px-3 py-2 border-b text-xs font-medium text-muted-foreground">
            <span className="flex-1">Medicamento / Lote</span>
            <span className="w-20 text-center">Cantidad</span>
            <span className="w-12 text-right">Dif.</span>
            <span className="w-4" />
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-3">
            {activeItems.map((item) => (
              <ConteoBlindoRow key={item.id} item={item} onSave={handleRegistrarConteo} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Inventario Cíclico</h3>
          <p className="text-sm text-muted-foreground">Conteo ciego — el contador no ve el sistema</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuevo conteo
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!loading && conteos.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Sin conteos registrados. Inicia el primer conteo cíclico.</p>
        </div>
      )}

      <div className="space-y-2">
        {conteos.map((c) => {
          const badge = ESTATUS_BADGE[c.estatus];
          const isOpen = expanded === c.id;
          const citems = expandedItems[c.id] ?? [];
          const total = citems.length;
          const contadosN = citems.filter((i) => i.existencia_contada !== null).length;
          const difsN = citems.filter((i) => i.diferencia !== null && i.diferencia !== 0).length;

          return (
            <div key={c.id} className="rounded-lg border bg-card">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => toggleExpand(c.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{c.folio}</span>
                    <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                    <span className="text-xs text-muted-foreground capitalize">{c.tipo}</span>
                    {c.categoria_filtro && <span className="text-xs bg-muted px-1.5 rounded">{c.categoria_filtro}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(c.fecha_inicio), "dd MMM yyyy HH:mm", { locale: es })}
                    {c.fecha_cierre && ` → ${format(new Date(c.fecha_cierre), "dd MMM HH:mm", { locale: es })}`}
                  </div>
                </div>
                {isOpen && total > 0 && (
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <p>{contadosN}/{total} contados</p>
                    {difsN > 0 && <p className="text-yellow-600">{difsN} diferencias</p>}
                  </div>
                )}
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>

              {isOpen && (
                <div className="border-t px-3 pb-3 pt-2 space-y-2">
                  {c.estatus === "en_progreso" && (
                    <Button size="sm" onClick={async () => {
                      const realItems = await getItems(c.id);
                      setActiveConteoId(c.id);
                      setActiveItems(realItems);
                    }}>
                      Retomar conteo
                    </Button>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left pb-1">Medicamento</th>
                          <th className="text-left pb-1">Lote</th>
                          <th className="text-right pb-1">Sistema</th>
                          <th className="text-right pb-1">Contado</th>
                          <th className="text-right pb-1">Dif.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {citems.map((it) => (
                          <tr key={it.id} className={`border-b last:border-0 ${it.diferencia !== null && it.diferencia !== 0 ? "bg-yellow-50/40" : ""}`}>
                            <td className="py-0.5 pr-2">{it.medicamento_nombre}</td>
                            <td className="py-0.5 font-mono">{it.numero_lote || "—"}</td>
                            <td className="py-0.5 text-right">{it.existencia_sistema}</td>
                            <td className="py-0.5 text-right">{it.existencia_contada ?? "—"}</td>
                            <td className={`py-0.5 text-right font-semibold ${it.diferencia === 0 ? "text-green-600" : it.diferencia !== null ? "text-yellow-600" : ""}`}>
                              {it.diferencia !== null ? (it.diferencia > 0 ? `+${it.diferencia}` : it.diferencia) : "—"}
                            </td>
                          </tr>
                        ))}
                        {citems.length === 0 && <tr><td colSpan={5} className="py-2 text-center text-muted-foreground">Cargando…</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog: Nuevo conteo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Iniciar Conteo de Inventario</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Tipo de conteo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as Conteo["tipo"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ciclico">Cíclico (por categoría)</SelectItem>
                  <SelectItem value="completo">Completo (todo el inventario)</SelectItem>
                  <SelectItem value="aleatorio">Aleatorio</SelectItem>
                  <SelectItem value="turno">Apertura/cierre de turno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Filtrar por categoría (opcional)</Label>
              <Select value={form.categoriaFiltro} onValueChange={(v) => setForm((f) => ({ ...f, categoriaFiltro: v }))}>
                <SelectTrigger><SelectValue placeholder="Todos los productos" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{c === "" ? "Todos" : c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Observaciones…" />
            </div>
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
              <strong>Conteo ciego:</strong> El sistema cargará todos los productos con existencia pero <strong>no mostrará las cantidades del sistema</strong> al contador. Los ajustes requieren aprobación de supervisor.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={starting}>Cancelar</Button>
            <Button onClick={handleIniciar} disabled={starting}>
              {starting ? "Iniciando…" : "Iniciar conteo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
