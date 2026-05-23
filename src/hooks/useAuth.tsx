import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  isStaff: () => boolean;
  refreshRoles: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles(data?.map((r) => r.role) ?? []);
  }, []);

  // Fuerza refresh del JWT para que las claims (incluyendo roles via custom hooks)
  // queden actualizadas antes de leer user_roles.
  const refreshSessionAndRoles = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        setSession(data.session);
        setUser(data.user ?? null);
      }
    } catch {
      /* refresh opcional, continuamos */
    }
    await fetchRoles(userId);
  }, [fetchRoles]);

  const refreshRoles = useCallback(async () => {
    if (!user) return;
    await refreshSessionAndRoles(user.id);
  }, [user, refreshSessionAndRoles]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setLoading(true);
          // Defer para evitar deadlock del cliente de Supabase
          setTimeout(() => {
            // Al iniciar sesión, refrescamos el JWT para obtener claims más recientes
            if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
              refreshSessionAndRoles(session.user.id).finally(() => setLoading(false));
            } else {
              fetchRoles(session.user.id).finally(() => setLoading(false));
            }
          }, 0);
        } else {
          setRoles([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchRoles(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchRoles, refreshSessionAndRoles]);

  // Realtime: si cambian los roles del usuario actual, refrescamos al vuelo
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user-roles-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => {
          refreshSessionAndRoles(user.id);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refreshSessionAndRoles]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const isStaff = useCallback(
    () => roles.some((r) => ["admin", "receptionist", "doctor", "nurse"].includes(r)),
    [roles]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, hasRole, isStaff, refreshRoles, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
