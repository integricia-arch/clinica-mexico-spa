# Marco Legal Exacto — integrika.mx

> Referencia interna. NO asesoría legal. Fuentes: LFPDPPP DOF 20-mar-2025, LGS reforma 2026,
> NOM-004-SSA3-2012, NOM-024-SSA3-2012, Código de Comercio.
> Última actualización: 2026-06-22

---

## 1. QUÉ PROTEGER — Datos cubiertos por ley

### LFPDPPP 2025

**Art. 3 fracción VI — Datos sensibles (lista abierta)**
Datos que por su naturaleza o contexto puedan dar lugar a discriminación o riesgo grave:
- Estado de salud **presente y futuro**
- Información genética
- Origen racial o étnico
- Creencias religiosas, filosóficas y morales
- Afiliación sindical
- Opiniones políticas
- Preferencia o vida sexual

> ⚠️ Para integrika: TODOS los datos de pacientes (diagnósticos, recetas, alergias, tipo de sangre,
> historial) son **datos sensibles de salud**. Categoría más protegida de la ley.

**Art. 5 — Principios obligatorios de tratamiento**
1. Licitud — datos obtenidos por medios lícitos
2. Finalidad — solo para las finalidades declaradas en el aviso
3. Lealtad — sin perjudicar al titular
4. Consentimiento — válido antes del tratamiento
5. Calidad — exactos, completos, pertinentes
6. Proporcionalidad — solo los datos necesarios para la finalidad
7. Información — titular siempre informado
8. Responsabilidad — responder por los datos ante terceros

---

## 2. QUÉ PUBLICAR — Aviso de Privacidad

### LFPDPPP Arts. 15 y 16 — Elementos obligatorios del Aviso Integral

| # | Elemento | Notas para integrika |
|---|----------|---------------------|
| 1 | Identidad y domicilio del responsable | RFC, razón social, calle, CP, ciudad |
| 2 | Datos personales que se recaban | Listar EXPLÍCITAMENTE; marcar cuáles son sensibles |
| 3 | Finalidades **necesarias vs voluntarias** | Distinción obligatoria 2025 |
| 4 | Mecanismos de consentimiento | Checkbox + timestamp en BD |
| 5 | Transferencias a terceros | Supabase, Cloudflare, Telegram, **Anthropic** |
| 6 | Derechos ARCO y cómo ejercerlos | Correo + plazo 20 días hábiles |
| 7 | Revocación del consentimiento | Mecanismo específico |
| 8 | Limitación de uso y divulgación | Cómo oponerse a finalidades voluntarias |
| 9 | **NUEVO 2025** — Decisiones automatizadas/IA | Qué decisiones toma el sistema, derecho de oposición |
| 10 | Modificaciones al aviso | Cómo se notifican cambios |

**Art. 16 — Aviso simplificado** (en formularios de registro)
Solo requiere: responsable, finalidades principales, ARCO, y liga al aviso integral.

### Finalidades necesarias vs voluntarias (nuevo 2025)

| Tipo | Definición | Consentimiento |
|------|-----------|----------------|
| **Necesarias** | Sin ellas NO se puede prestar el servicio | No requiere consentimiento separado |
| **Voluntarias** | Mejoran el servicio pero son opcionales | Requieren consentimiento **explícito separado** |

Ejemplos para integrika:
- Necesaria: registrar expediente, agendar citas, emitir recetas
- Voluntaria: análisis estadístico, mejora del bot IA, contacto de marketing

---

## 3. CONSENTIMIENTO — Requisitos exactos

### Art. 7 — Tipos de consentimiento

| Tipo | Cuándo aplica | Forma |
|------|--------------|-------|
| **Tácito** | Datos no sensibles, finalidades obvias | Titular no se opone al conocer el aviso |
| **Expreso** | Datos financieros o sensibles (salud) | Declaración verbal, escrita o electrónica |
| **Expreso + escrito** | **Datos sensibles de salud** (Art. 9) | Firma autógrafa, firma electrónica, o mecanismo de autenticación equivalente |

### Art. 9 — Consentimiento para datos de salud
> "Tratándose de datos personales sensibles, el responsable deberá obtener el consentimiento
> **expreso y por escrito** de la persona titular para su tratamiento, a través de su firma
> autógrafa, firma electrónica, o cualquier mecanismo de autenticación que al efecto se establezca."

**Para integrika:** el checkbox al registrar paciente cumple "mecanismo de autenticación"
siempre que quede registrado con timestamp y versión del aviso. ✅ Ya implementado.

**Nuevo 2025 — Consentimiento por finalidad**
- Una finalidad nueva = nuevo consentimiento
- Eliminada excepción de "finalidades análogas o compatibles" (era el escape de la ley 2010)
- Si integramos ML/análisis poblacional: pedir nuevo consentimiento

---

## 4. SEGURIDAD TÉCNICA — Obligaciones

### Art. 18 — Medidas de seguridad
Obligatorio implementar medidas **administrativas, técnicas y físicas** proporcionales a:
- Sensibilidad de los datos (salud = máxima)
- Riesgo inherente al tratamiento
- Número de titulares afectados

| Tipo | Qué hacer en integrika |
|------|----------------------|
| **Técnicas** | Cifrado en tránsito (HTTPS), cifrado en reposo (Supabase Vault), RLS, autenticación |
| **Administrativas** | Control de acceso por rol, log de auditoría, política de contraseñas |
| **Físicas** | Aplica a Supabase/Cloudflare (data centers certificados) |

### Art. 19 — Notificación de vulneraciones
Cuando hay brecha de seguridad que afecte datos sensibles: notificar a la **SAyBG** (antes INAI)
y a los titulares afectados de forma inmediata.

---

## 5. TRANSFERENCIAS A TERCEROS

### Arts. 35 y 36 — Reglas de transferencia

Todo tercero que recibe datos (encargado o receptor) debe:
1. Estar listado en el Aviso de Privacidad
2. Tratar datos solo para las finalidades autorizadas
3. Implementar medidas de seguridad equivalentes

**Encargados actuales de integrika:**

| Proveedor | Rol | País | Qué procesa |
|-----------|-----|------|------------|
| Supabase Inc. | Encargado — almacenamiento | EE.UU. | Todos los datos de pacientes |
| Cloudflare Inc. | Encargado — hosting/CDN | EE.UU. | Tráfico web |
| Telegram Messenger | Encargado — mensajería | Emiratos/EE.UU. | Mensajes del bot |
| **Anthropic PBC** | Encargado — IA/LLM | EE.UU. | Texto de consultas (no datos identificables) |

> ⚠️ Transferencias internacionales requieren que el receptor garantice nivel de protección
> equivalente o superior (Arts. 36-43 LFPDPPP).

---

## 6. DERECHOS ARCO

### Arts. 21-34 — Plazos y procedimiento

| Derecho | Qué permite | Respuesta responsable | Implementación |
|---------|------------|----------------------|----------------|
| **Acceso** | Saber qué datos tiene integrika sobre él | 20 días hábiles | — |
| **Rectificación** | Corregir datos inexactos | 20 días hábiles + 15 días para implementar | — |
| **Cancelación** | Eliminar datos (con excepciones por ley) | 20 días hábiles + bloqueo hasta destrucción | NOM-004: 5 años mínimo adultos |
| **Oposición** | Oponerse a finalidades voluntarias o decisiones automatizadas | 20 días hábiles | — |

**Canal ARCO para integrika:** integric.ia@gmail.com (interim; actualizar al domicilio legal)

**Art. 29 — Oficial de protección de datos**
Obligatorio designar responsable interno. Para empresas pequeñas puede ser el mismo dueño.

---

## 7. EXPEDIENTE CLÍNICO — Ley General de Salud + NOMs

### NOM-004-SSA3-2012 — Expediente Clínico

**Contenido mínimo obligatorio** del expediente (aplica a clínicas que usan integrika):
- Historia clínica completa
- Nota de evolución
- Diagnóstico y plan terapéutico
- Recetas y prescripciones
- Consentimiento informado del paciente (para procedimientos)
- Referencia y contrarreferencia

**Retención mínima:**
- Adultos: **5 años** a partir de la última atención
- Menores de edad: hasta **25 años** de edad del paciente

### NOM-024-SSA3-2012 — Sistemas de Expediente Clínico Electrónico

Requisitos técnicos para el software (aplica a integrika directamente):
- **Auditoría**: log de quién accede, qué modifica, cuándo ← ya implementado
- **Respaldos**: copias de seguridad regulares ← Supabase lo hace
- **Control de acceso**: autenticación y autorización por rol ← ya implementado (RLS)
- **Cifrado**: datos en tránsito y en reposo ← HTTPS + Supabase Vault

### LGS reforma 2026 — Expediente Clínico Electrónico Obligatorio

**Art. 71 Bis** (nuevo): Tecnologías digitales obligatorias en prestación de servicios de salud.

**Art. 71 Ter** (nuevo): Digitalización obligatoria del expediente médico; interoperabilidad entre proveedores.

**Art. 71 Quater** (nuevo): Supervisión federal COFEPRIS; sanciones por incumplimiento.

**Sanciones LGS por incumplimiento:**
- Multas administrativas de COFEPRIS
- Suspensión de cédula profesional
- Responsabilidad civil ante pacientes
- Exclusión de programas IMSS/ISSSTE

> ⚠️ Aplica a las **clínicas** que son clientes de integrika, no directamente al software.
> Sin embargo, el software debe facilitar el cumplimiento de las clínicas.

---

## 8. SANCIONES — LFPDPPP 2025

### Arts. 58-64 — Infracciones y multas

| Infracción | Multa en UMAs |
|-----------|--------------|
| No tener Aviso de Privacidad | 100 a 160,000 UMAs |
| Tratar datos sin consentimiento | 100 a 320,000 UMAs |
| No atender derechos ARCO | 100 a 160,000 UMAs |
| No notificar vulneración de seguridad | 200 a 320,000 UMAs |
| Transferir datos sin cumplir requisitos | 200 a 320,000 UMAs |

### Art. 65 — Agravante: datos sensibles
**Las sanciones se DUPLICAN** cuando los datos involucrados son sensibles (salud, genética, etc.)

UMA 2025 = $108.57 MXN ≈ $6 USD

Multa máxima datos sensibles: 640,000 UMAs × $108.57 = ~$69.5 millones MXN (~$3.7M USD)

### Autoridad sancionadora
**Secretaría de Anticorrupción y Buen Gobierno (SAyBG)** — reemplaza a INAI (disuelto 21-mar-2025)
Sitio oficial: https://www.gob.mx/anticorrupcion

**Nueva instancia (2025):** Juzgados federales especializados en protección de datos.
Amparo indirecto disponible — litigios más ágiles.

---

## 9. TÉRMINOS DE SERVICIO — Base legal

### Código de Comercio Arts. 1415-1463 — Arbitraje comercial mexicano

Para B2B (clínicas pagan SaaS):
- Cláusula de arbitraje válida bajo Código de Comercio MX
- Institución recomendada: CANACO, CAM (Centro de Arbitraje de México), o ICC México
- Limitación de responsabilidad válida en contratos B2B
- Fuerza mayor: Código Civil Federal Arts. 2111-2115

### LFPC Art. 32 — Publicidad engañosa
Aplica a claims de IA:
- No afirmar diagnóstico si el sistema no lo certifica
- No usar "inteligencia artificial" si es reglas simples
- Obligatorio disclaimer: "No sustituye criterio médico"

---

## 10. CHECKLIST DE CUMPLIMIENTO

### Técnico (sin abogado) — Estado actual

| Requisito | Art. | Status |
|-----------|------|--------|
| Aviso de Privacidad publicado | LFPDPPP Arts. 15-16 | ⚠️ Borrador (pendiente abogado) |
| Links visibles en login y sidebar | LFPDPPP Art. 16 | ✅ Implementado |
| Consentimiento explícito al registrar paciente | LFPDPPP Art. 9 | ✅ Checkbox con timestamp |
| `consentimiento_privacidad_at` en BD | LFPDPPP Art. 9 | ✅ Migración aplicada |
| Sección decisiones automatizadas/IA en aviso | LFPDPPP 2025 | ✅ Incluida en borrador |
| SAyBG como autoridad (no INAI) | LFPDPPP 2025 | ✅ Corregido |
| Finalidades necesarias vs voluntarias | LFPDPPP 2025 | ✅ En aviso borrador |
| Anthropic como encargado en aviso | LFPDPPP Arts. 35-36 | ✅ Incluida |
| Log de auditoría en BD | NOM-024-SSA3 | ✅ Tabla audit_logs |
| RLS por clínica | NOM-024-SSA3 | ✅ Implementado |
| HTTPS + cifrado en tránsito | NOM-024-SSA3 | ✅ Cloudflare |
| Cifrado en reposo (secrets) | NOM-024-SSA3 | ✅ Supabase Vault |
| Disclaimer bot IA | LFPC Art. 32 | ✅ En saludo del bot |

### Legal (requiere abogado)

| Requisito | Art. | Status |
|-----------|------|--------|
| Texto final Aviso de Privacidad | LFPDPPP Arts. 15-16 | ❌ Pendiente |
| Términos de Servicio con arbitraje | Cód. Comercio 1415+ | ❌ Pendiente |
| Addendum B2B sobre responsabilidad datos salud | LFPDPPP Arts. 35-36 | ❌ Pendiente |
| Designar oficial de protección de datos | LFPDPPP Art. 29 | ❌ Pendiente |
| Registro de actividades de tratamiento (interno) | LFPDPPP Art. 18 | ❌ Pendiente |
| Política de retención y eliminación (5 años NOM-004) | NOM-004-SSA3 | ❌ Pendiente |
| Contrato encargado con Supabase (DPA) | LFPDPPP Arts. 35-36 | ❌ Pendiente |
