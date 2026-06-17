# Expedientes clínicos

> Aquí ves el historial médico de cada paciente, registras notas de consulta y generas recetas. La usan doctores (para escribir) y todo el personal de admin/recepción/enfermería (para consultar).

## Operación — cómo se usa

### Cómo buscar y abrir el expediente de un paciente

1. Escribe el nombre o apellido del paciente en el buscador de arriba.
2. Da clic sobre la fila del paciente para abrir su expediente — se despliega hacia abajo.
3. Verás sus notas de consulta anteriores (formato SOAP), ordenadas de la más reciente a la más antigua.
4. Si el paciente tiene alergias registradas, aparecen en un aviso amarillo arriba de las notas — revísalo antes de prescribir cualquier medicamento.

### Cómo crear un expediente nuevo (admin y doctor)

1. Da clic en "Nuevo expediente" (arriba a la derecha).
2. Elige el paciente y el médico responsable.
3. Elige el tipo de expediente: primera vez, seguimiento, urgencia, cirugía o crónico.
4. Da clic en "Crear expediente" — el expediente aparece de inmediato en la lista, ya abierto para agregar notas.

**Nota:** un paciente solo puede tener un expediente. Si ya tiene uno, el sistema no deja crear otro — busca el existente en vez de intentar crear uno nuevo.

### Cómo registrar una nota de consulta (admin y doctor)

1. Abre el expediente del paciente (ver arriba).
2. Da clic en "Nueva nota".
3. Llena los cuatro campos SOAP:
   - **S — Subjetivo:** lo que el paciente te dice (motivo de consulta).
   - **O — Objetivo:** lo que tú observas (signos vitales, hallazgos).
   - **A — Análisis:** tu interpretación o diagnóstico.
   - **P — Plan:** tratamiento, indicaciones, seguimiento.
4. Agrega el diagnóstico principal si aplica (ayuda a identificar la nota rápido en la lista).
5. Da clic en "Guardar nota". Debes llenar al menos el campo S o el O — si dejas ambos vacíos, el sistema no te deja guardar.

### Cómo editar una nota ya guardada (admin y doctor)

1. Dentro del expediente, busca la nota en la lista.
2. Da clic en el icono de lápiz.
3. Modifica lo que necesites y da clic en "Guardar cambios".

### Cómo generar una receta desde una nota (admin y doctor)

1. En la nota de consulta correspondiente, da clic en el icono de receta (hoja con check).
2. Si la nota ya tenía una receta sin emitir, se abre con lo que ya habías agregado; si no, empieza una nueva.
3. Escribe o confirma el diagnóstico.
4. Agrega cada medicamento: puedes elegirlo del catálogo (autocompleta nombre y presentación) o escribirlo a mano. Nombre genérico, dosis, vía, frecuencia, duración e indicaciones son obligatorios.
5. Si el medicamento es controlado, marca la casilla "Medicamento controlado" y anota el grupo (I, II, III...).
6. Junto a cada medicamento que sí está ligado al inventario verás si hay stock suficiente (🟢) o no (🔴). Si dice "sin ligar a inventario", quiere decir que lo escribiste a mano y no se descontará del almacén.
7. Cuando termines de agregar medicamentos, da clic en "Emitir receta". Esto le asigna un folio y la deja lista para imprimir.
8. Da clic en "Imprimir" para abrir el formato de impresión.

**Importante:** una vez emitida, la receta ya no se puede modificar. Revisa bien antes de dar clic en "Emitir receta".

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** no puedes crear un segundo expediente para el mismo paciente.
  **Por qué:** cada paciente debe tener un solo historial clínico — así no se divide su información en dos lugares distintos.
- **Lo que pasa:** una nota de consulta necesita al menos el campo "Subjetivo" u "Objetivo" lleno.
  **Por qué:** una nota completamente vacía no aporta nada al expediente y dificulta el seguimiento del paciente.
- **Lo que pasa:** una vez que emites una receta, no se puede editar.
  **Por qué:** la receta es un documento que ya se entrega o se imprime para el paciente; cambiarla después generaría inconsistencias entre lo que el paciente tiene en mano y lo que dice el sistema.
- **Lo que pasa:** las recetas con medicamentos controlados muestran una advertencia.
  **Por qué:** el registro aquí es interno; el trámite oficial ante COFEPRIS para medicamentos controlados se hace por fuera del sistema, y la advertencia te lo recuerda.
- **Lo que pasa:** solo admin y doctor pueden crear expedientes, agregar notas y generar recetas.
  **Por qué:** son quienes tienen la responsabilidad clínica; otros roles solo pueden consultar la información.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo el botón "Nuevo expediente" ni "Nueva nota" | Tu rol no es admin ni doctor | Pide a un doctor o al administrador que lo registre |
| Me dice que el paciente ya tiene expediente | Cada paciente solo puede tener uno | Búscalo en la lista en vez de crear otro |
| No me deja guardar la nota de consulta | Dejaste vacíos tanto "Subjetivo" como "Objetivo" | Llena al menos uno de los dos campos |
| El medicamento que agregué aparece "sin ligar a inventario" | Lo escribiste a mano en vez de elegirlo del catálogo | Si existe en el catálogo, selecciónalo ahí para que sí se controle el stock |
| El semáforo de stock no aparece junto a un medicamento | El medicamento no está ligado al inventario (lo escribiste a mano) | Es normal si no lo seleccionaste del catálogo; no afecta la receta |
| Ya no puedo modificar una receta | Ya fue emitida | Si hubo un error, genera una nota nueva con una receta nueva |
| No veo las alergias del paciente | El paciente no tiene alergias registradas en su ficha | Verifica en la ficha del paciente si falta capturarlas |


## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/Expedientes.tsx`
- **Subcomponentes:** `src/components/NotaConsultaModal.tsx` (alta/edición de notas SOAP), `src/features/recetas/components/PrescriptionEditorModal.tsx` (alta de items y emisión de receta, usa `src/features/camino-paciente/services/prescriptionService.ts`)
- **Tablas Supabase involucradas:** `expedientes`, `notas_consulta`, `patients`, `doctors`, `prescriptions`, `prescription_items`, `medicamentos`, `lotes_medicamento`
- **RPCs/edge functions:** ninguna directa en este flujo; `createPrescriptionFromConsultation`, `addPrescriptionItem`, `removePrescriptionItem`, `issuePrescription` son funciones de servicio (no RPC Postgres) en `prescriptionService.ts`
- **Permisos:** `canWrite = hasRole("admin") || hasRole("doctor")` controla visibilidad de "Nuevo expediente", "Nueva nota", editar nota y generar receta — es un gate de frontend, no RLS; si se necesita reforzar a nivel de base de datos, revisar políticas RLS de `expedientes`/`notas_consulta`/`prescriptions`
- **Unicidad de expediente por paciente:** se infiere de un constraint único (error Postgres `23505` capturado en `handleCreateExpediente`, mapeado a mensaje "Este paciente ya tiene un expediente") — verificar el constraint exacto en la migración de la tabla `expedientes` antes de tocar este flujo
- **Cómo agregar un campo nuevo:** migración `ALTER TABLE notas_consulta` o `expedientes` según corresponda + actualizar el formulario en `Expedientes.tsx` o `NotaConsultaModal.tsx` + regenerar `types.ts` (`generate_typescript_types`)
- **Cómo agregar una regla de negocio nueva:** la validación de "al menos S u O" vive en el frontend (`NotaConsultaModal.tsx`, función `handleSubmit`); reglas de receta (campos obligatorios por item) viven en `PrescriptionEditorModal.tsx` (`handleAddItem`) y en `prescriptionService.ts`. Si la regla debe ser inviolable (ej. no permitir editar receta emitida desde otra vía), moverla a un trigger o RPC en Postgres

