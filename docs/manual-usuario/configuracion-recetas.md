# Mi machote de receta

> Aquí cada médico diseña el formato de sus recetas: encabezado del consultorio, logo, firma escaneada, indicaciones precargadas y opciones de impresión. La usan los doctores (sobre su propio machote) y el administrador (puede editar el de cualquier médico).

## Operación — cómo se usa

### Cómo editar tu machote (si eres doctor)

1. Entra a "Configuración" → "Mi machote de receta". El sistema carga automáticamente tu machote (vinculado a tu cuenta de médico).
2. Recorre las pestañas del editor: **Encabezado**, **Logo y firma**, **Cuerpo**, **Opciones**.
3. La vista previa a la derecha se actualiza en vivo conforme escribes.
4. Da clic en **"Guardar borrador"** para guardar sin publicar (puedes seguir editando después).
5. Cuando esté listo, da clic en **"Publicar v[siguiente número]"**.

### Cómo editar el machote de un médico específico (si eres administrador)

Si tu cuenta de administrador no está vinculada a un registro de médico, el sistema te pide elegir uno de la lista antes de mostrar el editor. Si ya elegiste uno antes, puedes cambiarlo con el selector **"Editando como"** en la parte superior.

### Cómo llenar el encabezado

Completa nombre del consultorio, dirección y teléfono (**obligatorios**), correo (opcional), líneas adicionales (horarios, redes sociales, sitio web) y el color principal del diseño.

### Cómo subir el logo y la firma

1. En la pestaña **"Logo y firma"**, da clic en **"Subir logo"** o **"Subir firma"**.
2. Elige una imagen PNG o JPG de máximo 2 MB.
3. La imagen se sube y aparece de inmediato en la vista previa.

La firma escaneada es solo una imagen de respaldo — no sustituye una firma electrónica avanzada oficial.

### Cómo configurar el cuerpo y las opciones de la receta

- **Cuerpo:** escribe indicaciones generales precargadas (aparecerán al final de cada receta nueva, el médico puede editarlas por consulta) y el pie de página/cierre.
- **Opciones:** activa o desactiva mostrar QR interno, cédula profesional, especialidad o firma; elige el tamaño de papel (Carta o Media carta).

### Cómo publicar una versión

1. Da clic en **"Publicar v[N]"**. Si tenías cambios sin guardar, se guardan automáticamente antes de publicar.
2. Si faltan datos obligatorios (nombre, dirección o teléfono del consultorio; cédula si activaste "Mostrar cédula"; firma si activaste "Mostrar firma"), el sistema te lo indica en un recuadro de advertencia y no te deja publicar hasta completarlos.
3. Al publicar, todas las recetas nuevas usarán ese diseño. Las recetas ya emitidas conservan una copia exacta de la versión con la que se generaron, para reimpresiones fieles.
4. Consulta el historial de versiones publicadas al final de la pantalla.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** no puedes publicar si faltan el nombre, dirección o teléfono del consultorio.
  **Por qué:** son datos mínimos que debe llevar toda receta médica para ser válida legalmente.
- **Lo que pasa:** si activas "Mostrar cédula" pero el médico no tiene cédula profesional registrada en su perfil, no puedes publicar.
  **Por qué:** mostrar un campo vacío en la receta sería confuso o daría una impresión incompleta; primero se debe completar la cédula en el registro del médico (pantalla de Usuarios y roles).
- **Lo que pasa:** las imágenes de logo y firma tienen un límite de 2 MB.
  **Por qué:** mantiene las recetas ligeras de generar e imprimir, y evita archivos innecesariamente pesados.
- **Lo que pasa:** publicar una versión no modifica las recetas ya emitidas.
  **Por qué:** cada receta guarda una copia fiel del diseño con el que se generó, para que una reimpresión posterior se vea igual que el original, aunque el médico haya cambiado su machote después.
- **Lo que pasa:** un administrador sin médico vinculado a su cuenta debe elegir explícitamente a qué médico le va a editar el machote.
  **Por qué:** cada machote pertenece a un médico específico; el sistema no asume por cuál empezar.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No puedo publicar, dice que faltan datos | Falta nombre/dirección/teléfono del consultorio, o cédula/firma si las activaste | Revisa el recuadro de advertencia arriba de la vista previa — lista exactamente qué falta |
| Subí una imagen y me dice que no se pudo | La imagen pesa más de 2 MB | Comprime la imagen o usa una versión más ligera (PNG/JPG) |
| Como doctor no veo la pantalla, dice que mi cuenta no está vinculada | Tu usuario no tiene un registro de médico vinculado | Pide a un administrador que te vincule desde "Usuarios y roles" |
| Cambié el machote pero una receta vieja no se ve con el diseño nuevo | Es el comportamiento esperado — cada receta conserva el diseño con el que se emitió | No es un error; las recetas nuevas sí usarán el diseño actualizado |
| Guardé cambios pero no aparecen para los pacientes | Guardaste solo el borrador, no publicaste una versión | Da clic en "Publicar v[N]" para que el diseño entre en vigor |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/configuracion/MachoteReceta.tsx` (ruta `/configuracion/recetas`).
- **Servicio:** `src/features/recetas/services/prescriptionTemplateService.ts` — `getCurrentDoctorId`, `getOrCreateTemplate`, `saveTemplate`, `publishTemplateVersion`, `uploadDoctorAsset`, `getAssetSignedUrl`, `listVersions`.
- **Componente de vista previa:** `src/features/recetas/components/PrescriptionTemplatePreview.tsx`.
- **Tablas/storage Supabase:** tabla de plantillas de receta por doctor (`DoctorPrescriptionTemplate`, ver tipo en el servicio) + tabla de versiones publicadas; Storage bucket para `logo_path`/`firma_path` (URLs firmadas vía `getAssetSignedUrl`).
- **Validación de campos obligatorios para publicar:** vive en `validationErrors` (useMemo) dentro de `MachoteReceta.tsx` — agregar ahí cualquier campo nuevo que deba bloquear la publicación.
- **Cómo agregar una opción nueva al machote (ej. otro toggle):** agregar el campo a `DoctorPrescriptionTemplate` (tipo + columna en BD), agregar el `Toggle`/input correspondiente en la pestaña adecuada, y reflejarlo en `PrescriptionTemplatePreview.tsx`.
- **Límite de tamaño de imagen:** hardcoded `2 * 1024 * 1024` bytes en `handleUpload` — cambiarlo ahí si se decide otro límite.

_/aprende 2026-07-06_
