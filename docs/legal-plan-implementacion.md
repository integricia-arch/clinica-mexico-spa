# Plan de Implementación Legal — Integriclinica

> Complemento de `docs/legal-blindaje.md`. Separa tareas técnicas (implementables
> directamente) de tareas que requieren abogado primero.
>
> Orden: primero abogado → luego técnico. No implementar disclaimers a ciegas.

---

## Fase 1 — URGENTE: LFPDPPP (datos de salud)

### 1A. Contratar abogado para redactar Aviso de Privacidad

**Bloqueante de todo lo demás en esta fase.**

Entregables que debes pedir al abogado:
1. Aviso de Privacidad integral (HTML/texto para publicar en integrika.mx)
2. Texto de consentimiento explícito para mostrar al registrar paciente
3. Política interna de retención de datos (cuánto tiempo se guardan, cómo se eliminan)
4. Addendum para contratos con clínicas (responsabilidad sobre datos de pacientes)

Perfil del abogado: especialista en **LFPDPPP / protección de datos personales en México**.
Presupuesto estimado: $5,000–$15,000 MXN para una pyme SaaS.

---

### 1B. Técnico — Una vez que el abogado entregue los textos

#### Tarea T1: Publicar Aviso de Privacidad en integrika.mx

**Archivos a crear/modificar:**
- `src/pages/AvisoPrivacidad.tsx` — página estática con el texto del aviso
- `src/App.tsx` — agregar ruta `/aviso-privacidad`
- Footer o Login page — agregar link al aviso

```tsx
// Ruta en App.tsx (o equivalente de router)
<Route path="/aviso-privacidad" element={<AvisoPrivacidad />} />
```

**Criterio de done:** El aviso es accesible en `integrika.mx/aviso-privacidad`
sin necesidad de estar logueado.

---

#### Tarea T2: Consentimiento explícito al registrar paciente

**El flujo actual en `PacienteModal.tsx` crea el paciente sin consentimiento explícito.**

Cambios técnicos:
- Agregar checkbox "He leído y acepto el Aviso de Privacidad" antes del submit
- El checkbox debe ser requerido (no pre-marcado)
- Guardar timestamp de consentimiento en DB

**Migración de DB requerida:**
```sql
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS consentimiento_privacidad_at timestamptz,
ADD COLUMN IF NOT EXISTS consentimiento_privacidad_version text;
```

**En `PacienteModal.tsx`:**
```tsx
// Agregar en el formulario antes del botón guardar
<div className="flex items-start gap-2">
  <Checkbox
    id="consentimiento"
    required
    checked={consentimiento}
    onCheckedChange={(v) => setConsentimiento(!!v)}
  />
  <label htmlFor="consentimiento" className="text-sm text-muted-foreground">
    He leído y acepto el{" "}
    <a href="/aviso-privacidad" target="_blank" className="underline">
      Aviso de Privacidad
    </a>
    . Autorizo el tratamiento de datos de salud conforme a los fines declarados.
  </label>
</div>
```

**En el submit:**
```tsx
// Agregar al payload de insert/update
consentimiento_privacidad_at: new Date().toISOString(),
consentimiento_privacidad_version: "1.0", // cambiar cuando se actualice el aviso
```

---

#### Tarea T3: Auditar qué datos se recaban y dónde

Antes de que el abogado redacte el aviso, preparar lista de:

- [ ] Datos de pacientes: nombre, fecha nacimiento, sexo, CURP, teléfono, email, tipo sangre, alergias, diagnósticos, recetas
- [ ] Datos de doctores: nombre, usuario, rol, Google Calendar OAuth tokens
- [ ] Datos de sesión: Telegram ID, sesiones de bot
- [ ] Terceros que reciben datos: Supabase (encargado), Cloudflare (encargado), Telegram (mensajería)
- [ ] Retención actual: indefinida (no hay lógica de borrado) → necesita definirse

Esto es input para el abogado, no trabajo legal en sí.

---

## Fase 2 — PRONTO: Términos de Servicio + Disclaimers

### 2A. Contratar abogado para ToS

Entregables:
1. Términos de Servicio en español para el SaaS B2B
2. Cláusula de arbitraje (CANACO o ad-hoc)
3. Limitación de responsabilidad adaptada a software médico de apoyo

> El ToS debe dejar claro que el sistema es una **herramienta de gestión administrativa**,
> no un sistema de diagnóstico médico. Esto es crítico para limitación de responsabilidad.

---

### 2B. Técnico — Disclaimer de IA en bot Telegram

**No requiere abogado. Implementar ahora.**

En `supabase/functions/telegram-webhook/index.ts`, cuando el bot responde
con contenido generado por LLM (función que llama al modelo):

```typescript
// Después de cada respuesta de IA, agregar al final del mensaje:
const DISCLAIMER_IA = "\n\n_⚠️ Respuesta generada por IA. No sustituye criterio médico profesional._";

// En la función que envía respuesta del LLM:
const mensajeConDisclaimer = respuestaLLM + DISCLAIMER_IA;
await telegramSendMessage(chatId, mensajeConDisclaimer);
```

**Criterio de done:** Toda respuesta generada por LLM en el bot lleva el disclaimer.

---

### 2C. Técnico — Link a ToS en login

Una vez el abogado entregue el texto:
- `src/pages/TerminosServicio.tsx` — página con el texto
- `src/App.tsx` — ruta `/terminos`
- `src/pages/Login.tsx` — texto "Al ingresar, aceptas nuestros [Términos de Servicio]"

---

## Fase 3 — EVENTUAL: Auditoría de claims de IA

Cuando se active el chat de ayuda con IA (`ayuda_chat_sesiones`):

- [ ] Revisar landing page: no prometer precisión diagnóstica
- [ ] Asegurarse que la UI deja claro que es asistencia administrativa (citas, pagos, farmacia), no clínica
- [ ] Agregar disclaimer permanente en el módulo de chat IA

---

## Cronograma sugerido

```
Semana 1-2:  Contactar abogado + darle lista de datos (Tarea T3)
Semana 2:    Implementar T2 (disclaimer IA en bot) — no necesita abogado
Semana 3-4:  Abogado entrega Aviso de Privacidad
Semana 4:    Implementar T1 (página aviso) + T2 (consentimiento DB)
Semana 5-6:  Abogado entrega ToS
Semana 6:    Implementar página ToS + link en login
```

---

## Checklist final de validación

### Legal (requiere abogado)
- [ ] Aviso de Privacidad LFPDPPP redactado y revisado
- [ ] Términos de Servicio redactados y revisados
- [ ] Cláusula de responsabilidad en contratos con clínicas

### Técnico (implementable directamente)
- [ ] `/aviso-privacidad` publicado y accesible sin login
- [ ] `/terminos` publicado y accesible sin login
- [ ] Checkbox de consentimiento en registro de paciente
- [ ] Columnas `consentimiento_privacidad_at` y `_version` en tabla `patients`
- [ ] Disclaimer de IA en respuestas del bot Telegram
- [ ] Links a aviso y términos en footer y login
- [ ] Lista de datos y terceros preparada para el abogado

### No prioritario ahora
- [ ] DMCA / LFDA (bajo riesgo para este tipo de contenido)
- [ ] App Store privacy labels (cuando/si se hace app nativa)
