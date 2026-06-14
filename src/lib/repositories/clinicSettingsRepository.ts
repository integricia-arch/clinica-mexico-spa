import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";

/**
 * Repositorio de secciones de configuración tipo "singleton" almacenadas en
 * `clinic_settings` (una fila por (clinic_id, section) con un blob JSONB `data`).
 *
 * NOTA: `clinic_settings` se crea en la migración
 * 20260604191834_clinic_settings_and_clinic_update_policy.sql. Los tipos
 * generados de Supabase no la incluyen hasta que Lovable los regenere, por eso
 * el nombre de tabla se castea aquí, aislado. La forma de fila sí está tipada.
 */

export type SettingsSection =
  | "horarios"
  | "citas"
  | "recordatorios"
  | "formularios"
  | "checklists"
  | "facturacion"
  | "pagos"
  | "auditoria"
  | "permisos"
  | "caja"
  | "email";

// La tabla aún no está en los tipos generados; acceso casteado y aislado aquí.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const settingsTable = (): any =>
  (supabase as unknown as { from: (t: string) => any }).from("clinic_settings");

/** Lee el blob de una sección. Devuelve null si no existe todavía. */
export async function getSection<T = Record<string, unknown>>(
  clinicId: string,
  section: SettingsSection,
): Promise<T | null> {
  const { data, error } = await settingsTable()
    .select("data")
    .eq("clinic_id", clinicId)
    .eq("section", section)
    .maybeSingle();

  if (error) {
    throw new Error(friendlyError(error, `No se pudo leer la sección "${section}".`));
  }
  return ((data as { data?: T } | null)?.data ?? null) as T | null;
}

/** Guarda (upsert) el blob de una sección. */
export async function saveSection<T>(
  clinicId: string,
  section: SettingsSection,
  data: T,
): Promise<void> {
  const { error } = await settingsTable().upsert(
    { clinic_id: clinicId, section, data },
    { onConflict: "clinic_id,section" },
  );

  if (error) {
    throw new Error(friendlyError(error, `No se pudo guardar la sección "${section}".`));
  }
}
