import { Building2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, type SectionProps } from "../shared";

/* ---------------- 1. General ---------------- */
export function SectionGeneral({ onChange }: SectionProps) {
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

/* ---------------- 3. Citas ---------------- */
export function SectionCitas({ onChange }: SectionProps) {
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
export function SectionRecordatorios({ onChange }: SectionProps) {
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
