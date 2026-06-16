# Manuales de usuario — ClínicaMX

Manuales procedurales por pantalla. Cada archivo de este directorio corresponde
a una fila en la tabla `manual_paginas` (Supabase) vía la columna `slug`. El
botón "?" de cada pantalla abre el manual correspondiente resolviendo
`ruta actual → manual_paginas.ruta → slug → este archivo`.

## Convenciones

- **Un archivo por pantalla/módulo**, nombre = `slug` de `manual_paginas` (ej. `farmacia.md`).
- **Orientado a tareas, no a botones.** Título de cada sección = lo que el usuario quiere lograr
  ("Cómo aprobar una solicitud de insumos"), no "Descripción del botón Aprobar".
  Ver `_TEMPLATE.md` para la estructura exacta.
- **Voz activa, imperativo, sin jerga.** "Da clic en Guardar", no "El usuario deberá proceder a hacer clic".
- **Tres tipos de duda que cada manual debe resolver:**
  1. **Operación** — cómo usar la pantalla en el día a día.
  2. **Reglas de negocio** — por qué el sistema se comporta así (ej. "por qué no me deja cobrar sin turno abierto").
  3. **Implementación / extensión** — cómo agregar un campo, un rol, una regla nueva (para el siguiente dev/agente, no para el usuario final).
- **Markdown plano**, renderizado en la app con un visor markdown (no HTML embebido).

## Agregar un manual nuevo

1. Copiar `_TEMPLATE.md` → `<slug>.md`.
2. Llenar las 4 secciones.
3. Insertar la fila en `manual_paginas` (ruta, slug, titulo, modulo) — vía migración o RPC admin.
4. El botón de ayuda contextual lo detecta automáticamente, sin tocar código de frontend.

## Por qué el contenido vive en archivos y no en la base de datos

Versionado por git (historial, diffs, revisión en PR), evita inflar la base de datos
con texto largo, y permite editar manuales sin pasar por una migración de datos.
La tabla `manual_paginas` solo enruta; `manual_consultas` registra quién leyó qué manual
y cuándo (analítica de fricción operativa, no el contenido).
