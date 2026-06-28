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
import type { Json } from "@/integrations/supabase/types"
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
      .then(({ data, error: rpcErr }) => {
        if (rpcErr) { toast.warning("No se pudo cargar la lista de enfermeras"); return }
        setNurses(
          (data ?? []).map((n) => ({
            id: n.id,
            nombre: n.nombre,
            apellidos: n.apellidos,
            categoria: n.categoria as string,
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
    if (!activeClinicId) { toast.error("No hay clínica activa seleccionada"); return }
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from("entregas_turno").insert({
      clinic_id: activeClinicId,
      sala: sala.trim(),
      turno: turno as string,
      fecha,
      enfermera_entrega: user?.id ?? null,
      enfermera_recibe: enfermeraRecibe || null,
      resumen: resumen.trim() || null,
      pacientes_json: filterValidPacientes(pacientes) as unknown as Json,
      pendientes_json: filterValidPendientes(pendientes) as unknown as Json,
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
