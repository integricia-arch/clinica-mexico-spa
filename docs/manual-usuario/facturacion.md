# Facturación CFDI

> Aquí emites, consultas y cancelas las facturas fiscales (CFDI) de la clínica. La usa administración o quien lleve la parte de facturación — no se necesita ser contador para usarla, pero sí tener a la mano los datos fiscales del paciente o empresa que pide factura.

## Operación — cómo se usa

### Cómo emitir una factura nueva

1. Da clic en **"Nueva factura CFDI"**.
2. Captura los datos del receptor (quien recibe la factura):
   - **RFC** — si ya facturaste antes a esa persona o empresa, da clic en la lupa junto al RFC y el sistema rellena sus datos automáticamente.
   - **CP fiscal**, **Nombre o razón social** (debe ir exactamente como está registrado ante el SAT), **Régimen fiscal** y **Uso CFDI**.
   - **Email** (opcional) — si lo capturas, ahí se puede enviar la factura después.
3. Agrega uno o más conceptos: elige la clave SAT del servicio o producto, escribe la descripción, cantidad, valor unitario (sin IVA) y la tasa de IVA (16%, 8% frontera, 0% o exento).
4. Elige el **método de pago** (PUE si ya te pagaron completo, PPD si es a crédito/parcialidades) y la **forma de pago** (efectivo, tarjeta, transferencia, etc.).
5. Revisa el total al final del formulario.
6. Da clic en **"Timbrar CFDI"** — el sistema lo envía al SAT. Si todo sale bien, verás el UUID fiscal (el folio oficial del SAT) y la factura aparece en la lista.

**Si no tienes alguno de estos datos del paciente (RFC, CP fiscal, nombre exacto), no podrás timbrar** — son obligatorios para que el SAT acepte la factura.

### Cómo emitir una factura global (público en general)

Úsala para las ventas del día/periodo que nadie pidió facturar a su nombre (ej. ventas de mostrador en farmacia).

1. Da clic en **"Global"**.
2. Elige el periodo (periodicidad, mes, año) que cubre esta factura.
3. Agrega los conceptos con sus importes — el receptor ya viene fijo como "PÚBLICO EN GENERAL", no necesitas capturar datos fiscales de nadie.
4. Da clic en **"Timbrar factura global"**.

### Cómo buscar una factura

Escribe en el buscador el nombre del receptor, su RFC, el UUID fiscal o el folio — la lista se filtra mientras escribes.

### Cómo descargar el XML o PDF de una factura

1. Da clic en los tres puntos (**⋯**) al final de la fila de esa factura.
2. Elige **"Descargar XML"** o **"Descargar PDF"**.

**Nota:** el PDF solo está disponible si la factura ya tiene un identificador del PAC (el proveedor que la timbró ante el SAT) — si la opción aparece apagada, intenta de nuevo en unos minutos o usa el XML.

### Cómo enviar una factura por email

1. En el menú de los tres puntos, elige **"Enviar por email"**.
2. Si el receptor ya tiene un correo guardado en el catálogo, aparece prellenado — puedes cambiarlo para este envío.
3. Da clic en **"Enviar"**. Se manda el XML, y el PDF si está disponible.

### Cómo cancelar una factura

1. En el menú de los tres puntos de la factura **vigente**, elige **"Cancelar CFDI"**.
2. Elige el **motivo de cancelación**:
   - **01** — la factura tenía errores y la vas a sustituir por otra (debes capturar el UUID de la factura nueva que la corrige).
   - **02** — la factura tenía errores y no hay sustituta.
   - **03** — la operación nunca se realizó.
   - **04** — esta venta ya quedó incluida en una factura global.
3. Confirma. **Esta acción no se puede deshacer** — la factura queda cancelada ante el SAT.
4. Si el motivo es 01, es posible que el SAT le pida al receptor que acepte la cancelación. La factura queda en estado "Cancelación pendiente" — usa **"Verificar acuse receptor"** en el mismo menú para revisar si ya la aceptó.

### Cómo registrar un pago de una factura a crédito (REP)

Esto aplica solo a facturas con método de pago **PPD** (pago en parcialidades o diferido) que sigan vigentes.

1. En el menú de los tres puntos, elige **"Registrar pago (REP)"**.
2. Captura la fecha del pago, la forma de pago, el importe pagado y el saldo anterior.
3. El sistema calcula el saldo insoluto (lo que queda pendiente) automáticamente.
4. Da clic en **"Timbrar REP"**.

### Cómo emitir una nota de crédito

Para cuando necesitas restarle valor a una factura ya emitida (ej. una devolución parcial).

1. En el menú de los tres puntos de la factura de ingreso, elige **"Nota de crédito"**.
2. Revisa que el CP fiscal del receptor esté capturado (si falta, complétalo).
3. Agrega los conceptos a acreditar con su importe.
4. Da clic en **"Emitir nota de crédito"**.

**Solo puedes emitir una nota de crédito si la factura original ya tiene un UUID fiscal válido.**

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** no puedes timbrar si falta el RFC, el nombre o el CP fiscal del receptor. **Por qué:** son datos obligatorios que exige el SAT — sin ellos la factura se rechaza.
- **Lo que pasa:** una vez cancelada, una factura no se puede "revivir". **Por qué:** la cancelación es un trámite oficial ante el SAT, no solo un cambio en el sistema.
- **Lo que pasa:** "Descargar PDF" puede aparecer apagado. **Por qué:** el PDF lo genera el PAC (el proveedor de timbrado) después de timbrar; si todavía no está listo, no se puede descargar.
- **Lo que pasa:** "Registrar pago (REP)" y "Nota de crédito" solo aparecen en ciertas facturas. **Por qué:** REP solo aplica a facturas a crédito (PPD) vigentes, y la nota de crédito solo a facturas de ingreso vigentes con UUID fiscal — si la factura no cumple, esas opciones no se ofrecen porque no aplican.
- **Lo que pasa:** al cancelar con motivo "01" tienes que escribir el UUID de la factura sustituta. **Por qué:** el SAT necesita saber qué factura nueva corrige a la que estás cancelando.
- **Lo que pasa:** la factura global no te pide datos del paciente. **Por qué:** está pensada para ventas sin un receptor identificado — usa el RFC genérico de público en general que exige el SAT.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| No puedo timbrar, dice que falta el RFC o el CP fiscal | El receptor no tiene esos datos capturados | Pide el RFC y CP fiscal al paciente o empresa antes de timbrar |
| El botón de "Descargar PDF" está apagado | La factura no tiene aún el identificador del PAC | Espera unos minutos y vuelve a intentar, o descarga el XML mientras tanto |
| No veo la opción "Registrar pago (REP)" en una factura | La factura no es PPD, o ya está cancelada | Verifica el método de pago de la factura original; REP solo aplica a PPD vigentes |
| No veo la opción "Nota de crédito" | La factura no tiene UUID fiscal, ya está cancelada, o no es de ingreso | Revisa el estado y tipo de la factura original |
| Cancelé una factura por error | La cancelación es irreversible en el sistema | Si la operación sí se realizó, vuelve a timbrar una factura nueva con los mismos datos |
| La factura quedó en "Cancelación pendiente" y no avanza | El receptor todavía no acepta la cancelación ante el SAT | Da clic en "Verificar acuse receptor" después de un tiempo para revisar si ya cambió de estado |
| Al enviar por email me dice que el formato es inválido | El correo capturado no tiene el formato correcto | Revisa que el email tenga arroba y dominio, ej. `nombre@dominio.com` |


## Implementación — para el siguiente dev/agente

- **Archivo principal:** `src/pages/Facturacion.tsx`
- **Subcomponentes (dialogs):** `src/features/facturacion/TimbrarCFDIDialog.tsx` (timbrado nuevo, tipo I), `FacturaGlobalDialog.tsx` (público en general, RFC fijo `XAXX010101000`), `NotaCreditoDialog.tsx` (tipo E, requiere `cfdi_relacionado_uuid` + `tipo_relacion: "01"`), `RegistrarPagoREPDialog.tsx` (complemento de pagos para PPD), `EnviarEmailCFDIDialog.tsx`
- **Tablas Supabase:** `cfdi_documentos`, `cfdi_config` (CP emisor), `cfdi_receptores` (catálogo de RFC/datos fiscales reutilizables, con `uso_cfdi_defecto` y `email_envio`)
- **Edge functions:** `cfdi-timbrar` (timbrado, usado por factura normal/global/nota de crédito), `cfdi-cancelar`, `cfdi-acuse` (verificación de acuse de cancelación), `cfdi-rep` (complemento de pagos), `cfdi-email`, `cfdi-download` (sirve XML/PDF, requiere `pac_id_externo` para PDF)
- **Cómo agregar un campo nuevo:** migración en `cfdi_documentos`/`cfdi_receptores` + actualizar el `select` en `Facturacion.tsx` (`load()`) y el formulario del dialog correspondiente + regenerar `types.ts`
- **Cómo agregar una regla de negocio nueva:** la validación de campos obligatorios (RFC, CP, UUID relacionado, etc.) vive en el frontend de cada dialog antes del `fetch`; las reglas de timbrado SAT (catálogos, estructura CFDI) viven en la edge function `cfdi-timbrar` — agregar ahí si la regla debe aplicar sin importar el dialog de origen

