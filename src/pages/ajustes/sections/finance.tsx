import { useEffect } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, type SectionProps } from "../shared";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useClinicSettingsForm } from "@/hooks/useClinicSettingsForm";

/* ---------------- 10. Facturación y Fiscal MX (persistencia → clinic_settings/facturacion) ---------------- */
interface FacturacionForm {
  regimenFiscal: string;
  usoCfdi: string;
  metodoPago: string;
  formaPago: string;
  serie: string;
  folioInicial: number;
  cancelacionMotivoSat: boolean;
  notasCredito: boolean;
  validarRfc: boolean;
  envioAutomatico: boolean;
  pac: string;
  usuarioPac: string;
  ambiente: string;
}

const FACTURACION_DEFAULTS: FacturacionForm = {
  regimenFiscal: "601",
  usoCfdi: "d01",
  metodoPago: "pue",
  formaPago: "01",
  serie: "A",
  folioInicial: 1001,
  cancelacionMotivoSat: true,
  notasCredito: true,
  validarRfc: true,
  envioAutomatico: true,
  pac: "placeholder",
  usuarioPac: "",
  ambiente: "pruebas",
};

const FACTURACION_TOGGLES: { key: keyof FacturacionForm; label: string }[] = [
  { key: "cancelacionMotivoSat", label: "Permitir cancelación con motivo SAT" },
  { key: "notasCredito", label: "Emitir notas de crédito" },
  { key: "validarRfc", label: "Validar RFC del receptor en tiempo real" },
  { key: "envioAutomatico", label: "Envío automático de XML y PDF al paciente" },
];

export function SectionFacturacion({ onChange, registerSave }: SectionProps) {
  const { activeClinicId, isGlobalAdmin } = useActiveClinic();
  const readOnly = !isGlobalAdmin;
  const { form, setField, loading, error, save, reset } = useClinicSettingsForm<FacturacionForm>(
    activeClinicId,
    "facturacion",
    FACTURACION_DEFAULTS,
  );

  useEffect(() => {
    registerSave?.({ save, reset });
  }, [registerSave, save, reset]);

  const edit = <K extends keyof FacturacionForm>(key: K, value: FacturacionForm[K]) => {
    setField(key, value);
    onChange();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando configuración fiscal…
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {readOnly && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
          <Lock className="h-3.5 w-3.5" /> Solo administradores pueden editar estos datos.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            CFDI 4.0 <Badge variant="outline">SAT México</Badge>
          </CardTitle>
          <CardDescription>Datos por defecto para emisión de comprobantes</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Régimen fiscal">
            <Select value={form.regimenFiscal} disabled={readOnly} onValueChange={(v) => edit("regimenFiscal", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="601">601 · General de Ley Personas Morales</SelectItem>
                <SelectItem value="612">612 · Personas Físicas con Actividades Empresariales</SelectItem>
                <SelectItem value="621">621 · Incorporación Fiscal</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Uso CFDI">
            <Select value={form.usoCfdi} disabled={readOnly} onValueChange={(v) => edit("usoCfdi", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="d01">D01 · Honorarios médicos, dentales y hospitalarios</SelectItem>
                <SelectItem value="g03">G03 · Gastos en general</SelectItem>
                <SelectItem value="p01">P01 · Por definir</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Método de pago">
            <Select value={form.metodoPago} disabled={readOnly} onValueChange={(v) => edit("metodoPago", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pue">PUE · Pago en una sola exhibición</SelectItem>
                <SelectItem value="ppd">PPD · Pago en parcialidades o diferido</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Forma de pago">
            <Select value={form.formaPago} disabled={readOnly} onValueChange={(v) => edit("formaPago", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="01">01 · Efectivo</SelectItem>
                <SelectItem value="03">03 · Transferencia electrónica</SelectItem>
                <SelectItem value="04">04 · Tarjeta de crédito</SelectItem>
                <SelectItem value="28">28 · Tarjeta de débito</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Serie">
            <Input value={form.serie} disabled={readOnly} onChange={(e) => edit("serie", e.target.value)} />
          </Field>
          <Field label="Folio inicial">
            <Input
              type="number"
              value={form.folioInicial}
              disabled={readOnly}
              onChange={(e) => edit("folioInicial", Number(e.target.value) || 0)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Operaciones</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {FACTURACION_TOGGLES.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">{label}</span>
              <Switch checked={form[key] as boolean} disabled={readOnly} onCheckedChange={(v) => edit(key, v as FacturacionForm[typeof key])} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Proveedor PAC</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="PAC">
            <Select value={form.pac} disabled={readOnly} onValueChange={(v) => edit("pac", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder">Seleccionar PAC…</SelectItem>
                <SelectItem value="facturama">Facturama</SelectItem>
                <SelectItem value="solucion">Solución Factible</SelectItem>
                <SelectItem value="sw">SW Sapien</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Usuario PAC">
            <Input value={form.usuarioPac} disabled={readOnly} placeholder="usuario@pac" onChange={(e) => edit("usuarioPac", e.target.value)} />
          </Field>
          <Field label="Ambiente">
            <Select value={form.ambiente} disabled={readOnly} onValueChange={(v) => edit("ambiente", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pruebas">Pruebas</SelectItem>
                <SelectItem value="produccion">Producción</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- 11. Pagos (persistencia → clinic_settings/pagos) ---------------- */
interface PagosForm {
  metEfectivo: boolean;
  metTarjeta: boolean;
  metTransferencia: boolean;
  metMercadoPago: boolean;
  metStripe: boolean;
  aceptarAnticipos: boolean;
  pagosParciales: boolean;
  reembolsos: boolean;
  autorizarReembolsoGrande: boolean;
}

const PAGOS_DEFAULTS: PagosForm = {
  metEfectivo: true,
  metTarjeta: true,
  metTransferencia: true,
  metMercadoPago: false,
  metStripe: false,
  aceptarAnticipos: true,
  pagosParciales: true,
  reembolsos: true,
  autorizarReembolsoGrande: true,
};

const PAGOS_METODOS: { key: keyof PagosForm; label: string }[] = [
  { key: "metEfectivo", label: "Efectivo" },
  { key: "metTarjeta", label: "Tarjeta" },
  { key: "metTransferencia", label: "Transferencia" },
  { key: "metMercadoPago", label: "Mercado Pago" },
  { key: "metStripe", label: "Stripe" },
];

const PAGOS_POLITICAS: { key: keyof PagosForm; label: string }[] = [
  { key: "aceptarAnticipos", label: "Aceptar anticipos" },
  { key: "pagosParciales", label: "Permitir pagos parciales" },
  { key: "reembolsos", label: "Habilitar reembolsos" },
  { key: "autorizarReembolsoGrande", label: "Solicitar autorización para reembolso > $1,000" },
];

export function SectionPagos({ onChange, registerSave }: SectionProps) {
  const { activeClinicId, isGlobalAdmin } = useActiveClinic();
  const readOnly = !isGlobalAdmin;
  const { form, setField, loading, error, save, reset } = useClinicSettingsForm<PagosForm>(
    activeClinicId,
    "pagos",
    PAGOS_DEFAULTS,
  );

  useEffect(() => {
    registerSave?.({ save, reset });
  }, [registerSave, save, reset]);

  const edit = <K extends keyof PagosForm>(key: K, value: PagosForm[K]) => {
    setField(key, value);
    onChange();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando métodos de pago…
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {readOnly && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
          <Lock className="h-3.5 w-3.5" /> Solo administradores pueden editar estos datos.
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Métodos de pago</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {PAGOS_METODOS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm font-medium">{label}</span>
              <Switch checked={form[key] as boolean} disabled={readOnly} onCheckedChange={(v) => edit(key, v as PagosForm[typeof key])} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Políticas</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {PAGOS_POLITICAS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">{label}</span>
              <Switch checked={form[key] as boolean} disabled={readOnly} onCheckedChange={(v) => edit(key, v as PagosForm[typeof key])} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// SectionInventario se movió a ./inventario (CRUD real de insumos/kits/proveedores).
