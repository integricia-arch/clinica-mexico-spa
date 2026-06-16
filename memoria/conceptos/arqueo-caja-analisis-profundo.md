---
tags: [concepto, caja, arqueo, reconciliacion, auditoria]
creado: 2026-06-11
fuentes:
  - Gestiopolis — Arqueo de caja (contabilidad universitaria)
  - Sage Advice — Arqueo de caja y ejemplos
  - MyGestion — Fórmula VD = CEF + CEI + VO - OG - D - CC
  - SICAR X — 5 tips arqueo de caja
  - Manual de Caja (Hotel Cristal / SENA)
  - Microsoft Dynamics 365 Commerce — Cash Management
  - Lightspeed — Payment Reconciliation por tipo
  - Emagia — Cashier Reconciliation best practices
  - Numeric.io — Cash Reconciliation complete guide
---

# Arqueo de Caja — Análisis Profundo por Forma de Pago

> Investigación formal en libros y manuales de administración de empresas.
> Foco: qué debe reconciliarse y cómo, separado por tipo de pago.

---

## 1. Concepto Formal del Arqueo

El arqueo de caja es la **verificación física y documental de todos los valores** que se encuentran en la caja al momento del corte, comparados contra el saldo teórico que debería haber según el sistema. No es solo contar billetes — es conciliar CADA forma de pago por separado.

**Fórmula maestra:**
```
Ventas del día = Efectivo final + Efectivo inicial + Otros medios de pago - Egresos - Descuentos - Créditos
VD = CEF + CEI + VO - OG - D - CC
```

**Fórmula del efectivo esperado:**
```
Efectivo esperado = Fondo inicial
                  + Cobros en efectivo
                  + Ingresos al fondo (float entries)
                  - Egresos del fondo (tender removals)
                  - Devoluciones pagadas en efectivo
```

**Diferencia de caja (la métrica más importante):**
```
Diferencia = Efectivo contado físicamente - Efectivo esperado
  > 0 = Sobrante (exceso en caja)
  < 0 = Faltante (falta dinero)
  = 0 = Cuadrado
```

---

## 2. Categorías de Valores en el Arqueo

Un arqueo formal incluye CUATRO categorías de valores, cada una reconciliada de forma diferente:

### 2.1 Efectivo (única con diferencia física posible)

| Sub-categoría | Cómo se cuenta | Diferencia posible |
|---|---|---|
| Billetes por denominación | Físico: $1000, $500, $200, $100, $50, $20 | Sí — faltante/sobrante |
| Monedas por denominación | Físico: $10, $5, $2, $1, $0.50 | Sí |
| Ingresos al fondo | Documentos con firma | Sí si no coincide |
| Egresos del fondo | Comprobantes con motivo | Sí si no coincide |
| Devoluciones en efectivo | Comprobantes de devolución | Sí |

**Control clave:** El cajero cuenta los billetes y monedas **en presencia del supervisor**. Se cuentan DOS veces. El fondo inicial se descuenta antes de calcular las ventas del día.

### 2.2 Tarjeta de Crédito/Débito (vouchers + reporte TPV)

| Sub-categoría | Cómo se verifica | Diferencia posible |
|---|---|---|
| Vouchers físicos del TPV | Contar vouchers, sumar importes | Discrepancia si se procesó venta sin voucher |
| Reporte del terminal (lote) | Comparar total lote vs total sistema | Error del procesador o terminal |
| Settlement timing | El depósito bancario llega 1-3 días después | Diferencia temporal, NO error |
| Devoluciones en tarjeta | Las procesa el procesador, no hay efectivo | No aplica a arqueo físico |

**Control clave:** En comercios con TPV físico, el reporte de cierre del terminal debe coincidir con el total de tarjeta del sistema. Las **diferencias de tarjeta se investigan pero NO son "faltante del cajero"** — son problemas del procesador o el terminal.

**Nota importante:** Los depósitos de tarjeta llegan días después. El total de "tarjeta vendida hoy" ≠ "depósito recibido hoy". Ambos deben registrarse separados.

### 2.3 Transferencias / SPEI (verificación documental)

| Sub-categoría | Cómo se verifica | Diferencia posible |
|---|---|---|
| Comprobantes del cliente | CoDi, SPEI, foto del comprobante | Comprobante falso o incorrecto |
| Confirmación bancaria | Extracto del banco (puede ser día siguiente) | Desfase temporal normal |
| Monto correcto | Monto en comprobante vs monto en ticket | Error de captura |

**Control clave:** Las transferencias tienen **riesgo de fraude** (comprobantes falsos). Idealmente se verifica en tiempo real contra la cuenta bancaria antes de entregar el producto. Para farmacia, esto es crítico.

### 2.4 Documentos especiales

| Tipo | Descripción | Tratamiento |
|---|---|---|
| Vales de caja | Justificantes de gastos menores | No son dinero, se registran en egresos |
| Descuentos aplicados | Deben aparecer en el corte | Auditoría, no afectan caja |
| Ventas pendientes/crédito | Cobros no liquidados aún | Cuenta por cobrar, NO caja |
| Anticipos/abonos | Pagos parciales de cuenta | Pasivo, registrar separado |

---

## 3. Procedimiento Formal del Arqueo (paso a paso)

**Secuencia correcta según manuales de administración:**

1. **Cierre de operaciones** — no más ventas durante el conteo
2. **Conteo ciego** — cajero cuenta sin ver el total esperado (previene manipulación)
3. **Efectivo por denominaciones** — billetes separados por valor, monedas separadas
4. **Suma total de efectivo** físico
5. **Recolección de vouchers** de tarjeta del TPV (si aplica)
6. **Revisión de comprobantes** de transferencias recibidas
7. **Revisión de egresos** — todos los comprobantes de salidas de efectivo
8. **Revisión de ingresos** — todos los comprobantes de entradas de efectivo (que no son ventas)
9. **Cálculo de esperado** por el sistema
10. **Comparación** — físico vs. esperado = diferencia
11. **Revisión de devoluciones** — ¿cuánto se regresó en efectivo?
12. **Reconciliación tarjeta** — total sistema vs. total TPV/vouchers
13. **Reconciliación transferencias** — total sistema vs. comprobantes
14. **Firma del ACTA DE ARQUEO** — cajero y supervisor, AMBOS firman
15. **Separación del efectivo** — fondo siguiente turno vs. depósito
16. **Sobre sellado** — efectivo para depósito en sobre firmado y sellado
17. **Entrega física** — sobre a caja fuerte o supervisor

---

## 4. Documentos que Debe Generar el Sistema al Cierre

| Documento | Contenido | Firma requerida |
|---|---|---|
| **Acta de Arqueo** | Conteo por denominaciones, total físico, esperado, diferencia, firma cajero + supervisor | Cajero + Supervisor |
| **Corte Z** | Ventas por forma de pago, IVA, devoluciones, movimientos fondo, diferencia | Generado automáticamente |
| **Reporte de tarjeta** | Total cobrado en tarjeta (crédito/débito separados) vs. vouchers/TPV | Automático |
| **Reporte de transferencias** | Total cobrado por SPEI/CoDi vs. comprobantes | Automático |
| **Reporte de egresos/ingresos** | Todos los movimientos del fondo con motivo | Automático |

---

## 5. Tratamiento Contable de Diferencias

| Situación | Registro contable | Responsabilidad |
|---|---|---|
| Faltante pequeño (< umbral) | Cargo a "Quebranto de moneda" o "Diferencias de caja" | Empresa absorbe |
| Faltante grande (> umbral) | Cargo al cajero (descuento de nómina) o investigación | Cajero responsable |
| Sobrante | Abono a "Ingresos varios" / "Diferencias de caja" | Empresa |
| Sobrante recurrente | Indica posible sub-registro de ventas | Auditoría obligatoria |

---

## 6. Análisis de Gaps en clinica-mexico-spa

### Implementado correctamente ✅

- Fórmula de efectivo esperado (fondo + cobros efectivo + ingresos - egresos)
- Diferencia calculada (faltante/sobrante)
- Umbral configurable con bloqueo
- Conteo ciego obligatorio (cajero ve primero su conteo)
- Movimientos de fondo con motivo
- Desglose por forma de pago en el Corte Z
- Devoluciones registradas
- IVA desglosado

### Gaps identificados ❌

#### GAP-A: Conteo por denominaciones de billetes y monedas
**Qué falta:** En el conteo ciego, el cajero solo ingresa un número total. Los libros de administración exigen contar por denominación ($1000, $500, $200, $100, $50, $20 y monedas). Esto permite detectar errores de conteo y es requerido para el Acta de Arqueo formal.

**Impacto:** Bajo para operación diaria, alto para auditoría fiscal.

**Solución:** Agregar tabla de denominaciones en TurnoCloseWizard / ShiftPanel — el sistema suma automáticamente y el cajero solo ingresa cuántos billetes de cada denominación tiene.

---

#### GAP-B: Reconciliación de tarjeta separada del efectivo
**Qué falta:** El sistema calcula "diferencia" como `contado_efectivo - esperado_efectivo`. Pero NO verifica:
- ¿El total de tarjeta del sistema coincide con el reporte del TPV?
- ¿Los vouchers físicos suman lo mismo que el sistema?

**Impacto:** Si hay cobros de tarjeta que fallaron silenciosamente (TPV aprobó, sistema no registró o viceversa), la diferencia aparece en efectivo cuando en realidad es de tarjeta.

**Solución:** Agregar campo "Total tarjeta confirmado (TPV)" en el cierre. El cajero ingresa el total que reporta su terminal físico. Sistema compara vs. total de tarjeta registrado.

---

#### GAP-C: Reconciliación de transferencias/SPEI
**Qué falta:** El sistema suma cobros marcados como "transferencia" pero no hay verificación de comprobantes. Si un cajero marca una venta como "transferencia recibida" sin haberla recibido realmente, no hay control.

**Impacto:** Riesgo de fraude — registrar ventas con pago de transferencia falso.

**Solución:** Campo "Total transferencias confirmadas" en el cierre. Ideal: integración con webhook bancario (largo plazo). Corto plazo: cajero declara el total confirmado vs. sistema lo compara.

---

#### GAP-D: Acta de Arqueo imprimible con firma doble
**Qué falta:** El Corte Z existe pero no hay un "Acta de Arqueo" formal separada que muestre:
- Conteo de efectivo (y por denominaciones cuando esté implementado)
- Totales por forma de pago
- Firma del cajero + firma del supervisor
- Timestamp del momento del conteo físico (diferente al del cierre del sistema)

**Impacto:** Para auditorías fiscales/internas, el Acta de Arqueo firmada es el documento legal.

**Solución:** Componente `ActaArqueo` que se genera al completar el cierre, con espacio de firma para imprimir.

---

#### GAP-E: Separación del efectivo (fondo siguiente turno vs. depósito)
**Qué falta:** Al cerrar el turno, el efectivo en caja tiene dos destinos:
1. Fondo para el siguiente turno (queda en la caja)
2. Sobrante para depósito/caja fuerte

El sistema no pregunta ni registra cuánto queda de fondo para el siguiente turno vs. cuánto se deposita.

**Impacto:** El cajero del siguiente turno no sabe si el fondo que recibió es correcto o si alguien "tomó prestado" algo.

**Solución:** Paso adicional en el wizard de cierre: "¿Cuánto dejas de fondo para el siguiente turno?" El resto se registra como "para depósito". Esto conecta con la apertura del siguiente turno.

---

#### GAP-F: Devoluciones en efectivo separadas en el arqueo
**Qué falta:** Las devoluciones se registran, pero en el conteo ciego el cajero no las ve separadas. Si hizo 3 devoluciones en efectivo durante el turno, eso REDUCE el efectivo en caja pero puede parecer un faltante si el cajero no lo tiene presente.

**Impacto:** Confusión en el conteo, cajeros que creen que tienen faltante cuando en realidad hicieron devoluciones.

**Solución:** Mostrar en el paso de conteo ciego: "Has registrado $X en devoluciones en efectivo durante el turno" (informativo, visible ANTES de que ingrese su conteo, ya que no revela el esperado).

---

#### GAP-G: Cobros "pendientes" — ✅ YA CORRECTO
**Verificado:** Ambas RPCs (`turno_close` y `_tmp_fix_turno_close_fallback`) filtran con `m.estado = 'pagado'` y `ps.status = 'completed'`. Cobros pendientes nunca entran al cálculo. No hay bug.

---

## 7. Prioridad de Implementación de Gaps

| Gap | Impacto operativo | Impacto auditoría | Esfuerzo | Prioridad |
|-----|------------------|-------------------|---------|-----------|
| GAP-F: Devoluciones visibles | Alto (confusión cajero) | Medio | Bajo (UI) | 🟠 Alta |
| GAP-E: Fondo vs depósito | Alto (trazabilidad) | Alto | Medio | 🟠 Alta |
| GAP-B: Reconciliación tarjeta | Medio (si hay TPV físico) | Alto | Medio | 🟡 Media |
| GAP-C: Reconciliación transferencias | Alto (fraude) | Alto | Medio | 🟡 Media |
| GAP-D: Acta de arqueo imprimible | Bajo (operativo) | Crítico (legal) | Bajo | 🟡 Media |
| GAP-A: Denominaciones | Bajo (operativo) | Alto (formal) | Alto | 🟢 Baja |
