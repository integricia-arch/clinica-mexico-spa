import { Building2, Users, Shield, Bell, Globe, FileText } from "lucide-react";

const secciones = [
  {
    icon: Building2,
    titulo: "Datos del consultorio",
    descripcion: "Nombre, dirección, teléfono, logotipo y datos fiscales del establecimiento.",
  },
  {
    icon: Users,
    titulo: "Usuarios y roles",
    descripcion: "Administrar cuentas: Administrador, Recepción, Médico, Enfermería, Farmacia, Caja/Facturación.",
  },
  {
    icon: Shield,
    titulo: "Permisos y seguridad",
    descripcion: "Control de acceso por rol, sesiones activas y políticas de contraseña.",
  },
  {
    icon: Bell,
    titulo: "Notificaciones y recordatorios",
    descripcion: "Configurar recordatorios por WhatsApp, SMS o correo electrónico para citas y seguimientos.",
  },
  {
    icon: Globe,
    titulo: "Localización",
    descripcion: "Zona horaria (Ciudad de México), formato de fecha (dd/mm/aaaa), moneda (MXN), idioma (Español).",
  },
  {
    icon: FileText,
    titulo: "Facturación y CFDI",
    descripcion: "Datos del emisor, régimen fiscal, certificados de sello digital y configuración de timbrado.",
  },
];

export default function Configuracion() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-2xl font-bold text-foreground">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajustes generales del sistema y administración de la clínica
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {secciones.map((s) => (
          <div
            key={s.titulo}
            className="rounded-xl border border-border bg-card p-5 shadow-card hover:shadow-elevated transition-shadow cursor-pointer group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <s.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-display font-semibold text-card-foreground">{s.titulo}</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{s.descripcion}</p>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-border bg-muted/50 p-4 text-xs text-muted-foreground leading-relaxed">
        <strong>Aviso:</strong> Este sistema está diseñado como herramienta de apoyo operativo para clínicas privadas en México.
        La estructura de expedientes y facturación está orientada a cumplimiento regulatorio mexicano, pero no constituye una
        certificación oficial. Consulte con su asesor legal y fiscal para validar el cumplimiento normativo aplicable.
      </div>
    </div>
  );
}
