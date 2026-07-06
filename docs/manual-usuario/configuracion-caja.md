# Configuración de Caja

> Aquí registras las cajas registradoras físicas de la clínica (recepción, farmacia, etc.), su fondo de apertura predeterminado y si son de tipo farmacia. La usan el administrador y el gerente.

## Operación — cómo se usa

### Cómo ver las cajas registradas

Entra a "Configuración" → "Configuración de cajas". Verás la lista con nombre, descripción, fondo inicial predeterminado y si está Activa o Inactiva.

### Cómo crear una caja nueva

1. Da clic en **"Nueva caja"** (solo visible para administrador o gerente).
2. Escribe el nombre (obligatorio) y, si quieres, una descripción.
3. Define el **fondo de apertura predeterminado** en pesos — es el monto que se sugiere al abrir turno en esa caja.
4. Si esta caja es la de farmacia, marca la casilla **"Caja de farmacia (POS)"**: al abrir turno ahí, se abre automáticamente también el turno del Punto de Venta de Farmacia para el mismo cajero.
5. Da clic en **"Guardar"** — verás un aviso indicando que debes ir a "Caja → Turno" para abrirla.

### Cómo activar o desactivar una caja

Da clic en el interruptor junto a la caja (solo administrador o gerente). Una caja inactiva no se puede usar para abrir turno.

### Cómo abrir el turno de una caja activa

Da clic en **"Abrir turno"** junto a la caja — te lleva directo a la pantalla de Caja.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** solo el administrador o el gerente pueden crear cajas o cambiar su estado activo/inactivo.
  **Por qué:** las cajas afectan directamente el manejo de dinero de la clínica; el cajero solo las usa, no las configura.
- **Lo que pasa:** marcar una caja como "de farmacia" hace que al abrir su turno también se abra el turno del Punto de Venta de Farmacia para el mismo cajero.
  **Por qué:** evita que el cajero tenga que abrir dos turnos por separado cuando la misma caja física cobra tanto consultas como medicamentos.
- **Lo que pasa:** una caja inactiva no aparece disponible para abrir turno.
  **Por qué:** permite dar de baja una caja física (por ejemplo, si se retira del consultorio) sin perder su historial de turnos anteriores.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| Creé una caja pero no puedo cobrar todavía | Crear la caja no abre el turno automáticamente (salvo la excepción de farmacia) | Ve a "Caja" y abre el turno de esa caja |
| No veo el botón "Nueva caja" | Tu rol no es administrador ni gerente | Pide a un administrador o gerente que la cree |
| Al abrir el turno de mi caja de farmacia, también se abrió el POS de farmacia | Es el comportamiento esperado si la caja está marcada como "de farmacia" | No es un error — ambos turnos quedan ligados al mismo cajero |
| Desactivé una caja por error | El interruptor quedó en "Inactiva" | Vuelve a dar clic en el interruptor para reactivarla |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/CajaConfiguracion.tsx` (ruta `/configuracion/caja`).
- **Tabla Supabase:** `cajas` (`clinic_id`, `nombre`, `descripcion`, `fondo_default`, `activo`, `es_farmacia`).
- **RPCs/edge functions:** ninguna — CRUD directo con `supabase.from("cajas")`.
- **Control de escritura:** `canWrite = hasRole("admin") || hasRole("manager")` — oculta los botones de crear/activar-desactivar si no se cumple.
- **Relación con farmacia:** el flag `es_farmacia` es leído por la pantalla de apertura de turno (Caja/Farmacia) para decidir si debe abrir también el turno del POS de farmacia — la lógica de apertura vive fuera de este archivo.
- **Cómo agregar un campo nuevo a `cajas`:** migración `ALTER TABLE cajas ADD COLUMN ...` + actualizar `form` state, el modal de creación y regenerar `types.ts`.

_/aprende 2026-07-06_
