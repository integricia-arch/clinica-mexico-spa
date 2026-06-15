import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDevolucionesProveedor, type DevolucionItemInput, type DevMotivo } from "@/hooks/useDevolucionesProveedor";
import { useRecepcionesMercancia } from "@/hooks/useRecepcionesMercancia";
import { useProveedores } from "@/hooks/useProveedores";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Plus, ChevronDown, ChevronUp, Undo2, CheckCircle2,
  XCircle, ReceiptText, AlertTriangle, Loader2, Trash2,
} from "lucide-react";

const fmtMXN = (c: number) => (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const MOTIVOS: { value: DevMotivo; label: string }[] = [
  { value: "producto_danado",    label: "Producto dañado" },
  { value: "producto_incorrecto",label: "Producto incorrecto" },
  { value: "caducidad_proxima",  label: "Caducidad próxima" },
  { value: "exceso_pedido",      label: "Exceso en pedido" },
  { value: "precio_incorrecto",  label: "Precio incorrecto" },
  { value: "otro",               label: "Otro" },
];

const ESTATUS_UI: Record<string, { label: string; cls: string }> = {
  borrador:            { label: "Borrador",          cls: "bg-muted text-muted-foreground" },
  enviada:             { label: "Enviada",            cls: "bg-blue-100 text-blue-700" },
  aceptada:            { label: "Aceptada",           cls: "bg-green-100 text-green-700" },
  rechazada:           { label: "Rechazada",          cls: "bg-red-100 text-red-700" },
  nota_credito_emitida:{ label: "Nota crédito ✓",    cls: "bg-purple-100 text-purple-700" },
};

interface LineaItem {
  medicamento_id: string;
  medicamento_nombre: string;
  lote_id: string | null;
  numero_lote: string;
  cantidad_disponible: number;
  cantidad_devuelta: number;
  precio_unitario_centavos: number;
  motivo_item: string;
}

const EMPTY_FORM = {
  proveedor_id: "",
  recepcion_id: "",
  motivo: "producto_danado" as DevMotivo,
  fecha_devolucion: new Date().toISOString().split("T")[0],
  notas: "",
};

const EMPTY_NC = {
  folio: "", monto_str: "", fecha: new Date().toISOString().split("T")[0],
};

export default function DevolucionesProveedor() {
  const { activeClinicId } = useActiveClinic();
  const { items, loading, error, create, enviar, actualizarEstatus, registrarNotaCredito, getItems, refresh } =
    useDevolucionesProveedor(activeClinicId);
  const { items: recepciones, getItems: getRecItems } = useRecepcionesMercancia(activeClinicId);
  const { items: proveedores } = useProveedores(activeClinicId);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, LineaItem[]>>({});
  const [saving, setSaving] = useState(false);

  // New devolucion dialog
  const [devDialog, setDevDialog] = useState(false);
  const [devForm, setDevForm] = useState(EMPTY_FORM);
  const [lineas, setLineas] = useState<LineaItem[]>([]);
  const [loadingRec, setLoadingRec] = useState(false);

  // Nota crédito dialog
  const [ncDialog, setNcDialog] = useState<string | null>(null);
  const [ncForm, setNcForm] = useState(EMPTY_NC);

  const toggleExpand = useCallback(async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!expandedItems[id]) {
      try {
        const its = await getItems(id);
        setExpandedItems((prev) => ({
          ...prev,
          [id]: its.map((i) => ({
            medicamento_id: i.medicamento_id,
            medicamento_nombre: i.medicamento_nombre ?? "",
            lote_id: i.lote_id,
            numero_lote: i.numero_lote ?? "",
            cantidad_disponible: i.cantidad_devuelta,
            cantidad_devuelta: i.cantidad_devuelta,
            precio_unitario_centavos: i.precio_unitario_centavos,
            motivo_item: i.motivo_item ?? "",
          })),
        }));
      } catch { /* non-critical */ }
    }
  }, [expanded, expandedItems, getItems]);

  const handleSelectRecepcion = async (recId: string) => {
    setDevForm((f) => ({ ...f, recepcion_id: recId }));
    if (!recId) { setLineas([]); return; }
    setLoadingRec(true);
    try {
      const rec = recepciones.find((r) => r.id === recId);
      if (rec) setDevForm((f) => ({ ...f, proveedor_id: rec.proveedor_id }));
      const its = await getRecItems(recId);
      setLineas(its.map((i) => ({
        medicamento_id: i.medicamento_id,
        medicamento_nombre: i.medicamento_nombre ?? "",
        lote_id: i.lote_id,
        numero_lote: i.numero_lote,
        cantidad_disponible: i.cantidad_recibida,
        cantidad_devuelta: 0,
        precio_unitario_centavos: i.precio_unitario_centavos,
        motivo_item: "",
      })));
    } finally {
      setLoadingRec(false);
    }
  };

  const handleCreate = async () => {
    if (!devForm.proveedor_id) { toast.error("Selecciona un proveedor"); return; }
    const itemsValidos: DevolucionItemInput[] = lineas
      .filter((l) => l.cantidad_devuelta > 0)
      .map((l) => ({
        medicamento_id: l.medicamento_id,
        lote_id: l.lote_id,
        cantidad_devuelta: l.cantidad_devuelta,
        precio_unitario_centavos: l.precio_unitario_centavos,
        motivo_item: l.motivo_item,
      }));
    if (itemsValidos.length === 0) { toast.error("Agrega al menos un ítem con cantidad > 0"); return; }

    setSaving(true);
    try {
      await create({
        proveedor_id: devForm.proveedor_id,
        recepcion_id: devForm.recepcion_id || null,
        orden_id: null,
        motivo: devForm.motivo,
        fecha_devolucion: devForm.fecha_devolucion,
        notas: devForm.notas,
        items: itemsValidos,
      });
      toast.success("Devolución creada en borrador");
      setDevDialog(false);
      setDevForm(EMPTY_FORM);
      setLineas([]);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleEnviar = async (id: string) => {
    setSaving(true);
    try {
      await enviar(id);
      setExpandedItems((prev) => { const { [id]: _, ...rest } = prev; return rest; });
      toast.success("Devolución enviada — inventario actualizado");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleEstatus = async (id: string, est: "aceptada" | "rechazada") => {
    setSaving(true);
    try {
      await actualizarEstatus(id, est);
      toast.success(est === "aceptada" ? "Devolución aceptada por proveedor" : "Devolución rechazada");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleNC = async () => {
    if (!ncDialog) return;
    const monto = Math.round(Number(ncForm.monto_str) * 100);
    if (!monto) { toast.error("Ingresa el monto de la nota de crédito"); return; }
    setSaving(true);
    try {
      await registrarNotaCredito(ncDialog, ncForm.folio, monto, ncForm.fecha);
      toast.success("Nota de crédito registrada");
      setNcDialog(null);
      setNcForm(EMPTY_NC);
      setExpandedItems((prev) => { const { [ncDialog]: _, ...rest } = prev; return rest; });
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Devoluciones a Proveedor</h3>
          <p className="text-sm text-muted-foreground">
            {items.length} registro(s) — {items.filter((d) => d.estatus === "borrador").length} borrador(es) pendientes
          </p>
        </div>
        <Button size="sm" onClick={() => { setDevDialog(true); setDevForm(EMPTY_FORM); setLineas([]); }}>
          <Plus className="h-4 w-4 mr-1" /> Nueva devolución
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!loading && items.length === 0 && (
        <div className="text-center py-14 text-muted-foreground">
          <Undo2 className="mx-auto h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">Sin devoluciones registradas</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((d) => {
          const ui = ESTATUS_UI[d.estatus] ?? ESTATUS_UI.borrador;
          const isOpen = expanded === d.id;
          const totalItems = expandedItems[d.id]?.reduce((s, i) => s + i.cantidad_devuelta * i.precio_unitario_centavos, 0) ?? null;
          return (
            <div key={d.id} className="rounded-lg border bg-card">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => toggleExpand(d.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{d.folio}</span>
                    <Badge className={`${ui.cls} border-0 text-xs`}>{ui.label}</Badge>
                    <span className="text-xs text-muted-foreground">{d.proveedor_nombre}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {MOTIVOS.find((m) => m.value === d.motivo)?.label ?? d.motivo}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(d.fecha_devolucion), "dd MMM yyyy", { locale: es })}
                    {d.recepcion_id && ` · Rec. vinculada`}
                  </p>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>

              {isOpen && (
                <div className="border-t px-3 pb-3 pt-2 space-y-3">
                  {/* Items table */}
                  {expandedItems[d.id] && expandedItems[d.id].length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Productos devueltos</p>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-1 pr-2">Producto</th>
                            <th className="text-left py-1 px-2">Lote</th>
                            <th className="text-right py-1 px-2">Qty</th>
                            <th className="text-right py-1 px-2">Precio</th>
                            <th className="text-right py-1 pl-2">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expandedItems[d.id].map((it, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-1 pr-2">{it.medicamento_nombre}</td>
                              <td className="py-1 px-2 font-mono text-muted-foreground">{it.numero_lote || "—"}</td>
                              <td className="py-1 px-2 text-right">{it.cantidad_devuelta}</td>
                              <td className="py-1 px-2 text-right font-mono">{fmtMXN(it.precio_unitario_centavos)}</td>
                              <td className="py-1 pl-2 text-right font-medium">{fmtMXN(it.cantidad_devuelta * it.precio_unitario_centavos)}</td>
                            </tr>
                          ))}
                          {totalItems !== null && (
                            <tr className="font-semibold border-t">
                              <td colSpan={4} className="py-1 pr-2 text-right text-muted-foreground">Total</td>
                              <td className="py-1 pl-2 text-right">{fmtMXN(totalItems)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Nota crédito info */}
                  {d.nota_credito_folio && (
                    <div className="rounded-md bg-purple-50 border border-purple-200 p-2 text-xs flex items-center gap-2">
                      <ReceiptText className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      <span>
                        Nota de crédito <strong>{d.nota_credito_folio}</strong>
                        {d.nota_credito_monto_centavos ? ` — ${fmtMXN(d.nota_credito_monto_centavos)}` : ""}
                        {d.nota_credito_fecha ? ` — ${format(new Date(d.nota_credito_fecha), "dd/MM/yyyy")}` : ""}
                      </span>
                    </div>
                  )}

                  {d.notas && (
                    <p className="text-xs text-muted-foreground italic">{d.notas}</p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {d.estatus === "borrador" && (
                      <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => handleEnviar(d.id)} disabled={saving}>
                        <Undo2 className="h-3.5 w-3.5" />
                        Enviar a proveedor
                      </Button>
                    )}
                    {d.estatus === "enviada" && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-200" onClick={() => handleEstatus(d.id, "aceptada")} disabled={saving}>
                          <CheckCircle2 className="h-3.5 w-3.5" />Aceptada
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-700 border-red-200" onClick={() => handleEstatus(d.id, "rechazada")} disabled={saving}>
                          <XCircle className="h-3.5 w-3.5" />Rechazada
                        </Button>
                      </>
                    )}
                    {(d.estatus === "aceptada") && !d.nota_credito_folio && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-purple-700 border-purple-200" onClick={() => { setNcDialog(d.id); setNcForm(EMPTY_NC); }} disabled={saving}>
                        <ReceiptText className="h-3.5 w-3.5" />Registrar nota de crédito
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog: Nueva devolución */}
      <Dialog open={devDialog} onOpenChange={setDevDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nueva Devolución a Proveedor</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Recepción de referencia</Label>
                <Select value={devForm.recepcion_id} onValueChange={handleSelectRecepcion}>
                  <SelectTrigger><SelectValue placeholder="Opcional — pre-llena ítems" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sin_recepcion">Sin recepción vinculada</SelectItem>
                    {recepciones.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.folio_recepcion} — {r.proveedor_nombre} ({format(new Date(r.fecha_recepcion), "dd/MM/yy")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Proveedor *</Label>
                <Select value={devForm.proveedor_id} onValueChange={(v) => setDevForm((f) => ({ ...f, proveedor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                  <SelectContent>
                    {proveedores.filter((p) => p.activo).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Motivo principal *</Label>
                <Select value={devForm.motivo} onValueChange={(v) => setDevForm((f) => ({ ...f, motivo: v as DevMotivo }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fecha de devolución</Label>
                <Input type="date" value={devForm.fecha_devolucion} onChange={(e) => setDevForm((f) => ({ ...f, fecha_devolucion: e.target.value }))} />
              </div>
            </div>

            {/* Ítems */}
            <div className="space-y-2">
              <Label>Productos a devolver</Label>
              {loadingRec && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando ítems de recepción…
                </div>
              )}
              {lineas.length > 0 ? (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30 text-muted-foreground">
                        <th className="text-left px-3 py-2">Producto</th>
                        <th className="text-left px-3 py-2">Lote</th>
                        <th className="text-center px-3 py-2">Disponible</th>
                        <th className="text-center px-3 py-2 w-24">A devolver</th>
                        <th className="px-2 py-2 w-6" />
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((l, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-1.5">{l.medicamento_nombre}</td>
                          <td className="px-3 py-1.5 font-mono text-muted-foreground">{l.numero_lote || "—"}</td>
                          <td className="px-3 py-1.5 text-center">{l.cantidad_disponible}</td>
                          <td className="px-3 py-1.5">
                            <Input
                              type="number" min={0} max={l.cantidad_disponible}
                              className="h-6 text-center text-xs"
                              value={l.cantidad_devuelta}
                              onChange={(e) => {
                                const qty = Math.min(Math.max(0, parseInt(e.target.value) || 0), l.cantidad_disponible);
                                setLineas((prev) => prev.map((x, j) => j === i ? { ...x, cantidad_devuelta: qty } : x));
                              }}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <button onClick={() => setLineas((prev) => prev.filter((_, j) => j !== i))}>
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  <AlertTriangle className="mx-auto h-5 w-5 mb-1 opacity-30" />
                  Selecciona una recepción para pre-cargar ítems, o agrega manualmente.
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea rows={2} value={devForm.notas} onChange={(e) => setDevForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Descripción del defecto, número de remisión, acuerdo con proveedor…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDevDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {saving ? "Guardando…" : "Crear devolución"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nota de crédito */}
      <Dialog open={!!ncDialog} onOpenChange={(o) => { if (!o) setNcDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Nota de Crédito</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Folio nota de crédito</Label>
              <Input value={ncForm.folio} onChange={(e) => setNcForm((f) => ({ ...f, folio: e.target.value }))} placeholder="NC-001" />
            </div>
            <div className="space-y-1">
              <Label>Monto (MXN) *</Label>
              <Input type="number" min={0} step={0.01} value={ncForm.monto_str} onChange={(e) => setNcForm((f) => ({ ...f, monto_str: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Fecha de la nota</Label>
              <Input type="date" value={ncForm.fecha} onChange={(e) => setNcForm((f) => ({ ...f, fecha: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNcDialog(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleNC} disabled={saving}>
              {saving ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
