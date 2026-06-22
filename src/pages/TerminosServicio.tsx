export default function TerminosServicio() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-3xl prose prose-sm">
        <h1 className="text-2xl font-bold text-foreground mb-2">Términos de Servicio</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Integriclinica · integrika.mx · En preparación
        </p>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-8 text-sm text-amber-800">
          <strong>Aviso:</strong> Los Términos de Servicio están siendo redactados por un especialista legal. Estarán
          disponibles próximamente. Si tienes preguntas, escríbenos a{" "}
          <a href="mailto:legal@integrika.mx" className="underline">
            legal@integrika.mx
          </a>
          .
        </div>

        <h2 className="text-lg font-semibold mt-6 mb-2">Uso del servicio</h2>
        <p>
          Integriclinica es una plataforma de gestión administrativa para clínicas médicas. No es un sistema de
          diagnóstico médico ni sustituye la atención de un profesional de la salud.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">Asistente virtual con IA</h2>
        <p>
          El asistente de citas opera mediante inteligencia artificial (IA). Sus respuestas son generadas
          automáticamente y no representan criterio médico. Ante cualquier duda de salud, consulte siempre a un médico
          certificado.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">Limitación de responsabilidad</h2>
        <p>
          La plataforma no es responsable por decisiones clínicas tomadas con base en información de la plataforma. El
          sistema es una herramienta de apoyo administrativo, no un dispositivo médico.
        </p>

        <p className="mt-8 text-xs text-muted-foreground">
          ⚠️ Documento en preparación — versión borrador sujeta a revisión legal.
        </p>
      </div>
    </div>
  );
}
