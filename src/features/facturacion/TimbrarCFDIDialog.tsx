import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, FileText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ── Catálogos rápidos ───────────────────────────────────────────
const CLAVES_PROD_SERV = [
  { value: "85121803", label: "85121803 — Servicios médicos generales" },
  { value: "85121806", label: "85121806 — Servicios médicos especializados" },
  { value: "85121805", label: "85121805 — Servicios de cirugía" },
  { value: "85131600", label: "85131600 — Servicios de diagnóstico" },
  { value: "85141600", label: "85141600 — Servicios de enfermería" },
  { value: "51101500", label: "51101500 — Medicamentos y fármacos" },
  { value: "85101600", label: "85101600 — Servicios hospitalarios" },
  { value: "01010101", label: "01010101 — No existe en el catálogo" },
];

const USOS_CFDI = [
  { value: "D01", label: "D01 — Honorarios médicos, dentales y hospitalarios" },
  { value: "D02", label: "D02 — Gastos médicos por incapacidad/discapacidad" },
  { value: "G01", label: "G01 — Adquisición de mercancias" },
  { value: "G03", label: "G03 — Gastos en general" },
  { value: "S01", label: "S01 — Sin efectos fiscales" },
  { value: "CP01", label: "CP01 — Pagos" },
];

const FORMAS_PAGO = [
  { value: "01", label: "01 — Efectivo" },
  { value: "02", label: "02 — Cheque nominativo" },
  { value: "03", label: "03 — Transferencia electrónica (SPEI)" },
  { value: "04", label: "04 — Tarjeta de crédito" },
  { value: "28", label: "28 — Tarjeta de débito" },
  { value: "29", label: "29 — Tarjeta de servicios" },
  { value: "17", label: "17 — Compensación" },
  { value: "99", label: "99 — Por definir" },
];

const REGIMENES_RECEPTOR = [
  { value: "601", label: "601 — General de Ley PM" },
  { value: "612", label: "612 — Personas Físicas con Act. Empresariales" },
  { value: "616", label: "616 — Sin obligaciones fiscales" },
  { value: "621", label: "621 — Incorporación Fiscal" },
  { value: "626", label: "626 — RESICO" },
];

// ── Tipos ───────────────────────────────────────────────────────
interface ConceptoForm {
  id: string;
  clave_prod_serv: string;
  descripcion: string;
  cantidad: string;
  valor_unitario: string;
  objeto_imp: "01" | "02";
  iva_tasa: string;
}

interface ReceptorForm {
  rfc: string;
  nombre: string;
  regimen_fiscal: string;
  domicilio_fiscal_cp: string;
  uso_cfdi: string;
  email: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: (cfdiId: string, uuid: string) => void;
  prefilledReceptorRfc?: string;
  appointmentId?: string;
  saleId?: string;
}

const newConcepto = (): ConceptoForm => ({
  id: crypto.randomUUID(),
  clave_prod_serv: "85121803",
  descripcion: "Consulta médica",
  cantidad: "1",
  valor_unitario: "",
  objeto_imp: "02",
  iva_tasa: "0.16",
});

const EMPTY_RECEPTOR: ReceptorForm = {
  rfc: "", nombre: "", regimen_fiscal: "616",
  domicilio_fiscal_cp: "", uso_cfdi: "D01", email: "",
};

export default function TimbrarCFDIDialog({
  open, onOpenChange, onSuccess, prefilledReceptorRfc, appointmentId, saleId,
}: Props) {
  const { activeClinicId } = useActiveClinic();
  const [receptor, setReceptor] = useState<ReceptorForm>(EMPTY_RECEPTOR);
  const [conceptos, setConceptos] = useState<ConceptoForm[]>([newConcepto()]);
  const [metodoPago, setMetodoPago] = useState("PUE");
  const [formaPago, setFormaPago] = useState("01");
  const [timbrado, setTimbrado] = useState(false);
  const [buscandoRfc, setBuscandoRfc] = useState(false);

  // Cargar receptor desde catálogo si ya existe
  useEffect(() => {
    if (!open) return;
    setReceptor(EMPTY_RECEPTOR);
    setConceptos([newConcepto()]);
    setMetodoPago("PUE");
    setFormaPago("01");
    if (prefilledReceptorRfc) loadReceptorByRfc(prefilledReceptorRfc);
  }, [open]);

  const loadReceptorByRfc = async (rfc: string) => {
    if (!activeClinicId || !rfc) return;
    setBuscandoRfc(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("cfdi_receptores")
      .select("*")
      .eq("clinic_id", activeClinicId)
      .eq("rfc", rfc.toUpperCase().trim())
      .maybeSingle() as { data: Record<string, unknown> | null };
    if (data) {
      const rec = data as Record<string, unknown>;
      setReceptor({
        rfc:                 rec.rfc as string,
        nombre:              rec.nombre as string,
        regimen_fiscal:      rec.regimen_fiscal as string,
        domicilio_fiscal_cp: rec.domicilio_fiscal_cp as string,
        uso_cfdi:            (rec.uso_cfdi_defecto as string | null) ?? "S01",
        email:               (rec.email_envio as string | null) ?? "",
      });
    } else {
      setReceptor((prev) => ({ ...prev, rfc: rfc.toUpperCase().trim() }));
    }
    setBuscandoRfc(false);
  };

  const setRec = <K extends keyof ReceptorForm>(k: K, v: ReceptorForm[K]) =>
    setReceptor((prev) => ({ ...prev, [k]: v }));

  const setConc = (id: string, field: keyof ConceptoForm, value: string) =>
    setConceptos((prev) =>
      prev.map((c) => c.id === id ? { ...c, [field]: value } : c)
    );

  const addConcepto = () => setConceptos((prev) => [...prev, newConcepto()]);
  const removeConcepto = (id: string) =>
    setConceptos((prev) => prev.length > 1 ? prev.filter((c) => c.id !== id) : prev);

  // Totales en tiempo real
  const totals = conceptos.reduce(
    (acc, c) => {
      const qty   = parseFloat(c.cantidad) || 0;
      const price = parseFloat(c.valor_unitario) || 0;
      const base  = Math.round(qty * price * 100) / 100;
      const iva   = c.objeto_imp === "02" ? Math.round(base * (parseFloat(c.iva_tasa) || 0) * 100) / 100 : 0;
      return { subtotal: acc.subtotal + base, iva: acc.iva + iva };
    },
    { subtotal: 0, iva: 0 }
  );
  const totalFinal = Math.round((totals.subtotal + totals.iva) * 100) / 100;

  const handleTimbrar = async () => {
    if (!activeClinicId) return;
    if (!receptor.rfc.trim()) { toast.error("RFC del receptor es obligatorio"); return; }
    if (!receptor.nombre.trim()) { toast.error("Nombre del receptor es obligatorio"); return; }
    if (!receptor.domicilio_fiscal_cp.trim()) { toast.error("CP domicilio fiscal del receptor es obligatorio"); return; }
    for (const c of conceptos) {
      if (!c.descripcion.trim()) { toast.error("Todos los conceptos necesitan descripción"); return; }
      if (!parseFloat(c.valor_unitario)) { toast.error("Valor unitario inválido en algún concepto"); return; }
    }

    setTimbrado(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sin sesión activa");

      const body = {
        clinic_id: activeClinicId,
        tipo: "I",
        receptor: {
          rfc:                 receptor.rfc.toUpperCase().trim(),
          nombre:              receptor.nombre.trim(),
          regimen_fiscal:      receptor.regimen_fiscal,
          domicilio_fiscal_cp: receptor.domicilio_fiscal_cp.trim(),
          uso_cfdi:            receptor.uso_cfdi,
          email:               receptor.email.trim() || undefined,
        },
        conceptos: conceptos.map((c) => ({
          clave_prod_serv: c.clave_prod_serv,
          clave_unidad:    "E48",
          cantidad:        parseFloat(c.cantidad) || 1,
          descripcion:     c.descripcion.trim(),
          valor_unitario:  parseFloat(c.valor_unitario),
          objeto_imp:      c.objeto_imp,
          iva_tasa:        c.objeto_imp === "02" ? parseFloat(c.iva_tasa) : undefined,
        })),
        metodo_pago:    metodoPago,
        forma_pago:     formaPago,
        appointment_id: appointmentId ?? undefined,
        sale_id:        saleId ?? undefined,
      };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cfdi-timbrar`,
        {
          method:  "POST",
          headers: {
            Authorization:  `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey:         import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(body),
        }
      );

      const result = await res.json();
      if (!res.ok || !result.ok) throw new Error(result.error ?? "Error al timbrar");

      if (result.warning) toast.warning(result.warning);
      else toast.success(`CFDI timbrado — UUID: ${result.uuid_fiscal}`);

      onSuccess(result.cfdi_id, result.uuid_fiscal);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al timbrar CFDI");
    } finally {
      setTimbrado(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Emitir CFDI 4.0
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Receptor */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">Datos del receptor</h3>

            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="rfc">RFC *</Label>
                <div className="flex gap-2">
                  <Input
                    id="rfc" value={receptor.rfc}
                    onChange={(e) => setRec("rfc", e.target.value.toUpperCase())}
                    placeholder="RFC (12 o 13 chars)" maxLength={13} className="uppercase"
                  />
                  <Button
                    type="button" variant="outline" size="icon"
                    onClick={() => loadReceptorByRfc(receptor.rfc)}
                    disabled={buscandoRfc || !receptor.rfc}
                    title="Buscar en catálogo"
                  >
                    {buscandoRfc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="w-28">
                <Label htmlFor="cp_receptor">CP fiscal *</Label>
                <Input
                  id="cp_receptor" value={receptor.domicilio_fiscal_cp}
                  onChange={(e) => setRec("domicilio_fiscal_cp", e.target.value)}
                  placeholder="06600" maxLength={5}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="nombre">Nombre / Razón social *</Label>
              <Input
                id="nombre" value={receptor.nombre}
                onChange={(e) => setRec("nombre", e.target.value)}
                placeholder="Exacto al registro SAT"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Régimen fiscal</Label>
                <select
                  value={receptor.regimen_fiscal}
                  onChange={(e) => setRec("regimen_fiscal", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  {REGIMENES_RECEPTOR.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Uso CFDI</Label>
                <select
                  value={receptor.uso_cfdi}
                  onChange={(e) => setRec("uso_cfdi", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  {USOS_CFDI.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="email_receptor">Email (envío automático)</Label>
              <Input
                id="email_receptor" type="email" value={receptor.email}
                onChange={(e) => setRec("email", e.target.value)}
                placeholder="paciente@email.com (opcional)"
              />
            </div>
          </section>

          {/* Conceptos */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <h3 className="text-sm font-semibold text-foreground">Conceptos</h3>
              <Button type="button" variant="outline" size="sm" onClick={addConcepto}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
              </Button>
            </div>

            {conceptos.map((c, idx) => (
              <div key={c.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Concepto {idx + 1}</span>
                  {conceptos.length > 1 && (
                    <button onClick={() => removeConcepto(c.id)} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <Label className="text-xs">Clave SAT (prod/serv)</Label>
                  <select
                    value={c.clave_prod_serv}
                    onChange={(e) => setConc(c.id, "clave_prod_serv", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                  >
                    {CLAVES_PROD_SERV.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Descripción *</Label>
                  <Input
                    value={c.descripcion}
                    onChange={(e) => setConc(c.id, "descripcion", e.target.value)}
                    placeholder="Descripción del servicio o producto"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Cantidad</Label>
                    <Input
                      type="number" min="0.01" step="0.01"
                      value={c.cantidad}
                      onChange={(e) => setConc(c.id, "cantidad", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Valor unitario (sin IVA) *</Label>
                    <MoneyInput
                      value={c.valor_unitario}
                      onValueChange={(raw) => setConc(c.id, "valor_unitario", raw)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">IVA</Label>
                    <select
                      value={c.objeto_imp === "01" ? "exento" : c.iva_tasa}
                      onChange={(e) => {
                        if (e.target.value === "exento") {
                          setConc(c.id, "objeto_imp", "01");
                          setConc(c.id, "iva_tasa", "0");
                        } else {
                          setConc(c.id, "objeto_imp", "02");
                          setConc(c.id, "iva_tasa", e.target.value);
                        }
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                    >
                      <option value="exento">Exento</option>
                      <option value="0.16">16%</option>
                      <option value="0.08">8% (frontera)</option>
                      <option value="0.00">0% (tasa cero)</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* Pago */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">Método y forma de pago</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Método de pago</Label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="PUE">PUE — Pago en una sola exhibición</option>
                  <option value="PPD">PPD — Pago en parcialidades o diferido</option>
                </select>
              </div>
              <div>
                <Label>Forma de pago</Label>
                <select
                  value={formaPago}
                  onChange={(e) => setFormaPago(e.target.value)}
                  disabled={metodoPago === "PPD"}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
                >
                  {FORMAS_PAGO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                {metodoPago === "PPD" && (
                  <p className="mt-1 text-xs text-muted-foreground">PPD usa forma 99 automáticamente</p>
                )}
              </div>
            </div>
          </section>

          {/* Totales */}
          <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{fmt(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>IVA</span><span>{fmt(totals.iva)}</span>
            </div>
            <div className="flex justify-between font-bold text-foreground text-base mt-1 pt-1 border-t border-border">
              <span>Total</span><span>{fmt(totalFinal)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={timbrado}>Cancelar</Button>
          <Button onClick={handleTimbrar} disabled={timbrado || totalFinal <= 0} className="gap-2">
            {timbrado ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {timbrado ? "Timbrando…" : "Timbrar CFDI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
