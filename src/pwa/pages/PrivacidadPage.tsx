// src/pwa/pages/PrivacidadPage.tsx
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { motion } from 'motion/react'

export function PrivacidadPage() {
  const navigate = useNavigate()

  return (
    <div className="pb-24 px-4 pt-4 space-y-6 max-w-md mx-auto">
      <motion.button
        className="flex items-center gap-2 text-sm text-muted-foreground"
        onClick={() => navigate(-1)}
        whileTap={{ scale: 0.95 }}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </motion.button>

      <h1 className="text-xl font-bold">Aviso de Privacidad</h1>
      <p className="text-xs text-muted-foreground">Última actualización: junio 2026</p>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Responsable del tratamiento</h2>
        <p>
          Integrika S.A. de C.V. (en adelante "Integrika"), con domicilio en México,
          es responsable del tratamiento de sus datos personales conforme a la Ley
          Federal de Protección de Datos Personales en Posesión de los Particulares
          (LFPDPPP).
        </p>
        <p>Contacto: <a href="mailto:integric.ia@gmail.com" className="text-primary underline">integric.ia@gmail.com</a></p>
      </section>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Datos personales que recabamos</h2>
        <p>Nombre completo, número de teléfono, correo electrónico y, de forma opcional,
           historial de compras en la farmacia participante.</p>
      </section>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Finalidades del tratamiento</h2>
        <p><strong>Finalidades necesarias:</strong></p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Registro y administración de su membresía en el programa de lealtad.</li>
          <li>Acumulación y canje de puntos.</li>
          <li>Comunicación sobre el estado de su cuenta.</li>
        </ul>
        <p className="mt-2"><strong>Finalidades secundarias (requieren consentimiento):</strong></p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Envío de promociones, ofertas y boletines informativos por correo electrónico o SMS.</li>
        </ul>
        <p className="text-muted-foreground text-xs mt-1">
          Puede retirar su consentimiento para las finalidades secundarias en cualquier momento
          desde la sección "Mi cuenta" de esta aplicación.
        </p>
      </section>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Transferencias de datos</h2>
        <p>
          Integrika no transfiere sus datos personales a terceros sin su consentimiento,
          salvo los casos exceptuados por el artículo 37 de la LFPDPPP.
        </p>
      </section>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Derechos ARCO</h2>
        <p>
          Tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus
          datos personales (derechos ARCO). También puede limitar el uso o divulgación de
          sus datos y revocar su consentimiento.
        </p>
        <p>
          Para ejercer sus derechos, envíe una solicitud a{' '}
          <a href="mailto:integric.ia@gmail.com" className="text-primary underline">integric.ia@gmail.com</a>
          {' '}o use el formulario disponible en{' '}
          <button
            className="text-primary underline"
            onClick={() => navigate('../solicitud-arco', { relative: 'path' })}
          >
            Solicitar derechos ARCO
          </button>.
        </p>
        <p className="text-muted-foreground text-xs">
          Responderemos a su solicitud en un plazo máximo de 20 días hábiles conforme al
          artículo 24 de la LFPDPPP.
        </p>
      </section>

      <section className="space-y-3 text-sm">
        <h2 className="font-semibold">Cambios a este aviso</h2>
        <p>
          Cualquier modificación a este aviso de privacidad se publicará en esta misma
          sección de la aplicación.
        </p>
      </section>
    </div>
  )
}
