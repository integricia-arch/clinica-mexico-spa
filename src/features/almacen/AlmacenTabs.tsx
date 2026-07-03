import { useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import CatalogoMedicamentos from "@/features/almacen/CatalogoMedicamentos";
import InventarioCiclico from "@/features/almacen/InventarioCiclico";
import FaltantesPanel from "@/features/almacen/FaltantesPanel";
import CaducidadesPanel from "@/features/almacen/CaducidadesPanel";
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
  const [view, setView] = useState<AlmacenView>("catalogo");
  const [quickFilter, setQuickFilter] = useState<"bajo_stock" | "por_caducar" | null>(null);

  const stockTotal = (medId: string) =>
    lotes.filter(l => l.medicamento_id === medId).reduce((s, l) => s + l.existencia, 0);
  const bajosStock = medicamentos.filter(m => stockTotal(m.id) < m.stock_minimo);

  const hoy = new Date();
  const en90 = new Date(hoy); en90.setDate(hoy.getDate() + 90);
  const proxCaducidad = lotes.filter(l => l.fecha_caducidad && new Date(l.fecha_caducidad) <= en90 && l.existencia > 0);

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

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setQuickFilter(q => q === "bajo_stock" ? null : "bajo_stock"); setView("catalogo"); }}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors relative ${quickFilter === "bajo_stock" ? "bg-orange-500 text-white" : "text-muted-foreground hover:bg-muted"}`}
        >
          Bajo stock
          {bajosStock.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-xs font-bold h-4 min-w-[1rem] px-1">
              {bajosStock.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setQuickFilter(q => q === "por_caducar" ? null : "por_caducar"); setView("catalogo"); }}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors relative ${quickFilter === "por_caducar" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          Por caducar
          {proxCaducidad.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold h-4 min-w-[1rem] px-1">
              {proxCaducidad.length}
            </span>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1">
              Reportes y control
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setView("faltantes")} className="cursor-pointer">
              Faltantes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("conteos")} className="cursor-pointer">
              Conteos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("cofepris")} className="cursor-pointer">
              COFEPRIS
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("abc")} className="cursor-pointer">
              ABC / Rotación
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("mermas")} className="cursor-pointer">
              Mermas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("reorden")} className="cursor-pointer gap-2">
              Reorden
              {bajosStock.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{bajosStock.length}</Badge>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("controlados")} className="cursor-pointer">
              Controlados
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {view !== "catalogo" && (
          <button
            onClick={() => setView("catalogo")}
            className="rounded-lg px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground"
          >
            ← Volver al catálogo
          </button>
        )}
      </div>

      {view === "catalogo" && <CatalogoMedicamentos medicamentos={medicamentos} lotes={lotes} onReload={onReload} quickFilter={quickFilter} />}
      {view === "faltantes" && <FaltantesPanel />}
      {view === "caducidades" && <CaducidadesPanel medicamentos={medicamentos} lotes={lotes} />}
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
