import { supabase } from "@/integrations/supabase/client";

/**
 * Acceso casteado a tablas que aún no están en los tipos generados de Supabase.
 * Lovable regenera `integrations/supabase/types.ts` tras aplicar la migración;
 * hasta entonces, `.from("<tabla nueva>")` no compila. Este helper aísla el
 * cast en un solo lugar — la forma de fila se sigue tipando en cada hook.
 *
 * Tablas que dependen de esto: checklists, insumos, proveedores, kits
 * (migración 20260605010000_checklists_and_inventario.sql).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const untypedTable = (name: string): any =>
  (supabase as unknown as { from: (t: string) => unknown }).from(name);
