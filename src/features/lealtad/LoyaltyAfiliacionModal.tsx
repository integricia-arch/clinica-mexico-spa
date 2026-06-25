// src/features/lealtad/LoyaltyAfiliacionModal.tsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useLoyaltyMember } from './hooks/useLoyaltyMember'
import { supabase } from '@/integrations/supabase/client'
import type { LoyaltyMember } from './types'

interface Props {
  clinicId: string
  open: boolean
  onClose: () => void
  onRegistered: (member: LoyaltyMember) => void
}

export function LoyaltyAfiliacionModal({ clinicId, open, onClose, onRegistered }: Props) {
  const { register, findByPhoneOrEmail } = useLoyaltyMember(clinicId)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [consentPrivacidad, setConsentPrivacidad] = useState(false)
  const [consentHistorial, setConsentHistorial] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingMember, setExistingMember] = useState<LoyaltyMember | null>(null)

  function resetForm() {
    setNombre('')
    setTelefono('')
    setEmail('')
    setConsentPrivacidad(false)
    setConsentHistorial(false)
    setConsentMarketing(false)
    setError(null)
    setExistingMember(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleUseExisting() {
    if (!existingMember) return
    resetForm()
    onRegistered(existingMember)
  }

  async function handleSubmit() {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    if (!telefono.trim() && !email.trim()) {
      setError('Ingresa teléfono o email')
      return
    }
    if (telefono.trim() && telefono.replace(/\D/g, '').length !== 10) {
      setError('El teléfono debe tener exactamente 10 dígitos')
      return
    }
    if (!consentPrivacidad || !consentHistorial) {
      setError('Debes aceptar los consentimientos obligatorios')
      return
    }
    setSubmitting(true)
    setError(null)
    setExistingMember(null)

    const result = await register({
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      email: email.trim(),
      consent_privacidad: consentPrivacidad,
      consent_historial_compras: consentHistorial,
      consent_marketing: consentMarketing,
      consent_marketing_canales: consentMarketing ? ['email'] : [],
    })
    setSubmitting(false)

    if (!result.member) {
      const isDuplicate = result.error === 'duplicado_telefono'
        || result.error === 'duplicado_email'
        || result.error === 'duplicado'

      if (isDuplicate) {
        // Find and offer the existing member record
        const found = await findByPhoneOrEmail(telefono.trim(), email.trim())
        if (found) {
          setExistingMember(found)
          setError(null)
          return
        }
      }

      const errMap: Record<string, string> = {
        sin_clinica:       'Error de configuración de clínica. Contacta al soporte.',
        duplicado_telefono:'Ya existe un cliente registrado con ese teléfono.',
        duplicado_email:   'Ya existe un cliente registrado con ese email.',
        duplicado:         'El teléfono o email ya están registrados para otro cliente.',
        barcode_error:     'Error generando código de cliente. Intenta de nuevo.',
        rls_denied:        'Sin permisos para registrar en esta clínica. Verifica tu sesión.',
      }
      setError(errMap[result.error ?? ''] ?? `Error: ${result.error}`)
      return
    }

    // Fire-and-forget welcome email — never block registration
    if (result.member.email) {
      supabase.functions.invoke('loyalty-welcome', {
        body: { member_id: result.member.id, clinic_id: clinicId }
      }).catch(() => {})
    }
    resetForm()
    onRegistered(result.member)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Afiliar nuevo cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="laf-nombre">Nombre completo *</Label>
            <Input
              id="laf-nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="laf-tel">Teléfono</Label>
            <Input
              id="laf-tel"
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div>
            <Label htmlFor="laf-email">Email</Label>
            <Input
              id="laf-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {/* Consentimientos LFPDPPP — 3 separados como requiere la ley */}
          <div className="rounded border p-3 space-y-3 bg-muted/30 text-sm">
            {/* 1: Aviso de Privacidad — Art. 8 LFPDPPP — obligatorio, ACTIVO */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="laf-c1"
                checked={consentPrivacidad}
                onCheckedChange={(v) => setConsentPrivacidad(!!v)}
                className="mt-0.5 shrink-0"
              />
              <label htmlFor="laf-c1" className="leading-snug cursor-pointer">
                <strong>Aviso de Privacidad (obligatorio):</strong> Acepto el tratamiento
                de mis datos personales para administrar mi Monedero de Fidelización, conforme
                al aviso de privacidad disponible en esta clínica. (Art. 8 LFPDPPP)
              </label>
            </div>
            {/* 2: Historial de compras con medicamentos — Art. 9 LFPDPPP — datos sensibles — obligatorio, ACTIVO */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="laf-c2"
                checked={consentHistorial}
                onCheckedChange={(v) => setConsentHistorial(!!v)}
                className="mt-0.5 shrink-0"
              />
              <label htmlFor="laf-c2" className="leading-snug cursor-pointer">
                <strong>Historial de compras — datos sensibles (obligatorio):</strong> Acepto
                que mis compras, incluyendo medicamentos adquiridos, sean registradas para
                calcular puntos. Este historial puede incluir información sobre mi salud y se
                trata con estricta confidencialidad. (Art. 9 LFPDPPP)
              </label>
            </div>
            {/* 3: Marketing — opcional, separado, con canales */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="laf-c3"
                checked={consentMarketing}
                onCheckedChange={v => setConsentMarketing(v === true)}
                className="mt-0.5 shrink-0"
              />
              <label htmlFor="laf-c3" className="leading-snug cursor-pointer">
                <strong>(Opcional)</strong> Acepto recibir ofertas y boletines por email.
                Puedo cancelar este consentimiento en cualquier momento contactando a la clínica.
                (Art. 8 LFPDPPP)
              </label>
            </div>
          </div>

          {/* Existing member found — offer to use it */}
          <AnimatePresence>
            {existingMember && (
              <motion.div
                key="laf-existing"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3 text-sm space-y-2"
              >
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Cliente ya registrado con ese teléfono/email:
                </p>
                <p className="text-amber-700 dark:text-amber-400">
                  <strong>{existingMember.nombre}</strong>
                  {existingMember.telefono && <> · {existingMember.telefono}</>}
                  {existingMember.email && <> · {existingMember.email}</>}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-400 text-amber-800 dark:text-amber-300"
                  onClick={handleUseExisting}
                >
                  Usar este cliente
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.p
                key="laf-error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-sm text-destructive"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            {!existingMember && (
              <Button
                onClick={handleSubmit}
                disabled={submitting || !consentPrivacidad || !consentHistorial}
              >
                {submitting ? 'Registrando...' : 'Afiliar cliente'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
