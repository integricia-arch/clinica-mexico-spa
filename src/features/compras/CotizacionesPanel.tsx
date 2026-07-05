import { useEffect, useState, useCallback, useRef } from "react";
import { useComprasNav } from "@/features/compras/ComprasNavContext";
import { useCotizaciones, type Cotizacion, type CotizacionItem, type NuevaCotizacion } from "@/hooks/useCotizaciones";
import SeleccionPorMedicamento from "@/features/compras/SeleccionPorMedicamento";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { ShoppingCart, Plus, Trash2, RefreshCw, CheckCircle, Star } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const fmt = (c: number) => (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

interface Proveedor { id: string; nombre: string; rfc: string | null }
interface SolicitudOption { id: string; folio: string; motivo: string | null }

function ItemsForm({
  items,
  onChange,
}: {
  items: CotizacionItem[];
  onChange: (items: CotizacionItem[]) => void;
}) {
  const addItem = () =>
    onChange([
      ...items,
      { descripcion: "", cantidad: 1, precio_unitario_centavos: 0, iva_aplica: true },
    ]);

  const updateItem = (idx: number, patch: Partial<CotizacionItem>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };

  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Productos / servicios cotizados</p>
        <Button type="button" size="sm" variant="outline" onClick={addItem}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
        </Button>
      </div>
      {items.map((it, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_80px_110px_60px_auto] gap-2 items-end">
          <div>
            {idx === 0 && <Label className="text-xs">Descripción</Label>}
            <Input
              placeholder="Descripción"
              value={it.descripcion}
              onChange={(e) => updateItem(idx, { descripcion: e.target.value })}
              required
            />
          </div>
          <div>
            {idx === 0 && <Label className="text-xs">Cantidad</Label>}
            <Input
              type="number"
              min="0.001"
              step="0.001"
              value={it.cantidad}
              onChange={(e) => updateItem(idx, { cantidad: parseFloat(e.target.value) || 1 })}
            />
          </div>
          <div>
            {idx === 0 && <Label className="text-xs">Precio unit. MXN</Label>}
            <Input
              key={`precio-${idx}-${it.precio_unitario_centavos}`}
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              defaultValue={it.precio_unitario_centavos > 0 ? (it.precio_unitario_centavos / 100).toFixed(2) : ""}
              onBlur={(e) =>
                updateItem(idx, { precio_unitario_centavos: Math.round((parseFloat(e.target.value.replace(",", ".")) || 0) * 100) })
              }
            />
          </div>
          <div className="flex items-end pb-1 justify-center">
            {idx === 0 && <div className="h-4" />}
            <label className="flex items-center gap-1 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={it.iva_aplica !== false}
                onChange={(e) => updateItem(idx, { iva_aplica: e.target.checked })}
              />
              IVA
            </label>
          </div>
          <div className="flex items-end">
            {idx === 0 && <div className="h-4" />}
            <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground" onClick={() => removeItem(idx)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">Sin conceptos. Agrega al menos uno.</p>
      )}
    </div>
  );
}

interface NuevaForm {
  proveedor_id: string;
  solicitud_compra_id: string;
  vigente_hasta: string;
  plazo_entrega_dias: string;
  notas: string;
  items: CotizacionItem[];
}

const FORM_EMPTY: NuevaForm = {
  proveedor_id: "",
  solicitud_compra_id: "",
  vigente_hasta: "",
  plazo_entrega_dias: "",
  notas: "",
  items: [],
};

function NuevaCotizacionForm({
  proveedores,
  solicitudes,
  onCreated,
  onCancel,
}: {
  proveedores: Proveedor[];
  solicitudes: SolicitudOption[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { crearCotizacion, loading } = useCotizaciones();
  const { toast } = useToast();
  const [form, setForm] = useState<NuevaForm>(FORM_EMPTY);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.proveedor_id) {
      toast({ title: "Selecciona un proveedor", variant: "destructive" });
      return;
    }
    if (form.items.length === 0) {
      toast({ title: "Agrega al menos un concepto", variant: "destructive" });
      return;
    }
    if (form.items.some((it) => !it.descripcion.trim() || it.precio_unitario_centavos <= 0)) {
      toast({ title: "Todos los conceptos necesitan descripción y precio unitario mayor a cero", variant: "destructive" });
      return;
    }
    try {
      const input: NuevaCotizacion = {
        proveedor_id:        form.proveedor_id,
        solicitud_compra_id: form.solicitud_compra_id || undefined,
        vigente_hasta:       form.vigente_hasta || undefined,
        plazo_entrega_dias:  form.plazo_entrega_dias ? parseInt(form.plazo_entrega_dias) : undefined,
        notas:               form.notas || undefined,
        items:               form.items,
      };
      await crearCotizacion(input);
      toast({ title: "Cotización registrada" });
      onCreated();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-4 space-y-4 bg-muted/20">
      <h3 className="text-sm font-semibold">Nueva Cotización</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Proveedor *</Label>
          <Select value={form.proveedor_id} onValueChange={(v) => setForm({ ...form, proveedor_id: v })}>
            <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
            <SelectContent>
              {proveedores.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Solicitud de Compra</Label>
          <Select value={form.solicitud_compra_id || "_none"} onValueChange={(v) => setForm({ ...form, solicitud_compra_id: v === "_none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Sin solicitud</SelectItem>
              {solicitudes.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.folio} — {s.motivo ?? "Sin descripción"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Vigente hasta</Label>
          <Input type="date" value={form.vigente_hasta} onChange={(e) => setForm({ ...form, vigente_hasta: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Plazo entrega (días)</Label>
          <Input type="number" min="1" placeholder="Ej. 5" value={form.plazo_entrega_dias}
            onChange={(e) => setForm({ ...form, plazo_entrega_dias: e.target.value })} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Notas</Label>
          <Input placeholder="Condiciones, descuentos, etc." value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })} />
        </div>
      </div>

      <ItemsForm items={form.items} onChange={(items) => setForm({ ...form, items })} />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>Guardar Cotización</Button>
      </div>
    </form>
  );
}

function ComparativaTable({ cotizaciones, onSeleccionar, onDeseleccionar }: { cotizaciones: Cotizacion[]; onSeleccionar: (id: string, scId?: string) => void; onDeseleccionar: (id: string) => void }) {
  if (cotizaciones.length < 2) return null;

  const minTotal = Math.min(...cotizaciones.map((c) => c.total_centavos));

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comparativa</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/20 border-b">
          <tr>
            <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Proveedor</th>
            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Subtotal</th>
            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">IVA</th>
            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Plazo</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Sel.</th>
          </tr>
        </thead>
        <tbody>
          {cotizaciones.map((c) => {
            const isBest = c.total_centavos === minTotal;
            return (
              <tr key={c.id} className={`border-b last:border-0 ${c.seleccionada ? "bg-green-50" : isBest ? "bg-blue-50" : ""}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {isBest && <Star className="h-3.5 w-3.5 text-blue-500 shrink-0" aria-label="Menor precio" />}
                    <span className="text-sm">{c.proveedor?.nombre ?? "—"}</span>
                    {c.seleccionada && <Badge className="bg-green-600 text-white text-xs ml-1">Seleccionada</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.folio}
                    {c.vigente_hasta ? ` · vigente ${format(new Date(c.vigente_hasta), "dd/MM/yy")}` : ""}
                  </p>
                </td>
                <td className="px-3 py-2 text-right text-xs">{fmt(c.subtotal_centavos)}</td>
                <td className="px-3 py-2 text-right text-xs">{fmt(c.iva_centavos)}</td>
                <td className={`px-3 py-2 text-right font-bold text-sm ${isBest ? "text-blue-700" : ""}`}>
                  {fmt(c.total_centavos)}
                </td>
                <td className="px-3 py-2 text-center text-xs">
                  {c.plazo_entrega_dias != null ? `${c.plazo_entrega_dias}d` : "—"}
                </td>
                <td className="px-3 py-2 text-center">
                  {c.seleccionada
                    ? (
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-1.5 text-muted-foreground"
                          onClick={() => onDeseleccionar(c.id)}>
                          Deshacer
                        </Button>
                      </div>
                    )
                    : (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => onSeleccionar(c.id, c.solicitud_compra_id ?? undefined)}>
                        Elegir
                      </Button>
                    )
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CotizacionesPanel() {
  const { fetchCotizaciones, seleccionarCotizacion, deseleccionarCotizacion, loading, error } = useCotizaciones();
  const { activeClinicId } = useActiveClinic();
  const { toast } = useToast();
  const { ctx, navigateTo, clearCtx } = useComprasNav();
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [scFiltro, setScFiltro] = useState("todas");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Pre-select SC from navigation context
  useEffect(() => {
    if (!ctx.solicitud_id) return;
    setScFiltro(ctx.solicitud_id);
    clearCtx();
  }, [ctx.solicitud_id, clearCtx]);

  const cargar = useCallback(async () => {
    const sc = scFiltro !== "todas" ? scFiltro : undefined;
    const rows = await fetchCotizaciones(sc);
    setCotizaciones(rows);
  }, [fetchCotizaciones, scFiltro]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!activeClinicId) return;
    const db = (supabase as any).from("proveedores");
    db.select("id, nombre, rfc").eq("clinic_id", activeClinicId).eq("activo", true).order("nombre")
      .then(({ data }) => setProveedores((data || []) as Proveedor[]));

    const dbSc = (supabase as any).from("solicitudes_compra");
    dbSc.select("id, folio, motivo").eq("clinic_id", activeClinicId).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setSolicitudes((data || []) as SolicitudOption[]));
  }, [activeClinicId]);

  const handleSeleccionar = async (id: string, scId?: string) => {
    try {
      await seleccionarCotizacion(id, scId);
      toast({ title: "Cotización seleccionada" });
      await cargar();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const handleDeseleccionar = async (id: string) => {
    try {
      await deseleccionarCotizacion(id);
      toast({ title: "Selección deshecha" });
      await cargar();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  // Group by solicitud_compra_id for comparativa
  const grouped = cotizaciones.reduce<Record<string, Cotizacion[]>>((acc, c) => {
    const key = c.solicitud_compra_id ?? "__sin_sc__";
    return { ...acc, [key]: [...(acc[key] ?? []), c] };
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold">Cotizaciones Multi-Proveedor</h2>
        </div>
        <div className="flex gap-2">
          <Select value={scFiltro} onValueChange={setScFiltro}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Todas las solicitudes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las solicitudes</SelectItem>
              {solicitudes.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.folio}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={cargar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" /> Nueva Cotización
          </Button>
        </div>
      </div>

      {showForm && (
        <NuevaCotizacionForm
          proveedores={proveedores}
          solicitudes={solicitudes}
          onCreated={() => { setShowForm(false); cargar(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {cotizaciones.length === 0 && !loading && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Sin cotizaciones. Agrega la primera con el botón "Nueva Cotización".
        </div>
      )}

      {Object.entries(grouped).map(([scKey, cots]) => {
        const sc = solicitudes.find((s) => s.id === scKey);
        return (
          <div key={scKey} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground border-b pb-1">
              {sc ? `SC ${sc.folio} — ${sc.motivo ?? ""}` : "Sin solicitud de compra"}
              <span className="ml-2 text-xs">({cots.length} cotización{cots.length !== 1 ? "es" : ""})</span>
            </h3>
            <ComparativaTable cotizaciones={cots} onSeleccionar={handleSeleccionar} onDeseleccionar={handleDeseleccionar} />
            {cots.length >= 2 && <SeleccionPorMedicamento cotizaciones={cots} onGenerado={cargar} />}
            {cots.length < 2 && (
              <p className="text-xs text-muted-foreground">
                Agrega al menos 2 cotizaciones para ver la comparativa.
              </p>
            )}
            <div className="space-y-2">
              {cots.map((c) => (
                <div key={c.id} className="rounded-lg border">
                  <div
                    className="px-3 py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/30"
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{c.proveedor?.nombre ?? "—"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{c.folio}</p>
                        {c.seleccionada && <Badge className="bg-green-600 text-white text-xs">Seleccionada</Badge>}
                        {c.orden_compra_id && <Badge variant="outline" className="text-xs">OC generada</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(c.fecha_cotizacion), "dd/MM/yyyy", { locale: es })}
                        {c.plazo_entrega_dias != null ? ` · ${c.plazo_entrega_dias} días` : ""}
                        {c.notas ? ` · ${c.notas}` : ""}
                        {` · ${c.items?.length ?? 0} producto(s) — clic para ver detalle`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.seleccionada && !c.orden_compra_id && (
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs bg-green-700 hover:bg-green-800 text-white shrink-0"
                          onClick={(e) => { e.stopPropagation(); navigateTo("oc", { cotizacion_id: c.id }); }}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" /> Generar OC →
                        </Button>
                      )}
                      <div className="text-right">
                        <p className="text-sm font-bold">{fmt(c.total_centavos)}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmt(c.subtotal_centavos)} + {fmt(c.iva_centavos)} IVA
                        </p>
                      </div>
                    </div>
                  </div>
                  {expandedId === c.id && (
                    <div className="border-t px-3 py-2 bg-muted/10">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b">
                            <th className="text-left pb-1">Producto / servicio</th>
                            <th className="text-right pb-1">Cant.</th>
                            <th className="text-right pb-1">P. Unit.</th>
                            <th className="text-right pb-1">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(c.items ?? []).map((it, i) => (
                            <tr key={it.id ?? i} className="border-b last:border-0">
                              <td className="py-1 pr-2">{it.descripcion}</td>
                              <td className="py-1 text-right">{it.cantidad}</td>
                              <td className="py-1 text-right">{fmt(it.precio_unitario_centavos)}</td>
                              <td className="py-1 text-right">{fmt(it.subtotal_centavos ?? it.cantidad * it.precio_unitario_centavos)}</td>
                            </tr>
                          ))}
                          {(c.items ?? []).length === 0 && (
                            <tr><td colSpan={4} className="py-2 text-center text-muted-foreground">Sin productos registrados.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
