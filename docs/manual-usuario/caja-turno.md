# Turno de Caja

> Pantalla donde abres y cierras tu turno de trabajo en una caja, registras movimientos de efectivo durante el turno y consultas el historial de turnos anteriores. Aparece como pestaña dentro de "Caja" y dentro de "Farmacia" (tab "Cierre").

## Operación — cómo se usa

### Cómo abrir tu turno

1. Si no tienes turno abierto, verás el formulario "Abrir turno".
2. Elige la caja (si solo hay una configurada, ya viene seleccionada) y confirma o ajusta el monto de apertura (fondo).
3. Agrega una nota de apertura si quieres.
4. Da clic en **"Abrir turno"**.

_Si la caja que eliges es de farmacia, el sistema abre también, automáticamente, el turno de POS de Farmacia ligado a este mismo turno — no necesitas abrir dos veces._

### Cómo registrar un retiro o depósito de efectivo durante el turno

1. Con el turno activo, da clic en **"Egreso / Ingreso"**.
2. Elige el tipo: **Retiro/Egreso** (sacas dinero de la caja, ej. pago a proveedor) o **Depósito/Ingreso** (metes dinero, ej. cambio de billetes).
3. Captura el monto y el motivo (obligatorio).
4. Da clic en **"Registrar"** — el movimiento queda en la tabla de movimientos del turno y se suma/resta al efectivo esperado del cierre.

### Cómo generar un Corte X (reporte parcial sin cerrar)

1. Con el turno activo, da clic en **"Corte X"**.
2. Da clic en **"Generar Corte X"** — obtienes un snapshot del estado actual: cobros por método de pago, fondo de apertura, movimientos manuales netos y efectivo esperado en caja en ese momento.
3. El turno sigue abierto después de generar el Corte X — es solo informativo, no cierra nada.

### Cómo cerrar tu turno (Corte Z)

1. Da clic en **"Cerrar turno"**.
2. Cuenta el efectivo físico que tienes en ese momento y captúralo — puedes usar el contador de denominaciones para que el sistema sume por ti.
3. Agrega notas de cierre si aplica.
4. Confirma — el sistema calcula la diferencia entre lo esperado y lo contado.
5. Si la diferencia supera el umbral permitido, el sistema te pide autorización de un supervisor (queda registrado quién autorizó).
6. Al cerrar, decide cuánto fondo dejas para el siguiente cajero — el resto se marca para depósito/caja fuerte.
7. Puedes imprimir el acta de arqueo con todo el desglose.

### Cómo consultar turnos anteriores

En la sección "Historial de turnos" (siempre visible debajo del panel de turno activo) ves los últimos 20 turnos cerrados, con su corte Z y los cortes X que se hayan generado durante ese turno. Da clic sobre cualquiera para expandir el detalle.

### Cómo revisar el enlace con el POS de Farmacia

Si trabajas con cajas de farmacia, la sección "Historial de enlace con POS Farmacia" muestra los últimos eventos de vinculación entre este turno y los cortes del punto de venta de Farmacia (útil si hay dudas sobre por qué un turno no cierra o qué corte quedó ligado a cuál).

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** el conteo de cierre se captura antes de que el sistema muestre el monto esperado. **Por qué:** así el conteo es real, no un ajuste hecho viendo primero cuánto "debería" haber.
- **Lo que pasa:** si la diferencia entre lo contado y lo esperado excede el umbral de la clínica, no puedes cerrar solo. **Por qué:** protege contra faltantes/sobrantes grandes que nadie explica — un supervisor debe estar presente y autorizar.
- **Lo que pasa:** el Corte X no cierra el turno ni bloquea nada. **Por qué:** es un reporte de control intermedio (para arqueos parciales durante el día), el cierre real solo ocurre con el Corte Z.
- **Lo que pasa:** si abres un turno en una caja marcada como "es_farmacia", se abre también un turno de POS Farmacia ligado. **Por qué:** ambos sistemas de caja (general y farmacia) comparten el mismo efectivo físico — deben abrir y cerrar en sincronía para que el arqueo cuadre.
- **Lo que pasa:** no puedes cerrar un turno de caja general si el corte de farmacia ligado sigue abierto. **Por qué:** cerrar caja general primero dejaría dinero de farmacia sin reconciliar contra el mismo efectivo físico.
- **Lo que pasa:** las devoluciones en efectivo del turno se muestran como aviso antes de cerrar. **Por qué:** para que sepas que ya están incluidas en el cálculo del esperado y no dupliques el ajuste manualmente.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| Se abrió otro turno de farmacia que no esperaba | La caja que elegiste está marcada como caja de farmacia | Es normal — ambos turnos están ligados y se cierran juntos |
| No puedo cerrar mi turno, pide autorización de supervisor | La diferencia entre lo contado y lo esperado supera el umbral de la clínica | Busca a tu supervisor para que autorice el cierre contigo presente |
| Generé un Corte X pero mi turno sigue abierto | Es el comportamiento esperado — el Corte X es solo un reporte parcial | Si querías cerrar, usa el botón "Cerrar turno" en vez de "Corte X" |
| No veo movimientos de fondo aunque registré uno | La tabla de movimientos solo aparece si el turno tiene al menos uno | Confirma que el registro se guardó sin error (mensaje de confirmación) |
| No puedo abrir turno, dice "Sin cajas configuradas" | No hay cajas activas dadas de alta para tu clínica | Pide al administrador que configure al menos una caja en Configuración → Caja |

## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/CajaTurno.tsx` (incluye `CloseTurnoDialog`, `FondoMovimientoDialog`, `CorteXDialog`, `HistorialTurnos` como subcomponentes internos)
- **RPCs:** `turno_close` (cierre + cálculo de diferencia + umbral; devuelve error `DIFF_EXCEEDS_THRESHOLD|diff|umbral` si excede), `turno_fondo_movimiento` (egreso/ingreso), `turno_corte_x` (snapshot sin cerrar), `corte_set_fondo` (distribución fondo/depósito post-cierre), `pharmacy_open_shift` (abre el turno POS ligado si `es_farmacia`)
- **Autorización de supervisor:** `src/components/turno/SupervisorAuthDialog.tsx`
- **Conteo por denominaciones:** `src/components/turno/DenominacionCounter.tsx`
- **Acta de arqueo (impresión):** `src/lib/printActaArqueo.ts`
- **Tablas/vistas Supabase:** `turnos` (incluye `pharmacy_shift_id`), `cortes` (tipo `Z`/`X`, `folio_secuencial`, `requiere_autorizacion`), `fondos_movimientos`, `cajas` (`es_farmacia`, `fondo_default`), `turno_pharmacy_link_audit` (vía `restSelect`, no cliente tipado directo)
- **Cómo agregar un campo nuevo:** migración sobre `turnos`/`cortes` + actualizar el `select` correspondiente en `CajaTurno.tsx` + regenerar `types.ts`
- **Cómo agregar una regla de negocio nueva (ej. cambiar el umbral o agregar un nuevo tipo de movimiento de fondo):** la lógica de umbral y cálculo de diferencia vive en el RPC `turno_close`; el frontend solo muestra el resultado — cualquier regla que deba ser inviolable va en el RPC, no en `CajaTurno.tsx`

_/aprende 2026-07-06_
