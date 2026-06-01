import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("CORS_ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AppointmentRequest {
  patient_id: string;
  doctor_id: string;
  room_id?: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo_consulta?: string;
  notas?: string;
  recursos?: { tipo_recurso: string; descripcion?: string }[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Verify JWT first with anon key — service client only after auth passes
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Check role: only admin, receptionist, or patient can create
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = userRoles?.map((r: any) => r.role) ?? [];
    const canCreate = roles.some((r: string) =>
      ["admin", "receptionist", "patient"].includes(r)
    );
    if (!canCreate) {
      return new Response(JSON.stringify({ error: "Sin permisos para agendar citas" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: AppointmentRequest = await req.json();

    // Validate required fields
    if (!body.patient_id || !body.doctor_id || !body.fecha_inicio || !body.fecha_fin) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: patient_id, doctor_id, fecha_inicio, fecha_fin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enforce patient ownership: a patient can only book for themselves.
    const isStaff = roles.some((r: string) => ["admin", "receptionist"].includes(r));
    if (!isStaff) {
      const { data: ownPatient } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!ownPatient || ownPatient.id !== body.patient_id) {
        return new Response(
          JSON.stringify({ error: "Solo puedes agendar citas para tu propio perfil" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }


    const inicio = new Date(body.fecha_inicio);
    const fin = new Date(body.fecha_fin);

    if (fin <= inicio) {
      return new Response(
        JSON.stringify({ error: "La fecha de fin debe ser posterior a la fecha de inicio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Duration check (max 4 hours)
    const durationMin = (fin.getTime() - inicio.getTime()) / 60000;
    if (durationMin > 240) {
      return new Response(
        JSON.stringify({ error: "La duración máxima de una cita es de 4 horas" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Check doctor availability
    const { data: doctorConflicts } = await supabase
      .from("appointments")
      .select("id")
      .eq("doctor_id", body.doctor_id)
      .not("status", "in", '("cancelada","liberada")')
      .lt("fecha_inicio", body.fecha_fin)
      .gt("fecha_fin", body.fecha_inicio);

    if (doctorConflicts && doctorConflicts.length > 0) {
      return new Response(
        JSON.stringify({ error: "El médico ya tiene una cita en ese horario" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check room availability (if room specified)
    if (body.room_id) {
      const { data: roomConflicts } = await supabase
        .from("appointments")
        .select("id")
        .eq("room_id", body.room_id)
        .not("status", "in", '("cancelada","liberada")')
        .lt("fecha_inicio", body.fecha_fin)
        .gt("fecha_fin", body.fecha_inicio);

      if (roomConflicts && roomConflicts.length > 0) {
        return new Response(
          JSON.stringify({ error: "El consultorio ya está ocupado en ese horario" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Check doctor schedule bounds
    const { data: doctor } = await supabase
      .from("doctors")
      .select("horario_inicio, horario_fin, activo")
      .eq("id", body.doctor_id)
      .single();

    if (!doctor || !doctor.activo) {
      return new Response(
        JSON.stringify({ error: "El médico no está activo o no existe" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Create appointment
    const { data: appointment, error: insertError } = await supabase
      .from("appointments")
      .insert({
        patient_id: body.patient_id,
        doctor_id: body.doctor_id,
        room_id: body.room_id || null,
        fecha_inicio: body.fecha_inicio,
        fecha_fin: body.fecha_fin,
        motivo_consulta: body.motivo_consulta || null,
        notas: body.notas || null,
        created_by: user.id,
        status: "solicitada",
      })
      .select()
      .single();

    if (insertError) {
      console.error("create-appointment insert error:", insertError.code, insertError.message);
      const msg = insertError.code === "23P01"
        ? "El horario solicitado ya fue reservado. Elige otro horario."
        : "No se pudo crear la cita. Intenta de nuevo.";
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Add resources if any
    if (body.recursos && body.recursos.length > 0) {
      await supabase.from("appointment_resources").insert(
        body.recursos.map((r) => ({
          appointment_id: appointment.id,
          tipo_recurso: r.tipo_recurso,
          descripcion: r.descripcion || null,
        }))
      );
    }

    // 6. Audit log
    await supabase.rpc("log_audit", {
      _accion: "crear",
      _tabla: "appointments",
      _registro_id: appointment.id,
      _datos_nuevos: appointment as any,
    });

    // 7. Create reminder (24h before)
    const reminderTime = new Date(inicio.getTime() - 24 * 60 * 60 * 1000);
    if (reminderTime > new Date()) {
      await supabase.from("recordatorios_cita").insert({
        appointment_id: appointment.id,
        tipo: "t24h",
        mensaje: `Recordatorio: tiene una cita programada para el ${inicio.toLocaleDateString("es-MX")} a las ${inicio.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`,
        programado_para: reminderTime.toISOString(),
      });
    }

    return new Response(JSON.stringify({ data: appointment }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
