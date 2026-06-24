// src/features/lealtad/types.ts
// Core domain types for the Farmacia Fidelización module

export type LoyaltyNivel = 'bronce' | 'plata' | 'oro' | 'diamante'

export const NIVEL_LABEL: Record<LoyaltyNivel, string> = {
  bronce:   '🥉 Bronce',
  plata:    '🥈 Plata',
  oro:      '🥇 Oro',
  diamante: '💎 Diamante',
}

export interface LoyaltyMember {
  id: string
  nombre: string
  nivel: LoyaltyNivel
  puntos_disponibles: number
  puntos_acumulados: number
  codigo_barras: string
  fecha_inscripcion: string
  clinica_id: string
}

export interface LoyaltyConfig {
  clinica_id: string
  nombre_programa: string
  valor_punto_mxn: number           // MXN por cada punto al canjear
  puntos_por_peso: number           // puntos ganados por cada $1 MXN gastado
  umbral_bronce: number             // puntos acumulados para nivel bronce (default 0)
  umbral_plata: number
  umbral_oro: number
  umbral_diamante: number
  activo: boolean
}

/**
 * Convierte puntos disponibles a su valor equivalente en MXN
 * según la configuración del programa.
 */
export function valorCanjeMxn(puntos: number, valorPuntoMxn: number): number {
  return puntos * valorPuntoMxn
}
