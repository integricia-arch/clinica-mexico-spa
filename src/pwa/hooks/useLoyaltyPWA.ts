// src/pwa/hooks/useLoyaltyPWA.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { LoyaltyConfig, LoyaltyMember, LoyaltyMovimiento } from '@/features/lealtad/types'

// PWA usa phone/email guardado en localStorage para identificar al miembro
const STORAGE_KEY = 'loyalty_member_id'

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

  async function loadConfig() {
    setLoading(true)
    const { data } = await supabase
      .from('loyalty_config' as never)
      .select('*')
      .eq('slug_farmacia', slug)
      .eq('programa_activo', true)
      .maybeSingle()
    setConfig(data as LoyaltyConfig | null)

    const savedId = localStorage.getItem(STORAGE_KEY + '_' + slug)
    if (savedId && data) {
      await loadMember(savedId)
    }
    setLoading(false)
  }

  async function loadMember(memberId: string) {
    const { data: m } = await supabase
      .from('loyalty_members' as never)
      .select('*')
      .eq('id', memberId)
      .eq('activo', true)
      .maybeSingle()
    if (m) {
      setMember(m as LoyaltyMember)
      const { data: movs } = await supabase
        .from('loyalty_movimientos' as never)
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(30)
      setMovimientos((movs as LoyaltyMovimiento[]) ?? [])
    }
  }

  async function loginByContact(query: string): Promise<boolean> {
    if (!config) return false
    const q = query.trim().replace(/[%(),]/g, '')
    const { data } = await supabase
      .from('loyalty_members' as never)
      .select('*')
      .eq('clinic_id', config.clinic_id)
      .eq('activo', true)
      .or(`telefono.eq.${q},email.eq.${q}`)
      .maybeSingle()
    if (!data) return false
    const m = data as LoyaltyMember
    localStorage.setItem(STORAGE_KEY + '_' + slug, m.id)
    setMember(m)
    await loadMember(m.id)
    return true
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY + '_' + slug)
    setMember(null)
    setMovimientos([])
  }

  async function updateMarketingConsent(value: boolean) {
    if (!member) return
    const now = new Date().toISOString()
    await supabase
      .from('loyalty_members' as never)
      .update({
        consent_marketing: value,
        consent_marketing_at: value ? now : member.consent_marketing_at,
      })
      .eq('id', member.id)
    setMember(prev => prev ? { ...prev, consent_marketing: value } : prev)
  }

  return { config, member, movimientos, loading, loginByContact, logout, updateMarketingConsent }
}
