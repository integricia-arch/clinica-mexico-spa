# IVA automático por régimen fiscal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derivar automáticamente el tratamiento de IVA de las 3 cuentas de ingreso
(`ING_CONSULTAS`, `ING_FARMACIA`, `ING_OTROS`) a partir del régimen fiscal + tipo de
persona de la clínica, con aplicación manual (un click) en vez de que el admin capture
cada tratamiento a mano.

**Architecture:** Todo en frontend (TypeScript puro) + una columna nueva
`cfdi_config.tipo_persona`. Sin RPC nueva — reutiliza el camino de escritura directa que
`CatalogosTab.tsx` ya usa para `cuentas_contables` (policy `Admins update cuentas
contables`, sin cambio de permisos).

**Tech Stack:** React + TypeScript, Supabase (Postgres + RLS), Vitest para unit tests.

## Global Constraints

- Columna nueva `text` + `CHECK`, nunca enum nativo Postgres (convención del proyecto, ver `iva_tratamiento`).
- Ninguna escritura automática de IVA sin click explícito del admin (spec: "el sistema nunca escribe IVA sin acción humana").
- No tocar `contab_generar_poliza_evento` ni ninguna función `SECURITY DEFINER` — este plan no crea RPCs.
- Sin RLS nueva — las policies existentes (`cfdi_config_modulo_gate`, `Admins update cuentas contables`) ya cubren las columnas nuevas.
- Migraciones nombradas `supabase/migrations/<YYYYMMDDHHMMSS>_<slug>.sql`, siguiendo el patrón de fase 9 (`20260719180000_fase9_iva_trasladado.sql`).

---

## File Structure

- Create: `supabase/migrations/20260720100000_tipo_persona_cfdi_config.sql` — columna nueva.
- Create: `src/features/contabilidad/ivaRules.ts` — mapeo de régimen fiscal y función pura de derivación.
- Create: `src/test/contabilidad/ivaRules.test.ts` — unit tests de la función pura.
- Modify: `src/pages/configuracion/ConfiguracionCFDI.tsx` — selector `tipo_persona`.
- Modify: `src/features/contabilidad/CatalogosTab.tsx` — sugerencia + botón "Aplicar según régimen fiscal".

---

### Task 1: Migración `cfdi_config.tipo_persona`

**Files:**
- Create: `supabase/migrations/20260720100000_tipo_persona_cfdi_config.sql`

**Interfaces:**
- Produces: columna `cfdi_config.tipo_persona` (`text`, nullable, `CHECK (tipo_persona IN ('fisica','moral'))`), consumida por Task 3 (UI) y Task 4 vía lectura en `CatalogosTab.tsx`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Tipo de persona de la clínica (física/moral) — determina tratamiento IVA de
-- consultas (Art. 15-XIV LIVA, exento solo aplica a persona física). Nullable,
-- sin default: nunca asumir, mismo espíritu que iva_tratamiento = 'sin_configurar'.
ALTER TABLE public.cfdi_config
  ADD COLUMN IF NOT EXISTS tipo_persona text
    CHECK (tipo_persona IN ('fisica', 'moral'));
```

- [ ] **Step 2: Aplicar la migración**

Run: `supabase db push --linked --file supabase/migrations/20260720100000_tipo_persona_cfdi_config.sql`
Expected: `Applying migration 20260720100000_tipo_persona_cfdi_config.sql...` sin error.

Si el CLI rechaza por orden de timestamps (ya documentado en `CLAUDE.md`), usar
`supabase db push --linked --include-all`.

- [ ] **Step 3: Verificar en Supabase**

Run (vía MCP `mcp__supabase__execute_sql` o `supabase db query --linked`):
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cfdi_config' AND column_name = 'tipo_persona';
```
Expected: una fila, `is_nullable = 'YES'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260720100000_tipo_persona_cfdi_config.sql
git commit -m "feat: columna tipo_persona en cfdi_config"
```

---

### Task 2: Regla de derivación de IVA (`ivaRules.ts`) — TDD

**Files:**
- Create: `src/features/contabilidad/ivaRules.ts`
- Test: `src/test/contabilidad/ivaRules.test.ts`

**Interfaces:**
- Consumes: nada (función pura, sin dependencias de red/DB).
- Produces:
  - `type TipoPersona = 'fisica' | 'moral'`
  - `type IvaTratamiento = 'sin_configurar' | 'exento' | 'tasa_0' | 'tasa_general'` (mismo union type que ya existe en `CatalogosTab.tsx:17` — Task 4 lo importa de aquí en vez de duplicarlo)
  - `REGIMEN_TIPO_PERSONA: Record<string, TipoPersona | null>` — mapa de las 17 claves de `REGIMENES`; `null` para las 4 ambiguas (610/622/624/626).
  - `deriveIvaTratamiento(regimenFiscal: string, tipoPersona: TipoPersona | null, codigoCuenta: 'ING_CONSULTAS' | 'ING_FARMACIA' | 'ING_OTROS'): { tratamiento: IvaTratamiento; tasaPct: number | null } | null`

- [ ] **Step 1: Escribir los tests (fallan primero)**

```typescript
// src/test/contabilidad/ivaRules.test.ts
import { describe, it, expect } from "vitest";
import { deriveIvaTratamiento, REGIMEN_TIPO_PERSONA } from "@/features/contabilidad/ivaRules";

describe("REGIMEN_TIPO_PERSONA", () => {
  it("clasifica regímenes no ambiguos de persona moral", () => {
    expect(REGIMEN_TIPO_PERSONA["601"]).toBe("moral");
    expect(REGIMEN_TIPO_PERSONA["603"]).toBe("moral");
    expect(REGIMEN_TIPO_PERSONA["620"]).toBe("moral");
    expect(REGIMEN_TIPO_PERSONA["623"]).toBe("moral");
  });

  it("clasifica regímenes no ambiguos de persona física", () => {
    for (const clave of ["605", "606", "608", "611", "612", "614", "616", "621", "625"]) {
      expect(REGIMEN_TIPO_PERSONA[clave]).toBe("fisica");
    }
  });

  it("marca como ambiguos (null) los regímenes que aplican a ambos tipos", () => {
    for (const clave of ["610", "622", "624", "626"]) {
      expect(REGIMEN_TIPO_PERSONA[clave]).toBeNull();
    }
  });
});

describe("deriveIvaTratamiento", () => {
  it("ING_FARMACIA siempre es tasa_0, sin importar tipo de persona", () => {
    expect(deriveIvaTratamiento("601", "moral", "ING_FARMACIA")).toEqual({ tratamiento: "tasa_0", tasaPct: 0 });
    expect(deriveIvaTratamiento("612", "fisica", "ING_FARMACIA")).toEqual({ tratamiento: "tasa_0", tasaPct: 0 });
  });

  it("ING_FARMACIA es tasa_0 incluso si tipoPersona es null (no depende de persona)", () => {
    expect(deriveIvaTratamiento("626", null, "ING_FARMACIA")).toEqual({ tratamiento: "tasa_0", tasaPct: 0 });
  });

  it("ING_CONSULTAS es exento para persona física (Art. 15-XIV LIVA)", () => {
    expect(deriveIvaTratamiento("612", "fisica", "ING_CONSULTAS")).toEqual({ tratamiento: "exento", tasaPct: null });
  });

  it("ING_CONSULTAS es tasa_general 16% para persona moral", () => {
    expect(deriveIvaTratamiento("601", "moral", "ING_CONSULTAS")).toEqual({ tratamiento: "tasa_general", tasaPct: 16 });
  });

  it("ING_CONSULTAS retorna null si tipoPersona es null (régimen ambiguo sin resolver)", () => {
    expect(deriveIvaTratamiento("626", null, "ING_CONSULTAS")).toBeNull();
  });

  it("ING_OTROS siempre es tasa_general 16%, sin importar tipo de persona", () => {
    expect(deriveIvaTratamiento("612", "fisica", "ING_OTROS")).toEqual({ tratamiento: "tasa_general", tasaPct: 16 });
    expect(deriveIvaTratamiento("601", "moral", "ING_OTROS")).toEqual({ tratamiento: "tasa_general", tasaPct: 16 });
  });

  it("ING_OTROS retorna null si tipoPersona es null", () => {
    expect(deriveIvaTratamiento("610", null, "ING_OTROS")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr los tests, confirmar que fallan**

Run: `npx vitest run src/test/contabilidad/ivaRules.test.ts`
Expected: FAIL — `Cannot find module '@/features/contabilidad/ivaRules'`

- [ ] **Step 3: Implementar `ivaRules.ts`**

```typescript
// src/features/contabilidad/ivaRules.ts
export type TipoPersona = "fisica" | "moral";
export type IvaTratamiento = "sin_configurar" | "exento" | "tasa_0" | "tasa_general";

export type CodigoCuentaIngreso = "ING_CONSULTAS" | "ING_FARMACIA" | "ING_OTROS";

/**
 * Clasificación de los 17 regímenes fiscales de REGIMENES (ConfiguracionCFDI.tsx)
 * por tipo de persona. null = aplica a ambos (física y moral), requiere selección
 * explícita del usuario — no se puede inferir solo de la clave SAT.
 */
export const REGIMEN_TIPO_PERSONA: Record<string, TipoPersona | null> = {
  "601": "moral",
  "603": "moral",
  "605": "fisica",
  "606": "fisica",
  "608": "fisica",
  "610": null,
  "611": "fisica",
  "612": "fisica",
  "614": "fisica",
  "616": "fisica",
  "620": "moral",
  "621": "fisica",
  "622": null,
  "623": "moral",
  "624": null,
  "625": "fisica",
  "626": null,
};

export function deriveIvaTratamiento(
  regimenFiscal: string,
  tipoPersona: TipoPersona | null,
  codigoCuenta: CodigoCuentaIngreso
): { tratamiento: IvaTratamiento; tasaPct: number | null } | null {
  if (codigoCuenta === "ING_FARMACIA") {
    return { tratamiento: "tasa_0", tasaPct: 0 };
  }

  if (tipoPersona === null) return null;

  if (codigoCuenta === "ING_CONSULTAS") {
    return tipoPersona === "fisica"
      ? { tratamiento: "exento", tasaPct: null }
      : { tratamiento: "tasa_general", tasaPct: 16 };
  }

  // ING_OTROS
  return { tratamiento: "tasa_general", tasaPct: 16 };
}
```

- [ ] **Step 4: Correr los tests, confirmar que pasan**

Run: `npx vitest run src/test/contabilidad/ivaRules.test.ts`
Expected: PASS — 9 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add src/features/contabilidad/ivaRules.ts src/test/contabilidad/ivaRules.test.ts
git commit -m "feat: regla de derivación de IVA por régimen fiscal y tipo de persona"
```

---

### Task 3: Selector `tipo_persona` en Facturación (`ConfiguracionCFDI.tsx`)

**Files:**
- Modify: `src/pages/configuracion/ConfiguracionCFDI.tsx`

**Interfaces:**
- Consumes: `REGIMEN_TIPO_PERSONA`, `TipoPersona` de `@/features/contabilidad/ivaRules` (Task 2).
- Produces: columna `tipo_persona` persistida en `cfdi_config`, leída por Task 4.

- [ ] **Step 1: Agregar el campo al tipo y estado inicial**

En `src/pages/configuracion/ConfiguracionCFDI.tsx`, importar el tipo y extender la interfaz:

```typescript
// Agregar al import existente de react-router-dom/etc (línea 1-12)
import { REGIMEN_TIPO_PERSONA, type TipoPersona } from "@/features/contabilidad/ivaRules";
```

Modificar `CfdiConfigRow` (línea 40-58) agregando después de `regimen_fiscal: string;`:

```typescript
  tipo_persona: TipoPersona | null;
```

Modificar `EMPTY` (línea 60-66) agregando:

```typescript
  tipo_persona: REGIMEN_TIPO_PERSONA["601"], // "moral" — mismo régimen que EMPTY.regimen_fiscal
```

- [ ] **Step 2: Cargar y guardar el campo**

En el `select` de `load()` (línea 89), agregar `tipo_persona` a la lista de columnas:

```typescript
.select("id, rfc, razon_social, regimen_fiscal, tipo_persona, domicilio_fiscal_cp, serie_defecto, pac_proveedor, pac_ambiente, pac_usuario, csd_cer_nombre, csd_key_nombre, csd_cer_path, csd_key_path, iva_default, zona_fronteriza")
```

En el `setForm` dentro de `load()` (línea 95-112), agregar:

```typescript
          tipo_persona: (row.tipo_persona as TipoPersona | null) ?? REGIMEN_TIPO_PERSONA[(row.regimen_fiscal as string) ?? "601"],
```

En `payload` dentro de `handleSave()` (línea 160-177), agregar después de `regimen_fiscal: form.regimen_fiscal,`:

```typescript
      tipo_persona: form.tipo_persona,
```

- [ ] **Step 3: UI del selector, auto-sugerido y bloqueado en regímenes no ambiguos**

Después del bloque `<select id="regimen_fiscal">` (línea 287-298), reemplazar el `<div>` de `serie_defecto` (línea 299-303) para hacer espacio, y agregar un tercer campo en un nuevo `<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">` justo debajo:

```tsx
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tipo_persona">Tipo de persona *</Label>
            {REGIMEN_TIPO_PERSONA[form.regimen_fiscal] !== null ? (
              <>
                <Input
                  id="tipo_persona"
                  disabled
                  value={REGIMEN_TIPO_PERSONA[form.regimen_fiscal] === "fisica" ? "Física" : "Moral"}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Determinado por el régimen fiscal seleccionado.
                </p>
              </>
            ) : (
              <>
                <select
                  id="tipo_persona"
                  value={form.tipo_persona ?? ""}
                  onChange={(e) => set("tipo_persona", (e.target.value || null) as TipoPersona | null)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="">Selecciona…</option>
                  <option value="fisica">Física</option>
                  <option value="moral">Moral</option>
                </select>
                <p className="mt-1 text-xs text-warning">
                  Este régimen aplica a ambos tipos de persona — selecciona el correcto.
                </p>
              </>
            )}
          </div>
        </div>
```

`set()` (línea 119-120) ya acepta `string | boolean`; ampliar su firma para aceptar el tipo nuevo:

```typescript
  const set = (field: keyof CfdiConfigRow, value: string | boolean | TipoPersona | null) =>
    setForm((prev) => ({ ...prev, [field]: value }));
```

- [ ] **Step 4: Re-sugerir sin pisar valor guardado al cambiar de régimen**

Modificar el `onChange` del `<select id="regimen_fiscal">` (línea 291) para re-sugerir solo si el régimen anterior era ambiguo (es decir, no pisar una elección ya hecha por el usuario en un régimen no ambiguo):

```typescript
              onChange={(e) => {
                const nuevoRegimen = e.target.value;
                const sugerido = REGIMEN_TIPO_PERSONA[nuevoRegimen];
                set("regimen_fiscal", nuevoRegimen);
                if (sugerido !== null) set("tipo_persona", sugerido);
                else if (REGIMEN_TIPO_PERSONA[form.regimen_fiscal] !== null) set("tipo_persona", null);
              }}
```

- [ ] **Step 5: Validación en `handleSave`**

Agregar después de la validación de `domicilio_fiscal_cp` (línea 126):

```typescript
    if (!form.tipo_persona) { toast.error("Selecciona el tipo de persona"); return; }
```

- [ ] **Step 6: Verificación manual**

Run: `npm run dev`, navegar a `/configuracion/facturacion`.
- Seleccionar régimen `601` → tipo de persona debe mostrarse fijo en "Moral".
- Seleccionar régimen `626` (RESICO) → selector editable, guardar sin elegir debe mostrar error "Selecciona el tipo de persona".
- Guardar con `612` + física → recargar página, confirmar que persiste.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 8: Commit**

```bash
git add src/pages/configuracion/ConfiguracionCFDI.tsx
git commit -m "feat: selector tipo de persona en Facturación, base para IVA automático"
```

---

### Task 4: Sugerencia + aplicar en Catálogos (`CatalogosTab.tsx`)

**Files:**
- Modify: `src/features/contabilidad/CatalogosTab.tsx`

**Interfaces:**
- Consumes: `deriveIvaTratamiento`, `IvaTratamiento`, `CodigoCuentaIngreso` de `@/features/contabilidad/ivaRules` (Task 2); columnas `regimen_fiscal`/`tipo_persona` de `cfdi_config` (Task 1, Task 3).
- Produces: UPDATE directo a `cuentas_contables.iva_tratamiento`/`iva_tasa_pct` vía el mismo `save()` ya existente.

- [ ] **Step 1: Reemplazar el `type IvaTratamiento` local por el import compartido**

En `src/features/contabilidad/CatalogosTab.tsx`, borrar la línea 17 (`type IvaTratamiento = ...`) y agregar al bloque de imports (línea 1-15):

```typescript
import { deriveIvaTratamiento, type IvaTratamiento, type CodigoCuentaIngreso } from "@/features/contabilidad/ivaRules";
```

- [ ] **Step 2: Cargar `cfdi_config` (regimen_fiscal + tipo_persona) dentro de `CuentasCrud`**

Agregar estado y carga después de la declaración de `error` (línea 46):

```typescript
  const [cfdiConfig, setCfdiConfig] = useState<{ regimen_fiscal: string; tipo_persona: "fisica" | "moral" | null } | null>(null);
```

Agregar dentro de `useEffect(() => { load(); }, [])` (línea 62) una segunda carga, o crear un `useEffect` aparte inmediatamente después:

```typescript
  useEffect(() => {
    untypedTable("cfdi_config")
      .select("regimen_fiscal,tipo_persona")
      .maybeSingle()
      .then(({ data }) => setCfdiConfig(data as typeof cfdiConfig));
  }, []);
```

- [ ] **Step 3: Botón "Aplicar según régimen fiscal" en la fila de cada cuenta de ingreso**

Modificar la celda IVA de la tabla (línea 146-152) para mostrar la sugerencia junto al botón cuando difiere del valor actual:

```tsx
                    <td className="py-2 pr-4">
                      {c.tipo === "ingreso" ? (
                        <div className="flex items-center gap-2">
                          <span className={c.iva_tratamiento === "sin_configurar" ? "text-amber-600" : "text-muted-foreground"}>
                            {IVA_LABELS[c.iva_tratamiento]}{c.iva_tratamiento === "tasa_general" && c.iva_tasa_pct != null ? ` (${c.iva_tasa_pct}%)` : ""}
                          </span>
                          {(() => {
                            if (!cfdiConfig || !["ING_CONSULTAS", "ING_FARMACIA", "ING_OTROS"].includes(c.codigo)) return null;
                            const sugerido = deriveIvaTratamiento(cfdiConfig.regimen_fiscal, cfdiConfig.tipo_persona, c.codigo as CodigoCuentaIngreso);
                            if (!sugerido) {
                              return <span className="text-xs text-muted-foreground">Define tipo de persona en Facturación</span>;
                            }
                            if (sugerido.tratamiento === c.iva_tratamiento && sugerido.tasaPct === c.iva_tasa_pct) return null;
                            return (
                              <Button
                                size="sm" variant="outline" className="h-6 px-2 text-xs"
                                onClick={() => aplicarSugerido(c, sugerido)}
                              >
                                Aplicar: {IVA_LABELS[sugerido.tratamiento]}{sugerido.tasaPct ? ` (${sugerido.tasaPct}%)` : ""}
                              </Button>
                            );
                          })()}
                        </div>
                      ) : "—"}
                    </td>
```

- [ ] **Step 4: Función `aplicarSugerido`, reutilizando el mismo `update` de `save()`**

Agregar después de `toggleActivo` (línea 105-109):

```typescript
  const aplicarSugerido = async (c: CuentaContable, sugerido: { tratamiento: IvaTratamiento; tasaPct: number | null }) => {
    const { error: err } = await untypedTable("cuentas_contables").update({
      iva_tratamiento: sugerido.tratamiento,
      iva_tasa_pct: sugerido.tasaPct,
    }).eq("id", c.id);
    if (err) { toast.error(friendlyError(err)); return; }
    toast.success(`IVA de ${c.nombre} actualizado`);
    load();
  };
```

- [ ] **Step 5: Verificación manual**

Run: `npm run dev`, navegar a Contabilidad → Catálogos (rol admin).
- Con `cfdi_config.tipo_persona` en `null` (régimen ambiguo sin resolver): las 3 cuentas de ingreso muestran "Define tipo de persona en Facturación", sin botón.
- Con `tipo_persona = 'fisica'`, régimen `612`: `ING_CONSULTAS` muestra botón "Aplicar: Exento"; `ING_FARMACIA` muestra botón "Aplicar: Tasa 0% (0%)"; `ING_OTROS` muestra botón "Aplicar: Tasa general (16%)".
- Click en cada botón → fila se actualiza, botón desaparece (sugerido == actual).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add src/features/contabilidad/CatalogosTab.tsx
git commit -m "feat: aplicar IVA sugerido por régimen fiscal en Catálogos"
```

---

## Self-Review

**Spec coverage:**
- Migración `tipo_persona` (spec §Datos) → Task 1. ✅
- Regla de derivación pura + tabla de mapeo (spec §Regla de derivación) → Task 2. ✅
- Selector auto-sugerido/bloqueado en Facturación (spec §UI Facturación) → Task 3. ✅
- Sugerencia + botón "Aplicar" en Catálogos, sin escritura automática (spec §UI Catálogos, §Error handling) → Task 4. ✅
- Testing (spec §Testing: unit test de `deriveIvaTratamiento` con 17 regímenes × 3 cuentas + 4 ambiguos) → Task 2, Step 1 cubre los 17 regímenes en `REGIMEN_TIPO_PERSONA` (2 tests de clasificación) y los 3 códigos de cuenta × casos física/moral/null (7 tests de derivación). ✅
- Seguridad (spec: sin RLS nueva, sin RPC nueva) → ningún task crea policies ni funciones `SECURITY DEFINER`, confirmado en Global Constraints. ✅

**Placeholder scan:** sin TBD/TODO, todo código completo en cada step.

**Type consistency:** `IvaTratamiento` se define una sola vez en `ivaRules.ts` (Task 2) y se importa tanto en `CatalogosTab.tsx` (Task 4, Step 1) como implícitamente disponible para `ConfiguracionCFDI.tsx` vía `TipoPersona`. `CodigoCuentaIngreso` se usa consistente en Task 2 y Task 4. `deriveIvaTratamiento` firma idéntica en spec, Task 2 y uso en Task 4.
