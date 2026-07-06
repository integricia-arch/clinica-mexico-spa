# Almacén

> Aquí controlas el inventario de medicamentos e insumos: catálogo, existencias por lote, caducidades, mermas y los reportes de control que exige la normatividad. La usa el encargado de almacén/farmacia. _Las compras a proveedores (solicitudes, órdenes, recepción, pagos) se hacen en la pantalla "Compras" — aquí solo ves y controlas lo que ya está en existencia._

## Operación — cómo se usa

### Cómo ver el catálogo de medicamentos (vista por default)

1. Al entrar, ves el catálogo completo con la existencia total de cada medicamento (suma de todos sus lotes).
2. Usa el buscador para filtrar por nombre o categoría.

### Cómo ver qué está bajo de stock

1. Da clic en el chip **"Bajo stock"** (arriba, junto al catálogo). El número junto al chip te dice cuántos medicamentos están por debajo de su mínimo configurado.
2. El catálogo se filtra para mostrar solo esos.
3. Da clic de nuevo en el chip para quitar el filtro.

### Cómo ver qué está por caducar

1. Da clic en el chip **"Por caducar"** — muestra los lotes con existencia que caducan en los próximos 90 días.
2. El número junto al chip es cuántos lotes están en ese caso.
3. Da clic de nuevo para quitar el filtro.

### Cómo abrir los reportes y controles

1. Da clic en el menú **"Reportes y control"** (arriba, junto a los chips).
2. Elige la sección que necesitas:
   - **Faltantes** — lista de lo que hace falta reabastecer.
   - **Conteos** — inventario cíclico (conteos físicos periódicos por lote).
   - **COFEPRIS** — reporte de control sanitario.
   - **ABC / Rotación** — clasificación de medicamentos por rotación de venta.
   - **Mermas** — actas de medicamento dado de baja (caducado, dañado, robado).
   - **Reorden** — medicamentos que necesitan una nueva orden de compra (el número junto a esta opción es cuántos están bajo su mínimo).
   - **Controlados** — libro de control de medicamentos controlados (estupefacientes/psicotrópicos).
3. Da clic en **"← Volver al catálogo"** para regresar a la vista principal.

### Cómo generar una orden de compra desde Reorden

1. Entra a **Reportes y control → Reorden**.
2. Revisa los medicamentos sugeridos (los que están bajo su mínimo).
3. Genera la orden de compra — se crea directamente en el módulo de Compras, pestaña "Órdenes de Compra".

### Cómo registrar una merma

1. Entra a **Reportes y control → Mermas**.
2. Registra el acta: medicamento, lote, cantidad y motivo (caducado, dañado, robo, etc.).
3. Guarda — el sistema descuenta la existencia del lote afectado.

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** el chip "Bajo stock" compara la existencia total del medicamento (todos sus lotes sumados) contra su mínimo configurado. **Por qué:** así se detecta faltante real aunque el medicamento tenga varios lotes activos.
- **Lo que pasa:** "Por caducar" solo cuenta lotes con existencia mayor a cero y fecha de caducidad dentro de 90 días. **Por qué:** un lote agotado o ya caducado (y dado de baja) no necesita acción de tu parte.
- **Lo que pasa:** no puedes editar existencias directamente desde el catálogo. **Por qué:** las existencias solo cambian por movimientos con origen controlado — venta, recepción de compra, conteo cíclico o merma — para mantener trazabilidad completa por lote.
- **Lo que pasa:** el libro de Controlados es una sección aparte, no mezclada con el catálogo general. **Por qué:** los medicamentos controlados requieren bitácora propia por regulación sanitaria (COFEPRIS).

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No veo la pestaña de Inventario dentro de Farmacia | El catálogo e inventario se movieron a la pantalla "Almacén" | Ve al menú lateral y entra a "Almacén" |
| El número del chip "Bajo stock" no baja aunque ya recibí mercancía | La recepción de la compra aún no se ha confirmado en Compras | Ve a Compras → Recepción y confirma la entrada de mercancía |
| Un medicamento aparece en "Por caducar" pero ya no tengo | La pantalla no se refrescó | Recarga la página (F5) |
| No encuentro dónde generar una orden de compra desde aquí | Se genera desde Reportes y control → Reorden, no desde el catálogo directo | Abre "Reportes y control" → "Reorden" |

## Implementación — para el siguiente dev/agente

- **Archivo(s) principal(es):** `src/pages/Almacen.tsx` (carga medicamentos + lotes), `src/features/almacen/AlmacenTabs.tsx` (chips + dropdown + switch de vistas)
- **Subcomponentes de vista:** `CatalogoMedicamentos.tsx`, `FaltantesPanel.tsx`, `CaducidadesPanel.tsx`, `InventarioCiclico.tsx`, `ReporteCOFEPRIS.tsx`, `ReporteRotacionABC.tsx`, `ActasMerma.tsx`, `LibroControlControlados.tsx` (todos en `src/features/almacen/`); `PuntoReorden.tsx` vive en `src/features/compras/` pero se usa dentro de Almacén
- **Tablas Supabase:** `medicamentos`, `lotes_medicamento`, `movimientos_inventario`, y las que consuma cada reporte (conteos cíclicos, actas de merma, libro de controlados — confirmar nombres exactos en cada subcomponente antes de migrar)
- **Cómo agregar un campo nuevo:** migración sobre `medicamentos`/`lotes_medicamento` + actualizar `select` en `Almacen.tsx` + el subcomponente correspondiente + regenerar `types.ts`
- **Cómo agregar una regla de negocio nueva (ej. nuevo umbral de "por caducar"):** el cálculo de `bajosStock`/`proxCaducidad` vive en `AlmacenTabs.tsx` (frontend, solo visual); si la regla debe ser inviolable (bloquear una venta, por ejemplo), debe reforzarse también en el RPC/trigger que descuenta inventario, no solo aquí

_/aprende 2026-07-06_
