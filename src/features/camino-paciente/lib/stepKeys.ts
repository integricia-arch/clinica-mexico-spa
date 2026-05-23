// Claves internas fijas de etapas críticas del flujo médico/legal.
// step_key NUNCA debe cambiar (la BD lo refuerza con un trigger).
// El nombre visible (step_name) SÍ puede editarse.

export const CRITICAL_STEP_KEYS = [
  "identification",
  "consent",
  "record",
  "consultation",
  "diagnosis",
  "prescription",
  "billing",
  "followup",
  "discharge",
  "audit",
] as const;

export type CriticalStepKey = (typeof CRITICAL_STEP_KEYS)[number];

export const STEP_KEY_LABELS: Record<string, string> = {
  identification: "Identificación del paciente",
  consent: "Aviso de privacidad / consentimiento",
  record: "Expediente clínico",
  consultation: "Consulta médica",
  diagnosis: "Diagnóstico / valoración",
  prescription: "Receta / indicaciones",
  billing: "Cobro / facturación",
  followup: "Seguimiento",
  discharge: "Alta / cierre",
  audit: "Auditoría",
};

export const STEP_TYPE_LABELS = {
  administrativa: "Administrativa",
  clinica: "Clínica",
  legal: "Legal",
  farmacia: "Farmacia",
  facturacion: "Facturación",
  seguimiento: "Seguimiento",
  auditoria: "Auditoría",
} as const;

export const TEMPLATE_TYPE_LABELS = {
  consulta_general: "Consulta general",
  consulta_seguimiento: "Consulta de seguimiento",
  urgencia: "Urgencia",
  procedimiento_menor: "Procedimiento menor",
  laboratorio: "Laboratorio / análisis",
  farmacia: "Farmacia únicamente",
  teleconsulta: "Teleconsulta",
  alta_administrativa: "Alta administrativa",
} as const;

export const FIELD_TYPE_LABELS = {
  texto_corto: "Texto corto",
  texto_largo: "Texto largo",
  numero: "Número",
  fecha: "Fecha",
  fecha_hora: "Fecha y hora",
  seleccion_unica: "Selección única",
  seleccion_multiple: "Selección múltiple",
  si_no: "Sí / No",
  archivo: "Archivo",
  firma: "Firma",
  usuario_responsable: "Usuario responsable",
  medicamento: "Medicamento",
  diagnostico: "Diagnóstico",
  servicio: "Servicio",
  metodo_pago: "Método de pago",
  resultado_laboratorio: "Resultado de laboratorio",
  signos_vitales: "Signos vitales",
  checklist: "Checklist",
} as const;

export const APP_ROLES = ["admin", "doctor", "nurse", "receptionist", "patient"] as const;
export type AppRole = (typeof APP_ROLES)[number];
