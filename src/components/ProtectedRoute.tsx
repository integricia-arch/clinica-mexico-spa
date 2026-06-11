import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.some((r) => roles.includes(r))) {
    const primaryRole = roles[0] as AppRole | undefined;
    const home = (primaryRole && ROLE_HOME[primaryRole]) ?? "/";
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
