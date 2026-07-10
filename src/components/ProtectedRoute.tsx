import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActiveClinic } from "@/hooks/useActiveClinic";
import { useModulosActivos } from "@/hooks/useModulosActivos";
import { ModuloNoContratadoScreen } from "@/components/ModuloNoContratadoScreen";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLE_HOME: Partial<Record<AppRole, string>> = {
  cajero: "/farmacia",
  manager: "/farmacia",
  nurse: "/farmacia",
  patient: "/mis-recetas",
};

interface Props {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
  requiredModulo?: string;
}

export default function ProtectedRoute({ children, allowedRoles, requiredModulo }: Props) {
  const { user, roles, loading } = useAuth();
  const { activeClinicId } = useActiveClinic();
  const { slugs: modulosActivos, loading: loadingModulos } = useModulosActivos(
    requiredModulo ? activeClinicId ?? undefined : undefined,
  );
  const location = useLocation();

  if (loading || (requiredModulo && loadingModulos)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  // Usuario autenticado pero sin roles asignados → pendiente de activación
  if (roles.length === 0) return <Navigate to="/sin-acceso" replace />;

  if (allowedRoles && !allowedRoles.some((r) => roles.includes(r))) {
    const primaryRole = roles[0] as AppRole | undefined;
    const home = (primaryRole && ROLE_HOME[primaryRole]) ?? "/";
    return <Navigate to={home} replace />;
  }

  // Capa cosmética (2): el control real vive en RLS (clinic_has_modulo_access).
  // Esta pantalla solo evita mostrar una UI rota con queries fallando en silencio.
  if (requiredModulo && !modulosActivos.includes(requiredModulo)) {
    return <ModuloNoContratadoScreen moduloSlug={requiredModulo} />;
  }

  return <>{children}</>;
}
