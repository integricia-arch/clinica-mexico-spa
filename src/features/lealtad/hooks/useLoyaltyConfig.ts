// src/features/lealtad/hooks/useLoyaltyConfig.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { LoyaltyConfig } from '../types'

export function useLoyaltyConfig(clinicId: string | null) {
  const [config, setConfig] = useState<LoyaltyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('loyalty_config')
      .select('*')
      .eq('clinic_id', clinicId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
        } else {
          setConfig(data as LoyaltyConfig | null)
        }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [clinicId])

  async function save(updates: Partial<LoyaltyConfig>): Promise<boolean> {
    if (!clinicId) return false
    const { error: err } = await supabase
      .from('loyalty_config')
      .upsert({
        ...updates,
        clinic_id: clinicId,
        actualizado_at: new Date().toISOString(),
        slug_farmacia: updates.slug_farmacia ?? config?.slug_farmacia ?? '',
      })
    if (err) {
      setError(err.message)
      return false
    }
    setConfig(prev => prev ? { ...prev, ...updates } : null)
    return true
  }

  return { config, loading, error, save }
}
