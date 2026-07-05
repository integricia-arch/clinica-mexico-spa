import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, FileMinus } from "lucide-react";
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
  { value: "G01", label: "G01 — Adquisición de mercancias" },
  { value: "G03", label: "G03 — Gastos en general" },
  { value: "S01", label: "S01 — Sin efectos fiscales" },
];

const REGIMENES_RECEPTOR = [
  { value: "601", label: "601 — General de Ley PM" },
  { value: "612", label: "612 — Personas Físicas con Act. Empresariales" },
  { value: "616", label: "616 — Sin obligaciones fiscales" },
  { value: "621", label: "621 — Incorporación Fiscal" },
  { value: "626", label: "626 — RESICO" },
];

interface ConceptoForm {
  id: string;
  clave_prod_serv: string;
  descripcion: string;
  cantidad: string;
  valor_unitario: string;
  objeto_imp: "01" | "02";
  iva_tasa: string;
}

interface OriginDoc {
  id: string;
  uuid_fiscal: string | null;
  serie: string | null;
  folio: string | null;
  rfc_receptor: string;
  nombre_receptor: string;
  total: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: (cfdiId: string, uuid: string) => void;
  originDoc: OriginDoc;
}

const newConcepto = (): ConceptoForm => ({
  id: crypto.randomUUID(),
  clave_prod_serv: "85121803",
  descripcion: "Nota de crédito — devolución de servicio médico",
  cantidad: "1",
  valor_unitario: "",
  objeto_imp: "02",
  iva_tasa: "0.16",
});

const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function NotaCreditoDialog({ open, onOpenChange, onSuccess, originDoc }: Props) {
  const { activeClinicId } = useActiveClinic();
  const [conceptos, setConceptos] = useState<ConceptoForm[]>([newConcepto()]);
  const [regimenFiscal, setRegimenFiscal] = useState("616");
  const [domicilioFiscalCp, setDomicilioFiscalCp] = useState("");
  const [usoCfdi, setUsoCfdi] = useState("G03");
  const [timbrado, setTimbrado] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConceptos([newConcepto()]);
    setTimbrado(false);
    loadReceptor();
  }, [open]);

  const loadReceptor = async () => {
    if (!activeClinicId || !originDoc.rfc_receptor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("cfdi_receptores")
      .select("regimen_fiscal, domicilio_fiscal_cp, uso_cfdi_defecto")
      .eq("clinic_id", activeClinicId)
      .eq("rfc", originDoc.rfc_receptor)
      .maybeSingle() as { data: Record<string, unknown> | null };
    if (data) {
      const rec = data as Record<string, unknown>;
      setRegimenFiscal((rec.regimen_fiscal as string | null) ?? "616");
      setDomicilioFiscalCp((rec.domicilio_fiscal_cp as string | null) ?? "");
      setUsoCfdi((rec.uso_cfdi_defecto as string | null) ?? "G03");
    }
  };

  const setConc = (id: string, field: keyof ConceptoForm, value: string) =>
    setConceptos((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c));

  const addConcepto = () => setConceptos((prev) => [...prev, newConcepto()]);
  const removeConcepto = (id: string) =>
    setConceptos((prev) => prev.length > 1 ? prev.filter((c) => c.id !== id) : prev);

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

  const handleEmitir = async () => {
    if (!activeClinicId) return;
    if (!domicilioFiscalCp.trim()) {
      toast.error("CP domicilio fiscal del receptor es obligatorio — búscalo en Receptores");
      return;
    }
    if (!originDoc.uuid_fiscal) {
      toast.error("El CFDI de ingreso no tiene UUID fiscal registrado — no se puede emitir nota de crédito");
      return;
    }
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
        tipo: "E",
        cfdi_relacionado_uuid: originDoc.uuid_fiscal,
        tipo_relacion: "01",
        receptor: {
          rfc:                 originDoc.rfc_receptor,
          nombre:              originDoc.nombre_receptor,
          regimen_fiscal:      regimenFiscal,
          domicilio_fiscal_cp: domicilioFiscalCp.trim(),
          uso_cfdi:            usoCfdi,
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
        metodo_pago: "PUE",
        forma_pago:  "17",
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
      else toast.success(`Nota de crédito timbrada — UUID: ${result.uuid_fiscal}`);

      onSuccess(result.cfdi_id, result.uuid_fiscal);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al emitir nota de crédito");
    } finally {
      setTimbrado(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileMinus className="h-5 w-5 text-warning" />
            Emitir Nota de Crédito (Egreso)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* CFDI de origen */}
          <section className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">CFDI de ingreso relacionado</p>
            <div><span className="font-medium">Folio:</span> {originDoc.serie ?? "A"}-{originDoc.folio ?? "—"}</div>
            <div><span className="font-medium">Receptor:</span> {originDoc.nombre_receptor} ({originDoc.rfc_receptor})</div>
            <div><span className="font-medium">Total:</span> {fmt(originDoc.total)}</div>
            {originDoc.uuid_fiscal && (
              <div className="text-xs font-mono text-muted-foreground">{originDoc.uuid_fiscal}</div>
            )}
          </section>

          {/* Datos del receptor para la nota */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">Datos fiscales del receptor</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Régimen fiscal</Label>
                <select
                  value={regimenFiscal}
                  onChange={(e) => setRegimenFiscal(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  {REGIMENES_RECEPTOR.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="nc_cp_receptor">CP domicilio fiscal *</Label>
                <Input
                  id="nc_cp_receptor" value={domicilioFiscalCp}
                  onChange={(e) => setDomicilioFiscalCp(e.target.value)}
                  placeholder="06600" maxLength={5}
                />
              </div>
            </div>
            <div>
              <Label>Uso CFDI</Label>
              <select
                value={usoCfdi}
                onChange={(e) => setUsoCfdi(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                {USOS_CFDI.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </section>

          {/* Conceptos */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <h3 className="text-sm font-semibold text-foreground">Conceptos a acreditar</h3>
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
                    placeholder="Descripción del concepto"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Cantidad</Label>
                    <Input
                      type="number" min="0.001" step="any"
                      value={c.cantidad}
                      onChange={(e) => setConc(c.id, "cantidad", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Valor unitario *</Label>
                    <MoneyInput
                      value={c.valor_unitario}
                      onValueChange={(raw) => setConc(c.id, "valor_unitario", raw)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Objeto IVA</Label>
                    <select
                      value={c.objeto_imp}
                      onChange={(e) => setConc(c.id, "objeto_imp", e.target.value as "01" | "02")}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                    >
                      <option value="02">02 — Sí (grava IVA)</option>
                      <option value="01">01 — No objeto IVA</option>
                    </select>
                  </div>
                </div>

                {c.objeto_imp === "02" && (
                  <div className="w-40">
                    <Label className="text-xs">Tasa IVA</Label>
                    <select
                      value={c.iva_tasa}
                      onChange={(e) => setConc(c.id, "iva_tasa", e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                    >
                      <option value="0.16">16%</option>
                      <option value="0.08">8%</option>
                      <option value="0.00">0%</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* Totales */}
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{fmt(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>IVA</span><span>{fmt(totals.iva)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1 mt-1">
              <span>Total nota de crédito</span><span>{fmt(totalFinal)}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Forma de pago: <strong>17 — Compensación</strong> (estándar para notas de crédito).
            TipoRelación SAT: <strong>01</strong> — Nota de crédito de documentos relacionados.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={timbrado}>
            Cancelar
          </Button>
          <Button onClick={handleEmitir} disabled={timbrado || totalFinal <= 0}>
            {timbrado
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Timbrando…</>
              : <><FileMinus className="h-4 w-4 mr-2" />Emitir nota de crédito</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
