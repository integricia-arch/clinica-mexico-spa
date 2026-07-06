# Configuración avanzada (demo)

> Esta pantalla es una **vista previa** de un futuro centro de control con todos los ajustes de la clínica en un solo lugar (horarios, citas, recordatorios, servicios, doctores, consultorios, formularios, checklists, facturación, pagos, caja, inventario, usuarios y auditoría). Hoy, la mayoría de las secciones son solo una maqueta visual y no guardan cambios reales. La usan administrador y doctor.

## Operación — cómo se usa

### Cómo navegar entre secciones

1. Entra a "Configuración" → "Configuración avanzada (demo)" (o directo a `/ajustes`).
2. En el menú de la izquierda, da clic en la sección que quieres ver: General, Horarios, Citas, Recordatorios, Servicios, Doctores, Consultorios y recursos, Formularios del paciente, Checklists clínicos, Facturación y fiscal MX, Pagos, Caja y cortes, Inventario y costos, Usuarios y permisos, Auditoría y cumplimiento.
3. El contenido de la derecha cambia según la sección elegida.

### Cómo guardar o descartar cambios

1. Si modificas algo en la sección activa, arriba aparece la etiqueta **"Cambios sin guardar"**.
2. Da clic en **"Guardar"** para confirmar, o en **"Cancelar"** para descartar y volver al valor anterior.
3. Si la sección es una maqueta visual (la mayoría), el sistema muestra "Cambios guardados (demo visual)" — es solo un mensaje de confirmación, no persiste nada.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** al cambiar de sección en el menú, cualquier cambio sin guardar se descarta automáticamente sin avisar.
  **Por qué:** es el comportamiento intencional de una vista de demostración — evita que quede a medias un guardado que de todos modos no persiste en la mayoría de las secciones.
- **Lo que pasa:** en la mayoría de las secciones, "Guardar" solo muestra un mensaje de confirmación pero no cambia nada real en el sistema.
  **Por qué:** esta pantalla es una maqueta del futuro centro de control unificado; algunas secciones (marcadas internamente como "con persistencia real") sí guardan de verdad, pero la mayoría todavía no.
- **Lo que pasa:** para ajustes que sí necesitas cambiar de verdad hoy (horario de la clínica, notificaciones, facturación, pagos, email, usuarios, cajas, camino del paciente, machote de receta), existen pantallas dedicadas y funcionales enlazadas desde "Configuración" — no esta.
  **Por qué:** esta demo agrupa visualmente hacia dónde va el sistema, pero el trabajo real hoy vive repartido en las pantallas específicas ya construidas.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| Guardé cambios pero al volver a entrar ya no están | Es una vista de demostración — casi ninguna sección guarda de verdad | Usa la pantalla dedicada correspondiente (ej. "Configuración de cajas", "Facturación y CFDI") para cambios reales |
| Cambié de sección y perdí lo que estaba escribiendo | El sistema descarta cambios sin guardar al cambiar de sección, sin previo aviso | Da clic en "Guardar" antes de cambiar de sección si quieres conservar el cambio (aunque sea solo confirmación visual) |
| No encuentro dónde de verdad se configura la facturación/pagos/usuarios | Esta pantalla es solo una maqueta de esas áreas | Ve a "Configuración" y usa las tarjetas con flecha (Facturación y CFDI, Cobros y pagos, Usuarios y roles, etc.) |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/ajustes/AjustesPlataforma.tsx` (ruta `/ajustes`) — shell con sidebar de 15 secciones (`SECTIONS[]`) y un sistema de `registerSave`/`dirty` compartido.
- **Sub-componentes por sección:** `src/pages/ajustes/sections/basic.tsx` (General, Horarios, Citas, Recordatorios), `clinical.tsx` (Recursos, Formularios, Checklists), `servicios.tsx`, `doctores.tsx`, `finance.tsx` (Facturación, Pagos, Caja), `inventario.tsx`, `admin.tsx` (Usuarios, Auditoría).
- **Patrón de guardado:** cada sección recibe `onChange` (marca `dirty`) y opcionalmente `registerSave` (expone un objeto `{save, reset}` al padre). Si una sección NO llama `registerSave`, el botón "Guardar" del padre solo muestra el toast "Cambios guardados (demo visual)" sin persistir nada — revisar cada archivo de `sections/` para saber cuáles sí tienen `registerSave` implementado con persistencia real.
- **Cómo saber si una sección específica ya persiste de verdad:** grep `registerSave` dentro de `sections/*.tsx` — si el componente lo llama con un `save()` que hace un `supabase.from(...).update/insert`, es real; si no, es demo visual.
- **Cómo agregar una sección nueva:** agregar entrada a `SECTIONS[]` en `AjustesPlataforma.tsx`, crear el componente en `sections/`, y agregar el `{active === "id" && <Componente .../>}` correspondiente.
- **Relación con pantallas "reales":** varias secciones de esta demo duplican visualmente pantallas ya funcionales fuera de `/ajustes` (`/configuracion/caja`, `/configuracion/facturacion`, `/configuracion/pagos`, `/admin/usuarios`, `/auditoria`) — al planear que esta demo reemplace esas pantallas, decidir explícitamente cuál gana o cómo se fusionan para no tener dos fuentes de verdad.

_/aprende 2026-07-06_
