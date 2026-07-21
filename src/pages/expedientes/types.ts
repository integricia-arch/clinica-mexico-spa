export interface PersonaMini { id: string; nombre: string; apellidos: string; }
export interface DoctorMini extends PersonaMini { especialidad?: string; }
export interface PatientMini extends PersonaMini { tipo_sangre?: string | null; alergias?: string | null; }

export interface NotaConsulta {
  id: string;
  fecha_consulta: string;
  subjetivo?: string | null;
  objetivo?: string | null;
  analisis?: string | null;
  plan?: string | null;
  diagnostico_principal?: string | null;
  doctors?: { nombre: string; apellidos: string } | null;
}

export interface Expediente {
  id: string;
  patient_id: string;
  doctor_id: string;
  tipo: string;
  updated_at: string;
  patients?: PatientMini | null;
  doctors?: DoctorMini | null;
}

export interface ExpPermRow {
  id: string;
  expediente_id: string;
  doctor_id: string;
  permission: "view" | "edit";
  doctors?: { nombre: string; apellidos: string } | null;
}

export const TIPO_LABELS: Record<string, string> = {
  primera_vez: "Primera vez", seguimiento: "Seguimiento",
  urgencia: "Urgencia", cirugia: "Cirugía", cronico: "Crónico",
};
