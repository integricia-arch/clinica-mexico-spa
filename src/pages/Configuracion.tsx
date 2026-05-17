import { useEffect, useState } from "react";
import { Building2, Users, Shield, Bell, Globe, FileText, MapPin, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const secciones = [
  { icon: Building2, titulo: "Datos del consultorio", descripcion: "Nombre, dirección, teléfono, logotipo y datos fiscales del establecimiento." },
  { icon: Users, titulo: "Usuarios y roles", descripcion: "Administrar cuentas: Administrador, Recepción, Médico, Enfermería, Farmacia, Caja/Facturación." },
  { icon: Shield, titulo: "Permisos y seguridad", descripcion: "Control de acceso por rol, sesiones activas y políticas de contraseña." },
  { icon: Bell, titulo: "Notificaciones y recordatorios", descripcion: "Configurar recordatorios por WhatsApp, SMS o correo electrónico para citas y seguimientos." },
  { icon: Globe, titulo: "Localización", descripcion: "Zona horaria (Ciudad de México), formato de fecha (dd/mm/aaaa), moneda (MXN), idioma (Español)." },
  { icon: FileText, titulo: "Facturación y CFDI", descripcion: "Datos del emisor, régimen fiscal, certificados de sello digital y configuración de timbrado." },
];

interface Room { id: string; nombre: string; piso: string | null; activo: boolean; capacidad: number }

export default function Configuracion() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomModal, setRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({ nombre: "", piso: "", capacidad: 1 });
  const [savingRoom, setSavingRoom] = useState(false);

  const loadRooms = async () => {
    setLoadingRooms(true);
    const { data } = await supabase.from("rooms").select("*").order("nombre");
    setRooms((data as any) ?? []);
    setLoadingRooms(false);
  };

  useEffect(() => { loadRooms(); }, []);

  const toggleRoom = async (r: Room) => {
    const { error } = await supabase.from("rooms").update({ activo: !r.activo }).eq("id", r.id);
    if (error) { toast.error("No se pudo actualizar: " + error.message); return; }
    setRooms((prev) => prev.map((x) => (x.id === r.id ? { ...x, activo: !r.activo } : x)));
  };

  const saveRoom = async () => {
    if (!roomForm.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
    setSavingRoom(true);
    const { error } = await supabase.from("rooms").insert({
      nombre: roomForm.nombre.trim(),
      piso: roomForm.piso.trim() || null,
      capacidad: roomForm.capacidad || 1,
      activo: true,
    });
    setSavingRoom(false);
    if (error) { toast.error("No se pudo crear: " + error.message); return; }
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {secciones.map((s) => (
          <div key={s.titulo} className="rounded-xl border border-border bg-card p-5 shadow-card hover:shadow-elevated transition-shadow cursor-pointer group">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <s.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-display font-semibold text-card-foreground">{s.titulo}</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{s.descripcion}</p>
          </div>
        ))}
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
