// src/pwa/hooks/useLoyaltyPWA.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { LoyaltyConfig, LoyaltyMember, LoyaltyMovimiento } from '@/features/lealtad/types'

export function useLoyaltyPWA(slug: string) {
  const [config, setConfig] = useState<LoyaltyConfig | null>(null)
  const [member, setMember] = useState<LoyaltyMember | null>(null)
  const [movimientos, setMovimientos] = useState<LoyaltyMovimiento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    void loadConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(() => {
    // Listen for Supabase auth state changes (OTP sign-in)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.phone) {
        void loadMemberByPhone(session.user.phone)
      } else if (!session) {
        setMember(null)
        setMovimientos([])
      }
    })
    return () => { subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadConfig() {
    setLoading(true)
    const { data } = await supabase
      .from('loyalty_config' as never)
      .select('*')
      .eq('slug_farmacia', slug)
      .eq('programa_activo', true)
      .maybeSingle()
    const cfg = data as LoyaltyConfig | null
    setConfig(cfg)

    // Check if there's an existing authenticated session
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.phone) {
      await loadMemberByPhone(session.user.phone)
    }
    setLoading(false)
  }

  async function loadMemberByPhone(phone: string) {
    const { data: m } = await supabase
      .from('loyalty_members' as never)
      .select('*')
      .eq('telefono', phone)
      .eq('activo', true)
      .maybeSingle()
    if (m) {
      const mem = m as LoyaltyMember
      setMember(mem)
      const { data: movs } = await supabase
        .from('loyalty_movimientos' as never)
        .select('*')
        .eq('member_id', mem.id)
        .order('created_at', { ascending: false })
        .limit(30)
      setMovimientos((movs as LoyaltyMovimiento[]) ?? [])
    }
  }

  /** Step 1: request SMS OTP */
  const requestOtp = async (rawPhone: string): Promise<{ error?: string }> => {
    const digits = rawPhone.replace(/\D/g, '')
    if (digits.length !== 10) return { error: 'Teléfono debe tener 10 dígitos' }
    const phone = '+52' + digits
    const { error } = await supabase.auth.signInWithOtp({ phone })
    return error ? { error: error.message } : {}
  }

  /** Step 2: verify OTP code received via SMS */
  const verifyOtp = async (rawPhone: string, token: string): Promise<{ error?: string }> => {
    const phone = '+52' + rawPhone.replace(/\D/g, '')
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    if (error) return { error: error.message }
    // Tag as loyalty client so future RLS policies can distinguish from staff
    await supabase.auth.updateUser({ data: { app: 'loyalty' } })
    await loadMemberByPhone(phone)
    return {}
  }

  async function logout() {
    await supabase.auth.signOut()
    setMember(null)
    setMovimientos([])
  }

  async function updateMarketingConsent(value: boolean) {
    if (!member) return
    const now = new Date().toISOString()
    await supabase
      .from('loyalty_members')
      .update({
        consent_marketing: value,
        consent_marketing_at: value ? now : member.consent_marketing_at,
      })
      .eq('id', member.id)
    setMember(prev => prev ? { ...prev, consent_marketing: value } : prev)
  }

  return { config, member, movimientos, loading, requestOtp, verifyOtp, logout, updateMarketingConsent }
}
