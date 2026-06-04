import { useState, useMemo } from "react";
import {
  Building2, Clock, CalendarDays, Bell, Stethoscope, UserCog, DoorOpen,
  ClipboardList, ListChecks, Receipt, CreditCard, Boxes, ShieldCheck,
  FileSignature, Save, X, AlertCircle, Plus, Trash2, Upload, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

type SectionId =
  | "general" | "horarios" | "citas" | "recordatorios" | "servicios"
  | "doctores" | "recursos" | "formularios" | "checklists" | "facturacion"
  | "pagos" | "inventario" | "usuarios" | "auditoria";

const SECTIONS: { id: SectionId; label: string; icon: any; desc: string }[] = [
  { id: "general", label: "General", icon: Building2, desc: "Datos de la clínica y marca" },
  { id: "horarios", label: "Horarios", icon: Clock, desc: "Disponibilidad operativa" },
  { id: "citas", label: "Citas", icon: CalendarDays, desc: "Reglas de agenda y flujos" },
  { id: "recordatorios", label: "Recordatorios", icon: Bell, desc: "Canales y plantillas" },
  { id: "servicios", label: "Servicios", icon: ClipboardList, desc: "Catálogo y precios" },
  { id: "doctores", label: "Doctores", icon: Stethoscope, desc: "Personal médico" },
  { id: "recursos", label: "Consultorios y recursos", icon: DoorOpen, desc: "Espacios y equipos" },
  { id: "formularios", label: "Formularios del paciente", icon: FileSignature, desc: "Captura clínica" },
  { id: "checklists", label: "Checklists clínicos", icon: ListChecks, desc: "Procesos obligatorios" },
  { id: "facturacion", label: "Facturación y fiscal MX", icon: Receipt, desc: "CFDI 4.0 y SAT" },
  { id: "pagos", label: "Pagos", icon: CreditCard, desc: "Métodos y pasarelas" },
  { id: "inventario", label: "Inventario y costos", icon: Boxes, desc: "Insumos y márgenes" },
  { id: "usuarios", label: "Usuarios y permisos", icon: UserCog, desc: "Roles y accesos" },
  { id: "auditoria", label: "Auditoría y cumplimiento", icon: ShieldCheck, desc: "Trazabilidad" },
];

export default function AjustesPlataforma() {
  const [active, setActive] = useState<SectionId>("general");
  const [dirty, setDirty] = useState(false);
  const markDirty = () => setDirty(true);

  const handleSave = () => {
    setDirty(false);
    toast.success("Cambios guardados (demo visual)");
  };
  const handleCancel = () => {
    setDirty(false);
    toast.info("Cambios descartados");
  };

  const current = useMemo(() => SECTIONS.find((s) => s.id === active)!, [active]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold tracking-tight">Configuración</h1>
          <p className="text-sm text-muted-foreground">Centro de control de tu clínica · vista demo</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Badge variant="outline" className="gap-1.5 border-amber-300 bg-amber-50 text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" /> Cambios sin guardar
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={!dirty}>
            <X className="mr-1.5 h-4 w-4" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty}>
            <Save className="mr-1.5 h-4 w-4" /> Guardar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        {/* Internal sidebar */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardContent className="p-2">
              <nav className="flex flex-col gap-0.5">
                {SECTIONS.map((s) => {
                  const isActive = s.id === active;
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActive(s.id)}
                      className={`flex items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="flex-1 leading-tight">{s.label}</span>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </aside>

        {/* Content */}
        <section className="min-w-0">
          <div className="mb-3">
            <h2 className="text-display text-xl font-semibold">{current.label}</h2>
            <p className="text-sm text-muted-foreground">{current.desc}</p>
          </div>

          {active === "general" && <SectionGeneral onChange={markDirty} />}
          {active === "horarios" && <SectionHorarios onChange={markDirty} />}
          {active === "citas" && <SectionCitas onChange={markDirty} />}
          {active === "recordatorios" && <SectionRecordatorios onChange={markDirty} />}
          {active === "servicios" && <SectionServicios onChange={markDirty} />}
          {active === "doctores" && <SectionDoctores onChange={markDirty} />}
          {active === "recursos" && <SectionRecursos onChange={markDirty} />}
          {active === "formularios" && <SectionFormularios onChange={markDirty} />}
          {active === "checklists" && <SectionChecklists onChange={markDirty} />}
          {active === "facturacion" && <SectionFacturacion onChange={markDirty} />}
          {active === "pagos" && <SectionPagos onChange={markDirty} />}
          {active === "inventario" && <SectionInventario onChange={markDirty} />}
          {active === "usuarios" && <SectionUsuarios onChange={markDirty} />}
          {active === "auditoria" && <SectionAuditoria onChange={markDirty} />}
        </section>
      </div>
    </div>
  );
}

type P = { onChange: () => void };

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

/* ---------------- 1. General ---------------- */
function SectionGeneral({ onChange }: P) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Identidad</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre de la clínica"><Input defaultValue="Integriclínica" onChange={onChange} /></Field>
          <Field label="Razón social"><Input defaultValue="Integriclínica S.A. de C.V." onChange={onChange} /></Field>
          <Field label="RFC"><Input defaultValue="ICL240101AB1" onChange={onChange} /></Field>
          <Field label="Teléfono"><Input defaultValue="+52 55 1234 5678" onChange={onChange} /></Field>
          <Field label="Correo"><Input type="email" defaultValue="contacto@integrika.mx" onChange={onChange} /></Field>
          <Field label="Zona horaria">
            <Select defaultValue="cdmx" onValueChange={onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cdmx">América/Ciudad de México (GMT-6)</SelectItem>
                <SelectItem value="cun">América/Cancún (GMT-5)</SelectItem>
                <SelectItem value="tij">América/Tijuana (GMT-8)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Moneda">
            <Select defaultValue="mxn" onValueChange={onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mxn">MXN · Peso mexicano</SelectItem>
                <SelectItem value="usd">USD · Dólar estadounidense</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Dirección" hint="Calle, número, colonia, municipio, CP">
            <Input defaultValue="Av. Reforma 123, Col. Juárez, Cuauhtémoc, 06600" onChange={onChange} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Logo</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 text-muted-foreground">
            <Building2 className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <Button variant="outline" size="sm" onClick={onChange}>
              <Upload className="mr-1.5 h-4 w-4" /> Subir logotipo
            </Button>
            <p className="text-[11px] text-muted-foreground">PNG o SVG, mínimo 256×256</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- 2. Horarios ---------------- */
function SectionHorarios({ onChange }: P) {
  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Horario semanal</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dias.map((d, i) => (
              <div key={d} className="grid grid-cols-1 items-center gap-3 rounded-md border border-border p-3 sm:grid-cols-[140px_1fr_1fr_1fr]">
                <div className="flex items-center gap-3">
                  <Switch defaultChecked={i < 6} onCheckedChange={onChange} />
                  <span className="text-sm font-medium">{d}</span>
                </div>
                <Field label="Apertura"><Input type="time" defaultValue="09:00" onChange={onChange} /></Field>
                <Field label="Cierre"><Input type="time" defaultValue="19:00" onChange={onChange} /></Field>
                <Field label="Descanso"><Input placeholder="14:00 – 15:00" onChange={onChange} /></Field>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Días cerrados y excepciones</CardTitle>
          <Button size="sm" variant="outline" onClick={onChange}><Plus className="mr-1.5 h-4 w-4" /> Agregar</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Motivo</TableHead><TableHead>Tipo</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                { f: "16/09/2026", m: "Independencia", t: "Festivo" },
                { f: "12/12/2026", m: "Virgen de Guadalupe", t: "Cerrado" },
                { f: "24/12/2026", m: "Nochebuena", t: "Medio día" },
              ].map((r) => (
                <TableRow key={r.f}>
                  <TableCell>{r.f}</TableCell>
                  <TableCell>{r.m}</TableCell>
                  <TableCell><Badge variant="secondary">{r.t}</Badge></TableCell>
                  <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={onChange}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- 3. Citas ---------------- */
function SectionCitas({ onChange }: P) {
  const estados = [
    { k: "pendiente", c: "bg-slate-100 text-slate-700" },
    { k: "confirmada", c: "bg-blue-100 text-blue-700" },
    { k: "en recepción", c: "bg-indigo-100 text-indigo-700" },
    { k: "en consulta", c: "bg-violet-100 text-violet-700" },
    { k: "completada", c: "bg-emerald-100 text-emerald-700" },
    { k: "no-show", c: "bg-amber-100 text-amber-700" },
    { k: "cancelada", c: "bg-rose-100 text-rose-700" },
  ];
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Reglas de agenda</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Duración default (min)"><Input type="number" defaultValue={30} onChange={onChange} /></Field>
          <Field label="Anticipación mínima (horas)"><Input type="number" defaultValue={2} onChange={onChange} /></Field>
          <Field label="Reprogramaciones permitidas"><Input type="number" defaultValue={3} onChange={onChange} /></Field>
          <Field label="Plazo para cancelar (horas)"><Input type="number" defaultValue={24} onChange={onChange} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2">
          {[
            ["Permitir citas en línea", true],
            ["Activar lista de espera", true],
            ["Confirmación automática 24h antes", false],
            ["Cobro de anticipo para reservar", false],
          ].map(([l, v]) => (
            <div key={l as string} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">{l}</span>
              <Switch defaultChecked={v as boolean} onCheckedChange={onChange} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Flujo de estados</CardTitle><CardDescription>Orden visual del ciclo de vida de una cita</CardDescription></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {estados.map((e, i) => (
              <div key={e.k} className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${e.c}`}>{e.k}</span>
                {i < estados.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- 4. Recordatorios ---------------- */
function SectionRecordatorios({ onChange }: P) {
  const canales = ["WhatsApp", "SMS", "Email", "Llamada manual"];
  const tiempos = ["72 horas antes", "24 horas antes", "3 horas antes", "1 hora antes"];
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Canales activos</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {canales.map((c, i) => (
            <div key={c} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm font-medium">{c}</span>
              <Switch defaultChecked={i < 3} onCheckedChange={onChange} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Programación</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {tiempos.map((t, i) => (
            <div key={t} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">{t}</span>
              <Switch defaultChecked={i !== 0} onCheckedChange={onChange} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Plantilla de mensaje</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Asunto"><Input defaultValue="Recordatorio de su cita en Integriclínica" onChange={onChange} /></Field>
          <Field label="Mensaje" hint="Variables disponibles: {{paciente}} {{fecha}} {{hora}} {{doctor}} {{consultorio}}">
            <Textarea
              rows={5}
              defaultValue={"Hola {{paciente}}, le recordamos su cita el {{fecha}} a las {{hora}} con {{doctor}} en {{consultorio}}. Conteste CONFIRMAR para confirmar o CANCELAR para cancelar."}
              onChange={onChange}
            />
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- 5. Servicios ---------------- */
function SectionServicios({ onChange }: P) {
  const servicios = [
    { n: "Consulta", t: "Consulta", p: 800, d: 30, c: false, k: false },
    { n: "Seguimiento", t: "Seguimiento", p: 500, d: 20, c: false, k: false },
    { n: "Infiltración", t: "Procedimiento", p: 2500, d: 45, c: true, k: true },
    { n: "Análisis clínicos", t: "Laboratorio", p: 650, d: 15, c: false, k: true },
    { n: "Ultrasonido", t: "Imagenología", p: 1200, d: 30, c: false, k: true },
    { n: "Fisioterapia", t: "Tratamiento", p: 700, d: 50, c: true, k: true },
    { n: "Telemedicina", t: "Telemedicina", p: 600, d: 25, c: false, k: false },
  ];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Catálogo de servicios</CardTitle>
          <CardDescription>Precios en MXN</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="h-9 w-48 pl-8" placeholder="Buscar servicio" />
          </div>
          <Button size="sm" onClick={onChange}><Plus className="mr-1.5 h-4 w-4" /> Nuevo</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Servicio</TableHead><TableHead>Tipo</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Duración</TableHead>
              <TableHead className="text-center">Consentimiento</TableHead>
              <TableHead className="text-center">Checklist</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servicios.map((s) => (
              <TableRow key={s.n}>
                <TableCell className="font-medium">{s.n}</TableCell>
                <TableCell><Badge variant="secondary">{s.t}</Badge></TableCell>
                <TableCell className="text-right">${s.p.toLocaleString("es-MX")}</TableCell>
                <TableCell className="text-right">{s.d} min</TableCell>
                <TableCell className="text-center"><Switch defaultChecked={s.c} onCheckedChange={onChange} /></TableCell>
                <TableCell className="text-center"><Switch defaultChecked={s.k} onCheckedChange={onChange} /></TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={onChange}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- 6. Doctores ---------------- */
function SectionDoctores({ onChange }: P) {
  const docs = [
    { n: "Dra. Ana López", e: "Medicina interna", c: "1234567", co: "Consultorio 1", h: "L-V 09:00–14:00" },
    { n: "Dr. Carlos Ruiz", e: "Traumatología", c: "7654321", co: "Consultorio 2", h: "L-S 15:00–20:00" },
    { n: "Dra. María Gómez", e: "Pediatría", c: "9988776", co: "Consultorio 3", h: "M-J 10:00–18:00" },
  ];
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Personal médico</CardTitle>
          <Button size="sm" onClick={onChange}><Plus className="mr-1.5 h-4 w-4" /> Agregar doctor</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nombre</TableHead><TableHead>Especialidad</TableHead>
              <TableHead>Cédula</TableHead><TableHead>Consultorio</TableHead>
              <TableHead>Horario</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.n}>
                  <TableCell className="font-medium">{d.n}</TableCell>
                  <TableCell>{d.e}</TableCell>
                  <TableCell>{d.c}</TableCell>
                  <TableCell>{d.co}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.h}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={onChange}>Editar</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Firma y encabezado de receta</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-40 items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
              Vista previa
            </div>
            <Button variant="outline" size="sm" onClick={onChange}><Upload className="mr-1.5 h-4 w-4" /> Subir firma</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- 7. Consultorios y Recursos ---------------- */
function SectionRecursos({ onChange }: P) {
  return (
    <Tabs defaultValue="consultorios">
      <TabsList>
        <TabsTrigger value="consultorios">Consultorios</TabsTrigger>
        <TabsTrigger value="salas">Salas de procedimiento</TabsTrigger>
        <TabsTrigger value="equipos">Equipos</TabsTrigger>
      </TabsList>

      <TabsContent value="consultorios" className="mt-4">
        <ResourceTable
          headers={["Nombre", "Piso", "Capacidad", "Estado"]}
          rows={[
            ["Consultorio 1", "PB", "2", "Disponible"],
            ["Consultorio 2", "PB", "2", "Ocupado"],
            ["Consultorio 3", "1°", "3", "Disponible"],
          ]}
          onChange={onChange}
        />
      </TabsContent>
      <TabsContent value="salas" className="mt-4">
        <ResourceTable
          headers={["Sala", "Tipo", "Capacidad", "Estado"]}
          rows={[
            ["Sala A", "Curaciones", "1", "Disponible"],
            ["Sala B", "Cirugía menor", "1", "Mantenimiento"],
          ]}
          onChange={onChange}
        />
      </TabsContent>
      <TabsContent value="equipos" className="mt-4">
        <ResourceTable
          headers={["Equipo", "Ubicación", "Próx. mantenimiento", "Estado"]}
          rows={[
            ["Ultrasonido GE", "Sala A", "15/08/2026", "Disponible"],
            ["Electrocardiógrafo", "Consultorio 2", "30/07/2026", "Disponible"],
            ["Autoclave", "Sala B", "10/07/2026", "Mantenimiento"],
          ]}
          onChange={onChange}
        />
      </TabsContent>
    </Tabs>
  );
}

function ResourceTable({ headers, rows, onChange }: { headers: string[]; rows: string[][]; onChange: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardDescription>{rows.length} registros</CardDescription>
        <Button size="sm" onClick={onChange}><Plus className="mr-1.5 h-4 w-4" /> Agregar</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}<TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                {r.map((c, j) => (
                  <TableCell key={j} className={j === 0 ? "font-medium" : ""}>
                    {j === r.length - 1 ? (
                      <Badge variant={c === "Disponible" ? "default" : c === "Mantenimiento" ? "destructive" : "secondary"}>{c}</Badge>
                    ) : c}
                  </TableCell>
                ))}
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={onChange}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- 8. Formularios del Paciente ---------------- */
function SectionFormularios({ onChange }: P) {
  const bloques = [
    { t: "Datos generales", d: "Nombre, fecha de nacimiento, sexo, CURP, contacto", on: true },
    { t: "Antecedentes médicos", d: "Personales, familiares, quirúrgicos", on: true },
    { t: "Alergias", d: "Medicamentos, alimentos, ambientales", on: true },
    { t: "Medicamentos actuales", d: "Lista activa con posología", on: true },
    { t: "Contacto de emergencia", d: "Nombre, parentesco, teléfono", on: true },
    { t: "Consentimientos informados", d: "Vinculados al servicio", on: true },
    { t: "Preguntas por especialidad", d: "Cuestionarios condicionales", on: false },
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Bloques del expediente</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        {bloques.map((b) => (
          <div key={b.t} className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">{b.t}</p>
              <p className="text-xs text-muted-foreground">{b.d}</p>
            </div>
            <Switch defaultChecked={b.on} onCheckedChange={onChange} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- 9. Checklists Clínicos ---------------- */
function SectionChecklists({ onChange }: P) {
  const checks = [
    { servicio: "Infiltración", pasos: 5, responsable: "Doctor", bloqueo: true },
    { servicio: "Ultrasonido", pasos: 3, responsable: "Enfermería", bloqueo: false },
    { servicio: "Cirugía menor", pasos: 8, responsable: "Doctor", bloqueo: true },
    { servicio: "Toma de muestra", pasos: 4, responsable: "Enfermería", bloqueo: true },
  ];
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Checklists por servicio</CardTitle>
          <Button size="sm" onClick={onChange}><Plus className="mr-1.5 h-4 w-4" /> Nuevo checklist</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Servicio</TableHead><TableHead>Pasos</TableHead>
              <TableHead>Responsable</TableHead><TableHead>Bloquear avance</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {checks.map((c) => (
                <TableRow key={c.servicio}>
                  <TableCell className="font-medium">{c.servicio}</TableCell>
                  <TableCell>{c.pasos}</TableCell>
                  <TableCell><Badge variant="secondary">{c.responsable}</Badge></TableCell>
                  <TableCell><Switch defaultChecked={c.bloqueo} onCheckedChange={onChange} /></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={onChange}>Configurar</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">Permitir justificación al omitir un paso</p>
            <p className="text-xs text-muted-foreground">Requiere capturar motivo y queda en auditoría</p>
          </div>
          <Switch defaultChecked onCheckedChange={onChange} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- 10. Facturación y Fiscal MX ---------------- */
function SectionFacturacion({ onChange }: P) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            CFDI 4.0 <Badge variant="outline">SAT México</Badge>
          </CardTitle>
          <CardDescription>Datos por defecto para emisión de comprobantes</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Régimen fiscal">
            <Select defaultValue="601" onValueChange={onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="601">601 · General de Ley Personas Morales</SelectItem>
                <SelectItem value="612">612 · Personas Físicas con Actividades Empresariales</SelectItem>
                <SelectItem value="621">621 · Incorporación Fiscal</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Uso CFDI">
            <Select defaultValue="d01" onValueChange={onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="d01">D01 · Honorarios médicos, dentales y hospitalarios</SelectItem>
                <SelectItem value="g03">G03 · Gastos en general</SelectItem>
                <SelectItem value="p01">P01 · Por definir</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Método de pago">
            <Select defaultValue="pue" onValueChange={onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pue">PUE · Pago en una sola exhibición</SelectItem>
                <SelectItem value="ppd">PPD · Pago en parcialidades o diferido</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Forma de pago">
            <Select defaultValue="01" onValueChange={onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="01">01 · Efectivo</SelectItem>
                <SelectItem value="03">03 · Transferencia electrónica</SelectItem>
                <SelectItem value="04">04 · Tarjeta de crédito</SelectItem>
                <SelectItem value="28">28 · Tarjeta de débito</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Serie"><Input defaultValue="A" onChange={onChange} /></Field>
          <Field label="Folio inicial"><Input type="number" defaultValue={1001} onChange={onChange} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Operaciones</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {[
            ["Permitir cancelación con motivo SAT", true],
            ["Emitir notas de crédito", true],
            ["Validar RFC del receptor en tiempo real", true],
            ["Envío automático de XML y PDF al paciente", true],
          ].map(([l, v]) => (
            <div key={l as string} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">{l}</span>
              <Switch defaultChecked={v as boolean} onCheckedChange={onChange} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Proveedor PAC</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="PAC">
            <Select defaultValue="placeholder" onValueChange={onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="placeholder">Seleccionar PAC…</SelectItem>
                <SelectItem value="facturama">Facturama</SelectItem>
                <SelectItem value="solucion">Solución Factible</SelectItem>
                <SelectItem value="sw">SW Sapien</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Usuario PAC"><Input placeholder="usuario@pac" onChange={onChange} /></Field>
          <Field label="Ambiente">
            <Select defaultValue="pruebas" onValueChange={onChange}>
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

/* ---------------- 11. Pagos ---------------- */
function SectionPagos({ onChange }: P) {
  const metodos = [
    ["Efectivo", true], ["Tarjeta", true], ["Transferencia", true],
    ["Mercado Pago", false], ["Stripe", false],
  ];
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Métodos de pago</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {metodos.map(([l, v]) => (
            <div key={l as string} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm font-medium">{l}</span>
              <Switch defaultChecked={v as boolean} onCheckedChange={onChange} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Políticas</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {[
            ["Aceptar anticipos", true],
            ["Permitir pagos parciales", true],
            ["Habilitar reembolsos", true],
            ["Solicitar autorización para reembolso > $1,000", true],
          ].map(([l, v]) => (
            <div key={l as string} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">{l}</span>
              <Switch defaultChecked={v as boolean} onCheckedChange={onChange} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- 12. Inventario y Costos ---------------- */
function SectionInventario({ onChange }: P) {
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
                  ["Jeringa 5ml", "120", "30", "12/2027", 4.5],
                  ["Guantes nitrilo M", "20", "50", "06/2027", 3.2, true],
                  ["Lidocaína 2%", "15", "10", "03/2026", 85],
                  ["Alcohol 70% 1L", "8", "5", "—", 45],
                ].map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r[0]}</TableCell>
                    <TableCell>
                      {r[1]}{r[6] && <Badge variant="destructive" className="ml-2">Bajo stock</Badge>}
                    </TableCell>
                    <TableCell>{r[2]}</TableCell>
                    <TableCell>{r[3]}</TableCell>
                    <TableCell className="text-right">${(r[4] as number).toLocaleString("es-MX")}</TableCell>
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
                  ["Infiltración", "6", 320, 2500],
                  ["Curación mayor", "8", 180, 950],
                  ["Toma de muestra", "4", 65, 650],
                ].map((r, i) => {
                  const m = Math.round((((r[3] as number) - (r[2] as number)) / (r[3] as number)) * 100);
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r[0]}</TableCell>
                      <TableCell>{r[1]} ítems</TableCell>
                      <TableCell className="text-right">${(r[2] as number).toLocaleString("es-MX")}</TableCell>
                      <TableCell className="text-right">${(r[3] as number).toLocaleString("es-MX")}</TableCell>
                      <TableCell className="text-right"><Badge variant={m > 50 ? "default" : "secondary"}>{m}%</Badge></TableCell>
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
                  ["MediSupply MX", "Juan Pérez", "55 1111 2222", "12/05/2026"],
                  ["Farmacéutica del Valle", "Lucía Soto", "55 3333 4444", "28/04/2026"],
                ].map((r, i) => (
                  <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className={j === 0 ? "font-medium" : ""}>{c}</TableCell>)}</TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

/* ---------------- 13. Usuarios y Permisos ---------------- */
function SectionUsuarios({ onChange }: P) {
  const roles = ["Administrador", "Director médico", "Doctor", "Enfermería", "Recepción", "Caja", "Inventario", "Auditoría", "Paciente"];
  const modulos = ["Agenda", "Expedientes", "Recetas", "Facturación", "Pagos", "Inventario", "Reportes", "Configuración"];
  const matriz: Record<string, Record<string, "all" | "read" | "none">> = {
    Administrador: Object.fromEntries(modulos.map((m) => [m, "all"])),
    "Director médico": { Agenda: "all", Expedientes: "all", Recetas: "all", Facturación: "read", Pagos: "read", Inventario: "read", Reportes: "all", Configuración: "read" },
    Doctor: { Agenda: "all", Expedientes: "all", Recetas: "all", Facturación: "none", Pagos: "none", Inventario: "read", Reportes: "read", Configuración: "none" },
    Enfermería: { Agenda: "read", Expedientes: "all", Recetas: "read", Facturación: "none", Pagos: "none", Inventario: "all", Reportes: "none", Configuración: "none" },
    Recepción: { Agenda: "all", Expedientes: "read", Recetas: "read", Facturación: "all", Pagos: "all", Inventario: "none", Reportes: "read", Configuración: "none" },
    Caja: { Agenda: "read", Expedientes: "none", Recetas: "none", Facturación: "all", Pagos: "all", Inventario: "none", Reportes: "read", Configuración: "none" },
    Inventario: { Agenda: "none", Expedientes: "none", Recetas: "none", Facturación: "none", Pagos: "none", Inventario: "all", Reportes: "read", Configuración: "none" },
    Auditoría: Object.fromEntries(modulos.map((m) => [m, "read"])),
    Paciente: { Agenda: "read", Expedientes: "read", Recetas: "read", Facturación: "read", Pagos: "read", Inventario: "none", Reportes: "none", Configuración: "none" },
  };
  const dot = (v: string) =>
    v === "all" ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> :
    v === "read" ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> :
    <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Roles</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {roles.map((r) => <Badge key={r} variant="secondary" className="px-3 py-1">{r}</Badge>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matriz de permisos</CardTitle>
          <CardDescription className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Total</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> Lectura</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" /> Sin acceso</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rol</TableHead>
                {modulos.map((m) => <TableHead key={m} className="text-center">{m}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r}>
                  <TableCell className="font-medium">{r}</TableCell>
                  {modulos.map((m) => (
                    <TableCell key={m} className="text-center">
                      <button onClick={onChange} className="inline-flex">{dot(matriz[r][m])}</button>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- 14. Auditoría y Cumplimiento ---------------- */
function SectionAuditoria({ onChange }: P) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Trazabilidad</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {[
            ["Registrar logs de acceso", true],
            ["Registrar consentimientos firmados", true],
            ["Versionado de expediente clínico", true],
            ["Exportación de expediente bajo solicitud", true],
          ].map(([l, v]) => (
            <div key={l as string} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">{l}</span>
              <Switch defaultChecked={v as boolean} onCheckedChange={onChange} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Políticas</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Retención de datos (años)" hint="NOM-004-SSA3: mínimo 5 años">
            <Input type="number" defaultValue={5} onChange={onChange} />
          </Field>
          <Field label="Frecuencia de respaldo">
            <Select defaultValue="diario" onValueChange={onChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diario</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensual">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Aviso de privacidad (URL)">
            <Input defaultValue="https://integrika.mx/aviso-de-privacidad" onChange={onChange} />
          </Field>
          <Field label="Responsable del tratamiento de datos">
            <Input defaultValue="Lic. María Hernández" onChange={onChange} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-4">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Diseñado para apoyar trazabilidad y cumplimiento</p>
              <p className="text-xs text-muted-foreground">
                Esta plataforma facilita el registro auditable de operaciones clínicas. La certificación
                regulatoria depende de los procesos internos de cada clínica.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Separator />
    </div>
  );
}
