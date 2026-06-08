import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CajaTurno from "@/pages/CajaTurno";
import CorteTurno from "@/features/caja/CorteTurno";

export default function Caja() {
  const [tab, setTab] = useState("turno");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Caja</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestión de turno y corte de caja</p>
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
