// src/pwa/pages/Promos.tsx
import type { LoyaltyConfig } from '@/features/lealtad/types'
import { motion } from 'motion/react'

interface Props { config: LoyaltyConfig }

export function Promos({ config }: Props) {
  return (
    <div className="pb-24 px-4 pt-4">
      <h1 className="text-xl font-bold mb-4">Promociones</h1>
      <motion.div
        className="rounded-xl border p-6 text-center text-muted-foreground"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <p className="text-4xl mb-2">🎁</p>
        <p className="font-medium">Próximamente</p>
        <p className="text-sm mt-1">Las promociones de {config.nombre_programa} aparecerán aquí.</p>
      </motion.div>
    </div>
  )
}
