import { useState, useEffect, useCallback, useRef } from "react";
import { useComprasNav } from "@/features/compras/ComprasNavContext";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useProveedores } from "@/hooks/useProveedores";
import { useOrdenesCompra } from "@/hooks/useOrdenesCompra";
import { useRecepcionesMercancia, type RecepcionItem } from "@/hooks/useRecepcionesMercancia";
import { useFacturasProveedor } from "@/hooks/useFacturasProveedor";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ChevronDown, ChevronUp, CheckCircle, PackageOpen, AlertTriangle, Upload } from "lucide-react";
import CfdiUploadPanel from "./CfdiUploadPanel";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Recepcion } from "@/hooks/useRecepcionesMercancia";
import type { OrdenCompraItem } from "@/hooks/useOrdenesCompra";

const formatMXN = (centavos: number) =>
  (centavos / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const ESTATUS_BADGE: Record<Recepcion["estatus"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendiente:        { label: "Pendiente",        variant: "secondary" },
  verificada:       { label: "Verificada",       variant: "default" },
  con_diferencias:  { label: "Con diferencias",  variant: "outline" },
  rechazada:        { label: "Rechazada",        variant: "destructive" },
};

interface MedicamentoOption {
  id: string;
  nombre: string;
  tasa_iva: number;
}

const EMPTY_ITEM: RecepcionItem = {
  orden_item_id: null, medicamento_id: "", lote_id: null,
  cantidad_recibida: 1, numero_lote: "", fecha_caducidad: "",
  precio_unitario_centavos: 0, diferencia_nota: "",
};

export default function RecepcionMercancia() {
  const { activeClinicId } = useActiveClinic();
  const { toast } = useToast();
  const { ctx, clearCtx } = useComprasNav();
  const { items: proveedores } = useProveedores(activeClinicId);
  const { items: ordenes, getItems: getOCItems } = useOrdenesCompra(activeClinicId);
  const { items: recepciones, loading, error, create, verificar, getItems } = useRecepcionesMercancia(activeClinicId);
  const { create: createFactura } = useFacturasProveedor(activeClinicId);
  const ctxApplied = useRef(false);

  const [medicamentos, setMedicamentos] = useState<MedicamentoOption[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, RecepcionItem[]>>({});
  const [xmlPanelId, setXmlPanelId] = useState<string | null>(null);
  const [recepcionFacturaId, setRecepcionFacturaId] = useState<Record<string, string>>({});
  const [creatingFactura, setCreatingFactura] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocItems, setOcItems] = useState<OrdenCompraItem[]>([]);
  const [form, setForm] = useState({
    orden_id: "",
    proveedor_id: "",
    fecha_recepcion: new Date().toISOString().split("T")[0],
    numero_remision: "",
    notas: "",
  });
  const [lineItems, setLineItems] = useState<(RecepcionItem & { _key: number })[]>([
    { ...EMPTY_ITEM, _key: Date.now() },
  ]);

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

  // Cuando se selecciona una OC, cargar sus items para pre-poblar
  const handleOCSelect = useCallback(async (ordenIdRaw: string) => {
    const ordenId = ordenIdRaw === "_none" ? "" : ordenIdRaw;
    setForm((f) => {
      const oc = ordenes.find((o) => o.id === ordenId);
      return { ...f, orden_id: ordenId, proveedor_id: oc?.proveedor_id ?? f.proveedor_id };
    });
    if (!ordenId) {
      setOcItems([]);
      setLineItems([{ ...EMPTY_ITEM, _key: Date.now() }]);
      return;
    }
    try {
      const items = await getOCItems(ordenId);
      setOcItems(items);
      setLineItems(
        items.map((it, i) => ({
          ...EMPTY_ITEM,
          _key: Date.now() + i,
          orden_item_id: it.id,
          medicamento_id: it.medicamento_id,
          cantidad_recibida: it.cantidad_pedida - it.cantidad_recibida,
          precio_unitario_centavos: it.precio_unitario_centavos,
        }))
      );
    } catch { /* use blank */ }
  }, [ordenes, getOCItems]);

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

  const handleSubirXML = useCallback(async (rec: Recepcion) => {
    if (recepcionFacturaId[rec.id]) {
      setXmlPanelId(rec.id);
      return;
    }
    setCreatingFactura(rec.id);
    try {
      const facturaId = await createFactura({
        proveedor_id: rec.proveedor_id,
        orden_id: rec.orden_id,
        recepcion_id: rec.id,
        uuid_sat: "",
        serie_folio_proveedor: rec.numero_remision ?? "",
        fecha_factura: rec.fecha_recepcion,
        fecha_vencimiento: rec.fecha_recepcion,
        subtotal_centavos: 0,
        iva_centavos: 0,
        total_centavos: 0,
        concepto: `Recepción ${rec.folio_recepcion}`,
        notas: "",
      });
      setRecepcionFacturaId((prev) => ({ ...prev, [rec.id]: facturaId }));
      setXmlPanelId(rec.id);
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    } finally {
      setCreatingFactura(null);
    }
  }, [recepcionFacturaId, createFactura, toast]);

  const updateLine = (key: number, field: keyof RecepcionItem, value: string | number | null) =>
    setLineItems((prev) =>
      prev.map((l) => l._key === key ? { ...l, [field]: value } : l)
    );

  const addLine = () =>
    setLineItems((prev) => [...prev, { ...EMPTY_ITEM, _key: Date.now() }]);

  const handleSubmit = async () => {
    if (!form.proveedor_id) {
      toast({ title: "Selecciona un proveedor", variant: "destructive" });
      return;
    }
    const validLines = lineItems.filter((l) => l.medicamento_id && l.cantidad_recibida > 0);
    if (!validLines.length) {
      toast({ title: "Agrega al menos un producto recibido", variant: "destructive" });
      return;
    }
    // FEFO validation: warn if no fecha_caducidad
    const sinCaducidad = validLines.filter((l) => !l.fecha_caducidad);
    if (sinCaducidad.length > 0) {
      toast({
        title: `${sinCaducidad.length} producto(s) sin fecha de caducidad`,
        description: "COFEPRIS requiere trazabilidad de lotes. Agrega las fechas.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await create({
        orden_id: form.orden_id || null,
        proveedor_id: form.proveedor_id,
        fecha_recepcion: form.fecha_recepcion,
        numero_remision: form.numero_remision,
        notas: form.notas,
        items: validLines,
      });
      toast({ title: "Recepción registrada correctamente" });
      setDialogOpen(false);
      setForm({ orden_id: "", proveedor_id: "", fecha_recepcion: new Date().toISOString().split("T")[0], numero_remision: "", notas: "" });
      setLineItems([{ ...EMPTY_ITEM, _key: Date.now() }]);
      setOcItems([]);
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Pre-select OC from navigation context once ordenes are loaded
  useEffect(() => {
    if (!ctx.orden_id || !ordenes.length) return;
    const oc = ordenes.find((o) => o.id === ctx.orden_id);
    if (!oc || (oc.estatus !== "confirmada" && oc.estatus !== "parcial")) return;
    void handleOCSelect(ctx.orden_id);
    setDialogOpen(true);
    clearCtx();
  }, [ctx.orden_id, ordenes, handleOCSelect, clearCtx]);

  const ordenesRecibibles = ordenes.filter((o) => o.estatus === "confirmada" || o.estatus === "parcial");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Recepción de Mercancía</h3>
          <p className="text-sm text-muted-foreground">{recepciones.length} recepciones · Validación FEFO + lote obligatorio</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nueva recepción
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!loading && recepciones.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <PackageOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Sin recepciones registradas. Recibe mercancía para actualizar el inventario.</p>
        </div>
      )}

      <div className="space-y-2">
        {recepciones.map((rec) => {
          const badge = ESTATUS_BADGE[rec.estatus];
          const isOpen = expanded === rec.id;
          return (
            <div key={rec.id} className="rounded-lg border bg-card">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => toggleExpand(rec.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{rec.folio_recepcion}</span>
                    <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                    {rec.orden_folio && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{rec.orden_folio}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{rec.proveedor_nombre}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(rec.fecha_recepcion), "dd MMM yyyy", { locale: es })}
                    {rec.numero_remision && ` · Remisión: ${rec.numero_remision}`}
                  </div>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>

              {isOpen && (
                <div className="border-t px-3 pb-3 pt-2 space-y-3">
                  {rec.estatus === "pendiente" && (
                    <Button size="sm" onClick={async () => {
                      try { await verificar(rec.id); toast({ title: "Recepción verificada" }); }
                      catch (e) { toast({ title: String(e), variant: "destructive" }); }
                    }}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Marcar verificada
                    </Button>
                  )}
                  {rec.estatus === "con_diferencias" && (
                    <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 rounded p-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Esta recepción tiene diferencias respecto a la OC. Revisa y valida.</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CFDI XML · Trazabilidad anti-robo</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={creatingFactura === rec.id}
                        onClick={() => xmlPanelId === rec.id ? setXmlPanelId(null) : handleSubirXML(rec)}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        {creatingFactura === rec.id ? "Preparando…" : xmlPanelId === rec.id ? "Cerrar" : "Subir XML factura"}
                      </Button>
                    </div>
                    {xmlPanelId === rec.id && recepcionFacturaId[rec.id] && (
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <CfdiUploadPanel
                          facturaProveedorId={recepcionFacturaId[rec.id]}
                          ordenCompraId={rec.orden_id ?? undefined}
                          recepcionId={rec.id}
                          proveedorId={rec.proveedor_id}
                        />
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b">
                          <th className="text-left pb-1">Producto</th>
                          <th className="text-left pb-1">Lote</th>
                          <th className="text-left pb-1">Caducidad</th>
                          <th className="text-right pb-1">Cant.</th>
                          <th className="text-right pb-1">P. Unit.</th>
                          <th className="text-left pb-1">Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(expandedItems[rec.id] ?? []).map((item, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1 pr-2">{item.medicamento_nombre ?? item.medicamento_id}</td>
                            <td className="py-1 font-mono text-xs">{item.numero_lote || "—"}</td>
                            <td className="py-1 text-xs">{item.fecha_caducidad ? format(new Date(item.fecha_caducidad), "dd/MM/yy") : "—"}</td>
                            <td className="py-1 text-right">{item.cantidad_recibida}</td>
                            <td className="py-1 text-right">{formatMXN(item.precio_unitario_centavos)}</td>
                            <td className="py-1 text-xs text-muted-foreground">{item.diferencia_nota || "—"}</td>
                          </tr>
                        ))}
                        {!expandedItems[rec.id] && (
                          <tr><td colSpan={6} className="py-2 text-center text-muted-foreground text-xs">Cargando…</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {rec.notas && <p className="text-xs text-muted-foreground italic">Nota: {rec.notas}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog: Nueva recepción */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Recepción de Mercancía</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Vincular a OC (opcional)</Label>
                <Select value={form.orden_id || "_none"} onValueChange={handleOCSelect}>
                  <SelectTrigger><SelectValue placeholder="Sin OC vinculada" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sin OC vinculada</SelectItem>
                    {ordenesRecibibles.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.folio} — {o.proveedor_nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Fecha de recepción</Label>
                <Input type="date" value={form.fecha_recepcion} onChange={(e) => setForm((f) => ({ ...f, fecha_recepcion: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>No. de remisión</Label>
                <Input value={form.numero_remision} onChange={(e) => setForm((f) => ({ ...f, numero_remision: e.target.value }))} placeholder="Folio del proveedor" />
              </div>
            </div>

            {/* Líneas de producto */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Productos recibidos</Label>
                <Button type="button" size="sm" variant="outline" onClick={addLine}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar
                </Button>
              </div>
              <div className="space-y-3">
                {lineItems.map((l, idx) => {
                  const ocItem = ocItems.find((oc) => oc.id === l.orden_item_id);
                  return (
                    <div key={l._key} className="rounded-md border p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Medicamento *</Label>
                          {l.orden_item_id && ocItem ? (
                            <p className="text-sm font-medium py-1">{ocItem.medicamento_nombre ?? l.medicamento_id}</p>
                          ) : (
                            <Select value={l.medicamento_id} onValueChange={(v) => updateLine(l._key, "medicamento_id", v)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                              <SelectContent>
                                {medicamentos.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Cantidad recibida *</Label>
                          <Input
                            type="number" min={1} className="h-8 text-sm"
                            value={l.cantidad_recibida}
                            onChange={(e) => updateLine(l._key, "cantidad_recibida", Math.max(1, Number(e.target.value)))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">No. de lote (COFEPRIS)</Label>
                          <Input
                            className="h-8 text-sm font-mono"
                            value={l.numero_lote}
                            onChange={(e) => updateLine(l._key, "numero_lote", e.target.value)}
                            placeholder="LOT-XXXXX"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Fecha caducidad *</Label>
                          <Input
                            type="date" className="h-8 text-sm"
                            value={l.fecha_caducidad}
                            onChange={(e) => updateLine(l._key, "fecha_caducidad", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">P. Unit. (MXN)</Label>
                          <Input
                            type="number" min={0} step={0.01} className="h-8 text-sm"
                            value={(l.precio_unitario_centavos / 100).toFixed(2)}
                            onChange={(e) => updateLine(l._key, "precio_unitario_centavos", Math.round(Number(e.target.value) * 100))}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Nota de diferencia (si aplica)</Label>
                        <Input
                          className="h-8 text-sm"
                          value={l.diferencia_nota}
                          onChange={(e) => updateLine(l._key, "diferencia_nota", e.target.value)}
                          placeholder="Ej: Recibido 9 de 10, caja dañada…"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notas generales</Label>
              <Input value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Observaciones de la recepción…" />
            </div>

            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
              <strong>FEFO obligatorio:</strong> Todos los medicamentos deben tener lote y fecha de caducidad para cumplir con COFEPRIS. El sistema usa FEFO para despacho automático.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando…" : "Registrar recepción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
