import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileText, Shield } from "lucide-react";

export type RecetaData = {
  nombre_medico: string;
  cedula_profesional: string;
  especialidad: string;
  fecha_receta: string;
  folio_receta: string;
  nombre_paciente: string;
  diagnostico: string;
  receta_retenida: boolean;
  folio_cofepris: string;
  notas: string;
  grupo: "II" | "III" | "IV";
};

type Props = {
  medsConReceta: { nombre: string; controlado: boolean }[];
  onConfirm: (data: RecetaData) => void;
  onCancel: () => void;
};

const empty = (): RecetaData => ({
  nombre_medico: "",
  cedula_profesional: "",
  especialidad: "",
  fecha_receta: new Date().toISOString().slice(0, 10),
  folio_receta: "",
  nombre_paciente: "",
  diagnostico: "",
  receta_retenida: false,
  folio_cofepris: "",
  notas: "",
  grupo: "II",
});

export function RecetaValidacionModal({ medsConReceta, onConfirm, onCancel }: Props) {
  const [form, setForm] = useState<RecetaData>(empty);
  const [errors, setErrors] = useState<string[]>([]);

  const hayControlados = medsConReceta.some((m) => m.controlado);
  const grupo = hayControlados ? ("IV" as const) : form.grupo;

  const set = (k: keyof RecetaData, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e: string[] = [];
    if (!form.nombre_medico.trim()) e.push("Nombre del médico requerido");
    if (!form.cedula_profesional.trim()) e.push("Cédula profesional requerida");
    if (!form.fecha_receta) e.push("Fecha de receta requerida");
    if (hayControlados && !form.folio_cofepris.trim()) e.push("Folio COFEPRIS requerido para medicamento controlado");
    if (hayControlados && !form.diagnostico.trim()) e.push("Diagnóstico requerido para medicamento controlado");
    return e;
  };

  const handleConfirm = () => {
    const e = validate();
    if (e.length > 0) { setErrors(e); return; }
    onConfirm({ ...form, grupo, receta_retenida: hayControlados ? true : form.receta_retenida });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card shadow-2xl border border-border overflow-y-auto max-h-[90vh]">
        <div className="p-5 border-b border-border flex items-center gap-3">
          {hayControlados
            ? <Shield className="h-5 w-5 text-destructive shrink-0" />
            : <FileText className="h-5 w-5 text-primary shrink-0" />}
          <div>
            <h2 className="font-semibold text-base">Validación de receta médica</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hayControlados
                ? "Medicamento controlado — Grupo IV (COFEPRIS). Receta triplicado requerida."
                : "Los siguientes medicamentos requieren receta médica."}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Medicamentos que requieren receta */}
          <div className="flex flex-wrap gap-1">
            {medsConReceta.map((m) => (
              <Badge key={m.nombre} variant={m.controlado ? "destructive" : "secondary"} className="text-xs">
                {m.controlado && <Shield className="h-3 w-3 mr-1" />}
                {m.nombre}
              </Badge>
            ))}
          </div>

          {/* Grupo (solo si no es controlado) */}
          {!hayControlados && (
            <div>
              <Label className="text-xs">Grupo de receta</Label>
              <select
                value={form.grupo}
                onChange={(e) => set("grupo", e.target.value as "II" | "III" | "IV")}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="II">Grupo II — Receta simple</option>
                <option value="III">Grupo III — Receta especial retenida</option>
              </select>
            </div>
          )}

          {/* Datos del prescriptor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nombre del médico *</Label>
              <Input className="mt-1" value={form.nombre_medico}
                onChange={(e) => set("nombre_medico", e.target.value)}
                placeholder="Dr. Juan Pérez García" />
            </div>
            <div>
              <Label className="text-xs">Cédula profesional *</Label>
              <Input className="mt-1" value={form.cedula_profesional}
                onChange={(e) => set("cedula_profesional", e.target.value)}
                placeholder="12345678" maxLength={10} />
            </div>
            <div>
              <Label className="text-xs">Especialidad</Label>
              <Input className="mt-1" value={form.especialidad}
                onChange={(e) => set("especialidad", e.target.value)}
                placeholder="Medicina General" />
            </div>
            <div>
              <Label className="text-xs">Fecha de la receta *</Label>
              <Input className="mt-1" type="date" value={form.fecha_receta}
                onChange={(e) => set("fecha_receta", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Folio / No. de receta</Label>
              <Input className="mt-1" value={form.folio_receta}
                onChange={(e) => set("folio_receta", e.target.value)}
                placeholder="RX-2026-001" />
            </div>
          </div>

          {/* Datos del paciente */}
          <div>
            <Label className="text-xs">Nombre del paciente</Label>
            <Input className="mt-1" value={form.nombre_paciente}
              onChange={(e) => set("nombre_paciente", e.target.value)}
              placeholder="Nombre del paciente" />
          </div>
          <div>
            <Label className="text-xs">
              Diagnóstico {hayControlados && <span className="text-destructive">*</span>}
            </Label>
            <Input className="mt-1" value={form.diagnostico}
              onChange={(e) => set("diagnostico", e.target.value)}
              placeholder="Diagnóstico o motivo de prescripción" />
          </div>

          {/* Folio COFEPRIS (controlados Grupo IV) */}
          {hayControlados && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                <Shield className="h-3 w-3" /> Medicamento controlado — Grupo IV
              </p>
              <div>
                <Label className="text-xs">Folio COFEPRIS (receta triplicado) *</Label>
                <Input className="mt-1" value={form.folio_cofepris}
                  onChange={(e) => set("folio_cofepris", e.target.value)}
                  placeholder="Folio del triplicado COFEPRIS" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Receta original se retiene obligatoriamente. Conserva una copia para el reporte SSA mensual.
              </p>
            </div>
          )}

          {/* Receta retenida */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="retenida"
              checked={hayControlados ? true : form.receta_retenida}
              disabled={hayControlados}
              onCheckedChange={(v) => set("receta_retenida", !!v)}
            />
            <Label htmlFor="retenida" className="text-sm cursor-pointer">
              Receta retenida en farmacia
              {hayControlados && <span className="ml-1 text-xs text-destructive">(obligatorio)</span>}
            </Label>
          </div>

          {/* Notas */}
          <div>
            <Label className="text-xs">Notas adicionales</Label>
            <Textarea className="mt-1 text-sm" rows={2} value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
              placeholder="Observaciones…" />
          </div>

          {/* Errores */}
          {errors.length > 0 && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 space-y-1">
              {errors.map((e) => (
                <p key={e} className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />{e}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleConfirm}>
            <FileText className="h-4 w-4 mr-1" />
            Validar y cobrar
          </Button>
        </div>
      </div>
    </div>
  );
}
