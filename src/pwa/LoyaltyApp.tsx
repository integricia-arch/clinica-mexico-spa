// src/pwa/LoyaltyApp.tsx
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useLoyaltyPWA } from './hooks/useLoyaltyPWA'
import { BottomNav } from './components/BottomNav'
import { Inicio } from './pages/Inicio'
import { Monedero } from './pages/Monedero'
import { Promos } from './pages/Promos'
import { Cuenta } from './pages/Cuenta'
import { PrivacidadPage } from './pages/PrivacidadPage'
import { ArcoPage } from './pages/ArcoPage'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface LoginScreenProps {
  onRequestOtp: (phone: string) => Promise<{ error?: string }>
  onVerifyOtp: (phone: string, token: string) => Promise<{ error?: string }>
  programName: string
  color: string
}

function LoginScreen({ onRequestOtp, onVerifyOtp, programName, color }: LoginScreenProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handlePhoneSubmit() {
    setLoading(true)
    setError(null)
    const result = await onRequestOtp(phone)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setStep('otp')
  }

  async function handleOtpSubmit() {
    setLoading(true)
    setError(null)
    const result = await onVerifyOtp(phone, otp)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    }
    // On success, useLoyaltyPWA's onAuthStateChange will update member state automatically
  }

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center px-6 gap-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
    >
      <div className="text-center">
        <motion.div
          className="h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
          style={{ background: color }}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.1 }}
        >
          💳
        </motion.div>
        <h1 className="text-2xl font-bold">{programName}</h1>
        {step === 'phone' ? (
          <p className="text-muted-foreground text-sm mt-1">Ingresa tu número de teléfono</p>
        ) : (
          <p className="text-muted-foreground text-sm mt-1">Ingresa el código que enviamos por SMS</p>
        )}
      </div>

      <div className="w-full max-w-xs space-y-3">
        {step === 'phone' ? (
          <>
            <Input
              placeholder="Teléfono (10 dígitos)"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handlePhoneSubmit() }}
            />
            {error && (
              <motion.p
                className="text-sm text-destructive"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}
            <Button
              className="w-full"
              onClick={() => void handlePhoneSubmit()}
              disabled={loading || phone.replace(/\D/g, '').length !== 10}
            >
              {loading ? 'Enviando código...' : 'Enviar código SMS'}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground text-center">
              Código enviado a {phone}
            </p>
            <Input
              placeholder="Código de 6 dígitos"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') void handleOtpSubmit() }}
              autoFocus
            />
            {error && (
              <motion.p
                className="text-sm text-destructive"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}
            <Button
              className="w-full"
              onClick={() => void handleOtpSubmit()}
              disabled={loading || otp.length !== 6}
            >
              {loading ? 'Verificando...' : 'Confirmar código'}
            </Button>
            <button
              className="w-full text-sm text-muted-foreground underline"
              onClick={() => { setStep('phone'); setOtp(''); setError(null) }}
            >
              Cambiar número
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}

export function LoyaltyApp() {
  const { slug = '' } = useParams<{ slug: string }>()
  const location = useLocation()
  const { config, member, movimientos, loading, requestOtp, verifyOtp, logout, updateMarketingConsent } = useLoyaltyPWA(slug)

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = '/loyalty-manifest.json'
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          Cargando...
        </motion.div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <div>
          <p className="text-4xl mb-4">💊</p>
          <p className="font-semibold">Programa no encontrado</p>
          <p className="text-sm text-muted-foreground mt-2">Verifica la URL o consulta con tu farmacia.</p>
        </div>
      </div>
    )
  }

  // Páginas legales accesibles sin autenticación (LFPDPPP)
  const publicPaths = ['/aviso-privacidad', '/solicitud-arco']
  if (!member && !publicPaths.some(p => location.pathname.endsWith(p))) {
    return (
      <LoginScreen
        onRequestOtp={requestOtp}
        onVerifyOtp={verifyOtp}
        programName={config.nombre_programa}
        color={config.color_primario}
      />
    )
  }

  const base = `/loyalty/${slug}`

  return (
    <div className="max-w-md mx-auto min-h-screen relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
        >
          <Routes location={location}>
            <Route path="/" element={<Inicio config={config} member={member} slug={slug} />} />
            <Route path="/promos" element={<Promos config={config} />} />
            <Route path="/monedero" element={<Monedero config={config} member={member} movimientos={movimientos} />} />
            <Route
              path="/cuenta"
              element={
                <Cuenta
                  config={config}
                  member={member}
                  onUpdateMarketing={updateMarketingConsent}
                  onLogout={logout}
                />
              }
            />
            <Route path="/aviso-privacidad" element={<PrivacidadPage />} />
            <Route path="/solicitud-arco" element={<ArcoPage />} />
            <Route path="*" element={<Navigate to={base} replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      <BottomNav slug={slug} />
    </div>
  )
}
