// src/pwa/pages/ArcoPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/integrations/supabase/client'

type TipoDerecho = 'acceso' | 'rectificacion' | 'cancelacion' | 'oposicion'

const TIPOS: { value: TipoDerecho; label: string }[] = [
  { value: 'acceso', label: 'Acceso — conocer qué datos tenemos' },
  { value: 'rectificacion', label: 'Rectificación — corregir datos incorrectos' },
  { value: 'cancelacion', label: 'Cancelación — eliminar mis datos' },
  { value: 'oposicion', label: 'Oposición — dejar de usar mis datos' },
]

export function ArcoPage() {
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [identificador, setIdentificador] = useState('')
  const [tipo, setTipo] = useState<TipoDerecho>('acceso')
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !identificador.trim() || !descripcion.trim()) {
      setError('Todos los campos son obligatorios.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: fnError } = await supabase.functions.invoke('loyalty-arco-request', {
      body: { nombre: nombre.trim(), identificador: identificador.trim(), tipo, descripcion: descripcion.trim() },
    })
    setLoading(false)
    if (fnError) {
      setError('Error al enviar la solicitud. Intenta de nuevo o escribe a integric.ia@gmail.com.')
      return
    }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <motion.div
        className="min-h-[60vh] flex flex-col items-center justify-center px-4 gap-4 text-center"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <CheckCircle className="h-12 w-12 text-teal-600" />
        <h2 className="text-lg font-bold">Solicitud recibida</h2>
        <p className="text-sm text-muted-foreground">
          Responderemos en un plazo máximo de 20 días hábiles (LFPDPPP Art. 24).
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>Volver</Button>
      </motion.div>
    )
  }

  return (
    <div className="pb-24 px-4 pt-4 space-y-5 max-w-md mx-auto">
      <button
        className="flex items-center gap-2 text-sm text-muted-foreground"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div>
        <h1 className="text-xl font-bold">Solicitud de derechos ARCO</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Responderemos en 20 días hábiles (LFPDPPP Art. 24).
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Nombre completo</label>
          <Input
            placeholder="Tu nombre"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Email o teléfono</label>
          <Input
            placeholder="Con el que te registraste"
            value={identificador}
            onChange={e => setIdentificador(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Tipo de derecho</label>
          <select
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            value={tipo}
            onChange={e => setTipo(e.target.value as TipoDerecho)}
          >
            {TIPOS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Descripción de tu solicitud</label>
          <textarea
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background min-h-[100px] resize-none"
            placeholder="Describe qué datos quieres acceder, corregir o eliminar..."
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            required
          />
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              className="text-sm text-destructive"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar solicitud'}
        </Button>
      </form>
    </div>
  )
}
