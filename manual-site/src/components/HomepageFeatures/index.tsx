import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {
  LayoutDashboard, Headset, Users, CalendarDays, ClipboardList, Stethoscope, FileText,
  BellRing, CreditCard, Receipt, MessageCircle, BarChart2,
  UserCog, ShieldCheck, Settings, LifeBuoy,
} from 'lucide-react';

type ModuleItem = {
  slug: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; size?: number }>;
  // Solo true para slugs con archivo .md real en docs/manual-usuario.
  // Al redactar un manual nuevo, cambiar a true — no antes (evita enlaces rotos).
  ready: boolean;
};

// Misma agrupación que el sidebar real de la app (AppLayout.tsx) —
// el staff ya conoce este orden, no se inventa uno nuevo para el manual.
const SECTIONS: { label: string; items: ModuleItem[] }[] = [
  {
    label: 'Clínica',
    items: [
      { slug: 'panel-principal', label: 'Panel principal', Icon: LayoutDashboard, ready: true },
      { slug: 'recepcion', label: 'Recepción', Icon: Headset, ready: true },
      { slug: 'pacientes', label: 'Pacientes', Icon: Users, ready: true },
      { slug: 'agenda', label: 'Agenda', Icon: CalendarDays, ready: true },
      { slug: 'citas', label: 'Citas', Icon: ClipboardList, ready: true },
      { slug: 'panel-doctor', label: 'Panel del doctor', Icon: Stethoscope, ready: true },
      { slug: 'expedientes', label: 'Expedientes', Icon: FileText, ready: true },
      { slug: 'recetas', label: 'Recetas', Icon: FileText, ready: true },
      { slug: 'recordatorios', label: 'Recordatorios', Icon: BellRing, ready: true },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { slug: 'farmacia', label: 'Farmacia / Caja', Icon: CreditCard, ready: true },
      { slug: 'facturacion', label: 'Facturación', Icon: Receipt, ready: true },
      { slug: 'conversaciones', label: 'Conversaciones', Icon: MessageCircle, ready: true },
    ],
  },
  {
    label: 'Admin',
    items: [
      { slug: 'inteligencia-bi', label: 'Inteligencia BI', Icon: BarChart2, ready: true },
      { slug: 'admin-usuarios', label: 'Usuarios', Icon: UserCog, ready: true },
      { slug: 'auditoria', label: 'Auditoría', Icon: ShieldCheck, ready: true },
      { slug: 'configuracion', label: 'Configuración', Icon: Settings, ready: true },
      { slug: 'configuracion-notificaciones', label: 'Reglas de notificaciones', Icon: BellRing, ready: true },
      { slug: 'ayuda-interna', label: 'Ayuda interna', Icon: LifeBuoy, ready: true },
    ],
  },
];

export default function HomepageFeatures(): ReactNode {
  return (
    <div className="clinicDirectory">
      {SECTIONS.map((section) => (
        <div className="clinicDirectory__section" key={section.label}>
          <p className="clinicDirectory__sectionLabel">{section.label}</p>
          <div className="clinicDirectory__grid">
            {section.items.map(({ slug, label, Icon, ready }) =>
              ready ? (
                <Link key={slug} to={`/${slug}`} className="clinicCard">
                  <Icon className="clinicCard__icon" size={18} />
                  {label}
                </Link>
              ) : (
                <div key={slug} className="clinicCard clinicCard--pending" aria-disabled="true">
                  <Icon className="clinicCard__icon" size={18} />
                  <span>
                    {label}
                    <small>Próximamente</small>
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
