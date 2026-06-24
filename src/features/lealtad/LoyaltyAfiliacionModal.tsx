// src/features/lealtad/LoyaltyAfiliacionModal.tsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useLoyaltyMember } from './hooks/useLoyaltyMember'
import type { LoyaltyMember } from './types'

interface Props {
  clinicId: string
  open: boolean
  onClose: () => void
  onRegistered: (member: LoyaltyMember) => void
}

export function LoyaltyAfiliacionModal({ clinicId, open, onClose, onRegistered }: Props) {
  const { register } = useLoyaltyMember(clinicId)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setNombre('')
    setTelefono('')
    setEmail('')
    setConsentMarketing(false)
    setError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleSubmit() {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    if (!telefono.trim() && !email.trim()) {
      setError('Ingresa teléfono o email')
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await register({
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      email: email.trim(),
      consent_privacidad: true,
      consent_historial_compras: true,
      consent_marketing: consentMarketing,
      consent_marketing_canales: consentMarketing ? ['email'] : [],
    })
    setSubmitting(false)
    if (!result.member) {
      setError(
        result.error === 'sin_clinica'
          ? 'Error de configuración de clínica.'
          : 'Error al registrar. Verifica que el teléfono/email no esté duplicado.'
      )
      return
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
            {/* 1: Aviso de Privacidad — Art. 8 LFPDPPP — obligatorio */}
            <div className="flex items-start gap-2">
              <Checkbox id="laf-c1" checked disabled className="mt-0.5 shrink-0" />
              <label htmlFor="laf-c1" className="text-muted-foreground leading-snug cursor-default">
                <strong>Aviso de Privacidad (obligatorio):</strong> Acepto el tratamiento
                de mis datos personales para administrar mi Monedero de Fidelización, conforme
                al aviso de privacidad disponible en esta clínica. (Art. 8 LFPDPPP)
              </label>
            </div>
            {/* 2: Historial de compras con medicamentos — Art. 9 LFPDPPP — datos sensibles — obligatorio */}
            <div className="flex items-start gap-2">
              <Checkbox id="laf-c2" checked disabled className="mt-0.5 shrink-0" />
              <label htmlFor="laf-c2" className="text-muted-foreground leading-snug cursor-default">
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
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Registrando...' : 'Afiliar cliente'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
