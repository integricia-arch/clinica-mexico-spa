import { ListChecks, ShieldCheck } from "lucide-react";

/* ---------- Flujo completo del paciente ---------- */
export function FlujoPacientePanel() {
  const stages = [
    {
      num: 1, titulo: "Agenda", color: "bg-blue-100 text-blue-700",
      pasos: [
        "Paciente agenda cita por chat",
        "Sistema verifica: horario, doctor, servicio, consultorio",
        "Notifica a todos los participantes",
        "Solicita confirmación a cada uno",
        "Confirma y agenda cita",
        "Emite recordatorio al paciente",
      ],
    },
    {
      num: 2, titulo: "Llegada / Recepción", color: "bg-green-100 text-green-700",
      pasos: [
        "Paciente llega, recepción lo recibe",
        "Llena datos necesarios para consulta",
        "Enfermería: valoración de llegada (si aplica)",
        "Captura signos vitales y llenado de expediente",
        "Preparación del paciente",
      ],
    },
    {
      num: 3, titulo: "Consulta médica", color: "bg-purple-100 text-purple-700",
      pasos: [
        "Doctor recibe datos pre-capturados (bot / enfermera / panel)",
        "Inicia consulta",
        "Escribe observaciones en el sistema",
      ],
    },
    {
      num: 4, titulo: "Prescripción y referencia", color: "bg-orange-100 text-orange-700",
      pasos: [
        "Doctor determina si requiere análisis o radiografía",
        "Emite receta con pase al análisis (interno o externo)",
        "Sistema verifica existencia en almacén en tiempo real",
        "Paciente puede surtir en farmacia interna",
      ],
    },
    {
      num: 5, titulo: "Farmacia / POS", color: "bg-teal-100 text-teal-700",
      pasos: [
        "Paciente llega a farmacia",
        "Escanea QR de receta",
        "Sistema indica ubicación de medicamentos",
        "Farmacéutico cobra en POS",
        "Paciente selecciona método de pago",
      ],
    },
    {
      num: 6, titulo: "Facturación", color: "bg-yellow-100 text-yellow-700",
      pasos: [
        "Paciente solicita factura",
        "Sistema verifica si está registrado fiscalmente",
        "Escenario A (registrado): cobro + CFDI directo",
        "Escenario B1: envía CSF por chat → sistema lee XML → registra → factura",
        "Escenario B2: factura self-service vía QR + bot",
      ],
    },
    {
      num: 7, titulo: "Seguimiento / Alta", color: "bg-rose-100 text-rose-700",
      pasos: [
        "Paciente regresa con análisis / radiografías",
        "Doctor revisa resultados",
        "Doctor da indicaciones finales",
        "Si requiere seguimiento: nueva cita (misma lógica Etapa 1)",
        "Si no: cobro (si aplica) y alta",
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <h3 className="text-display font-semibold text-foreground mb-1">Flujo completo del paciente</h3>
        <p className="text-sm text-muted-foreground">
          Descripción operativa de las 7 etapas que cubre el sistema de extremo a extremo. Este flujo es la visión objetivo — su implementación es progresiva.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stages.map((s) => (
          <div key={s.num} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center gap-3 mb-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shrink-0 ${s.color}`}>
                {s.num}
              </div>
              <h4 className="text-sm font-semibold text-foreground">{s.titulo}</h4>
            </div>
            <ul className="space-y-1">
              {s.pasos.map((p, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="mt-0.5 shrink-0 opacity-50">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="h-5 w-5 text-primary" />
          <h3 className="text-display font-semibold">Objetivos del sistema</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            "Reducir tiempos de atención",
            "Evitar errores operativos",
            "Evitar malas consultas",
            "Prevenir demandas médicas",
            "Evitar pérdidas humanas o situaciones complejas",
            "Retroalimentación y mejora continua",
            "Cobertura 360° del flujo completo",
          ].map((obj) => (
            <div key={obj} className="flex items-center gap-2 text-sm text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              {obj}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-amber-600" />
          <h3 className="text-display font-semibold text-amber-900">Preguntas abiertas</h3>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-amber-900">CSF por chat</p>
            <p className="text-xs text-amber-700">¿Qué tan práctico y costoso es que un paciente no registrado envíe su CSF al chat, el sistema lo lea y registre los datos fiscales automáticamente?</p>
          </div>
          <div>
            <p className="text-sm font-medium text-amber-900">Digitalización de estudios</p>
            <p className="text-xs text-amber-700">¿Es viable digitalizar análisis y radiografías físicas para el expediente electrónico?</p>
          </div>
        </div>
      </div>
    </div>
  );
}
