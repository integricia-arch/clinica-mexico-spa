import { ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, type SectionProps } from "../shared";

type PermLevel = "all" | "read" | "none";

/* ---------------- 13. Usuarios y Permisos ---------------- */
export function SectionUsuarios({ onChange }: SectionProps) {
  const roles = ["Administrador", "Director médico", "Doctor", "Enfermería", "Recepción", "Caja", "Inventario", "Auditoría", "Paciente"];
  const modulos = ["Agenda", "Expedientes", "Recetas", "Facturación", "Pagos", "Inventario", "Reportes", "Configuración"];
  const matriz: Record<string, Record<string, PermLevel>> = {
    Administrador: Object.fromEntries(modulos.map((m) => [m, "all"])) as Record<string, PermLevel>,
    "Director médico": { Agenda: "all", Expedientes: "all", Recetas: "all", Facturación: "read", Pagos: "read", Inventario: "read", Reportes: "all", Configuración: "read" },
    Doctor: { Agenda: "all", Expedientes: "all", Recetas: "all", Facturación: "none", Pagos: "none", Inventario: "read", Reportes: "read", Configuración: "none" },
    Enfermería: { Agenda: "read", Expedientes: "all", Recetas: "read", Facturación: "none", Pagos: "none", Inventario: "all", Reportes: "none", Configuración: "none" },
    Recepción: { Agenda: "all", Expedientes: "read", Recetas: "read", Facturación: "all", Pagos: "all", Inventario: "none", Reportes: "read", Configuración: "none" },
    Caja: { Agenda: "read", Expedientes: "none", Recetas: "none", Facturación: "all", Pagos: "all", Inventario: "none", Reportes: "read", Configuración: "none" },
    Inventario: { Agenda: "none", Expedientes: "none", Recetas: "none", Facturación: "none", Pagos: "none", Inventario: "all", Reportes: "read", Configuración: "none" },
    Auditoría: Object.fromEntries(modulos.map((m) => [m, "read"])) as Record<string, PermLevel>,
    Paciente: { Agenda: "read", Expedientes: "read", Recetas: "read", Facturación: "read", Pagos: "read", Inventario: "none", Reportes: "none", Configuración: "none" },
  };
  const dot = (v: PermLevel) =>
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
export function SectionAuditoria({ onChange }: SectionProps) {
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
