import { useEffect, useState } from "react";
import { restSelect, restInsert } from "@/lib/restClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, AlertTriangle, Package, Pill, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const formatMXN = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const CATEGORIAS = ["Analgésico","Antibiótico","Antiinflamatorio","Antihipertensivo","Antidiabético",
  "Gastrointestinal","Antihistamínico","Tópico","Vitaminas","Otro"];

const UNIDADES = ["pieza","caja","frasco","ampolleta","sobre","tableta","ml","g"];

type Medicamento = { id: string; nombre: string; categoria: string; precio_unitario: number; stock_minimo: number; unidad: string; activo: boolean };
type Lote = { id: string; medicamento_id: string; numero_lote: string; fecha_caducidad: string; existencia: number };
type MovForm = { medicamento_id: string; lote_id: string; tipo: string; cantidad: string; motivo: string; numero_lote: string; fecha_caducidad: string };

const EMPTY_MOV: MovForm = { medicamento_id: "", lote_id: "", tipo: "entrada", cantidad: "", motivo: "", numero_lote: "", fecha_caducidad: "" };
const EMPTY_MED = { nombre: "", categoria: "Analgésico", descripcion: "", precio_unitario: "", stock_minimo: "0", unidad: "pieza" };

export default function Farmacia() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const canWrite = hasRole("admin") || hasRole("nurse");

  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [medModal, setMedModal] = useState(false);
  const [medForm, setMedForm] = useState(EMPTY_MED);
  const [savingMed, setSavingMed] = useState(false);

  const [movModal, setMovModal] = useState(false);
  const [movForm, setMovForm] = useState<MovForm>(EMPTY_MOV);
  const [savingMov, setSavingMov] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [meds, lts] = await Promise.all([
        restSelect("medicamentos", "select=*&activo=eq.true&order=nombre.asc"),
        restSelect("lotes_medicamento", "select=*&order=fecha_caducidad.asc"),
      ]);
      setMedicamentos(meds ?? []);
      setLotes(lts ?? []);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
    setLoading(false);
  }

  // Stock total por medicamento
  const stockPorMed = (medId: string) =>
    lotes.filter((l) => l.medicamento_id === medId).reduce((s, l) => s + l.existencia, 0);

  const lotesPorMed = (medId: string) => lotes.filter((l) => l.medicamento_id === medId);

  const filtered = medicamentos.filter((m) =>
    m.nombre.toLowerCase().includes(search.toLowerCase()) ||
    m.categoria.toLowerCase().includes(search.toLowerCase())
  );

  const bajosStock = medicamentos.filter((m) => stockPorMed(m.id) < m.stock_minimo);

  // Caducados o próximos a caducar (30 días)
  const hoy = new Date();
  const en30 = new Date(); en30.setDate(hoy.getDate() + 30);
  const proxCaducidad = lotes.filter((l) => new Date(l.fecha_caducidad) <= en30 && l.existencia > 0);

  async function handleSaveMed() {
    if (!medForm.nombre.trim()) {
      toast({ variant: "destructive", title: "Error", description: "El nombre es requerido" });
      return;
    }
    setSavingMed(true);
    try {
      const data = await restInsert("medicamentos", {
        nombre: medForm.nombre.trim(),
        categoria: medForm.categoria,
        descripcion: medForm.descripcion || null,
        precio_unitario: parseFloat(medForm.precio_unitario as any) || 0,
        stock_minimo: parseInt(medForm.stock_minimo as any) || 0,
        unidad: medForm.unidad,
      });
      setMedicamentos((m) => [...m, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setMedModal(false);
      setMedForm(EMPTY_MED);
      toast({ title: "Medicamento registrado" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
    setSavingMed(false);
  }

  async function handleSaveMov() {
    if (!movForm.medicamento_id || !movForm.cantidad || parseInt(movForm.cantidad) <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Selecciona medicamento y cantidad válida" });
      return;
    }
    if (movForm.tipo === "entrada" && !movForm.numero_lote) {
      toast({ variant: "destructive", title: "Error", description: "Número de lote requerido para entradas" });
      return;
    }
    setSavingMov(true);
    try {
      const cantidad = parseInt(movForm.cantidad);
      let loteId = movForm.lote_id || null;

      if (movForm.tipo === "entrada") {
        // Crear o actualizar lote
        const lotesExistentes = lotesPorMed(movForm.medicamento_id);
        const loteExistente = lotesExistentes.find((l) => l.numero_lote === movForm.numero_lote);
        if (loteExistente) {
          await restSelect("lotes_medicamento",
            `select=id&id=eq.${loteExistente.id}`
          );
          // update via REST PATCH
          const { supabase } = await import("@/integrations/supabase/client");
          await supabase.from("lotes_medicamento" as any).update({ existencia: loteExistente.existencia + cantidad }).eq("id", loteExistente.id);
          loteId = loteExistente.id;
        } else {
          const nuevoLote = await restInsert("lotes_medicamento", {
            medicamento_id: movForm.medicamento_id,
            numero_lote: movForm.numero_lote,
            fecha_caducidad: movForm.fecha_caducidad || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            existencia: cantidad,
          });
          loteId = nuevoLote.id;
          setLotes((l) => [...l, nuevoLote]);
        }
      } else if (movForm.lote_id) {
        const lote = lotes.find((l) => l.id === movForm.lote_id);
        if (lote) {
          const { supabase } = await import("@/integrations/supabase/client");
          await supabase.from("lotes_medicamento" as any).update({ existencia: Math.max(0, lote.existencia - cantidad) }).eq("id", lote.id);
          setLotes((prev) => prev.map((l) => l.id === lote.id ? { ...l, existencia: Math.max(0, l.existencia - cantidad) } : l));
        }
      }

      await restInsert("movimientos_inventario", {
        medicamento_id: movForm.medicamento_id,
        lote_id: loteId,
        tipo: movForm.tipo,
        cantidad,
        motivo: movForm.motivo || null,
      });

      if (movForm.tipo === "entrada") await loadData();
      setMovModal(false);
      setMovForm(EMPTY_MOV);
      toast({ title: movForm.tipo === "entrada" ? "Entrada registrada" : "Salida registrada" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
    setSavingMov(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-display text-2xl font-bold text-foreground">Farmacia y almacén</h1>
          <p className="mt-1 text-sm text-muted-foreground">Control de inventario y dispensación</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setMovForm({ ...EMPTY_MOV, tipo: "salida" }); setMovModal(true); }}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />Salida
            </Button>
            <Button onClick={() => { setMovForm({ ...EMPTY_MOV, tipo: "entrada" }); setMovModal(true); }}>
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
            <p className="text-sm font-medium text-foreground">
              {bajosStock.length} medicamento{bajosStock.length > 1 ? "s" : ""} bajo mínimo
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {bajosStock.map((m) => m.nombre).join(", ")}
            </p>
          </div>
        </div>
      )}

      {proxCaducidad.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {proxCaducidad.length} lote{proxCaducidad.length > 1 ? "s" : ""} próximos a caducar (30 días)
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Package className="h-4 w-4" />Total productos
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{medicamentos.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Pill className="h-4 w-4" />Total lotes activos
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {lotes.filter((l) => l.existencia > 0).length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-destructive text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />Stock bajo
          </div>
          <p className="mt-1 text-2xl font-bold text-destructive">{bajosStock.length}</p>
        </div>
      </div>

      {/* Búsqueda + agregar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o categoría..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canWrite && (
          <Button variant="outline" onClick={() => { setMedForm(EMPTY_MED); setMedModal(true); }}>
            <Plus className="mr-2 h-4 w-4" />Nuevo medicamento
          </Button>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Pill className="mx-auto h-10 w-10 mb-3 opacity-30" />
          <p>No se encontraron medicamentos</p>
          {canWrite && <Button variant="outline" className="mt-4" onClick={() => setMedModal(true)}><Plus className="mr-2 h-4 w-4" />Registrar medicamento</Button>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-5 py-3 font-semibold text-muted-foreground">Medicamento</th>
                <th className="px-5 py-3 font-semibold text-muted-foreground hidden md:table-cell">Categoría</th>
                <th className="px-5 py-3 font-semibold text-muted-foreground">Existencia</th>
                <th className="px-5 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Mínimo</th>
                <th className="px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Precio</th>
                <th className="px-5 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Lotes</th>
                {canWrite && <th className="px-5 py-3 font-semibold text-muted-foreground">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((med) => {
                const stock = stockPorMed(med.id);
                const bajo = stock < med.stock_minimo;
                const nLotes = lotesPorMed(med.id).filter((l) => l.existencia > 0).length;
                return (
                  <tr key={med.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-card-foreground">{med.nombre}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">{med.categoria}</td>
                    <td className="px-5 py-3.5">
                      <span className={`font-semibold ${bajo ? "text-destructive" : "text-card-foreground"}`}>
                        {stock} {med.unidad}
                        {bajo && <AlertTriangle className="inline ml-1 h-3 w-3" />}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell text-muted-foreground">{med.stock_minimo}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">{formatMXN(med.precio_unitario)}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">{nLotes} lote{nLotes !== 1 ? "s" : ""}</td>
                    {canWrite && (
                      <td className="px-5 py-3.5">
                        <Button variant="ghost" size="sm"
                          onClick={() => { setMovForm({ ...EMPTY_MOV, medicamento_id: med.id, tipo: "salida" }); setMovModal(true); }}>
                          Dispensar
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nuevo medicamento */}
      <Dialog open={medModal} onOpenChange={(v) => !v && setMedModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuevo medicamento</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={medForm.nombre} onChange={(e) => setMedForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Paracetamol 500mg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={medForm.categoria} onValueChange={(v) => setMedForm((f) => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unidad</Label>
                <Select value={medForm.unidad} onValueChange={(v) => setMedForm((f) => ({ ...f, unidad: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Precio unitario ($)</Label>
                <Input type="number" min="0" step="0.01" value={medForm.precio_unitario}
                  onChange={(e) => setMedForm((f) => ({ ...f, precio_unitario: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Stock mínimo</Label>
                <Input type="number" min="0" value={medForm.stock_minimo}
                  onChange={(e) => setMedForm((f) => ({ ...f, stock_minimo: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMedModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveMed} disabled={savingMed}>{savingMed ? "Guardando..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal movimiento */}
      <Dialog open={movModal} onOpenChange={(v) => !v && setMovModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{movForm.tipo === "entrada" ? "Registrar entrada" : "Registrar salida/dispensación"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={movForm.tipo} onValueChange={(v) => setMovForm((f) => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (compra/recepción)</SelectItem>
                  <SelectItem value="salida">Salida (dispensación)</SelectItem>
                  <SelectItem value="ajuste">Ajuste de inventario</SelectItem>
                  <SelectItem value="caducidad">Baja por caducidad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Medicamento *</Label>
              <Select value={movForm.medicamento_id} onValueChange={(v) => setMovForm((f) => ({ ...f, medicamento_id: v, lote_id: "" }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {medicamentos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {movForm.tipo === "entrada" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Número de lote *</Label>
                  <Input value={movForm.numero_lote} onChange={(e) => setMovForm((f) => ({ ...f, numero_lote: e.target.value }))}
                    placeholder="LOT-2026-XXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de caducidad</Label>
                  <Input type="date" value={movForm.fecha_caducidad}
                    onChange={(e) => setMovForm((f) => ({ ...f, fecha_caducidad: e.target.value }))} />
                </div>
              </>
            ) : movForm.medicamento_id ? (
              <div className="space-y-1.5">
                <Label>Lote</Label>
                <Select value={movForm.lote_id} onValueChange={(v) => setMovForm((f) => ({ ...f, lote_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar lote" /></SelectTrigger>
                  <SelectContent>
                    {lotesPorMed(movForm.medicamento_id).filter((l) => l.existencia > 0).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.numero_lote} — {l.existencia} unid. — cad. {format(new Date(l.fecha_caducidad), "dd/MM/yyyy", { locale: es })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Cantidad *</Label>
              <Input type="number" min="1" value={movForm.cantidad}
                onChange={(e) => setMovForm((f) => ({ ...f, cantidad: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo / notas</Label>
              <Input value={movForm.motivo} onChange={(e) => setMovForm((f) => ({ ...f, motivo: e.target.value }))}
                placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveMov} disabled={savingMov}>
              {savingMov ? "Guardando..." : movForm.tipo === "entrada" ? "Registrar entrada" : "Registrar salida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
