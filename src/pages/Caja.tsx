import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import CajaTurno from "@/pages/CajaTurno";
import CorteTurno from "@/features/caja/CorteTurno";
import { useTurno } from "@/components/TurnoGuard";

export default function Caja() {
  const [tab, setTab] = useState("turno");
  const turnoCtx = useTurno();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Caja</h1>
          {turnoCtx && (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Turno activo — {turnoCtx.openTurno.caja_nombre}
              </p>
              <Badge variant="outline" className="text-green-600 border-green-500/40 text-xs">
                Abierto
              </Badge>
            </div>
          )}
          {!turnoCtx && (
            <p className="mt-1 text-sm text-muted-foreground">Gestión de turno y corte de caja</p>
          )}
        </div>
        {turnoCtx && (
          <Button
            variant="outline"
            size="sm"
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
          <TabsTrigger value="turno">Turno</TabsTrigger>
          <TabsTrigger value="corte">Corte de caja</TabsTrigger>
        </TabsList>
        <TabsContent value="turno">
          <CajaTurno onTurnoCerrado={() => setTab("corte")} />
        </TabsContent>
        <TabsContent value="corte">
          <CorteTurno />
        </TabsContent>
      </Tabs>
    </div>
  );
}
