import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, Receipt, FileText,
  Pill, Settings, Menu, X, Heart, Bell, ChevronDown, LogOut,
  CalendarPlus, Headset, ShieldCheck, Inbox as InboxIcon,
  MessageCircle, BellRing, ClipboardList, UserCog, Stethoscope,
  CreditCard, ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSidebarState } from "@/hooks/useSidebarState";

type AppRole = "admin" | "receptionist" | "doctor" | "nurse" | "patient" | "manager" | "cajero";

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  roles?: AppRole[];
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  // ── Clínica ──
  { section: "Clínica", to: "/", icon: LayoutDashboard, label: "Panel principal", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/recepcion", icon: Headset, label: "Recepción", roles: ["admin", "receptionist"] },
  { to: "/pacientes", icon: Users, label: "Pacientes", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/agenda", icon: CalendarDays, label: "Agenda", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/nueva-cita", icon: CalendarPlus, label: "Nueva cita", roles: ["admin", "receptionist"] },
  { to: "/doctor", icon: Stethoscope, label: "Panel del doctor", roles: ["admin", "doctor"] },
  { to: "/expedientes", icon: FileText, label: "Expedientes", roles: ["admin", "doctor", "nurse"] },
  { to: "/recetas", icon: FileText, label: "Recetas", roles: ["admin", "doctor", "nurse"] },
  { to: "/citas", icon: ClipboardList, label: "Citas", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/recordatorios", icon: BellRing, label: "Recordatorios", roles: ["admin", "receptionist", "doctor"] },
  // ── Operaciones ──
  { section: "Operaciones", to: "/farmacia", icon: Pill, label: "Farmacia", roles: ["admin", "nurse", "receptionist"] },
  { to: "/caja", icon: CreditCard, label: "Caja", roles: ["admin", "manager", "cajero", "receptionist"] },
  // ── Admin ──
  { section: "Admin", to: "/facturacion", icon: Receipt, label: "Facturación", roles: ["admin", "receptionist"] },
  { to: "/inbox", icon: MessageCircle, label: "Conversaciones", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/auditoria", icon: ShieldCheck, label: "Auditoría", roles: ["admin"] },
  { to: "/configuracion", icon: Settings, label: "Configuración", roles: ["admin", "doctor"] },
  // patient-only
  { to: "/mis-recetas", icon: Pill, label: "Mis recetas", roles: ["patient"] },
];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  receptionist: "Recepción",
  doctor: "Médico",
  nurse: "Enfermería",
  patient: "Paciente",
  manager: "Supervisor",
  cajero: "Cajero",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, roles, signOut } = useAuth();
  const { isOpen: sidebarOpen, isCollapsed, toggle: toggleSidebar, close: closeSidebar, isTablet } = useSidebarState();
  const [escaladasCount, setEscaladasCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return item.roles.some((r) => roles.includes(r as any));
  });

  const primaryRole = roles[0] as AppRole | undefined;
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] : "Sin rol";
  const initials = user?.email?.substring(0, 2).toUpperCase() || "??";

  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("conversaciones")
        .select("id", { count: "exact", head: true })
        .eq("status", "escalada");
      setEscaladasCount(count ?? 0);
    };
    fetchCount();
    const ch = supabase
      .channel("layout-escaladas")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversaciones" }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && isTablet && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm xl:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar transition-all duration-300 xl:relative xl:translate-x-0 ${
          isCollapsed ? "w-16" : "w-64"
        } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
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
          <button onClick={closeSidebar} className="ml-auto xl:hidden text-sidebar-foreground hover:text-sidebar-accent-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {(() => {
            let lastSection = "";
            return visibleNav.map((item) => {
              const showSection = item.section && item.section !== lastSection;
              if (item.section) lastSection = item.section;
              const isActive = location.pathname === item.to;
              const showBadge = item.to === "/inbox" && escaladasCount > 0;
              return (
                <div key={item.to}>
                  {showSection && !isCollapsed && (
                    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                      {item.section}
                    </p>
                  )}
                  <NavLink
                    to={item.to}
                    onClick={closeSidebar}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isCollapsed ? "justify-center px-0" : ""
                    } ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    {!isCollapsed && <span className="flex-1">{item.label}</span>}
                    {!isCollapsed && showBadge && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 text-[10px] font-bold rounded-full bg-red-500 text-white px-1.5">
                        {escaladasCount}
                      </span>
                    )}
                  </NavLink>
                </div>
              );
            });
          })()}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center flex-col gap-1" : ""}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-primary text-sm font-semibold">
              {initials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
                  {user?.email || "Usuario"}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/60">{roleLabel}</p>
              </div>
            )}
            {!isCollapsed && (
              <button
                onClick={() => { signOut(); navigate("/login"); }}
                className="text-sidebar-foreground hover:text-sidebar-accent-foreground"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="mt-3 hidden xl:flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`} />
            {!isCollapsed && <span>Colapsar</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <button onClick={toggleSidebar} className="xl:hidden text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden xl:block" />
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
