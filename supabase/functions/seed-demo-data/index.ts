import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Require authenticated admin caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller has admin role
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Acceso denegado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if seed data already exists
    const { count } = await supabase.from("patients").select("id", { count: "exact", head: true });
    if (count && count > 0) {
      return new Response(JSON.stringify({ message: "Los datos demo ya existen" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create demo users via admin API
    const demoUsers = [
      { email: "admin@clinicamx.demo", password: "Demo1234!", role: "admin" as const },
      { email: "recepcion@clinicamx.demo", password: "Demo1234!", role: "receptionist" as const },
      { email: "dr.garcia@clinicamx.demo", password: "Demo1234!", role: "doctor" as const },
      { email: "dra.martinez@clinicamx.demo", password: "Demo1234!", role: "doctor" as const },
      { email: "dra.lopez@clinicamx.demo", password: "Demo1234!", role: "doctor" as const },
      { email: "enfermeria@clinicamx.demo", password: "Demo1234!", role: "nurse" as const },
      { email: "paciente1@clinicamx.demo", password: "Demo1234!", role: "patient" as const },
    ];

    const createdUsers: Record<string, string> = {};

    for (const u of demoUsers) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (error) {
        console.error(`Error creating user ${u.email}:`, error.message);
        continue;
      }
      createdUsers[u.email] = data.user.id;

      // Assign role
      await supabase.from("user_roles").insert({
        user_id: data.user.id,
        role: u.role,
      });
    }

    // Create doctors
    const doctorsData = [
      {
        user_id: createdUsers["dr.garcia@clinicamx.demo"],
        nombre: "Carlos",
        apellidos: "García Hernández",
        especialidad: "Medicina General",
        cedula_profesional: "12345678",
        telefono: "+52 55 1234 5678",
        horario_inicio: "08:00",
        horario_fin: "16:00",
        duracion_cita_min: 30,
      },
      {
        user_id: createdUsers["dra.martinez@clinicamx.demo"],
        nombre: "María Elena",
        apellidos: "Martínez Soto",
        especialidad: "Pediatría",
        cedula_profesional: "87654321",
        telefono: "+52 55 8765 4321",
        horario_inicio: "09:00",
        horario_fin: "17:00",
        duracion_cita_min: 30,
      },
      {
        user_id: createdUsers["dra.lopez@clinicamx.demo"],
        nombre: "Ana Lucía",
        apellidos: "López Vega",
        especialidad: "Dermatología",
        cedula_profesional: "11223344",
        telefono: "+52 55 2233 4455",
        horario_inicio: "10:00",
        horario_fin: "18:00",
        duracion_cita_min: 45,
      },
    ];

    const { data: doctors } = await supabase.from("doctors").insert(doctorsData).select();

    // Create rooms
    const roomsData = [
      { nombre: "Consultorio 1", piso: "PB", capacidad: 1, equipamiento: "Básico" },
      { nombre: "Consultorio 2", piso: "PB", capacidad: 1, equipamiento: "Básico" },
      { nombre: "Consultorio 3", piso: "1", capacidad: 1, equipamiento: "Dermatoscopio, lámpara de Wood" },
      { nombre: "Sala de curaciones", piso: "PB", capacidad: 2, equipamiento: "Material de curación, autoclave" },
    ];

    const { data: rooms } = await supabase.from("rooms").insert(roomsData).select();

    // Create patients
    const patientsData = [
      {
        user_id: createdUsers["paciente1@clinicamx.demo"] || null,
        nombre: "Juan Carlos",
        apellidos: "Rodríguez Pérez",
        fecha_nacimiento: "1985-03-15",
        sexo: "M",
        curp: "ROPJ850315HDFRDN08",
        rfc: "ROPJ850315AB1",
        telefono: "+52 55 9876 5432",
        email: "juancarlos.rp@gmail.com",
        direccion: "Av. Insurgentes Sur 1234, Col. Del Valle",
        colonia: "Del Valle",
        municipio: "Benito Juárez",
        estado: "CDMX",
        codigo_postal: "03100",
        contacto_emergencia_nombre: "María Pérez",
        contacto_emergencia_telefono: "+52 55 1111 2222",
        tipo_sangre: "O+",
        alergias: "Penicilina",
      },
      {
        nombre: "Guadalupe",
        apellidos: "Fernández Luna",
        fecha_nacimiento: "1990-07-22",
        sexo: "F",
        telefono: "+52 55 3344 5566",
        email: "lupita.fl@hotmail.com",
        direccion: "Calle Revolución 567, Col. Mixcoac",
        colonia: "Mixcoac",
        municipio: "Benito Juárez",
        estado: "CDMX",
        codigo_postal: "03910",
        contacto_emergencia_nombre: "Pedro Fernández",
        contacto_emergencia_telefono: "+52 55 3333 4444",
        tipo_sangre: "A+",
      },
      {
        nombre: "Roberto",
        apellidos: "Sánchez Morales",
        fecha_nacimiento: "1978-11-03",
        sexo: "M",
        telefono: "+52 55 7788 9900",
        email: "roberto.sm@outlook.com",
        direccion: "Blvd. Ávila Camacho 890, Col. Polanco",
        colonia: "Polanco",
        municipio: "Miguel Hidalgo",
        estado: "CDMX",
        codigo_postal: "11560",
        tipo_sangre: "B+",
        alergias: "Sulfonamidas, mariscos",
      },
      {
        nombre: "María del Carmen",
        apellidos: "Torres Gutiérrez",
        fecha_nacimiento: "1995-01-28",
        sexo: "F",
        telefono: "+52 55 6677 8899",
        email: "carmen.tg@gmail.com",
        direccion: "Calz. de Tlalpan 2345, Col. Portales",
        colonia: "Portales",
        municipio: "Benito Juárez",
        estado: "CDMX",
        codigo_postal: "03300",
        tipo_sangre: "AB+",
      },
      {
        nombre: "José Antonio",
        apellidos: "Díaz Ramírez",
        fecha_nacimiento: "1962-09-10",
        sexo: "M",
        telefono: "+52 55 4455 6677",
        direccion: "Av. Universidad 678, Col. Narvarte",
        colonia: "Narvarte",
        municipio: "Benito Juárez",
        estado: "CDMX",
        codigo_postal: "03020",
        tipo_sangre: "O-",
        alergias: "Aspirina",
        notas: "Paciente diabético tipo 2, hipertenso. Control mensual.",
      },
    ];

    const { data: patients } = await supabase.from("patients").insert(patientsData).select();

    // Create appointments for today and coming days
    if (doctors && patients && rooms) {
      const today = new Date();
      const appointmentsData = [];

      for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
        const day = new Date(today);
        day.setDate(today.getDate() + dayOffset);
        if (day.getDay() === 0) continue; // Skip Sunday

        const statuses: Array<any> = [
          "confirmada", "solicitada", "tentativa", "confirmada_paciente", "pendiente_formulario",
        ];

        for (let slotIdx = 0; slotIdx < Math.min(patients.length, 3); slotIdx++) {
          const hour = 9 + slotIdx * 2;
          const start = new Date(day);
          start.setHours(hour, 0, 0, 0);
          const end = new Date(day);
          end.setHours(hour, 30, 0, 0);

          const doctorIdx = slotIdx % doctors.length;
          const patientIdx = (slotIdx + dayOffset) % patients.length;

          appointmentsData.push({
            patient_id: patients[patientIdx].id,
            doctor_id: doctors[doctorIdx].id,
            room_id: rooms[slotIdx % rooms.length].id,
            fecha_inicio: start.toISOString(),
            fecha_fin: end.toISOString(),
            status: statuses[(slotIdx + dayOffset) % statuses.length],
            motivo_consulta: [
              "Revisión general",
              "Dolor de cabeza recurrente",
              "Control de diabetes",
              "Evaluación dermatológica",
              "Seguimiento postoperatorio",
            ][(slotIdx + dayOffset) % 5],
          });
        }
      }

      await supabase.from("appointments").insert(appointmentsData);
    }

    return new Response(
      JSON.stringify({
        message: "Datos demo creados exitosamente",
        credenciales: {
          admin: "admin@clinicamx.demo / Demo1234!",
          recepcion: "recepcion@clinicamx.demo / Demo1234!",
          medico: "dr.garcia@clinicamx.demo / Demo1234!",
          enfermeria: "enfermeria@clinicamx.demo / Demo1234!",
          paciente: "paciente1@clinicamx.demo / Demo1234!",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Seed error:", err);
    return new Response(
      JSON.stringify({ error: "Error al crear datos demo", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
