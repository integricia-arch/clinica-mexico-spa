import { Label } from "@/components/ui/label";

/** Props compartidas por cada sección: notifica cambios al shell para marcar "dirty". */
export type SectionProps = { onChange: () => void };

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
