# Caja

> Pantalla general de gestión de turno y corte de caja para cajeros que no trabajan en el punto de venta de Farmacia (ej. recepción, otras cajas de la clínica). Tiene dos pestañas: "Turno" (abrir/cerrar tu turno) y "Corte de caja" (ver el historial de cortes).

## Operación — cómo se usa

### Cómo abrir tu turno (pestaña "Turno")

1. Entra a "Caja". Si no tienes turno abierto, verás el formulario de apertura.
2. Elige tu caja (si solo hay una, ya viene seleccionada) y el monto de apertura (viene precargado con el fondo default de esa caja, pero puedes ajustarlo).
3. Agrega una nota de apertura si quieres dejar constancia de algo.
4. Da clic en **"Abrir turno"**.

### Cómo saber que tu turno está activo

Cuando tienes turno abierto, arriba de la pantalla ves el nombre de la caja y la etiqueta verde "Abierto". El botón **"Cerrar turno"** aparece siempre visible en la esquina superior derecha, sin importar en qué pestaña estés.

### Cómo cerrar tu turno

1. Da clic en **"Cerrar turno"**.
2. Cuenta el efectivo físico que tienes y captúralo — el sistema no te muestra el monto esperado antes de que captures tu conteo.
3. Confirma — el sistema compara tu conteo contra lo esperado y te muestra si hay diferencia.
4. Si la diferencia supera el umbral configurado para la clínica, no podrás cerrar solo — necesitas la autorización de un supervisor presente.
5. Al cerrar, el sistema genera automáticamente el folio del corte Z (el corte oficial de cierre) y te ofrece imprimir el acta de arqueo.

### Cómo consultar el historial de cortes (pestaña "Corte de caja")

1. Entra a la pestaña "Corte de caja".
2. En la lista de la izquierda ves los últimos turnos (abiertos y cerrados) con su fondo y folio de corte.
3. Da clic en cualquiera para ver su detalle a la derecha: fondo de apertura, cobros en efectivo, esperado, contado y la diferencia.
4. Usa **"Imprimir"** para sacar una copia del corte seleccionado.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** el conteo de cierre se pide antes de mostrar el monto esperado. **Por qué:** para que el conteo sea real y no un ajuste hecho a partir de lo que "debería" haber.
- **Lo que pasa:** si la diferencia entre lo contado y lo esperado es mayor al umbral configurado, el cierre queda bloqueado hasta que un supervisor lo autorice presencialmente. **Por qué:** evita que faltantes o sobrantes grandes pasen sin que nadie se entere ni los explique.
- **Lo que pasa:** no puedes cerrar un turno que no abriste tú. **Por qué:** cada turno queda ligado al cajero que lo abrió, para que la responsabilidad del corte sea clara.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo el formulario de apertura de turno | Ya tienes un turno abierto en esta caja | Revisa la parte superior de la pantalla — ahí está el botón "Cerrar turno" |
| No puedo cerrar mi turno, dice que la diferencia es muy grande | Hay más o menos efectivo del que debería haber según el sistema | Busca a tu supervisor — necesita autorizar el cierre contigo presente |
| No encuentro el corte de un turno anterior | La lista de "Corte de caja" solo muestra los últimos turnos | Usa el buscador/scroll de la lista; si no aparece, puede ser muy antiguo — pide apoyo técnico |
| No aparece la opción "Sin cajas configuradas" | No hay ninguna caja dada de alta para esta clínica | Pide al administrador que configure al menos una caja en Configuración → Caja |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/Caja.tsx` (dos tabs: `turno` → `CajaTurno.tsx`, `corte` → `CorteTurno.tsx`)
- **Guard de turno:** `src/components/TurnoGuard.tsx` (`useTurno()`) controla el botón "Cerrar turno" visible en el header
- **Ver detalle completo del flujo de apertura/cierre, umbral de diferencia y folios Z/X:** `docs/manual-usuario/caja-turno.md`
- **Tablas Supabase:** `turnos`, `cortes`, `cajas`, `fondos_movimientos`
- **Cómo agregar un campo nuevo:** migración sobre `turnos`/`cortes` + actualizar `select` en `CajaTurno.tsx`/`CorteTurno.tsx` + regenerar `types.ts`
- **Cómo agregar una regla de negocio nueva:** la validación del umbral de diferencia vive en el RPC `turno_close` (Postgres) — agregar ahí, no solo en el frontend

_/aprende 2026-07-06_
