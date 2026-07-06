# Cobros y pagos digitales

> Aquí configuras la pasarela de pago (Stripe) para aceptar cobros con tarjeta, OXXO Pay y transferencia SPEI, y decides si se habilita una terminal física en el consultorio. Solo la usa el administrador.

## Operación — cómo se usa

### Cómo elegir el proveedor y ambiente

1. Entra a "Configuración" → "Cobros y pagos digitales".
2. Elige el **proveedor**: Stripe (recomendado), Conekta o "Sin pasarela".
3. Elige el **ambiente**: Sandbox (pruebas) o Producción. En Producción, el sistema te advierte que los cobros serán reales.

_Conekta aparece como opción pero su integración todavía no está activa — el sistema lo indica con un aviso informativo._

### Cómo configurar Stripe

1. Copia tu **llave pública (Publishable Key)** desde el Dashboard de Stripe (hay un enlace directo "Ver en Stripe") y pégala en el campo correspondiente.
2. Da clic en **"Verificar llave"** para confirmar que es válida antes de guardar.
3. Si la clínica tiene un lector físico de tarjetas en el consultorio, marca **"Habilitar Stripe Terminal"**.

### Cómo elegir los métodos de pago aceptados

Marca las casillas de los métodos que quieres aceptar: **Tarjeta de crédito/débito**, **OXXO Pay** (comisión fija de $8 MXN) o **Transferencia SPEI**.

### Cómo guardar

Da clic en **"Guardar configuración de pagos"**. El botón está deshabilitado si elegiste "Sin pasarela".

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** si el ambiente es "Producción", la llave pública de Stripe debe empezar con `pk_live_`; si es "Sandbox", debe empezar con `pk_test_`.
  **Por qué:** mezclar una llave de pruebas con el ambiente de producción (o viceversa) provocaría que los cobros no funcionen o que se cobren montos de prueba como si fueran reales.
- **Lo que pasa:** la llave secreta de Stripe (la que empieza con `sk_`) nunca se captura ni se guarda aquí.
  **Por qué:** esa llave permite mover dinero directamente; solo se configura como variable de entorno en el servidor, nunca en una pantalla ni en la base de datos, para minimizar el riesgo si alguien accediera sin permiso a esta configuración.
- **Lo que pasa:** habilitar Stripe Terminal requiere un lector físico (hardware) además de activar la casilla.
  **Por qué:** el cobro presencial con tarjeta física necesita el dispositivo lector; la casilla solo prepara el sistema para reconocerlo, no lo reemplaza.
- **Lo que pasa:** cada método de pago tiene una comisión distinta (tarjeta 3.6% con IVA incluido, OXXO $8 MXN fijo + 1.2%, SPEI sin comisión adicional).
  **Por qué:** son las comisiones que cobra Stripe por cada método; conviene que la clínica las conozca al decidir cuáles ofrecer.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| "Verificar llave" dice que es inválida | La llave pública está mal copiada, revocada, o no corresponde al ambiente elegido (test vs live) | Copia de nuevo la llave desde el Dashboard de Stripe y confirma que el ambiente coincide |
| Elegí Conekta pero no veo más opciones | La integración con Conekta todavía no está activa | El sistema lo indica con un aviso; por ahora usa Stripe |
| No puedo guardar la configuración | Elegiste "Sin pasarela" — el botón se deshabilita en ese caso | Elige Stripe o Conekta si quieres aceptar pagos digitales |
| Los cobros de prueba se están cobrando de verdad | El ambiente quedó en "Producción" en vez de "Sandbox" | Cambia el ambiente a Sandbox mientras haces pruebas |
| Necesito activar cobros reales pero no sé cómo poner la llave secreta | Esa llave no se configura desde esta pantalla | Contacta al equipo técnico para que la configure como variable de entorno del servidor |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/configuracion/ConfiguracionPagos.tsx` (ruta `/configuracion/pagos`).
- **Tabla Supabase:** `payment_gateway_config` (`clinic_id`, `proveedor`, `ambiente`, `stripe_publishable_key`, `stripe_terminal_habilitado`, `metodos_habilitados[]`, `activo`). Nota: el `.from()` usa un cast `as unknown as "appointments"` porque la tabla no está en `types.ts` generado — regenerar tipos si se formaliza.
- **La llave secreta de Stripe (`sk_*`) nunca se persiste aquí** — vive como variable de entorno en las Edge Functions del servidor.
- **Verificación de llave:** `handleTestStripe()` hace `fetch` directo a `api.stripe.com` desde el navegador con la llave pública — solo valida que no responda 401.
- **Validación de prefijo de llave según ambiente:** vive inline en `handleSave()` — si se agrega otro proveedor con llaves con prefijo, replicar el patrón.
- **Cómo agregar un método de pago nuevo:** agregar la entrada a la constante `METODOS` al inicio del archivo.
- **Cómo activar Conekta de verdad:** hoy es solo una opción en el `<select>` con un aviso informativo — falta implementar sus credenciales y lógica de cobro (backend + Edge Function).

_/aprende 2026-07-06_
