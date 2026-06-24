import { useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { LoyaltyMember, LoyaltyMovimiento } from '../types'

interface UseLoyaltyMemberReturn {
  search: (q: string, clinicId: string) => Promise<LoyaltyMember[]>
  getAll: (clinicId: string) => Promise<LoyaltyMember[]>
  getMovimientos: (memberId: string) => Promise<LoyaltyMovimiento[]>
}

export function useLoyaltyMember(): UseLoyaltyMemberReturn {
  const search = useCallback(async (q: string, clinicId: string): Promise<LoyaltyMember[]> => {
    const trimmed = q.trim()
    let query = supabase
      .from('loyalty_members')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('activo', true)
      .order('nombre', { ascending: true })
      .limit(50)

    if (trimmed.length >= 2) {
      query = query.or(`nombre.ilike.%${trimmed}%,telefono.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as LoyaltyMember[]
  }, [])

  const getAll = useCallback(async (clinicId: string): Promise<LoyaltyMember[]> => {
    const { data, error } = await supabase
      .from('loyalty_members')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return (data ?? []) as LoyaltyMember[]
  }, [])

  const getMovimientos = useCallback(async (memberId: string): Promise<LoyaltyMovimiento[]> => {
    const { data, error } = await supabase
      .from('loyalty_movimientos')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return (data ?? []) as LoyaltyMovimiento[]
  }, [])

  return { search, getAll, getMovimientos }
}
