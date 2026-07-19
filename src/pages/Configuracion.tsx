import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Users, Shield, Bell, Globe, FileText, MapPin, Plus, Route as RouteIcon, ArrowRight, ScrollText, SlidersHorizontal, CreditCard, Mail, BarChart2, LifeBuoy, ShieldCheck, Clock, CheckSquare, Square, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

type Seccion = { icon: any; titulo: string; descripcion: string; to?: string; adminOnly?: boolean; managerOk?: boolean };

const secciones: Seccion[] = [
  // Rutas gateadas admin+manager en App.tsx: managerOk las hace visibles también a manager aquí.
  { icon: BarChart2, titulo: "Inteligencia BI", descripcion: "Reportes y análisis de citas, pacientes, ingresos y rendimiento de la clínica.", to: "/inteligencia", adminOnly: true, managerOk: true },
  { icon: Wallet, titulo: "Contabilidad", descripcion: "Estado de resultados, flujo de efectivo, punto de equilibrio y registro de egresos manuales.", to: "/contabilidad", adminOnly: true, managerOk: true },
  { icon: LifeBuoy, titulo: "Ayuda interna", descripcion: "Sesiones de soporte del personal: gestión de tickets escalados y base de conocimiento (FAQ).", to: "/ayuda-interna", adminOnly: true },
  { icon: Users, titulo: "Usuarios y roles", descripcion: "Administrar cuentas: Administrador, Recepción, Médico, Enfermería, Farmacia, Caja/Facturación.", to: "/admin/usuarios", adminOnly: true },
  { icon: ShieldCheck, titulo: "Auditoría", descripcion: "Historial de accesos y cambios en agenda, expedientes, farmacia y caja. Seguimientos y errores POS.", to: "/auditoria", adminOnly: true },
  { icon: SlidersHorizontal, titulo: "Configuración avanzada (demo)", descripcion: "Vista previa del centro de control: horarios, citas, recordatorios, facturación CFDI, inventario, permisos y más. Maqueta visual, sin persistencia.", to: "/ajustes" },
  { icon: Building2, titulo: "Datos del consultorio", descripcion: "Nombre, dirección, teléfono, logotipo y datos fiscales del establecimiento." },
  { icon: Shield, titulo: "Permisos y seguridad", descripcion: "Control de acceso por rol, sesiones activas y políticas de contraseña." },
  { icon: Bell, titulo: "Notificaciones por rol", descripcion: "Qué rol recibe cada tipo de aviso (asignación de enfermera, vencimientos, usuarios nuevos) y por qué canal: Telegram o email.", to: "/configuracion/notificaciones", adminOnly: true },
  { icon: Globe, titulo: "Localización", descripcion: "Zona horaria (Ciudad de México), formato de fecha (dd/mm/aaaa), moneda (MXN), idioma (Español)." },
  { icon: FileText, titulo: "Facturación y CFDI", descripcion: "Datos del emisor, régimen fiscal, certificados de sello digital y configuración de timbrado.", to: "/configuracion/facturacion", adminOnly: true },
  { icon: CreditCard, titulo: "Cobros y pagos digitales", descripcion: "Pasarela de pago: Stripe, OXXO Pay y transferencia SPEI. Terminal física en consultorio.", to: "/configuracion/pagos", adminOnly: true },
  { icon: Mail, titulo: "Email y notificaciones", descripcion: "Remitente, nombre y reply-to para correos del sistema (CFDI, recordatorios).", to: "/configuracion/email", adminOnly: true },
];

interface Room { id: string; nombre: string; piso: string | null; activo: boolean; capacidad: number }

const DIAS = [
  { num: 1, label: "Lun" }, { num: 2, label: "Mar" }, { num: 3, label: "Mié" },
  { num: 4, label: "Jue" }, { num: 5, label: "Vie" }, { num: 6, label: "Sáb" },
  { num: 0, label: "Dom" },
];

function HorarioClinicaSection() {
  const { activeClinicId } = useActiveClinic();
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [apertura, setApertura] = useState("09:00");
  const [cierre, setCierre] = useState("18:00");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeClinicId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("clinic_settings")
        .select("data")
        .eq("clinic_id", activeClinicId)
        .eq("section", "horario")
        .maybeSingle();
      if (data?.data) {
        const d = data.data as { dias_laborales: number[]; hora_apertura: string; hora_cierre: string };
        setDias(d.dias_laborales ?? [1, 2, 3, 4, 5]);
        setApertura(d.hora_apertura ?? "09:00");
        setCierre(d.hora_cierre ?? "18:00");
      }
      setLoading(false);
    })();
  }, [activeClinicId]);

  const toggleDia = (num: number) =>
    setDias((prev) => prev.includes(num) ? prev.filter((d) => d !== num) : [...prev, num].sort((a, b) => a - b));

  const save = async () => {
    if (!activeClinicId) return;
    if (dias.length === 0) { toast.error("Selecciona al menos un día"); return; }
    if (apertura >= cierre) { toast.error("La apertura debe ser antes del cierre"); return; }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("clinic_settings")
      .upsert(
        { clinic_id: activeClinicId, section: "horario", data: { dias_laborales: dias, hora_apertura: apertura, hora_cierre: cierre } },
        { onConflict: "clinic_id,section" }
      );
    setSaving(false);
    if (error) toast.error("No se pudo guardar: " + error.message);
    else toast.success("Horario guardado");
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-primary" />
        <h2 className="text-display font-semibold text-card-foreground">Horario de atención</h2>
      </div>
      <div className="space-y-4">
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">Días laborales</Label>
          <div className="flex gap-2 flex-wrap">
            {DIAS.map(({ num, label }) => {
              const activo = dias.includes(num);
              return (
                <button
                  key={num}
                  onClick={() => toggleDia(num)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    activo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {activo ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <Label htmlFor="apertura" className="text-sm text-muted-foreground">Apertura</Label>
            <input
              id="apertura"
              type="time"
              value={apertura}
              onChange={(e) => setApertura(e.target.value)}
              className="mt-1 block rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <Label htmlFor="cierre" className="text-sm text-muted-foreground">Cierre</Label>
            <input
              id="cierre"
              type="time"
              value={cierre}
              onChange={(e) => setCierre(e.target.value)}
              className="mt-1 block rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? "Guardando…" : "Guardar horario"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Configuracion() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isDoctor = hasRole("doctor");
  const isManager = hasRole("manager");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomModal, setRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({ nombre: "", piso: "", capacidad: 1 });
  const [savingRoom, setSavingRoom] = useState(false);

  const loadRooms = async () => {
    setLoadingRooms(true);
    const { data } = await (supabase as any).from("rooms").select("*").order("nombre");
    setRooms((data as any) ?? []);
    setLoadingRooms(false);
  };

  useEffect(() => { loadRooms(); }, []);

  const toggleRoom = async (r: Room) => {
    const { error } = await (supabase as any).from("rooms").update({ activo: !r.activo }).eq("id", r.id);
    if (error) { toast.error("No se pudo actualizar: " + friendlyError(error)); return; }
    setRooms((prev) => prev.map((x) => (x.id === r.id ? { ...x, activo: !r.activo } : x)));
  };

  const saveRoom = async () => {
    if (!roomForm.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSavingRoom(true);
    const { error } = await (supabase as any).from("rooms").insert({
      nombre: roomForm.nombre.trim(),
      piso: roomForm.piso.trim() || null,
      capacidad: roomForm.capacidad || 1,
      activo: true,
    });
    setSavingRoom(false);
    if (error) { toast.error("No se pudo crear: " + friendlyError(error)); return; }
    toast.success("Consultorio agregado");
    setRoomModal(false);
    setRoomForm({ nombre: "", piso: "", capacidad: 1 });
    loadRooms();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ajustes generales del sistema y administración de la clínica</p>
      </div>

      {/* Camino del Paciente — submódulo destacado */}
      {isAdmin && (
        <Link
          to="/configuracion/camino-paciente"
          className="group flex items-center justify-between rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5 shadow-card hover:shadow-elevated transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RouteIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-display font-semibold text-card-foreground">Configuración del Camino del Paciente</h2>
              <p className="text-sm text-muted-foreground">Plantillas, etapas, campos, reglas y versionado del flujo del paciente.</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-primary group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}

      {/* Mi machote de receta — para doctores y admins */}
      {(isDoctor || isAdmin) && (
        <Link
          to="/configuracion/recetas"
          className="group flex items-center justify-between rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5 shadow-card hover:shadow-elevated transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ScrollText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-display font-semibold text-card-foreground">Mi machote de receta</h2>
              <p className="text-sm text-muted-foreground">Diseña tu encabezado, logo, firma y cierre. Cada receta nueva usará tu versión publicada.</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-primary group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}

      {/* Configuración de cajas */}
      {(isAdmin || hasRole("manager")) && (
        <Link
          to="/configuracion/caja"
          className="group flex items-center justify-between rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5 shadow-card hover:shadow-elevated transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-display font-semibold text-card-foreground">Configuración de cajas</h2>
              <p className="text-sm text-muted-foreground">Registrar cajas registradoras, fondos de apertura y tipo (general/farmacia).</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-primary group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}

      {/* Consultorios */}

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-display font-semibold text-card-foreground">Consultorios</h2>
            <span className="text-xs text-muted-foreground">({rooms.length})</span>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setRoomModal(true)}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          )}
        </div>

        {loadingRooms ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin consultorios registrados. El bot necesita al menos uno para agendar citas.
          </p>
        ) : (
          <div className="space-y-2">
            {rooms.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{r.nombre}</p>
                  {r.piso && <p className="text-xs text-muted-foreground">Piso {r.piso}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${r.activo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {r.activo ? "Activo" : "Inactivo"}
                  </span>
                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => toggleRoom(r)}>
                      {r.activo ? "Desactivar" : "Activar"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdmin && <HorarioClinicaSection />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {secciones.filter((s) => !s.adminOnly || isAdmin || (s.managerOk && isManager)).map((s) => {
          const content = (
            <>
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <s.icon className="h-5 w-5" />
                </div>
                {s.to && <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />}
              </div>
              <h3 className="mt-3 text-display font-semibold text-card-foreground">{s.titulo}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{s.descripcion}</p>
              {!s.to && <p className="mt-2 text-[11px] text-muted-foreground/70 italic">Próximamente</p>}
            </>
          );
          const cls = "rounded-xl border border-border bg-card p-5 shadow-card hover:shadow-elevated transition-shadow group block";
          return s.to ? (
            <Link key={s.titulo} to={s.to} className={cls}>{content}</Link>
          ) : (
            <div key={s.titulo} className={cls + " cursor-default opacity-80"}>{content}</div>
          );
        })}
      </div>


      <div className="rounded-xl border border-border bg-muted/50 p-4 text-xs text-muted-foreground leading-relaxed">
        <strong>Aviso:</strong> Este sistema está diseñado como herramienta de apoyo operativo para clínicas privadas en México.
        La estructura de expedientes y facturación está orientada a cumplimiento regulatorio mexicano, pero no constituye una
        certificación oficial. Consulte con su asesor legal y fiscal para validar el cumplimiento normativo aplicable.
      </div>

      <Dialog open={roomModal} onOpenChange={setRoomModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar consultorio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nombre">Nombre del consultorio *</Label>
              <Input id="nombre" value={roomForm.nombre} onChange={(e) => setRoomForm({ ...roomForm, nombre: e.target.value })} placeholder="Ej. Consultorio 1" />
            </div>
            <div>
              <Label htmlFor="piso">Piso (opcional)</Label>
              <Input id="piso" value={roomForm.piso} onChange={(e) => setRoomForm({ ...roomForm, piso: e.target.value })} placeholder="Ej. 2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomModal(false)} disabled={savingRoom}>Cancelar</Button>
            <Button onClick={saveRoom} disabled={savingRoom}>{savingRoom ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
