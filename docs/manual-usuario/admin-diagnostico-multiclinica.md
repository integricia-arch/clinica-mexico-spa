# Diagnóstico multi-clínica

> Aquí revisas si los datos del sistema están correctamente separados entre las distintas clínicas (que no se mezclen citas, pacientes o cobros de una clínica con otra) y si la protección de seguridad de las tablas está activa. Es una pantalla técnica para el administrador — no se usa en la operación diaria.

## Operación — cómo se usa

### Cómo revisar el diagnóstico

1. Entra a "Diagnóstico multi-clínica" (`/admin/diagnostico-multiclinica`). El reporte se carga automáticamente.
2. En **"Resumen"** ves: la clínica que el sistema usa por defecto, cuándo se generó el reporte, si hay tablas sin protección de seguridad (RLS), y si las funciones auxiliares del sistema están presentes. Cada uno muestra una etiqueta **OK** (verde) o **Atención** (roja).
3. En **"Memberships por rol"** ves cuántas personas tienen cada rol asignado en el sistema.
4. En **"Cruces de clínica"** ves una tabla de verificaciones cruzadas — cada fila es un chequeo distinto, con el número de inconsistencias encontradas y su estado (OK si es cero).
5. En **"Tablas con clinic_id"** ves, por cada tabla del sistema que debe pertenecer a una clínica: cuántos registros totales tiene, cuántos no tienen clínica asignada, y cuántos pertenecen a una clínica distinta de la esperada.
6. Si hay **"Tablas sin RLS"**, aparece una sección adicional listándolas — significa que esas tablas no tienen la protección de seguridad activada.
7. Da clic en **"Actualizar"** para volver a generar el reporte con datos frescos.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** una tabla se marca "Atención" (no OK) si tiene registros con clínica vacía o con una clínica distinta a la esperada.
  **Por qué:** en un sistema donde varias clínicas comparten la misma base de datos, cada registro debe pertenecer claramente a una sola clínica; si no, información de una clínica podría filtrarse o mezclarse con otra.
- **Lo que pasa:** la tabla `audit_logs` es la única excepción tolerada para "clinic_id NULL".
  **Por qué:** hay eventos de auditoría que ocurren antes de que exista una clínica asociada (por ejemplo, acciones a nivel de todo el sistema) — no es un error, es esperado para esa tabla en particular.
- **Lo que pasa:** si aparecen "Tablas sin RLS", es una alerta de seguridad.
  **Por qué:** sin esa protección activada, en teoría cualquier usuario con acceso a la base de datos podría leer o modificar datos de otras clínicas sin restricción.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| Veo "Atención" en varias tablas | Hay registros con clínica vacía o incorrecta | Repórtalo al equipo técnico — no es algo que se corrija desde esta pantalla, requiere revisión y corrección directa en la base de datos |
| Aparece la sección "Tablas sin RLS" | Alguna tabla no tiene activada la protección de seguridad por clínica | Es una alerta de seguridad — contacta al equipo técnico de inmediato |
| El reporte no carga, veo un mensaje de error | Falló la consulta al sistema | Da clic en "Actualizar"; si persiste, avisa al equipo técnico |
| No sé qué significan los nombres técnicos en "Cruces de clínica" | Son nombres de verificaciones internas del sistema | Esta pantalla es de uso técnico — si necesitas interpretarla, pide apoyo al equipo de desarrollo |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/AdminDiagnosticoMulticlinica.tsx` (ruta `/admin/diagnostico-multiclinica`).
- **RPC:** `multiclinic_diagnostics()` — única fuente de datos, devuelve un JSON con `generated_at`, `default_clinic_id`, `tables[]` (`table`, `total`, `null_clinic_id`, `non_default_clinic_id`), `cross_checks` (mapa de verificación → conteo de inconsistencias), `tables_without_rls[]`, `memberships_by_role`, `helpers_present` (mapa de nombre de función auxiliar → si existe).
- **Sin tablas propias ni mutaciones:** esta pantalla es 100% de solo lectura, un solo `rpc()` call.
- **Lógica de "OK" por tabla:** `ok = (t.null_clinic_id === 0 || t.table === "audit_logs") && t.non_default_clinic_id === 0` — la excepción de `audit_logs` está hardcoded en el componente.
- **Cómo agregar una verificación nueva:** la lógica de qué se calcula vive del lado de Postgres, dentro de la función `multiclinic_diagnostics()` (no en este archivo) — agregar el nuevo chequeo ahí y el frontend lo renderiza automáticamente si sigue la forma `cross_checks: Record<string, number>` o agrega una tabla a `tables[]`.
- **Cómo agregar una excepción tolerada nueva (como `audit_logs`):** agregar la condición en el cálculo de `ok` dentro de `AdminDiagnosticoMulticlinica.tsx`.

_/aprende 2026-07-06_
