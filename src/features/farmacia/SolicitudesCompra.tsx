import { useState, useCallback } from "react";
import { useComprasNav } from "@/context/ComprasNavContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSolicitudesCompra, SolicitudCompra, SCItem } from "@/hooks/useSolicitudesCompra";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/lib/toast";
import { Plus, ChevronDown, ChevronUp, ClipboardList, Check, X, Send, ShoppingCart, Trash2 } from "lucide-react";

interface Medicamento { id: string; nombre: string; unidad: string; }
interface Props { medicamentos: Medicamento[]; }

const ESTATUS_BADGE: Record<string, { label: string; color: string }> = {
  borrador:   { label: "Borrador",   color: "bg-muted text-muted-foreground border-0" },
  enviada:    { label: "Enviada",    color: "bg-blue-100 text-blue-700 border-0" },
  aprobada:   { label: "Aprobada",   color: "bg-green-100 text-green-700 border-0" },
  rechazada:  { label: "Rechazada",  color: "bg-red-100 text-red-700 border-0" },
  convertida: { label: "→ OC",       color: "bg-purple-100 text-purple-700 border-0" },
};

const fmtDate = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("es-MX");
const fmt$ = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

const EMPTY_LINEA = { medicamento_id: null as string | null, descripcion: "", cantidad: 1, unidad: "", precio_estimado: 0, justificacion: "" };

export default function SolicitudesCompra({ medicamentos }: Props) {
  const { activeClinicId } = useActiveClinic();
  const { hasRole } = useAuth();
  const { navigateTo } = useComprasNav();
  const { items, loading, error, paraAprobar, create, enviar, aprobar, rechazar, getItems, refresh } = useSolicitudesCompra(activeClinicId);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scItems, setScItems] = useState<Record<string, SCItem[]>>({});

  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ area_solicitante: "", fecha_requerida: "", motivo: "", notas: "" });
  const [lineas, setLineas] = useState([{ ...EMPTY_LINEA }]);
  const [saving, setSaving] = useState(false);

  const [rechazoOpen, setRechazoOpen] = useState(false);
  const [rechazoSc, setRechazoSc] = useState<SolicitudCompra | null>(null);
  const [rechazoMotivo, setRechazoMotivo] = useState("");

  const canApprove = hasRole("admin") || hasRole("manager");

  const toggleExpand = useCallback(async (sc: SolicitudCompra) => {
    if (expandedId === sc.id) { setExpandedId(null); return; }
    setExpandedId(sc.id);
    if (!scItems[sc.id]) {
      const its = await getItems(sc.id);
      setScItems((prev) => ({ ...prev, [sc.id]: its }));
    }
  }, [expandedId, scItems, getItems]);

  const addLinea = () => setLineas((p) => [...p, { ...EMPTY_LINEA }]);
  const removeLinea = (i: number) => setLineas((p) => p.filter((_, idx) => idx !== i));
  const updateLinea = (i: number, field: string, value: unknown) =>
    setLineas((p) => p.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const handleCreate = async () => {
    if (!form.motivo.trim()) { toast.error("El motivo es obligatorio"); return; }
    const validLineas = lineas.filter((l) => l.descripcion.trim() && l.cantidad > 0);
    if (validLineas.length === 0) { toast.error("Agrega al menos un ítem"); return; }
    setSaving(true);
    try {
      await create({ ...form, items: validLineas });
      toast.success("Solicitud de compra creada");
      setNewOpen(false);
      setForm({ area_solicitante: "", fecha_requerida: "", motivo: "", notas: "" });
      setLineas([{ ...EMPTY_LINEA }]);
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  const handleEnviar = async (sc: SolicitudCompra) => {
    try { await enviar(sc.id); toast.success("Solicitud enviada para aprobación"); }
    catch (e) { toast.error(String(e)); }
  };

  const handleAprobar = async (sc: SolicitudCompra) => {
    try { await aprobar(sc.id); toast.success("Solicitud aprobada"); }
    catch (e) { toast.error(String(e)); }
  };

  const handleRechazar = async () => {
    if (!rechazoSc) return;
    if (!rechazoMotivo.trim()) { toast.error("Motivo requerido"); return; }
    try {
      await rechazar(rechazoSc.id, rechazoMotivo);
      toast.success("Solicitud rechazada");
      setRechazoOpen(false); setRechazoMotivo("");
    } catch (e) { toast.error(String(e)); }
  };

  const handleConvertirOC = async (sc: SolicitudCompra) => {
    const its = scItems[sc.id] ?? await getItems(sc.id);
    setScItems((prev) => ({ ...prev, [sc.id]: its }));
    navigateTo("oc", { solicitud_id: sc.id, solicitud_folio: sc.folio });
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground text-sm">Cargando solicitudes…</div>;
  if (error) return <div className="py-12 text-center text-destructive text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Solicitudes de Compra
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Requisición interna → Aprobación → OC · {paraAprobar.length} pendiente(s) de aprobación
          </p>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nueva solicitud
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <ClipboardList className="h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Sin solicitudes de compra</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((sc) => {
            const badge = ESTATUS_BADGE[sc.estatus] ?? ESTATUS_BADGE.borrador;
            const expanded = expandedId === sc.id;
            const its = scItems[sc.id] ?? [];
            const totalEst = its.reduce((s, i) => s + (i.precio_estimado ?? 0) * i.cantidad, 0);

            return (
              <div key={sc.id} className="rounded-xl border border-border/60 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(sc)}
                >
                  <div className="flex items-center gap-3 text-left">
                    <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{sc.folio} — {sc.motivo.slice(0, 60)}{sc.motivo.length > 60 ? "…" : ""}</p>
                      <p className="text-xs text-muted-foreground">
                        {sc.solicitante_nombre ?? "—"} · {sc.area_solicitante ?? "—"} · {fmtDate(sc.fecha_solicitud)}
                        {sc.fecha_requerida ? ` · Req. ${fmtDate(sc.fecha_requerida)}` : ""}
                      </p>
                    </div>
                    <Badge className={`text-xs ${badge.color}`}>{badge.label}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    {totalEst > 0 && <span className="text-xs text-muted-foreground">{fmt$(totalEst)} est.</span>}
                    {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border/40 px-4 py-3 space-y-3 bg-muted/10">
                    <div className="flex gap-2 flex-wrap">
                      {sc.estatus === "borrador" && (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleEnviar(sc)}>
                          <Send className="h-3.5 w-3.5" /> Enviar para aprobación
                        </Button>
                      )}
                      {sc.estatus === "enviada" && canApprove && (
                        <>
                          <Button size="sm" className="gap-1.5 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleAprobar(sc)}>
                            <Check className="h-3.5 w-3.5" /> Aprobar
                          </Button>
                          <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={() => { setRechazoSc(sc); setRechazoOpen(true); }}>
                            <X className="h-3.5 w-3.5" /> Rechazar
                          </Button>
                        </>
                      )}
                      {sc.estatus === "aprobada" && (
                        <>
                          <Button
                            size="sm"
                            className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => navigateTo("cotizaciones", { solicitud_id: sc.id, solicitud_folio: sc.folio })}
                          >
                            <ShoppingCart className="h-3.5 w-3.5" /> Cotizar →
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleConvertirOC(sc)}>
                            <ShoppingCart className="h-3.5 w-3.5" /> Convertir a OC
                          </Button>
                        </>
                      )}
                      {sc.rechazo_motivo && (
                        <span className="text-xs text-destructive">Motivo rechazo: {sc.rechazo_motivo}</span>
                      )}
                    </div>

                    {its.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/30 text-muted-foreground">
                              <th className="px-3 py-2 text-left font-medium">Descripción</th>
                              <th className="px-3 py-2 text-center font-medium">Cant.</th>
                              <th className="px-3 py-2 text-left font-medium">Unidad</th>
                              <th className="px-3 py-2 text-right font-medium">P. est.</th>
                              <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                              <th className="px-3 py-2 text-left font-medium">Justificación</th>
                            </tr>
                          </thead>
                          <tbody>
                            {its.map((it) => (
                              <tr key={it.id} className="border-b border-border/40 hover:bg-muted/20">
                                <td className="px-3 py-1.5 font-medium">{it.descripcion}</td>
                                <td className="px-3 py-1.5 text-center">{it.cantidad}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">{it.unidad ?? "—"}</td>
                                <td className="px-3 py-1.5 text-right">{it.precio_estimado ? fmt$(it.precio_estimado) : "—"}</td>
                                <td className="px-3 py-1.5 text-right font-medium">{it.precio_estimado ? fmt$(it.precio_estimado * it.cantidad) : "—"}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">{it.justificacion ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog: Nueva solicitud */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nueva Solicitud de Compra</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Área solicitante</Label>
                <Input value={form.area_solicitante} onChange={(e) => setForm((p) => ({ ...p, area_solicitante: e.target.value }))} placeholder="Farmacia, Consultorios, Enfermería…" />
              </div>
              <div className="space-y-1">
                <Label>Fecha requerida</Label>
                <Input type="date" value={form.fecha_requerida} onChange={(e) => setForm((p) => ({ ...p, fecha_requerida: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Motivo / Justificación *</Label>
              <Textarea value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} rows={2} placeholder="¿Por qué se necesitan estos artículos?" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ítems solicitados *</Label>
                <Button type="button" size="sm" variant="outline" onClick={addLinea} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Agregar ítem
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {lineas.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_60px_80px_80px_32px] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Descripción *</Label>
                      <Input
                        value={l.descripcion}
                        onChange={(e) => updateLinea(i, "descripcion", e.target.value)}
                        placeholder="Nombre del producto…"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cant.</Label>
                      <Input
                        type="number" min={1} value={l.cantidad}
                        onChange={(e) => updateLinea(i, "cantidad", parseInt(e.target.value) || 1)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unidad</Label>
                      <Input value={l.unidad} onChange={(e) => updateLinea(i, "unidad", e.target.value)} className="h-8 text-xs" placeholder="pza, cja…" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">P. est. $</Label>
                      <Input
                        type="number" min={0} value={l.precio_estimado || ""}
                        onChange={(e) => updateLinea(i, "precio_estimado", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 mt-5" onClick={() => removeLinea(i)} disabled={lineas.length === 1}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notas adicionales</Label>
              <Input value={form.notas} onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Creando…" : "Crear solicitud"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rechazo */}
      <Dialog open={rechazoOpen} onOpenChange={setRechazoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rechazar solicitud {rechazoSc?.folio}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <Label>Motivo del rechazo *</Label>
            <Textarea value={rechazoMotivo} onChange={(e) => setRechazoMotivo(e.target.value)} rows={3} placeholder="Explica el motivo del rechazo…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazoOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRechazar}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
