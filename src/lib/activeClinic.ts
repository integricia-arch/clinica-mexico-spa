import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "activeClinicId";
const DEFAULT_CODE = "salud_integral_mx";

let cachedClinicId: string | null = null;

/**
 * Devuelve el ID de la clínica activa sin acceso a hooks (servicios, utilidades).
 * Prioridad:
 *  1. localStorage (set por useActiveClinic).
 *  2. Primera membership activa del usuario logueado.
 *  3. Clínica default `salud_integral_mx`.
 */
export async function getActiveClinicId(): Promise<string> {
  if (cachedClinicId) return cachedClinicId;

  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cachedClinicId = stored;
      return stored;
    }
  }

  const { data: userData } = await supabase.auth.getUser();
  if (userData?.user) {
    const { data } = await supabase
      .from("clinic_memberships")
      .select("clinic_id")
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (data?.clinic_id) {
      cachedClinicId = data.clinic_id;
      try {
        localStorage.setItem(STORAGE_KEY, data.clinic_id);
      } catch {
        /* ignore */
      }
      return data.clinic_id;
    }
  }

  const { data: def } = await supabase
    .from("clinics")
    .select("id")
    .eq("code", DEFAULT_CODE)
    .maybeSingle();

  if (!def?.id) {
    throw new Error("No se encontró clínica activa ni clínica default");
  }
  cachedClinicId = def.id;
  return def.id;
}

export function setActiveClinicIdCache(id: string | null) {
  cachedClinicId = id;
  if (typeof window !== "undefined") {
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function clearActiveClinicCache() {
  cachedClinicId = null;
}
