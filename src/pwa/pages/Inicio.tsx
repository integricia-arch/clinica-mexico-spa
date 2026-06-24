// src/pwa/pages/Inicio.tsx
import { valorCanjeMxn, NIVEL_LABEL } from '@/features/lealtad/types'
import type { LoyaltyConfig, LoyaltyMember } from '@/features/lealtad/types'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { cardVariants } from '@/features/lealtad/design/motion'

interface Props { config: LoyaltyConfig; member: LoyaltyMember; slug: string }

export function Inicio({ config, member, slug }: Props) {
  const navigate = useNavigate()
  const saldo = valorCanjeMxn(member.puntos_disponibles, config.valor_punto_mxn)

  return (
    <div className="space-y-4 pb-24 px-4 pt-4">
      <motion.div
        className="rounded-xl p-4 text-white"
        style={{ background: `linear-gradient(135deg, var(--loyalty-brand-dark, #0d5c56), var(--loyalty-brand, #0f766e))` }}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <p className="text-sm opacity-75">Hola, {member.nombre.split(' ')[0]}</p>
        <p className="text-3xl font-bold mt-1">$ {saldo.toFixed(2)}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
            {NIVEL_LABEL[member.nivel]}
          </span>
          <span className="text-xs opacity-75">
            {member.puntos_disponibles.toLocaleString('es-MX')} puntos
          </span>
        </div>
      </motion.div>

      <motion.button
        onClick={() => navigate(`/loyalty/${slug}/monedero`)}
        className="w-full rounded-xl border p-4 text-left hover:bg-muted/30 transition-colors"
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      >
        <p className="font-semibold">Ver mi Monedero</p>
        <p className="text-sm text-muted-foreground">Código de barras + historial completo</p>
      </motion.button>

      <div className="rounded-xl border p-4">
        <p className="text-xs text-muted-foreground mb-2">¿Cómo funciona?</p>
        <div className="space-y-1 text-sm">
          <p>💰 Cada ${config.pesos_por_punto} MXN = 1 punto</p>
          <p>🎁 {config.puntos_minimos_canje} puntos = $ {valorCanjeMxn(config.puntos_minimos_canje, config.valor_punto_mxn).toFixed(2)} de descuento</p>
          <p>⏱ Puntos vencen tras {config.expiracion_dias_inactividad} días sin compra</p>
        </div>
      </div>
    </div>
  )
}
