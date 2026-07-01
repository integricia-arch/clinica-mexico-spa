import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedTable";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useProveedores } from "@/hooks/useProveedores";
import { useFacturasProveedor, type FacturaProveedor, type FacturaInput, type PagoProveedor } from "@/hooks/useFacturasProveedor";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ChevronDown, ChevronUp, AlertTriangle, FileText, CreditCard, Upload } from "lucide-react";
import ThreeWayMatchPanel from "./ThreeWayMatchPanel";
import CfdiUploadPanel from "./CfdiUploadPanel";
import AlertasCxpPanel from "./AlertasCxpPanel";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

const formatMXN = (c: number) => (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const UUID_SAT_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESTATUS_BADGE: Record<FacturaProveedor["estatus"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  provisional: { label: "Accrual provisional", variant: "outline" },
  pendiente:   { label: "Pendiente",   variant: "secondary" },
  parcial:     { label: "Pago parcial",variant: "outline" },
  pagada:      { label: "Pagada",      variant: "default" },
  cancelada:   { label: "Cancelada",   variant: "destructive" },
  en_disputa:  { label: "En disputa",  variant: "destructive" },
};

const EMPTY_FACTURA = {
  proveedor_id: "", uuid_sat: "", serie_folio_proveedor: "",
  fecha_factura: new Date().toISOString().split("T")[0],
  fecha_vencimiento: "", subtotal_str: "", iva_str: "", concepto: "", notas: "",
};

const EMPTY_PAGO = {
  fecha_pago: new Date().toISOString().split("T")[0],
  monto_str: "", metodo_pago: "transferencia" as PagoProveedor["metodo_pago"],
  referencia_bancaria: "", banco_origen: "", notas: "",
};

export default function FacturasProveedor() {
  const { activeClinicId } = useActiveClinic();
  const { toast } = useToast();
  const { items: proveedores } = useProveedores(activeClinicId);
  const { items, loading, error, pendientes, vencidas, create, registrarPago, getPagos, confirmarProvisional, refresh } = useFacturasProveedor(activeClinicId);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedPagos, setExpandedPagos] = useState<Record<string, PagoProveedor[]>>({});
  const [filtro, setFiltro] = useState<"todas" | "pendientes" | "vencidas">("pendientes");
  const [ocAnticipoMap, setOcAnticipoMap] = useState<Record<string, boolean>>({});
  const ocFetched = useRef<Set<string>>(new Set());

  const [factDialog, setFactDialog] = useState(false);
  const [pagoDialog, setPagoDialog] = useState<string | null>(null);
  const [confirmarProvId, setConfirmarProvId] = useState<string | null>(null);
  const [cfdiPanelId, setCfdiPanelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uuidError, setUuidError] = useState("");

  const [factForm, setFactForm] = useState(EMPTY_FACTURA);
  const [pagoForm, setPagoForm] = useState(EMPTY_PAGO);

  const toggleExpand = useCallback(async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!expandedPagos[id]) {
      try {
        const pagos = await getPagos(id);
        setExpandedPagos((prev) => ({ ...prev, [id]: pagos }));
      } catch { /* non-critical */ }
    }
    // Fetch requiere_anticipo from linked OC for payment gate
    if (!ocFetched.current.has(id)) {
      const factura = items.find((f) => f.id === id);
      if (factura?.orden_id) {
        untypedTable("ordenes_compra")
          .select("requiere_anticipo")
          .eq("id", factura.orden_id)
          .single()
          .then(({ data, error }) => {
            if (error) return; // leave unfetched so next expand retries
            ocFetched.current.add(id);
            const d = data as { requiere_anticipo: boolean } | null;
            setOcAnticipoMap((prev) => ({ ...prev, [id]: d?.requiere_anticipo ?? false }));
          })
          .catch(() => { /* network failure — retry on next expand */ });
      } else {
        // No OC linked — mark as fetched with false to avoid repeated no-ops
        ocFetched.current.add(id);
        setOcAnticipoMap((prev) => ({ ...prev, [id]: false }));
      }
    }
  }, [expanded, expandedPagos, getPagos, items]);

  const handleCreateFactura = async () => {
    if (!factForm.proveedor_id) {
      toast({ title: "Selecciona un proveedor", variant: "destructive" }); return;
    }
    if (!factForm.fecha_vencimiento) {
      toast({ title: "Ingresa la fecha de vencimiento", variant: "destructive" }); return;
    }
    if (factForm.uuid_sat && !UUID_SAT_REGEX.test(factForm.uuid_sat)) {
      setUuidError("UUID SAT inválido. Formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
      return;
    }
    const subtotal = Math.round(Number(factForm.subtotal_str) * 100);
    const iva = Math.round(Number(factForm.iva_str || "0") * 100);
    if (!subtotal) {
      toast({ title: "Ingresa el subtotal", variant: "destructive" }); return;
    }

    setSaving(true);
    try {
      await create({
        proveedor_id: factForm.proveedor_id,
        orden_id: null, recepcion_id: null,
        uuid_sat: factForm.uuid_sat,
        serie_folio_proveedor: factForm.serie_folio_proveedor,
        fecha_factura: factForm.fecha_factura,
        fecha_vencimiento: factForm.fecha_vencimiento,
        subtotal_centavos: subtotal,
        iva_centavos: iva,
        total_centavos: subtotal + iva,
        concepto: factForm.concepto,
        notas: factForm.notas,
      });
      toast({ title: "Factura registrada" });
      setFactDialog(false);
      setFactForm(EMPTY_FACTURA);
      setUuidError("");
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmarProvisional = async () => {
    if (!confirmarProvId) return;
    if (!factForm.fecha_vencimiento) {
      toast({ title: "Ingresa la fecha de vencimiento", variant: "destructive" }); return;
    }
    if (factForm.uuid_sat && !UUID_SAT_REGEX.test(factForm.uuid_sat)) {
      setUuidError("UUID SAT inválido. Formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"); return;
    }
    const subtotal = Math.round(Number(factForm.subtotal_str) * 100);
    const iva = Math.round(Number(factForm.iva_str || "0") * 100);
    if (!subtotal) {
      toast({ title: "Ingresa el subtotal", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const input: FacturaInput = {
        proveedor_id: factForm.proveedor_id,
        orden_id: null, recepcion_id: null,
        uuid_sat: factForm.uuid_sat,
        serie_folio_proveedor: factForm.serie_folio_proveedor,
        fecha_factura: factForm.fecha_factura,
        fecha_vencimiento: factForm.fecha_vencimiento,
        subtotal_centavos: subtotal,
        iva_centavos: iva,
        total_centavos: subtotal + iva,
        concepto: factForm.concepto,
        notas: factForm.notas,
      };
      await confirmarProvisional(confirmarProvId, input);
      toast({ title: "CFDI registrado — accrual confirmado" });
      setConfirmarProvId(null);
      setFactForm(EMPTY_FACTURA);
      setUuidError("");
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRegistrarPago = async () => {
    if (!pagoDialog) return;
    const monto = Math.round(Number(pagoForm.monto_str) * 100);
    if (!monto) {
      toast({ title: "Ingresa el monto del pago", variant: "destructive" }); return;
    }
    const factura = items.find((f) => f.id === pagoDialog);
    if (factura && monto > factura.saldo_pendiente_centavos) {
      toast({ title: `Monto excede el saldo (${formatMXN(factura.saldo_pendiente_centavos)})`, variant: "destructive" }); return;
    }

    setSaving(true);
    try {
      await registrarPago(pagoDialog, { ...pagoForm, monto_centavos: monto });
      setExpandedPagos((prev) => { const { [pagoDialog]: _, ...rest } = prev; return rest; });
      toast({ title: "Pago registrado" });
      setPagoDialog(null);
      setPagoForm(EMPTY_PAGO);
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const displayed = filtro === "todas" ? items : filtro === "vencidas" ? vencidas : pendientes;

  const diasVencimiento = (f: FacturaProveedor) => differenceInDays(new Date(f.fecha_vencimiento), new Date());

  return (
    <div className="space-y-4">
      <AlertasCxpPanel />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Cuentas por Pagar</h3>
          <p className="text-sm text-muted-foreground">
            {pendientes.length} pendientes · {vencidas.length > 0 && <span className="text-destructive">{vencidas.length} vencidas</span>}
            {vencidas.length === 0 && "0 vencidas"}
          </p>
        </div>
        <Button onClick={() => setFactDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Registrar factura
        </Button>
      </div>

      {/* Resumen CxP vencidas */}
      {vencidas.length > 0 && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>{vencidas.length} factura(s) vencida(s).</strong> Total: {formatMXN(vencidas.reduce((a, f) => a + f.saldo_pendiente_centavos, 0))}.
            El pago tardío afecta crédito con proveedor y puede generar intereses.
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2">
        {(["pendientes","vencidas","todas"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors capitalize ${filtro === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {f === "pendientes" ? `Pendientes (${pendientes.length})` : f === "vencidas" ? `Vencidas (${vencidas.length})` : `Todas (${items.length})`}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!loading && displayed.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Sin facturas en esta vista.</p>
        </div>
      )}

      <div className="space-y-2">
        {displayed.map((f) => {
          const badge = ESTATUS_BADGE[f.estatus];
          const diasVenc = diasVencimiento(f);
          const isOpen = expanded === f.id;
          return (
            <div key={f.id} className="rounded-lg border bg-card">
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => toggleExpand(f.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{f.folio_interno}</span>
                    <Badge variant={badge.variant} className={`text-xs${f.es_provisional ? " border-amber-400 text-amber-700 bg-amber-50" : ""}`}>{badge.label}</Badge>
                    {f.serie_folio_proveedor && (
                      <span className="text-xs text-muted-foreground font-mono">{f.serie_folio_proveedor}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{f.proveedor_nombre}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>Vence: {format(new Date(f.fecha_vencimiento), "dd MMM yyyy", { locale: es })}</span>
                    {(f.estatus === "pendiente" || f.estatus === "parcial") && (
                      <span className={diasVenc < 0 ? "text-destructive font-medium" : diasVenc <= 7 ? "text-yellow-600 font-medium" : ""}>
                        {diasVenc < 0 ? `${Math.abs(diasVenc)}d vencida` : `${diasVenc}d restantes`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatMXN(f.saldo_pendiente_centavos)}</p>
                  <p className="text-xs text-muted-foreground">de {formatMXN(f.total_centavos)}</p>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>

              {isOpen && (
                <div className="border-t px-3 pb-3 pt-2 space-y-3">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div><span className="text-muted-foreground">Subtotal:</span> {formatMXN(f.subtotal_centavos)}</div>
                    <div><span className="text-muted-foreground">IVA:</span> {formatMXN(f.iva_centavos)}</div>
                    <div><span className="text-muted-foreground">Total:</span> <strong>{formatMXN(f.total_centavos)}</strong></div>
                    <div><span className="text-muted-foreground">Saldo:</span> <strong className="text-destructive">{formatMXN(f.saldo_pendiente_centavos)}</strong></div>
                    {f.uuid_sat && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">UUID SAT:</span>{" "}
                        <span className="font-mono text-xs">{f.uuid_sat}</span>
                      </div>
                    )}
                    {f.concepto && <div className="col-span-2"><span className="text-muted-foreground">Concepto:</span> {f.concepto}</div>}
                  </div>

                  <ThreeWayMatchPanel
                    facturaId={f.id}
                    facturaTotal={f.total_centavos}
                    ordenId={f.orden_id}
                    recepcionId={f.recepcion_id}
                    matchStatus={f.match_status}
                    matchOcTotal={f.match_oc_total_centavos}
                    matchRecTotal={f.match_recepcion_total_centavos}
                    matchDif={f.match_diferencia_centavos}
                    matchNotas={f.match_notas}
                    onUpdated={refresh}
                  />

                  {/* CFDI XML 4-way match */}
                  {!f.es_provisional && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CFDI XML · 4-way match</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setCfdiPanelId(cfdiPanelId === f.id ? null : f.id)}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          {cfdiPanelId === f.id ? "Cerrar" : "Subir XML"}
                        </Button>
                      </div>
                      {cfdiPanelId === f.id && (
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <CfdiUploadPanel
                            facturaProveedorId={f.id}
                            ordenCompraId={f.orden_id ?? undefined}
                            recepcionId={f.recepcion_id ?? undefined}
                            proveedorId={f.proveedor_id}
                            onParsed={() => setCfdiPanelId(null)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {f.es_provisional && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                      <strong>Accrual devengado (NIF C-19)</strong> — Este registro es provisional. Reemplázalo con el CFDI real del proveedor.
                    </div>
                  )}
                  {f.es_provisional && (
                    <Button size="sm" variant="outline" className="border-amber-400 text-amber-800 hover:bg-amber-50" onClick={() => {
                      setConfirmarProvId(f.id);
                      setFactForm({ ...EMPTY_FACTURA, proveedor_id: f.proveedor_id });
                      setUuidError("");
                    }}>
                      <FileText className="h-4 w-4 mr-1" /> Registrar CFDI real
                    </Button>
                  )}
                  {(f.estatus === "pendiente" || f.estatus === "parcial") && (() => {
                    const grOk = f.recepcion_estatus === "verificada";
                    const anticipo = ocAnticipoMap[f.id] ?? false;
                    return grOk || anticipo ? (
                      <Button size="sm" onClick={() => { setPagoDialog(f.id); setPagoForm({ ...EMPTY_PAGO, monto_str: (f.saldo_pendiente_centavos / 100).toFixed(2) }); }}>
                        <CreditCard className="h-4 w-4 mr-1" /> Registrar pago
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Pago bloqueado — se requiere GR vinculada. Activa "Requiere anticipo" en la OC para desbloquear anticipadamente.
                      </div>
                    );
                  })()}

                  {/* Historial de pagos */}
                  {(expandedPagos[f.id] ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Pagos realizados</p>
                      <table className="w-full text-xs">
                        <thead><tr className="border-b text-muted-foreground"><th className="text-left pb-1">Fecha</th><th className="text-left pb-1">Método</th><th className="text-left pb-1">Referencia</th><th className="text-right pb-1">Monto</th></tr></thead>
                        <tbody>
                          {(expandedPagos[f.id] ?? []).map((p) => (
                            <tr key={p.id} className="border-b last:border-0">
                              <td className="py-0.5">{format(new Date(p.fecha_pago), "dd/MM/yy")}</td>
                              <td className="py-0.5 capitalize">{p.metodo_pago}</td>
                              <td className="py-0.5 font-mono">{p.referencia_bancaria || "—"}</td>
                              <td className="py-0.5 text-right">{formatMXN(p.monto_centavos)}</td>
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

      {/* Dialog: Nueva factura */}
      <Dialog open={factDialog} onOpenChange={setFactDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Factura de Proveedor</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Proveedor *</Label>
              <Select value={factForm.proveedor_id} onValueChange={(v) => setFactForm((f) => ({ ...f, proveedor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>
                  {proveedores.filter((p) => p.activo).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Folio proveedor</Label>
                <Input value={factForm.serie_folio_proveedor} onChange={(e) => setFactForm((f) => ({ ...f, serie_folio_proveedor: e.target.value }))} placeholder="A-001" />
              </div>
              <div className="space-y-1">
                <Label>Fecha factura</Label>
                <Input type="date" value={factForm.fecha_factura} onChange={(e) => setFactForm((f) => ({ ...f, fecha_factura: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>UUID SAT (CFDI)</Label>
              <Input
                value={factForm.uuid_sat}
                onChange={(e) => { setFactForm((f) => ({ ...f, uuid_sat: e.target.value.trim() })); setUuidError(""); }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className={uuidError ? "border-destructive" : ""}
              />
              {uuidError && <p className="text-xs text-destructive">{uuidError}</p>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Subtotal (MXN) *</Label>
                <Input type="number" min={0} step={0.01} value={factForm.subtotal_str} onChange={(e) => setFactForm((f) => ({ ...f, subtotal_str: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>IVA (MXN)</Label>
                <Input type="number" min={0} step={0.01} value={factForm.iva_str} onChange={(e) => setFactForm((f) => ({ ...f, iva_str: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>Total</Label>
                <p className="h-9 flex items-center text-sm font-semibold">
                  {formatMXN(Math.round((Number(factForm.subtotal_str || 0) + Number(factForm.iva_str || 0)) * 100))}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Fecha de vencimiento *</Label>
              <Input type="date" value={factForm.fecha_vencimiento} onChange={(e) => setFactForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label>Concepto</Label>
              <Input value={factForm.concepto} onChange={(e) => setFactForm((f) => ({ ...f, concepto: e.target.value }))} placeholder="Compra de medicamentos…" />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input value={factForm.notas} onChange={(e) => setFactForm((f) => ({ ...f, notas: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFactDialog(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreateFactura} disabled={saving}>{saving ? "Guardando…" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar CFDI real sobre accrual provisional */}
      <Dialog open={!!confirmarProvId} onOpenChange={(o) => { if (!o) { setConfirmarProvId(null); setFactForm(EMPTY_FACTURA); setUuidError(""); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar CFDI real — confirmar accrual</DialogTitle></DialogHeader>
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 mb-2">
            Sustituye el accrual provisional con los datos reales del CFDI del proveedor. El folio interno y la OC/recepción vinculados se conservan.
          </div>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Folio proveedor</Label>
                <Input value={factForm.serie_folio_proveedor} onChange={(e) => setFactForm((f) => ({ ...f, serie_folio_proveedor: e.target.value }))} placeholder="A-001" />
              </div>
              <div className="space-y-1">
                <Label>Fecha factura</Label>
                <Input type="date" value={factForm.fecha_factura} onChange={(e) => setFactForm((f) => ({ ...f, fecha_factura: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>UUID SAT (CFDI)</Label>
              <Input
                value={factForm.uuid_sat}
                onChange={(e) => { setFactForm((f) => ({ ...f, uuid_sat: e.target.value.trim() })); setUuidError(""); }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className={uuidError ? "border-destructive" : ""}
              />
              {uuidError && <p className="text-xs text-destructive">{uuidError}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Subtotal (MXN) *</Label>
                <Input type="number" min={0} step={0.01} value={factForm.subtotal_str} onChange={(e) => setFactForm((f) => ({ ...f, subtotal_str: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>IVA (MXN)</Label>
                <Input type="number" min={0} step={0.01} value={factForm.iva_str} onChange={(e) => setFactForm((f) => ({ ...f, iva_str: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>Total</Label>
                <p className="h-9 flex items-center text-sm font-semibold">
                  {formatMXN(Math.round((Number(factForm.subtotal_str || 0) + Number(factForm.iva_str || 0)) * 100))}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Fecha de vencimiento *</Label>
              <Input type="date" value={factForm.fecha_vencimiento} onChange={(e) => setFactForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Concepto</Label>
              <Input value={factForm.concepto} onChange={(e) => setFactForm((f) => ({ ...f, concepto: e.target.value }))} placeholder="Compra de medicamentos…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmarProvId(null); setFactForm(EMPTY_FACTURA); setUuidError(""); }} disabled={saving}>Cancelar</Button>
            <Button onClick={handleConfirmarProvisional} disabled={saving}>{saving ? "Guardando…" : "Confirmar CFDI"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar pago */}
      <Dialog open={!!pagoDialog} onOpenChange={(o) => { if (!o) setPagoDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {pagoDialog && (() => {
              const f = items.find((x) => x.id === pagoDialog);
              return f ? (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-semibold">{f.proveedor_nombre} · {f.folio_interno}</p>
                  <p className="text-muted-foreground">Saldo pendiente: <strong>{formatMXN(f.saldo_pendiente_centavos)}</strong></p>
                </div>
              ) : null;
            })()}

            <div className="space-y-1">
              <Label>Monto a pagar (MXN) *</Label>
              <Input type="number" min={0.01} step={0.01} value={pagoForm.monto_str} onChange={(e) => setPagoForm((f) => ({ ...f, monto_str: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Fecha de pago</Label>
              <Input type="date" value={pagoForm.fecha_pago} onChange={(e) => setPagoForm((f) => ({ ...f, fecha_pago: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Método de pago</Label>
              <Select value={pagoForm.metodo_pago} onValueChange={(v) => setPagoForm((f) => ({ ...f, metodo_pago: v as PagoProveedor["metodo_pago"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Referencia bancaria</Label>
              <Input value={pagoForm.referencia_bancaria} onChange={(e) => setPagoForm((f) => ({ ...f, referencia_bancaria: e.target.value }))} placeholder="No. de operación" />
            </div>
            <div className="space-y-1">
              <Label>Banco origen</Label>
              <Input value={pagoForm.banco_origen} onChange={(e) => setPagoForm((f) => ({ ...f, banco_origen: e.target.value }))} placeholder="BBVA, HSBC…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoDialog(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleRegistrarPago} disabled={saving}>{saving ? "Guardando…" : "Registrar pago"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
