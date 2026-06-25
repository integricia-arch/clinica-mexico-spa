# Módulo Fidelización Farmacia — Spec de Diseño

**Fecha:** 2026-06-24  
**Estado:** Aprobado  
**Proyecto:** integrika.mx (clinica-mexico-spa)  
**Referencia:** Farmacias del Ahorro app + Starbucks Rewards  
**Stack:** React 18 + TypeScript + Supabase + Cloudflare Workers + Resend + Telegram Bot

---

## 1. Visión General

Módulo add-on de fidelización para el SaaS de gestión de farmacias integrika.mx. Permite a cada farmacia cliente crear y administrar su propio programa de puntos (Monedero), planes de lealtad por producto, campañas de comunicación y boletines. El cliente final interactúa vía PWA web (sin instalar nada) y por Telegram (bot ya existente). WhatsApp se añade en Etapa 3.

**Posicionamiento:** "Monedero [Nombre Farmacia]" — el saldo se llama **eS$** (pesos electrónicos), no "puntos", para que el cliente sienta que acumula dinero real.

---

## 2. Alcance por Etapas

### Etapa 1 — MVP Fidelización (6–8 semanas)
- DB: 6 tablas nuevas con RLS multi-tenant
- POS: panel fidelización integrado en `PuntoDeVenta.tsx`
- PWA cliente: Monedero + código de barras + historial
- Admin farmacia: configurar reglas + ver miembros
- Email: bienvenida + resumen mensual (Resend ya integrado)

### Etapa 2 — Planes y Campañas (4–5 semanas)
- Planes 3x1 con progreso visual
- Editor de campañas y boletines
- Bot Telegram: notificaciones de puntos acumulados
- Segmentación por nivel e inactividad
- Dashboard analytics retención

### Etapa 3 — QR y WhatsApp (3–4 semanas)
- QR code en PWA + scanner en POS (cámara tablet)
- WhatsApp Business API via 360dialog
- Templates aprobados Meta
- Opt-in / opt-out WhatsApp en PWA

### Etapa 4 — Inteligencia (4–6 semanas)
- Sugerencias personalizadas basadas en historial de compras
- Retos personalizados (Starbucks-style: "Compra 4 veces → 200 pts bonus")
- Puntos dobles en cumpleaños (automático)
- Predicción churn: inactivos 25 días → campaña reactivación automática

---

## 3. Arquitectura del Sistema

```
integrika.mx (SaaS existente)
│
├── MÓDULO FARMACIA (existente — src/features/farmacia/)
│   └── PuntoDeVenta.tsx
│       └── [NUEVO] LoyaltyPanel.tsx — panel lateral en cobro
│
├── [NUEVO] MÓDULO LEALTAD ADMIN (src/features/lealtad/)
│   ├── LoyaltyConfig.tsx       — reglas de puntos, niveles
│   ├── LoyaltyMiembros.tsx     — lista, búsqueda, perfil cliente
│   ├── LoyaltyPlanes.tsx       — planes 3x1 por producto
│   ├── LoyaltyCampanas.tsx     — campañas y boletines
│   └── LoyaltyAnalytics.tsx   — retención, top clientes, churn
│
├── [NUEVO] SUPABASE EDGE FUNCTIONS
│   ├── loyalty-register-sale   — calcula y registra puntos post-venta
│   ├── loyalty-send-campaign   — envío masivo email/Telegram
│   └── loyalty-expiry-cron     — vencimiento puntos inactivos (pg_cron)
│
└── [NUEVA] PWA CLIENTE — loyalty.integrika.mx/{farmacia-slug}
    ├── / (Inicio)         — saldo + nivel + planes + sugerencias
    ├── /promos            — ofertas vigentes (filtradas COFEPRIS)
    ├── /monedero          — tarjeta + código de barras + historial
    └── /cuenta            — perfil + notificaciones + opt-out + legales
```

### Despliegue PWA
- Mismo Cloudflare Worker: `loyalty.integrika.mx/{slug}` resuelve por `clinic_id`
- Vite build separado o ruta dentro del mismo bundle con lazy loading
- PWA manifest por farmacia: nombre, colores, logo (configurable)

---

## 4. Base de Datos (Nuevas Tablas)

### 4.1 `loyalty_members`
```sql
CREATE TABLE loyalty_members (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                   uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  patient_id                  uuid REFERENCES patients(id) ON DELETE SET NULL,
  nombre                      text NOT NULL,
  telefono                    text,
  email                       text,
  fecha_nacimiento            date,
  codigo_barras               text NOT NULL UNIQUE,  -- auto-gen: '{clinic_prefix}{8digits}'
  nivel                       text NOT NULL DEFAULT 'bronce'
                              CHECK (nivel IN ('bronce','plata','oro','diamante')),
  puntos_disponibles          integer NOT NULL DEFAULT 0 CHECK (puntos_disponibles >= 0),
  puntos_acumulados_historico integer NOT NULL DEFAULT 0,
  -- Consentimientos LFPDPPP
  consent_privacidad          boolean NOT NULL DEFAULT false,
  consent_privacidad_at       timestamptz,
  consent_historial_compras   boolean NOT NULL DEFAULT false,
  consent_historial_at        timestamptz,
  consent_marketing           boolean NOT NULL DEFAULT false,
  consent_marketing_at        timestamptz,
  consent_marketing_canales   text[] DEFAULT '{}',  -- ['email','telegram','whatsapp']
  consent_version             text,                  -- '2026-06' para auditoría
  activo                      boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, email),
  UNIQUE (clinic_id, telefono)
);

-- RLS: miembro ve solo sus datos; admin/manager de la clínica ve todos
```

### 4.2 `loyalty_movimientos`
```sql
CREATE TABLE loyalty_movimientos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  member_id        uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  tipo             text NOT NULL
                   CHECK (tipo IN ('acumulacion','canje','vencimiento','bonus','ajuste','referido')),
  puntos           integer NOT NULL,  -- positivo o negativo
  saldo_post       integer NOT NULL,  -- saldo después del movimiento
  pharmacy_sale_id uuid REFERENCES pharmacy_sales(id) ON DELETE SET NULL,
  plan_id          uuid REFERENCES loyalty_planes(id) ON DELETE SET NULL,
  descripcion      text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);
-- Append-only: sin UPDATE ni DELETE en RLS
```

### 4.3 `loyalty_config`
```sql
CREATE TABLE loyalty_config (
  clinic_id                    uuid PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  nombre_programa              text NOT NULL DEFAULT 'Monedero Farmacia',
  slug_farmacia                text NOT NULL UNIQUE,  -- URL: loyalty.integrika.mx/{slug}
  color_primario               text DEFAULT '#1a56db',
  logo_url                     text,
  -- Motor de puntos
  pesos_por_punto              numeric(10,2) NOT NULL DEFAULT 10.00, -- $10 MXN = 1 punto
  valor_punto_mxn              numeric(10,4) NOT NULL DEFAULT 0.10,  -- 1 pto = $0.10
  puntos_minimos_canje         integer NOT NULL DEFAULT 100,
  -- Niveles (umbrales en puntos históricos acumulados en 12 meses)
  nivel_plata_umbral           integer NOT NULL DEFAULT 500,
  nivel_oro_umbral             integer NOT NULL DEFAULT 1500,
  nivel_diamante_umbral        integer NOT NULL DEFAULT 4000,
  -- Beneficios por nivel (multiplicador de acumulación)
  multiplicador_plata          numeric(4,2) NOT NULL DEFAULT 1.10,
  multiplicador_oro            numeric(4,2) NOT NULL DEFAULT 1.25,
  multiplicador_diamante       numeric(4,2) NOT NULL DEFAULT 1.50,
  -- Vencimiento
  expiracion_dias_inactividad  integer NOT NULL DEFAULT 180,
  -- Activo
  programa_activo              boolean NOT NULL DEFAULT false,
  actualizado_at               timestamptz NOT NULL DEFAULT now()
);
```

### 4.4 `loyalty_planes`
```sql
CREATE TABLE loyalty_planes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  nombre               text NOT NULL,
  descripcion          text,
  tipo                 text NOT NULL
                       CHECK (tipo IN ('compras_frecuentes','puntos_bonus','descuento_directo')),
  -- Condición
  medicamento_id       uuid REFERENCES medicamentos(id) ON DELETE SET NULL,
  categoria_medicamento text,              -- alternativo a medicamento_id
  meta_cantidad        integer,            -- ej: 3 compras
  -- Recompensa
  recompensa_tipo      text NOT NULL
                       CHECK (recompensa_tipo IN ('producto_gratis','puntos','descuento_pct','descuento_mxn')),
  recompensa_valor     numeric(10,2),      -- cantidad puntos / pct / mxn / medicamento_id
  recompensa_medicamento_id uuid REFERENCES medicamentos(id) ON DELETE SET NULL,
  -- Vigencia
  vigencia_inicio      date,
  vigencia_fin         date,
  activo               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);
```

### 4.5 `loyalty_planes_progreso`
```sql
CREATE TABLE loyalty_planes_progreso (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  member_id             uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  plan_id               uuid NOT NULL REFERENCES loyalty_planes(id) ON DELETE CASCADE,
  avance_actual         integer NOT NULL DEFAULT 0,
  completado_at         timestamptz,
  recompensa_entregada  boolean NOT NULL DEFAULT false,
  recompensa_entregada_at timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, plan_id)
);
```

### 4.6 `loyalty_campanas`
```sql
CREATE TABLE loyalty_campanas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  titulo           text NOT NULL,
  descripcion      text,
  imagen_url       text,
  tipo             text NOT NULL CHECK (tipo IN ('oferta','boletin','evento','reactivacion')),
  -- Segmentación
  segmento         text NOT NULL DEFAULT 'todos'
                   CHECK (segmento IN ('todos','bronce','plata','oro','diamante','inactivos_30d','inactivos_60d')),
  -- Canales
  canal_email      boolean NOT NULL DEFAULT true,
  canal_telegram   boolean NOT NULL DEFAULT false,
  canal_whatsapp   boolean NOT NULL DEFAULT false,
  canal_inapp      boolean NOT NULL DEFAULT true,
  -- Estado
  programado_at    timestamptz,
  enviado_at       timestamptz,
  estado           text NOT NULL DEFAULT 'borrador'
                   CHECK (estado IN ('borrador','programada','enviando','enviada','cancelada')),
  destinatarios    integer,   -- count al enviar
  aperturas        integer DEFAULT 0,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

---

## 5. RPCs Clave

### `loyalty_register_sale(p_sale_id, p_member_id, p_clinic_id)`
```
- Busca monto total de pharmacy_sales
- Aplica reglas de loyalty_config (pesos_por_punto)
- Aplica multiplicador de nivel del miembro
- Evalúa planes activos para progreso
- INSERT en loyalty_movimientos (tipo=acumulacion)
- UPDATE loyalty_members.puntos_disponibles + puntos_acumulados_historico
- Recalcula nivel si umbral superado
- Retorna: { puntos_ganados, saldo_nuevo, nivel_nuevo, planes_completados[] }
```

### `loyalty_redeem(p_member_id, p_clinic_id, p_puntos)`
```
- Verifica puntos_disponibles >= p_puntos
- Verifica >= puntos_minimos_canje
- Calcula descuento_mxn = p_puntos * valor_punto_mxn
- INSERT loyalty_movimientos (tipo=canje, puntos negativo)
- UPDATE puntos_disponibles
- Retorna: { descuento_mxn, saldo_nuevo }
```

### `loyalty_expiry_check()` (pg_cron diario)
```
- Busca members con último movimiento > expiracion_dias_inactividad
- INSERT movimiento tipo=vencimiento con puntos negativos
- UPDATE puntos_disponibles = 0
- Notifica por email si consent_marketing = true
```

---

## 6. Módulo POS — LoyaltyPanel.tsx

Panel colapsable en `PuntoDeVenta.tsx` (lado derecho del layout, encima del cobro):

```
┌─────────────────────────────────────┐
│ 👤 Cliente Fidelización             │
│ ┌─────────────────────────────────┐ │
│ │ 📱 Teléfono o email...   [Buscar]│ │
│ └─────────────────────────────────┘ │
│                                     │
│ SI ENCONTRADO:                      │
│  María García · Nivel: ⭐ Plata     │
│  Saldo: eS$ 45.30 (453 puntos)     │
│  [Canjear 100 pts = -$10.00 MXN]   │
│                                     │
│ SI NO ENCONTRADO:                   │
│  [+ Afiliar cliente nuevo]          │
│  → Modal: nombre + tel + email      │
│  → 3 checkboxes consentimiento      │
└─────────────────────────────────────┘
```

**Flujo post-venta:**
1. `pharmacy_register_sale` RPC existente se llama primero
2. Si hay `member_id` activo → llamar `loyalty_register_sale`
3. Si se canjearon puntos → `loyalty_redeem` antes del cobro → aplica como descuento adicional
4. Ticket impreso incluye: "Ganaste X puntos · Saldo: eS$ Y.YY"

---

## 7. PWA Cliente

### URL y branding
- `loyalty.integrika.mx/{slug-farmacia}` — slug configurado en `loyalty_config`
- PWA manifest dinámico: nombre, colores y logo de la farmacia
- Sin App Store, sin instalación obligatoria (funciona en browser mobile)
- Instalable en home screen (Add to Home Screen)

### Pantallas

#### Inicio
- Header: logo farmacia + nombre cliente + nivel badge
- Card Monedero: saldo eS$ grande + barra progreso al siguiente nivel
- Mis Planes activos: progreso visual estilo Ahorro (1→2→3→GRATIS)
- Ofertas destacadas: banners de campañas activas (solo OTC/permitidos COFEPRIS)
- Sugerencias: 4 productos basados en historial (filtro `permite_publicidad=true`)

#### Promos
- Campañas de la farmacia (banners configurados en admin)
- Productos con puntos dobles vigentes
- Planes de lealtad disponibles

#### Monedero (pantalla central / FAB)
- Tarjeta visual: nombre + código de barras (128 o Code39) + número
- Saldo eS$ con ojo para ocultar
- Botón: "Ir a mi historial"
- Historial de movimientos: fecha, descripción, puntos, saldo

#### Cuenta
- Avatar + nombre + teléfono
- Notificaciones: toggles por canal (email / Telegram / WhatsApp)
- Mis Planes: todos los planes activos con progreso
- Legales: Aviso de Privacidad, Términos y Condiciones
- [Cancelar mi cuenta] → flujo ARCO
- Versión de la app + nombre farmacia

---

## 8. Admin Farmacia — Módulo Lealtad

Nuevo tab en la navegación de integrika.mx para roles admin/manager:

### LoyaltyConfig.tsx
- Activar/desactivar programa
- Nombre del programa, slug, colores, logo
- Motor de puntos: $X MXN = 1 punto, 1 punto = $Y MXN
- Niveles: umbrales + multiplicadores
- Vencimiento: días de inactividad

### LoyaltyMiembros.tsx
- Tabla paginada: nombre, teléfono, nivel, puntos, última compra
- Búsqueda por nombre/tel/email
- Perfil: historial de movimientos, planes activos, campañas recibidas
- Acciones: ajuste manual de puntos (con motivo, trazable)

### LoyaltyPlanes.tsx
- Crear planes 3x1 por producto o categoría
- Configurar recompensa: producto gratis / puntos bonus / descuento %
- Vigencia de cada plan
- Ver quiénes están participando + progreso agregado

### LoyaltyCampanas.tsx
- Editor de campaña: título, descripción, imagen
- Segmentación: todos / por nivel / inactivos 30d+
- Canales: email (Resend) / Telegram / WhatsApp (Etapa 3)
- Programar envío o enviar inmediato
- Métricas: destinatarios, aperturas (pixel email)

### LoyaltyAnalytics.tsx
- KPIs: miembros activos, puntos emitidos, puntos canjeados, tasa canje
- Retención: cohort por semana de afiliación
- Top 10 clientes por puntos acumulados
- Clientes en riesgo churn (sin compra 20+ días)
- Distribución por nivel (Bronce/Plata/Oro/Diamante)

---

## 9. Edge Functions

### `loyalty-register-sale` (RPC Postgres SECURITY DEFINER, no Edge Function)
- Implementado como RPC en Supabase, no Edge Function — evita latencia de red adicional
- Llamado desde POS frontend inmediatamente después de `pharmacy_register_sale` exitosa
- SECURITY DEFINER: puede escribir en loyalty_movimientos sin exponer claves service_role al cliente
- Lógica: calcula puntos, actualiza member, evalúa planes, retorna resumen

### `loyalty-send-campaign`
- Auth: JWT admin/manager + scope clinic_id
- Obtiene lista de miembros según segmento + filtro consent_marketing=true
- Email via Resend (batch, respeta unsubscribe)
- Telegram via bot existente (solo si canal_telegram=true y member linkado a Telegram)
- Retorna: { enviados, omitidos_sin_consent, errores }

### `loyalty-expiry-cron`
- Auth: Bearer `LOYALTY_EXPIRY_CRON_SECRET`
- pg_cron: diario 07:00 CST
- Procesa vencimientos, notifica por email opcional

---

## 10. Comunicaciones y Consentimientos

### Flujo de consentimiento (registro en POS o PWA)
```
[✅ OBLIGATORIO — sin esto no se registra]
"He leído el Aviso de Privacidad y acepto el tratamiento 
de mis datos para administrar mi Monedero."

[✅ OBLIGATORIO — para que los puntos funcionen]
"Acepto que mis compras sean registradas para calcular 
mis puntos. Entiendo que esto incluye información sobre 
medicamentos adquiridos."

[☐ OPCIONAL — puede negarse y seguir afiliado]
"Acepto recibir ofertas y boletines de [Farmacia] por 
email, Telegram y/o WhatsApp. Puedo cancelar en cualquier 
momento con un click."
```

### Opt-out (un solo paso, sin confirmación)
| Canal | Mecanismo |
|-------|-----------|
| Email | Link "Cancelar suscripción" en footer de cada email |
| Telegram | Comando `/baja` en bot |
| WhatsApp | Responder "STOP" (Etapa 3) |
| PWA | Toggle en Cuenta → Notificaciones |

### Restricciones COFEPRIS en comunicaciones
- Campo `permite_publicidad: boolean` en `medicamentos` **(migration nueva requerida — columna aún no existe)**
- Controlados, psicotrópicos, estupefacientes → `permite_publicidad = false` por defecto
- Medicamentos con receta → `permite_publicidad = false` por defecto
- Solo OTC, cosméticos, suplementos → `permite_publicidad = true`
- Filtro aplicado automáticamente en sugerencias y campañas

---

## 11. Seguridad

| Requerimiento | Implementación |
|---------------|----------------|
| Multi-tenant | RLS `clinic_id` en todas las tablas nuevas |
| Datos de salud | `loyalty_movimientos.pharmacy_sale_id` accesible solo por la clínica dueña |
| Tokens QR/código | UUID v4 no predecible para `codigo_barras` |
| PII en logs | No loguear teléfono/email en texto claro |
| Acceso mínimo | PWA cliente solo lee sus propios datos vía RPC SECURITY DEFINER |
| HTTPS | Cloudflare Workers — siempre HTTPS |
| Retención | Política borrado datos: 3 años sin actividad |
| Consentimiento | Versión + timestamp guardados por ley LFPDPPP |

---

## 12. Modelo de Negocio (SaaS)

| Plan | Precio add-on | Incluye |
|------|--------------|---------|
| Starter | Sin fidelización | Solo POS básico |
| Plus | +$299 MXN/mes | Monedero + puntos básicos + email |
| Pro | +$599 MXN/mes | Plus + planes 3x1 + Telegram + segmentación |
| Enterprise | +$999 MXN/mes | Pro + WhatsApp + analytics avanzados + QR |

**Setup fee:** $2,000–5,000 MXN (configuración inicial + tropicalización de marca)

---

## 13. Documentos Legales Requeridos (plantillas)

1. **Aviso de Privacidad** — LFPDPPP Art. 15-17 (plantilla por farmacia)
2. **Términos y Condiciones del Programa** — puntos no son dinero, vencimiento, fraude
3. **Términos de Uso PWA** — uso personal, no comercial
4. **Política de Cancelación** — proceso ARCO, borrado en 20 días hábiles

---

## 14. Restricciones de Diseño

- Medicamentos controlados NUNCA en campañas de marketing (Art. 307 LGS)
- Puntos NO son dinero: el disclaimer debe ser visible en T&C y en el Monedero
- Opt-out siempre disponible en un solo paso — sin formularios
- No compartir datos de miembros entre farmacias (RLS estricto)
- Niveles recalculados sobre puntos acumulados en últimos 12 meses (no histórico total)
- Puntos canjeados no se pueden revertir (append-only en movimientos)

---

## 15. Criterios de Éxito (Etapa 1)

- [ ] Farmacista puede afiliar cliente en < 60 segundos en el POS
- [ ] Cliente ve su saldo en PWA en < 3 segundos desde móvil
- [ ] Puntos calculados y registrados en < 2 segundos post-venta
- [ ] Email de bienvenida entregado en < 5 minutos post-afiliación
- [ ] Opt-out funcional en todos los canales en un solo paso
- [ ] RLS: cliente solo puede ver sus propios datos
- [ ] Consentimientos guardados con timestamp y versión
- [ ] 0 medicamentos controlados en campañas de marketing

---

*Spec generado: 2026-06-24 | integrika.mx | claude-sonnet-4-6*
