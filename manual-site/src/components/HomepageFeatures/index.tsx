import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {
  Headset, Users, CalendarDays, ClipboardList, Stethoscope, FileText,
  Pill, BellRing, CreditCard, Receipt, MessageCircle, BarChart2,
  UserCog, ShieldCheck, Settings,
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
      { slug: 'recepcion', label: 'Recepción', Icon: Headset, ready: false },
      { slug: 'pacientes', label: 'Pacientes', Icon: Users, ready: false },
      { slug: 'agenda', label: 'Agenda', Icon: CalendarDays, ready: false },
      { slug: 'citas', label: 'Citas', Icon: ClipboardList, ready: false },
      { slug: 'panel-doctor', label: 'Panel del doctor', Icon: Stethoscope, ready: false },
      { slug: 'expedientes', label: 'Expedientes', Icon: FileText, ready: false },
      { slug: 'recetas', label: 'Recetas', Icon: FileText, ready: false },
      { slug: 'recordatorios', label: 'Recordatorios', Icon: BellRing, ready: false },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { slug: 'farmacia', label: 'Farmacia / Caja', Icon: CreditCard, ready: true },
      { slug: 'facturacion', label: 'Facturación', Icon: Receipt, ready: false },
      { slug: 'conversaciones', label: 'Conversaciones', Icon: MessageCircle, ready: false },
    ],
  },
  {
    label: 'Admin',
    items: [
      { slug: 'inteligencia-bi', label: 'Inteligencia BI', Icon: BarChart2, ready: false },
      { slug: 'admin-usuarios', label: 'Usuarios', Icon: UserCog, ready: false },
      { slug: 'auditoria', label: 'Auditoría', Icon: ShieldCheck, ready: false },
      { slug: 'configuracion', label: 'Configuración', Icon: Settings, ready: false },
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
