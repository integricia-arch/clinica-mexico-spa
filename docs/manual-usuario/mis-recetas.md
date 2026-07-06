# Mis recetas

> Aquí el paciente ve todas sus recetas médicas ya emitidas, puede imprimirlas, verificar su autenticidad y consultar su bitácora. La usa el propio paciente desde su cuenta.

## Operación — cómo se usa

### Cómo ver tus recetas

1. Al entrar, ves la lista de todas tus recetas emitidas (las que están en borrador todavía no aparecen aquí).
2. Cada receta muestra su folio, estado (Emitida, Surtida parcial, Surtida, Cancelada), fecha, el médico que la emitió y el diagnóstico si se capturó.

### Cómo ver el detalle de los medicamentos

1. Da clic sobre cualquier receta de la lista para desplegarla.
2. Verás cada medicamento con su dosis, vía, frecuencia, duración e indicaciones. Si alguno es controlado, aparece marcado con una advertencia.

### Cómo imprimir o verificar una receta

1. Con la receta desplegada, da clic en **"Ver e imprimir"** para abrir el formato completo listo para imprimir (incluye el código QR).
2. Da clic en **"Verificar autenticidad"** para abrir la pantalla del código QR que una farmacia puede escanear para confirmar que la receta es legítima.
3. Da clic en **"Ver bitácora"** para ver el historial de esa receta (cuándo se emitió, cada vez que se imprimió, etc.).

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** solo ves tus propias recetas, nunca las de otro paciente.
  **Por qué:** es tu historial personal — el resto del personal (doctores, administración) tiene su propia pantalla de "Recetas" con el listado completo de la clínica.
- **Lo que pasa:** las recetas en borrador (todavía no emitidas) no aparecen en esta lista.
  **Por qué:** una receta en borrador no es un documento válido todavía; solo se te muestra una vez que el médico la emitió formalmente.
- **Lo que pasa:** cada receta tiene un folio único y un código QR.
  **Por qué:** así puedes mostrarla en cualquier farmacia y que verifiquen que es auténtica, sin depender de que la farmacia tenga acceso al sistema de la clínica.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo ninguna receta | Todavía no tienes ninguna receta emitida | Es normal si no has tenido consultas con receta; una vez que el médico la emita, aparecerá aquí |
| Una receta que sé que existe no aparece | Puede seguir en borrador (no emitida formalmente) | Pregunta al consultorio si ya se emitió tu receta |
| Quiero mostrar mi receta en la farmacia | Usa "Ver e imprimir" o "Verificar autenticidad" | Cualquiera de las dos muestra el código QR que la farmacia puede escanear |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/MisRecetas.tsx` (ruta `/mis-recetas`)
- **Tablas Supabase involucradas:** `prescriptions` (filtrado por `user` implícito vía RLS — la query en el frontend no filtra explícitamente por `patient_id`, se apoya en políticas RLS para acotar a las recetas del usuario autenticado), `prescription_items`, `doctors` (lectura)
- **Filtro aplicado en el frontend:** `.neq("status", "draft")` — excluye borradores; el resto de campos y estados (`STATUS_LABELS`) deben mantenerse sincronizados con los mismos en `src/pages/Recetas.tsx`.
- **Pantallas relacionadas:** `src/pages/RecetaImprimir.tsx` (`/receta/:id`), `src/pages/RecetaBitacora.tsx` (`/receta/:id/bitacora`), `src/pages/VerificarReceta.tsx` (`/verificar-receta/:id`) — mismo flujo que usa el personal clínico desde `Recetas.tsx`.
- **Roles con acceso a la ruta:** `patient`, `admin` (ver `App.tsx`, ruta `/mis-recetas`).
- **Cómo agregar un campo nuevo:** agregarlo al `select()` inicial, al tipo `Receta`/`Item`, y al bloque expandido del JSX.
- **Cómo agregar una regla de negocio nueva:** si es sobre qué recetas debe ver el paciente, revisar primero la política RLS de `prescriptions` (no hay filtro explícito de `patient_id` en el código del frontend) antes de tocar la query.

_/aprende 2026-07-06_
