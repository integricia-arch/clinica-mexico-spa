import { useEffect } from "react";
import { ShieldCheck, Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field, type SectionProps } from "../shared";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useClinicSettingsForm } from "@/hooks/useClinicSettingsForm";

type PermLevel = "all" | "read" | "none";

const ROLES = ["Administrador", "Director médico", "Doctor", "Enfermería", "Recepción", "Caja", "Inventario", "Auditoría", "Paciente"];
const MODULOS = ["Agenda", "Expedientes", "Recetas", "Facturación", "Pagos", "Inventario", "Reportes", "Configuración"];

type PermMatrix = Record<string, Record<string, PermLevel>>;

const PERMISOS_DEFAULTS: PermMatrix = {
  Administrador: Object.fromEntries(MODULOS.map((m) => [m, "all"])) as Record<string, PermLevel>,
  "Director médico": { Agenda: "all", Expedientes: "all", Recetas: "all", Facturación: "read", Pagos: "read", Inventario: "read", Reportes: "all", Configuración: "read" },
  Doctor: { Agenda: "all", Expedientes: "all", Recetas: "all", Facturación: "none", Pagos: "none", Inventario: "read", Reportes: "read", Configuración: "none" },
  Enfermería: { Agenda: "read", Expedientes: "all", Recetas: "read", Facturación: "none", Pagos: "none", Inventario: "all", Reportes: "none", Configuración: "none" },
  Recepción: { Agenda: "all", Expedientes: "read", Recetas: "read", Facturación: "all", Pagos: "all", Inventario: "none", Reportes: "read", Configuración: "none" },
  Caja: { Agenda: "read", Expedientes: "none", Recetas: "none", Facturación: "all", Pagos: "all", Inventario: "none", Reportes: "read", Configuración: "none" },
  Inventario: { Agenda: "none", Expedientes: "none", Recetas: "none", Facturación: "none", Pagos: "none", Inventario: "all", Reportes: "read", Configuración: "none" },
  Auditoría: Object.fromEntries(MODULOS.map((m) => [m, "read"])) as Record<string, PermLevel>,
  Paciente: { Agenda: "read", Expedientes: "read", Recetas: "read", Facturación: "read", Pagos: "read", Inventario: "none", Reportes: "none", Configuración: "none" },
};

const NEXT_LEVEL: Record<PermLevel, PermLevel> = { all: "read", read: "none", none: "all" };

const dot = (v: PermLevel) =>
  v === "all" ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> :
  v === "read" ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> :
  <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />;

/* ---------------- 13. Usuarios y Permisos (persistencia → clinic_settings/permisos) ---------------- */
export function SectionUsuarios({ onChange, registerSave }: SectionProps) {
  const { activeClinicId, isGlobalAdmin } = useActiveClinic();
  const readOnly = !isGlobalAdmin;
  const { form, setField, loading, error, save, reset } = useClinicSettingsForm<PermMatrix>(
    activeClinicId,
    "permisos",
    PERMISOS_DEFAULTS,
  );

  useEffect(() => {
    registerSave?.({ save, reset });
  }, [registerSave, save, reset]);

  // Ciclo all → read → none → all sobre una celda (rol, módulo). Inmutable.
  const cycle = (rol: string, modulo: string) => {
    if (readOnly) return;
    const fila = form[rol] ?? PERMISOS_DEFAULTS[rol];
    const actual: PermLevel = fila[modulo] ?? "none";
    setField(rol, { ...fila, [modulo]: NEXT_LEVEL[actual] });
    onChange();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando matriz de permisos…
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
        <CardHeader><CardTitle className="text-base">Roles</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ROLES.map((r) => <Badge key={r} variant="secondary" className="px-3 py-1">{r}</Badge>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matriz de permisos</CardTitle>
          <CardDescription className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Total</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> Lectura</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" /> Sin acceso</span>
            {!readOnly && <span className="text-muted-foreground">· Clic en un punto para cambiar el nivel</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rol</TableHead>
                {MODULOS.map((m) => <TableHead key={m} className="text-center">{m}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROLES.map((r) => {
                const fila = form[r] ?? PERMISOS_DEFAULTS[r];
                return (
                  <TableRow key={r}>
                    <TableCell className="font-medium">{r}</TableCell>
                    {MODULOS.map((m) => (
                      <TableCell key={m} className="text-center">
                        <button
                          onClick={() => cycle(r, m)}
                          disabled={readOnly}
                          className="inline-flex disabled:cursor-not-allowed"
                          aria-label={`${r} · ${m}: ${fila[m] ?? "none"}`}
                        >
                          {dot(fila[m] ?? "none")}
                        </button>
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- 14. Auditoría y Cumplimiento (persistencia → clinic_settings/auditoria) ---------------- */
interface AuditoriaForm {
  logsAcceso: boolean;
  consentimientos: boolean;
  versionado: boolean;
  exportacion: boolean;
  retencionAnios: number;
  frecuenciaRespaldo: string;
  avisoPrivacidadUrl: string;
  responsableDatos: string;
}

const AUDITORIA_DEFAULTS: AuditoriaForm = {
  logsAcceso: true,
  consentimientos: true,
  versionado: true,
  exportacion: true,
  retencionAnios: 5,
  frecuenciaRespaldo: "diario",
  avisoPrivacidadUrl: "https://integrika.mx/aviso-de-privacidad",
  responsableDatos: "Lic. María Hernández",
};

const AUDITORIA_TOGGLES: { key: keyof AuditoriaForm; label: string }[] = [
  { key: "logsAcceso", label: "Registrar logs de acceso" },
  { key: "consentimientos", label: "Registrar consentimientos firmados" },
  { key: "versionado", label: "Versionado de expediente clínico" },
  { key: "exportacion", label: "Exportación de expediente bajo solicitud" },
];

export function SectionAuditoria({ onChange, registerSave }: SectionProps) {
  const { activeClinicId, isGlobalAdmin } = useActiveClinic();
  const readOnly = !isGlobalAdmin;
  const { form, setField, loading, error, save, reset } = useClinicSettingsForm<AuditoriaForm>(
    activeClinicId,
    "auditoria",
    AUDITORIA_DEFAULTS,
  );

  useEffect(() => {
    registerSave?.({ save, reset });
  }, [registerSave, save, reset]);

  const edit = <K extends keyof AuditoriaForm>(key: K, value: AuditoriaForm[K]) => {
    setField(key, value);
    onChange();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando políticas de cumplimiento…
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
        <CardHeader><CardTitle className="text-base">Trazabilidad</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {AUDITORIA_TOGGLES.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">{label}</span>
              <Switch
                checked={form[key] as boolean}
                disabled={readOnly}
                onCheckedChange={(v) => edit(key, v as AuditoriaForm[typeof key])}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Políticas</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Retención de datos (años)" hint="NOM-004-SSA3: mínimo 5 años">
            <Input
              type="number"
              value={form.retencionAnios}
              disabled={readOnly}
              onChange={(e) => edit("retencionAnios", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Frecuencia de respaldo">
            <Select value={form.frecuenciaRespaldo} disabled={readOnly} onValueChange={(v) => edit("frecuenciaRespaldo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diario</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensual">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Aviso de privacidad (URL)">
            <Input value={form.avisoPrivacidadUrl} disabled={readOnly} onChange={(e) => edit("avisoPrivacidadUrl", e.target.value)} />
          </Field>
          <Field label="Responsable del tratamiento de datos">
            <Input value={form.responsableDatos} disabled={readOnly} onChange={(e) => edit("responsableDatos", e.target.value)} />
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
