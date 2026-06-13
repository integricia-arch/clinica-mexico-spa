import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ClinicLite {
  id: string;
  code: string;
  name: string;
  timezone: string | null;
  country: string | null;
  status: string;
}

interface ActiveClinicContextValue {
  activeClinicId: string | null;
  activeClinic: ClinicLite | null;
  userClinics: ClinicLite[];
  isGlobalAdmin: boolean;
  loading: boolean;
  error: string | null;
  setActiveClinicId: (id: string) => void;
  refresh: () => Promise<void>;
}

const ActiveClinicContext = createContext<ActiveClinicContextValue | undefined>(
  undefined,
);

const STORAGE_KEY = "activeClinicId";
const DEFAULT_CODE = "salud_integral_mx";

interface MembershipWithRole {
  clinic_id: string;
  role: string;
  clinics: ClinicLite | null;
}

export function ActiveClinicProvider({ children }: { children: ReactNode }) {
  const { user, roles, loading: authLoading, setClinicRoles } = useAuth();
  const [userClinics, setUserClinics] = useState<ClinicLite[]>([]);
  const [allMemberships, setAllMemberships] = useState<MembershipWithRole[]>([]);
  const [activeClinicId, setActiveClinicIdState] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // isGlobalAdmin usa los roles iniciales de user_roles (antes de narrowing por clínica)
  // para el bootstrap de useActiveClinic (detectar superadmins sin membresías)
  const isGlobalAdmin = roles.includes("admin");

  const setActiveClinicId = useCallback((id: string) => {
    setActiveClinicIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    // Actualizar roles al scope de la nueva clínica
    const clinicRoles = allMemberships
      .filter((m) => m.clinic_id === id)
      .map((m) => m.role as import("@/integrations/supabase/types").Database["public"]["Enums"]["app_role"]);
    setClinicRoles(clinicRoles.length > 0 ? clinicRoles : (isGlobalAdmin ? ["admin" as const] : []));
  }, [allMemberships, isGlobalAdmin, setClinicRoles]);

  const load = useCallback(async () => {
    if (!user) {
      setUserClinics([]);
      setActiveClinicIdState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Cargar memberships activas + datos de clinic + rol por clínica
      const { data: memberships, error: mErr } = await supabase
        .from("clinic_memberships")
        .select("clinic_id, role, clinics:clinic_id(id, code, name, timezone, country, status)")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (mErr) throw mErr;

      const rawMemberships = (memberships ?? []) as MembershipWithRole[];
      setAllMemberships(rawMemberships);

      const clinics: ClinicLite[] = rawMemberships
        .map((m) => m.clinics)
        .filter(Boolean)
        .filter((c) => c!.status === "active") as ClinicLite[];

      // dedupe por id
      const dedup = Array.from(new Map(clinics.map((c) => [c.id, c])).values());
      let finalList = dedup;

      // Si es admin global y no tiene clínicas, usar la default
      if (finalList.length === 0 && isGlobalAdmin) {
        const { data: def } = await supabase
          .from("clinics")
          .select("id, code, name, timezone, country, status")
          .eq("code", DEFAULT_CODE)
          .maybeSingle();
        if (def) finalList = [def as ClinicLite];
      }

      setUserClinics(finalList);

      // Determinar activa
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const validStored = stored && finalList.some((c) => c.id === stored) ? stored : null;
      const next = validStored ?? finalList[0]?.id ?? null;
      setActiveClinicIdState(next);
      if (next) {
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
        // Narrowing de roles al scope de la clínica activa
        const clinicRoles = rawMemberships
          .filter((m) => m.clinic_id === next)
          .map((m) => m.role as import("@/integrations/supabase/types").Database["public"]["Enums"]["app_role"]);
        setClinicRoles(clinicRoles.length > 0 ? clinicRoles : (isGlobalAdmin ? ["admin" as const] : []));
      }
    } catch (e: any) {
      setError(e?.message ?? "Error cargando clínicas");
    } finally {
      setLoading(false);
    }
  }, [user, isGlobalAdmin]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const activeClinic = useMemo(
    () => userClinics.find((c) => c.id === activeClinicId) ?? null,
    [userClinics, activeClinicId],
  );

  const value: ActiveClinicContextValue = {
    activeClinicId,
    activeClinic,
    userClinics,
    isGlobalAdmin,
    loading: authLoading || loading,
    error,
    setActiveClinicId,
    refresh: load,
  };

  return (
    <ActiveClinicContext.Provider value={value}>{children}</ActiveClinicContext.Provider>
  );
}

export function useActiveClinic() {
  const ctx = useContext(ActiveClinicContext);
  if (!ctx) {
    throw new Error("useActiveClinic debe usarse dentro de <ActiveClinicProvider>");
  }
  return ctx;
}

/**
 * Helper para inserts: lanza error si no hay clínica activa.
 */
export function useRequiredClinicId(): string {
  const { activeClinicId } = useActiveClinic();
  if (!activeClinicId) {
    throw new Error("No hay clínica activa seleccionada");
  }
  return activeClinicId;
}
