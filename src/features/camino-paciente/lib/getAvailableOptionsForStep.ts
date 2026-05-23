import type { AppRole } from "./stepKeys";

// Opciones permitidas por etapa. El editor las usa para limitar lo que
// se puede agregar como campo en cada etapa, evitando configuraciones
// peligrosas (p.ej. lote de medicamento en una etapa administrativa).

export interface StepOption {
  key: string;
  label: string;
  fieldType: string;
}

const OPTIONS_BY_STEP: Record<string, StepOption[]> = {
  identification: [
    { key: "tipo_visita", label: "Tipo de visita", fieldType: "seleccion_unica" },
    { key: "motivo_inicial", label: "Motivo inicial", fieldType: "texto_corto" },
    { key: "responsable_recepcion", label: "Responsable de recepción", fieldType: "usuario_responsable" },
    { key: "validacion_identidad", label: "Validación de identidad", fieldType: "si_no" },
    { key: "datos_contacto", label: "Datos de contacto", fieldType: "texto_corto" },
    { key: "estatus_llegada", label: "Estatus de llegada", fieldType: "seleccion_unica" },
  ],
  consent: [
    { key: "aviso_privacidad", label: "Aviso de privacidad", fieldType: "si_no" },
    { key: "consentimiento_informado", label: "Consentimiento informado", fieldType: "si_no" },
    { key: "firma", label: "Firma", fieldType: "firma" },
    { key: "documento_adjunto", label: "Documento adjunto", fieldType: "archivo" },
    { key: "testigo", label: "Testigo", fieldType: "texto_corto" },
    { key: "motivo_negativa", label: "Motivo de negativa", fieldType: "texto_largo" },
    { key: "override_urgencia", label: "Override por urgencia", fieldType: "si_no" },
  ],
  record: [
    { key: "antecedentes", label: "Antecedentes", fieldType: "texto_largo" },
    { key: "alergias", label: "Alergias", fieldType: "texto_corto" },
    { key: "padecimiento", label: "Padecimiento", fieldType: "texto_largo" },
  ],
  consultation: [
    { key: "motivo_consulta", label: "Motivo de consulta", fieldType: "texto_corto" },
    { key: "padecimiento_actual", label: "Padecimiento actual", fieldType: "texto_largo" },
    { key: "exploracion_fisica", label: "Exploración física", fieldType: "texto_largo" },
    { key: "impresion_diagnostica", label: "Impresión diagnóstica", fieldType: "texto_corto" },
    { key: "diagnostico_cie10", label: "Diagnóstico CIE-10", fieldType: "diagnostico" },
    { key: "plan_medico", label: "Plan médico", fieldType: "texto_largo" },
    { key: "solicitar_analisis", label: "Solicitar análisis", fieldType: "si_no" },
    { key: "requiere_receta", label: "Requiere receta", fieldType: "si_no" },
    { key: "requiere_seguimiento", label: "Requiere seguimiento", fieldType: "si_no" },
    { key: "requiere_referencia", label: "Requiere referencia", fieldType: "si_no" },
  ],
  diagnosis: [
    { key: "diagnostico_principal", label: "Diagnóstico principal", fieldType: "diagnostico" },
    { key: "diagnosticos_secundarios", label: "Diagnósticos secundarios", fieldType: "seleccion_multiple" },
    { key: "severidad", label: "Severidad", fieldType: "seleccion_unica" },
  ],
  prescription: [
    { key: "medicamento", label: "Medicamento", fieldType: "medicamento" },
    { key: "dosis", label: "Dosis", fieldType: "texto_corto" },
    { key: "frecuencia", label: "Frecuencia", fieldType: "texto_corto" },
    { key: "duracion", label: "Duración", fieldType: "texto_corto" },
    { key: "via", label: "Vía", fieldType: "seleccion_unica" },
    { key: "alergias_confirmadas", label: "Alergias confirmadas", fieldType: "si_no" },
    { key: "interacciones", label: "Interacciones", fieldType: "texto_largo" },
    { key: "existencia", label: "Existencia", fieldType: "numero" },
    { key: "lote", label: "Lote", fieldType: "texto_corto" },
    { key: "caducidad", label: "Caducidad", fieldType: "fecha" },
    { key: "entregado", label: "Entregado", fieldType: "si_no" },
  ],
  billing: [
    { key: "servicio", label: "Servicio", fieldType: "servicio" },
    { key: "producto", label: "Producto", fieldType: "texto_corto" },
    { key: "metodo_pago", label: "Método de pago", fieldType: "metodo_pago" },
    { key: "estatus_pago", label: "Estatus de pago", fieldType: "seleccion_unica" },
    { key: "requiere_factura", label: "Requiere factura", fieldType: "si_no" },
    { key: "rfc", label: "RFC", fieldType: "texto_corto" },
    { key: "regimen_fiscal", label: "Régimen fiscal", fieldType: "seleccion_unica" },
    { key: "uso_cfdi", label: "Uso CFDI", fieldType: "seleccion_unica" },
    { key: "cfdi_generado", label: "CFDI generado", fieldType: "si_no" },
    { key: "descuento_autorizado", label: "Descuento autorizado", fieldType: "si_no" },
  ],
  followup: [
    { key: "canal_seguimiento", label: "Canal de seguimiento", fieldType: "seleccion_unica" },
    { key: "fecha_seguimiento", label: "Fecha de seguimiento", fieldType: "fecha" },
    { key: "responsable_seguimiento", label: "Responsable", fieldType: "usuario_responsable" },
  ],
  discharge: [
    { key: "tipo_alta", label: "Tipo de alta", fieldType: "seleccion_unica" },
    { key: "resumen_clinico", label: "Resumen clínico", fieldType: "texto_largo" },
    { key: "indicaciones_finales", label: "Indicaciones finales", fieldType: "texto_largo" },
    { key: "seguimiento_requerido", label: "Seguimiento requerido", fieldType: "si_no" },
    { key: "medico_autoriza", label: "Médico que autoriza", fieldType: "usuario_responsable" },
    { key: "documentos_entregados", label: "Documentos entregados", fieldType: "checklist" },
    { key: "confirmacion_paciente", label: "Confirmación del paciente", fieldType: "firma" },
  ],
  audit: [
    { key: "evento", label: "Evento", fieldType: "texto_corto" },
    { key: "responsable", label: "Responsable", fieldType: "usuario_responsable" },
  ],
};

export function getAvailableOptionsForStep(
  stepKey: string,
  _stepType?: string,
  _templateId?: string,
  _role?: AppRole,
): StepOption[] {
  return OPTIONS_BY_STEP[stepKey] ?? [];
}
