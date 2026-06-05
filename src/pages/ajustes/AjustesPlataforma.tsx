import { useState, useMemo, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2, Clock, CalendarDays, Bell, Stethoscope, UserCog, DoorOpen,
  ClipboardList, ListChecks, Receipt, CreditCard, Boxes, ShieldCheck,
  FileSignature, Save, X, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { SectionGeneral, SectionHorarios, SectionCitas, SectionRecordatorios } from "./sections/basic";
import { SectionRecursos, SectionFormularios, SectionChecklists } from "./sections/clinical";
import { SectionServicios } from "./sections/servicios";
import { SectionDoctores } from "./sections/doctores";
import { SectionFacturacion, SectionPagos, SectionInventario } from "./sections/finance";
import { SectionUsuarios, SectionAuditoria } from "./sections/admin";
import type { SectionSaver } from "./shared";

type SectionId =
  | "general" | "horarios" | "citas" | "recordatorios" | "servicios"
  | "doctores" | "recursos" | "formularios" | "checklists" | "facturacion"
  | "pagos" | "inventario" | "usuarios" | "auditoria";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; desc: string }[] = [
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
  const [saver, setSaver] = useState<SectionSaver>(null);
  const [saving, setSaving] = useState(false);
  const markDirty = () => setDirty(true);

  // Las secciones con persistencia real registran aquí su guardado; las demo lo ignoran.
  const registerSave = useCallback((s: SectionSaver) => setSaver(s), []);

  // Cambiar de sección: reset síncrono antes de que monte la nueva sección
  // (evita carrera con el efecto de registro del hijo, que corre primero).
  const goToSection = useCallback((id: SectionId) => {
    setActive(id);
    setSaver(null);
    setDirty(false);
  }, []);

  const handleSave = async () => {
    if (!saver) {
      setDirty(false);
      toast.success("Cambios guardados (demo visual)");
      return;
    }
    setSaving(true);
    try {
      await saver.save();
      setDirty(false);
      toast.success("Cambios guardados");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDirty(false);
    if (saver?.reset) {
      saver.reset();
      toast.info("Cambios descartados");
    } else {
      toast.info("Cambios descartados");
    }
  };

  const current = useMemo(() => SECTIONS.find((s) => s.id === active)!, [active]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-2xl font-bold tracking-tight">Configuración avanzada</h1>
          <p className="text-sm text-muted-foreground">Centro de control de tu clínica · vista demo</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Badge variant="outline" className="gap-1.5 border-amber-300 bg-amber-50 text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" /> Cambios sin guardar
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={!dirty || saving}>
            <X className="mr-1.5 h-4 w-4" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
            <Save className="mr-1.5 h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
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
                      onClick={() => goToSection(s.id)}
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

          {active === "general" && <SectionGeneral onChange={markDirty} registerSave={registerSave} />}
          {active === "horarios" && <SectionHorarios onChange={markDirty} registerSave={registerSave} />}
          {active === "citas" && <SectionCitas onChange={markDirty} registerSave={registerSave} />}
          {active === "recordatorios" && <SectionRecordatorios onChange={markDirty} registerSave={registerSave} />}
          {active === "servicios" && <SectionServicios onChange={markDirty} />}
          {active === "doctores" && <SectionDoctores onChange={markDirty} />}
          {active === "recursos" && <SectionRecursos onChange={markDirty} />}
          {active === "formularios" && <SectionFormularios onChange={markDirty} registerSave={registerSave} />}
          {active === "checklists" && <SectionChecklists onChange={markDirty} />}
          {active === "facturacion" && <SectionFacturacion onChange={markDirty} registerSave={registerSave} />}
          {active === "pagos" && <SectionPagos onChange={markDirty} registerSave={registerSave} />}
          {active === "inventario" && <SectionInventario onChange={markDirty} />}
          {active === "usuarios" && <SectionUsuarios onChange={markDirty} registerSave={registerSave} />}
          {active === "auditoria" && <SectionAuditoria onChange={markDirty} registerSave={registerSave} />}
        </section>
      </div>
    </div>
  );
}
