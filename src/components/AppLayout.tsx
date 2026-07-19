import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, Receipt, FileText,
  Pill, Settings, Menu, X, Bell, ChevronDown, LogOut,
  Headset, MessageCircle, BellRing, ClipboardList, Stethoscope,
  CreditCard, Lock, UserRound, ChevronLeft, ChevronRight,
  Send, Gift, ShoppingCart, Package, Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { supabase } from "@/integrations/supabase/client";
import { untypedTable } from "@/lib/untypedTable";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useModulosActivos } from "@/hooks/useModulosActivos";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LockScreen from "@/components/LockScreen";
import ManualButton from "@/components/ManualButton";
import HelpChatWidget from "@/components/HelpChatWidget";
import { SubscriptionGateBanner } from "@/components/SubscriptionGateBanner";
import { SubscriptionBlockedScreen } from "@/components/SubscriptionBlockedScreen";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  roles?: AppRole[];
  section?: string;
  moduloSlug?: string;
}

const NAV_ITEMS: NavItem[] = [
  // ── Clínica ──
  { section: "Clínica", to: "/", icon: LayoutDashboard, label: "Panel principal", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/recepcion", icon: Headset, label: "Recepción", roles: ["admin", "receptionist"] },
  { to: "/pacientes", icon: Users, label: "Pacientes", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/agenda", icon: CalendarDays, label: "Agenda", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/citas", icon: ClipboardList, label: "Citas", roles: ["admin", "receptionist", "doctor", "nurse"] },
  { to: "/doctor", icon: Stethoscope, label: "Panel del doctor", roles: ["admin", "doctor"] },
  { to: "/expedientes", icon: FileText, label: "Expedientes", roles: ["admin", "doctor", "nurse"] },
  { to: "/recetas", icon: FileText, label: "Recetas", roles: ["admin", "doctor", "nurse"] },
  { to: "/recordatorios", icon: BellRing, label: "Recordatorios", roles: ["admin", "receptionist", "doctor"] },
  // ── Operaciones ──
  { section: "Operaciones", to: "/farmacia", icon: CreditCard, label: "Caja", roles: ["admin", "nurse", "receptionist", "cajero"], moduloSlug: "pos_farmacia" },
  { to: "/compras", icon: ShoppingCart, label: "Compras", roles: ["admin", "nurse", "receptionist", "cajero"], moduloSlug: "compras" },
  { to: "/almacen", icon: Package, label: "Almacén", roles: ["admin", "nurse", "receptionist", "cajero"], moduloSlug: "almacen" },
  { to: "/enfermeria", icon: Stethoscope, label: "Enfermería", roles: ["admin", "manager", "nurse"] },
  { to: "/lealtad", icon: Gift, label: "Lealtad", roles: ["admin", "manager"] },
  { to: "/contabilidad", icon: Wallet, label: "Contabilidad", roles: ["admin", "manager"] },
  { to: "/facturacion", icon: Receipt, label: "Facturación", roles: ["admin", "receptionist"], moduloSlug: "facturacion_cfdi" },
  { to: "/inbox", icon: MessageCircle, label: "Conversaciones", roles: ["admin", "receptionist", "doctor", "nurse"] },
  // ── Admin ──
  { section: "Admin", to: "/configuracion", icon: Settings, label: "Configuración", roles: ["admin", "doctor"] },
  { to: "/ajustes", icon: ClipboardList, label: "Catálogo y ajustes", roles: ["admin"] },
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

// Focus routes where sidebar is hidden (POS / Caja mode)
const FOCUS_ROUTES = ["/caja", "/farmacia"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, roles, signOut } = useAuth();
  const { activeClinicId, activeClinic, error: clinicError } = useActiveClinic();
  const { isOpen: sidebarOpen, isCollapsed, close: closeSidebar, openDrawer, toggle, isTablet } = useSidebarState();
  const [escaladasCount, setEscaladasCount] = useState(0);
  const [ayudaEscaladaCount, setAyudaEscaladaCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isFocusRoute = FOCUS_ROUTES.some((r) => location.pathname.startsWith(r));

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleSwitchUser = async () => {
    await signOut();
    navigate("/login");
  };

  const handleLock = () => setIsLocked(true);

  const { slugs: modulosActivos, loading: loadingModulos } = useModulosActivos(activeClinicId ?? undefined);

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.roles && !item.roles.some((r) => roles.includes(r as any))) return false;
    // Mientras carga, no ocultar items por módulo (evita parpadeo: la mayoría
    // de las clínicas sí tienen el módulo contratado, es peor verlo
    // desaparecer y reaparecer que mostrarlo un instante de más).
    if (!loadingModulos && item.moduloSlug && !modulosActivos.includes(item.moduloSlug)) return false;
    return true;
  });

  const primaryRole = roles[0] as AppRole | undefined;
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] : "Sin rol";
  const initials = user?.email?.substring(0, 2).toUpperCase() || "??";

  useEffect(() => {
    if (!user || !activeClinicId) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("conversaciones")
        .select("id", { count: "exact", head: true })
        .eq("status", "escalada")
        .eq("clinic_id", activeClinicId);
      setEscaladasCount(count ?? 0);
    };
    fetchCount();
    const ch = supabase
      .channel("layout-escaladas")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversaciones" }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, activeClinicId]);

  useEffect(() => {
    if (!user || !roles.some((r) => ["admin", "manager", "receptionist"].includes(r))) return;
    const fetchAyudaCount = async () => {
      const { count } = await untypedTable("ayuda_chat_sesiones")
        .select("id", { count: "exact", head: true })
        .eq("estado", "escalada");
      setAyudaEscaladaCount(count ?? 0);
    };
    fetchAyudaCount();
    const ch = supabase
      .channel("layout-ayuda-escaladas")
      .on("postgres_changes", { event: "*", schema: "public", table: "ayuda_chat_sesiones" }, fetchAyudaCount)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, roles]);

  // Sidebar width classes
  const sidebarWidth = isCollapsed ? "w-16" : "w-64";
  const contentMargin = isFocusRoute ? "" : isCollapsed ? "xl:ml-16" : "xl:ml-64";

  // Bloqueo duro: suscripción cancelada, o gracia por pago pendiente ya vencida
  // (RLS ya bloquea los datos reales; esta pantalla evita mostrar una UI rota
  // con queries fallando en silencio — todos los hooks ya corrieron arriba).
  const graceExpired =
    activeClinic?.subscription_status === "past_due" &&
    !!activeClinic.grace_period_ends_at &&
    new Date(activeClinic.grace_period_ends_at) < new Date();

  if (activeClinic && (activeClinic.subscription_status === "canceled" || graceExpired)) {
    return <SubscriptionBlockedScreen clinic={activeClinic} />;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {activeClinic && <SubscriptionGateBanner clinic={activeClinic} />}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Saltar al contenido principal
      </a>
      {clinicError && (
        <div className="fixed top-0 inset-x-0 z-50 bg-destructive/90 text-destructive-foreground text-xs text-center py-2 px-4">
          Error cargando datos de clínica: {clinicError} — recarga la página o contacta soporte.
        </div>
      )}
      {isLocked && user?.email && (
        <LockScreen
          email={user.email}
          initials={initials}
          roleLabel={roleLabel}
          onUnlocked={() => setIsLocked(false)}
          onSwitchUser={handleSwitchUser}
        />
      )}

      {/* Mobile/tablet overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm xl:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      {!isFocusRoute && (
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar
            transition-[transform,width] duration-[280ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]
            ${sidebarWidth}
            xl:translate-x-0
            ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
          `}
        >
          {/* Logo */}
          <div className={`flex h-16 items-center border-b border-sidebar-border shrink-0 ${isCollapsed ? "justify-center px-3" : "gap-2.5 px-5"}`}>
            <Logo variant={isCollapsed ? "icon" : "wordmark"} size="md" />
            {/* Mobile close button */}
            <button
              onClick={closeSidebar}
              aria-label="Cerrar menú"
              className={`ml-auto p-1 text-sidebar-foreground hover:text-sidebar-accent-foreground xl:hidden ${isCollapsed ? "hidden" : ""}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
            {(() => {
              let lastSection = "";
              return visibleNav.map((item) => {
                const showSection = item.section && item.section !== lastSection;
                if (item.section) lastSection = item.section;
                const isActive = item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);
                const showBadge =
                  (item.to === "/inbox" && escaladasCount > 0) ||
                  (item.to === "/ayuda-interna" && ayudaEscaladaCount > 0);
                const badgeCount = item.to === "/inbox" ? escaladasCount : ayudaEscaladaCount;
                return (
                  <div key={item.to}>
                    {showSection && !isCollapsed && (
                      <div className="flex items-center gap-2 px-3 pt-5 pb-1">
                        <div className="h-px flex-1 bg-white/[0.06]" />
                        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
                          {item.section}
                        </span>
                        <div className="h-px flex-1 bg-white/[0.06]" />
                      </div>
                    )}
                    {showSection && isCollapsed && (
                      <div className="mx-2 my-3 border-t border-sidebar-border/40" />
                    )}
                    <NavLink
                      to={item.to}
                      onClick={closeSidebar}
                      title={isCollapsed ? item.label : undefined}
                      aria-label={isCollapsed ? item.label : undefined}
                      className={`
                        relative flex items-center gap-3 rounded-lg text-sm font-medium overflow-hidden
                        ${isCollapsed ? "justify-center px-0 py-2.5 mx-1" : "px-3 py-2.5"}
                        ${isActive
                          ? "bg-indigo-500/15 text-indigo-300 shadow-[inset_0_0.5px_0_rgba(255,255,255,0.08),inset_0_-0.5px_0_rgba(0,0,0,0.10)]"
                          : "text-white/50 hover:bg-white/[0.05] hover:text-white/80 transition-[background-color,color] duration-150 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
                        }
                      `}
                    >
                      {isActive && !isCollapsed && (
                        <span className="absolute left-0 h-4 w-[3px] rounded-r-full bg-indigo-400" />
                      )}
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {showBadge && (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 text-[10px] font-bold rounded-full bg-red-500 text-white px-1.5">
                              {badgeCount}
                            </span>
                          )}
                        </>
                      )}
                      {isCollapsed && showBadge && (
                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
                      )}
                    </NavLink>
                  </div>
                );
              });
            })()}
          </nav>

          {/* Footer */}
          <div className="border-t border-sidebar-border shrink-0">
            {/* Collapse toggle — desktop only */}
            <div className="hidden xl:flex justify-end px-3 py-2">
              <button
                onClick={toggle}
                className="flex items-center justify-center h-8 w-8 p-1 rounded-md text-sidebar-foreground/50 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60 transition-colors"
                title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
                aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            {/* Legal links */}
            {!isCollapsed && (
              <div className="px-3 pb-2 flex gap-3 text-[10px] text-white/25">
                <a href="/aviso-privacidad" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">
                  Privacidad
                </a>
                <a href="/terminos" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">
                  Términos
                </a>
                <a href="/solicitud-arco" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">
                  ARCO
                </a>
              </div>
            )}

            {/* User info */}
            <div className={`p-3 ${isCollapsed ? "flex justify-center" : "flex items-center gap-3"}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300 ring-1 ring-inset ring-indigo-500/30 text-sm font-semibold">
                {initials}
              </div>
              {!isCollapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white/70">
                      {user?.email?.split("@")[0] || "Usuario"}
                    </p>
                    <p className="truncate text-xs text-white/35">{roleLabel}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-white/25 hover:text-red-400/70 transition-colors duration-150"
                    title="Cerrar sesión"
                    aria-label="Cerrar sesión"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Main */}
      <div className={`flex flex-1 flex-col overflow-hidden transition-[margin-left] duration-300 ${contentMargin}`}>
        <header className="flex h-14 items-center justify-between border-b border-[hsl(228_20%_91%)] bg-[hsl(228_25%_99.5%/0.82)] backdrop-blur-[16px] backdrop-saturate-[1.6] shadow-[0_1px_0_hsl(228_20%_91%)] px-4 shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile/tablet hamburger */}
            {!isFocusRoute && (
              <button
                onClick={openDrawer}
                aria-label="Abrir menú"
                className="flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors xl:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            {/* Focus route: always show hamburger */}
            {isFocusRoute && (
              <button
                onClick={openDrawer}
                aria-label="Abrir menú"
                className="flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ManualButton />
            <button
              aria-label="Notificaciones"
              className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Bell className="h-[18px] w-[18px]" />
              <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-400 ring-2 ring-white animate-pulse motion-reduce:animate-none" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors cursor-pointer outline-none">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200 text-xs font-semibold">
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium leading-tight">{user?.email?.split("@")[0]}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{roleLabel}</p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-foreground truncate">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLock} className="gap-2 cursor-pointer">
                  <Lock className="h-4 w-4" />
                  Bloquear pantalla
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSwitchUser} className="gap-2 cursor-pointer">
                  <UserRound className="h-4 w-4" />
                  Cambiar de usuario
                </DropdownMenuItem>
                {roles.includes("nurse") && (
                  <DropdownMenuItem onClick={() => navigate("/perfil/vincular-telegram")} className="gap-2 cursor-pointer">
                    <Send className="h-4 w-4" />
                    Vincular Telegram
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 xl:p-6">{children}</main>
      </div>
      <HelpChatWidget />
    </div>
  );
}
