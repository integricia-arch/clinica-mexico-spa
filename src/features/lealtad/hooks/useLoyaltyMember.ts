// src/features/lealtad/hooks/useLoyaltyMember.ts
import { supabase } from '@/integrations/supabase/client'
import type {
  LoyaltyMember,
  LoyaltyMovimiento,
  LoyaltyNivel,
  NuevoMiembroInput,
  RegisterSaleResult,
  RedeemResult,
} from '../types'

// Phone normalization to E.164 with +52 prefix (Mexican numbers)
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return '+52' + digits
  if (digits.length === 12 && digits.startsWith('52')) return '+' + digits
  return '+52' + digits.slice(-10) // fallback: take last 10 digits
}

// FIX 3: Runtime narrowing guard for nivel field
const VALID_NIVELES = ['bronce', 'plata', 'oro', 'diamante'] as const
function isValidNivel(n: string): n is LoyaltyNivel {
  return (VALID_NIVELES as readonly string[]).includes(n)
}
function normalizeMember(raw: Record<string, unknown>): LoyaltyMember {
  if (raw && typeof raw.nivel === 'string' && !isValidNivel(raw.nivel)) {
    return { ...raw, nivel: 'bronce' } as LoyaltyMember
  }
  return raw as LoyaltyMember
}

// FIX 4: Whitelist sanitization — only allow alphanumeric, accented chars, spaces, @, ., -, +
function sanitizeSearchQuery(query: string): string {
  return query.trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s@.\-+]/g, '')
}

// FIX 6: register() return type changed to { member: LoyaltyMember | null; error?: string }
export interface RegisterResult {
  member: LoyaltyMember | null
  error?: string
}

export function useLoyaltyMember(clinicId: string | null) {
  async function search(query: string): Promise<LoyaltyMember[]> {
    if (!clinicId || query.trim().length < 3) return []
    const q = sanitizeSearchQuery(query)
    if (q.length === 0) return []

    const { data, error } = await supabase
      .from('loyalty_members')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('activo', true)
      .or(`telefono.ilike.%${q}%,email.ilike.%${q}%,nombre.ilike.%${q}%`)
      .limit(5)

    if (error) return []
    return ((data ?? []) as Record<string, unknown>[]).map(normalizeMember)
  }

  async function register(input: NuevoMiembroInput): Promise<RegisterResult> {
    if (!clinicId) return { member: null, error: 'sin_clinica' }

    const now = new Date().toISOString()

    const { data: barcode, error: barcodeErr } = await supabase.rpc(
      'loyalty_generate_barcode',
      { p_clinic_id: clinicId }
    )

    if (barcodeErr || !barcode) return { member: null, error: barcodeErr?.message ?? 'barcode_error' }


    const normalizedPhone = input.telefono ? normalizePhone(input.telefono) : null
    const { data, error } = await supabase
      .from('loyalty_members')
      .insert({
        clinic_id: clinicId,
        nombre: input.nombre,
        telefono: normalizedPhone,
        email: input.email || null,
        fecha_nacimiento: input.fecha_nacimiento ?? null,
        codigo_barras: barcode as string,
        consent_privacidad: true,
        consent_privacidad_at: now,
        consent_historial_compras: true,
        consent_historial_at: now,
        consent_marketing: input.consent_marketing,
        consent_marketing_at: input.consent_marketing ? now : null,
        consent_marketing_canales: input.consent_marketing_canales,
        consent_version: new Date().toISOString().slice(0, 7),
      })
      .select('*')
      .single()

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('23505') || msg.includes('unique') || msg.includes('duplicate')) {
        if (msg.includes('telefono')) return { member: null, error: 'duplicado_telefono' }
        if (msg.includes('email')) return { member: null, error: 'duplicado_email' }
        return { member: null, error: 'duplicado' }
      }
      if (msg.includes('row-level security') || msg.includes('rls') || msg.includes('policy')) {
        return { member: null, error: 'rls_denied' }
      }
      return { member: null, error: error.message }
    }
    return { member: normalizeMember(data as Record<string, unknown>) }
  }

  async function registerSale(
    saleId: string,
    memberId: string
  ): Promise<RegisterSaleResult> {
    if (!clinicId) return { ok: false, error: 'sin_clinica' }

    const { data, error } = await supabase.rpc('loyalty_register_sale', {
      p_sale_id: saleId,
      p_member_id: memberId,
      p_clinic_id: clinicId,
    })

    if (error) return { ok: false, error: error.message }
    return data as RegisterSaleResult
  }

  async function redeem(
    memberId: string,
    puntos: number
  ): Promise<RedeemResult> {
    if (!clinicId) return { ok: false, error: 'sin_clinica' }

    const { data, error } = await supabase.rpc('loyalty_redeem', {
      p_member_id: memberId,
      p_clinic_id: clinicId,
      p_puntos: puntos,
    })

    if (error) return { ok: false, error: error.message }
    return data as RedeemResult
  }

  async function getMovimientos(memberId: string): Promise<LoyaltyMovimiento[]> {
    const { data, error } = await supabase
      .from('loyalty_movimientos')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return []
    return (data as LoyaltyMovimiento[]) ?? []
  }

  return { search, register, registerSale, redeem, getMovimientos }
}
