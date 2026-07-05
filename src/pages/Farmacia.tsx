import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SurtirReceta from "@/features/farmacia/SurtirReceta";
import PuntoDeVenta from "@/features/farmacia/PuntoDeVenta";
import SolicitudesInsumos from "@/features/farmacia/SolicitudesInsumos";
import CajaTurno from "@/pages/CajaTurno";
import CorteTurno from "@/features/caja/CorteTurno";
import { useTurno } from "@/components/TurnoGuard";
import { Lock } from "lucide-react";

type Medicamento = Tables<"medicamentos">;

export default function Farmacia() {
  const turnoCtx = useTurno();

  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [tab, setTab] = useState("pos");
  const [prescriptionScan, setPrescriptionScan] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: meds } = await (supabase as any).from("medicamentos").select("*").eq("activo", true).order("nombre");
    setMedicamentos(meds ?? []);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Farmacia</h1>
          {turnoCtx && (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-muted-foreground">{turnoCtx.openTurno.caja_nombre}</p>
              <Badge variant="outline" className="text-green-600 border-green-500/40 text-xs">Abierto</Badge>
            </div>
          )}
        </div>
        {turnoCtx && (
          <Button
            variant="outline" size="sm"
            onClick={turnoCtx.initiateClose}
            className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/5"
          >
            <Lock className="h-4 w-4" />
            Cerrar turno
          </Button>
        )}
      </div>
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="pos">Punto de Venta</TabsTrigger>
          <TabsTrigger value="surtir">Surtir receta</TabsTrigger>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="cierre">Cierre</TabsTrigger>
        </TabsList>
        <TabsContent value="pos" forceMount className={tab !== "pos" ? "hidden" : ""}>
          <PuntoDeVenta
            onScanPrescription={(code) => { setPrescriptionScan(code); setTab("surtir"); }}
          />
        </TabsContent>
        <TabsContent value="surtir">
          <SurtirReceta initialCode={prescriptionScan ?? undefined} />
        </TabsContent>
        <TabsContent value="insumos">
          <SolicitudesInsumos medicamentos={medicamentos} />
        </TabsContent>
        <TabsContent value="cierre" className="space-y-6">
          <CajaTurno onTurnoCerrado={() => setTab("pos")} />
          <CorteTurno />
        </TabsContent>
      </Tabs>
    </div>
  );
}
