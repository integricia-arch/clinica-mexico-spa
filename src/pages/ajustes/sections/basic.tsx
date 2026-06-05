import { useEffect } from "react";
import { Building2, Plus, Trash2, Upload, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, type SectionProps } from "../shared";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useClinicGeneral } from "@/hooks/useClinicGeneral";
import { useClinicSettingsForm } from "@/hooks/useClinicSettingsForm";

/* ---------------- 1. General (persistencia real → tabla clinics) ---------------- */
export function SectionGeneral({ onChange, registerSave }: SectionProps) {
  const { activeClinicId, isGlobalAdmin } = useActiveClinic();
  const { form, setField, loading, error, save, reset } = useClinicGeneral(activeClinicId);
  const readOnly = !isGlobalAdmin;

  // Registrar guardado/reset en el shell. save/reset cierran sobre el form actual.
  useEffect(() => {
    registerSave?.({ save, reset });
  }, [registerSave, save, reset]);

  // Cambio inmutable + marcar dirty en el shell.
  const edit = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setField(key, value);
    onChange();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando datos de la clínica…
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
        <CardHeader><CardTitle className="text-base">Identidad</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre de la clínica">
            <Input value={form.name} disabled={readOnly} onChange={(e) => edit("name", e.target.value)} />
          </Field>
          <Field label="Razón social">
            <Input value={form.legalName} disabled={readOnly} onChange={(e) => edit("legalName", e.target.value)} />
          </Field>
          <Field label="RFC">
            <Input value={form.rfc} disabled={readOnly} onChange={(e) => edit("rfc", e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <Input value={form.phone} disabled={readOnly} onChange={(e) => edit("phone", e.target.value)} />
          </Field>
          <Field label="Correo">
            <Input type="email" value={form.email} disabled={readOnly} onChange={(e) => edit("email", e.target.value)} />
          </Field>
          <Field label="Zona horaria">
            <Select value={form.timezone} disabled={readOnly} onValueChange={(v) => edit("timezone", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cdmx">América/Ciudad de México (GMT-6)</SelectItem>
                <SelectItem value="cun">América/Cancún (GMT-5)</SelectItem>
                <SelectItem value="tij">América/Tijuana (GMT-8)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Dirección" hint="Calle, número, colonia, municipio, CP">
            <Input value={form.address} disabled={readOnly} onChange={(e) => edit("address", e.target.value)} />
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
            <Button variant="outline" size="sm" disabled>
              <Upload className="mr-1.5 h-4 w-4" /> Subir logotipo
            </Button>
            <p className="text-[11px] text-muted-foreground">Próximamente · PNG o SVG, mínimo 256×256</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- 2. Horarios ---------------- */
export function SectionHorarios({ onChange }: SectionProps) {
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

/* ---------------- 3. Citas (persistencia real → clinic_settings/citas) ---------------- */
interface CitasForm {
  duracionDefault: number;
  anticipacionMin: number;
  reprogramaciones: number;
  plazoCancelacion: number;
  citasEnLinea: boolean;
  listaEspera: boolean;
  confirmacionAuto24h: boolean;
  cobroAnticipo: boolean;
}

const CITAS_DEFAULTS: CitasForm = {
  duracionDefault: 30,
  anticipacionMin: 2,
  reprogramaciones: 3,
  plazoCancelacion: 24,
  citasEnLinea: true,
  listaEspera: true,
  confirmacionAuto24h: false,
  cobroAnticipo: false,
};

const CITAS_TOGGLES: { key: keyof CitasForm; label: string }[] = [
  { key: "citasEnLinea", label: "Permitir citas en línea" },
  { key: "listaEspera", label: "Activar lista de espera" },
  { key: "confirmacionAuto24h", label: "Confirmación automática 24h antes" },
  { key: "cobroAnticipo", label: "Cobro de anticipo para reservar" },
];

export function SectionCitas({ onChange, registerSave }: SectionProps) {
  const { activeClinicId, isGlobalAdmin } = useActiveClinic();
  const readOnly = !isGlobalAdmin;
  const { form, setField, loading, error, save, reset } = useClinicSettingsForm<CitasForm>(
    activeClinicId,
    "citas",
    CITAS_DEFAULTS,
  );

  useEffect(() => {
    registerSave?.({ save, reset });
  }, [registerSave, save, reset]);

  const edit = <K extends keyof CitasForm>(key: K, value: CitasForm[K]) => {
    setField(key, value);
    onChange();
  };

  const num = (key: keyof CitasForm, raw: string) => {
    const n = Number(raw);
    edit(key, (Number.isFinite(n) ? n : 0) as CitasForm[typeof key]);
  };

  const estados = [
    { k: "pendiente", c: "bg-slate-100 text-slate-700" },
    { k: "confirmada", c: "bg-blue-100 text-blue-700" },
    { k: "en recepción", c: "bg-indigo-100 text-indigo-700" },
    { k: "en consulta", c: "bg-violet-100 text-violet-700" },
    { k: "completada", c: "bg-emerald-100 text-emerald-700" },
    { k: "no-show", c: "bg-amber-100 text-amber-700" },
    { k: "cancelada", c: "bg-rose-100 text-rose-700" },
  ];

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando reglas de citas…
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
        <CardHeader><CardTitle className="text-base">Reglas de agenda</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Duración default (min)">
            <Input type="number" value={form.duracionDefault} disabled={readOnly} onChange={(e) => num("duracionDefault", e.target.value)} />
          </Field>
          <Field label="Anticipación mínima (horas)">
            <Input type="number" value={form.anticipacionMin} disabled={readOnly} onChange={(e) => num("anticipacionMin", e.target.value)} />
          </Field>
          <Field label="Reprogramaciones permitidas">
            <Input type="number" value={form.reprogramaciones} disabled={readOnly} onChange={(e) => num("reprogramaciones", e.target.value)} />
          </Field>
          <Field label="Plazo para cancelar (horas)">
            <Input type="number" value={form.plazoCancelacion} disabled={readOnly} onChange={(e) => num("plazoCancelacion", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2">
          {CITAS_TOGGLES.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">{label}</span>
              <Switch checked={form[key] as boolean} disabled={readOnly} onCheckedChange={(v) => edit(key, v as CitasForm[typeof key])} />
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

/* ---------------- 4. Recordatorios (persistencia real → clinic_settings/recordatorios) ---------------- */
interface RecordatoriosForm {
  canalWhatsapp: boolean;
  canalSms: boolean;
  canalEmail: boolean;
  canalLlamada: boolean;
  t72: boolean;
  t24: boolean;
  t3: boolean;
  t1: boolean;
  asunto: string;
  mensaje: string;
}

const RECORDATORIOS_DEFAULTS: RecordatoriosForm = {
  canalWhatsapp: true,
  canalSms: true,
  canalEmail: true,
  canalLlamada: false,
  t72: false,
  t24: true,
  t3: true,
  t1: true,
  asunto: "Recordatorio de su cita en Integriclínica",
  mensaje:
    "Hola {{paciente}}, le recordamos su cita el {{fecha}} a las {{hora}} con {{doctor}} en {{consultorio}}. Conteste CONFIRMAR para confirmar o CANCELAR para cancelar.",
};

const CANALES: { key: keyof RecordatoriosForm; label: string }[] = [
  { key: "canalWhatsapp", label: "WhatsApp" },
  { key: "canalSms", label: "SMS" },
  { key: "canalEmail", label: "Email" },
  { key: "canalLlamada", label: "Llamada manual" },
];

const TIEMPOS: { key: keyof RecordatoriosForm; label: string }[] = [
  { key: "t72", label: "72 horas antes" },
  { key: "t24", label: "24 horas antes" },
  { key: "t3", label: "3 horas antes" },
  { key: "t1", label: "1 hora antes" },
];

export function SectionRecordatorios({ onChange, registerSave }: SectionProps) {
  const { activeClinicId, isGlobalAdmin } = useActiveClinic();
  const readOnly = !isGlobalAdmin;
  const { form, setField, loading, error, save, reset } = useClinicSettingsForm<RecordatoriosForm>(
    activeClinicId,
    "recordatorios",
    RECORDATORIOS_DEFAULTS,
  );

  useEffect(() => {
    registerSave?.({ save, reset });
  }, [registerSave, save, reset]);

  const edit = <K extends keyof RecordatoriosForm>(key: K, value: RecordatoriosForm[K]) => {
    setField(key, value);
    onChange();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando recordatorios…
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
        <CardHeader><CardTitle className="text-base">Canales activos</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {CANALES.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm font-medium">{label}</span>
              <Switch checked={form[key] as boolean} disabled={readOnly} onCheckedChange={(v) => edit(key, v as RecordatoriosForm[typeof key])} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Programación</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {TIEMPOS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">{label}</span>
              <Switch checked={form[key] as boolean} disabled={readOnly} onCheckedChange={(v) => edit(key, v as RecordatoriosForm[typeof key])} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Plantilla de mensaje</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Asunto">
            <Input value={form.asunto} disabled={readOnly} onChange={(e) => edit("asunto", e.target.value)} />
          </Field>
          <Field label="Mensaje" hint="Variables disponibles: {{paciente}} {{fecha}} {{hora}} {{doctor}} {{consultorio}}">
            <Textarea rows={5} value={form.mensaje} disabled={readOnly} onChange={(e) => edit("mensaje", e.target.value)} />
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}
