import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/integrations/supabase/client"
import { useActiveClinic } from "@/hooks/useActiveClinic"
import SolicitudesInsumos from "@/features/farmacia/SolicitudesInsumos"
import EntregaTurno from "@/features/enfermeria/EntregaTurno"

interface Medicamento { id: string; nombre: string }

export default function Enfermeria() {
  const { activeClinicId } = useActiveClinic()
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])

  useEffect(() => {
    if (!activeClinicId) return
    void supabase
      .from("medicamentos")
      .select("id, nombre")
      .eq("activo", true)
      .eq("clinic_id", activeClinicId)
      .order("nombre")
      .then(({ data }) => setMedicamentos((data ?? []) as Medicamento[]))
  }, [activeClinicId])

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold">Enfermería</h1>
      <Tabs defaultValue="insumos">
        <TabsList>
          <TabsTrigger value="insumos">Solicitudes de Insumos</TabsTrigger>
          <TabsTrigger value="turno">Entrega de Turno</TabsTrigger>
        </TabsList>
        <TabsContent value="insumos" className="mt-4">
          <SolicitudesInsumos medicamentos={medicamentos} />
        </TabsContent>
        <TabsContent value="turno" className="mt-4">
          <EntregaTurno />
        </TabsContent>
      </Tabs>
    </div>
  )
}
