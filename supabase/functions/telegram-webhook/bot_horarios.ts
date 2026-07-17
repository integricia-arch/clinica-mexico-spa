import { supabase } from "./bot_config.ts";
import { getFreeBusy, getDoctorCalendar, type BusySlot } from "./google-calendar.ts";
import { MX_TZ_OFFSET, MX_TZ_OFFSET_MS } from "./bot_config.ts";

async function getServiciosConDoctorActivo(): Promise<Set<string>> {
  const { data } = await supabase
    .from("doctor_servicios")
    .select("servicio_id, doctors!inner(activo)")
    .eq("doctors.activo", true);
  return new Set<string>((data ?? []).map((ds: any) => ds.servicio_id).filter(Boolean));
}

async function getCategoriasDisponibles(): Promise<Array<{ key: string; label: string }>> {
  const CATEGORIAS: Record<string, { label: string; especialidades: string[] }> = {
    medgen: { label: "Medicina general", especialidades: ["Medicina general"] },
  };
  const [validIds, svcResult] = await Promise.all([
    getServiciosConDoctorActivo(),
    supabase.from("servicios").select("id, especialidad").eq("activo", true),
  ]);
  const especialidades = new Set<string>(
    ((svcResult.data ?? []) as any[])
      .filter((s) => validIds.has(s.id) && s.especialidad)
      .map((s) => s.especialidad)
  );
  const result: Array<{ key: string; label: string }> = [];
  for (const [key, cat] of Object.entries(CATEGORIAS)) {
    if (cat.especialidades.some((esp) => especialidades.has(esp))) {
      result.push({ key, label: cat.label });
    }
  }
  return result;
}

async function listarHorariosDisponibles({ servicio_id, dias_adelante = 7, max_horarios = 8 }: any) {
  dias_adelante = Math.min(dias_adelante, 30);
  const MAX = Math.min(max_horarios, 300);
  const { data: ds, error: e1 } = await supabase
    .from("doctor_servicios")
    .select("doctor_id, doctor:doctors(id, nombre, apellidos, especialidad, horario_inicio, horario_fin, activo)")
    .eq("servicio_id", servicio_id);
  if (e1) return { error: e1.message };

  const doctores = (ds ?? []).filter((r: any) => r.doctor?.activo);
  if (doctores.length === 0) return { horarios: [] };

  const { data: svc, error: e2 } = await supabase.from("servicios").select("duracion_minutos").eq("id", servicio_id).single();
  if (e2) return { error: e2.message };
  const durMin: number = svc.duracion_minutos;

  const ahora = new Date();
  const finRango = new Date(ahora.getTime() + dias_adelante * 86400000);
  const docIds = doctores.map((d: any) => d.doctor_id);

  const { data: existentes } = await supabase
    .from("appointments").select("doctor_id, fecha_inicio, fecha_fin, status")
    .in("doctor_id", docIds).gte("fecha_inicio", ahora.toISOString()).lte("fecha_inicio", finRango.toISOString());

  const ocupadas = (existentes ?? []).filter((a: any) => !["cancelada", "liberada"].includes(String(a.status).toLowerCase()));

  const gcalBusy: Record<string, BusySlot[]> = {};
  const windowStart = ahora.toISOString();
  const windowEnd = finRango.toISOString();
  await Promise.all(doctores.map(async (ds: any) => {
    const cal = await getDoctorCalendar(ds.doctor_id);
    if (cal) gcalBusy[ds.doctor_id] = await getFreeBusy(cal, windowStart, windowEnd);
  }));

  const horarios: any[] = [];
  const ahoraMxMs = ahora.getTime() + MX_TZ_OFFSET_MS;

  for (let d = 0; d < dias_adelante && horarios.length < MAX; d++) {
    const diaMx = new Date(ahoraMxMs + d * 86400000);
    const yyyy = diaMx.getUTCFullYear();
    const mm = String(diaMx.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(diaMx.getUTCDate()).padStart(2, "0");

    for (const doc of doctores) {
      const [sh, sm] = doc.doctor.horario_inicio.split(":").map(Number);
      const [eh, em] = doc.doctor.horario_fin.split(":").map(Number);
      const hi = String(sh).padStart(2, "0") + ":" + String(sm).padStart(2, "0");
      const hf = String(eh).padStart(2, "0") + ":" + String(em).padStart(2, "0");
      const inicioDia = new Date(\\-\-\T\:00-06:00\);
      const finDia = new Date(\\-\-\T\:00-06:00\);

      for (let t = inicioDia.getTime(); t + durMin * 60000 <= finDia.getTime(); t += durMin * 60000) {
        const slotIni = new Date(t);
        const slotFin = new Date(t + durMin * 60000);
        if (slotIni < ahora) continue;
        const conflicto = ocupadas.find((a: any) =>
          a.doctor_id === doc.doctor_id && new Date(a.fecha_inicio) < slotFin && new Date(a.fecha_fin) > slotIni
        );
        if (conflicto) continue;
        const googleBusy = gcalBusy[doc.doctor_id] ?? [];
        const googleConflicto = googleBusy.some((b) => {
          const bs = new Date(b.start).getTime();
          const be = new Date(b.end).getTime();
          return slotIni.getTime() < be && slotFin.getTime() > bs;
        });
        if (googleConflicto) continue;
        horarios.push({
          doctor_id: doc.doctor_id,
          doctor_nombre: \Dr(a). \ \\,
          fecha_inicio: slotIni.toISOString(),
          fecha_local: slotIni.toLocaleString("es-MX", {
            timeZone: "America/Mexico_City", weekday: "short", day: "numeric", month: "short",
            hour: "2-digit", minute: "2-digit",
          }),
        });
        if (horarios.length >= MAX) break;
      }
      if (horarios.length >= MAX) break;
    }
  }
  return { horarios };
}

export { getServiciosConDoctorActivo, getCategoriasDisponibles, listarHorariosDisponibles };
