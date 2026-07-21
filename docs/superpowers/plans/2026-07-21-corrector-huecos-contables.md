# Corrector de Huecos Contables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al validador de cuadre contable un flujo de diagnóstico + corrección
asistida para huecos `sin_poliza` (movimientos_contables sin póliza asociada), usando el
motor de reglas de asientos ya existente (`contab_reglas_asiento` / `contab_resolver_regla`
/ `contab_generar_poliza_evento`) en vez de inventar un mapeo nuevo.

**Architecture:** Nueva función SQL `contab_diagnosticar_hueco` (solo lectura, resuelve la
regla contable que le correspondería al movimiento vía el motor ya existente de fase 6B) +
componente React que muestra la propuesta con justificación normativa fija y aplica vía
`contab_generar_poliza_evento` (ya existe, se le agrega grant a `authenticated`).

**Tech Stack:** Postgres/Supabase (PL/pgSQL, SECURITY DEFINER), React + TypeScript,
`@supabase/supabase-js` vía `(supabase as any).rpc(...)` (mismo patrón sin tipos generados
que el resto de `useReportesContables.ts`).

## Global Constraints

- Toda función `SECURITY DEFINER` nueva: `SET search_path = public`, `REVOKE EXECUTE ...
  FROM PUBLIC` explícito + `GRANT EXECUTE ... TO <rol mínimo>`, check de
  `clinic_memberships`/`auth.uid()` como primera operación si toca datos multi-tenant
  (regla dura de `CLAUDE.md` del proyecto).
- Nunca INSERT directo a `polizas`/`poliza_partidas` — solo vía `crear_poliza()` /
  `contab_generar_poliza_evento()` (ya delega a `crear_poliza()`).
- `movimientos_contables` y `polizas` son append-only — el corrector solo crea, nunca
  modifica ni borra.
- Migraciones: escribir a archivo `.sql`, aplicar con `mcp__supabase__apply_migration`
  (no `db push` interactivo en este flujo).
- No introducir abstracciones nuevas si el patrón ya existente (hooks planos con
  `rows/loading/error/load` en `useReportesContables.ts`, llamadas RPC directas en
  componentes como `NuevaPolizaDialog.tsx`) ya cubre el caso.

---

### Task 1: Migración — permitir aplicar corrección + RPC de diagnóstico

**Files:**
- Create: `supabase/migrations/20260721120000_corrector_huecos_diagnostico.sql`
- Test: `supabase/scripts/verificar_diagnostico_huecos.sql` (verificación manual, no es
  parte del historial de migraciones)

**Interfaces:**
- Produces: RPC `contab_diagnosticar_hueco(p_movimiento_id uuid) RETURNS jsonb` — payload:
  ```json
  {
    "ok": true,
    "movimiento_id": "uuid",
    "clinic_id": "uuid",
    "evento": "text",
    "reference_type": "text",
    "reference_id": "uuid",
    "monto_centavos": 12345,
    "fecha_devengo": "2026-07-19",
    "descripcion": "text",
    "cuenta_cargo": { "id": "uuid", "codigo": "504", "nombre": "Honorarios médicos" },
    "cuenta_abono": { "id": "uuid", "codigo": "205.01", "nombre": "Honorarios médicos por pagar" }
  }
  ```
  o, si no hay regla configurada para ese `evento`:
  ```json
  { "ok": false, "motivo": "regla_no_encontrada", "evento": "text" }
  ```
- Consumes (ya existentes, sin cambios de firma): `contab_resolver_regla(uuid, text)`,
  `contab_generar_poliza_evento(uuid, text, bigint, date, text, text, uuid, text, text, uuid)`,
  `crear_poliza(jsonb)`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260721120000_corrector_huecos_diagnostico.sql

-- 1. contab_generar_poliza_evento ya existe (fase 6B) pero solo tiene GRANT a
--    service_role. El corrector lo dispara desde el navegador (usuario autenticado),
--    así que necesita poder llamarlo. crear_poliza() ya valida membership cuando
--    auth.uid() IS NOT NULL, así que este GRANT no abre ningún hueco de seguridad
--    nuevo -- solo permite que un miembro de la clínica dispare la generación para
--    SU PROPIA clínica (el payload trae clinic_id, crear_poliza lo valida).
GRANT EXECUTE ON FUNCTION public.contab_generar_poliza_evento(
  uuid, text, bigint, date, text, text, uuid, text, text, uuid
) TO authenticated;

-- 2. Diagnóstico de un hueco puntual: dado un movimiento_contables sin póliza,
--    resuelve qué póliza le correspondería según el motor de reglas ya existente
--    (contab_reglas_asiento / contab_resolver_regla), sin escribir nada.
CREATE OR REPLACE FUNCTION public.contab_diagnosticar_hueco(p_movimiento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_mov public.movimientos_contables%ROWTYPE;
  v_regla record;
  v_cargo record;
  v_abono record;
BEGIN
  SELECT * INTO v_mov FROM public.movimientos_contables WHERE id = p_movimiento_id;
  IF v_mov IS NULL THEN
    RAISE EXCEPTION 'movimiento_no_encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_memberships
    WHERE user_id = auth.uid() AND clinic_id = v_mov.clinic_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_regla FROM public.contab_resolver_regla(v_mov.clinic_id, v_mov.evento);

  IF v_regla.cuenta_cargo_id IS NULL OR v_regla.cuenta_abono_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'regla_no_encontrada', 'evento', v_mov.evento);
  END IF;

  SELECT id, codigo, nombre INTO v_cargo FROM public.cuentas_contables WHERE id = v_regla.cuenta_cargo_id;
  SELECT id, codigo, nombre INTO v_abono FROM public.cuentas_contables WHERE id = v_regla.cuenta_abono_id;

  RETURN jsonb_build_object(
    'ok', true,
    'movimiento_id', v_mov.id,
    'clinic_id', v_mov.clinic_id,
    'evento', v_mov.evento,
    'reference_type', v_mov.reference_type,
    'reference_id', v_mov.reference_id,
    'monto_centavos', abs(v_mov.monto_centavos),
    'fecha_devengo', v_mov.fecha_devengo,
    'descripcion', v_mov.descripcion,
    'cuenta_cargo', jsonb_build_object('id', v_cargo.id, 'codigo', v_cargo.codigo, 'nombre', v_cargo.nombre),
    'cuenta_abono', jsonb_build_object('id', v_abono.id, 'codigo', v_abono.codigo, 'nombre', v_abono.nombre)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.contab_diagnosticar_hueco(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contab_diagnosticar_hueco(uuid) TO authenticated;
```

- [ ] **Step 2: Aplicar la migración**

Usar `mcp__supabase__apply_migration` con `name: "corrector_huecos_diagnostico"` y el
contenido de arriba. Confirmar que corre sin error.

- [ ] **Step 3: Verificar manualmente contra un hueco real**

Escribir `supabase/scripts/verificar_diagnostico_huecos.sql`:

```sql
-- Correr con mcp__supabase__execute_sql. Toma el primer movimiento sin_poliza
-- del rango usado en la sesión de verificación (2026-07-01..2026-07-31) y
-- confirma que el diagnóstico regresa ok:true con cuentas válidas.
SELECT public.contab_diagnosticar_hueco(mc.id)
FROM public.movimientos_contables mc
WHERE mc.clinic_id = (SELECT id FROM public.clinics LIMIT 1)
  AND mc.fecha_devengo BETWEEN '2026-07-01' AND '2026-07-31'
  AND mc.reference_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.polizas p
    WHERE p.reference_type = mc.reference_type AND p.reference_id = mc.reference_id AND p.evento = mc.evento
  )
LIMIT 1;
```

Expected: una fila jsonb con `"ok": true` y `cuenta_cargo`/`cuenta_abono` con `codigo`
numérico real del catálogo (ej. `"504"`, `"205.01"`). Si sale `"ok": false,
"motivo":"regla_no_encontrada"`, anotar el `evento` — significa que ese tipo de
movimiento no tiene regla en `contab_reglas_asiento` y se reportará como "requiere
corrección manual" en la UI (Task 3), no es un bug de esta migración.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260721120000_corrector_huecos_diagnostico.sql supabase/scripts/verificar_diagnostico_huecos.sql
git commit -m "feat: RPC contab_diagnosticar_hueco para corrector de huecos contables"
```

---

### Task 2: Componente de propuesta de corrección

**Files:**
- Create: `src/features/contabilidad/PropuestaCorreccionCard.tsx`

**Interfaces:**
- Consumes: `HuecoFila` de `src/hooks/useReportesContables.ts` (ya existe: `{ tipo_hueco:
  "sin_referencia"|"sin_poliza"; fecha: string; origen_id: string; descripcion: string;
  monto_centavos: number }`). `origen_id` en una fila `sin_poliza` es el `id` de
  `movimientos_contables` (confirmado en `contab_auditoria_huecos`, columna `mc.id`).
- Produces: componente `PropuestaCorreccionCard({ hueco: HuecoFila; onAplicado: () => void
  })` — se monta una vez por fila `sin_poliza` cuando el usuario da clic en "Diagnosticar".

- [ ] **Step 1: Crear el componente**

```tsx
// src/features/contabilidad/PropuestaCorreccionCard.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/errors";
import type { HuecoFila } from "@/hooks/useReportesContables";

function fmtMXN(centavos: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(centavos / 100);
}

interface CuentaRef { id: string; codigo: string; nombre: string }
interface Diagnostico {
  ok: boolean;
  motivo?: string;
  evento?: string;
  movimiento_id?: string;
  clinic_id?: string;
  reference_type?: string;
  reference_id?: string;
  monto_centavos?: number;
  fecha_devengo?: string;
  descripcion?: string;
  cuenta_cargo?: CuentaRef;
  cuenta_abono?: CuentaRef;
}

const JUSTIFICACION =
  "Partida doble (NIF A-2, postulado de dualidad económica; NIF C-1, presentación de " +
  "estados financieros): todo movimiento devengado debe registrarse con cargo y abono " +
  "iguales antes de poder aparecer en balanza o balance general. Este movimiento tiene " +
  "monto en devengo simple pero no tiene su asiento de partida doble — la regla dura de " +
  "crear_poliza() (SUM(debe)=SUM(haber)) exige generarlo con estas mismas cuentas que ya " +
  "usa el motor de asientos para este tipo de evento.";

export function PropuestaCorreccionCard({ hueco, onAplicado }: { hueco: HuecoFila; onAplicado: () => void }) {
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [loading, setLoading] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [descartado, setDescartado] = useState(false);
  const [aplicado, setAplicado] = useState(false);

  const diagnosticar = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("contab_diagnosticar_hueco", {
      p_movimiento_id: hueco.origen_id,
    });
    setLoading(false);
    if (error) { toast.error(friendlyError(error, "No se pudo diagnosticar el hueco.")); return; }
    setDiagnostico(data as Diagnostico);
  };

  const aplicar = async () => {
    if (!diagnostico?.ok || !diagnostico.cuenta_cargo || !diagnostico.cuenta_abono) return;
    setAplicando(true);
    const { error } = await (supabase as any).rpc("contab_generar_poliza_evento", {
      p_clinic_id: diagnostico.clinic_id,
      p_evento: diagnostico.evento,
      p_monto_centavos: diagnostico.monto_centavos,
      p_fecha: diagnostico.fecha_devengo,
      p_concepto: diagnostico.descripcion,
      p_reference_type: diagnostico.reference_type,
      p_reference_id: diagnostico.reference_id,
    });
    setAplicando(false);
    if (error) { toast.error(friendlyError(error, "No se pudo aplicar la corrección.")); return; }
    toast.success("Póliza generada");
    setAplicado(true);
    onAplicado();
  };

  if (descartado) return null;

  if (!diagnostico) {
    return (
      <div className="rounded-lg border p-3 text-sm flex items-center justify-between">
        <span>{hueco.descripcion} — {fmtMXN(hueco.monto_centavos)}</span>
        <Button size="sm" variant="outline" onClick={diagnosticar} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Diagnosticar
        </Button>
      </div>
    );
  }

  if (!diagnostico.ok) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        Sin regla contable configurada para el evento <span className="font-mono">{diagnostico.evento}</span> —
        requiere corrección manual (Pólizas → Nueva póliza).
      </div>
    );
  }

  if (aplicado) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" /> Póliza generada para este movimiento.
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3 text-sm space-y-2">
      <p className="font-medium">Propuesta de corrección</p>
      <table className="w-full text-xs">
        <tbody>
          <tr>
            <td className="py-1">{diagnostico.cuenta_cargo!.codigo} — {diagnostico.cuenta_cargo!.nombre}</td>
            <td className="py-1 text-right">Cargo {fmtMXN(diagnostico.monto_centavos!)}</td>
          </tr>
          <tr>
            <td className="py-1">{diagnostico.cuenta_abono!.codigo} — {diagnostico.cuenta_abono!.nombre}</td>
            <td className="py-1 text-right">Abono {fmtMXN(diagnostico.monto_centavos!)}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">{JUSTIFICACION}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={aplicar} disabled={aplicando}>
          {aplicando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Aplicar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDescartado(true)}>
          <XCircle className="mr-1 h-4 w-4" /> Descartar
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos atribuibles a `PropuestaCorreccionCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/contabilidad/PropuestaCorreccionCard.tsx
git commit -m "feat: componente de propuesta de corrección para huecos contables"
```

---

### Task 3: Integrar en ValidadorCuadreDialog

**Files:**
- Modify: `src/features/contabilidad/ValidadorCuadreDialog.tsx:109-121` (bloque de
  `Resultado` para huecos)

**Interfaces:**
- Consumes: `PropuestaCorreccionCard` (Task 2), `huecos.load(desde, hasta)` (ya existe en
  `useAuditoriaHuecos()`, línea 39-40 del archivo).

- [ ] **Step 1: Importar el componente nuevo**

En `src/features/contabilidad/ValidadorCuadreDialog.tsx`, agregar tras la línea 10:

```tsx
import { PropuestaCorreccionCard } from "@/features/contabilidad/PropuestaCorreccionCard";
```

- [ ] **Step 2: Reemplazar el bloque de huecos para mostrar la card de corrección**

Reemplazar líneas 109-121 (bloque `<Resultado ok={huecos.rows.length === 0}>` de huecos):

```tsx
              <Resultado ok={huecos.rows.length === 0}>
                <p className="font-medium">Huecos entre devengo simple y partida doble</p>
                {huecos.rows.length === 0 ? <p>Sin huecos detectados en el período.</p> : (
                  <div className="mt-2 space-y-2">
                    {huecos.rows.slice(0, 20).map((h, i) => (
                      h.tipo_hueco === "sin_poliza" ? (
                        <PropuestaCorreccionCard key={h.origen_id} hueco={h} onAplicado={() => validar()} />
                      ) : (
                        <div key={i} className="rounded-lg border p-3 text-sm">
                          <span className="font-mono text-xs">{h.tipo_hueco}</span> — {h.fecha} — {h.descripcion} — {fmtMXN(h.monto_centavos)}
                          <p className="mt-1 text-xs text-muted-foreground">
                            Póliza sin reference_type — requiere revisión manual (no hay dato suficiente para inferir el origen).
                          </p>
                        </div>
                      )
                    ))}
                    {huecos.rows.length > 20 && <p>… y {huecos.rows.length - 20} más</p>}
                  </div>
                )}
              </Resultado>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/features/contabilidad/ValidadorCuadreDialog.tsx
git commit -m "feat: integrar corrector de huecos en el validador de cuadre contable"
```

---

### Task 4: Verificación end-to-end en browser

**Files:** ninguno (verificación manual, sin cambios de código)

- [ ] **Step 1: Levantar el dev server si no está corriendo**

Run: `npm run dev` (o confirmar que ya corre en `:8080`, como en la sesión 2026-07-21).

- [ ] **Step 2: Login como admin y abrir Contabilidad → Reportes → Validar cuadre**

Credenciales admin en `.claude/project-context.md`. Correr "Calcular" con el rango que
tenga los 5 huecos `sin_poliza` detectados en la verificación previa de esta sesión
(`2026-07-01` a `2026-07-31`).

- [ ] **Step 3: Diagnosticar y aplicar cada hueco `sin_poliza`**

Para cada uno: clic "Diagnosticar", confirmar que la propuesta muestra cuentas con código
numérico real y la justificación normativa, clic "Aplicar", confirmar toast "Póliza
generada".

- [ ] **Step 4: Re-validar y confirmar mejora**

Clic "Calcular" de nuevo. Expected: la lista de huecos `sin_poliza` baja a 0 (o solo
quedan los que dieron `regla_no_encontrada`), y la diferencia de la ecuación contable
($420 antes de esta sesión) y de cortes Z ($2,001.50 antes) bajan o desaparecen si esos
huecos eran la causa.

- [ ] **Step 5: Confirmar que no se duplican pólizas si se re-aplica**

Clic "Diagnosticar"+"Aplicar" de nuevo sobre un movimiento ya corregido (si el hueco ya
no aparece en la lista, correr manualmente `contab_generar_poliza_evento` dos veces vía
`mcp__supabase__execute_sql` con los mismos parámetros). Expected: mismo `poliza_id`
regresado ambas veces (idempotencia de `crear_poliza()`), no aparece una segunda póliza
en Pólizas.

---

## Después de este plan

Continuar con `memoria/proyectos/plan-trazabilidad-contable-almacen.md`, Fase 0 (auditoría
de `reference_type` reales en BD) — con los huecos cerrados, los datos de pólizas quedan
limpios para construir trazabilidad reporte↔trámite sobre ellos.
