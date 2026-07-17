import { type BusySlot } from "./google-calendar.ts";

interface ClinicSchedule {
  dias_laborales: number[];
  hora_apertura: string;
  hora_cierre: string;
}

interface MemoriaPaciente {
  resumen: string;
  preferencias: {
    especialidad_favorita?: string;
    doctor_favorito_nombre?: string;
  };
  datos_clinicos: {
    condiciones_cronicas?: string;
  };
  historial: {
    ultima_cita_servicio?: string;
    veces_agendado: number;
    ultima_interaccion: string;
  };
  meta: {
    interacciones: number;
    updated_at: string;
  };
}

const MEMORIA_DEFAULT: MemoriaPaciente = {
  resumen: "",
  preferencias: {},
  datos_clinicos: {},
  historial: { veces_agendado: 0, ultima_interaccion: new Date().toISOString() },
  meta: { interacciones: 0, updated_at: new Date().toISOString() },
};

const SCHEDULE_DEFAULT: ClinicSchedule = {
  dias_laborales: [1, 2, 3, 4, 5],
  hora_apertura: "09:00",
  hora_cierre: "18:00",
};

async function getClinicSchedule(): Promise<ClinicSchedule> {
  if (!CLINIC_ID) return SCHEDULE_DEFAULT;
  try {
    const { data } = await supabase
      .from("clinic_settings")
      .select("data")
      .eq("clinic_id", CLINIC_ID)
      .eq("section", "horario")
      .maybeSingle();
    if (!data?.data) return SCHEDULE_DEFAULT;
    const d = data.data as Partial<ClinicSchedule>;
    return {
      dias_laborales: d.dias_laborales ?? SCHEDULE_DEFAULT.dias_laborales,
      hora_apertura: d.hora_apertura ?? SCHEDULE_DEFAULT.hora_apertura,
      hora_cierre: d.hora_cierre ?? SCHEDULE_DEFAULT.hora_cierre,
    };
  } catch {
    return SCHEDULE_DEFAULT;
  }
}

async function buscarFaqTelegram(pregunta: string): Promise<string | null> {
  if (!CLINIC_ID) return null;
  try {
    const { data, error } = await supabase.rpc("faq_buscar", {
      p_pregunta: pregunta,
      p_clinic_id: CLINIC_ID,
      p_ruta: null,
    } as never);
    if (error || !data || (data as { id: string; respuesta: string; uso_count: number }[]).length === 0) return null;
    const match = (data as { id: string; respuesta: string; uso_count: number }[])[0];
    return match.respuesta ?? null;
  } catch {
    return null;
  }
}

// ============================================================
// TIER 2: HAIKU INTENT CLASSIFIER
// ============================================================

const PADECIMIENTO_MAP: { regex: RegExp; especialidades: string[] }[] = [
  { regex: /cabeza|migraña|jaqueca|mareo|vértigo|cefalea/i, especialidades: ["Medicina general", "Neurología"] },
  { regex: /corazón|pecho|presión|hipertensión|taquicardia|arritmia|cardiovascular/i, especialidades: ["Cardiología"] },
  { regex: /piel|acné|mancha|dermatitis|lunar|erupción|urticaria|sarpullido/i, especialidades: ["Dermatología"] },
  { regex: /niño|bebé|pediatr|fiebre.*niño|hijo.*fiebre/i, especialidades: ["Pediatría"] },
  { regex: /diente|muela|encía|caries|dental|boca|dentista/i, especialidades: ["Odontología"] },
  { regex: /embaraz|menstrua|ginecolog|ovario|útero|vaginal|pap|anticonceptiv/i, especialidades: ["Ginecología"] },
  { regex: /peso|nutrición|dieta|obesidad|colesterol|triglicérid|sobrepeso/i, especialidades: ["Nutrición"] },
  { regex: /ansied|depresión|estrés|insomnio|psicolog|ánimo|tristeza|pánico|ansiedad/i, especialidades: ["Psicología"] },
  { regex: /análisis|laboratorio|estudio|sangre.*exam|examen.*sangre|prueba.*sangre/i, especialidades: ["Estudios y Laboratorio"] },
  { regex: /espalda|columna|rodilla|hueso|articulación|fractura|ortoped|cadera/i, especialidades: ["Medicina general"] },
  { regex: /garganta|tos|gripe|resfriado|fiebre|catarro|moco|nariz.*tapada/i, especialidades: ["Medicina general"] },
  { regex: /estómago|abdomen|gastritis|colitis|diarrea|estreñimiento|digestiv|vómito/i, especialidades: ["Medicina general"] },
];

function espToKey(esp: string): string {
  const MAP: Record<string, string> = {
    "Medicina general": "medgen",
    "Odontología": "odo",
    "Dermatología": "derm",
    "Pediatría": "ped",
    "Ginecología": "gine",
    "Cardiología": "card",
    "Nutrición": "nut",
    "Psicología": "psi",
    "Estudios y Laboratorio": "lab",
    "Neurología": "medgen",
  };
  return MAP[esp] ?? "medgen";
}

export type { ClinicSchedule, MemoriaPaciente, BotIntent, TipoUrgencia, BusySlot };
export { MEMORIA_DEFAULT, SCHEDULE_DEFAULT, CATEGORIAS, PADECIMIENTO_MAP };
