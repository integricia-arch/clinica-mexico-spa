# 03 — Flujo de la App: Navegación y Recorridos de Usuario

---

## Páginas / Rutas

| Ruta | Componente | Estado | Descripción |
|---|---|---|---|
| `/` | AdminDashboard | ✅ Activo | Panel principal con KPIs y accesos rápidos |
| `/agenda` | AgendaMedico | ✅ Activo | Vista semanal de citas por doctor |
| `/pacientes` | PacientesLista | ✅ Activo | Listado + búsqueda de pacientes |
| `/nueva-cita` | NuevaCita | ✅ Activo | Formulario para crear cita manual |
| `/cita/:id` | DetalleCita | ✅ Activo | Ver/editar cita, crear recordatorios manuales |
| `/recepcion` | RecepcionDashboard | ✅ Activo | Vista del día para recepción |
| `/inbox` | Inbox | 🔶 80% | Conversaciones Telegram; falta input envío + filtro escaladas |
| `/expedientes` | Expedientes | ✅ Activo | Historia clínica por paciente |
| `/farmacia` | Farmacia / POS | ✅ Activo | Punto de venta, catálogo, corte de caja |
| `/facturacion` | Facturacion | ✅ Activo | Folios y reportes de ingresos |
| `/configuracion` | Configuracion | ✅ Activo | Clínica, doctores, horarios, integraciones |
| `/auditoria` | Auditoria | ✅ Activo | Log de acciones del sistema |
| `/recordatorios` | Recordatorios | ❌ Pendiente | Vista comprehensiva de todos los recordatorios |
| `/login` | Login | ✅ Activo | Auth Supabase |

---

## Estructura de Navegación

- **Barra lateral izquierda** (desktop) con iconos + etiquetas
- **Pestañas inferiores** (móvil) para rutas principales
- Sidebar colapsa en tablet/móvil → drawer con hamburger
- Badge en sidebar `/inbox` cuando hay conversaciones escaladas sin atender

---

## Primera Pantalla

**Usuario nuevo (no autenticado):** → `/login`  
**Usuario autenticado:** → `/` (AdminDashboard o RecepcionDashboard según rol)

---

## Flujo de Auth

```
1. Usuario abre app → no tiene sesión → /login
2. Ingresa email + password → Supabase Auth
3. Auth OK → redirect a /
4. App detecta rol (user_roles table):
   - admin/receptionist → AdminDashboard
   - doctor → AgendaMedico (su agenda)
5. Logout → vuelve a /login
```

**Rutas protegidas:** Todas excepto `/login`. React Router + hook `useSession`.

---

## Recorrido Principal 1: Paciente agenda por Telegram

```
Paciente escribe en Telegram: "Quiero cita con el Dr. García mañana"
→ telegram-webhook (Edge Function) recibe update
→ Claude analiza intent → tool: consultar_disponibilidad
→ Bot responde: "Tengo disponible 10:00 o 11:30 ¿cuál prefieres?"
→ Paciente: "10:00"
→ Claude → tool: crear_cita → insert en appointments
→ Bot confirma: "Cita confirmada para mañana 10:00 con Dr. García. Te recuerdo 24h antes."
→ Sistema inserta en recordatorios_cita (T-24h + T-2h)
→ pg_cron procesa y envía recordatorios en su momento
```

---

## Recorrido Principal 2: Recepcionista crea cita manual

```
1. Recepcionista → /nueva-cita
2. Selecciona paciente (buscar o crear nuevo)
3. Selecciona doctor
4. Calendario muestra slots disponibles (respeta horario doctor + citas existentes)
5. Selecciona slot → modal confirmación
6. Submit → insert appointment + recordatorios_cita automáticos
7. Redirect → /cita/:id (detalle con confirmación visual)
```

---

## Recorrido Principal 3: Recepcionista atiende conversación escalada

```
1. Badge rojo en sidebar /inbox (conversación escalada)
2. Entra a /inbox → filtro "escaladas" activo por default
3. Ve la conversación con el paciente (historial Telegram)
4. Escribe respuesta en input de envío
5. Submit → Edge Function enviar-mensaje-humano → Telegram API → paciente
6. Marca conversación como resuelta → badge desaparece
```

---

## Recorrido Principal 4: Recordatorio automático

```
pg_cron cada 5 min → llama procesador recordatorios
→ SELECT de recordatorios_cita WHERE status='pendiente' AND hora_envio <= NOW()
→ Para cada uno: obtiene chat_id de identidades_canal
→ Llama Telegram API → envía mensaje
→ UPDATE recordatorios_cita SET status='enviado'
```

---

## Estados Vacíos

| Pantalla | Estado vacío |
|---|---|
| /agenda | "No hay citas esta semana. Crea la primera." + botón |
| /pacientes | "Aún no hay pacientes registrados." + botón importar |
| /inbox | "Sin conversaciones activas." |
| /recordatorios | "No hay recordatorios pendientes." |
| /farmacia | "El inventario está vacío. Agrega medicamentos." |

---

## Estados de Error

| Escenario | Comportamiento |
|---|---|
| Slot ya ocupado (race condition) | Toast error: "Ese horario ya fue tomado. Elige otro." |
| Telegram API falla | Recordatorio queda en status='fallido', reintento manual |
| Bot no entiende intención | Escala a humano automáticamente, badge inbox |
| Edge Function timeout | Log en stderr, respuesta 200 igual (Telegram no reintenta si timeout) |
| Sin conexión | React Query sirve cache, banner "Sin conexión" |

---

## Modales / Overlays

- **Confirmar nueva cita:** resumen antes de guardar
- **Cancelar cita:** motivo requerido + confirmar
- **Escalar conversación:** botón en inbox → cambia status conversación
- **Nuevo recordatorio manual:** desde /cita/:id, tipo libre, canal Telegram

---

## Redirecciones

| Acción | Destino |
|---|---|
| Login exitoso | `/` |
| Logout | `/login` |
| Crear cita → éxito | `/cita/:id` |
| Cancelar cita | `/agenda` |
| Click paciente en lista | `/pacientes/:id` o `/nueva-cita?paciente=:id` |
