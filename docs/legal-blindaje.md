# Blindaje Legal — Integriclinica (integrika.mx)

> ⚠️ Documento de análisis interno. NO es asesoría legal. Cada punto marcado como
> "requiere abogado" debe ser revisado por un profesional antes de implementar.
>
> Última revisión: 2026-06-22

---

## Contexto del producto

- **App:** SaaS de gestión de clínica médica (Integriclinica / integrika.mx)
- **Mercado primario:** México
- **Datos que maneja:** datos de salud (expedientes, diagnósticos, recetas, historial médico)
  → Clasificados como **datos sensibles** bajo LFPDPPP
- **Canales:** Web (Cloudflare Workers) + Bot Telegram con LLM
- **Usuarios:** clínicas (B2B) y pacientes indirectamente
- **Subida de documentos:** sí (expedientes, CFDIs, recepciones de mercancía)

---

## Análisis por punto — Marco original (EE.UU.) vs. realidad México

El documento de referencia usó marco legal de EE.UU. (FTC, CCPA, DMCA). Aquí está
el análisis de qué aplica realmente y con qué urgencia.

---

## 🔴 CRÍTICO — Punto 3: LFPDPPP (privacidad de datos de salud)

**Marco original:** App Privacy (Apple/Google) + CCPA
**Marco real:** Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)

### Por qué es urgente

Los datos de salud son **datos sensibles** bajo LFPDPPP (Art. 3, fracción VI).
Su tratamiento requiere:
- Aviso de Privacidad formal (obligatorio, Art. 15-18)
- Consentimiento **explícito** del titular (Art. 9) — no basta el implícito
- Medidas de seguridad técnicas y administrativas (Art. 19)
- Limitación de finalidad: solo usar los datos para lo que se declaró

### Riesgo si no se hace

- Sanciones del INAI (Instituto Nacional de Transparencia, Acceso a la
  Información y Protección de Datos Personales)
- Multas de 100 a 320,000 días de salario mínimo (Art. 64 LFPDPPP)
- En caso de datos sensibles: se duplican (Art. 65)
- Reputacional: clínicas pueden terminar contratos si se enteran de incumplimiento

### Qué falta actualmente

- [ ] Aviso de Privacidad publicado en integrika.mx
- [ ] Mecanismo de consentimiento explícito al registrar paciente
- [ ] Política de retención y eliminación de datos
- [ ] Registro de actividades de tratamiento (interno)
- [ ] Cláusula en contratos con clínicas sobre responsabilidad de datos

### Elementos del Aviso de Privacidad (LFPDPPP Art. 16)

El aviso debe incluir obligatoriamente:
1. Identidad y domicilio del responsable
2. Finalidades del tratamiento
3. Datos que se recaban (incluyendo sensibles)
4. Transferencias a terceros (Supabase como encargado — aplica)
5. Medios para ejercer derechos ARCO (Acceso, Rectificación, Cancelación, Oposición)
6. Cómo y cuándo puede el titular revocar el consentimiento
7. Mecanismo para limitar el uso o divulgación de datos

> ⚠️ Requiere abogado especializado en LFPDPPP para redactar el aviso formal.

---

## 🟡 MEDIO — Punto 2: Términos de Servicio con cláusula de arbitraje

**Marco original:** Arbitration clause + class action waiver (EE.UU.)
**Marco real:** Código de Comercio mexicano, Arts. 1415-1463 (arbitraje comercial)

### Por qué aplica

El producto es B2B (clínicas pagan por el SaaS). Sin ToS:
- No hay acuerdo formal sobre uso aceptable
- No hay limitación de responsabilidad
- No hay definición de SLA ni consecuencias por incumplimiento
- Una clínica inconforme puede demandar por daños sin ningún limitante

### Qué incluir en ToS (mínimo)

- [ ] Descripción del servicio y sus limitaciones
- [ ] Limitación de responsabilidad (disclaimers)
- [ ] Cláusula de arbitraje individual (CANACO o similar en MX)
- [ ] Ley aplicable: México, estado donde opera la empresa
- [ ] Propiedad intelectual
- [ ] Suspensión/terminación del servicio
- [ ] Modificaciones a los términos

> ⚠️ Las acciones colectivas en México están reguladas por el Código Federal de
> Procedimientos Civiles (Arts. 578-626). Una cláusula de arbitraje bien redactada
> reduce — no elimina — este riesgo.
>
> ⚠️ Requiere abogado para redacción.

---

## 🟡 MEDIO-BAJO — Punto 1: Claims de IA (LFPC equivalente)

**Marco original:** FTC — AI Washing
**Marco real:** Ley Federal de Protección al Consumidor (LFPC), Art. 32 (publicidad engañosa)

### Situación actual del app

El app tiene:
- Bot de Telegram con LLM integrado
- Campo `rol: asistente_ia` en tabla `ayuda_chat_mensajes`
- UI de chat de ayuda pendiente

### Qué evitar

- Anunciar "IA" en marketing si el bot usa lógica simple de reglas sin LLM
- Afirmar precisión de diagnóstico asistido sin datos que lo respalden
- Implicar que la IA reemplaza criterio médico

### Qué hacer

- [ ] Revisar copy de landing/marketing: cada afirmación de IA debe ser demostrable
- [ ] Agregar disclaimer visible en el bot cuando responde con IA: "Respuesta generada
  por IA. Consulta siempre con un profesional médico."
- [ ] No llamar "diagnóstico" a ninguna sugerencia de IA

> Sin marketing activo de IA, urgencia es baja. Revisar cuando se lance el chat IA.

---

## 🟢 BAJO — Punto 4: DMCA / Derechos de autor en contenido subido

**Marco original:** DMCA § 512 (EE.UU.)
**Marco real:** Ley Federal del Derecho de Autor (LFDA) — México

### Situación real

El app maneja:
- Expedientes médicos (documentos clínicos — no suele haber contenido con copyright)
- CFDIs (documentos fiscales — sin copyright relevante)
- Imágenes de recetas / recepciones (funcionales)

### Valoración

En su forma actual, el riesgo de infracción de copyright de terceros es **muy bajo** —
no es una plataforma de contenido público ni de medios.

**No es prioritario.** Revisar si en el futuro se permite subir contenido multimedia libre.

---

## Resumen de prioridades

| # | Acción | Urgencia | Requiere abogado |
|---|--------|----------|-----------------|
| 1 | Aviso de Privacidad LFPDPPP en integrika.mx | 🔴 URGENTE | Sí |
| 2 | Consentimiento explícito al registrar paciente en el app | 🔴 URGENTE | No (técnico) |
| 3 | Términos de Servicio con cláusula de arbitraje | 🟡 Pronto | Sí |
| 4 | Disclaimer de IA en el bot Telegram | 🟡 Pronto | No (técnico) |
| 5 | Limitación de responsabilidad en landing page | 🟡 Pronto | Parcial |
| 6 | Revisar claims de IA en marketing cuando aplique | 🟢 Eventual | No |
| 7 | Agente DMCA / LFDA | 🟢 Bajo | No urgente |

---

## Referencias oficiales (México)

- LFPDPPP: https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf
- INAI (regulador): https://home.inai.org.mx
- Guía INAI para Aviso de Privacidad: https://micrositios.inai.org.mx/avisodeprivacidad/
- LFPC (Art. 32 publicidad engañosa): https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf
- Arbitraje comercial MX: https://www.diputados.gob.mx/LeyesBiblio/pdf/CCo.pdf (Arts. 1415+)
