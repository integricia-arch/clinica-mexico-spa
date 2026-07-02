import { useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import InventarioCiclico from "@/features/almacen/InventarioCiclico";
import ReporteCOFEPRIS from "@/features/almacen/ReporteCOFEPRIS";
import ReporteRotacionABC from "@/features/almacen/ReporteRotacionABC";
import ActasMerma from "@/features/almacen/ActasMerma";
import LibroControlControlados from "@/features/almacen/LibroControlControlados";
import PuntoReorden from "@/features/compras/PuntoReorden";

type Medicamento = Tables<"medicamentos">;
type Lote = Tables<"lotes_medicamento">;

type AlmacenView =
  | "catalogo" | "faltantes" | "caducidades"
  | "conteos" | "cofepris" | "abc" | "mermas" | "reorden" | "controlados";

interface Props {
  medicamentos: Medicamento[];
  lotes: Lote[];
  onReload: () => void;
  loading: boolean;
}

export default function AlmacenTabs({ medicamentos, lotes, onReload, loading }: Props) {
  const [view, setView] = useState<AlmacenView>("conteos");

  const stockTotal = (medId: string) =>
    lotes.filter(l => l.medicamento_id === medId).reduce((s, l) => s + l.existencia, 0);
  const bajosStock = medicamentos.filter(m => stockTotal(m.id) < m.stock_minimo);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Almacén</h1>
        <p className="mt-1 text-sm text-muted-foreground">Control de inventario y compras</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setView("conteos")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "conteos" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >Conteos</button>
        <button
          onClick={() => setView("cofepris")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "cofepris" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >COFEPRIS</button>
        <button
          onClick={() => setView("abc")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "abc" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >ABC / Rotación</button>
        <button
          onClick={() => setView("mermas")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "mermas" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >Mermas</button>
        <button
          onClick={() => setView("reorden")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors relative ${view === "reorden" ? "bg-orange-500 text-white" : "text-muted-foreground hover:bg-muted"}`}
        >
          Reorden
          {bajosStock.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-xs font-bold h-4 min-w-[1rem] px-1">{bajosStock.length}</span>
          )}
        </button>
        <button
          onClick={() => setView("controlados")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${view === "controlados" ? "bg-red-600 text-white" : "text-muted-foreground hover:bg-muted"}`}
        >Controlados</button>
      </div>

      {view === "conteos" && <InventarioCiclico />}
      {view === "cofepris" && <ReporteCOFEPRIS />}
      {view === "abc" && <ReporteRotacionABC />}
      {view === "mermas" && <ActasMerma />}
      {view === "reorden" && (
        <PuntoReorden medicamentos={medicamentos} lotes={lotes} onOcCreada={() => setView("reorden")} />
      )}
      {view === "controlados" && <LibroControlControlados medicamentos={medicamentos} />}
    </div>
  );
}
