import { useState } from "react";
import { Plus, Trash2, Loader2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";

// RFC y datos SAT para público general
const RFC_PUBLICO = "XAXX010101000";
const NOMBRE_PUBLICO = "PUBLICO EN GENERAL";

const PERIODICIDADES = [
  { value: "01", label: "01 — Diario" },
  { value: "02", label: "02 — Semanal" },
  { value: "03", label: "03 — Quincenal" },
  { value: "04", label: "04 — Mensual" },
  { value: "05", label: "05 — Bimestral" },
];

const MESES = [
  "01","02","03","04","05","06",
  "07","08","09","10","11","12",
];
const MESES_LABEL: Record<string, string> = {
  "01":"Enero","02":"Febrero","03":"Marzo","04":"Abril","05":"Mayo","06":"Junio",
  "07":"Julio","08":"Agosto","09":"Septiembre","10":"Octubre","11":"Noviembre","12":"Diciembre",
};

// Catálogos SAT básicos para farmacia
const CLAVES_PROD_SERV = [
  { value: "51101500", label: "51101500 — Medicamentos y farmacéuticos" },
  { value: "51101514", label: "51101514 — Medicamentos de patente" },
  { value: "51101513", label: "51101513 — Medicamentos genéricos" },
  { value: "85121800", label: "85121800 — Servicios médicos" },
  { value: "84111506", label: "84111506 — Servicios de contabilidad" },
];

interface Concepto {
  id: string;
  clave_prod_serv: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  objeto_imp: "01" | "02";
  iva_tasa: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: (cfdiId: string, uuid: string) => void;
  clinicId: string;
  cpEmisor: string;
}

const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const round2 = (n: number) => Math.round(n * 100) / 100;

let nextId = 1;
const newConcepto = (): Concepto => ({
  id: String(nextId++),
  clave_prod_serv: "51101500",
  descripcion: "Venta farmacia público general",
  cantidad: 1,
  valor_unitario: 0,
  objeto_imp: "02",
  iva_tasa: 0.16,
});

export default function FacturaGlobalDialog({ open, onOpenChange, onSuccess, clinicId, cpEmisor }: Props) {
  const now = new Date();
  const [periodicidad, setPeriodicidad] = useState("04");
  const [mes, setMes]     = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [anio, setAnio]   = useState(String(now.getFullYear()));
  const [conceptos, setConceptos] = useState<Concepto[]>([newConcepto()]);
  const [submitting, setSubmitting] = useState(false);

  const updateConcepto = (id: string, field: keyof Concepto, value: string | number) =>
    setConceptos((prev) =>
      prev.map((c) => c.id === id ? { ...c, [field]: value } : c)
    );

  const removeConcepto = (id: string) =>
    setConceptos((prev) => prev.filter((c) => c.id !== id));

  const subtotal = conceptos.reduce((s, c) => s + round2(c.cantidad * c.valor_unitario), 0);
  const totalIva = conceptos
    .filter((c) => c.objeto_imp === "02")
    .reduce((s, c) => s + round2(round2(c.cantidad * c.valor_unitario) * c.iva_tasa), 0);
  const total = round2(subtotal + totalIva);

  const handleSubmit = async () => {
    if (conceptos.some((c) => !c.descripcion.trim() || c.valor_unitario <= 0)) {
      toast.error("Todos los conceptos deben tener descripción e importe > 0");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sin sesión");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cfdi-timbrar`;
      const payload = {
        clinic_id: clinicId,
        tipo: "I",
        receptor: {
          rfc: RFC_PUBLICO,
          nombre: NOMBRE_PUBLICO,
          regimen_fiscal: "616",
          domicilio_fiscal_cp: cpEmisor,
          uso_cfdi: "S01",
        },
        conceptos: conceptos.map((c) => ({
          clave_prod_serv: c.clave_prod_serv,
          clave_unidad: "E48",      // Unidad de servicio
          cantidad: c.cantidad,
          descripcion: c.descripcion,
          valor_unitario: c.valor_unitario,
          objeto_imp: c.objeto_imp,
          ...(c.objeto_imp === "02" ? { iva_tasa: c.iva_tasa } : {}),
        })),
        metodo_pago: "PUE",
        forma_pago: "01",
        informacion_global: {
          periodicidad,
          meses: mes,
          anio: parseInt(anio),
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      if (data.warning) toast.warning(data.warning);

      onSuccess(data.cfdi_id, data.uuid_fiscal ?? "");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Error al timbrar factura global: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Factura Global — Público en General
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Receptor bloqueado */}
          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-sm space-y-0.5">
            <div className="font-medium text-card-foreground">Receptor: PUBLICO EN GENERAL</div>
            <div className="text-xs text-muted-foreground">RFC: XAXX010101000 · Régimen: 616 · UsoCFDI: S01</div>
          </div>

          {/* Periodo */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Período de la operación</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Periodicidad</Label>
                <select
                  value={periodicidad}
                  onChange={(e) => setPeriodicidad(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  {PERIODICIDADES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Mes</Label>
                <select
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  {MESES.map((m) => (
                    <option key={m} value={m}>{MESES_LABEL[m]}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Año</Label>
                <Input
                  type="number"
                  min="2024"
                  max="2099"
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Conceptos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Conceptos</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => setConceptos((p) => [...p, newConcepto()])} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Agregar concepto
              </Button>
            </div>

            <div className="space-y-3">
              {conceptos.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-card p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Clave SAT</Label>
                      <select
                        value={c.clave_prod_serv}
                        onChange={(e) => updateConcepto(c.id, "clave_prod_serv", e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/20"
                      >
                        {CLAVES_PROD_SERV.map((k) => (
                          <option key={k.value} value={k.value}>{k.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">IVA</Label>
                      <select
                        value={c.objeto_imp === "01" ? "exento" : String(c.iva_tasa)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "exento") {
                            updateConcepto(c.id, "objeto_imp", "01");
                          } else {
                            updateConcepto(c.id, "objeto_imp", "02");
                            updateConcepto(c.id, "iva_tasa", parseFloat(v));
                          }
                        }}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/20"
                      >
                        <option value="exento">Exento</option>
                        <option value="0.16">16%</option>
                        <option value="0.08">8%</option>
                        <option value="0">0%</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Descripción</Label>
                    <Input
                      value={c.descripcion}
                      onChange={(e) => updateConcepto(c.id, "descripcion", e.target.value)}
                      placeholder="Descripción del concepto"
                      className="text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div>
                      <Label className="text-xs">Cantidad</Label>
                      <Input
                        type="number"
                        min="0.001"
                        step="any"
                        value={c.cantidad}
                        onChange={(e) => updateConcepto(c.id, "cantidad", parseFloat(e.target.value) || 0)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Valor unitario</Label>
                      <MoneyInput
                        value={String(c.valor_unitario)}
                        onValueChange={(raw) => updateConcepto(c.id, "valor_unitario", parseFloat(raw) || 0)}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-card-foreground">
                        {fmt(round2(c.cantidad * c.valor_unitario))}
                      </span>
                      {conceptos.length > 1 && (
                        <button
                          onClick={() => removeConcepto(c.id)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totales */}
          <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{fmt(round2(subtotal))}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>IVA</span><span>{fmt(round2(totalIva))}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-card-foreground border-t border-border pt-1.5 mt-1.5">
              <span>Total</span><span>{fmt(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || total <= 0} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Timbrar factura global
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
