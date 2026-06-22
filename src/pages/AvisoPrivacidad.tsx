export default function AvisoPrivacidad() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-3xl prose prose-sm">
        <h1 className="text-2xl font-bold text-foreground mb-2">Aviso de Privacidad</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Integriclinica · integrika.mx · Versión 1.0 (borrador) · Conforme a LFPDPPP (DOF 20-mar-2025)
        </p>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-8 text-sm text-amber-800">
          <strong>Aviso temporal:</strong> Este documento está en proceso de redacción por un especialista en protección
          de datos personales conforme a la LFPDPPP vigente (publicada DOF 20 de marzo de 2025). Mientras tanto, la
          plataforma aplica las medidas técnicas de seguridad descritas a continuación. Si tienes preguntas sobre tus
          datos, escríbenos a{" "}
          <a href="mailto:privacidad@integrika.mx" className="underline">
            privacidad@integrika.mx
          </a>
          .
        </div>

        <h2 className="text-lg font-semibold mt-6 mb-2">I. Responsable del tratamiento</h2>
        <p>
          [Nombre legal de la empresa, RFC y domicilio fiscal — pendiente validación legal]. Contacto de privacidad:{" "}
          <a href="mailto:privacidad@integrika.mx" className="underline">
            privacidad@integrika.mx
          </a>
          .
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">II. Datos personales que recabamos</h2>
        <p>
          Recabamos y tratamos los siguientes datos personales, incluyendo <strong>datos sensibles</strong> en los
          términos del Art. 3 fracc. VI LFPDPPP:
        </p>
        <ul>
          <li>
            <strong>Identificación:</strong> nombre, apellidos, fecha de nacimiento, sexo, CURP, RFC, teléfono, correo
            electrónico, domicilio.
          </li>
          <li>
            <strong>Datos sensibles de salud (Art. 9 LFPDPPP — requieren consentimiento expreso):</strong> tipo de
            sangre, alergias conocidas, diagnósticos médicos, medicamentos prescritos, historial de citas y recetas
            médicas.
          </li>
          <li>
            <strong>Contacto digital:</strong> identificador de Telegram (solo si activa el servicio de bot), dirección
            IP de acceso a la plataforma.
          </li>
          <li>
            <strong>Contacto de emergencia:</strong> nombre y teléfono del contacto de emergencia que usted proporciona.
          </li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2">III. Finalidades del tratamiento</h2>
        <p>
          <strong>Finalidades necesarias</strong> (base legal: prestación del servicio y obligación legal — no requieren
          consentimiento adicional):
        </p>
        <ul>
          <li>Gestión de citas médicas y expediente clínico.</li>
          <li>Comunicación sobre su atención médica.</li>
          <li>Facturación y gestión de pagos.</li>
          <li>Cumplimiento de obligaciones legales (NOM-004, Ley General de Salud, SAT).</li>
        </ul>
        <p>
          <strong>Finalidades voluntarias</strong> (puede oponerse sin que cese el servicio principal):
        </p>
        <ul>
          <li>Análisis estadístico anonimizado para mejora de la plataforma.</li>
          <li>Comunicaciones informativas y de seguimiento post-consulta.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2">IV. Transferencias a terceros</h2>
        <p>
          Sus datos son procesados por proveedores tecnológicos que actúan como <strong>encargados</strong> bajo
          acuerdos de confidencialidad:
        </p>
        <ul>
          <li>
            <strong>Supabase Inc.</strong> (EE.UU.) — almacenamiento de base de datos cifrada.
          </li>
          <li>
            <strong>Cloudflare Inc.</strong> (EE.UU.) — entrega de contenido y protección de red.
          </li>
          <li>
            <strong>Telegram Messenger</strong> — comunicación vía bot de citas, <em>solo si usted lo activa</em>;
            Telegram opera bajo sus propios términos de privacidad.
          </li>
          <li>
            <strong>Anthropic PBC</strong> (EE.UU.) — procesamiento de lenguaje natural para el asistente virtual,{" "}
            <em>solo para mensajes enviados al bot</em>.
          </li>
        </ul>
        <p>
          No vendemos ni compartimos datos personales con terceros con fines comerciales propios.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">V. Decisiones automatizadas e inteligencia artificial</h2>
        <p>
          La plataforma utiliza sistemas de <strong>inteligencia artificial</strong> para las siguientes funciones
          automatizadas (conforme al Art. [pendiente] LFPDPPP 2025):
        </p>
        <ul>
          <li>
            <strong>Asistente virtual de citas (bot Telegram):</strong> clasifica automáticamente la intención del
            mensaje del usuario para responder preguntas frecuentes o escalar a personal humano. Las respuestas son
            generadas por IA y <em>no constituyen criterio médico</em>.
          </li>
          <li>
            <strong>Sugerencias de horario:</strong> el sistema filtra automáticamente horarios disponibles de médicos
            con base en la especialidad solicitada.
          </li>
        </ul>
        <p>
          Ninguna de estas funciones toma decisiones médicas ni tiene efectos jurídicos sobre su persona. Usted puede{" "}
          <strong>oponerse</strong> al uso del asistente virtual escribiendo a{" "}
          <a href="mailto:privacidad@integrika.mx" className="underline">
            privacidad@integrika.mx
          </a>{" "}
          o simplemente no activando el canal de Telegram.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">VI. Derechos ARCO y oposición</h2>
        <p>
          Usted tiene derecho de <strong>Acceso, Rectificación, Cancelación u Oposición</strong> (derechos ARCO) al
          tratamiento de sus datos personales, así como el derecho de oponerse a decisiones automatizadas. Para
          ejercerlos:
        </p>
        <ul>
          <li>
            Envíe solicitud a{" "}
            <a href="mailto:privacidad@integrika.mx" className="underline">
              privacidad@integrika.mx
            </a>{" "}
            con su nombre completo, descripción de la solicitud y copia de identificación oficial.
          </li>
          <li>Responderemos en un plazo máximo de <strong>20 días hábiles</strong>.</li>
          <li>Si la solicitud procede, la implementaremos en un plazo máximo de <strong>15 días hábiles</strong>.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2">VII. Medidas de seguridad</h2>
        <p>
          Los datos se almacenan con cifrado en tránsito (TLS 1.3) y en reposo. El acceso está restringido por roles y
          requiere autenticación multifactor. Aplicamos principios de mínimo privilegio sobre los datos de salud.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">VIII. Cambios a este aviso</h2>
        <p>
          Cualquier modificación se publicará en esta página con la nueva versión y fecha. Cambios que amplíen el
          tratamiento de datos sensibles requerirán nuevo consentimiento expreso.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">IX. Autoridad de protección de datos</h2>
        <p>
          Si considera que su solicitud no fue atendida correctamente, puede presentar queja ante la{" "}
          <strong>Secretaría de Anticorrupción y Buen Gobierno (SAyBG)</strong>, autoridad competente en materia de
          protección de datos personales conforme a la LFPDPPP vigente:{" "}
          <a
            href="https://www.gob.mx/anticorrupcion"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            www.gob.mx/anticorrupcion
          </a>
          .
        </p>

        <p className="mt-8 text-xs text-muted-foreground">
          ⚠️ Versión borrador — pendiente de revisión y aprobación final por especialista en LFPDPPP. No usar como
          aviso definitivo hasta validación legal. Versión 1.0 · Jun 2025.
        </p>
      </div>
    </div>
  );
}
