import { KANBAN_COLUMNS, getKanbanColumnFor } from "../lib/journeyHelpers";
import PatientJourneyCard, { type KanbanRow } from "./PatientJourneyCard";

interface Props {
  rows: KanbanRow[];
  onOpen: (row: KanbanRow) => void;
}

export default function PatientJourneyKanban({ rows, onOpen }: Props) {
  const grouped: Record<string, KanbanRow[]> = {};
  for (const col of KANBAN_COLUMNS) grouped[col.key] = [];
  for (const r of rows) {
    const col = getKanbanColumnFor(r.instance);
    grouped[col].push(r);
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-display font-semibold text-card-foreground">Flujo operativo del día</h2>
        <p className="text-xs text-muted-foreground">Camino del paciente en tiempo real</p>
      </div>
      <div className="overflow-x-auto p-4">
        <div className="flex gap-3 min-w-max">
          {KANBAN_COLUMNS.map((col) => (
            <div key={col.key} className="w-[260px] shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                  {grouped[col.key].length}
                </span>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {grouped[col.key].length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-border/50 p-4 text-center text-[11px] text-muted-foreground">
                    Sin pacientes
                  </div>
                ) : (
                  grouped[col.key].map((r) => (
                    <PatientJourneyCard key={r.appointment.id} row={r} onOpen={onOpen} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
