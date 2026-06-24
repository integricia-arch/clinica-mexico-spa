import type { Database } from '@/integrations/supabase/types'

export type LoyaltyConfig = Database['public']['Tables']['loyalty_config']['Row']
export type LoyaltyMember = Database['public']['Tables']['loyalty_members']['Row']
export type LoyaltyMovimiento = Database['public']['Tables']['loyalty_movimientos']['Row']

export const NIVEL_LABEL: Record<string, string> = {
  bronce: 'Bronce',
  plata: 'Plata',
  oro: 'Oro',
  diamante: 'Diamante',
}

export const NIVEL_COLOR: Record<string, string> = {
  bronce: 'bg-amber-100 text-amber-800',
  plata: 'bg-slate-100 text-slate-700',
  oro: 'bg-yellow-100 text-yellow-800',
  diamante: 'bg-blue-100 text-blue-800',
}

export function valorCanjeMxn(puntos: number, valorPuntoMxn: number): number {
  return puntos * valorPuntoMxn
}
