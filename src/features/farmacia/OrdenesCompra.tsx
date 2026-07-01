import { useState, useEffect, useCallback, useRef } from "react";
import { useComprasNav } from "@/context/ComprasNavContext";
import { untypedTable } from "@/lib/untypedTable";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useAuth } from "@/hooks/useAuth";
import { useProveedores } from "@/hooks/useProveedores";
import { useOrdenesCompra, type OrdenCompra, type OrdenCompraItem, type OrdenCompraItemInput } from "@/hooks/useOrdenesCompra";
import { useSolicitudesCompra } from "@/hooks/useSolicitudesCompra";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, ChevronDown, ChevronUp, ShoppingCart, CheckCircle, XCircle, Trash2, PackageOpen } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const formatMXN = (centavos: number) =>
  (centavos / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const ESTATUS_BADGE: Record<OrdenCompra["estatus"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  borrador:              { label: "Borrador",             variant: "secondary" },
  pendiente_aprobacion:  { label: "Pend. aprobación",    variant: "outline" },
  confirmada:            { label: "Confirmada",           variant: "default" },
  parcial:               { label: "Parcial",              variant: "outline" },
  recibida:              { label: "Recibida",             variant: "default" },
  cancelada:             { label: "Cancelada",            variant: "destructive" },
  rechazada:             { label: "Rechazada",            variant: "destructive" },
};

interface MedicamentoOption {
  id: string;
  nombre: string;
  tasa_iva: number;
}

const EMPTY_ITEM: OrdenCompraItemInput & { _key: number } = {
  _key: 0, medicamento_id: "", cantidad_pedida: 1, precio_unitario_centavos: 0, tasa_iva: 0,
};

export default function OrdenesCompra() {
  const { activeClinicId } = useActiveClinic();
  const { toast } = useToast();
  const { items: proveedores } = useProveedores(activeClinicId);
  const { hasRole } = useAuth();
  const { ctx, navigateTo, clearCtx } = useComprasNav();
  const isManager = hasRole("admin") || hasRole("manager");
  const { items: ordenes, loading, error, create, confirmar, aprobar, rechazar, cancelar, getItems, refresh } = useOrdenesCompra(activeClinicId);
  const { marcarConvertida } = useSolicitudesCompra(activeClinicId);
  const [rechazarDialog, setRechazarDialog] = useState<string | null>(null);
  const [rechazarMotivo, setRechazarMotivo] = useState("");
  const [pendingSolicitudId, setPendingSolicitudId] = useState<string | null>(null);

  const [medicamentos, setMedicamentos] = useState<MedicamentoOption[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, OrdenCompraItem[]>>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    proveedor_id: "",
    fecha_entrega_est: "",
    terminos_pago: 30,
    notas: "",
    requiere_anticipo: false,
  });
  const ctxApplied = useRef(false);

  // Pre-fill proveedor from cotizacion context
  useEffect(() => {
    if (!ctx.cotizacion_id || ctxApplied.current) return;
    ctxApplied.current = true;
    untypedTable("cotizaciones")
      .select("proveedor_id")
      .eq("id", ctx.cotizacion_id)
      .single()
      .then(({ data, error }) => {
        if (error) return; // keep context on fetch failure so user can retry
        const d = data as { proveedor_id: string } | null;
        if (d?.proveedor_id) {
          setForm((f) => ({ ...f, proveedor_id: d.proveedor_id }));
          setDialogOpen(true);
          clearCtx();
        }
      })
      .catch(() => { /* network failure — context preserved, user can retry */ });
  }, [ctx.cotizacion_id, clearCtx]);
  const [lineItems, setLineItems] = useState<(OrdenCompraItemInput & { _key: number })[]>([
    { ...EMPTY_ITEM, _key: Date.now() },
  ]);

  // Pre-fill líneas desde solicitud de compra (SC → OC directo, sin cotización)
  const ctxScApplied = useRef(false);
  useEffect(() => {
    if (!ctx.solicitud_id || ctxScApplied.current || medicamentos.length === 0) return;
    ctxScApplied.current = true;
    const scId = ctx.solicitud_id;
    untypedTable("solicitudes_compra_items")
      .select("*")
      .eq("solicitud_id", scId)
      .then(({ data, error }) => {
        if (error) return; // keep context on fetch failure so user can retry
        const its = (data ?? []) as { medicamento_id: string | null; cantidad: number; precio_estimado: number | null }[];
        const mapped = its
          .filter((it) => it.medicamento_id)
          .map((it, i) => {
            const med = medicamentos.find((m) => m.id === it.medicamento_id);
            return {
              _key: Date.now() + i,
              medicamento_id: it.medicamento_id as string,
              cantidad_pedida: it.cantidad,
              precio_unitario_centavos: Math.round((it.precio_estimado ?? 0) * 100),
              tasa_iva: med?.tasa_iva ?? 0,
            };
          });
        if (mapped.length) setLineItems(mapped);
        setPendingSolicitudId(scId);
        setDialogOpen(true);
        clearCtx();
      })
      .catch(() => { /* network failure — context preserved, user can retry */ });
  }, [ctx.solicitud_id, clearCtx, medicamentos]);

  useEffect(() => {
    if (!activeClinicId) return;
    supabase
      .from("medicamentos" as never)
      .select("id, nombre_generico, tasa_iva")
      .eq("clinic_id", activeClinicId)
      .eq("activo", true)
      .order("nombre_generico")
      .then(({ data }) => {
        setMedicamentos(
          ((data ?? []) as { id: string; nombre_generico: string; tasa_iva: number }[])
            .map((m) => ({ id: m.id, nombre: m.nombre_generico, tasa_iva: m.tasa_iva ?? 0 }))
        );
      });
  }, [activeClinicId]);

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

  const addLine = () =>
    setLineItems((prev) => [...prev, { ...EMPTY_ITEM, _key: Date.now() }]);

  const removeLine = (key: number) =>
    setLineItems((prev) => prev.filter((l) => l._key !== key));

  const updateLine = (key: number, field: keyof OrdenCompraItemInput, value: string | number) =>
    setLineItems((prev) =>
      prev.map((l) => {
        if (l._key !== key) return l;
        const updated = { ...l, [field]: value };
        if (field === "medicamento_id") {
          const med = medicamentos.find((m) => m.id === value);
          updated.tasa_iva = med?.tasa_iva ?? 0;
        }
        return updated;
      })
    );

  const subtotalLinea = (l: OrdenCompraItemInput) =>
    l.cantidad_pedida * l.precio_unitario_centavos;

  const totales = lineItems.reduce(
    (acc, l) => {
      const sub = subtotalLinea(l);
      return {
        subtotal: acc.subtotal + sub,
        iva: acc.iva + Math.round(sub * l.tasa_iva),
      };
    },
    { subtotal: 0, iva: 0 }
  );

  const handleSubmit = async () => {
    if (!form.proveedor_id) {
      toast({ title: "Selecciona un proveedor", variant: "destructive" });
      return;
    }
    const validLines = lineItems.filter((l) => l.medicamento_id && l.cantidad_pedida > 0);
    if (!validLines.length) {
      toast({ title: "Agrega al menos un producto", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const ocId = await create({ ...form, items: validLines });
      if (pendingSolicitudId) {
        await marcarConvertida(pendingSolicitudId, ocId);
        setPendingSolicitudId(null);
      }
      toast({ title: "Orden de compra creada" });
      setDialogOpen(false);
      setForm({ proveedor_id: "", fecha_entrega_est: "", terminos_pago: 30, notas: "", requiere_anticipo: false });
      setLineItems([{ ...EMPTY_ITEM, _key: Date.now() }]);
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmar = async (id: string) => {
    try {
      await confirmar(id);
      toast({ title: "Orden confirmada y enviada al proveedor" });
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    }
  };

  const handleAprobar = async (id: string) => {
    try {
      await aprobar(id);
      toast({ title: "Orden aprobada y confirmada" });
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    }
  };

  const handleRechazar = async () => {
    if (!rechazarDialog) return;
    try {
      await rechazar(rechazarDialog, rechazarMotivo);
      toast({ title: "Orden rechazada" });
      setRechazarDialog(null);
      setRechazarMotivo("");
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    }
  };

  const handleCancelar = async (id: string) => {
    try {
      await cancelar(id);
      toast({ title: "Orden cancelada" });
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Órdenes de Compra</h3>
          <p className="text-sm text-muted-foreground">{ordenes.length} órdenes · 3-Way Matching activo</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nueva OC
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!loading && ordenes.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Sin órdenes de compra. Crea la primera para comenzar.</p>
        </div>
      )}

      <div className="space-y-2">
        {ordenes.map((oc) => {
          const badge = ESTATUS_BADGE[oc.estatus];
          const isOpen = expanded === oc.id;
          return (
            <div key={oc.id} className="rounded-lg border bg-card">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => toggleExpand(oc.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{oc.folio}</span>
                    <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                    <span className="text-xs text-muted-foreground">{oc.proveedor_nombre}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(oc.fecha_emision), "dd MMM yyyy", { locale: es })}
                    {oc.fecha_entrega_est && ` · Entrega est: ${format(new Date(oc.fecha_entrega_est), "dd MMM", { locale: es })}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatMXN(oc.total_centavos)}</p>
                  <p className="text-xs text-muted-foreground">IVA {formatMXN(oc.iva_centavos)}</p>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>

              {isOpen && (
                <div className="border-t px-3 pb-3 pt-2 space-y-3">
                  {/* Alerta pendiente aprobación */}
                  {oc.estatus === "pendiente_aprobacion" && (
                    <div className="flex items-start gap-2 rounded-md bg-yellow-50 border border-yellow-200 p-2 text-xs text-yellow-800">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>OC supera el umbral de aprobación. Requiere firma de manager o admin antes de enviarse.</span>
                    </div>
                  )}
                  {/* Acciones */}
                  <div className="flex gap-2 flex-wrap">
                    {oc.estatus === "borrador" && (
                      <Button size="sm" onClick={() => handleConfirmar(oc.id)}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Confirmar y enviar
                      </Button>
                    )}
                    {oc.estatus === "pendiente_aprobacion" && isManager && (
                      <>
                        <Button size="sm" onClick={() => handleAprobar(oc.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Aprobar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { setRechazarDialog(oc.id); setRechazarMotivo(""); }}>
                          <XCircle className="h-4 w-4 mr-1" /> Rechazar
                        </Button>
                      </>
                    )}
                    {(oc.estatus === "confirmada" || oc.estatus === "parcial") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-500 text-green-700 hover:bg-green-50"
                        onClick={() => navigateTo("recepcion", { orden_id: oc.id, orden_folio: oc.folio })}
                      >
                        <PackageOpen className="h-4 w-4 mr-1" /> Registrar recepción →
                      </Button>
                    )}
                    {(oc.estatus === "borrador" || oc.estatus === "confirmada") && (
                      <Button size="sm" variant="outline" onClick={() => handleCancelar(oc.id)}>
                        <XCircle className="h-4 w-4 mr-1" /> Cancelar
                      </Button>
                    )}
                  </div>

                  {/* Items */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b">
                          <th className="text-left pb-1">Producto</th>
                          <th className="text-right pb-1">Pedido</th>
                          <th className="text-right pb-1">Recibido</th>
                          <th className="text-right pb-1">P. Unit.</th>
                          <th className="text-right pb-1">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(expandedItems[oc.id] ?? []).map((item) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="py-1 pr-2">{item.medicamento_nombre ?? item.medicamento_id}</td>
                            <td className="py-1 text-right">{item.cantidad_pedida}</td>
                            <td className="py-1 text-right">
                              <span className={item.cantidad_recibida >= item.cantidad_pedida ? "text-green-600" : "text-muted-foreground"}>
                                {item.cantidad_recibida}
                              </span>
                            </td>
                            <td className="py-1 text-right">{formatMXN(item.precio_unitario_centavos)}</td>
                            <td className="py-1 text-right">{formatMXN(item.subtotal_centavos)}</td>
                          </tr>
                        ))}
                        {!expandedItems[oc.id] && (
                          <tr><td colSpan={5} className="py-2 text-center text-muted-foreground text-xs">Cargando productos…</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {oc.notas && <p className="text-xs text-muted-foreground italic">Nota: {oc.notas}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog: Nueva OC */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setPendingSolicitudId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nueva Orden de Compra</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Proveedor *</Label>
                <Select value={form.proveedor_id} onValueChange={(v) => setForm((f) => ({ ...f, proveedor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                  <SelectContent>
                    {proveedores.filter((p) => p.activo).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Entrega estimada</Label>
                <Input type="date" value={form.fecha_entrega_est} onChange={(e) => setForm((f) => ({ ...f, fecha_entrega_est: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Términos de pago (días)</Label>
                <Select value={String(form.terminos_pago)} onValueChange={(v) => setForm((f) => ({ ...f, terminos_pago: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0,8,15,30,45,60].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d === 0 ? "Contado" : `${d} días`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Notas</Label>
                <Input value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Instrucciones especiales…" />
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <input
                  type="checkbox"
                  id="requiere_anticipo"
                  checked={form.requiere_anticipo}
                  onChange={(e) => setForm((f) => ({ ...f, requiere_anticipo: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                <Label htmlFor="requiere_anticipo" className="text-sm cursor-pointer font-normal">
                  Requiere anticipo — permite pago antes de recibir mercancía
                </Label>
              </div>
            </div>

            {/* Líneas de producto */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Productos</Label>
                <Button type="button" size="sm" variant="outline" onClick={addLine}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {lineItems.map((l) => (
                  <div key={l._key} className="grid grid-cols-[1fr_80px_120px_32px] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Medicamento</Label>
                      <Select value={l.medicamento_id} onValueChange={(v) => updateLine(l._key, "medicamento_id", v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                        <SelectContent>
                          {medicamentos.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Cant.</Label>
                      <Input
                        type="number" min={1} className="h-8 text-sm"
                        value={l.cantidad_pedida}
                        onChange={(e) => updateLine(l._key, "cantidad_pedida", Math.max(1, Number(e.target.value)))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Precio unit. (MXN)</Label>
                      <Input
                        type="number" min={0} step={0.01} className="h-8 text-sm"
                        value={(l.precio_unitario_centavos / 100).toFixed(2)}
                        onChange={(e) => updateLine(l._key, "precio_unitario_centavos", Math.round(Number(e.target.value) * 100))}
                      />
                    </div>
                    <Button
                      type="button" size="sm" variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeLine(l._key)}
                      disabled={lineItems.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Totales */}
              <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm space-y-1 text-right">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMXN(totales.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">IVA</span><span>{formatMXN(totales.iva)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Total</span><span>{formatMXN(totales.subtotal + totales.iva)}</span></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setPendingSolicitudId(null); }} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando…" : "Crear orden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rechazar OC */}
      <Dialog open={!!rechazarDialog} onOpenChange={(o) => { if (!o) setRechazarDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rechazar Orden de Compra</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">La OC quedará marcada como rechazada. Indica el motivo:</p>
            <div className="space-y-1">
              <Label>Motivo del rechazo</Label>
              <Input
                value={rechazarMotivo}
                onChange={(e) => setRechazarMotivo(e.target.value)}
                placeholder="Ej: Monto excede presupuesto del mes…"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazarDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRechazar}>Rechazar OC</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
