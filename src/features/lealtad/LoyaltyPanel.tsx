// src/features/lealtad/LoyaltyPanel.tsx
import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserPlus, Coins, Search } from 'lucide-react'
import { useLoyaltyMember } from './hooks/useLoyaltyMember'
import { useLoyaltyConfig } from './hooks/useLoyaltyConfig'
import { LoyaltyAfiliacionModal } from './LoyaltyAfiliacionModal'
import {
  valorCanjeMxn,
  NIVEL_LABEL,
  calcularPuntosPreview,
  nivelMultiplicador,
} from './types'
import type { LoyaltyMember } from './types'
import { listItemVariants, cardVariants, spring } from './design/motion'

interface Props {
  clinicId: string
  totalVenta: number
  onMemberSelected: (member: LoyaltyMember | null) => void
  onRedeemApplied: (descuentoMxn: number, memberId: string) => void
}

export function LoyaltyPanel({ clinicId, totalVenta, onMemberSelected, onRedeemApplied }: Props) {
  const { config } = useLoyaltyConfig(clinicId)
  const { search, redeem } = useLoyaltyMember(clinicId)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LoyaltyMember[]>([])
  const [selected, setSelected] = useState<LoyaltyMember | null>(null)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [afiliacionOpen, setAfiliacionOpen] = useState(false)
  const [puntosACanjear, setPuntosACanjear] = useState('')
  const [canjeApplied, setCanjeApplied] = useState(false)
  const [canjeando, setCanjeando] = useState(false)
  const [canjeError, setCanjeError] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 3) return
    setSearching(true)
    setSearched(false)
    const res = await search(query)
    setResults(res)
    setSearching(false)
    setSearched(true)
  }, [query, search])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      void handleSearch()
    }
  }

  function selectMember(m: LoyaltyMember) {
    setSelected(m)
    setResults([])
    setQuery('')
    setSearched(false)
    onMemberSelected(m)
  }

  function clearMember() {
    setSelected(null)
    setCanjeApplied(false)
    setPuntosACanjear('')
    setCanjeError(null)
    onMemberSelected(null)
  }

  async function handleRedeem() {
    if (!selected || !config || canjeando) return
    const puntos = parseInt(puntosACanjear, 10)
    if (isNaN(puntos) || puntos <= 0) return
    setCanjeando(true)
    setCanjeError(null)
    const result = await redeem(selected.id, puntos)
    setCanjeando(false)
    if (!result.ok) {
      setCanjeError(
        result.error === 'saldo_insuficiente'
          ? `Saldo insuficiente (disponibles: ${result.disponibles ?? 0} pts)`
          : result.error === 'minimo_no_alcanzado'
          ? `Mínimo para canjear: ${result.minimo ?? config.puntos_minimos_canje} pts`
          : 'Error al canjear'
      )
      return
    }
    setCanjeApplied(true)
    setSelected(prev => prev ? { ...prev, puntos_disponibles: result.saldo_nuevo ?? 0 } : prev)
    onRedeemApplied(result.descuento_mxn ?? 0, selected.id)
  }

  if (!config?.programa_activo) return null

  const puntosGanarEstimado =
    selected && config
      ? calcularPuntosPreview(
          totalVenta,
          config.pesos_por_punto,
          nivelMultiplicador(selected.nivel, config)
        )
      : null

  const puntosNum = parseInt(puntosACanjear, 10) || 0

  return (
    <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Coins className="h-4 w-4 text-primary" />
        {config.nombre_programa}
      </div>

      <AnimatePresence mode="wait">
        {!selected ? (
          <motion.div
            key="search-state"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={spring.smooth}
            className="space-y-2"
          >
            <div className="flex gap-2">
              <Input
                placeholder="Teléfono, email o nombre..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-sm h-8"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleSearch()}
                disabled={searching || query.trim().length < 3}
                className="shrink-0"
              >
                {searching ? (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    className="inline-block"
                  >
                    <Search className="h-3 w-3" />
                  </motion.span>
                ) : (
                  <Search className="h-3 w-3" />
                )}
              </Button>
            </div>

            <AnimatePresence>
              {results.length > 0 && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={spring.smooth}
                  className="border rounded bg-background shadow-sm max-h-32 overflow-y-auto"
                >
                  {results.map((m, i) => (
                    <motion.button
                      key={m.id}
                      variants={listItemVariants}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, x: -8 }}
                      custom={i}
                      whileHover={{ backgroundColor: 'hsl(var(--muted))' }}
                      className="w-full text-left px-3 py-2 text-sm flex justify-between transition-colors"
                      onClick={() => selectMember(m)}
                    >
                      <span>{m.nombre}</span>
                      <span className="text-muted-foreground">{m.telefono ?? m.email}</span>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {searched && results.length === 0 && !searching && (
                <motion.div
                  key="no-results"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={spring.smooth}
                  className="space-y-2"
                >
                  <p className="text-xs text-muted-foreground text-center">
                    No se encontró ningún cliente.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => setAfiliacionOpen(true)}
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Afiliar nuevo cliente
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {!searched && results.length === 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setAfiliacionOpen(true)}
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Nueva afiliación
              </Button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="member-state"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: 6 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{selected.nombre}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <Badge variant="outline" className="text-xs py-0">
                    {NIVEL_LABEL[selected.nivel]}
                  </Badge>
                  <span>
                    ${valorCanjeMxn(selected.puntos_disponibles, config.valor_punto_mxn).toFixed(2)} MXN
                  </span>
                  <span>({selected.puntos_disponibles} pts)</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-6 px-2"
                onClick={clearMember}
              >
                Cambiar
              </Button>
            </div>

            <AnimatePresence>
              {puntosGanarEstimado !== null && puntosGanarEstimado > 0 && (
                <motion.p
                  key="puntos-preview"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={spring.bounce}
                  className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded px-2 py-1"
                >
                  +{puntosGanarEstimado} puntos con esta compra
                </motion.p>
              )}
            </AnimatePresence>

            {!canjeApplied && selected.puntos_disponibles >= config.puntos_minimos_canje && (
              <div className="space-y-1.5">
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min={config.puntos_minimos_canje}
                    max={selected.puntos_disponibles}
                    placeholder={`Mín. ${config.puntos_minimos_canje} pts`}
                    value={puntosACanjear}
                    onChange={e => { setPuntosACanjear(e.target.value); setCanjeError(null) }}
                    className="text-xs h-7 w-28"
                  />
                  <AnimatePresence mode="wait">
                    {puntosNum > 0 && (
                      <motion.span
                        key={puntosNum}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={spring.smooth}
                        className="text-xs text-muted-foreground"
                      >
                        = ${valorCanjeMxn(puntosNum, config.valor_punto_mxn).toFixed(2)} MXN
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <Button
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={() => void handleRedeem()}
                    disabled={canjeando || !puntosACanjear || puntosNum <= 0}
                  >
                    {canjeando ? 'Canjeando...' : 'Canjear'}
                  </Button>
                </div>
                <AnimatePresence>
                  {canjeError && (
                    <motion.p
                      key="canje-error"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-xs text-destructive"
                    >
                      {canjeError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}

            <AnimatePresence>
              {canjeApplied && (
                <motion.p
                  key="canje-ok"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={spring.bounce}
                  className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1"
                >
                  ✓ Canje aplicado — descuento en cobro
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <LoyaltyAfiliacionModal
        clinicId={clinicId}
        open={afiliacionOpen}
        onClose={() => setAfiliacionOpen(false)}
        onRegistered={m => { setAfiliacionOpen(false); selectMember(m) }}
      />
    </div>
  )
}
