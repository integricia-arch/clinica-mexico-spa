import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLibroControlControlados, ETIQUETAS_CONTROL, LibroControl, LibroMovimiento } from "@/hooks/useLibroControlControlados";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { toast } from "@/lib/toast";
import { BookOpen, Plus, ChevronDown, ChevronUp, LogIn, LogOut, Shield, AlertTriangle, Check } from "lucide-react";

interface Medicamento {
  id: string;
  nombre: string;
  tipo_control?: string;
}

interface Props {
  medicamentos: Medicamento[];
}

const fmt = (n: number) => n.toLocaleString("es-MX");
const fmtDate = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("es-MX");

const BADGE_CONTROL: Record<string, { label: string; color: string }> = {
  psicotropico_iii:   { label: "Psicotrópico III",  color: "bg-orange-100 text-orange-700 border-0" },
  psicotropico_i_ii:  { label: "Psicotrópico I-II", color: "bg-red-100 text-red-700 border-0" },
  estupefaciente:     { label: "Estupefaciente",     color: "bg-red-200 text-red-900 border-0" },
};

const TIPO_MOV_LABEL: Record<string, string> = {
  entrada: "Entrada", salida: "Salida", ajuste: "Ajuste", destruccion: "Destrucción",
};

export default function LibroControlControlados({ medicamentos }: Props) {
  const { activeClinicId } = useActiveClinic();
  const {
    libros, librosActivos, loading, error,
    createLibro, registrarEntrada, registrarSalida, firmarMovimiento,
    getMovimientos, refresh,
  } = useLibroControlControlados(activeClinicId);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [movimientos, setMovimientos] = useState<Record<string, LibroMovimiento[]>>({});

  // Dialogs
  const [newLibroOpen, setNewLibroOpen] = useState(false);
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [salidaOpen, setSalidaOpen] = useState(false);
  const [selectedLibro, setSelectedLibro] = useState<LibroControl | null>(null);
  const [saving, setSaving] = useState(false);

  // Formulario nuevo libro
  const [libroForm, setLibroForm] = useState({
    medicamento_id: "", periodo_inicio: new Date().toISOString().split("T")[0],
    responsable_sanitario: "", folio_cofepris: "", notas: "",
  });

  // Formulario entrada
  const [entradaForm, setEntradaForm] = useState({
    fecha_movimiento: new Date().toISOString().split("T")[0],
    cantidad: "", numero_lote: "", fecha_caducidad: "",
    numero_factura: "", notas: "",
  });

  // Formulario salida
  const [salidaForm, setSalidaForm] = useState({
    fecha_movimiento: new Date().toISOString().split("T")[0],
    cantidad: "", numero_lote: "", numero_receta: "",
    cedula_medico: "", nombre_medico: "", nombre_paciente: "", diagnostico: "", notas: "",
  });

  const medicamentosControlados = medicamentos.filter((m) =>
    m.tipo_control && m.tipo_control !== "otc" && m.tipo_control !== "rx_simple"
  );

  const toggleExpand = useCallback(async (libro: LibroControl) => {
    if (expandedId === libro.id) { setExpandedId(null); return; }
    setExpandedId(libro.id);
    if (!movimientos[libro.id]) {
      const movs = await getMovimientos(libro.id);
      setMovimientos((prev) => ({ ...prev, [libro.id]: movs }));
    }
  }, [expandedId, movimientos, getMovimientos]);

  const handleCreateLibro = async () => {
    if (!libroForm.medicamento_id) { toast.error("Selecciona un medicamento"); return; }
    setSaving(true);
    try {
      await createLibro(libroForm);
      toast.success("Libro de control creado");
      setNewLibroOpen(false);
      setLibroForm({ medicamento_id: "", periodo_inicio: new Date().toISOString().split("T")[0], responsable_sanitario: "", folio_cofepris: "", notas: "" });
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  const handleEntrada = async () => {
    if (!selectedLibro) return;
    setSaving(true);
    try {
      await registrarEntrada({
        libro_id: selectedLibro.id,
        medicamento_id: selectedLibro.medicamento_id,
        fecha_movimiento: entradaForm.fecha_movimiento,
        cantidad: parseInt(entradaForm.cantidad) || 0,
        lote_id: null,
        numero_lote: entradaForm.numero_lote,
        fecha_caducidad: entradaForm.fecha_caducidad,
        recepcion_id: null, orden_id: null, proveedor_id: null,
        numero_factura: entradaForm.numero_factura,
        notas: entradaForm.notas,
      });
      const movs = await getMovimientos(selectedLibro.id);
      setMovimientos((prev) => ({ ...prev, [selectedLibro.id]: movs }));
      toast.success("Entrada registrada en libro de control");
      setEntradaOpen(false);
      setEntradaForm({ fecha_movimiento: new Date().toISOString().split("T")[0], cantidad: "", numero_lote: "", fecha_caducidad: "", numero_factura: "", notas: "" });
      refresh();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  const handleSalida = async () => {
    if (!selectedLibro) return;
    setSaving(true);
    try {
      await registrarSalida({
        libro_id: selectedLibro.id,
        medicamento_id: selectedLibro.medicamento_id,
        fecha_movimiento: salidaForm.fecha_movimiento,
        cantidad: parseInt(salidaForm.cantidad) || 0,
        lote_id: null,
        numero_lote: salidaForm.numero_lote,
        numero_receta: salidaForm.numero_receta,
        cedula_medico: salidaForm.cedula_medico,
        nombre_medico: salidaForm.nombre_medico,
        nombre_paciente: salidaForm.nombre_paciente,
        diagnostico: salidaForm.diagnostico,
        notas: salidaForm.notas,
      });
      const movs = await getMovimientos(selectedLibro.id);
      setMovimientos((prev) => ({ ...prev, [selectedLibro.id]: movs }));
      toast.success("Salida registrada en libro de control");
      setSalidaOpen(false);
      setSalidaForm({ fecha_movimiento: new Date().toISOString().split("T")[0], cantidad: "", numero_lote: "", numero_receta: "", cedula_medico: "", nombre_medico: "", nombre_paciente: "", diagnostico: "", notas: "" });
      refresh();
    } catch (e) { toast.error(String(e)); }
    finally { setSaving(false); }
  };

  const handleFirmar = async (movId: string, libroId: string) => {
    try {
      await firmarMovimiento(movId);
      const movs = await getMovimientos(libroId);
      setMovimientos((prev) => ({ ...prev, [libroId]: movs }));
      toast.success("Movimiento firmado");
    } catch (e) { toast.error(String(e)); }
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground text-sm">Cargando libros de control…</div>;
  if (error) return <div className="py-12 text-center text-destructive text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-600" />
            Libro de Control — Psicotrópicos y Estupefacientes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Art. 237-240 LGS · COFEPRIS-03-005 · {librosActivos.length} libro(s) activo(s)
          </p>
        </div>
        <Button onClick={() => setNewLibroOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo libro
        </Button>
      </div>

      {medicamentosControlados.length === 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 flex gap-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-orange-800">Sin medicamentos controlados catalogados</p>
            <p className="text-orange-700 text-xs mt-1">
              Configura el tipo de control (Psicotrópico / Estupefaciente) en el catálogo de medicamentos para habilitar el libro de control COFEPRIS.
            </p>
          </div>
        </div>
      )}

      {libros.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <BookOpen className="h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Sin libros de control registrados</p>
          <p className="text-xs">Crea un libro para cada sustancia controlada que manejes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {libros.map((libro) => {
            const badge = BADGE_CONTROL[libro.tipo_control ?? ""] ?? null;
            const expanded = expandedId === libro.id;
            const movs = movimientos[libro.id] ?? [];
            const saldoActual = movs.length > 0 ? movs[movs.length - 1].saldo_posterior : 0;

            return (
              <div key={libro.id} className="rounded-xl border border-border/60 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(libro)}
                >
                  <div className="flex items-center gap-3 text-left">
                    <BookOpen className="h-4 w-4 text-red-600 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{libro.medicamento_nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        Desde {fmtDate(libro.periodo_inicio)}
                        {libro.periodo_fin ? ` hasta ${fmtDate(libro.periodo_fin)}` : " · vigente"}
                        {libro.folio_cofepris ? ` · Folio COFEPRIS: ${libro.folio_cofepris}` : ""}
                      </p>
                    </div>
                    {badge && <Badge className={`text-xs ${badge.color}`}>{badge.label}</Badge>}
                    {libro.cerrado && <Badge variant="outline" className="text-xs">Cerrado</Badge>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Saldo</p>
                      <p className="font-bold text-sm">{fmt(saldoActual)}</p>
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border/40 px-4 py-3 space-y-3 bg-muted/10">
                    {!libro.cerrado && (
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSelectedLibro(libro); setEntradaOpen(true); }}>
                          <LogIn className="h-3.5 w-3.5 text-green-600" /> Registrar entrada
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSelectedLibro(libro); setSalidaOpen(true); }}>
                          <LogOut className="h-3.5 w-3.5 text-orange-600" /> Registrar salida
                        </Button>
                      </div>
                    )}

                    {movs.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Sin movimientos registrados</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/30 text-muted-foreground">
                              <th className="px-3 py-2 text-left font-medium">Fecha</th>
                              <th className="px-3 py-2 text-left font-medium">Tipo</th>
                              <th className="px-3 py-2 text-left font-medium">Lote</th>
                              <th className="px-3 py-2 text-center font-medium">Cant.</th>
                              <th className="px-3 py-2 text-center font-medium">Saldo ant.</th>
                              <th className="px-3 py-2 text-center font-medium">Saldo post.</th>
                              <th className="px-3 py-2 text-left font-medium">Receta / Factura</th>
                              <th className="px-3 py-2 text-left font-medium">Paciente / Proveedor</th>
                              <th className="px-3 py-2 text-center font-medium">Firma</th>
                            </tr>
                          </thead>
                          <tbody>
                            {movs.map((m) => (
                              <tr key={m.id} className={`border-b border-border/40 hover:bg-muted/20 ${m.tipo === "salida" ? "bg-red-50/30 dark:bg-red-950/10" : m.tipo === "entrada" ? "bg-green-50/30 dark:bg-green-950/10" : ""}`}>
                                <td className="px-3 py-1.5">{fmtDate(m.fecha_movimiento)}</td>
                                <td className="px-3 py-1.5">
                                  <Badge className={`text-xs border-0 ${m.tipo === "entrada" ? "bg-green-100 text-green-700" : m.tipo === "salida" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                                    {TIPO_MOV_LABEL[m.tipo]}
                                  </Badge>
                                </td>
                                <td className="px-3 py-1.5 font-mono text-xs">{m.numero_lote ?? "—"}</td>
                                <td className="px-3 py-1.5 text-center font-medium">{fmt(m.cantidad)}</td>
                                <td className="px-3 py-1.5 text-center text-muted-foreground">{fmt(m.saldo_anterior)}</td>
                                <td className="px-3 py-1.5 text-center font-bold">{fmt(m.saldo_posterior)}</td>
                                <td className="px-3 py-1.5">
                                  {m.tipo === "salida" ? (
                                    <span>Receta {m.numero_receta}</span>
                                  ) : (
                                    <span>{m.numero_factura ?? "—"}</span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
                                  {m.tipo === "salida" ? (
                                    <span>{m.nombre_paciente}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  {m.firmado_at ? (
                                    <Check className="h-3.5 w-3.5 text-green-600 mx-auto" />
                                  ) : (
                                    <button
                                      className="text-xs text-blue-600 hover:underline"
                                      onClick={() => handleFirmar(m.id, libro.id)}
                                    >
                                      Firmar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-muted/20">
                              <td colSpan={5} className="px-3 py-1.5 text-xs text-muted-foreground">
                                {movs.length} movimiento(s)
                              </td>
                              <td className="px-3 py-1.5 text-center font-bold text-sm">{fmt(saldoActual)}</td>
                              <td colSpan={3} />
                            </tr>
                          </tfoot>
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

      {/* Dialog: Nuevo libro */}
      <Dialog open={newLibroOpen} onOpenChange={setNewLibroOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuevo Libro de Control</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Medicamento controlado *</Label>
              <Select value={libroForm.medicamento_id} onValueChange={(v) => setLibroForm((p) => ({ ...p, medicamento_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar medicamento…" /></SelectTrigger>
                <SelectContent>
                  {medicamentosControlados.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre} · {ETIQUETAS_CONTROL[m.tipo_control as keyof typeof ETIQUETAS_CONTROL] ?? m.tipo_control}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {medicamentosControlados.length === 0 && (
                <p className="text-xs text-orange-600">No hay medicamentos con tipo de control configurado. Ve al catálogo y asigna el tipo de control.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Fecha de apertura *</Label>
              <Input type="date" value={libroForm.periodo_inicio} onChange={(e) => setLibroForm((p) => ({ ...p, periodo_inicio: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Responsable Sanitario (QFB)</Label>
              <Input placeholder="Nombre y cédula profesional" value={libroForm.responsable_sanitario} onChange={(e) => setLibroForm((p) => ({ ...p, responsable_sanitario: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Folio COFEPRIS (si aplica)</Label>
              <Input placeholder="Ej: LCE-2026-0042" value={libroForm.folio_cofepris} onChange={(e) => setLibroForm((p) => ({ ...p, folio_cofepris: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input value={libroForm.notas} onChange={(e) => setLibroForm((p) => ({ ...p, notas: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">Art. 237-240 LGS · COFEPRIS-03-005 · Trámite Libros de Control</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLibroOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleCreateLibro} disabled={saving}>{saving ? "Creando…" : "Crear libro"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar entrada */}
      <Dialog open={entradaOpen} onOpenChange={setEntradaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><LogIn className="h-4 w-4 text-green-600" /> Entrada — {selectedLibro?.medicamento_nombre}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fecha *</Label>
                <Input type="date" value={entradaForm.fecha_movimiento} onChange={(e) => setEntradaForm((p) => ({ ...p, fecha_movimiento: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Cantidad *</Label>
                <Input type="number" min={1} value={entradaForm.cantidad} onChange={(e) => setEntradaForm((p) => ({ ...p, cantidad: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Número de lote *</Label>
                <Input value={entradaForm.numero_lote} onChange={(e) => setEntradaForm((p) => ({ ...p, numero_lote: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Fecha caducidad</Label>
                <Input type="date" value={entradaForm.fecha_caducidad} onChange={(e) => setEntradaForm((p) => ({ ...p, fecha_caducidad: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Número de factura (CFDI)</Label>
              <Input placeholder="Folio o UUID de factura" value={entradaForm.numero_factura} onChange={(e) => setEntradaForm((p) => ({ ...p, numero_factura: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input value={entradaForm.notas} onChange={(e) => setEntradaForm((p) => ({ ...p, notas: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntradaOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleEntrada} disabled={saving} className="bg-green-600 hover:bg-green-700">{saving ? "Guardando…" : "Registrar entrada"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar salida */}
      <Dialog open={salidaOpen} onOpenChange={setSalidaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><LogOut className="h-4 w-4 text-red-600" /> Salida — {selectedLibro?.medicamento_nombre}</DialogTitle></DialogHeader>
          <Tabs defaultValue="prescripcion">
            <TabsList className="w-full">
              <TabsTrigger value="prescripcion" className="flex-1">Prescripción</TabsTrigger>
              <TabsTrigger value="lote" className="flex-1">Lote / Cantidad</TabsTrigger>
            </TabsList>
            <TabsContent value="prescripcion" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>N° Receta *</Label>
                  <Input value={salidaForm.numero_receta} onChange={(e) => setSalidaForm((p) => ({ ...p, numero_receta: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Cédula médico *</Label>
                  <Input value={salidaForm.cedula_medico} onChange={(e) => setSalidaForm((p) => ({ ...p, cedula_medico: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Nombre del médico</Label>
                <Input value={salidaForm.nombre_medico} onChange={(e) => setSalidaForm((p) => ({ ...p, nombre_medico: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Nombre del paciente *</Label>
                <Input value={salidaForm.nombre_paciente} onChange={(e) => setSalidaForm((p) => ({ ...p, nombre_paciente: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Diagnóstico</Label>
                <Input value={salidaForm.diagnostico} onChange={(e) => setSalidaForm((p) => ({ ...p, diagnostico: e.target.value }))} />
              </div>
            </TabsContent>
            <TabsContent value="lote" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Fecha *</Label>
                  <Input type="date" value={salidaForm.fecha_movimiento} onChange={(e) => setSalidaForm((p) => ({ ...p, fecha_movimiento: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Cantidad *</Label>
                  <Input type="number" min={1} value={salidaForm.cantidad} onChange={(e) => setSalidaForm((p) => ({ ...p, cantidad: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Número de lote</Label>
                <Input value={salidaForm.numero_lote} onChange={(e) => setSalidaForm((p) => ({ ...p, numero_lote: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Notas</Label>
                <Input value={salidaForm.notas} onChange={(e) => setSalidaForm((p) => ({ ...p, notas: e.target.value }))} />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalidaOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSalida} disabled={saving} variant="destructive">{saving ? "Guardando…" : "Registrar salida"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
