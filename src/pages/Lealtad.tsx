import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoyaltyConfig } from '@/features/lealtad/LoyaltyConfig'
import { LoyaltyMiembros } from '@/features/lealtad/LoyaltyMiembros'
import { Gift, Settings, Users } from 'lucide-react'

export default function Lealtad() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Programa de Lealtad</h1>
      </div>

      <Tabs defaultValue="miembros">
        <TabsList>
          <TabsTrigger value="miembros" className="gap-1.5">
            <Users className="h-4 w-4" />
            Miembros
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings className="h-4 w-4" />
            Configuración
          </TabsTrigger>
        </TabsList>
        <TabsContent value="miembros" className="pt-4">
          <LoyaltyMiembros />
        </TabsContent>
        <TabsContent value="config" className="pt-4">
          <LoyaltyConfig />
        </TabsContent>
      </Tabs>
    </div>
  )
}
