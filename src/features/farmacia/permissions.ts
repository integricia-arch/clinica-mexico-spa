import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * Permisos del POS de farmacia centralizados.
 * Mapeo de roles:
 *   - cajero  → receptionist | nurse
 *   - gerente → manager | admin
 *   - admin   → admin
 */
const has = (roles: AppRole[], r: AppRole) => roles.includes(r);

export const posPermissions = (roles: AppRole[]) => {
  const isAdmin = has(roles, "admin");
  const isManager = isAdmin || has(roles, "manager");
  const isCashier = isManager || has(roles, "receptionist") || has(roles, "nurse");

  return {
    isAdmin,
    isManager,
    isCashier,
    canPosView: isCashier,
    canPosSell: isCashier,
    canPosDispensePrescription: isCashier,
    canPosDiscount: isManager,
    canPosCancelPaid: isManager,
    canPosOverrideLot: isManager,
    canPosViewDailyCut: isManager,
    canPosAuditView: isManager,
  };
};

export type Med = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  precio_unitario: number;
  activo: boolean;
  sale_type: string | null;
  is_controlled: boolean | null;
  requires_prescription: boolean | null;
  allow_direct_sale: boolean | null;
  descripcion?: string | null;
  barcode?: string | null;
  sku?: string | null;
  codigo_interno?: string | null;
  laboratorio?: string | null;
  principio_activo?: string | null;
  forma_farmaceutica?: string | null;
  concentracion?: string | null;
  presentacion?: string | null;
  registro_sanitario?: string | null;
};

/**
 * Devuelve null si se puede vender directamente, o el mensaje regulatorio exacto.
 */
export function blockReasonForDirectSale(m: Med): string | null {
  if (m.is_controlled || m.sale_type === "controlado") {
    return "Medicamento sujeto a control sanitario. Requiere validación regulatoria y receta correspondiente.";
  }
  if (m.sale_type === "receta_retenida") {
    return "Este medicamento requiere receta retenida. No puede venderse como venta directa.";
  }
  if (m.requires_prescription || m.allow_direct_sale === false || m.sale_type === "receta_requerida") {
    return "Este medicamento requiere receta médica para su venta.";
  }
  return null;
}

/**
 * Detecta si el texto escaneado es una receta (folio RX-*, UUID con verificar-receta,
 * URL del sistema o payload qr_code_value con pipes).
 */
export function isPrescriptionScan(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/verificar-receta\//i.test(t)) return true;
  if (t.includes("|") && /^RX[-_]/i.test(t.split("|")[0].trim())) return true;
  if (/^RX[-_][\dA-Z-]+$/i.test(t)) return true;
  return false;
}
