import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { LoyaltyConfig } from '../types'

interface UseLoyaltyConfigReturn {
  config: LoyaltyConfig | null
  loading: boolean
  error: string | null
  save: (updates: Partial<LoyaltyConfig>) => Promise<boolean>
}

export function useLoyaltyConfig(clinicId: string | null): UseLoyaltyConfigReturn {
  const [config, setConfig] = useState<LoyaltyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clinicId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('loyalty_config')
        .select('*')
        .eq('clinic_id', clinicId)
        .maybeSingle()
      if (err) throw err
      setConfig(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando configuración')
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => {
    load()
  }, [load])

  const save = useCallback(async (updates: Partial<LoyaltyConfig>): Promise<boolean> => {
    if (!clinicId) return false
    try {
      const { error: err } = await supabase
        .from('loyalty_config')
        .upsert({ ...updates, clinic_id: clinicId, actualizado_at: new Date().toISOString() })
        .eq('clinic_id', clinicId)
      if (err) throw err
      // Optimistic refresh
      setConfig(prev => prev ? { ...prev, ...updates } : null)
      return true
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando configuración')
      return false
    }
  }, [clinicId])

  return { config, loading, error, save }
}
