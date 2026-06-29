import { useCallback, useEffect, useRef, useState } from 'react'
import { useActiveClinic } from '@/hooks/useActiveClinic'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { useLoyaltyConfig } from './hooks/useLoyaltyConfig'
import { useLoyaltyMember } from './hooks/useLoyaltyMember'
import { NIVEL_LABEL, NIVEL_COLOR, valorCanjeMxn } from './types'
import type { LoyaltyMember, LoyaltyMovimiento } from './types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowUpDown, Search } from 'lucide-react'

type SortKey = 'nombre' | 'puntos_disponibles' | 'nivel' | 'created_at'
type SortDir = 'asc' | 'desc'

function NivelBadge({ nivel }: { nivel: string }) {
  const label = NIVEL_LABEL[nivel] ?? nivel
  const color = NIVEL_COLOR[nivel] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

function MovimientoRow({ mov }: { mov: LoyaltyMovimiento }) {
  const isPositive = mov.puntos >= 0
  return (
    <div className="flex items-center justify-between py-2 text-sm border-b last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {mov.descripcion ?? mov.tipo}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(mov.created_at), 'dd/MM/yy HH:mm', { locale: es })}
        </p>
      </div>
      <div className="text-right ml-4 shrink-0">
        <p className={`font-mono text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{mov.puntos}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          saldo: {mov.saldo_post}
        </p>
      </div>
    </div>
  )
}

interface MemberDrawerProps {
  member: LoyaltyMember | null
  open: boolean
  onClose: () => void
  valorPuntoMxn: number
}

function MemberDrawer({ member, open, onClose, valorPuntoMxn }: MemberDrawerProps) {
  const { getMovimientos } = useLoyaltyMember()
  const [movimientos, setMovimientos] = useState<LoyaltyMovimiento[]>([])
  const [loadingMovs, setLoadingMovs] = useState(false)

  useEffect(() => {
    if (!member || !open) return
    setLoadingMovs(true)
    getMovimientos(member.id)
      .then(movs => setMovimientos(movs))
      .catch(() => setMovimientos([]))
      .finally(() => setLoadingMovs(false))
  }, [member, open, getMovimientos])

  if (!member) return null

  const saldoMxn = valorCanjeMxn(member.puntos_disponibles, valorPuntoMxn)

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">{member.nombre}</SheetTitle>
          <div className="flex items-center gap-2 mt-1">
            <NivelBadge nivel={member.nivel} />
            {member.telefono && (
              <span className="text-xs text-muted-foreground">{member.telefono}</span>
            )}
            {member.email && !member.telefono && (
              <span className="text-xs text-muted-foreground">{member.email}</span>
            )}
          </div>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Puntos disponibles</p>
            <p className="font-mono text-lg font-semibold mt-0.5">
              {member.puntos_disponibles.toLocaleString()}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Saldo MXN</p>
            <p className="font-mono text-lg font-semibold mt-0.5">
              ${saldoMxn.toFixed(2)}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Pts acumulados (histórico)</p>
            <p className="font-mono text-base font-semibold mt-0.5">
              {member.puntos_acumulados_historico.toLocaleString()}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Miembro desde</p>
            <p className="text-sm font-medium mt-0.5">
              {format(new Date(member.created_at), 'dd MMM yyyy', { locale: es })}
            </p>
          </div>
        </div>

        {member.codigo_barras && (
          <div className="mt-3 rounded-md bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Código de barras</p>
            <p className="font-mono text-sm mt-0.5">{member.codigo_barras}</p>
          </div>
        )}

        <Separator className="my-4" />

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Historial de movimientos
          </h3>
          {loadingMovs ? (
            <p className="text-xs text-muted-foreground">Cargando movimientos...</p>
          ) : movimientos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin movimientos registrados.</p>
          ) : (
            <div>
              {movimientos.map(mov => (
                <MovimientoRow key={mov.id} mov={mov} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function LoyaltyMiembros() {
  const { activeClinicId } = useActiveClinic()
  const { config } = useLoyaltyConfig(activeClinicId)
  const { getAll, search: searchMembers } = useLoyaltyMember(activeClinicId)
  const [members, setMembers] = useState<LoyaltyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadMembers = useCallback(async (q: string) => {
    if (!activeClinicId) return
    setLoading(true)
    try {
      const data = q.trim().length >= 2
        ? await searchMembers(q, activeClinicId)
        : await getAll(activeClinicId)
      setMembers(data)
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  // ponytail: getAll/searchMembers omitted from deps — they close over clinicId which is already listed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClinicId])

  useEffect(() => {
    loadMembers('')
  }, [loadMembers])

  function handleSearchChange(value: string) {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadMembers(value)
    }, 350)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...members].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'nombre') {
      cmp = a.nombre.localeCompare(b.nombre)
    } else if (sortKey === 'puntos_disponibles') {
      cmp = a.puntos_disponibles - b.puntos_disponibles
    } else if (sortKey === 'nivel') {
      const order: Record<string, number> = { bronce: 0, plata: 1, oro: 2, diamante: 3 }
      cmp = (order[a.nivel] ?? 0) - (order[b.nivel] ?? 0)
    } else if (sortKey === 'created_at') {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortButton({ col }: { col: SortKey; label: string }) {
    const active = sortKey === col
    return (
      <button
        onClick={() => handleSort(col)}
        className={`flex items-center gap-1 text-xs font-medium transition-colors ${
          active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {col === 'nombre' ? 'Nombre' : col === 'puntos_disponibles' ? 'Puntos' : col === 'nivel' ? 'Nivel' : 'Registrado'}
        <ArrowUpDown className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
      </button>
    )
  }

  const valorPuntoMxn = config?.valor_punto_mxn ?? 0.1

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Nombre, teléfono o email..."
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearchQuery(''); loadMembers('') }}
            className="h-9 px-2 text-xs"
          >
            Limpiar
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4">Cargando miembros...</p>
      ) : members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {searchQuery ? 'Sin resultados para esa búsqueda.' : 'Aún no hay miembros registrados.'}
          </p>
          {!searchQuery && (
            <p className="text-xs text-muted-foreground mt-1">
              Los miembros se registran desde el módulo de Farmacia / POS.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2.5 font-normal">
                    <SortButton col="nombre" label="Nombre" />
                  </th>
                  <th className="text-left px-3 py-2.5 font-normal text-xs text-muted-foreground">
                    Contacto
                  </th>
                  <th className="text-left px-3 py-2.5 font-normal">
                    <SortButton col="nivel" label="Nivel" />
                  </th>
                  <th className="text-right px-3 py-2.5 font-normal text-xs text-muted-foreground">
                    Saldo MXN
                  </th>
                  <th className="text-right px-3 py-2.5 font-normal">
                    <SortButton col="puntos_disponibles" label="Puntos" />
                  </th>
                  <th className="text-left px-3 py-2.5 font-normal">
                    <SortButton col="created_at" label="Registrado" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(m => (
                  <tr
                    key={m.id}
                    onClick={() => { setSelectedMember(m); setDrawerOpen(true) }}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 font-medium text-sm">{m.nombre}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {m.telefono ?? m.email ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <NivelBadge nivel={m.nivel} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm">
                      ${valorCanjeMxn(m.puntos_disponibles, valorPuntoMxn).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm text-muted-foreground">
                      {m.puntos_disponibles.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {format(new Date(m.created_at), 'dd/MM/yy', { locale: es })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 bg-muted/20 border-t border-border text-xs text-muted-foreground">
            {sorted.length} miembro{sorted.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <MemberDrawer
        member={selectedMember}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        valorPuntoMxn={valorPuntoMxn}
      />
    </div>
  )
}
