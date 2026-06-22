export default function AvisoPrivacidad() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-3xl prose prose-sm">
        <h1 className="text-2xl font-bold text-foreground mb-2">Aviso de Privacidad</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Integriclinica · integrika.mx · Última actualización: pendiente de redacción por especialista legal
        </p>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-8 text-sm text-amber-800">
          <strong>Aviso temporal:</strong> Este documento está en proceso de redacción por un especialista en protección
          de datos personales conforme a la LFPDPPP. Mientras tanto, la plataforma aplica las medidas técnicas de
          seguridad descritas a continuación. Si tienes preguntas sobre tus datos, escríbenos a{" "}
          <a href="mailto:privacidad@integrika.mx" className="underline">
            privacidad@integrika.mx
          </a>
          .
        </div>

        <h2 className="text-lg font-semibold mt-6 mb-2">Responsable del tratamiento</h2>
        <p>[Nombre legal de la empresa, domicilio fiscal — pendiente]</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">Datos personales que recabamos</h2>
        <p>Recabamos y tratamos los siguientes datos:</p>
        <ul>
          <li>
            <strong>Datos de identificación:</strong> nombre, apellidos, fecha de nacimiento, sexo, CURP, teléfono,
            correo electrónico.
          </li>
          <li>
            <strong>Datos de salud (datos sensibles):</strong> tipo de sangre, alergias conocidas, diagnósticos,
            medicamentos, historial de citas y recetas médicas.
          </li>
          <li>
            <strong>Datos de contacto digital:</strong> identificador de Telegram (si usa el bot), dirección IP de
            acceso.
          </li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2">Finalidades del tratamiento</h2>
        <ul>
          <li>Gestión de citas médicas y expediente clínico.</li>
          <li>Comunicación sobre su atención médica.</li>
          <li>Facturación y gestión de pagos.</li>
          <li>Mejora de los servicios de la plataforma (datos anonimizados).</li>
        </ul>

        <h2 className="text-lg font-semibold mt-6 mb-2">Transferencias a terceros</h2>
        <p>
          Sus datos son procesados por proveedores tecnológicos que actúan como encargados bajo acuerdos de
          confidencialidad: Supabase Inc. (almacenamiento de base de datos), Cloudflare Inc. (entrega de contenido), y
          Telegram Messenger (comunicación vía bot, solo si usted lo activa).
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">Derechos ARCO</h2>
        <p>
          Usted tiene derecho de Acceso, Rectificación, Cancelación u Oposición al tratamiento de sus datos personales.
          Para ejercerlos, envíe su solicitud a{" "}
          <a href="mailto:privacidad@integrika.mx" className="underline">
            privacidad@integrika.mx
          </a>{" "}
          con identificación oficial y descripción de su solicitud.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">Medidas de seguridad</h2>
        <p>
          Los datos se almacenan con cifrado en tránsito (TLS 1.3) y en reposo. El acceso está restringido por roles y
          requiere autenticación. Aplicamos principios de mínimo privilegio sobre los datos de salud.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">Cambios a este aviso</h2>
        <p>
          Cualquier modificación se publicará en esta misma página. El uso continuado de la plataforma tras la
          publicación del aviso actualizado implica aceptación.
        </p>

        <p className="mt-8 text-xs text-muted-foreground">
          ⚠️ Este aviso está pendiente de revisión y aprobación final por un especialista en LFPDPPP. Documento en
          versión borrador — no usar como aviso de privacidad definitivo hasta su validación legal.
        </p>
      </div>
    </div>
  );
}
