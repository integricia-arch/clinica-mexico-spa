// Cálculo de slots libres considerando horario del doctor y citas existentes.
// 100% client-side, ligero. La validación dura ocurre vía RLS + exclusion
// constraints de appointments al insertar.

export interface DoctorWindow {
  horario_inicio: string; // "HH:MM[:SS]"
  horario_fin: string;
}

export interface BusyRange {
  fecha_inicio: string; // ISO
  fecha_fin: string;
}

const MX_TZ = "America/Mexico_City";

function isoLocalMx(d: Date) {
  return d.toLocaleString("es-MX", {
    timeZone: MX_TZ,
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Genera slots de `durationMin` para un día (YYYY-MM-DD en hora MX)
 * dado el horario del doctor y rangos ocupados (doctor + consultorio).
 */
export function generateDaySlots(opts: {
  dateYmd: string;            // "2026-05-30"
  durationMin: number;
  doctor: DoctorWindow;
  busy: BusyRange[];          // mezcla de citas del doctor y del consultorio
  stepMin?: number;           // por defecto = durationMin
}): { iso: string; label: string }[] {
  const step = opts.stepMin ?? opts.durationMin;
  const [sh, sm] = opts.doctor.horario_inicio.split(":").map(Number);
  const [eh, em] = opts.doctor.horario_fin.split(":").map(Number);
  // Construimos en zona MX (offset fijo -06:00, MX no usa DST desde 2022)
  const tzOffset = "-06:00";
  const dayStart = new Date(`${opts.dateYmd}T${pad(sh)}:${pad(sm)}:00${tzOffset}`);
  const dayEnd   = new Date(`${opts.dateYmd}T${pad(eh)}:${pad(em)}:00${tzOffset}`);
  const now = new Date();

  const out: { iso: string; label: string }[] = [];
  for (let t = dayStart.getTime(); t + opts.durationMin * 60000 <= dayEnd.getTime(); t += step * 60000) {
    const ini = new Date(t);
    const fin = new Date(t + opts.durationMin * 60000);
    if (ini < now) continue;
    const overlap = opts.busy.some((b) =>
      new Date(b.fecha_inicio) < fin && new Date(b.fecha_fin) > ini
    );
    if (overlap) continue;
    out.push({ iso: ini.toISOString(), label: isoLocalMx(ini) });
  }
  return out;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

export function formatMx(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: MX_TZ,
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit",
  });
}
