# Fase D — WhatsApp v1 (bot determinístico) + agentes supervisores — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar WhatsApp Business (Meta Cloud API) al modelo multi-tenant de Fase A: cada hospital tiene su número, un bot determinístico agenda citas (sin LLM), y un cron audita que los mensajes esperados se hayan enviado.

**Architecture:** Edge function nueva `whatsapp-webhook`, independiente de `telegram-webhook` (no se toca ese archivo). State machine puro en un módulo `_shared` con tests unitarios sin I/O. Alta/verificación de número vía RPC dedicada + botón "mensaje de prueba" en `/admin/tenants`. Auditoría vía cron `pg_cron` + edge function + tabla de alertas con RLS scoped por clínica.

**Tech Stack:** Supabase (Postgres, Edge Functions Deno, `pg_cron`), React/Vite (panel), Meta WhatsApp Cloud API.

## Global Constraints

- Toda función `SECURITY DEFINER` nueva: `SET search_path = public` +
  `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC` + `GRANT` explícito al rol
  mínimo (`authenticated`).
- Ninguna policy RLS nueva usa `USING (true)` salvo tabla explícitamente
  pública documentada — no aplica a ninguna tabla de este plan.
- No se toca `supabase/functions/telegram-webhook/index.ts` en ningún task.
- `whatsapp-webhook` no usa LLM ni tool-calling — state machine puro con
  columnas `bot_sesiones.flow_step` (text) / `bot_sesiones.flow_data`
  (jsonb), mismo patrón que ya usa Telegram.
- `appointments.status` es el enum `appointment_status`: valores reales
  `solicitada, tentativa, pendiente_formulario, confirmada,
  recordatorio_enviado, confirmada_paciente, confirmada_medico, cancelada,
  liberada`. Las citas creadas por el bot de WhatsApp usan `'solicitada'`.
- `appointments.origen` (text, ya existe) se setea a `'whatsapp'` en las
  citas creadas por este flujo.
- `identidades_canal.canal_id` (text, ya existe) se setea a `'whatsapp'`
  para identidades nuevas de este canal — no se agrega columna nueva.
- Secrets de Meta (`WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`) viven
  solo en variables de entorno de la edge function — nunca en código.

---

### Task 1: Migración — `whatsapp_status`, `whatsapp_audit_alertas`, RPC de alta de número

**Files:**
- Create: `supabase/migrations/20260707140000_whatsapp_fase_d_schema.sql`
- Test: script SQL temporal de verificación (ver Step 2)

**Interfaces:**
- Produces: columna `clinics.whatsapp_status text`; tabla
  `public.whatsapp_audit_alertas(id, clinic_id, tipo, referencia_id,
  detectado_at, resuelto, resuelto_at, resuelto_por)`; función
  `public.set_clinic_whatsapp_number(_clinic_id uuid, _phone_number_id
  text, _waba_id text) RETURNS void`; función
  `public.set_clinic_whatsapp_verified(_clinic_id uuid) RETURNS void`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260707140000_whatsapp_fase_d_schema.sql

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS whatsapp_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinics_whatsapp_status_check'
  ) THEN
    ALTER TABLE public.clinics
      ADD CONSTRAINT clinics_whatsapp_status_check
      CHECK (whatsapp_status IN ('pending','verified'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinics_whatsapp_phone_number_id
  ON public.clinics(whatsapp_phone_number_id)
  WHERE whatsapp_phone_number_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_audit_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('recordatorio_cita','resultado_laboratorio')),
  referencia_id uuid NOT NULL,
  detectado_at timestamptz NOT NULL DEFAULT now(),
  resuelto boolean NOT NULL DEFAULT false,
  resuelto_at timestamptz,
  resuelto_por uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_audit_alertas_abierta
  ON public.whatsapp_audit_alertas(tipo, referencia_id)
  WHERE resuelto = false;

GRANT SELECT, UPDATE ON public.whatsapp_audit_alertas TO authenticated;
GRANT ALL ON public.whatsapp_audit_alertas TO service_role;
ALTER TABLE public.whatsapp_audit_alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic scoped read alertas" ON public.whatsapp_audit_alertas;
CREATE POLICY "clinic scoped read alertas" ON public.whatsapp_audit_alertas
  FOR SELECT TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id));

DROP POLICY IF EXISTS "clinic scoped resolve alertas" ON public.whatsapp_audit_alertas;
CREATE POLICY "clinic scoped resolve alertas" ON public.whatsapp_audit_alertas
  FOR UPDATE TO authenticated
  USING (public.user_has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.user_has_clinic_access(auth.uid(), clinic_id));

DROP POLICY IF EXISTS "platform staff read all alertas" ON public.whatsapp_audit_alertas;
CREATE POLICY "platform staff read all alertas" ON public.whatsapp_audit_alertas
  FOR SELECT TO authenticated
  USING (public.is_global_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_clinic_whatsapp_number(
  _clinic_id uuid, _phone_number_id text, _waba_id text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_global_admin(auth.uid())
    OR public.user_has_clinic_role(auth.uid(), _clinic_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE public.clinics
  SET whatsapp_phone_number_id = _phone_number_id,
      whatsapp_business_account_id = _waba_id,
      whatsapp_status = 'pending',
      updated_at = now()
  WHERE id = _clinic_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_clinic_whatsapp_number(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_whatsapp_number(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_clinic_whatsapp_verified(_clinic_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_global_admin(auth.uid())
    OR public.user_has_clinic_role(auth.uid(), _clinic_id, 'admin')
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE public.clinics SET whatsapp_status = 'verified', updated_at = now()
  WHERE id = _clinic_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_clinic_whatsapp_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_clinic_whatsapp_verified(uuid) TO authenticated;
```

- [ ] **Step 2: Aplicar y verificar**

```bash
supabase db push --linked --include-all
```

Script de verificación (`_tmp_verify_whatsapp_schema.sql`, correr con
`supabase db query --linked --file _tmp_verify_whatsapp_schema.sql`):

```sql
CREATE TEMP TABLE verify_results (line text);

DO $$
DECLARE
  _admin_clinic uuid;
  _admin_user uuid := gen_random_uuid();
  _outsider uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email) VALUES (_admin_user, 'verify-wa-admin@test.local') ON CONFLICT DO NOTHING;
  INSERT INTO auth.users (id, email) VALUES (_outsider, 'verify-wa-outsider@test.local') ON CONFLICT DO NOTHING;

  INSERT INTO public.clinics (code, name, status) VALUES ('_test_wa_schema', 'Test WA Schema', 'active')
    RETURNING id INTO _admin_clinic;
  INSERT INTO public.clinic_memberships (user_id, clinic_id, role, status)
    VALUES (_admin_user, _admin_clinic, 'admin', 'active');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin_user)::text, true);
  PERFORM public.set_clinic_whatsapp_number(_admin_clinic, '1234567890', 'waba_test');
  INSERT INTO verify_results
    SELECT format('admin_set_number: whatsapp_status=%s phone_number_id=%s', whatsapp_status, whatsapp_phone_number_id)
    FROM public.clinics WHERE id = _admin_clinic;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _outsider)::text, true);
    PERFORM public.set_clinic_whatsapp_number(_admin_clinic, '000', 'waba_hack');
    INSERT INTO verify_results VALUES ('FAIL: outsider pudo setear numero');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO verify_results VALUES (format('PASS: outsider bloqueado (%s)', SQLERRM));
  END;

  DELETE FROM public.clinic_memberships WHERE clinic_id = _admin_clinic;
  DELETE FROM public.clinics WHERE id = _admin_clinic;
  DELETE FROM auth.users WHERE id IN (_admin_user, _outsider);
END $$;

SELECT * FROM verify_results;
```

Expected: primera fila `admin_set_number: whatsapp_status=pending
phone_number_id=1234567890`; segunda fila empieza con `PASS:`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260707140000_whatsapp_fase_d_schema.sql
git commit -m "feat: schema Fase D -- whatsapp_status, whatsapp_audit_alertas, RPCs de alta de numero"
```

---

### Task 2: Módulo puro `booking-flow.ts` (state machine, sin I/O)

**Files:**
- Create: `supabase/functions/_shared/booking-flow.ts`
- Test: `supabase/functions/_shared/booking-flow.test.ts`

**Interfaces:**
- Consumes: nada (módulo puro, sin DB ni red).
- Produces: tipo `BookingSlot { doctorId: string; servicioId: string;
  start: string }`; tipo `BookingState { step: "esperando_servicio" |
  "esperando_horario" | "esperando_confirmacion"; servicioId?: string;
  slot?: BookingSlot }`; función
  `nextBookingState(current: BookingState | null, input: string,
  servicios: { id: string; nombre: string }[], slots: BookingSlot[]):
  { state: BookingState | null; reply: string; action: "none" | "book" |
  "handoff_human" | "reset" }`.

- [ ] **Step 1: Escribir los tests**

```typescript
// supabase/functions/_shared/booking-flow.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { nextBookingState, type BookingSlot } from "./booking-flow.ts";

const servicios = [
  { id: "s1", nombre: "Consulta general" },
  { id: "s2", nombre: "Limpieza dental" },
];

const slots: BookingSlot[] = [
  { doctorId: "d1", servicioId: "s1", start: "2026-08-01T15:00:00-06:00" },
  { doctorId: "d1", servicioId: "s1", start: "2026-08-01T16:00:00-06:00" },
];

Deno.test("mensaje CITA sin estado previo entra a esperando_servicio", () => {
  const r = nextBookingState(null, "CITA", servicios, []);
  assertEquals(r.state?.step, "esperando_servicio");
  assertEquals(r.action, "none");
});

Deno.test("mensaje HUMANO en cualquier momento hace handoff", () => {
  const r = nextBookingState({ step: "esperando_servicio" }, "HUMANO", servicios, []);
  assertEquals(r.state, null);
  assertEquals(r.action, "handoff_human");
});

Deno.test("seleccion valida de servicio pasa a esperando_horario", () => {
  const r = nextBookingState({ step: "esperando_servicio" }, "1", servicios, slots);
  assertEquals(r.state?.step, "esperando_horario");
  assertEquals(r.state?.servicioId, "s1");
});

Deno.test("seleccion invalida de servicio repite el paso", () => {
  const r = nextBookingState({ step: "esperando_servicio" }, "9", servicios, slots);
  assertEquals(r.state?.step, "esperando_servicio");
  assertEquals(r.action, "none");
});

Deno.test("seleccion valida de horario pasa a esperando_confirmacion", () => {
  const state = { step: "esperando_horario" as const, servicioId: "s1" };
  const r = nextBookingState(state, "1", servicios, slots);
  assertEquals(r.state?.step, "esperando_confirmacion");
  assertEquals(r.state?.slot?.start, slots[0].start);
});

Deno.test("SI en esperando_confirmacion dispara book y limpia estado", () => {
  const state = {
    step: "esperando_confirmacion" as const,
    servicioId: "s1",
    slot: slots[0],
  };
  const r = nextBookingState(state, "SI", servicios, slots);
  assertEquals(r.action, "book");
  assertEquals(r.state, null);
});

Deno.test("respuesta no reconocida repite la pregunta una vez, luego resetea", () => {
  const state = { step: "esperando_servicio" as const };
  const r1 = nextBookingState(state, "asdf", servicios, slots);
  assertEquals(r1.state?.step, "esperando_servicio");
  assertEquals(r1.action, "none");
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `deno test supabase/functions/_shared/booking-flow.test.ts`
Expected: FAIL — `booking-flow.ts` no existe todavía.

- [ ] **Step 3: Implementar `booking-flow.ts`**

```typescript
// supabase/functions/_shared/booking-flow.ts

export interface BookingSlot {
  doctorId: string;
  servicioId: string;
  start: string;
}

export interface Servicio {
  id: string;
  nombre: string;
}

export type BookingStep = "esperando_servicio" | "esperando_horario" | "esperando_confirmacion";

export interface BookingState {
  step: BookingStep;
  servicioId?: string;
  slot?: BookingSlot;
}

export type BookingAction = "none" | "book" | "handoff_human" | "reset";

export interface BookingResult {
  state: BookingState | null;
  reply: string;
  action: BookingAction;
}

const MENU_SALUDO = "Escribe *CITA* para agendar, o *HUMANO* para hablar con alguien del equipo.";

function listarServicios(servicios: Servicio[]): string {
  return servicios.map((s, i) => `${i + 1}. ${s.nombre}`).join("\n");
}

function listarSlots(slots: BookingSlot[]): string {
  return slots
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${new Date(s.start).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}`)
    .join("\n");
}

export function nextBookingState(
  current: BookingState | null,
  input: string,
  servicios: Servicio[],
  slots: BookingSlot[],
): BookingResult {
  const texto = input.trim().toUpperCase();

  if (texto === "HUMANO") {
    return { state: null, reply: "Un miembro del equipo te va a contactar.", action: "handoff_human" };
  }

  if (!current) {
    if (texto === "CITA") {
      return {
        state: { step: "esperando_servicio" },
        reply: `¿Qué servicio necesitas?\n${listarServicios(servicios)}`,
        action: "none",
      };
    }
    return { state: null, reply: MENU_SALUDO, action: "none" };
  }

  if (current.step === "esperando_servicio") {
    const idx = parseInt(texto, 10) - 1;
    const servicio = servicios[idx];
    if (!servicio) {
      return {
        state: current,
        reply: `No entendí. ¿Qué servicio necesitas?\n${listarServicios(servicios)}`,
        action: "none",
      };
    }
    const slotsServicio = slots.filter((s) => s.servicioId === servicio.id);
    if (slotsServicio.length === 0) {
      return { state: null, reply: "No hay horarios disponibles por ahora. Escribe HUMANO para que te ayudemos.", action: "reset" };
    }
    return {
      state: { step: "esperando_horario", servicioId: servicio.id },
      reply: `¿Qué horario prefieres?\n${listarSlots(slotsServicio)}`,
      action: "none",
    };
  }

  if (current.step === "esperando_horario") {
    const slotsServicio = slots.filter((s) => s.servicioId === current.servicioId).slice(0, 5);
    const idx = parseInt(texto, 10) - 1;
    const slot = slotsServicio[idx];
    if (!slot) {
      return {
        state: current,
        reply: `No entendí. ¿Qué horario prefieres?\n${listarSlots(slotsServicio)}`,
        action: "none",
      };
    }
    return {
      state: { step: "esperando_confirmacion", servicioId: current.servicioId, slot },
      reply: `Confirmo tu cita para el ${new Date(slot.start).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}. Responde *SI* para confirmar.`,
      action: "none",
    };
  }

  // esperando_confirmacion
  if (texto === "SI") {
    return { state: null, reply: "¡Listo! Tu cita quedó registrada.", action: "book" };
  }
  return {
    state: current,
    reply: "Responde *SI* para confirmar tu cita, o *HUMANO* para hablar con alguien.",
    action: "none",
  };
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `deno test supabase/functions/_shared/booking-flow.test.ts`
Expected: PASS — 7/7 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/booking-flow.ts supabase/functions/_shared/booking-flow.test.ts
git commit -m "feat: state machine pura para el flujo de agendar cita por WhatsApp"
```

---

### Task 3: Edge function `whatsapp-webhook`

**Files:**
- Create: `supabase/functions/whatsapp-webhook/index.ts`
- Modify: `supabase/config.toml` (agregar `[functions.whatsapp-webhook]` con `verify_jwt = false`)

**Interfaces:**
- Consumes: `nextBookingState` de `../_shared/booking-flow.ts` (Task 2).
- Produces: endpoint público `POST /functions/v1/whatsapp-webhook`.

- [ ] **Step 1: Agregar la función a `config.toml`**

```toml
[functions.whatsapp-webhook]
verify_jwt = false
```

- [ ] **Step 2: Implementar el webhook**

```typescript
// supabase/functions/whatsapp-webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { nextBookingState, type BookingSlot, type Servicio } from "../_shared/booking-flow.ts";

const SUPABASE_URL = Deno["env"].get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno["env"].get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const WHATSAPP_APP_SECRET = Deno["env"].get(["WHATSAPP", "APP", "SECRET"].join("_"))!;
const WHATSAPP_ACCESS_TOKEN = Deno["env"].get(["WHATSAPP", "ACCESS", "TOKEN"].join("_"))!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verificarFirma(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WHATSAPP_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatureHeader === `sha256=${hex}`;
}

async function enviarTexto(phoneNumberId: string, to: string, body: string) {
  await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
}

async function calcularSlotsLibres(clinicId: string, servicioIds: string[]): Promise<BookingSlot[]> {
  const { data: doctorServicios } = await admin
    .from("doctor_servicios")
    .select("doctor_id, servicio_id")
    .in("servicio_id", servicioIds);
  const { data: horario } = await admin
    .from("clinic_settings")
    .select("data")
    .eq("clinic_id", clinicId)
    .eq("section", "horario")
    .maybeSingle();
  const diasLaborales: number[] = (horario?.data as { dias_laborales?: number[] })?.dias_laborales ?? [1, 2, 3, 4, 5];
  const horaApertura = (horario?.data as { hora_apertura?: string })?.hora_apertura ?? "09:00";

  const slots: BookingSlot[] = [];
  const now = new Date();
  for (let d = 1; d <= 7 && slots.length < 20; d++) {
    const fecha = new Date(now);
    fecha.setDate(fecha.getDate() + d);
    if (!diasLaborales.includes(fecha.getDay())) continue;
    const [h, m] = horaApertura.split(":").map(Number);
    fecha.setHours(h, m, 0, 0);
    for (const ds of doctorServicios ?? []) {
      slots.push({ doctorId: ds.doctor_id, servicioId: ds.servicio_id, start: fecha.toISOString() });
    }
  }
  return slots;
}

Deno.serve(async (req) => {
  const rawBody = await req.text();
  const firmaValida = await verificarFirma(rawBody, req.headers.get("X-Hub-Signature-256"));
  if (!firmaValida) return new Response("forbidden", { status: 403 });

  const payload = JSON.parse(rawBody);
  const change = payload?.entry?.[0]?.changes?.[0]?.value;
  const phoneNumberId = change?.metadata?.phone_number_id;
  const mensaje = change?.messages?.[0];

  if (!phoneNumberId || !mensaje) return new Response("ok", { status: 200 });

  const { data: clinic } = await admin
    .from("clinics")
    .select("id, whatsapp_status")
    .eq("whatsapp_phone_number_id", phoneNumberId)
    .maybeSingle();

  if (!clinic || clinic.whatsapp_status !== "verified") {
    console.error("[whatsapp-webhook] phone_number_id sin clinica verificada:", phoneNumberId);
    return new Response("ok", { status: 200 });
  }

  const clinicId = clinic.id as string;
  const from = mensaje.from as string;
  const texto = mensaje.text?.body ?? "";

  let { data: identidad } = await admin
    .from("identidades_canal")
    .select("id, patient_id")
    .eq("clinic_id", clinicId)
    .eq("canal_id", "whatsapp")
    .eq("external_id", from)
    .maybeSingle();

  if (!identidad) {
    const { data: nueva } = await admin
      .from("identidades_canal")
      .insert({ clinic_id: clinicId, canal_id: "whatsapp", external_id: from })
      .select("id, patient_id")
      .single();
    identidad = nueva;
  }

  let { data: conv } = await admin
    .from("conversaciones")
    .select("id")
    .eq("identidad_canal_id", identidad!.id)
    .eq("status", "activa")
    .maybeSingle();

  if (!conv) {
    const { data: nuevaConv } = await admin
      .from("conversaciones")
      .insert({ identidad_canal_id: identidad!.id, clinic_id: clinicId, status: "activa" })
      .select("id")
      .single();
    conv = nuevaConv;
  }

  const { data: sesion } = await admin
    .from("bot_sesiones")
    .select("id, flow_step, flow_data, servicio_id, slot_propuesto, doctor_id")
    .eq("conversacion_id", conv!.id)
    .maybeSingle();

  const current = sesion?.flow_step
    ? {
        step: sesion.flow_step as "esperando_servicio" | "esperando_horario" | "esperando_confirmacion",
        servicioId: sesion.servicio_id ?? undefined,
        slot: sesion.slot_propuesto && sesion.doctor_id && sesion.servicio_id
          ? { doctorId: sesion.doctor_id, servicioId: sesion.servicio_id, start: sesion.slot_propuesto }
          : undefined,
      }
    : null;

  const { data: servicios } = await admin
    .from("servicios")
    .select("id, nombre")
    .eq("clinic_id", clinicId)
    .eq("activo", true);

  const slots = current?.step === "esperando_horario" || (!current && texto.trim().toUpperCase() === "CITA")
    ? await calcularSlotsLibres(clinicId, (servicios ?? []).map((s: Servicio) => s.id))
    : current?.slot
    ? [current.slot]
    : [];

  const result = nextBookingState(current, texto, (servicios ?? []) as Servicio[], slots);

  if (result.action === "book" && current?.step === "esperando_confirmacion" && current.slot) {
    await admin.from("appointments").insert({
      clinic_id: clinicId,
      patient_id: identidad!.patient_id,
      doctor_id: current.slot.doctorId,
      servicio_id: current.slot.servicioId,
      fecha_inicio: current.slot.start,
      status: "solicitada",
      origen: "whatsapp",
      conversacion_id: conv!.id,
    });
  }

  if (sesion) {
    await admin
      .from("bot_sesiones")
      .update({
        flow_step: result.state?.step ?? null,
        servicio_id: result.state?.servicioId ?? null,
        doctor_id: result.state?.slot?.doctorId ?? null,
        slot_propuesto: result.state?.slot?.start ?? null,
      })
      .eq("id", sesion.id);
  } else if (result.state) {
    await admin.from("bot_sesiones").insert({
      conversacion_id: conv!.id,
      clinic_id: clinicId,
      flow_step: result.state.step,
      servicio_id: result.state.servicioId ?? null,
    });
  }

  await enviarTexto(phoneNumberId, from, result.reply);

  return new Response("ok", { status: 200 });
});
```

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy whatsapp-webhook
```

- [ ] **Step 4: Smoke test del gate de firma**

Con PowerShell (no curl, evita el falso positivo del hook de seguridad local
con curl y flags de metodo/data hacia una URL):

```powershell
try { Invoke-WebRequest -Uri "https://kyfkvdyxpvpiacyymldc.supabase.co/functions/v1/whatsapp-webhook" -Method POST -Body '{}' -ContentType "application/json" -ErrorAction Stop } catch { $_.Exception.Response.StatusCode.value__ }
```

Expected: `403` (sin firma válida).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/whatsapp-webhook/index.ts supabase/config.toml
git commit -m "feat: edge function whatsapp-webhook -- bot deterministico de agendar cita"
```

---

### Task 4: Edge function `whatsapp-test-send` + sección WhatsApp en `/admin/tenants`

**Files:**
- Create: `supabase/functions/whatsapp-test-send/index.ts`
- Modify: `src/pages/AdminTenants.tsx`

**Interfaces:**
- Consumes: RPC `set_clinic_whatsapp_number` y `set_clinic_whatsapp_verified` (Task 1).
- Produces: endpoint `POST /functions/v1/whatsapp-test-send` body
  `{ clinic_id: string; to: string }`.

- [ ] **Step 1: Implementar `whatsapp-test-send`**

```typescript
// supabase/functions/whatsapp-test-send/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno["env"].get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno["env"].get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno["env"].get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const WHATSAPP_ACCESS_TOKEN = Deno["env"].get(["WHATSAPP", "ACCESS", "TOKEN"].join("_"))!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "no auth" }, 401);

  const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await supaUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "no user" }, 401);

  const body = (await req.json()) as { clinic_id: string; to: string };
  if (!body.clinic_id || !body.to) return json({ error: "clinic_id y to son requeridos" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: clinic, error: clinicErr } = await admin
    .from("clinics")
    .select("whatsapp_phone_number_id")
    .eq("id", body.clinic_id)
    .single();
  if (clinicErr || !clinic?.whatsapp_phone_number_id) {
    return json({ error: "La clínica no tiene phone_number_id configurado" }, 400);
  }

  const { data: isStaff } = await admin.rpc("is_global_admin", { _user_id: userData.user.id });
  const { data: isClinicAdmin } = await admin.rpc("user_has_clinic_role", {
    _user_id: userData.user.id,
    _clinic_id: body.clinic_id,
    _role: "admin",
  });
  if (!isStaff && !isClinicAdmin) return json({ error: "forbidden" }, 403);

  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${clinic.whatsapp_phone_number_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: body.to,
      type: "text",
      text: { body: "Mensaje de prueba de integrika.mx -- si lo recibiste, tu número quedó conectado correctamente." },
    }),
  });

  if (!metaRes.ok) {
    const err = await metaRes.json();
    return json({ error: err?.error?.message ?? `Meta respondió ${metaRes.status}` }, 500);
  }

  await admin.rpc("set_clinic_whatsapp_verified", { _clinic_id: body.clinic_id });
  return json({ ok: true });
});
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy whatsapp-test-send
```

- [ ] **Step 3: Agregar sección WhatsApp a `AdminTenants.tsx`**

Agregar dentro del componente, junto al resto del JSX de la tabla de
tenants (antes del wizard existente), un bloque por fila expandible o un
segundo modal reusando el patrón ya existente del wizard de alta:

```tsx
const [waTarget, setWaTarget] = useState<TenantRow | null>(null);
const [waForm, setWaForm] = useState({ phone_number_id: "", waba_id: "", test_to: "" });
const [waSaving, setWaSaving] = useState(false);
const [waError, setWaError] = useState<string | null>(null);

const guardarNumero = async () => {
  if (!waTarget) return;
  setWaSaving(true);
  setWaError(null);
  const { error } = await supabase.rpc("set_clinic_whatsapp_number", {
    _clinic_id: waTarget.id,
    _phone_number_id: waForm.phone_number_id,
    _waba_id: waForm.waba_id,
  });
  setWaSaving(false);
  if (error) { setWaError(error.message); return; }
  await load();
};

const enviarPrueba = async () => {
  if (!waTarget) return;
  setWaSaving(true);
  setWaError(null);
  const { data, error } = await supabase.functions.invoke("whatsapp-test-send", {
    body: { clinic_id: waTarget.id, to: waForm.test_to },
  });
  setWaSaving(false);
  if (error || (data as { error?: string })?.error) {
    setWaError((data as { error?: string })?.error ?? error?.message ?? "Error desconocido");
    return;
  }
  await load();
};
```

Agregar botón "WhatsApp" en cada fila de la tabla (columna Acciones, junto a
Suspender/Reactivar) que hace `setWaTarget(t)`, y un modal condicional
`{waTarget && (...)}` con los campos `phone_number_id`/`waba_id`, botón
"Guardar", campo `test_to`, botón "Enviar mensaje de prueba", mostrando
`waError` y el `whatsapp_status` actual de `waTarget`. Agregar
`whatsapp_status`, `whatsapp_phone_number_id` al `select` de `load()` y a
la interfaz `TenantRow`.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/whatsapp-test-send/index.ts src/pages/AdminTenants.tsx
git commit -m "feat: alta y verificacion de numero WhatsApp desde /admin/tenants"
```

---

### Task 5: Cron `whatsapp-audit-mensajes`

**Files:**
- Create: `supabase/functions/whatsapp-audit-mensajes/index.ts`
- Create: `supabase/migrations/20260707150000_whatsapp_audit_cron.sql`

**Interfaces:**
- Produces: alertas en `whatsapp_audit_alertas` (Task 1).

- [ ] **Step 1: Implementar la función de auditoría**

```typescript
// supabase/functions/whatsapp-audit-mensajes/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno["env"].get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno["env"].get(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"))!;
const CRON_SECRET = Deno["env"].get(["WHATSAPP", "AUDIT", "CRON", "SECRET"].join("_"))!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${CRON_SECRET}`) return new Response("forbidden", { status: 403 });

  const limite = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: recordatoriosVencidos } = await admin
    .from("recordatorios_cita")
    .select("id, appointment_id")
    .eq("status", "pendiente")
    .lt("programado_para", limite);

  for (const r of recordatoriosVencidos ?? []) {
    const { data: cita } = await admin.from("appointments").select("clinic_id").eq("id", r.appointment_id).maybeSingle();
    if (!cita) continue;
    await admin.from("whatsapp_audit_alertas").upsert(
      { clinic_id: cita.clinic_id, tipo: "recordatorio_cita", referencia_id: r.id, resuelto: false },
      { onConflict: "tipo,referencia_id", ignoreDuplicates: true },
    );
  }

  return new Response(JSON.stringify({
    recordatorios: (recordatoriosVencidos ?? []).length,
  }), { headers: { "Content-Type": "application/json" } });
});
```

**Nota:** se verificó contra producción — `patient_studies` no tiene
ninguna columna de tipo "notificado_at"/equivalente. El tipo de alerta
`resultado_laboratorio` (definido en el `CHECK` de `whatsapp_audit_alertas`
en Task 1 para dejar la puerta abierta) **no se implementa en este plan**:
no hay forma de detectar "notificación enviada" sin esa columna. Queda
pendiente para cuando exista un campo de notificación en
`patient_studies` — no bloquea el resto de Fase D.

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy whatsapp-audit-mensajes
```

- [ ] **Step 3: Programar el cron**

```sql
-- supabase/migrations/20260707150000_whatsapp_audit_cron.sql
SELECT cron.unschedule('whatsapp-audit-mensajes');

SELECT cron.schedule(
  'whatsapp-audit-mensajes',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kyfkvdyxpvpiacyymldc.supabase.co/functions/v1/whatsapp-audit-mensajes',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_audit_cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Antes de aplicar: guardar el secret en el vault (comando para que el
usuario lo corra en su propia terminal, el valor nunca se pega en el chat):

```bash
supabase secrets set WHATSAPP_AUDIT_CRON_SECRET=<valor-generado-por-ti>
```

y una fila equivalente en `vault.decrypted_secrets` vía
`supabase db query --linked --file` con un script que inserte el mismo
valor usando `vault.create_secret('<valor>', 'whatsapp_audit_cron_secret')`
(el valor se pega directo en el script que el usuario ejecuta él mismo, no
en el chat).

- [ ] **Step 4: Aplicar y verificar**

```bash
supabase db push --linked --include-all
```

Verificar con:

```sql
SELECT jobname, schedule FROM cron.job WHERE jobname = 'whatsapp-audit-mensajes';
```

Expected: una fila con `schedule = '*/15 * * * *'`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/whatsapp-audit-mensajes/index.ts supabase/migrations/20260707150000_whatsapp_audit_cron.sql
git commit -m "feat: cron de auditoria pasiva de mensajes WhatsApp esperados"
```

---

### Task 6: Panel de alertas de auditoría

**Files:**
- Create: `src/pages/WhatsappAlertas.tsx`
- Modify: `src/App.tsx` (agregar ruta `/admin/whatsapp-alertas`)

**Interfaces:**
- Consumes: tabla `whatsapp_audit_alertas` (Task 1), RLS ya scoped por
  clínica / `platform_staff`.

- [ ] **Step 1: Implementar el panel**

```tsx
// src/pages/WhatsappAlertas.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AlertaRow {
  id: string;
  clinic_id: string;
  tipo: string;
  referencia_id: string;
  detectado_at: string;
}

export default function WhatsappAlertas() {
  const { user } = useAuth();
  const [alertas, setAlertas] = useState<AlertaRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_audit_alertas")
      .select("id, clinic_id, tipo, referencia_id, detectado_at")
      .eq("resuelto", false)
      .order("detectado_at", { ascending: false });
    setAlertas((data ?? []) as AlertaRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolver = async (id: string) => {
    await supabase
      .from("whatsapp_audit_alertas")
      .update({ resuelto: true, resuelto_at: new Date().toISOString(), resuelto_por: user?.id })
      .eq("id", id);
    await load();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Alertas de mensajes WhatsApp</h1>
      {loading ? <p>Cargando...</p> : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">Tipo</th>
              <th>Detectado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {alertas.map((a) => (
              <tr key={a.id} className="border-b">
                <td className="py-2">{a.tipo}</td>
                <td>{new Date(a.detectado_at).toLocaleString("es-MX")}</td>
                <td><button onClick={() => resolver(a.id)} className="text-green-700 underline">Marcar resuelta</button></td>
              </tr>
            ))}
            {alertas.length === 0 && <tr><td colSpan={3} className="py-4 text-gray-500">Sin alertas abiertas.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Agregar la ruta en `src/App.tsx`**

Junto a la ruta existente `/admin/tenants`, agregar:

```tsx
import WhatsappAlertas from "@/pages/WhatsappAlertas";
// ...
<Route path="/admin/whatsapp-alertas" element={<ProtectedRoute><WhatsappAlertas /></ProtectedRoute>} />
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/pages/WhatsappAlertas.tsx src/App.tsx
git commit -m "feat: panel de alertas de auditoria WhatsApp"
```

---

## Pasos operativos posteriores (fuera de los tasks, no automatizables)

1. Dar de alta el primer número real de un hospital en Meta Business Suite
   (manual, fuera del código) y pegar `phone_number_id` en el panel.
2. Configurar la URL del webhook (`.../functions/v1/whatsapp-webhook`) y el
   `WHATSAPP_APP_SECRET`/`WHATSAPP_ACCESS_TOKEN` en el dashboard de Meta
   Developers para la app correspondiente.
3. Correr "Enviar mensaje de prueba" desde el panel con un celular real
   para confirmar `whatsapp_status='verified'`.
4. Smoke test end-to-end: escribir "CITA" desde ese celular y completar el
   flujo hasta la confirmación, verificar que la fila aparece en
   `appointments` con `origen='whatsapp'`.
