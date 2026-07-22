---
slug: cfdi-4-0-consultorio-medico
title: "CFDI 4.0 en el consultorio médico: errores comunes al facturar"
authors: [integrika]
tags: [cfdi, facturación, sat]
description: "Cómo timbrar CFDI 4.0 desde un consultorio médico sin errores frecuentes: régimen fiscal del receptor, uso de CFDI, complemento de pago y retención de honorarios."
date: 2026-07-21
---

Desde que el CFDI 4.0 volvió obligatorio validar el régimen fiscal exacto del receptor contra su constancia de situación fiscal, muchos consultorios empezaron a recibir rechazos del PAC que antes no existían. No es un problema del sistema de facturación — es que la validación ahora es más estricta, y los datos que antes "pasaban" ya no pasan.

{/* truncate */}

## Los tres errores más frecuentes en consultorios

**Régimen fiscal del receptor mal capturado.** El paciente da su RFC, pero el régimen fiscal que se captura no coincide con el que el SAT tiene registrado para ese RFC. El PAC rechaza el timbrado. Solución: validar el régimen contra la constancia de situación fiscal actualizada del paciente, no contra lo que dijo de memoria.

**Uso de CFDI incorrecto para gastos médicos.** Para que el paciente pueda deducir el gasto en su declaración anual, el uso de CFDI casi siempre debe ser "Gastos médicos, dentales y hospitalarios" (D01). Un consultorio que por defecto pone "Sin efectos fiscales" (S01) le hace un mal servicio al paciente sin que nadie se dé cuenta hasta abril del año siguiente.

**Complemento de pago faltante en pagos diferidos.** Si el CFDI se emitió como PPD (pago en parcialidades o diferido) y luego se recibe el pago, hace falta un segundo comprobante — el complemento de pago (REP). Omitirlo es de los incumplimientos más comunes que detecta el SAT en auditorías a consultorios.

## Por qué facturar "aparte" del cobro genera el problema

Cuando la caja del consultorio y la facturación son dos sistemas distintos, alguien tiene que capturar dos veces los mismos datos: una vez al cobrar, otra vez al facturar. Cada captura manual es una oportunidad para que el monto, el RFC o el concepto no coincidan exactamente entre el cobro real y el CFDI timbrado — lo cual genera una discrepancia que, en caso de auditoría, es difícil de explicar.

La alternativa correcta es que el CFDI se genere **desde el mismo cobro**, tomando el monto, el concepto (consulta, procedimiento, medicamento) y el método de pago directamente de la transacción original, sin retecleo.

## Honorarios de médicos: retención y modo de cobro

Un caso particular en clínicas con varios doctores: cuando el médico cobra directo al paciente (fuera de la caja de la clínica), no se genera ingreso ni póliza contable en la clínica — el CFDI, si aplica, lo emite el propio médico bajo su régimen fiscal (frecuentemente RESICO). Cuando cobra "a la clínica" y la clínica le paga honorarios después, ahí sí puede aplicar retención de ISR/IVA según el régimen del doctor. Confundir estos dos modelos es una fuente común de errores contables en clínicas con médicos que trabajan bajo distintos esquemas.

## Qué preguntar antes de elegir un sistema de facturación para consultorio

- ¿El CFDI se timbra desde el mismo cobro o hay captura duplicada?
- ¿Valida el régimen fiscal del receptor contra el RFC antes de timbrar, o solo al momento de fallar?
- ¿Genera automáticamente el complemento de pago cuando corresponde, o depende de que alguien se acuerde?

Un consultorio que factura bien no es el que nunca tiene errores — es el que los detecta antes de timbrar, no después de que el SAT los detecta por él.
