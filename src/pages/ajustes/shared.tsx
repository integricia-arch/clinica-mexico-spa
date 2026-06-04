import { Label } from "@/components/ui/label";

/** Implementación de guardado que una sección expone al shell. */
export type SectionSaver = { save: () => Promise<void>; reset?: () => void } | null;

/**
 * Props compartidas por cada sección.
 * - `onChange`: notifica cambios al shell para marcar "dirty" y habilitar Guardar.
 * - `registerSave`: opcional. Las secciones con persistencia real registran su
 *   función de guardado; las secciones demo lo ignoran y el shell usa el mock.
 */
export type SectionProps = {
  onChange: () => void;
  registerSave?: (saver: SectionSaver) => void;
};

/** Campo etiquetado reutilizable en los formularios de ajustes. */
export const Field = ({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);
