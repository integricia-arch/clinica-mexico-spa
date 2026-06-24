// src/features/lealtad/design/tokens.ts
import type { LoyaltyNivel } from '../types'

export const NIVEL_COLORS: Record<LoyaltyNivel, {
  bg: string
  text: string
  border: string
  gradient: string
}> = {
  bronce: {
    bg:       'bg-amber-50 dark:bg-amber-950/30',
    text:     'text-amber-800 dark:text-amber-300',
    border:   'border-amber-200 dark:border-amber-800',
    gradient: 'from-amber-700 via-amber-600 to-amber-500',
  },
  plata: {
    bg:       'bg-slate-50 dark:bg-slate-900/40',
    text:     'text-slate-700 dark:text-slate-300',
    border:   'border-slate-300 dark:border-slate-600',
    gradient: 'from-slate-500 via-slate-400 to-slate-300',
  },
  oro: {
    bg:       'bg-yellow-50 dark:bg-yellow-950/30',
    text:     'text-yellow-800 dark:text-yellow-300',
    border:   'border-yellow-300 dark:border-yellow-700',
    gradient: 'from-yellow-600 via-amber-500 to-yellow-400',
  },
  diamante: {
    bg:       'bg-indigo-50 dark:bg-indigo-950/30',
    text:     'text-indigo-700 dark:text-indigo-300',
    border:   'border-indigo-300 dark:border-indigo-700',
    gradient: 'from-indigo-600 via-purple-500 to-indigo-400',
  },
}

export const NIVEL_ICON: Record<LoyaltyNivel, string> = {
  bronce:   '🥉',
  plata:    '🥈',
  oro:      '🥇',
  diamante: '💎',
}

/** CSS token values as JS constants — mirrors loyalty-tokens.css */
export const LOYALTY_TOKENS = {
  brand:        '#0f766e',
  brandLight:   '#14b8a6',
  brandDark:    '#0d5c56',
  accent:       '#d97706',
  accentLight:  '#fbbf24',

  bronce:   '#92400e',
  plata:    '#64748b',
  oro:      '#b45309',
  diamante: '#6366f1',

  cardBg:     'rgba(15, 118, 110, 0.06)',
  cardBorder: 'rgba(15, 118, 110, 0.15)',

  radiusSm:   '4px',
  radiusMd:   '6px',
  radiusLg:   '12px',
  radiusXl:   '20px',
  radiusFull: '9999px',

  durationFast: '120ms',
  durationBase: '200ms',
  durationSlow: '350ms',
} as const
