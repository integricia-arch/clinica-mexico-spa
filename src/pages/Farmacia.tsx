import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, AlertTriangle, Package, Pill, ArrowDownCircle, ArrowUpCircle, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { friendlyError } from "@/lib/errors";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VentaDirecta from "@/features/farmacia/VentaDirecta";
import SurtirReceta from "@/features/farmacia/SurtirReceta";
import PuntoDeVenta from "@/features/farmacia/PuntoDeVenta";

type Medicamento = Tables<"medicamentos">;
type Lote = Tables<"lotes_medicamento">;

const formatMXN = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const CATEGORIAS = ["Analgésico","Antibiótico","Antiinflamatorio","Antihipertensivo","Antidiabético",
  "Gastrointestinal","Antihistamínico","Broncodilatador","Neurológico","Soluciones","Vitaminas","Tópico","Otro"];
const UNIDADES = ["tableta","cápsula","frasco","ampolleta","pieza","sobre","ml","g"];

const SALE_TYPES = [
  { value: "otc", label: "OTC / venta libre" },
  { value: "receta_requerida", label: "Requiere receta médica" },
  { value: "receta_retenida", label: "Receta retenida" },
  { value: "controlado", label: "Controlado (psicotrópico/estupefaciente)" },
  { value: "no_medicamento", label: "Insumo / no medicamento" },
] as const;

const EMPTY_MED = {
  nombre: "", categoria: "Analgésico", descripcion: "", precio_unitario: "", stock_minimo: "0", unidad: "tableta",
  barcode: "", sku: "", codigo_interno: "",
  laboratorio: "", principio_activo: "", forma_farmaceutica: "", concentracion: "", presentacion: "",
  registro_sanitario: "",
  sale_type: "otc",
  allow_direct_sale: true,
  requires_prescription: false,
  is_controlled: false,
  regulatory_notes: "",
  indicaciones_uso: "",
  contraindicaciones: "",
  advertencias: "",
  interacciones_relevantes: "",
  fuente_info: "",
  equivalence_group_key: "",
};
const EMPTY_MOV = { medicamento_id:"", lote_id:"", tipo:"entrada", cantidad:"", motivo:"", numero_lote:"", fecha_caducidad:"" };

export default function Farmacia() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const canWrite = hasRole("admin") || hasRole("nurse");

  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState("pos");
  const [prescriptionScan, setPrescriptionScan] = useState<string | null>(null);

  // Modal medicamento
  const [medModal, setMedModal] = useState(false);
  const [editMed, setEditMed] = useState<Medicamento | null>(null);
  const [medForm, setMedForm] = useState(EMPTY_MED);
  const [savingMed, setSavingMed] = useState(false);

  // Modal movimiento
  const [movModal, setMovModal] = useState(false);
  const [movForm, setMovForm] = useState(EMPTY_MOV);
  const [savingMov, setSavingMov] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: meds }, { data: lts }] = await Promise.all([
      supabase.from("medicamentos").select("*").eq("activo", true).order("nombre"),
      supabase.from("lotes_medicamento").select("*").order("fecha_caducidad"),
    ]);
    setMedicamentos(meds ?? []);
    setLotes(lts ?? []);
    setLoading(false);
  }

  const stockTotal = (medId: string) =>
    lotes.filter(l => l.medicamento_id === medId).reduce((s, l) => s + l.existencia, 0);
  const lotesDe = (medId: string) => lotes.filter(l => l.medicamento_id === medId);

  const hoy = new Date();
  const en30 = new Date(); en30.setDate(hoy.getDate() + 30);
  const bajosStock = medicamentos.filter(m => stockTotal(m.id) < m.stock_minimo);
  const proxCaducidad = lotes.filter(l => new Date(l.fecha_caducidad) <= en30 && l.existencia > 0);

  const filtered = medicamentos.filter(m => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    const mx = m as Medicamento & {
      barcode?: string | null; sku?: string | null; codigo_interno?: string | null;
      laboratorio?: string | null; principio_activo?: string | null;
      concentracion?: string | null; presentacion?: string | null;
    };
    return [
      m.nombre, m.categoria,
      mx.barcode, mx.sku, mx.codigo_interno,
      mx.laboratorio, mx.principio_activo, mx.concentracion, mx.presentacion,
    ].some(v => (v ?? "").toLowerCase().includes(s));
  });

  // ── Medicamento CRUD ──────────────────────────────────────────────
  function openNewMed() { setEditMed(null); setMedForm(EMPTY_MED); setMedModal(true); }
  function openEditMed(m: Medicamento) {
    setEditMed(m);
    setMedForm({
      nombre: m.nombre,
      categoria: m.categoria,
      descripcion: m.descripcion ?? "",
      precio_unitario: String(m.precio_unitario),
      stock_minimo: String(m.stock_minimo),
      unidad: m.unidad,
      barcode: (m as Medicamento & { barcode?: string | null }).barcode ?? "",
      sku: (m as Medicamento & { sku?: string | null }).sku ?? "",
      codigo_interno: (m as Medicamento & { codigo_interno?: string | null }).codigo_interno ?? "",
      laboratorio: (m as Medicamento & { laboratorio?: string | null }).laboratorio ?? "",
      principio_activo: (m as Medicamento & { principio_activo?: string | null }).principio_activo ?? "",
      forma_farmaceutica: (m as Medicamento & { forma_farmaceutica?: string | null }).forma_farmaceutica ?? "",
      concentracion: (m as Medicamento & { concentracion?: string | null }).concentracion ?? "",
      presentacion: (m as Medicamento & { presentacion?: string | null }).presentacion ?? "",
      registro_sanitario: (m as Medicamento & { registro_sanitario?: string | null }).registro_sanitario ?? "",
      sale_type: m.sale_type ?? "otc",
      allow_direct_sale: m.allow_direct_sale ?? true,
      requires_prescription: m.requires_prescription ?? false,
      is_controlled: m.is_controlled ?? false,
      regulatory_notes: m.regulatory_notes ?? "",
      indicaciones_uso: (m as Medicamento & { indicaciones_uso?: string | null }).indicaciones_uso ?? "",
      contraindicaciones: (m as Medicamento & { contraindicaciones?: string | null }).contraindicaciones ?? "",
      advertencias: (m as Medicamento & { advertencias?: string | null }).advertencias ?? "",
      interacciones_relevantes: (m as Medicamento & { interacciones_relevantes?: string | null }).interacciones_relevantes ?? "",
      fuente_info: (m as Medicamento & { fuente_info?: string | null }).fuente_info ?? "",
      equivalence_group_key: (m as Medicamento & { equivalence_group_key?: string | null }).equivalence_group_key ?? "",
    });
    setMedModal(true);
  }

  async function saveMed() {
    if (!medForm.nombre.trim()) { toast({ variant:"destructive", title:"Error", description:"Nombre requerido" }); return; }
    setSavingMed(true);
    // Reglas de venta directa según tipo de venta
    const blocksDirect = ["receta_requerida", "receta_retenida", "controlado"].includes(medForm.sale_type);
    const allowsDirect = blocksDirect ? false : medForm.allow_direct_sale;
    const requiresRx = blocksDirect ? true : medForm.requires_prescription;
    const isControlled = medForm.sale_type === "controlado" ? true : medForm.is_controlled;

    const payload = {
      nombre: medForm.nombre.trim(),
      categoria: medForm.categoria,
      descripcion: medForm.descripcion || null,
      precio_unitario: parseFloat(medForm.precio_unitario) || 0,
      stock_minimo: parseInt(medForm.stock_minimo) || 0,
      unidad: medForm.unidad,
      barcode: medForm.barcode.trim() || null,
      sku: medForm.sku.trim() || null,
      codigo_interno: medForm.codigo_interno.trim() || null,
      laboratorio: medForm.laboratorio.trim() || null,
      principio_activo: medForm.principio_activo.trim() || null,
      forma_farmaceutica: medForm.forma_farmaceutica.trim() || null,
      concentracion: medForm.concentracion.trim() || null,
      presentacion: medForm.presentacion.trim() || null,
      registro_sanitario: medForm.registro_sanitario.trim() || null,
      sale_type: medForm.sale_type,
      allow_direct_sale: allowsDirect,
      requires_prescription: requiresRx,
      is_controlled: isControlled,
      regulatory_notes: medForm.regulatory_notes.trim() || null,
      indicaciones_uso: medForm.indicaciones_uso.trim() || null,
      contraindicaciones: medForm.contraindicaciones.trim() || null,
      advertencias: medForm.advertencias.trim() || null,
      interacciones_relevantes: medForm.interacciones_relevantes.trim() || null,
      fuente_info: medForm.fuente_info.trim() || null,
      equivalence_group_key: medForm.equivalence_group_key.trim() || null,
    };
    if (editMed) {
      const { data, error } = await supabase.from("medicamentos").update(payload).eq("id", editMed.id).select().single();
      if (error) { toast({ variant:"destructive", title:"Error", description: friendlyError(error) }); }
      else { setMedicamentos(p => p.map(m => m.id === editMed.id ? data : m)); toast({ title:"Medicamento actualizado" }); setMedModal(false); }
    } else {
      const { data, error } = await supabase.from("medicamentos").insert(payload).select().single();
      if (error) { toast({ variant:"destructive", title:"Error", description: friendlyError(error) }); }
      else { setMedicamentos(p => [...p, data].sort((a,b) => a.nombre.localeCompare(b.nombre))); toast({ title:"Medicamento registrado" }); setMedModal(false); }
    }
    setSavingMed(false);
  }

  async function deactivateMed(m: Medicamento) {
    const { error } = await supabase.from("medicamentos").update({ activo: false }).eq("id", m.id);
    if (error) toast({ variant:"destructive", title:"Error", description: friendlyError(error) });
    else { setMedicamentos(p => p.filter(x => x.id !== m.id)); toast({ title:"Medicamento desactivado" }); }
  }

  // ── Movimientos ───────────────────────────────────────────────────
  function openMov(tipo: string, medId = "") {
    setMovForm({ ...EMPTY_MOV, tipo, medicamento_id: medId });
    setMovModal(true);
  }

  async function saveMov() {
    if (!movForm.medicamento_id || !movForm.cantidad || parseInt(movForm.cantidad) <= 0) {
      toast({ variant:"destructive", title:"Error", description:"Selecciona medicamento y cantidad válida" }); return;
    }
    if (movForm.tipo === "entrada" && !movForm.numero_lote) {
      toast({ variant:"destructive", title:"Error", description:"Número de lote requerido para entradas" }); return;
    }
    setSavingMov(true);
    const cantidad = parseInt(movForm.cantidad);
    let loteId: string | null = movForm.lote_id || null;

    try {
      if (movForm.tipo === "entrada") {
        const existente = lotesDe(movForm.medicamento_id).find(l => l.numero_lote === movForm.numero_lote);
        if (existente) {
          await supabase.from("lotes_medicamento").update({ existencia: existente.existencia + cantidad }).eq("id", existente.id);
          loteId = existente.id;
          setLotes(p => p.map(l => l.id === existente.id ? { ...l, existencia: l.existencia + cantidad } : l));
        } else {
          const { data: nuevoLote, error } = await supabase.from("lotes_medicamento").insert({
            medicamento_id: movForm.medicamento_id,
            numero_lote: movForm.numero_lote,
            fecha_caducidad: movForm.fecha_caducidad || new Date(Date.now() + 365*24*60*60*1000).toISOString().split("T")[0],
            existencia: cantidad,
          }).select().single();
          if (error) throw error;
          loteId = nuevoLote.id;
          setLotes(p => [...p, nuevoLote]);
        }
      } else if (loteId) {
        const lote = lotes.find(l => l.id === loteId);
        if (lote) {
          const nueva = Math.max(0, lote.existencia - cantidad);
          await supabase.from("lotes_medicamento").update({ existencia: nueva }).eq("id", lote.id);
          setLotes(p => p.map(l => l.id === lote.id ? { ...l, existencia: nueva } : l));
        }
      }

      const { error } = await supabase.from("movimientos_inventario").insert({
        medicamento_id: movForm.medicamento_id, lote_id: loteId,
        tipo: movForm.tipo as any, cantidad, motivo: movForm.motivo || null,
      });
      if (error) throw error;

      toast({ title: movForm.tipo === "entrada" ? "Entrada registrada" : "Salida registrada" });
      setMovModal(false);
      setMovForm(EMPTY_MOV);
    } catch (e: any) {
      toast({ variant:"destructive", title:"Error", description:e.message });
    }
    setSavingMov(false);
  }

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="pos">Punto de venta</TabsTrigger>
          <TabsTrigger value="surtir">Surtir receta</TabsTrigger>
          <TabsTrigger value="venta">Venta directa</TabsTrigger>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
        </TabsList>
        <TabsContent value="pos">
          <PuntoDeVenta
            onScanPrescription={(code) => { setPrescriptionScan(code); setTab("surtir"); }}
          />
        </TabsContent>
        <TabsContent value="surtir">
          <SurtirReceta initialCode={prescriptionScan ?? undefined} />
        </TabsContent>
        <TabsContent value="venta"><VentaDirecta /></TabsContent>
        <TabsContent value="inventario" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Farmacia y almacén</h1>
          <p className="mt-1 text-sm text-muted-foreground">Control de inventario y dispensación</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openMov("salida")}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />Salida
            </Button>
            <Button onClick={() => openMov("entrada")}>
              <ArrowDownCircle className="mr-2 h-4 w-4" />Entrada
            </Button>
          </div>
        )}
      </div>

      {/* Alertas */}
      {bajosStock.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">⚠ {bajosStock.length} medicamento{bajosStock.length > 1 ? "s" : ""} bajo mínimo</p>
            <p className="text-xs text-muted-foreground mt-0.5">{bajosStock.map(m => m.nombre).join(", ")}</p>
          </div>
        </div>
      )}
      {proxCaducidad.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{proxCaducidad.length} lote{proxCaducidad.length > 1 ? "s" : ""} próximos a caducar (30 días)</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Package, label: "Total productos", value: medicamentos.length, color: "" },
          { icon: Pill, label: "Lotes activos", value: lotes.filter(l => l.existencia > 0).length, color: "" },
          { icon: AlertTriangle, label: "Stock bajo", value: bajosStock.length, color: "text-destructive" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className={`flex items-center gap-2 text-sm font-medium text-muted-foreground ${color}`}>
              <Icon className="h-4 w-4" />{label}
            </div>
            <p className={`mt-1 text-2xl font-bold ${color || "text-foreground"}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Búsqueda + nuevo */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, código de barras, SKU, laboratorio, principio activo..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canWrite && (
          <Button variant="outline" onClick={openNewMed}>
            <Plus className="mr-2 h-4 w-4" />Nuevo medicamento
          </Button>
        )}
      </div>

      {/* Lista de medicamentos */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Pill className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p>No se encontraron medicamentos</p>
          {canWrite && <Button variant="outline" className="mt-4" onClick={openNewMed}><Plus className="mr-2 h-4 w-4" />Registrar medicamento</Button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(med => {
            const stock = stockTotal(med.id);
            const bajo = stock < med.stock_minimo;
            const isOpen = expanded === med.id;
            const lotesActivos = lotesDe(med.id).filter(l => l.existencia > 0);
            return (
              <div key={med.id} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : med.id)}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Pill className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-card-foreground truncate">{med.nombre}</p>
                    <p className="text-xs text-muted-foreground">{med.categoria} · {med.unidad}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <Badge variant={bajo ? "destructive" : "secondary"}>
                      {stock} {bajo ? "⚠ bajo mínimo" : "en stock"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{formatMXN(med.precio_unitario)}</span>
                  </div>
                  {canWrite && (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openMov("entrada", med.id)}>
                        <ArrowDownCircle className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openMov("salida", med.id)}>
                        <ArrowUpCircle className="h-4 w-4 text-orange-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditMed(med)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>

                {isOpen && (
                  <div className="border-t border-border px-5 py-4 bg-muted/10 space-y-3">
                    {med.descripcion && <p className="text-sm text-muted-foreground">{med.descripcion}</p>}
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Lotes ({lotesActivos.length})</p>
                      <p className="text-xs text-muted-foreground">Mínimo: {med.stock_minimo} {med.unidad}</p>
                    </div>
                    {lotesActivos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin lotes con existencia</p>
                    ) : (
                      <div className="space-y-1">
                        {lotesDe(med.id).map(lote => {
                          const cad = new Date(lote.fecha_caducidad);
                          const vencido = cad < hoy;
                          const prox = cad <= en30 && !vencido;
                          return (
                            <div key={lote.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs">
                              <span className="font-medium">{lote.numero_lote}</span>
                              <span className={`${vencido ? "text-destructive" : prox ? "text-warning" : "text-muted-foreground"}`}>
                                Cad: {format(cad, "dd/MM/yyyy", { locale: es })}
                                {vencido ? " ⚠ VENCIDO" : prox ? " ⚠ Próximo" : ""}
                              </span>
                              <Badge variant={lote.existencia === 0 ? "outline" : "secondary"}>
                                {lote.existencia} {med.unidad}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {canWrite && (
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => deactivateMed(med)}>
                        Desactivar medicamento
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal medicamento */}
      <Dialog open={medModal} onOpenChange={v => !v && setMedModal(false)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editMed ? "Editar medicamento" : "Nuevo medicamento"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            {/* Identificación básica */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nombre comercial *</Label>
                <Input value={medForm.nombre} onChange={e => setMedForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Tempra 500 mg" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Código de barras</Label>
                  <Input value={medForm.barcode} onChange={e => setMedForm(f => ({ ...f, barcode: e.target.value }))} placeholder="EAN-13 / UPC" />
                </div>
                <div className="space-y-1.5">
                  <Label>SKU</Label>
                  <Input value={medForm.sku} onChange={e => setMedForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU proveedor" />
                </div>
                <div className="space-y-1.5">
                  <Label>Código interno</Label>
                  <Input value={medForm.codigo_interno} onChange={e => setMedForm(f => ({ ...f, codigo_interno: e.target.value }))} placeholder="Clave interna" />
                </div>
              </div>
            </div>

            {/* Datos farmacéuticos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Laboratorio</Label>
                <Input value={medForm.laboratorio} onChange={e => setMedForm(f => ({ ...f, laboratorio: e.target.value }))} placeholder="Ej: Pfizer" />
              </div>
              <div className="space-y-1.5">
                <Label>Principio activo</Label>
                <Input value={medForm.principio_activo} onChange={e => setMedForm(f => ({ ...f, principio_activo: e.target.value }))} placeholder="Ej: Paracetamol" />
              </div>
              <div className="space-y-1.5">
                <Label>Forma farmacéutica</Label>
                <Input value={medForm.forma_farmaceutica} onChange={e => setMedForm(f => ({ ...f, forma_farmaceutica: e.target.value }))} placeholder="Tableta, jarabe, ampolla..." />
              </div>
              <div className="space-y-1.5">
                <Label>Concentración</Label>
                <Input value={medForm.concentracion} onChange={e => setMedForm(f => ({ ...f, concentracion: e.target.value }))} placeholder="Ej: 500 mg" />
              </div>
              <div className="space-y-1.5">
                <Label>Presentación</Label>
                <Input value={medForm.presentacion} onChange={e => setMedForm(f => ({ ...f, presentacion: e.target.value }))} placeholder="Caja c/20, frasco 120 ml..." />
              </div>
              <div className="space-y-1.5">
                <Label>Registro sanitario (COFEPRIS)</Label>
                <Input value={medForm.registro_sanitario} onChange={e => setMedForm(f => ({ ...f, registro_sanitario: e.target.value }))} placeholder="N° de registro" />
              </div>
            </div>

            {/* Comerciales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={medForm.categoria} onValueChange={v => setMedForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unidad</Label>
                <Select value={medForm.unidad} onValueChange={v => setMedForm(f => ({ ...f, unidad: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Precio ($)</Label>
                <Input type="number" min="0" step="0.01" value={medForm.precio_unitario}
                  onChange={e => setMedForm(f => ({ ...f, precio_unitario: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Stock mínimo</Label>
                <Input type="number" min="0" value={medForm.stock_minimo}
                  onChange={e => setMedForm(f => ({ ...f, stock_minimo: e.target.value }))} />
              </div>
            </div>

            {/* Regulatorio */}
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="space-y-1.5">
                <Label>Tipo de venta *</Label>
                <Select value={medForm.sale_type} onValueChange={v => {
                  const blocks = ["receta_requerida","receta_retenida","controlado"].includes(v);
                  setMedForm(f => ({
                    ...f,
                    sale_type: v,
                    allow_direct_sale: blocks ? false : f.allow_direct_sale,
                    requires_prescription: blocks ? true : f.requires_prescription,
                    is_controlled: v === "controlado" ? true : f.is_controlled,
                  }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SALE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {medForm.is_controlled && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>Medicamento sujeto a control sanitario. La venta directa queda bloqueada y debe surtirse contra receta correspondiente.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={medForm.allow_direct_sale}
                    disabled={["receta_requerida","receta_retenida","controlado"].includes(medForm.sale_type)}
                    onChange={e => setMedForm(f => ({ ...f, allow_direct_sale: e.target.checked }))} />
                  Permitir venta directa
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={medForm.requires_prescription}
                    disabled={["receta_requerida","receta_retenida","controlado"].includes(medForm.sale_type)}
                    onChange={e => setMedForm(f => ({ ...f, requires_prescription: e.target.checked }))} />
                  Requiere receta
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={medForm.is_controlled}
                    disabled={medForm.sale_type === "controlado"}
                    onChange={e => setMedForm(f => ({ ...f, is_controlled: e.target.checked }))} />
                  Es controlado
                </label>
              </div>

              <div className="space-y-1.5">
                <Label>Notas regulatorias</Label>
                <Textarea value={medForm.regulatory_notes}
                  onChange={e => setMedForm(f => ({ ...f, regulatory_notes: e.target.value }))}
                  placeholder="Restricciones, observaciones COFEPRIS..." rows={2} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descripción / indicaciones</Label>
              <Textarea value={medForm.descripcion} onChange={e => setMedForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Indicaciones, observaciones..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMedModal(false)}>Cancelar</Button>
            <Button onClick={saveMed} disabled={savingMed}>{savingMed ? "Guardando..." : editMed ? "Guardar cambios" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal movimiento */}
      <Dialog open={movModal} onOpenChange={v => !v && setMovModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{movForm.tipo === "entrada" ? "Registrar entrada" : movForm.tipo === "salida" ? "Dispensar / Salida" : "Ajuste de inventario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tipo de movimiento</Label>
              <Select value={movForm.tipo} onValueChange={v => setMovForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (compra / recepción)</SelectItem>
                  <SelectItem value="salida">Salida (dispensación)</SelectItem>
                  <SelectItem value="ajuste">Ajuste de inventario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Medicamento *</Label>
              <Select value={movForm.medicamento_id} onValueChange={v => setMovForm(f => ({ ...f, medicamento_id: v, lote_id: "" }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {medicamentos.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {movForm.tipo === "entrada" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Número de lote *</Label>
                  <Input value={movForm.numero_lote} onChange={e => setMovForm(f => ({ ...f, numero_lote: e.target.value }))} placeholder="LOT-2026-XXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de caducidad</Label>
                  <Input type="date" value={movForm.fecha_caducidad} onChange={e => setMovForm(f => ({ ...f, fecha_caducidad: e.target.value }))} />
                </div>
              </>
            ) : movForm.medicamento_id ? (
              <div className="space-y-1.5">
                <Label>Lote</Label>
                <Select value={movForm.lote_id} onValueChange={v => setMovForm(f => ({ ...f, lote_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar lote" /></SelectTrigger>
                  <SelectContent>
                    {lotesDe(movForm.medicamento_id).filter(l => l.existencia > 0).map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.numero_lote} — {l.existencia} unid — cad. {format(new Date(l.fecha_caducidad), "dd/MM/yyyy", { locale: es })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Cantidad *</Label>
              <Input type="number" min="1" value={movForm.cantidad} onChange={e => setMovForm(f => ({ ...f, cantidad: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo / notas</Label>
              <Input value={movForm.motivo} onChange={e => setMovForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovModal(false)}>Cancelar</Button>
            <Button onClick={saveMov} disabled={savingMov}>
              {savingMov ? "Guardando..." : movForm.tipo === "entrada" ? "Registrar entrada" : "Registrar salida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}

