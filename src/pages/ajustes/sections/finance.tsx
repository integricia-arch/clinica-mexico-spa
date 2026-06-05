import { useEffect } from "react";
import { Plus, Trash2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

/* ---------------- 12. Inventario y Costos (demo visual) ---------------- */
export function SectionInventario({ onChange }: SectionProps) {
  return (
    <Tabs defaultValue="insumos">
      <TabsList>
        <TabsTrigger value="insumos">Insumos</TabsTrigger>
        <TabsTrigger value="kits">Kits por tratamiento</TabsTrigger>
        <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
      </TabsList>

      <TabsContent value="insumos" className="mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Catálogo</CardTitle>
            <Button size="sm" onClick={onChange}><Plus className="mr-1.5 h-4 w-4" /> Nuevo insumo</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Insumo</TableHead><TableHead>Stock</TableHead>
                <TableHead>Mínimo</TableHead><TableHead>Caducidad</TableHead>
                <TableHead className="text-right">Costo</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {[
                  { nombre: "Jeringa 5ml", stock: "120", minimo: "30", caducidad: "12/2027", costo: 4.5, bajo: false },
                  { nombre: "Guantes nitrilo M", stock: "20", minimo: "50", caducidad: "06/2027", costo: 3.2, bajo: true },
                  { nombre: "Lidocaína 2%", stock: "15", minimo: "10", caducidad: "03/2026", costo: 85, bajo: false },
                  { nombre: "Alcohol 70% 1L", stock: "8", minimo: "5", caducidad: "—", costo: 45, bajo: false },
                ].map((r) => (
                  <TableRow key={r.nombre}>
                    <TableCell className="font-medium">{r.nombre}</TableCell>
                    <TableCell>
                      {r.stock}{r.bajo && <Badge variant="destructive" className="ml-2">Bajo stock</Badge>}
                    </TableCell>
                    <TableCell>{r.minimo}</TableCell>
                    <TableCell>{r.caducidad}</TableCell>
                    <TableCell className="text-right">${r.costo.toLocaleString("es-MX")}</TableCell>
                    <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={onChange}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="kits" className="mt-4">
        <Card>
          <CardContent className="p-4">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Tratamiento</TableHead><TableHead>Insumos</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Margen</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {[
                  { tratamiento: "Infiltración", insumos: 6, costo: 320, precio: 2500 },
                  { tratamiento: "Curación mayor", insumos: 8, costo: 180, precio: 950 },
                  { tratamiento: "Toma de muestra", insumos: 4, costo: 65, precio: 650 },
                ].map((r) => {
                  const margen = Math.round(((r.precio - r.costo) / r.precio) * 100);
                  return (
                    <TableRow key={r.tratamiento}>
                      <TableCell className="font-medium">{r.tratamiento}</TableCell>
                      <TableCell>{r.insumos} ítems</TableCell>
                      <TableCell className="text-right">${r.costo.toLocaleString("es-MX")}</TableCell>
                      <TableCell className="text-right">${r.precio.toLocaleString("es-MX")}</TableCell>
                      <TableCell className="text-right"><Badge variant={margen > 50 ? "default" : "secondary"}>{margen}%</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="proveedores" className="mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Proveedores</CardTitle>
            <Button size="sm" onClick={onChange}><Plus className="mr-1.5 h-4 w-4" /> Agregar</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Proveedor</TableHead><TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead><TableHead>Última compra</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {[
                  { proveedor: "MediSupply MX", contacto: "Juan Pérez", tel: "55 1111 2222", ultima: "12/05/2026" },
                  { proveedor: "Farmacéutica del Valle", contacto: "Lucía Soto", tel: "55 3333 4444", ultima: "28/04/2026" },
                ].map((r) => (
                  <TableRow key={r.proveedor}>
                    <TableCell className="font-medium">{r.proveedor}</TableCell>
                    <TableCell>{r.contacto}</TableCell>
                    <TableCell>{r.tel}</TableCell>
                    <TableCell>{r.ultima}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
