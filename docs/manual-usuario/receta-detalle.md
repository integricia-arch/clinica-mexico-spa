# Ver receta e imprimir / Bitácora de receta

> Estas dos pantallas muestran una receta individual: una para verla e imprimirla, otra para ver su historial de eventos (bitácora). Se llega a ellas desde "Recetas" o "Mis recetas". Las usan doctores, enfermería, administración, recepción y también el propio paciente (viendo solo sus recetas).

## Operación — cómo se usa

### Cómo ver e imprimir una receta

1. Da clic en "Imprimir" sobre una receta (desde "Recetas" o "Mis recetas") — se abre en una pestaña nueva con el formato completo: datos del médico (incluida su cédula), datos del paciente, diagnóstico, cada medicamento con dosis/vía/frecuencia/duración/indicaciones, y el código QR de verificación.
2. Da clic en **"Imprimir"** dentro de esa pantalla para mandarlo a impresión.
3. Si necesitas volver, usa **"Volver"** (te regresa a Farmacia) o da clic en **"Bitácora"** para ver el historial de esa receta.

### Cómo ver la bitácora de una receta

1. Da clic en "Bitácora" sobre una receta (desde "Recetas", "Mis recetas" o desde la propia pantalla de impresión).
2. Verás una línea de tiempo con cada evento: cuándo se emitió, cada impresión o reimpresión, cada verificación por QR, si fue cancelada o surtida.
3. Cada evento muestra fecha y hora exactas; si hay detalles adicionales (por ejemplo, qué número de impresión fue), aparecen debajo en un recuadro.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** cada vez que das clic en "Imprimir", el sistema registra el evento (la primera vez como "Impresión", las siguientes como "Reimpresión").
  **Por qué:** para que la bitácora sepa cuántas veces se ha impreso una receta — información relevante si hay sospecha de duplicado o mal uso.
- **Lo que pasa:** la bitácora es de solo lectura — ningún evento se puede editar ni borrar, ni siquiera un administrador.
  **Por qué:** es el registro legal e inalterable de qué pasó con la receta.
- **Lo que pasa:** un paciente que entra a ver su propia receta ve exactamente la misma pantalla de impresión y bitácora que ve el personal clínico.
  **Por qué:** es la misma receta, solo cambia desde dónde se llegó (Recetas para el personal, Mis recetas para el paciente); el control de acceso ya se resuelve por rutas y roles antes de llegar aquí.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| La receta dice "Receta no encontrada" o "no disponible" | El folio/ID de la URL no corresponde a ninguna receta existente | Verifica que llegaste desde un enlace válido (lista de Recetas o Mis recetas) |
| Imprimí la receta pero no veo logo ni firma | El machote de impresión no tiene esos datos configurados | Pide a un administrador o doctor que revise "Machote" en configuración de recetas |
| Quiero saber si alguien reimprimió esta receta | Esa información está en la bitácora, no en la vista de impresión | Da clic en "Bitácora" |
| La bitácora dice "Sin eventos registrados todavía" | La receta aún no tiene ningún evento capturado (poco común, pasa solo si nunca se imprimió ni verificó) | Es normal en ese caso; no requiere acción |

## Implementación — para el siguiente dev/agente

- **Archivos principales:** `src/pages/RecetaImprimir.tsx` (ruta `/receta/:id`), `src/pages/RecetaBitacora.tsx` (ruta `/receta/:id/bitacora`)
- **Componente compartido:** `src/features/recetas/components/PrescriptionPrintView.tsx` (renderiza el formato de impresión)
- **Tablas Supabase involucradas:** `prescriptions`, `prescription_items`, `doctors`, `patients` (lectura); eventos de bitácora vía `prescriptionAuditService` (`getPrescriptionAudit`, `logPrescriptionEvent`, `countPrintEvents`)
- **Assets del machote:** `getAssetSignedUrl()` (`src/features/recetas/services/prescriptionTemplateService.ts`) resuelve URLs firmadas para logo y firma desde `template_snapshot_json` de la receta.
- **Registro de impresión:** `handlePrint()` en `RecetaImprimir.tsx` llama `window.print()` y luego `logPrescriptionEvent(id, prev > 0 ? "reprinted" : "printed", { print_index })`, usando `countPrintEvents(id)` para decidir si es primera impresión o reimpresión.
- **Roles con acceso a la ruta:** `admin`, `doctor`, `nurse`, `receptionist`, `patient` (ver `App.tsx`, rutas `/receta/:id` y `/receta/:id/bitacora`).
- **Cómo agregar un tipo de evento nuevo a la bitácora:** agregar la clave a `EVENT_META` en `RecetaBitacora.tsx` (label, ícono, color) y asegurarse de que quien dispara el evento llame `logPrescriptionEvent` con ese nombre.
- **Cómo agregar un campo nuevo al formato de impresión:** agregarlo al `select()` en `RecetaImprimir.tsx`, al tipo `PrescriptionPrintData`, y al JSX de `PrescriptionPrintView.tsx`.

_/aprende 2026-07-06_
