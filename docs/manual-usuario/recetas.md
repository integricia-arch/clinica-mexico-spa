# Recetas

> Aquí ves todas las recetas médicas de la clínica en un solo lugar: buscarlas, revisar su estado, imprimirlas, verificarlas o ver su historial. La usan administradores, doctores y enfermería.

## Operación — cómo se usa

### Cómo encontrar una receta

1. Entra a "Recetas" desde el menú.
2. Escribe en el buscador el folio, el nombre del paciente, el nombre del médico o el medicamento — cualquiera de esos te la encuentra.
3. Si quieres acotar más, usa el filtro de estado (Emitida, Surtida parcial, Surtida, Cancelada, Borrador).
4. Si eres administrador, también puedes filtrar por médico.
5. Resultado esperado: la lista se actualiza sola conforme escribes o cambias los filtros.

### Cómo leer la tarjeta de una receta

Cada receta en la lista te muestra:

- El folio (o "Sin folio" si todavía no se emitió).
- Su estado actual, con una etiqueta de color.
- Una etiqueta roja "Controlado" si la receta incluye algún medicamento controlado — fíjate bien en esas.
- La fecha de emisión, el paciente y el médico.
- El diagnóstico (si se capturó) y la lista de medicamentos.

### Cómo imprimir una receta

1. Da clic en "Imprimir" sobre la receta que necesitas.
2. Se abre una pestaña nueva con el formato listo para imprimir.

### Cómo verificar la autenticidad de una receta

1. Da clic en "Verificar" sobre la receta.
2. Se abre una pestaña con el código QR de verificación — es el mismo que puede escanear una farmacia externa para confirmar que la receta es legítima.

### Cómo ver la bitácora de una receta

1. Da clic en "Bitácora" sobre la receta.
2. Ahí ves todo lo que le ha pasado a esa receta: cuándo se emitió, cada vez que se imprimió o reimprimió, cada verificación por QR y si fue cancelada o surtida.
3. Esta bitácora es solo de lectura — nadie puede borrar ni modificar esos eventos, ni siquiera un administrador.

### Cómo crear una receta nueva

Esta pantalla no emite recetas nuevas directamente. Da clic en "Nueva receta" y el sistema te lleva a "Expedientes", donde eliges al paciente y capturas los medicamentos desde su expediente clínico. Cuando la guardes ahí, aparecerá en este listado de "Recetas".

### Cómo editar el machote de receta (admin/doctor)

Si eres administrador o doctor, el botón "Machote" te lleva a la configuración del formato de impresión (logo, firma, datos de la clínica) — no se hace desde aquí, solo es un acceso directo.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** no puedes emitir ni editar una receta desde esta pantalla, solo consultarla. **Por qué:** la receta se emite junto con el resto de la consulta, dentro del expediente del paciente, para que quede ligada al diagnóstico y la nota médica correspondiente.
- **Lo que pasa:** las recetas con medicamentos controlados se marcan con una etiqueta roja. **Por qué:** son medicamentos que requieren más cuidado en su entrega y seguimiento, así que se busca que salten a la vista de inmediato.
- **Lo que pasa:** los eventos de la bitácora no se pueden borrar ni cambiar. **Por qué:** es el registro legal de qué pasó con cada receta (quién la imprimió, cuándo se verificó, si se canceló) — debe quedar intacto por si se necesita revisar después.
- **Lo que pasa:** si eres enfermera, doctor o administrador puedes ver esta pantalla; un paciente no. **Por qué:** un paciente solo ve sus propias recetas, en "Mis recetas" — aquí se ve el listado completo de toda la clínica.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No encuentro el botón para crear una receta nueva aquí | Esta pantalla es solo para consultar; las recetas se crean desde el expediente del paciente | Da clic en "Nueva receta" — te lleva directo a "Expedientes" |
| Una receta dice "Sin folio" | Todavía está en borrador, no se ha emitido formalmente | Complétala y emítela desde el expediente del paciente |
| No veo el filtro de médico | Ese filtro solo aparece si tu cuenta es de administrador | Si necesitas filtrar por médico y no eres admin, pide ayuda a un administrador |
| Quiero saber si alguien ya reimprimió o verificó una receta | Esa información no está en la tarjeta, está en su bitácora | Da clic en "Bitácora" sobre esa receta |
| Imprimí una receta pero el formato sale sin logo o sin firma | El machote de impresión no tiene esos datos configurados | Pide a un administrador o doctor que revise "Machote" en configuración |


## Implementación — para el siguiente dev/agente

- **Archivo(s) principal(es):** `src/pages/Recetas.tsx` (listado/búsqueda global, solo lectura — no emite recetas)
- **Pantallas relacionadas:** `src/pages/RecetaImprimir.tsx` (`/receta/:id`, vista de impresión), `src/pages/RecetaBitacora.tsx` (`/receta/:id/bitacora`, apéndice-solo vía `prescriptionAuditService`), `src/pages/VerificarReceta.tsx` (`/verificar-receta/:id`, QR), `src/pages/MisRecetas.tsx` (`/mis-recetas`, vista del paciente sobre las mismas tablas, filtra `status != draft`)
- **Solapamiento con Panel del doctor:** la *emisión* de recetas (capturar medicamentos, diagnóstico, generar folio) vive en el flujo de Expedientes/consulta del doctor, no en esta pantalla. `Recetas.tsx` es un listado/auditoría transversal (admin, doctor, nurse via `allowedRoles` en `App.tsx`); el botón "Nueva receta" solo redirige a `/expedientes`.
- **Tablas Supabase involucradas:** `prescriptions`, `prescription_items`, `doctors`, `patients` (lectura); auditoría via `prescriptionAuditService` (tabla de eventos detrás de `getPrescriptionAudit`)
- **RPCs/edge functions:** ninguno propio en esta pantalla — es consulta directa con `supabase.from(...).select(...)`. La emisión/cancelación/dispensación que generan los eventos de bitácora viven en otras pantallas (Expedientes, Farmacia)
- **Cómo agregar un campo nuevo:** agregar la columna a `prescriptions` o `prescription_items` (migración), incluirla en el `select()` de `Recetas.tsx` y mostrarla en la tarjeta; si debe ser buscable, añadirla al arreglo `hay` dentro del `useMemo` de `filtered`
- **Cómo agregar una regla de negocio nueva:** si es sobre quién puede ver qué, ajustar `allowedRoles` en la ruta `/recetas` de `App.tsx` y/o RLS de `prescriptions`; si es sobre el ciclo de vida de la receta (nuevos estados), agregar la clave a `STATUS_LABELS` en `Recetas.tsx` y en `MisRecetas.tsx` para mantenerlos sincronizados

