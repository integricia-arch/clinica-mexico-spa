# Plan: Centro de Control + Camino del Paciente end-to-end

## 1. Diagnóstico actual

En `AdminDashboard` (Centro de Control) hoy la cita del día solo expone:
- "Iniciar camino" (crea la instancia y **navega** a `/camino-paciente/:id`)
- "Operar" / "Cita" (también navegan fuera)
- Drawer lateral con accesos rápidos, sin acción de "registrar llegada"

No existe un botón "Registrar llegada" — por eso el usuario percibe que "no funciona". El flujo real obliga a salir del Centro de Control para tocar el hito `arrival`.

En `operationalSteps.ts` están definidos 13 hitos, pero en `CaminoPaciente.tsx` **solo** `arrival` y `consultation_close` tienen formulario propio. Los demás (`assignment`, `attention_open`, `identification`, `record`, `triage`, `consultation_open`, `prescription`, `pharmacy`, `billing`, `discharge`, `followup`) caen en un fallback genérico "clave/valor" que no captura los datos correctos para una clínica mexicana (NOM-024, NOM-004, CFDI, COFEPRIS).

## 2. Objetivos

1. Desde el Centro de Control se puede **abrir la cita del día y registrar la llegada sin salir de la página**.
2. El botón "Registrar llegada" funciona en 1 clic (crea camino si falta, abre hito, captura motivo, cierra hito y avanza al siguiente).
3. Cada hito tiene un formulario alineado al proceso real de recepción mexicana.

## 3. Cambios — Frontend (Centro de Control)

**`src/features/centro-control/components/TodayAppointmentsTable.tsx`**
- Nueva columna/acción `Registrar llegada` por fila:
  - Si `!instance` → crea camino y abre modal de llegada.
  - Si `instance` y hito `arrival` está `pending`/`open` → abre modal.
  - Si `arrival` está cerrado → muestra etiqueta "✓ Llegada · HH:mm" y deshabilita el botón.
- Conservar "Operar" y "Cita" para navegación profunda.

**Nuevo `QuickArrivalModal.tsx` en `src/features/centro-control/components/`**
- Dialog con el mismo `ArrivalForm` ya existente (reutilización, sin duplicar lógica).
- Al cerrar exitosamente: `reload()` del dashboard y toast "Llegada registrada".
- Si el hito siguiente (`assignment`) está abierto, ofrece botón secundario "Continuar a asignación" que abre el siguiente modal sin navegar.

**`PatientOperationalDrawer.tsx`**
- Reemplazar "Abrir cita" por dos acciones contextuales:
  - "Registrar llegada" (si `arrival` aún no está cerrado)
  - "Continuar camino" (si ya tiene llegada) → abre modal del hito activo
- Mantener acceso a `/camino-paciente/:id` como link secundario "Ver camino completo".

## 4. Auditoría y rediseño del camino (13 hitos)

Para cada hito se define: **rol responsable · qué captura · regla de cierre**. Donde hoy hay fallback genérico se crea un `StepForm` específico.

```text
1. arrival              Recepción     Motivo, síntomas, hora llegada            [ya existe ArrivalForm ✓]
2. assignment           Recepción     Doctor + consultorio + servicio           [nuevo AssignmentForm]
3. attention_open       Enfermería    Llamado a sala, hora apertura             [nuevo AttentionOpenForm]
4. identification       Recepción     INE/CURP verificada + consentimiento      [nuevo IdentificationForm]
5. record (expediente)  Doctor/Enf.   Antecedentes NOM-004 (AHF, APP, APNP),    [nuevo RecordForm]
                                       alergias, medicación crónica
6. triage               Enfermería    TA, FC, FR, T°, SpO2, peso, talla, IMC   [nuevo TriageForm]
7. consultation_open    Doctor        Hora inicio + queja principal             [nuevo ConsultationOpenForm]
8. consultation_close   Doctor        SOAP (ya existe ConsultationForm ✓)
9. prescription         Doctor        Receta electrónica → reutilizar           [link a PrescriptionEditorModal]
                                       PrescriptionEditorModal existente
10. pharmacy            Farmacia      Lote + cantidad dispensada                [nuevo PharmacyForm]
                                       (descuenta de lotes_medicamento)
11. billing             Recepción     CFDI: RFC, uso, forma pago, total MXN     [nuevo BillingForm]
12. discharge           Recepción     Indicaciones de egreso + hora salida      [nuevo DischargeForm]
13. followup            Cualquiera    Programa recordatorio + canal             [nuevo FollowupForm]
```

Todos los `StepForm` siguen el patrón de `ArrivalForm`: autosave debounced + Zod + `saveJourneyStepData` + `closeJourneyStep`. Se renderizan tanto en `CaminoPaciente.tsx` como dentro del modal rápido del Centro de Control (mismo componente, dos contenedores).

## 5. Detalles técnicos por hito

- **identification**: validar formato CURP (18 chars, regex oficial) y registrar en `consentimientos` (tabla existente) marcando `otorgado=true`.
- **record**: si no existe `expedientes` activo para el paciente, lo crea (insert con `tipo='primera_vez'`); si existe, abre el actual.
- **triage**: cálculo IMC en cliente; alerta si TA > 140/90 o SpO2 < 92.
- **prescription**: el modal usa `PrescriptionEditorModal` ya construido; al cerrar, marca el hito `prescription` como completado con el `prescription_id`.
- **pharmacy**: por cada renglón surtido inserta en `movimientos_inventario` (`tipo='salida'`) y descuenta `lotes_medicamento.existencia`. Bloquea cierre si algún medicamento no tiene lote con stock.
- **billing**: campos RFC + Razón social + Uso CFDI + Forma de pago + Total. No emite CFDI real (no hay PAC), solo registra los datos.
- **discharge**: cierra hito y dispara cambio de `appointments.status` a `liberada`.

## 6. Backend / migración

Una migración para:
- Asegurar que `journey_instance_step_data.data_json` tiene índices GIN si se va a consultar (`CREATE INDEX IF NOT EXISTS ...`).
- Verificar/crear catálogo `journey_option_catalogs` para "uso_cfdi", "forma_pago_sat", "canal_seguimiento".

No se cambia ningún esquema crítico de pacientes/citas. RLS actuales ya cubren los nuevos formularios (todos pasan por `journey_instance_step_data` que ya tiene policies `is_clinic_staff`).

## 7. Validación

- Crear cita de prueba para hoy → desde Centro de Control: "Registrar llegada" → modal → guardar → fila muestra "✓ Llegada"; KPI "En espera" -1, "En atención" +1.
- Recorrer los 13 hitos sin salir del Centro de Control hasta `discharge`; verificar progreso 100% y `appointments.status = liberada`.
- Verificar audit logs en `journey_instance_audit` por cada cierre.

## 8. Fuera de alcance (esta iteración)

- Integración real con PAC para CFDI.
- Firma digital de receta (COFEPRIS) — se mantiene firma visual ya existente.
- Reportes / exportación NOM-024 (queda como siguiente plan).
