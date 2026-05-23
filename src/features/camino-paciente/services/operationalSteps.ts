// Definición canónica de los 13 hitos operativos del Camino del Paciente.
// Estos se materializan en journey_instance_steps al crear la instancia.

export interface OperationalStepDef {
  key: string;
  name: string;
  order: number;
  required: boolean;
  requiresAssignment?: boolean;
  closeRoles: string[]; // roles autorizados a cerrar
}

export const OPERATIONAL_STEPS: OperationalStepDef[] = [
  { key: "arrival",           name: "Llegada / recepción",            order: 10, required: true,  closeRoles: ["admin","receptionist"] },
  { key: "assignment",        name: "Asignación de doctor y consultorio", order: 20, required: true,  closeRoles: ["admin","receptionist"] },
  { key: "attention_open",    name: "Apertura de atención",           order: 30, required: true,  closeRoles: ["admin","receptionist","nurse"] },
  { key: "identification",    name: "Identificación y consentimiento", order: 40, required: true,  closeRoles: ["admin","receptionist","nurse"] },
  { key: "record",            name: "Expediente / antecedentes",      order: 50, required: true,  closeRoles: ["admin","doctor","nurse"] },
  { key: "triage",            name: "Triage / signos vitales",        order: 60, required: false, closeRoles: ["admin","nurse","doctor"] },
  { key: "consultation_open", name: "Apertura de consulta médica",    order: 70, required: true,  closeRoles: ["admin","doctor"] },
  { key: "consultation_close",name: "Cierre de consulta médica",      order: 80, required: true,  closeRoles: ["admin","doctor"] },
  { key: "prescription",      name: "Receta electrónica",             order: 90, required: false, closeRoles: ["admin","doctor"] },
  { key: "pharmacy",          name: "Farmacia / entrega",             order: 100, required: false, closeRoles: ["admin","nurse","receptionist"] },
  { key: "billing",           name: "Pago / facturación",             order: 110, required: false, closeRoles: ["admin","receptionist"] },
  { key: "discharge",         name: "Salida / alta",                  order: 120, required: true,  closeRoles: ["admin","receptionist","doctor"] },
  { key: "followup",          name: "Post-consulta / seguimiento",    order: 130, required: false, closeRoles: ["admin","doctor","nurse","receptionist"] },
];

export function getStepDef(key: string): OperationalStepDef | undefined {
  return OPERATIONAL_STEPS.find((s) => s.key === key);
}

export function getNextStepKey(current: string): string | null {
  const idx = OPERATIONAL_STEPS.findIndex((s) => s.key === current);
  if (idx < 0 || idx === OPERATIONAL_STEPS.length - 1) return null;
  return OPERATIONAL_STEPS[idx + 1].key;
}

export function getPreviousStepKey(current: string): string | null {
  const idx = OPERATIONAL_STEPS.findIndex((s) => s.key === current);
  if (idx <= 0) return null;
  return OPERATIONAL_STEPS[idx - 1].key;
}
