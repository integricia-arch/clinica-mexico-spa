# Expediente clínico electrónico

> Es el historial clínico completo de un paciente en formato de expediente médico oficial: identificación, antecedentes heredofamiliares y personales, notas de consulta y prescripciones. Se puede imprimir como documento formal. Lo usan doctores (para capturar antecedentes) y todo el personal clínico para consultar.

## Operación — cómo se usa

### Cómo abrir el expediente completo de un paciente

Se llega a esta pantalla desde "Pacientes" (botón "Expediente completo" dentro del historial) o desde "Expedientes". Al entrar ves de inmediato los datos del paciente y, si ya existen, sus antecedentes guardados.

### Cómo capturar o actualizar los antecedentes clínicos

1. Revisa cada sección: **Heredofamiliares** (marca las casillas de enfermedades en la familia y agrega notas), **Personales no patológicos** (tabaquismo, alcoholismo, actividad física, estado civil, escolaridad, ocupación, uso de drogas), **Personales patológicos** (enfermedades previas, cirugías, hospitalizaciones, fracturas, transfusiones, inmunizaciones), y **Gineco-obstétricos** (solo si la paciente es mujer o no tiene sexo registrado).
2. Llena o corrige los campos que necesites.
3. Da clic en **"Guardar antecedentes"** — verás "Guardado ✓" cuando se complete.

### Cómo imprimir el expediente

1. Da clic en **"Imprimir"** en la parte superior.
2. Se abre el diálogo de impresión del navegador con el expediente en formato de documento oficial (identificación, antecedentes en texto corrido, notas SOAP y prescripciones), listo para firma del médico.

### Cómo consultar las notas de consulta y prescripciones

Debajo de los antecedentes, el expediente muestra automáticamente el historial de **notas de consulta (SOAP)** y **prescripciones** del paciente, de la más reciente a la más antigua. Esta parte es solo de lectura aquí — para agregar una nota o receta nueva, ve a "Expedientes" o al "Panel del doctor".

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** la sección de antecedentes gineco-obstétricos solo aparece si el sexo del paciente es "F" o no está registrado.
  **Por qué:** son datos que no aplican a pacientes hombres.
- **Lo que pasa:** al imprimir, los campos editables (selects, checkboxes, textareas) se convierten en texto simple.
  **Por qué:** el documento impreso debe verse como un expediente médico formal, no como un formulario en pantalla.
- **Lo que pasa:** el documento indica que se generó conforme a la NOM-004-SSA3-2012.
  **Por qué:** es la norma oficial mexicana del expediente clínico electrónico — el formato de este documento está diseñado para cumplirla.
- **Lo que pasa:** esta pantalla no permite agregar notas de consulta ni recetas nuevas, solo verlas.
  **Por qué:** esas acciones son parte del flujo clínico activo (Expedientes / Panel del doctor); aquí es el expediente consolidado para consulta e impresión.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo la sección gineco-obstétrica | El paciente tiene registrado un sexo distinto de femenino | Es el comportamiento esperado |
| Guardé los antecedentes pero no veo el cambio reflejado al imprimir | El botón "Imprimir" toma los datos ya guardados en pantalla | Guarda primero con "Guardar antecedentes", luego imprime |
| No encuentro dónde agregar una nota de consulta nueva desde aquí | Esta pantalla es de consulta/antecedentes, no de captura de notas | Ve a "Expedientes" o al "Panel del doctor" para agregar una nota nueva |
| El expediente dice "Paciente no encontrado" | El `patientId` de la URL no corresponde a ningún paciente activo | Verifica que llegaste desde un enlace válido (ficha del paciente) |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/ExpedienteElectronico.tsx` (ruta `/expediente/:patientId`)
- **Tablas Supabase involucradas:** `patients` (lectura), `antecedentes_clinicos` (lectura/escritura — upsert manual: `update` si ya existe `id`, `insert` si no), `expedientes` (solo para resolver IDs), `notas_consulta`, `prescriptions` (lectura, historial)
- **RPCs/edge functions:** ninguna — todo es CRUD directo vía cliente Supabase.
- **Impresión:** `window.print()` nativo del navegador + CSS `@media print` embebido en el propio componente (clases `print:hidden`, `print:block`, etc.) para alternar entre vista editable y vista de documento.
- **Cómo agregar un campo nuevo a antecedentes:** agregar la columna a `antecedentes_clinicos` (migración) + agregarlo al tipo `Antecedentes` + a `EMPTY_ANT` + al `payload` de `guardar()` + al JSX (versión editable y versión `print:`) + regenerar `types.ts`.
- **Cómo agregar una regla de negocio nueva:** la visibilidad condicional de secciones (ej. gineco-obstétricos por sexo) vive directamente en el JSX de este componente; reglas más profundas (constraints, validación de rangos) deben ir en la migración de `antecedentes_clinicos`.

_/aprende 2026-07-06_
