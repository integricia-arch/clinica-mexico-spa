import { useEffect, useState } from 'react'
import { useLoyaltyConfig } from './hooks/useLoyaltyConfig'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useActiveClinic } from '@/hooks/useActiveClinic'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface FormState {
  nombre_programa: string
  slug_farmacia: string
  pesos_por_punto: number
  valor_punto_mxn: number
  puntos_minimos_canje: number
  nivel_plata_umbral: number
  nivel_oro_umbral: number
  nivel_diamante_umbral: number
  multiplicador_plata: number
  multiplicador_oro: number
  multiplicador_diamante: number
  expiracion_dias_inactividad: number
  programa_activo: boolean
}

function buildFormState(config: {
  nombre_programa: string
  slug_farmacia: string
  pesos_por_punto: number
  valor_punto_mxn: number
  puntos_minimos_canje: number
  nivel_plata_umbral: number
  nivel_oro_umbral: number
  nivel_diamante_umbral: number
  multiplicador_plata: number
  multiplicador_oro: number
  multiplicador_diamante: number
  expiracion_dias_inactividad: number
  programa_activo: boolean
} | null): FormState {
  return {
    nombre_programa: config?.nombre_programa ?? 'Monedero Farmacia',
    slug_farmacia: config?.slug_farmacia ?? '',
    pesos_por_punto: config?.pesos_por_punto ?? 10,
    valor_punto_mxn: config?.valor_punto_mxn ?? 0.1,
    puntos_minimos_canje: config?.puntos_minimos_canje ?? 100,
    nivel_plata_umbral: config?.nivel_plata_umbral ?? 500,
    nivel_oro_umbral: config?.nivel_oro_umbral ?? 1500,
    nivel_diamante_umbral: config?.nivel_diamante_umbral ?? 4000,
    multiplicador_plata: config?.multiplicador_plata ?? 1.25,
    multiplicador_oro: config?.multiplicador_oro ?? 1.5,
    multiplicador_diamante: config?.multiplicador_diamante ?? 2,
    expiracion_dias_inactividad: config?.expiracion_dias_inactividad ?? 180,
    programa_activo: config?.programa_activo ?? false,
  }
}

function validateForm(form: FormState): string | null {
  if (!form.slug_farmacia.trim()) return 'El slug de la farmacia es requerido'
  if (form.pesos_por_punto <= 0) return 'El valor de pesos por punto debe ser mayor a 0'
  if (form.valor_punto_mxn <= 0) return 'El valor del punto en MXN debe ser mayor a 0'
  if (form.puntos_minimos_canje < 1) return 'El mínimo de puntos para canje debe ser al menos 1'
  if (form.nivel_plata_umbral >= form.nivel_oro_umbral) {
    return 'El umbral de Plata debe ser menor al de Oro'
  }
  if (form.nivel_oro_umbral >= form.nivel_diamante_umbral) {
    return 'El umbral de Oro debe ser menor al de Diamante'
  }
  if (form.expiracion_dias_inactividad < 30) {
    return 'Los días de inactividad deben ser al menos 30'
  }
  return null
}

export function LoyaltyConfig() {
  const { activeClinicId } = useActiveClinic()
  const { config, loading, save } = useLoyaltyConfig(activeClinicId)
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(() => buildFormState(null))
  const [killSwitchDialog, setKillSwitchDialog] = useState(false)
  const [pendingActive, setPendingActive] = useState<boolean>(false)
  const [savedPulse, setSavedPulse] = useState(false)

  // Sync form when config loads
  useEffect(() => {
    if (config) {
      setForm(buildFormState(config))
    }
  }, [config])

  function handleProgramaActivoToggle(v: boolean) {
    if (!v) {
      // Confirm before disabling
      setPendingActive(false)
      setKillSwitchDialog(true)
    } else {
      setForm(f => ({ ...f, programa_activo: true }))
    }
  }

  function handleKillSwitchConfirm() {
    setForm(f => ({ ...f, programa_activo: false }))
    setKillSwitchDialog(false)
  }

  async function handleSave() {
    const validationError = validateForm(form)
    if (validationError) {
      toast({ title: validationError, variant: 'destructive' })
      return
    }
    setSaving(true)
    const ok = await save(form)
    setSaving(false)
    if (ok) {
      setSavedPulse(true)
      setTimeout(() => setSavedPulse(false), 2000)
      toast({ title: 'Configuración guardada' })
    } else {
      toast({ title: 'Error al guardar', variant: 'destructive' })
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground p-4">Cargando configuración...</p>
  }

  const slugPreview = form.slug_farmacia || 'tu-slug'

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Kill switch */}
      <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/30">
        <div>
          <p className="text-sm font-semibold">Programa activo</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Los clientes pueden acumular y canjear puntos
          </p>
        </div>
        <Switch
          checked={form.programa_activo}
          onCheckedChange={handleProgramaActivoToggle}
        />
      </div>

      {/* Datos del programa */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Datos del programa
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">Nombre del programa</Label>
            <Input
              value={form.nombre_programa}
              onChange={e => setForm(f => ({ ...f, nombre_programa: e.target.value }))}
              className="h-9 mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Slug URL</Label>
            <Input
              value={form.slug_farmacia}
              placeholder="farmacia-central"
              onChange={e =>
                setForm(f => ({
                  ...f,
                  slug_farmacia: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                }))
              }
              className="h-9 mt-1 font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL resultante:{' '}
              <span className="font-mono text-foreground">
                loyalty.integrika.mx/{slugPreview}
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Economía de puntos */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Economía de puntos
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">$ MXN por punto</Label>
            <Input
              type="number"
              step="1"
              min="1"
              value={form.pesos_por_punto}
              onChange={e =>
                setForm(f => ({ ...f, pesos_por_punto: parseFloat(e.target.value) || 0 }))
              }
              className="h-9 mt-1 font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ej: 10 → cada $10 MXN = 1 punto
            </p>
          </div>
          <div>
            <Label className="text-xs">Valor de 1 punto en $ MXN</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={form.valor_punto_mxn}
              onChange={e =>
                setForm(f => ({ ...f, valor_punto_mxn: parseFloat(e.target.value) || 0 }))
              }
              className="h-9 mt-1 font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ej: 0.10 → 100 pts = $10.00 MXN
            </p>
          </div>
          <div>
            <Label className="text-xs">Mínimo pts para canjear</Label>
            <Input
              type="number"
              min="1"
              value={form.puntos_minimos_canje}
              onChange={e =>
                setForm(f => ({ ...f, puntos_minimos_canje: parseInt(e.target.value) || 0 }))
              }
              className="h-9 mt-1 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">Días inactividad → vencer pts</Label>
            <Input
              type="number"
              min="30"
              value={form.expiracion_dias_inactividad}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  expiracion_dias_inactividad: parseInt(e.target.value) || 0,
                }))
              }
              className="h-9 mt-1 font-mono"
            />
          </div>
        </div>
      </section>

      {/* Umbrales de nivel */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Umbrales de nivel (puntos acumulados 12 meses)
        </h3>

        {/* Visual tier diagram */}
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground py-2 px-3 rounded-md bg-muted/40 overflow-x-auto">
          <span className="text-amber-600 font-semibold whitespace-nowrap">Bronce</span>
          <span>→ {form.nivel_plata_umbral.toLocaleString()} pts →</span>
          <span className="text-slate-600 font-semibold whitespace-nowrap">Plata</span>
          <span>→ {form.nivel_oro_umbral.toLocaleString()} pts →</span>
          <span className="text-yellow-600 font-semibold whitespace-nowrap">Oro</span>
          <span>→ {form.nivel_diamante_umbral.toLocaleString()} pts →</span>
          <span className="text-blue-600 font-semibold whitespace-nowrap">Diamante</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">🥈 Plata desde (pts)</Label>
            <Input
              type="number"
              min="1"
              value={form.nivel_plata_umbral}
              onChange={e =>
                setForm(f => ({ ...f, nivel_plata_umbral: parseInt(e.target.value) || 0 }))
              }
              className="h-9 mt-1 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">🥇 Oro desde (pts)</Label>
            <Input
              type="number"
              min="1"
              value={form.nivel_oro_umbral}
              onChange={e =>
                setForm(f => ({ ...f, nivel_oro_umbral: parseInt(e.target.value) || 0 }))
              }
              className="h-9 mt-1 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">💎 Diamante desde (pts)</Label>
            <Input
              type="number"
              min="1"
              value={form.nivel_diamante_umbral}
              onChange={e =>
                setForm(f => ({ ...f, nivel_diamante_umbral: parseInt(e.target.value) || 0 }))
              }
              className="h-9 mt-1 font-mono"
            />
          </div>
        </div>
      </section>

      {/* Multiplicadores */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Multiplicadores por nivel
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Multiplicador Plata</Label>
            <Input
              type="number"
              step="0.05"
              min="1"
              value={form.multiplicador_plata}
              onChange={e =>
                setForm(f => ({ ...f, multiplicador_plata: parseFloat(e.target.value) || 1 }))
              }
              className="h-9 mt-1 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">Multiplicador Oro</Label>
            <Input
              type="number"
              step="0.05"
              min="1"
              value={form.multiplicador_oro}
              onChange={e =>
                setForm(f => ({ ...f, multiplicador_oro: parseFloat(e.target.value) || 1 }))
              }
              className="h-9 mt-1 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">Multiplicador Diamante</Label>
            <Input
              type="number"
              step="0.05"
              min="1"
              value={form.multiplicador_diamante}
              onChange={e =>
                setForm(f => ({ ...f, multiplicador_diamante: parseFloat(e.target.value) || 1 }))
              }
              className="h-9 mt-1 font-mono"
            />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving} className="min-w-36">
          {savedPulse ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar configuración'}
        </Button>
        <Button
          variant="outline"
          onClick={() => setForm(buildFormState(config))}
          disabled={saving}
        >
          Cancelar
        </Button>
      </div>

      {/* Kill switch confirmation dialog */}
      <AlertDialog open={killSwitchDialog} onOpenChange={setKillSwitchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar el programa de lealtad?</AlertDialogTitle>
            <AlertDialogDescription>
              Los clientes no podrán acumular ni canjear puntos mientras el programa esté
              inactivo. Esta acción no elimina los puntos existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingActive(true)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleKillSwitchConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
