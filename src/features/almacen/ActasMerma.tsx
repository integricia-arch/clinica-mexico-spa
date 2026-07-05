import { useState, useEffect, useCallback } from "react";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useAuth } from "@/hooks/useAuth";
import { useActasMerma, type ActaMerma, type ActaMermaItem } from "@/hooks/useActasMerma";
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedTable";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, ChevronDown, ChevronUp, Plus, ShieldCheck, Trash2, FileWarning,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const fmt = (c: number) => (c / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const MOTIVOS: { value: string; label: string }[] = [
  { value: "vencimiento",      label: "Vencimiento / caducidad" },
  { value: "dano_fisico",      label: "Daño físico o derrame" },
  { value: "contaminacion",    label: "Contaminación" },
  { value: "robo",             label: "Robo o extravío" },
  { value: "ajuste_inventario",label: "Ajuste de inventario" },
  { value: "otro",             label: "Otro" },
];

const ESTATUS_BADGE: Record<ActaMerma["estatus"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  borrador:        { label: "Borrador",        variant: "secondary" },
  pendiente_firma: { label: "Pend. firma",     variant: "outline" },
  firmada:         { label: "Firmada",         variant: "default" },
  rechazada:       { label: "Rechazada",       variant: "destructive" },
};

interface MedOption { id: string; nombre: string; }
interface LoteOption { id: string; numero_lote: string; existencia: number; costo_unitario_centavos: number | null; }
interface Supervisor { user_id: string; full_name: string; email: string; has_pin: boolean; }

const EMPTY_ITEM = (): ActaMermaItem & { _key: number } => ({
  _key: Date.now(), medicamento_id: "", lote_id: null, cantidad: 1,
  costo_unitario_centavos: 0, observacion: "", medicamento_nombre: "", numero_lote: "",
});

export default function ActasMerma() {
  const { activeClinicId } = useActiveClinic();
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const isManager = hasRole("admin") || hasRole("manager");

  const { items: actas, loading, error, create, solicitarFirma, firmar, rechazar, getItems } = useActasMerma(activeClinicId);

  const [medicamentos, setMedicamentos] = useState<MedOption[]>([]);
  const [lotesPorMed, setLotesPorMed] = useState<Record<string, LoteOption[]>>({});
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, ActaMermaItem[]>>({});

  // Nueva acta
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fecha_merma: new Date().toISOString().split("T")[0],
    motivo: "vencimiento",
    descripcion: "",
  });
  const [lineItems, setLineItems] = useState<(ActaMermaItem & { _key: number })[]>([EMPTY_ITEM()]);
  const [costoDrafts, setCostoDrafts] = useState<Record<number, string>>({});

  // Firma supervisor
  const [firmaDialog, setFirmaDialog] = useState<string | null>(null);
  const [firmaPin, setFirmaPin] = useState("");
  const [firmaSupervisorId, setFirmaSupervisorId] = useState("");
  const [firmaError, setFirmaError] = useState("");
  const [firmaSubmitting, setFirmaSubmitting] = useState(false);

  // Rechazo
  const [rechazarDialog, setRechazarDialog] = useState<string | null>(null);
  const [rechazarMotivo, setRechazarMotivo] = useState("");

  useEffect(() => {
    if (!activeClinicId) return;
    supabase.from("medicamentos" as never)
      .select("id, nombre")
      .eq("clinic_id", activeClinicId)
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) =>
        setMedicamentos(((data ?? []) as { id: string; nombre: string }[])
          .map((m) => ({ id: m.id, nombre: m.nombre })))
      );

    supabase.rpc("get_clinic_supervisors", { p_clinic_id: activeClinicId })
      .then(({ data }) => setSupervisors((data ?? []) as Supervisor[]));
  }, [activeClinicId]);

  const loadLotes = useCallback(async (medId: string) => {
    if (lotesPorMed[medId]) return;
    const { data } = await untypedTable("lotes_medicamento")
      .select("id, numero_lote, existencia, costo_unitario_centavos")
      .eq("medicamento_id", medId)
      .gt("existencia", 0)
      .order("fecha_caducidad");
    setLotesPorMed((prev) => ({ ...prev, [medId]: (data ?? []) as LoteOption[] }));
  }, [lotesPorMed]);

  const toggleExpand = useCallback(async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!expandedItems[id]) {
      try {
        const its = await getItems(id);
        setExpandedItems((prev) => ({ ...prev, [id]: its }));
      } catch { /* non-critical */ }
    }
  }, [expanded, expandedItems, getItems]);

  const updateLine = (key: number, field: string, value: unknown) => {
    setLineItems((prev) => prev.map((l) => {
      if (l._key !== key) return l;
      const updated = { ...l, [field]: value };
      if (field === "medicamento_id") {
        updated.lote_id = null;
        updated.medicamento_nombre = medicamentos.find((m) => m.id === value)?.nombre ?? "";
        loadLotes(value as string);
      }
      if (field === "lote_id") {
        const lote = (lotesPorMed[l.medicamento_id] ?? []).find((lt) => lt.id === value);
        if (lote) {
          updated.numero_lote = lote.numero_lote;
          updated.costo_unitario_centavos = lote.costo_unitario_centavos ?? 0;
        }
      }
      return updated;
    }));
  };

  const total = lineItems.reduce((s, l) => s + l.cantidad * l.costo_unitario_centavos, 0);

  const handleSubmit = async () => {
    if (!form.motivo) { toast({ title: "Selecciona un motivo", variant: "destructive" }); return; }
    const valid = lineItems.filter((l) => l.medicamento_id && l.cantidad > 0);
    if (!valid.length) { toast({ title: "Agrega al menos un ítem", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await create({ ...form, items: valid });
      toast({ title: "Acta de merma creada" });
      setDialogOpen(false);
      setForm({ fecha_merma: new Date().toISOString().split("T")[0], motivo: "vencimiento", descripcion: "" });
      setLineItems([EMPTY_ITEM()]);
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSolicitarFirma = async (id: string) => {
    try {
      await solicitarFirma(id);
      toast({ title: "Acta enviada para firma del supervisor" });
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    }
  };

  const handleFirmar = async () => {
    if (!firmaDialog || !firmaSupervisorId || !firmaPin) {
      setFirmaError("Selecciona supervisor e ingresa el PIN"); return;
    }
    setFirmaSubmitting(true);
    setFirmaError("");
    try {
      await firmar(firmaDialog, firmaSupervisorId, firmaPin);
      toast({ title: "Acta firmada — merma registrada en inventario" });
      setFirmaDialog(null);
      setFirmaPin("");
      setFirmaSupervisorId("");
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? String(e);
      setFirmaError(
        msg.includes("PIN_INCORRECT") ? "PIN incorrecto"
        : msg.includes("PIN_NOT_CONFIGURED") ? "El supervisor no tiene PIN configurado"
        : msg
      );
    } finally {
      setFirmaSubmitting(false);
    }
  };

  const handleRechazar = async () => {
    if (!rechazarDialog) return;
    try {
      await rechazar(rechazarDialog, rechazarMotivo);
      toast({ title: "Acta rechazada" });
      setRechazarDialog(null);
      setRechazarMotivo("");
    } catch (e) {
      toast({ title: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Actas de Merma</h3>
          <p className="text-sm text-muted-foreground">
            {actas.filter((a) => a.estatus === "pendiente_firma").length > 0 && (
              <span className="text-yellow-600 font-medium">
                {actas.filter((a) => a.estatus === "pendiente_firma").length} pendiente(s) de firma ·{" "}
              </span>
            )}
            {actas.length} actas registradas
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva acta
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!loading && actas.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <FileWarning className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p className="text-sm">Sin actas de merma registradas.</p>
        </div>
      )}

      <div className="space-y-2">
        {actas.map((acta) => {
          const badge = ESTATUS_BADGE[acta.estatus];
          const isOpen = expanded === acta.id;
          const motivoLabel = MOTIVOS.find((m) => m.value === acta.motivo)?.label ?? acta.motivo;
          return (
            <div key={acta.id} className={`rounded-lg border bg-card ${acta.estatus === "pendiente_firma" ? "border-yellow-300" : ""}`}>
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => toggleExpand(acta.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{acta.folio}</span>
                    <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                    <span className="text-xs text-muted-foreground">{motivoLabel}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(acta.fecha_merma), "dd MMM yyyy", { locale: es })}
                    {acta.descripcion && ` · ${acta.descripcion}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-destructive">{fmt(acta.total_costo_centavos)}</p>
                  <p className="text-xs text-muted-foreground">costo merma</p>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>

              {isOpen && (
                <div className="border-t px-3 pb-3 pt-2 space-y-3">
                  {acta.estatus === "pendiente_firma" && (
                    <div className="flex items-start gap-2 rounded-md bg-yellow-50 border border-yellow-200 p-2 text-xs text-yellow-800">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>Pendiente de firma supervisor. La merma se descuenta del inventario al firmar.</span>
                    </div>
                  )}
                  {acta.rechazada_motivo && (
                    <p className="text-xs text-destructive"><strong>Motivo rechazo:</strong> {acta.rechazada_motivo}</p>
                  )}

                  {/* Acciones */}
                  <div className="flex gap-2 flex-wrap">
                    {acta.estatus === "borrador" && (
                      <Button size="sm" onClick={() => handleSolicitarFirma(acta.id)}>
                        <ShieldCheck className="h-4 w-4 mr-1" /> Solicitar firma
                      </Button>
                    )}
                    {acta.estatus === "pendiente_firma" && isManager && (
                      <>
                        <Button size="sm" onClick={() => { setFirmaDialog(acta.id); setFirmaPin(""); setFirmaSupervisorId(""); setFirmaError(""); }}>
                          <ShieldCheck className="h-4 w-4 mr-1" /> Firmar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setRechazarDialog(acta.id); setRechazarMotivo(""); }}>
                          Rechazar
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Items */}
                  {(expandedItems[acta.id] ?? []).length > 0 && (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left pb-1">Medicamento</th>
                          <th className="text-left pb-1">Lote</th>
                          <th className="text-right pb-1">Cant.</th>
                          <th className="text-right pb-1">Costo unit.</th>
                          <th className="text-right pb-1">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedItems[acta.id].map((it, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1 pr-2">{it.medicamento_nombre ?? it.medicamento_id}</td>
                            <td className="py-1 pr-2 font-mono">{it.numero_lote ?? "—"}</td>
                            <td className="py-1 text-right">{it.cantidad}</td>
                            <td className="py-1 text-right">{fmt(it.costo_unitario_centavos)}</td>
                            <td className="py-1 text-right font-medium">{fmt((it.subtotal_centavos ?? it.cantidad * it.costo_unitario_centavos))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {!expandedItems[acta.id] && <p className="text-xs text-muted-foreground">Cargando ítems…</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Dialog: Nueva acta ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nueva Acta de Merma</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Fecha de merma</Label>
                <Input type="date" value={form.fecha_merma} onChange={(e) => setForm((f) => ({ ...f, fecha_merma: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Motivo *</Label>
                <Select value={form.motivo} onValueChange={(v) => setForm((f) => ({ ...f, motivo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descripción / observaciones</Label>
              <Textarea rows={2} value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Detalles de la merma…" />
            </div>

            {/* Líneas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Productos a dar de baja</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setLineItems((p) => [...p, EMPTY_ITEM()])}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar
                </Button>
              </div>
              {lineItems.map((l) => {
                const lotes = lotesPorMed[l.medicamento_id] ?? [];
                return (
                  <div key={l._key} className="rounded-md border p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Medicamento *</Label>
                        <Select value={l.medicamento_id} onValueChange={(v) => updateLine(l._key, "medicamento_id", v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                          <SelectContent>
                            {medicamentos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Lote</Label>
                        <Select
                          value={l.lote_id ?? ""}
                          onValueChange={(v) => updateLine(l._key, "lote_id", v)}
                          disabled={!l.medicamento_id}
                        >
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar lote…" /></SelectTrigger>
                          <SelectContent>
                            {lotes.map((lt) => (
                              <SelectItem key={lt.id} value={lt.id}>
                                {lt.numero_lote} ({lt.existencia} uds)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Cantidad *</Label>
                        <Input
                          type="number" min={1} className="h-8 text-sm"
                          value={l.cantidad}
                          onChange={(e) => updateLine(l._key, "cantidad", Math.max(1, Number(e.target.value)))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Costo unit. (MXN)</Label>
                        <MoneyInput
                          className="h-8 text-sm"
                          value={costoDrafts[l._key] ?? (l.costo_unitario_centavos / 100).toFixed(2)}
                          onValueChange={(raw) => {
                            setCostoDrafts((d) => ({ ...d, [l._key]: raw }));
                            const pesos = Number(raw);
                            if (!Number.isNaN(pesos)) updateLine(l._key, "costo_unitario_centavos", Math.round(pesos * 100));
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Observación</Label>
                        <div className="flex gap-1">
                          <Input
                            className="h-8 text-sm"
                            value={l.observacion}
                            onChange={(e) => updateLine(l._key, "observacion", e.target.value)}
                            placeholder="Opcional"
                          />
                          <Button
                            type="button" size="sm" variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => setLineItems((p) => p.filter((x) => x._key !== l._key))}
                            disabled={lineItems.length === 1}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3 text-sm flex justify-between">
              <span className="text-muted-foreground">Costo total de la merma</span>
              <span className="font-bold text-destructive">{fmt(total)}</span>
            </div>

            <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>El acta se crea en borrador. La existencia se descuenta del inventario solo al firmar con un supervisor autorizado.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? "Guardando…" : "Crear acta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Firma supervisor ───────────────────────────────────── */}
      <Dialog open={!!firmaDialog} onOpenChange={(o) => { if (!o) setFirmaDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Firma de Supervisor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Al firmar, la merma se descuentará permanentemente del inventario y quedará registrada en movimientos.
            </p>
            <div className="space-y-1">
              <Label>Supervisor autorizante</Label>
              <Select value={firmaSupervisorId} onValueChange={setFirmaSupervisorId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                <SelectContent>
                  {supervisors.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.full_name || s.email}
                      {!s.has_pin && <span className="text-muted-foreground text-xs ml-1">(sin PIN)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>PIN de autorización</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={firmaPin}
                onChange={(e) => { setFirmaPin(e.target.value); setFirmaError(""); }}
                placeholder="••••••"
                autoFocus
              />
            </div>
            {firmaError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {firmaError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFirmaDialog(null)} disabled={firmaSubmitting}>Cancelar</Button>
            <Button onClick={handleFirmar} disabled={firmaSubmitting || !firmaSupervisorId || !firmaPin}>
              <ShieldCheck className="h-4 w-4 mr-1" />
              {firmaSubmitting ? "Verificando…" : "Autorizar y firmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Rechazar acta ──────────────────────────────────────── */}
      <Dialog open={!!rechazarDialog} onOpenChange={(o) => { if (!o) setRechazarDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rechazar Acta de Merma</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Indica el motivo del rechazo para que el solicitante pueda corregir el acta.</p>
            <div className="space-y-1">
              <Label>Motivo del rechazo</Label>
              <Input
                value={rechazarMotivo}
                onChange={(e) => setRechazarMotivo(e.target.value)}
                placeholder="Ej: Cantidades incorrectas, falta documentación…"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazarDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRechazar}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
