// src/features/lealtad/design/motion.ts
// Emil Kowalski spring presets — usar con motion/react

export const spring = {
  /** Rebote ligero para tarjetas y badges */
  bounce: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 25,
  },
  /** Suave para números y saldos */
  smooth: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  },
  /** Micro-presión táctil para botones */
  tap: {
    type: 'spring' as const,
    stiffness: 600,
    damping: 20,
  },
} as const

/** Variantes para tarjeta de nivel — entrada */
export const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...spring.smooth, delay: 0.05 },
  },
}

/** Variantes para items de lista — stagger */
export const listItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { ...spring.smooth, delay: i * 0.04 },
  }),
}

/** Overlay fade */
export const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}
