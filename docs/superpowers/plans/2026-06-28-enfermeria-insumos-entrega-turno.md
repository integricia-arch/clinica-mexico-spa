# Enfermería — Solicitudes de Insumos + Entrega de Turno

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `/enfermeria` con dos tabs: solicitudes de insumos a farmacia (reutiliza componente existente) y entrega de turno de enfermería (nuevo componente con listas dinámicas de pacientes y pendientes).

**Architecture:** Nueva página `Enfermeria.tsx`, nuevo componente `EntregaTurno.tsx` con helpers puros en archivo separado. Queries inline, sin hooks dedicados. `SolicitudesInsumos.tsx` reutilizado sin modificaciones. Ruta y nav item agregados.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase PostgREST directo. Tablas `entregas_turno` y `solicitudes_insumos` ya existen en producción con RLS completo.

## Global Constraints

- `tsc --noEmit` debe pasar con 0 errores al terminar cada task
- Inmutabilidad: spread operator siempre, nunca mutar arrays/objetos en state
- No `console.log` en producción
- `entregas_turno` y `solicitudes_insumos` están en `types.ts` — acceso directo, sin casts `as never`
- No usar `as ReturnType<typeof supabase.from>` — rompe cuando types.ts cambia
- `rooms.nombre` es el campo de nombre de sala; `rooms.activo = true` para filtrar
- `list_nurses()` RPC devuelve `{ id, nombre, apellidos, categoria, email, horario_inicio, horario_fin }[]`
- Roles para `/enfermeria`: `nurse`, `admin`, `manager`
- `SolicitudesInsumos.tsx` existente en `src/features/farmacia/`: NO modificar

---

## File Structure

```
src/features/enfermeria/
  entregaTurnoHelpers.ts     ← interfaces + pure fns (testeable)
  EntregaTurno.tsx           ← componente principal
src/pages/
  Enfermeria.tsx             ← página con dos tabs
src/test/enfermeria/
  entrega-turno.test.ts      ← tests de helpers
src/App.tsx                  ← agregar import + ruta /enfermeria
src/components/AppLayout.tsx ← agregar nav item Enfermería
```

---

### Task 1: Helpers puros + tests

**Files:**
- Create: `src/features/enfermeria/entregaTurnoHelpers.ts`
- Create: `src/test/enfermeria/entrega-turno.test.ts`

**Interfaces:**
- Produces: `PacienteRow`, `PendienteRow`, `defaultPacienteRow()`, `defaultPendienteRow()`, `filterValidPacientes()`, `filterValidPendientes()` — usados en Task 2

- [ ] **Step 1: Escribir el test primero**

Crear `src/test/enfermeria/entrega-turno.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  defaultPacienteRow,
  defaultPendienteRow,
  filterValidPacientes,
  filterValidPendientes,
  type PacienteRow,
  type PendienteRow,
} from "@/features/enfermeria/entregaTurnoHelpers"

describe("defaultPacienteRow", () => {
  it("returns row with estado estable and empty strings", () => {
    const row = defaultPacienteRow()
    expect(row.nombre).toBe("")
    expect(row.estado).toBe("estable")
    expect(row.observacion).toBe("")
  })
})

describe("defaultPendienteRow", () => {
  it("returns row with prioridad media and empty string", () => {
    const row = defaultPendienteRow()
    expect(row.descripcion).toBe("")
    expect(row.prioridad).toBe("media")
  })
})

describe("filterValidPacientes", () => {
  it("removes rows with empty nombre", () => {
    const rows: PacienteRow[] = [
      { nombre: "Juan", estado: "estable", observacion: "" },
      { nombre: "   ", estado: "pendiente", observacion: "algo" },
      { nombre: "", estado: "urgente", observacion: "" },
    ]
    expect(filterValidPacientes(rows)).toHaveLength(1)
    expect(filterValidPacientes(rows)[0].nombre).toBe("Juan")
  })

  it("returns empty array when all nombres are blank", () => {
    const rows: PacienteRow[] = [
      { nombre: "", estado: "estable", observacion: "" },
    ]
    expect(filterValidPacientes(rows)).toHaveLength(0)
  })
})

describe("filterValidPendientes", () => {
  it("removes rows with empty descripcion", () => {
    const rows: PendienteRow[] = [
      { descripcion: "Cambio de suero", prioridad: "alta" },
      { descripcion: "", prioridad: "baja" },
      { descripcion: "  ", prioridad: "media" },
    ]
    expect(filterValidPendientes(rows)).toHaveLength(1)
    expect(filterValidPendientes(rows)[0].descripcion).toBe("Cambio de suero")
  })
})
```

- [ ] **Step 2: Correr test — debe FALLAR**

```bash
npx vitest run src/test/enfermeria/entrega-turno.test.ts
```

Esperado: FAIL — `Cannot find module '@/features/enfermeria/entregaTurnoHelpers'`

- [ ] **Step 3: Implementar helpers**

Crear `src/features/enfermeria/entregaTurnoHelpers.ts`:

```ts
export interface PacienteRow {
  nombre: string
  estado: "estable" | "pendiente" | "urgente"
  observacion: string
}

export interface PendienteRow {
  descripcion: string
  prioridad: "alta" | "media" | "baja"
}

export function defaultPacienteRow(): PacienteRow {
  return { nombre: "", estado: "estable", observacion: "" }
}

export function defaultPendienteRow(): PendienteRow {
  return { descripcion: "", prioridad: "media" }
}

export function filterValidPacientes(rows: PacienteRow[]): PacienteRow[] {
  return rows.filter((r) => r.nombre.trim() !== "")
}

export function filterValidPendientes(rows: PendienteRow[]): PendienteRow[] {
  return rows.filter((r) => r.descripcion.trim() !== "")
}
```

- [ ] **Step 4: Correr test — debe PASAR**

```bash
npx vitest run src/test/enfermeria/entrega-turno.test.ts
```

Esperado: PASS — 4 test suites, 6 tests passing

- [ ] **Step 5: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Esperado: 0 errores

- [ ] **Step 6: Commit**

```bash
git add src/features/enfermeria/entregaTurnoHelpers.ts src/test/enfermeria/entrega-turno.test.ts
git commit -m "feat: enfermería — helpers puros PacienteRow/PendienteRow con tests"
```

---

### Task 2: Componente EntregaTurno

**Files:**
- Create: `src/features/enfermeria/EntregaTurno.tsx`

**Interfaces:**
- Consumes: `PacienteRow`, `PendienteRow`, `defaultPacienteRow`, `defaultPendienteRow`, `filterValidPacientes`, `filterValidPendientes` desde `./entregaTurnoHelpers`
- Consumes: `useActiveClinic` desde `@/hooks/useActiveClinic` — provee `activeClinicId: string`
- Consumes: `supabase.from("entregas_turno")` — tabla en types.ts, acceso directo
- Consumes: `supabase.from("rooms").select("id, nombre").eq("activo", true)`
- Consumes: `supabase.rpc("list_nurses")` — retorna `{ id, nombre, apellidos, categoria }[]`
- Consumes: `toast` desde `@/lib/toast` — `.error()`, `.success()`, `.warning()`

- [ ] **Step 1: Crear componente completo**

Crear `src/features/enfermeria/EntregaTurno.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "@/lib/toast"
import { Plus, Trash2, Loader2, ClipboardList, CheckCircle2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useActiveClinic } from "@/hooks/useActiveClinic"
import {
  type PacienteRow,
  type PendienteRow,
  defaultPacienteRow,
  defaultPendienteRow,
  filterValidPacientes,
  filterValidPendientes,
} from "./entregaTurnoHelpers"

type Turno = "matutino" | "vespertino" | "nocturno"

interface EntregaDB {
  id: string
  sala: string
  turno: Turno
  fecha: string
  enfermera_entrega: string | null
  enfermera_recibe: string | null
  resumen: string | null
  pacientes_json: PacienteRow[]
  pendientes_json: PendienteRow[]
  created_at: string
  closed_at: string | null
}

interface RoomOption { id: string; nombre: string }
interface NurseOption { id: string; nombre: string; apellidos: string; categoria: string }

const TURNO_LABEL: Record<Turno, string> = {
  matutino: "Matutino",
  vespertino: "Vespertino",
  nocturno: "Nocturno",
}

const ESTADO_BADGE: Record<string, string> = {
  estable: "bg-emerald-100 text-emerald-700 border-0",
  pendiente: "bg-amber-100 text-amber-700 border-0",
  urgente: "bg-red-100 text-red-700 border-0",
}

const PRIORIDAD_BADGE: Record<string, string> = {
  alta: "bg-red-100 text-red-700 border-0",
  media: "bg-amber-100 text-amber-700 border-0",
  baja: "bg-slate-100 text-slate-700 border-0",
}

export default function EntregaTurno() {
  const { activeClinicId } = useActiveClinic()

  const [entregas, setEntregas] = useState<EntregaDB[]>([])
  const [loading, setLoading] = useState(true)
  const [rooms, setRooms] = useState<RoomOption[]>([])
  const [nurses, setNurses] = useState<NurseOption[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [detail, setDetail] = useState<EntregaDB | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [closing, setClosing] = useState(false)

  // form state
  const [sala, setSala] = useState("")
  const [turno, setTurno] = useState<Turno>("matutino")
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [enfermeraRecibe, setEnfermeraRecibe] = useState("")
  const [resumen, setResumen] = useState("")
  const [pacientes, setPacientes] = useState<PacienteRow[]>([])
  const [pendientes, setPendientes] = useState<PendienteRow[]>([])

  const fetchEntregas = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("entregas_turno")
      .select("id, sala, turno, fecha, enfermera_entrega, enfermera_recibe, resumen, pacientes_json, pendientes_json, created_at, closed_at")
      .order("created_at", { ascending: false })
      .limit(30)
    setLoading(false)
    if (error) { toast.error("Error cargando entregas de turno"); return }
    setEntregas((data ?? []) as EntregaDB[])
  }, [])

  useEffect(() => {
    void fetchEntregas()
    void supabase
      .from("rooms")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setRooms((data ?? []) as RoomOption[]))
    void supabase
      .rpc("list_nurses")
      .then(({ data, error }) => {
        if (error) { toast.warning("No se pudo cargar la lista de enfermeras"); return }
        setNurses(
          (data ?? []).map((n: { id: string; nombre: string; apellidos: string; categoria: string }) => ({
            id: n.id,
            nombre: n.nombre,
            apellidos: n.apellidos,
            categoria: n.categoria,
          }))
        )
      })
  }, [fetchEntregas])

  const resetForm = () => {
    setSala("")
    setTurno("matutino")
    setFecha(new Date().toISOString().slice(0, 10))
    setEnfermeraRecibe("")
    setResumen("")
    setPacientes([])
    setPendientes([])
  }

  const handleCrear = async () => {
    if (!sala.trim()) { toast.error("La sala es requerida"); return }
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("entregas_turno").insert({
      clinic_id: activeClinicId,
      sala: sala.trim(),
      turno,
      fecha,
      enfermera_entrega: user?.id ?? null,
      enfermera_recibe: enfermeraRecibe || null,
      resumen: resumen.trim() || null,
      pacientes_json: filterValidPacientes(pacientes),
      pendientes_json: filterValidPendientes(pendientes),
    })
    setSubmitting(false)
    if (error) { toast.error(error.message || "Error guardando entrega"); return }
    toast.success("Entrega de turno registrada")
    setShowDialog(false)
    resetForm()
    void fetchEntregas()
  }

  const handleCerrar = async (id: string) => {
    setClosing(true)
    const { error } = await supabase
      .from("entregas_turno")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", id)
    setClosing(false)
    if (error) { toast.error(error.message || "Error cerrando turno"); return }
    toast.success("Turno cerrado")
    setDetail(null)
    void fetchEntregas()
  }

  const updatePaciente = (i: number, patch: Partial<PacienteRow>) =>
    setPacientes((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const updatePendiente = (i: number, patch: Partial<PendienteRow>) =>
    setPendientes((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Entrega de turno
        </h3>
        <Button onClick={() => { resetForm(); setShowDialog(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nueva entrega
        </Button>
      </div>

      {/* Lista de entregas */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-medium">Sala</th>
                <th className="text-left px-4 py-3 font-medium">Turno</th>
                <th className="text-left px-4 py-3 font-medium">Pacientes</th>
                <th className="text-left px-4 py-3 font-medium">Pendientes</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-right px-4 py-3 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {!loading && entregas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Sin entregas registradas
                  </td>
                </tr>
              )}
              {entregas.map((e) => (
                <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">{e.fecha}</td>
                  <td className="px-4 py-3 font-medium">{e.sala}</td>
                  <td className="px-4 py-3">{TURNO_LABEL[e.turno]}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(e.pacientes_json as PacienteRow[]).length}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(e.pendientes_json as PendienteRow[]).length}
                  </td>
                  <td className="px-4 py-3">
                    {e.closed_at
                      ? <Badge className="bg-slate-100 text-slate-600 border-0">Cerrada</Badge>
                      : <Badge className="bg-emerald-100 text-emerald-700 border-0">Abierta</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setDetail(e)}>Ver</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog — nueva entrega */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva entrega de turno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Sala *</Label>
                {rooms.length > 0 ? (
                  <Select value={sala} onValueChange={setSala}>
                    <SelectTrigger><SelectValue placeholder="Selecciona sala…" /></SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.nombre}>{r.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={sala}
                    onChange={(e) => setSala(e.target.value)}
                    placeholder="Nombre de sala"
                  />
                )}
              </div>
              <div>
                <Label>Turno *</Label>
                <Select value={turno} onValueChange={(v) => setTurno(v as Turno)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matutino">Matutino</SelectItem>
                    <SelectItem value="vespertino">Vespertino</SelectItem>
                    <SelectItem value="nocturno">Nocturno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Enfermera que recibe</Label>
              <Select value={enfermeraRecibe} onValueChange={setEnfermeraRecibe}>
                <SelectTrigger><SelectValue placeholder="Selecciona enfermera…" /></SelectTrigger>
                <SelectContent>
                  {nurses.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.nombre} {n.apellidos} ({n.categoria})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Resumen del turno</Label>
              <Textarea
                value={resumen}
                onChange={(e) => setResumen(e.target.value)}
                rows={3}
                placeholder="Resumen general del turno…"
              />
            </div>

            {/* Pacientes dinámicos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Pacientes</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPacientes((p) => [...p, defaultPacienteRow()])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                </Button>
              </div>
              {pacientes.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_130px_1fr_auto] gap-2 items-start">
                  <Input
                    placeholder="Nombre del paciente"
                    value={p.nombre}
                    onChange={(e) => updatePaciente(i, { nombre: e.target.value })}
                  />
                  <Select
                    value={p.estado}
                    onValueChange={(v) => updatePaciente(i, { estado: v as PacienteRow["estado"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="estable">Estable</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Observación"
                    value={p.observacion}
                    onChange={(e) => updatePaciente(i, { observacion: e.target.value })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPacientes((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Pendientes dinámicos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Pendientes</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPendientes((p) => [...p, defaultPendienteRow()])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                </Button>
              </div>
              {pendientes.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2 items-start">
                  <Input
                    placeholder="Descripción de pendiente"
                    value={p.descripcion}
                    onChange={(e) => updatePendiente(i, { descripcion: e.target.value })}
                  />
                  <Select
                    value={p.prioridad}
                    onValueChange={(v) => updatePendiente(i, { prioridad: v as PendienteRow["prioridad"] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="baja">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPendientes((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={submitting}>
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Guardar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet de detalle */}
      <Sheet open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null) }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {detail.sala} · {TURNO_LABEL[detail.turno]} · {detail.fecha}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {detail.resumen && (
                  <p className="text-sm text-muted-foreground">{detail.resumen}</p>
                )}

                {(detail.pacientes_json as PacienteRow[]).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Pacientes</h4>
                    <div className="space-y-1.5">
                      {(detail.pacientes_json as PacienteRow[]).map((p, i) => (
                        <div key={i} className="flex flex-wrap items-start gap-2 text-sm">
                          <Badge className={ESTADO_BADGE[p.estado]}>{p.estado}</Badge>
                          <span className="font-medium">{p.nombre}</span>
                          {p.observacion && (
                            <span className="text-muted-foreground">— {p.observacion}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(detail.pendientes_json as PendienteRow[]).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Pendientes</h4>
                    <div className="space-y-1.5">
                      {(detail.pendientes_json as PendienteRow[]).map((p, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <Badge className={PRIORIDAD_BADGE[p.prioridad]}>{p.prioridad}</Badge>
                          <span>{p.descripcion}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!detail.closed_at && (
                  <Button
                    onClick={() => handleCerrar(detail.id)}
                    disabled={closing}
                    variant="outline"
                    className="w-full"
                  >
                    {closing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Cerrar turno
                  </Button>
                )}

                {detail.closed_at && (
                  <p className="text-xs text-muted-foreground text-center">
                    Turno cerrado {new Date(detail.closed_at).toLocaleString("es-MX")}
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Esperado: 0 errores. Si hay errores de tipos en `supabase.from("entregas_turno").insert(...)`:
- El campo `turno` es `text` en la tabla pero se definió con CHECK constraint. Castear con `turno: turno as string` si TypeScript se queja.
- Los campos `pacientes_json` y `pendientes_json` son `Json` en types.ts. Castear: `pacientes_json: filterValidPacientes(pacientes) as unknown as import("@/integrations/supabase/types").Json`

- [ ] **Step 3: Correr tests completos**

```bash
npx vitest run 2>&1 | tail -8
```

Esperado: todos los tests del Task 1 siguen pasando + 0 nuevos errores

- [ ] **Step 4: Commit**

```bash
git add src/features/enfermeria/EntregaTurno.tsx
git commit -m "feat: componente EntregaTurno — lista, dialog crear, sheet detalle, cerrar turno"
```

---

### Task 3: Página Enfermeria + routing + nav

**Files:**
- Create: `src/pages/Enfermeria.tsx`
- Modify: `src/App.tsx` — import + ruta `/enfermeria`
- Modify: `src/components/AppLayout.tsx` — nav item "Enfermería"

**Interfaces:**
- Consumes: `EntregaTurno` desde `@/features/enfermeria/EntregaTurno`
- Consumes: `SolicitudesInsumos` desde `@/features/farmacia/SolicitudesInsumos` (existente, sin cambios)
- Consumes: `ProtectedRoute` desde `@/components/ProtectedRoute` (existente)
- Consumes: `useActiveClinic` — `activeClinicId: string`

- [ ] **Step 1: Crear página Enfermeria.tsx**

Crear `src/pages/Enfermeria.tsx`:

```tsx
import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/integrations/supabase/client"
import { useActiveClinic } from "@/hooks/useActiveClinic"
import SolicitudesInsumos from "@/features/farmacia/SolicitudesInsumos"
import EntregaTurno from "@/features/enfermeria/EntregaTurno"

interface Medicamento { id: string; nombre: string }

export default function Enfermeria() {
  const { activeClinicId } = useActiveClinic()
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([])

  useEffect(() => {
    if (!activeClinicId) return
    void supabase
      .from("medicamentos")
      .select("id, nombre")
      .eq("activo", true)
      .eq("clinic_id", activeClinicId)
      .order("nombre")
      .then(({ data }) => setMedicamentos((data ?? []) as Medicamento[]))
  }, [activeClinicId])

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold">Enfermería</h1>
      <Tabs defaultValue="insumos">
        <TabsList>
          <TabsTrigger value="insumos">Solicitudes de Insumos</TabsTrigger>
          <TabsTrigger value="turno">Entrega de Turno</TabsTrigger>
        </TabsList>
        <TabsContent value="insumos" className="mt-4">
          <SolicitudesInsumos medicamentos={medicamentos} />
        </TabsContent>
        <TabsContent value="turno" className="mt-4">
          <EntregaTurno />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Agregar import y ruta en App.tsx**

En `src/App.tsx`, después de la línea `import Farmacia from "@/pages/Farmacia";` agregar:

```tsx
import Enfermeria from "@/pages/Enfermeria";
```

Luego, dentro del bloque de `<Routes>`, después de la ruta `/farmacia` (`<Route path="/farmacia" ...>`), agregar:

```tsx
<Route path="/enfermeria" element={
  <ProtectedRoute allowedRoles={["admin", "manager", "nurse"]}>
    <Enfermeria />
  </ProtectedRoute>
} />
```

- [ ] **Step 3: Agregar nav item en AppLayout.tsx**

En `src/components/AppLayout.tsx`, en el array de nav items, agregar después del item `{ section: "Operaciones", to: "/farmacia", ... }` (línea ~45):

```ts
{ to: "/enfermeria", icon: Stethoscope, label: "Enfermería", roles: ["admin", "manager", "nurse"] },
```

Agregar `Stethoscope` al import de lucide-react existente en AppLayout.tsx:

```tsx
import { ..., Stethoscope } from "lucide-react"
```

(Buscar la línea que importa íconos de lucide-react y agregar `Stethoscope` a la lista.)

- [ ] **Step 4: Verificar tipos y tests**

```bash
npx tsc --noEmit 2>&1 | head -20
```

```bash
npx vitest run 2>&1 | tail -8
```

Esperado: 0 errores TS, todos los tests pasan (mínimo los 6 del Task 1 + los existentes).

- [ ] **Step 5: Build completo**

```bash
npm run build 2>&1 | tail -10
```

Esperado: build exitoso sin errores.

- [ ] **Step 6: Commit final**

```bash
git add src/pages/Enfermeria.tsx src/App.tsx src/components/AppLayout.tsx
git commit -m "feat: página /enfermeria — solicitudes insumos + entrega de turno"
```
