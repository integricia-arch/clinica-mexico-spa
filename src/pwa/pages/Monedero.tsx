// src/pwa/pages/Monedero.tsx
import Barcode from 'react-barcode'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { valorCanjeMxn, NIVEL_LABEL } from '@/features/lealtad/types'
import type { LoyaltyConfig, LoyaltyMember, LoyaltyMovimiento } from '@/features/lealtad/types'
import { listItemVariants } from '@/features/lealtad/design/motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  config: LoyaltyConfig
  member: LoyaltyMember
  movimientos: LoyaltyMovimiento[]
}

export function Monedero({ config, member, movimientos }: Props) {
  const [hideSaldo, setHideSaldo] = useState(false)
  const saldoMxn = valorCanjeMxn(member.puntos_disponibles, config.valor_punto_mxn)

  return (
    <div className="space-y-6 pb-24">
      {/* Tarjeta virtual */}
      <motion.div
        className="mx-4 rounded-2xl p-5 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, var(--loyalty-brand-dark, #0d5c56), var(--loyalty-brand, #0f766e) 60%, var(--loyalty-brand-light, #14b8a6))` }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <p className="text-xs opacity-75 mb-1 tracking-wide uppercase">{config.nombre_programa}</p>
        <p className="text-2xl font-bold mb-1">{member.nombre}</p>
        <p className="text-sm opacity-75">{NIVEL_LABEL[member.nivel]}</p>
        <motion.div
          className="mt-4 bg-white rounded-xl p-3 flex justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 28 }}
        >
          <Barcode
            value={member.codigo_barras}
            width={1.5}
            height={60}
            fontSize={12}
            displayValue
            background="transparent"
          />
        </motion.div>
      </motion.div>

      {/* Saldo */}
      <div className="mx-4 rounded-xl border p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Saldo disponible</p>
          <AnimatePresence mode="wait">
            {hideSaldo ? (
              <motion.p
                key="hidden"
                className="text-3xl font-bold tracking-widest"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                ••••••
              </motion.p>
            ) : (
              <motion.p
                key="visible"
                className="text-3xl font-bold"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                $ {saldoMxn.toFixed(2)}
              </motion.p>
            )}
          </AnimatePresence>
          <p className="text-xs text-muted-foreground mt-1">
            {member.puntos_disponibles.toLocaleString('es-MX')} puntos
          </p>
        </div>
        <motion.button
          onClick={() => setHideSaldo(v => !v)}
          className="text-muted-foreground p-2"
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 600, damping: 20 }}
          aria-label={hideSaldo ? 'Mostrar saldo' : 'Ocultar saldo'}
        >
          <AnimatePresence mode="wait">
            {hideSaldo ? (
              <motion.span
                key="eye"
                initial={{ rotate: -10, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 10, opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <Eye className="h-5 w-5" />
              </motion.span>
            ) : (
              <motion.span
                key="eyeoff"
                initial={{ rotate: 10, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -10, opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <EyeOff className="h-5 w-5" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Historial */}
      <div className="mx-4">
        <h2 className="font-semibold mb-3">Historial de movimientos</h2>
        {movimientos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos aún.</p>
        ) : (
          <motion.div
            className="space-y-2"
            initial="hidden"
            animate="visible"
          >
            {movimientos.map((m, i) => (
              <motion.div
                key={m.id}
                className="flex justify-between items-center py-2 border-b"
                variants={listItemVariants}
                custom={i}
              >
                <div>
                  <p className="text-sm">{m.descripcion ?? m.tipo}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(m.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${m.puntos >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {m.puntos >= 0 ? '+' : ''}{m.puntos} pts
                  </p>
                  <p className="text-xs text-muted-foreground">Saldo: {m.saldo_post}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
