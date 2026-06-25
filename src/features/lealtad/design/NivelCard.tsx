// src/features/lealtad/design/NivelCard.tsx
import { motion, useSpring, useTransform, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import Barcode from 'react-barcode'
import { spring } from './motion'
import { NIVEL_COLORS, NIVEL_ICON } from './tokens'
import { NIVEL_LABEL } from '../types'

interface Props {
  nivel: 'bronce' | 'plata' | 'oro' | 'diamante'
  puntos: number
  nombre: string
  codigoBarras?: string
  showBarcode?: boolean
  compact?: boolean
}

/** Número animado con spring physics — Emil Kowalski */
function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const motionVal = useMotionValue(0)
  const springVal = useSpring(motionVal, spring.smooth)
  const display = useTransform(springVal, v => `${prefix}${v.toFixed(0)}`)

  useEffect(() => { motionVal.set(value) }, [value, motionVal])

  return <motion.span>{display}</motion.span>
}

export function NivelCard({ nivel, puntos, nombre, codigoBarras, showBarcode = false, compact = false }: Props) {
  const colors = NIVEL_COLORS[nivel]
  const isDiamante = nivel === 'diamante'
  const prefersReduced = useReducedMotion()

  return (
    <motion.div
      className={`relative overflow-hidden rounded-[20px] p-5 text-white select-none ${compact ? 'py-3' : ''}`}
      style={{
        background: `linear-gradient(135deg, var(--loyalty-brand-dark) 0%, var(--loyalty-brand) 60%, var(--loyalty-brand-light) 100%)`,
      }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      whileHover={{ scale: 1.015, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
    >
      {/* Shimmer Diamante — Emil Kowalski ambient effect */}
      {isDiamante && !prefersReduced && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
        />
      )}

      {/* Noise texture overlay — Huashu depth */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium opacity-70 tracking-wide uppercase">
            Programa de Lealtad
          </p>
          <p className="text-lg font-semibold mt-0.5 leading-tight">{nombre}</p>
        </div>
        <motion.div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}
          whileHover={{ scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        >
          <span>{NIVEL_ICON[nivel]}</span>
          <span>{NIVEL_LABEL[nivel].replace(/^[^\s]+\s/, '')}</span>
        </motion.div>
      </div>

      {/* Puntos con count-up animado */}
      {!compact && (
        <div className="relative mb-4">
          <p className="text-xs opacity-60 mb-0.5 tracking-wide">Puntos disponibles</p>
          <p className="text-4xl font-bold tracking-tight font-mono">
            <AnimatedNumber value={puntos} />
          </p>
          <p className="text-xs opacity-50 mt-0.5">
            {puntos.toLocaleString('es-MX')} pts
          </p>
        </div>
      )}

      {/* Código de barras */}
      {showBarcode && codigoBarras && (
        <motion.div
          className="relative bg-white rounded-xl p-3 flex justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 28 }}
        >
          <Barcode
            value={codigoBarras}
            width={1.4}
            height={52}
            fontSize={11}
            displayValue
            background="transparent"
          />
        </motion.div>
      )}
    </motion.div>
  )
}
