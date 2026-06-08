import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CajaTurno from "@/pages/CajaTurno";
import CorteCaja from "@/features/farmacia/CorteCaja";

export default function Caja() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Caja</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestión de turno y corte de caja</p>
      </div>
      <Tabs defaultValue="turno" className="space-y-6">
        <TabsList>
          <TabsTrigger value="turno">Turno</TabsTrigger>
          <TabsTrigger value="corte">Corte de caja</TabsTrigger>
        </TabsList>
        <TabsContent value="turno">
          <CajaTurno />
        </TabsContent>
        <TabsContent value="corte">
          <CorteCaja />
        </TabsContent>
      </Tabs>
    </div>
  );
}
