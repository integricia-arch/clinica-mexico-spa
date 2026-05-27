// Centralized error mapping: keep raw Supabase/Postgres errors out of UI toasts.
// Logs full detail to console for developers; returns a safe Spanish message for users.

type AnyError = {
  message?: string;
  code?: string | number;
  details?: string;
  hint?: string;
  status?: number;
} | null | undefined;

const CODE_MAP: Record<string, string> = {
  "23505": "Ya existe un registro con esos datos.",
  "23503": "No se puede completar la operación porque hay datos relacionados.",
  "23502": "Faltan datos obligatorios para completar la operación.",
  "23514": "Los datos no cumplen con las reglas requeridas.",
  "22P02": "Alguno de los datos tiene un formato inválido.",
  "42501": "No tienes permisos para realizar esta acción.",
  "PGRST301": "No tienes permisos para acceder a este recurso.",
  "PGRST116": "No se encontró el registro solicitado.",
};

export function friendlyError(err: AnyError, fallback = "Ocurrió un error. Por favor intenta de nuevo."): string {
  if (!err) return fallback;
  // Log raw details for developers only
  try { console.error("[error]", err); } catch { /* noop */ }

  const code = err.code != null ? String(err.code) : "";
  if (code && CODE_MAP[code]) return CODE_MAP[code];

  const msg = (err.message ?? "").toLowerCase();
  if (msg.includes("network") || msg.includes("fetch")) return "Problema de conexión. Verifica tu red e intenta de nuevo.";
  if (msg.includes("permission") || msg.includes("not allowed") || msg.includes("rls")) return "No tienes permisos para realizar esta acción.";
  if (msg.includes("duplicate")) return "Ya existe un registro con esos datos.";
  if (msg.includes("violates foreign key")) return "No se puede completar por datos relacionados.";
  if (msg.includes("invalid input")) return "Alguno de los datos tiene un formato inválido.";

  return fallback;
}
