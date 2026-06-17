# Configuración

> Aquí encuentras los ajustes generales de la clínica y accesos a las pantallas de configuración más específicas (recetas, caja, facturación, email, camino del paciente). Lo usan principalmente el administrador y, para algunas opciones, el doctor.

## Operación — cómo se usa

### Cómo entrar a una configuración específica

1. Entra a "Configuración" desde el menú principal.
2. Da clic en la tarjeta de la opción que buscas (por ejemplo "Mi machote de receta" o "Facturación y CFDI").
3. Se abre esa pantalla específica — tiene su propio manual de ayuda con el botón "?".

Las opciones que puedes ver dependen de tu rol. Si eres doctor, solo ves "Mi machote de receta" además de las generales. Si eres administrador, ves todas.

### Qué encuentras en esta pantalla (solo administrador, salvo que se indique otro rol)

- **Configuración del Camino del Paciente** — plantillas y etapas del flujo de atención del paciente. Lleva a `/configuracion/camino-paciente`.
- **Mi machote de receta** (doctor y administrador) — diseña el encabezado, logo, firma y cierre de tus recetas. Lleva a `/configuracion/recetas`.
- **Configuración de cajas** (administrador y gerente) — registrar cajas registradoras, fondo de apertura y si son de caja general o farmacia. Lleva a `/configuracion/caja`.
- **Usuarios y roles** — administrar las cuentas del personal (Administrador, Recepción, Médico, Enfermería, Farmacia, Caja/Facturación). Lleva a `/admin/usuarios`.
- **Notificaciones por rol** — qué rol recibe cada aviso (asignación de enfermera, vencimientos, usuarios nuevos) y por qué canal (Telegram o email). Lleva a `/configuracion/notificaciones`.
- **Facturación y CFDI** — datos del emisor, régimen fiscal y certificados para timbrar facturas. Lleva a `/configuracion/facturacion`.
- **Cobros y pagos digitales** — configuración de Stripe, OXXO Pay, transferencia SPEI y terminal física. Lleva a `/configuracion/pagos`.
- **Email y notificaciones** — remitente y nombre que verá el paciente en los correos del sistema (CFDI, recordatorios). Lleva a `/configuracion/email`.
- **Configuración avanzada (demo)** — vista previa de un panel de control más amplio. Esta tarjeta es solo una maqueta visual; lo que cambies ahí no se guarda.
- **Datos del consultorio**, **Permisos y seguridad**, **Localización** — tarjetas marcadas "Próximamente": todavía no hacen nada, son un adelanto de lo que viene.

### Cómo administrar los consultorios (salas físicas de atención)

1. En la sección "Consultorios", revisa la lista de salas ya registradas.
2. Si eres administrador, da clic en "Agregar" para crear una nueva.
3. Escribe el nombre del consultorio (obligatorio) y, si quieres, el piso.
4. Da clic en "Guardar" — el consultorio aparece de inmediato en la lista, activo.

### Cómo activar o desactivar un consultorio

1. Busca el consultorio en la lista.
2. Da clic en "Desactivar" (o "Activar" si ya estaba inactivo).
3. El estado cambia al instante — no hace falta guardar nada más.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** si no hay ningún consultorio registrado, no puedes agendar citas desde el bot de Telegram.
  **Por qué:** el bot necesita saber en qué sala física se va a atender al paciente; sin al menos un consultorio activo no tiene dónde asignar la cita.
- **Lo que pasa:** algunas tarjetas (Facturación, Cobros, Email, Usuarios y roles, Notificaciones, Configuración de cajas) solo aparecen si eres administrador (o gerente, en el caso de cajas).
  **Por qué:** son ajustes que afectan a toda la clínica — dinero, facturas, cuentas de otros usuarios — y solo quien administra el sistema debe poder tocarlos.
- **Lo que pasa:** la tarjeta "Configuración avanzada (demo)" no guarda nada de lo que cambies ahí.
  **Por qué:** es una maqueta visual para mostrar hacia dónde va el sistema, todavía no está conectada a la base de datos.
- **Lo que pasa:** "Mi machote de receta" la ven tanto doctores como administradores.
  **Por qué:** cada doctor diseña su propio formato de receta (logo, firma, cierre), por eso no es exclusiva del administrador.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo varias de las tarjetas que mencionan aquí | Tu rol no tiene acceso a esa configuración | Pide al administrador que te dé el rol correspondiente, o que haga ese cambio por ti |
| Agregué un consultorio pero el bot sigue sin poder agendar | El consultorio puede haber quedado inactivo, o aún no se guardó | Revisa que aparezca como "Activo" en la lista; si no, da clic en "Activar" |
| Cambié algo en "Configuración avanzada (demo)" y al volver ya no está | Esa pantalla es solo una vista previa, no guarda cambios todavía | Usa las tarjetas con flecha (que sí llevan a una pantalla real) para hacer cambios que se guarden |
| No puedo agregar un consultorio nuevo | No tienes permisos de administrador | Pide a un administrador que lo agregue |
| No encuentro dónde cambiar el nombre o dirección de la clínica | Esa tarjeta ("Datos del consultorio") todavía no está activa | Está marcada "Próximamente" — por ahora no se puede editar desde el sistema |


## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/Configuracion.tsx` — hub con tarjetas de navegación (`secciones[]`) hacia sub-páginas, más gestión inline de `rooms` (consultorios).
- **Sub-páginas enlazadas (cada una con su propio manual):** `/ajustes` (demo, sin persistencia), `/admin/usuarios`, `/configuracion/notificaciones`, `/configuracion/facturacion`, `/configuracion/pagos`, `/configuracion/email`, `/configuracion/camino-paciente`, `/configuracion/recetas`, `/configuracion/caja`.
- **Tablas Supabase involucradas:** `rooms` (consultorios: `nombre`, `piso`, `capacidad`, `activo`).
- **RPCs/edge functions:** ninguna — el CRUD de `rooms` usa `supabase.from("rooms")` directo (select/insert/update).
- **Control de visibilidad por rol:** array `secciones[]` tiene flag `adminOnly`; los bloques de "Camino del Paciente", "Mi machote de receta" y "Configuración de cajas" están condicionados inline con `isAdmin`/`isDoctor`/`hasRole("manager")`.
- **Cómo agregar una tarjeta nueva al hub:** agregar un objeto a `secciones[]` (icon, titulo, descripcion, to opcional, adminOnly opcional). Si no lleva `to`, se renderiza como tarjeta no clickeable con etiqueta "Próximamente".
- **Cómo agregar un campo nuevo a `rooms`:** migración `ALTER TABLE rooms ADD COLUMN ...` + actualizar `roomForm` state y el modal de creación + regenerar `types.ts`.
- **Cómo agregar una regla de negocio nueva sobre consultorios:** ahora mismo no hay validación de backend (RLS aparte) — la validación vive en el frontend (`saveRoom`); si se necesita una regla que no se pueda saltar, moverla a un RPC o trigger en Postgres.

