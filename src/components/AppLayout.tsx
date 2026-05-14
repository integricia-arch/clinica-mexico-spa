import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, Receipt, FileText,
  Pill, Settings, Menu, X, Heart, Bell, ChevronDown, LogOut,
  CalendarPlus, Headset, ShieldCheck, Inbox as InboxIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "admin" | "receptionist" | "doctor" | "nurse" | "patient";

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  roles?: AppRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    icon: LayoutDashboard,
    label: "Panel principal",
    roles: ["admin", "receptionist", "doctor", "nurse"],
  },
  {
    to: "/recepcion",
    icon: Headset,
    label: "Recepción",
    roles: ["admin", "receptionist"],
  },
  {
    to: "/pacientes",
    icon: Users,
    label: "Pacientes",
    roles: ["admin", "receptionist", "doctor", "nurse"],
  },
  {
    to: "/agenda",
    icon: CalendarDays,
    label: "Agenda",
    roles: ["admin", "receptionist", "doctor", "nurse"],
  },
  {
    to: "/nueva-cita",
    icon: CalendarPlus,
    label: "Nueva cita",
    roles: ["admin", "receptionist"],
  },
  {
    to: "/expedientes",
    icon: FileText,
    label: "Expedientes",
    roles: ["admin", "doctor", "nurse"],
  },
  {
    to: "/farmacia",
    icon: Pill,
    label: "Farmacia",
    roles: ["admin", "nurse", "receptionist"],
  },
  {
    to: "/facturacion",
    icon: Receipt,
    label: "Facturación",
    roles: ["admin", "receptionist"],
  },
  {
    to: "/inbox",
    icon: InboxIcon,
    label: "Inbox",
    roles: ["admin", "receptionist", "doctor", "nurse"],
  },
  {
    to: "/auditoria",
    icon: ShieldCheck,
    label: "Auditoría",
    roles: ["admin", "receptionist"],
  },
  {
    to: "/configuracion",
    icon: Settings,
    label: "Configuración",
    roles: ["admin"],
  },
];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  receptionist: "Recepción",
  doctor: "Médico",
  nurse: "Enfermería",
  patient: "Paciente",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, roles, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((r) => roles.includes(r as any));
  });

  const primaryRole = roles[0] as AppRole | undefined;
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] : "Sin rol";
  const initials = user?.email?.substring(0, 2).toUpperCase() || "??";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 px-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
            <Heart className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-display font-bold text-sm text-sidebar-accent-foreground">ClínicaMX</span>
            <span className="block text-[11px] text-sidebar-foreground/60">Operaciones Clínicas</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-sidebar-foreground hover:text-sidebar-accent-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleNav.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-primary text-sm font-semibold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
                {user?.email || "Usuario"}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">{roleLabel}</p>
            </div>
            <button
              onClick={() => { signOut(); navigate("/login"); }}
              className="text-sidebar-foreground hover:text-sidebar-accent-foreground"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            </button>
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors cursor-pointer">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium leading-tight">{user?.email?.split("@")[0]}</p>
                <p className="text-xs text-muted-foreground leading-tight">{roleLabel}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
