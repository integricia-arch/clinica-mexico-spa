// src/pwa/pages/Cuenta.tsx
import type { LoyaltyConfig, LoyaltyMember } from '@/features/lealtad/types'
import { Link } from 'react-router-dom'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { motion } from 'motion/react'

interface Props {
  config: LoyaltyConfig
  member: LoyaltyMember
  onUpdateMarketing: (v: boolean) => void
  onLogout: () => void
}

export function Cuenta({ config, member, onUpdateMarketing, onLogout }: Props) {
  const canales = member.consent_marketing_canales ?? []

  return (
    <div className="pb-24 px-4 pt-4 space-y-6">
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
          {member.nombre.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold">{member.nombre}</p>
          <p className="text-sm text-muted-foreground">{member.telefono ?? member.email}</p>
        </div>
      </motion.div>

      <div className="space-y-4 border rounded-xl p-4">
        <h2 className="font-medium">Notificaciones y comunicaciones</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Recibir ofertas y boletines</p>
            <p className="text-xs text-muted-foreground">
              Email{canales.includes('telegram') ? ' + Telegram' : ''}
            </p>
          </div>
          <Switch
            checked={member.consent_marketing}
            onCheckedChange={onUpdateMarketing}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Puedes cancelar en cualquier momento. Nunca compartiremos tus datos con terceros.
        </p>
      </div>

      <div className="border rounded-xl p-4 space-y-2">
        <h2 className="font-medium">Legales</h2>
        <Link to="../aviso-privacidad" className="block text-sm text-primary">Aviso de Privacidad (LFPDPPP)</Link>
        <Link to="../terminos" className="block text-sm text-primary">Términos del Programa</Link>
        <Link to="../solicitud-arco" className="block text-sm text-primary">Solicitar derechos ARCO</Link>
      </div>

      <Button variant="outline" className="w-full" onClick={onLogout}>
        Cerrar sesión en este dispositivo
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        {config.nombre_programa} · Powered by integrika.mx
      </p>
    </div>
  )
}
