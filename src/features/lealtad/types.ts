// src/features/lealtad/types.ts
// Core domain types for the Farmacia Fidelización module

export type LoyaltyNivel = 'bronce' | 'plata' | 'oro' | 'diamante'

export interface LoyaltyConfig {
  clinic_id: string
  nombre_programa: string
  slug_farmacia: string
  color_primario: string
  logo_url: string | null
  pesos_por_punto: number
  valor_punto_mxn: number
  puntos_minimos_canje: number
  nivel_plata_umbral: number
  nivel_oro_umbral: number
  nivel_diamante_umbral: number
  multiplicador_plata: number
  multiplicador_oro: number
  multiplicador_diamante: number
  expiracion_dias_inactividad: number
  programa_activo: boolean
  actualizado_at: string
}

export interface LoyaltyMember {
  id: string
  clinic_id: string
  patient_id: string | null
  nombre: string
  telefono: string | null
  email: string | null
  fecha_nacimiento: string | null
  codigo_barras: string
  nivel: LoyaltyNivel
  puntos_disponibles: number
  puntos_acumulados_historico: number
  consent_privacidad: boolean
  consent_privacidad_at: string | null
  consent_historial_compras: boolean
  consent_historial_at: string | null
  consent_marketing: boolean
  consent_marketing_at: string | null
  consent_marketing_canales: string[] | null
  consent_version: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface LoyaltyMovimiento {
  id: string
  clinic_id: string
  member_id: string
  tipo: 'acumulacion' | 'canje' | 'vencimiento' | 'bonus' | 'ajuste' | 'referido'
  puntos: number
  saldo_post: number
  pharmacy_sale_id: string | null
  plan_id: string | null
  descripcion: string | null
  created_at: string
}

export interface RegisterSaleResult {
  ok: boolean
  puntos_ganados?: number
  saldo_nuevo?: number
  nivel?: LoyaltyNivel
  error?: string
}

export interface RedeemResult {
  ok: boolean
  descuento_mxn?: number
  saldo_nuevo?: number
  error?: string
  minimo?: number
  disponibles?: number
}

export interface NuevoMiembroInput {
  nombre: string
  telefono: string
  email: string
  fecha_nacimiento?: string
  consent_privacidad: true       // siempre true si llega aquí
  consent_historial_compras: true
  consent_marketing: boolean
  consent_marketing_canales: string[]
}

/** Cálculo preview de puntos (sin DB) — misma lógica que loyalty_register_sale RPC */
export function calcularPuntosPreview(
  totalMxn: number,
  pesosPorPunto: number,
  multiplicador: number
): number {
  if (pesosPorPunto <= 0) return 0
  return Math.floor((totalMxn / pesosPorPunto) * multiplicador)
}

export function valorCanjeMxn(puntos: number, valorPuntoMxn: number): number {
  return Math.round(puntos * valorPuntoMxn * 100) / 100
}

export function nivelMultiplicador(nivel: LoyaltyNivel, cfg: LoyaltyConfig): number {
  switch (nivel) {
    case 'diamante': return cfg.multiplicador_diamante
    case 'oro':      return cfg.multiplicador_oro
    case 'plata':    return cfg.multiplicador_plata
    default:         return 1.0
  }
}

export const NIVEL_LABEL: Record<LoyaltyNivel, string> = {
  bronce: '🥉 Bronce',
  plata:  '🥈 Plata',
  oro:    '🥇 Oro',
  diamante: '💎 Diamante',
}
