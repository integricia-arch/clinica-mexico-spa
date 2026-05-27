# Panel del doctor — Ventana operativa clínica

Objetivo: agregar `/doctor` para que el médico atienda al paciente de forma guiada, conectado al Camino del Paciente. **No** se duplica nada existente: se reutiliza `journeyEngine`, `PrescriptionEditorModal`, `NotaConsultaModal`, `PatientJourneyLine`, expedientes y recetas.

---

## 1. Cambios de base de datos (1 migración)

Hoy no existe ninguna tabla de análisis/estudios — sólo el campo SOAP `notas_consulta.analisis`. Se crea:

- **`patient_studies`** — orden de estudio/análisis
  - `id, patient_id, doctor_id, appointment_id?, journey_instance_id?, expediente_id?, consultation_note_id?`
  - `tipo` (lab | imagen | otro), `nombre`, `motivo`, `prioridad` (rutina|urgente|stat), `area_laboratorio?`
  - `requiere_ayuno` bool, `indicaciones_paciente`, `observaciones`
  - `status` (solicitado|recibido|revisado|reutilizado|descartado)
  - `solicitado_at, solicitado_por, recibido_at, recibido_por, revisado_at, revisado_por`
  - `resultado_resumen, interpretacion_medica, archivo_url, laboratorio_origen`
  - `replaces_study_id?` cuando se reutiliza o repite uno previo + `justificacion_repeticion`
  - GRANT + RLS: staff lee/escribe; paciente ve los suyos (solo lectura).
  - Audit trigger ya existente (`audit_trigger`).

No se crean tablas de seguimiento (ya existe `post_consultation_followups`) ni de receta (`prescriptions`).

---

## 2. Ruta y navegación

- `src/App.tsx`: nueva ruta `/doctor` (roles `doctor`, `admin`, `nurse` lectura).
- `src/components/AppLayout.tsx`: nuevo `NAV_ITEM` "Panel del doctor" (icono Stethoscope), visible para `doctor` y `admin`.
- Botones "Abrir en Panel del doctor" en: Dashboard (tarjeta cita del día), `CaminoPaciente.tsx`, `Expedientes.tsx`, `DetalleCita.tsx`.

Si el `user` tiene rol `doctor` pero no existe en `doctors` → pantalla vacía con mensaje **"No se encontró un perfil médico vinculado a este usuario."**

---

## 3. Layout `/doctor` (3 columnas)

```text
┌──────────────┬───────────────────────────────┬──────────────┐
│ Mis pacientes│  Ficha + Línea del camino     │ Acciones     │
│ (hoy/pend.)  │  + paneles contextuales       │ clínicas     │
└──────────────┴───────────────────────────────┴──────────────┘
```

**Columna izquierda — `DoctorPatientQueue`**
- Lista citas del día del doctor logueado (admin elige doctor en select).
- Por fila: hora, paciente, servicio, consultorio, estado del camino, hito actual, badges de alerta (sin consentimiento, sin alergias, análisis pendiente).
- Estados visuales derivados del journey: por atender / en consulta / esperando análisis / resultado recibido / receta pendiente / listo salida / seguimiento.
- Métricas en cero ocultas.

**Columna central — `PatientClinicalContext` + línea**
- Header: nombre, edad, sexo, teléfono, alergias confirmadas, medicamentos actuales, antecedentes, última visita, servicio, consultorio, llegada, tiempo de espera.
- Si datos vacíos: textos compactos ("Sin alergias registradas", etc.).
- Si alergias **no confirmadas** → alerta destructive: *"Debe confirmar alergias antes de recetar."*
- Tabs compactas: Antecedentes · Estudios previos · Recetas previas · Indicaciones previas (cada tab oculta si no hay datos).
- Debajo: `PatientJourneyLine` reusada (modo `compact`, refinado visualmente — ver §5).

**Columna derecha — `ClinicalActionsPanel`**
- Botones contextuales habilitados según hito y validaciones:
  - Abrir consulta · Guardar nota · Solicitar análisis · Revisar análisis · Emitir receta · Cerrar consulta · Enviar a caja · Dar salida · Programar seguimiento.

---

## 4. Acciones clínicas (todas validadas y auditadas)

Todas pasan por un nuevo helper `advancePatientJourneyFromClinicalEvent(eventType, payload)` en `src/features/camino-paciente/services/clinicalEvents.ts` que llama a `openJourneyStepByKey` / `closeJourneyStep` / `saveJourneyStepData` ya existentes.

| Acción | Modal/Drawer | Hitos del journey afectados |
|---|---|---|
| Abrir consulta | reusa `NotaConsultaModal` (precarga expediente) | abre `consultation_open`, valida llegada+identificación+expediente+alergias |
| Guardar nota | `NotaConsultaModal` | `consultation_note_saved` (no avanza) |
| Solicitar análisis | nuevo `RequestStudyDrawer` (lista estudios previos similares vigentes con alerta de reutilización) | abre hito virtual *"Análisis solicitado"* mapeado a `consultation_close` bloqueado + bandera en `journey_instance_step_data` |
| Registrar resultado | nuevo `RegisterStudyResultDrawer` (abrible desde panel, camino, expediente) | marca estudio `recibido`, notifica al doctor |
| Revisar análisis | nuevo `ReviewStudyDrawer` | estudio `revisado` + interpretación |
| Emitir receta | **reusa `PrescriptionEditorModal`** con todos los props ya soportados | cierra hito `prescription` al emitir |
| Cerrar consulta | `CloseConsultationDialog` (valida nota, plan, análisis, receta, seguimiento) | cierra `consultation_close` |
| Enviar a caja / salida | reusa hito `billing` + `discharge` | open/close vía engine |
| Seguimiento | reusa `post_consultation_followups` + `followupService` | crea seguimiento |

Las validaciones de bloqueo se ejecutan en el cliente y en el servidor (via `journeyEngine` que ya verifica predecesores). Override sólo con rol autorizado y motivo (ya soportado por `requestStepOverride`).

---

## 5. Línea gráfica refinada

Se mejora `PatientJourneyLine` (no se reemplaza) con una variante `variant="clinical"`:
- Nodos pequeños (24px), línea fina entre ellos.
- Paleta semántica: verde/turquesa = completado, azul = en proceso, ámbar = esperando análisis/revisión, morado = receta, rojo suave = bloqueo, gris = pendiente.
- Click → resumen en popover. Doble click → abre drawer del hito (igual que hoy).
- Tooltip: estado, responsable, opened_at/closed_at, próxima acción, motivo bloqueo.
- Etiquetas hito-actual + próxima acción debajo de la línea, resto sólo en tooltip (minimalista).

---

## 6. Detalle técnico

**Archivos nuevos:**
- `src/pages/PanelDoctor.tsx`
- `src/features/panel-doctor/components/DoctorPatientQueue.tsx`
- `src/features/panel-doctor/components/PatientClinicalContext.tsx`
- `src/features/panel-doctor/components/ClinicalActionsPanel.tsx`
- `src/features/panel-doctor/components/RequestStudyDrawer.tsx`
- `src/features/panel-doctor/components/RegisterStudyResultDrawer.tsx`
- `src/features/panel-doctor/components/ReviewStudyDrawer.tsx`
- `src/features/panel-doctor/components/CloseConsultationDialog.tsx`
- `src/features/panel-doctor/hooks/useDoctorQueue.ts` (citas del día por doctor)
- `src/features/panel-doctor/hooks/usePatientClinicalSnapshot.ts` (alergias, meds, antecedentes, últimas notas, estudios, recetas)
- `src/features/panel-doctor/services/studiesService.ts` (CRUD `patient_studies`)
- `src/features/camino-paciente/services/clinicalEvents.ts` (helper unificado)

**Archivos editados (mínimos):**
- `src/App.tsx` (ruta `/doctor`)
- `src/components/AppLayout.tsx` (`NAV_ITEMS`)
- `src/features/camino-paciente/components/PatientJourneyLine.tsx` (variante `clinical`)
- `src/pages/CaminoPaciente.tsx`, `src/pages/DetalleCita.tsx`, `src/pages/AdminDashboard.tsx`, `src/pages/Expedientes.tsx` (botones "Abrir Panel del doctor")

**No se tocan:** `journeyEngine.ts`, `PrescriptionEditorModal.tsx`, `NotaConsultaModal.tsx`, types Supabase, RLS existente, auth.

---

## 7. Auditoría

Todo se registra vía:
- `audit_trigger` (ya activo en tablas con audit) para `patient_studies`, `notas_consulta`, `prescriptions`.
- `journey_instance_audit` para cada open/close/skip/override (ya lo hace `journey_step_audit_trigger`).

Sin borrado de auditoría (políticas `Deny delete` ya existentes).

---

## 8. Validación de extremo a extremo

Recorrido manual descrito por el usuario (pasos 1–18): selección paciente → abrir consulta → solicitar análisis → registrar resultado → revisar → receta → cerrar consulta → caja/alta → seguimiento, verificando que la línea gráfica refleje cada cambio y que la auditoría capture cada acción.

---

## 9. Fuera de alcance

- Catálogo CIE-10 real (se mantiene campo libre como hoy).
- Integración con laboratorio externo / PACS / firma COFEPRIS.
- Portal del paciente (sólo se asegura que los datos generados sean visibles cuando ese módulo lo consuma).
- Nuevas tablas de seguimiento o receta (se reutilizan las existentes).

---

¿Apruebo y procedo con la migración de `patient_studies` y luego implemento el frontend?
