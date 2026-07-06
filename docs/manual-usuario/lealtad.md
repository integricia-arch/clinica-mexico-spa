# Programa de Lealtad

> Aquí administras el programa de puntos con el que los pacientes acumulan y canjean recompensas en la farmacia, y consultas la lista de miembros inscritos. La usan administrador y gerente.

## Operación — cómo se usa

La pantalla tiene dos pestañas: **Miembros** y **Configuración**.

### Cómo consultar los miembros del programa (pestaña "Miembros")

1. Usa el buscador para encontrar a alguien por nombre, teléfono o correo (escribe al menos 2 caracteres).
2. En la tabla ves: nombre, contacto, nivel (Bronce, Plata, Oro, Diamante), saldo en pesos, puntos disponibles y fecha de registro.
3. Da clic en cualquier encabezado de columna (Nombre, Nivel, Puntos, Registrado) para ordenar la lista por ese campo.
4. Da clic en cualquier fila para abrir el detalle del miembro: puntos disponibles, saldo en MXN, puntos acumulados históricos, fecha de alta, código de barras (si tiene) y el historial completo de movimientos (acumulaciones y canjes, con el saldo después de cada uno).

Los miembros no se registran desde aquí — se dan de alta desde el módulo de Farmacia / Punto de Venta.

### Cómo configurar el programa (pestaña "Configuración")

1. **Programa activo** (interruptor arriba): si lo apagas, el sistema te pide confirmar — apagarlo detiene que los pacientes acumulen o canjeen puntos, pero **no borra** los puntos que ya tienen.
2. **Datos del programa:** nombre visible y el "slug" (identificador corto) que forma la URL pública del monedero del paciente (`loyalty.integrika.mx/tu-slug`).
3. **Economía de puntos:**
   - Cuántos pesos gastados equivalen a 1 punto.
   - Cuánto vale 1 punto en pesos al canjear.
   - Mínimo de puntos requerido para poder canjear.
   - Días de inactividad antes de que los puntos venzan.
4. **Umbrales de nivel:** a partir de cuántos puntos acumulados (en los últimos 12 meses) un miembro sube a Plata, Oro o Diamante. El diagrama visual te muestra el recorrido completo.
5. **Multiplicadores por nivel:** cuánto se multiplican los puntos que gana un miembro según su nivel (por ejemplo, Oro gana 1.5 veces más rápido que Bronce).
6. Da clic en **"Guardar configuración"**, o en **"Cancelar"** para descartar los cambios sin guardar.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** desactivar el programa pide confirmación antes de aplicarse.
  **Por qué:** es una acción que afecta a todos los pacientes inscritos de golpe — la confirmación evita que se apague por accidente.
- **Lo que pasa:** desactivar el programa no borra los puntos ya acumulados por los miembros.
  **Por qué:** los puntos representan un valor que el paciente ya ganó; solo se congela la posibilidad de seguir acumulando o canjeando mientras esté inactivo, no se pierde lo anterior.
- **Lo que pasa:** el umbral de Plata debe ser menor al de Oro, y el de Oro menor al de Diamante; los días de inactividad para vencimiento no pueden ser menos de 30.
  **Por qué:** son validaciones mínimas para que la escala de niveles tenga sentido (no puedes llegar a Oro con menos puntos que los que se necesitan para Plata) y para evitar configurar un vencimiento de puntos irrazonablemente corto.
- **Lo que pasa:** los miembros no se dan de alta desde esta pantalla.
  **Por qué:** el alta ocurre en el momento natural del negocio — cuando el paciente está comprando en Farmacia/POS — para no duplicar el flujo de registro en dos lugares distintos.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No puedo dar de alta un miembro nuevo desde aquí | Esta pantalla es solo de consulta y configuración | Da de alta al paciente en el programa desde el módulo de Farmacia / Punto de Venta |
| No me deja guardar la configuración, dice que un umbral es inválido | Los umbrales de nivel deben ir en orden creciente (Plata < Oro < Diamante) | Ajusta los valores para que respeten ese orden |
| Desactivé el programa y ahora los pacientes se quejan de que no acumulan puntos | Es el comportamiento esperado al desactivarlo | Vuelve a activar el interruptor "Programa activo" si fue un error |
| Un miembro no aparece en la búsqueda | Escribiste menos de 2 caracteres, o el dato no coincide exactamente | Prueba buscando por otro dato (teléfono, correo o nombre completo) |
| No sé qué significa cada nivel (Bronce, Plata, Oro, Diamante) | Son los niveles configurados según los umbrales de puntos acumulados en 12 meses | Revisa la pestaña "Configuración" para ver los umbrales actuales de cada nivel |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/Lealtad.tsx` (ruta `/lealtad`) — solo envuelve dos tabs con los componentes reales.
- **Componentes:** `src/features/lealtad/LoyaltyMiembros.tsx` (lista + búsqueda + drawer de detalle/movimientos), `src/features/lealtad/LoyaltyConfig.tsx` (formulario de configuración con kill switch).
- **Hooks:** `src/features/lealtad/hooks/useLoyaltyConfig.ts`, `src/features/lealtad/hooks/useLoyaltyMember.ts` (`getAll`, `search`, `getMovimientos`).
- **Tipos/constantes:** `src/features/lealtad/types.ts` (`NIVEL_LABEL`, `NIVEL_COLOR`, `valorCanjeMxn`).
- **Validación de formulario de configuración:** función `validateForm()` en `LoyaltyConfig.tsx` — valida slug requerido, valores positivos, orden de umbrales de nivel (Plata < Oro < Diamante), y mínimo de 30 días de inactividad.
- **Kill switch:** desactivar `programa_activo` pasa por un `AlertDialog` de confirmación (`killSwitchDialog`) antes de aplicar el cambio en el formulario — el guardado real ocurre solo al dar clic en "Guardar configuración" después.
- **Registro de miembros:** ocurre fuera de este flujo, desde `src/features/farmacia/PuntoDeVenta.tsx` (`useLoyaltyMember`, `LoyaltyPanel`) — no hay alta de miembros en `Lealtad.tsx`.
- **Cómo agregar un nivel nuevo (ej. "Platino"):** requiere cambios en el esquema de la tabla de configuración (nuevo umbral/multiplicador), en `NIVEL_LABEL`/`NIVEL_COLOR` (`types.ts`), en el formulario de `LoyaltyConfig.tsx`, y en el diagrama visual de umbrales.
- **Cómo agregar un campo de configuración nuevo:** agregar a la interfaz `FormState` y a `buildFormState()` en `LoyaltyConfig.tsx`, más la columna correspondiente en la tabla de configuración (vía `useLoyaltyConfig`).

_/aprende 2026-07-06_
