# Inteligencia BI

> Aquí ves de un vistazo cómo va la clínica: citas, ventas de farmacia, inventario y dinero que se debe a proveedores. Es para administradores y gerentes — si eres cajero, recepcionista o médico, no vas a tener acceso a esta pantalla.

## Operación — cómo se usa

### Cómo cambiar el período que estás viendo

1. Arriba a la derecha, abre el selector que dice "Este mes" (o el período que esté activo).
2. Elige: **Este mes**, **Mes anterior**, **Últimos 3 meses**, o **Este año**.
3. Todas las tarjetas y gráficas de la pantalla se actualizan solas con el nuevo período.

### Cómo actualizar los datos

1. Da clic en el botón **Actualizar** (arriba a la derecha, junto al selector de período).
2. Mientras carga, el ícono gira — espera a que termine.
3. Si algo salió mal, ves un aviso en rojo arriba diciendo "Error cargando datos".

### Cómo leer las pestañas

La pantalla tiene 5 pestañas, cada una con su tema:

1. **Resumen** — lo más importante de todo: citas, ventas, pacientes nuevos, cancelaciones, stock bajo y deudas a proveedores, todo junto.
2. **Agenda** — el detalle de las citas: cuántas se confirmaron, cuántas se cancelaron, cuántas fueron "no show" (el paciente no llegó), y cómo le va a cada médico.
3. **Farmacia** — el detalle de las ventas: ticket promedio, número de transacciones, ventas por día, y el top 10 de productos que más venden.
4. **Inventario** — qué medicamentos están por debajo de su mínimo de stock, y qué lotes están por caducar en los próximos 30 días.
5. **Finanzas** — cuánto le debes a proveedores en total y cuánto de eso ya está vencido.

Si hay algo urgente, lo ves directo en el nombre de la pestaña: un número naranja en "Inventario" indica cuántos medicamentos están bajos de stock, y un punto rojo en "Finanzas" indica que hay deuda vencida.

### Cómo interpretar las tarjetas con porcentaje

Varias tarjetas (como "Citas en período" o "Ventas farmacia") muestran una flecha verde o roja con un porcentaje debajo del número principal.

- **Flecha verde hacia arriba:** subió respecto al período anterior — es buena noticia si el indicador es algo que quieres que crezca (citas, ventas).
- **Flecha roja hacia abajo:** bajó respecto al período anterior.
- En indicadores donde "menos es mejor" (como % de cancelación o stock bajo mínimo), la flecha se invierte: que baje es lo bueno y se marca en verde.

### Cómo revisar qué medicamentos necesitas reabastecer

1. Ve a la pestaña **Inventario**.
2. En la tabla "Stock bajo mínimo" ves cada medicamento, su categoría, cuánto tienes ahora y cuánto debería ser el mínimo.
3. Si el stock actual aparece en rojo y dice "0", significa que no tienes nada de ese medicamento.

### Cómo revisar lotes próximos a caducar

1. En la misma pestaña **Inventario**, baja a la tabla "Lotes por vencer en 30 días".
2. Cada fila muestra el medicamento, el número de lote, la fecha de caducidad, cuánto queda en existencia, y los días restantes.
3. Si la etiqueta de días dice "Vencido" o tiene fondo rojo, actúa primero sobre esos.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** Solo administradores y gerentes pueden ver esta pantalla; cualquier otro rol ve el mensaje "Acceso restringido a administradores".
  **Por qué:** La información financiera y de desempeño de médicos es sensible y solo le sirve a quien toma decisiones de negocio.
- **Lo que pasa:** Las tarjetas de "% Cancelación" y "Stock bajo mínimo" muestran la flecha en verde cuando el número baja, no cuando sube.
  **Por qué:** En esos casos un número más bajo es lo deseable (menos cancelaciones, menos faltantes), así que el sistema invierte el color para que no confunda.
- **Lo que pasa:** Una cita cuenta como "confirmada" si su estatus es confirmada, confirmada por el paciente, confirmada por el médico, o si ya se le envió un recordatorio.
  **Por qué:** Todas esas etapas significan que la cita sigue en pie, solo en distintos momentos del proceso de confirmación.
- **Lo que pasa:** El top 10 de productos y el stock se calculan sobre la clínica activa (la que tienes seleccionada en el sistema), no sobre todas las clínicas a la vez.
  **Por qué:** Cada clínica maneja su propio inventario y sus propias ventas; mezclar datos de varias clínicas daría números que no sirven para decidir nada en una sucursal específica.
- **Lo que pasa:** Las cuentas por pagar (CxP) solo cuentan facturas en estatus "pendiente" o "parcial".
  **Por qué:** Las facturas ya pagadas no representan una deuda real, así que no se incluyen en el total que ves.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No puedo entrar a esta pantalla | Tu rol no es administrador ni gerente | Pide a un administrador que revise tu rol si crees que deberías tener acceso |
| Los números no cambian aunque cambié de período | El sistema sigue cargando | Espera unos segundos; si el ícono de "Actualizar" sigue girando, dale tiempo antes de tocar otra cosa |
| Veo "Error cargando datos" arriba en rojo | Hubo un problema de conexión al traer la información | Da clic en "Actualizar"; si persiste, recarga la página (F5) |
| Un medicamento ya no debería aparecer en "Stock bajo mínimo" pero sigue ahí | Acabas de recibir mercancía pero la pantalla no se ha vuelto a cargar | Da clic en "Actualizar" |
| Las ventas de farmacia no incluyen una venta que hice hoy | Solo se cuentan ventas con estatus "completada" | Verifica que el cobro se haya cerrado correctamente en Caja/Farmacia |
| No veo la pestaña "Finanzas" con datos | No hay facturas de proveedor pendientes o vencidas en este momento | Es normal — significa que no debes nada pendiente ahora |


## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/BI.tsx` (5 tabs: resumen, agenda, farmacia, inventario, finanzas)
- **Hook de datos:** `src/hooks/useBI.ts` — un solo `Promise.all` con 11 queries paralelas a Supabase, recalcula todo en memoria (no hay vista materializada ni RPC agregador)
- **Control de acceso:** `useAuth().hasRole("admin") || hasRole("manager")` directamente en `BI.tsx` — no hay RLS adicional específica de BI, depende de las políticas normales de las tablas consultadas
- **Tablas Supabase involucradas:** `appointments`, `pharmacy_sales`, `pharmacy_sale_items`, `patients`, `doctors`, `medicamentos`, `lotes_medicamento`, `facturas_proveedor`
- **Períodos:** `Periodo = "mes_actual" | "mes_anterior" | "3_meses" | "anio"`, calculados en `rangoFechas()`; la comparación "vs período anterior" siempre usa el mes calendario anterior al `desde` del rango (no es un período equivalente para "3_meses" o "anio")
- **Set de estatus "confirmada":** constante `CONFIRMED` en `useBI.ts` (`confirmada`, `confirmada_paciente`, `confirmada_medico`, `recordatorio_enviado`) — si se agrega un nuevo estatus de confirmación al flujo de citas, agregarlo aquí también
- **Cómo agregar un KPI nuevo:** agregar el campo a `BIResumen`, calcularlo en `load()` dentro de `useBI.ts`, y renderizar con el componente `KpiCard` en el tab correspondiente de `BI.tsx`
- **Cómo agregar una regla de negocio nueva (ej. nuevo umbral o alerta):** toda la lógica de cálculo vive en el frontend (`useBI.ts`), no hay validación ni agregación en RPC/Postgres — si el volumen de datos crece, considerar mover estos cálculos a una vista o función SQL

