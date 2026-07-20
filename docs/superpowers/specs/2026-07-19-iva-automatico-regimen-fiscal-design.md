# IVA automático por régimen fiscal — Design Spec

**Fecha:** 2026-07-19
**Estado:** Aprobado, pendiente de plan de implementación.
**Contexto:** Fase 9 (IVA trasladado) cerrada con `cuentas_contables.iva_tratamiento`
arrancando en `sin_configurar` a propósito — el sistema nunca asumía exento/gravado
sin confirmación explícita. Pablo pidió que, en vez de esperar respuesta manual del
contador cuenta por cuenta, el sistema derive el tratamiento correcto aplicando la
normatividad vigente (LIVA) a partir del régimen fiscal ya capturado.

## Alcance

Derivar automáticamente `iva_tratamiento`/`iva_tasa_pct` de las 3 cuentas de ingreso
(`ING_CONSULTAS`, `ING_FARMACIA`, `ING_OTROS`) a partir de `cfdi_config.regimen_fiscal`
(ya existente) + un campo nuevo `cfdi_config.tipo_persona`. El admin revisa el valor
sugerido y lo aplica con un click explícito — el sistema nunca escribe IVA sin acción
humana.

Fuera de alcance: activos fijos, import/export de catálogos, conexión API con
celulas-madre-ventas (backlog aparte, sin relación).

## Arquitectura

Todo vive en frontend (TypeScript) + una columna nueva en `cfdi_config`. Sin RPC nueva:
`cuentas_contables` ya se edita por escritura directa de cliente autenticado con rol
admin (`CatalogosTab.tsx`, policy `Admins update cuentas contables`), y reutilizamos
exactamente ese camino de escritura — no se abre superficie nueva de permisos.

## Datos

### Migración: `cfdi_config.tipo_persona`

```sql
ALTER TABLE public.cfdi_config
  ADD COLUMN IF NOT EXISTS tipo_persona text
    CHECK (tipo_persona IN ('fisica', 'moral'));
```

Nullable, sin default — mismo espíritu que `iva_tratamiento` arrancando en
`sin_configurar`: nunca asumir. Sigue la convención del proyecto (`text` + `CHECK`,
no enum nativo Postgres — ver `iva_tratamiento` en `20260719180000_fase9_iva_trasladado.sql`).

RLS: hereda la policy existente `cfdi_config_modulo_gate` sobre la tabla completa.
No requiere policy nueva.

### Mapeo de régimen fiscal → tipo de persona

De los 17 regímenes en `REGIMENES` (`ConfiguracionCFDI.tsx`):

| No ambiguos → Moral | No ambiguos → Física | Ambiguos (requieren selección explícita) |
|---|---|---|
| 601, 603, 620, 623 | 605, 606, 608, 611, 612, 614, 616, 621, 625 | 610, 622, 624, 626 (RESICO) |

### Regla de derivación (`src/features/contabilidad/ivaRules.ts`)

Función pura `deriveIvaTratamiento(regimenFiscal: string, tipoPersona: 'fisica' | 'moral' | null, codigoCuenta: string): { tratamiento: IvaTratamiento; tasaPct: number | null } | null`

- `ING_FARMACIA` → siempre `tasa_0` (Art. 2-A LIVA, medicamentos de patente) — no depende de tipo de persona.
- `ING_CONSULTAS` → `exento` si `tipoPersona === 'fisica'` (Art. 15-XIV LIVA); `tasa_general` (16%) si `'moral'`.
- `ING_OTROS` → `tasa_general` (16%) siempre.
- Si `tipoPersona` es `null` → retorna `null` (sin sugerencia, régimen ambiguo sin resolver).

## UI — `/configuracion/facturacion` (`ConfiguracionCFDI.tsx`)

- Selector nuevo `tipo_persona` (Física/Moral) junto a `regimen_fiscal`.
- Régimen no ambiguo → selector auto-sugerido y readonly, con nota explicando por qué
  ("Determinado por el régimen fiscal seleccionado").
- Régimen ambiguo (610/622/624/626) → selector editable y obligatorio antes de guardar.
- Cambiar `regimen_fiscal` a una clave no ambigua re-sugiere el valor pero no pisa un
  `tipo_persona` ya guardado sin confirmación explícita del usuario (evita sorpresas si
  ya se había corregido a mano).

## UI — Catálogos (`CatalogosTab.tsx`)

- Para las 3 cuentas de ingreso: si `deriveIvaTratamiento(...)` da un valor distinto al
  actual, mostrar un indicador "Sugerido: {valor}" (no solo color — texto explícito, por
  accesibilidad) + botón "Aplicar según régimen fiscal".
- Click → mismo `update` que ya usa el form manual de edición (reutiliza código
  existente, no ruta nueva).
- Si `tipo_persona` no está definido (régimen ambiguo sin resolver) → botón deshabilitado
  con tooltip "Define tipo de persona en Facturación".

## Error handling

Ninguna escritura automática sin click explícito. El motor de pólizas
(`contab_generar_poliza_evento`, fase 9) no cambia — sigue leyendo `iva_tratamiento` tal
cual está guardado en `cuentas_contables`. Cero riesgo de regresión sobre fase 9 ya
probada en prod.

## Testing

- Unit test de `deriveIvaTratamiento`: tabla de casos cubriendo los 17 regímenes × 3
  cuentas, más los 4 regímenes ambiguos con `tipoPersona = null`.
- Sin E2E nuevo — la escritura en Catálogos reutiliza el flujo CRUD manual ya cubierto.

## Seguridad (verificado contra `supabase-postgres-best-practices`)

- `cuentas_contables`: policy `Admins update cuentas contables` ya limita UPDATE a
  `has_role(auth.uid(), 'admin')`, sin `USING(true)`. Sin cambio necesario.
- `cfdi_config`: policy `cfdi_config_modulo_gate` ya existente cubre la columna nueva
  automáticamente (columna agregada a tabla ya protegida, no requiere policy nueva).
- Sin funciones `SECURITY DEFINER` nuevas en este spec — checklist de CLAUDE.md no aplica.

## Relaciones

- [[modulo-contable-memoria-tecnica]] §10 (fase 9 IVA)
- `memoria/STATE.md` — bloqueo de fase 9 (este spec lo resuelve mediante regla
  automática en vez de espera de respuesta manual del contador)
