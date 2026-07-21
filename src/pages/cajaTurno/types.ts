export interface Caja {
  id: string;
  nombre: string;
  fondo_default: number;
  es_farmacia: boolean;
}

export interface Turno {
  id: string;
  caja_id: string;
  clinic_id: string;
  estado: string;
  monto_apertura: number;
  abierto_at: string;
  pharmacy_shift_id: string | null;
}

export interface FondoMovimiento {
  id: string;
  tipo: "egreso" | "ingreso" | "cash_drop";
  monto: number;
  motivo: string;
  created_at: string;
}

export interface CorteRow {
  id: string;
  tipo: "Z" | "X";
  folio_secuencial: number | null;
  created_at: string;
  efectivo_esperado: number | null;
  conteo_ciego: number | null;
  diferencia: number | null;
  total_general: number;
  conteo_movimientos: number;
  requiere_autorizacion: boolean;
  turno_id: string;
}

export interface TurnoHistorial {
  id: string;
  caja_id: string;
  estado: string;
  monto_apertura: number;
  monto_cierre: number | null;
  abierto_at: string;
  cerrado_at: string | null;
  notas_cierre: string | null;
  cortes: CorteRow[];
}

export interface CloseResult {
  folio: number;
  corte_id: string;
  opening_amount: number;
  cash_total: number;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  supervisor_override: boolean;
}

export interface LinkAudit {
  id: string;
  turno_id: string;
  caja_id: string;
  pharmacy_shift_id: string | null;
  action: string;
  reason: string | null;
  created_at: string;
}
