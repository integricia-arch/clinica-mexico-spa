---
slug: corte-de-caja-farmacia
title: "Corte de caja en farmacia de clínica: cómo hacerlo sin diferencias"
authors: [integrika]
tags: [farmacia, corte-de-caja, punto-de-venta]
description: "Cómo estructurar el corte de caja de una farmacia dentro de una clínica: conteo ciego, folio de corte Z, umbral de diferencia y egresos de fondo fijo."
date: 2026-07-21
---

El corte de caja en la farmacia de una clínica casi siempre se hace igual: al final del turno, el cajero suma lo que vendió el sistema, cuenta el efectivo, y si no coincide, "se ajusta" a ojo. El problema es que ese método no detecta el error — lo esconde.

{/* truncate */}

## Por qué el orden del conteo importa

La diferencia entre un corte que funciona y uno que no está en una sola decisión: **¿el cajero cuenta el efectivo antes o después de ver cuánto debería tener?**

Si el sistema le muestra primero "deberías tener $4,850" y luego le pide contar, el cerebro humano ajusta el conteo para que coincida — sin darse cuenta, sin mala fe. Es un sesgo de anclaje bien documentado. El resultado es un corte que "cuadra siempre" aunque en realidad esté mal, porque el conteo dejó de ser una verificación independiente.

**Conteo ciego** significa invertir el orden: el cajero cuenta primero, captura el conteo, y solo entonces el sistema le muestra el esperado y la diferencia. Esa diferencia — si existe — es información real, no un número que el cajero fabricó para que cuadrara.

## Las piezas de un corte de caja correcto

**Folio consecutivo por corte.** Cada corte Z (cierre de turno) debe tener un folio único, generado por una secuencia de base de datos — no un número que el cajero escribe a mano. Esto vuelve auditable el historial completo: no se puede "perder" un corte ni duplicar un folio.

**Umbral de diferencia configurable.** No todas las diferencias son iguales. $5 de diferencia puede ser redondeo; $500 es una señal de alarma. Un sistema bien diseñado permite fijar un umbral por clínica y, si se excede, bloquea el cierre hasta que un supervisor lo autorice con su PIN — no con su usuario y contraseña completos, que suele estar bloqueado desde otra pantalla.

**Egresos e ingresos del fondo, registrados en el momento.** Si durante el turno se saca dinero de la caja para pagar algo urgente (un mensajero, una compra menor), ese movimiento tiene que quedar registrado ahí mismo, con motivo, y no reconstruirse de memoria al cierre.

**Corte X disponible sin cerrar turno.** A veces se necesita saber cuánto hay en caja a media jornada, sin terminar el turno. Un corte X (intermedio, no definitivo) permite esa verificación sin interrumpir la operación.

**IVA proporcional correcto en cada venta.** En una farmacia mexicana no todo lleva IVA (muchos medicamentos están exentos o a tasa 0%), así que el corte de caja tiene que reflejar la mezcla real de tasas de cada venta — no aplicar un IVA plano a todo el total del día.

## Qué revisar si su clínica ya usa un sistema

Si el sistema actual muestra el total esperado antes de pedir el conteo físico, el corte de caja no está protegiendo contra nada — es una formalidad. Vale la pena preguntar directamente: "¿en qué orden pide los datos el sistema al cerrar turno?"

Un corte de caja de farmacia bien diseñado no busca atrapar a nadie — busca que, cuando hay una diferencia real, se sepa el mismo día, con el turno todavía fresco en la memoria de quien estuvo en caja, y no tres semanas después al hacer cuentas generales.
