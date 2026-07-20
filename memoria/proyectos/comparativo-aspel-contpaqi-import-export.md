# Comparativo Aspel/Contpaqi — import/export, catálogos, reportes (2026-07-19)

Investigación de referencia para diseñar interfaces de import/export de información
del módulo contable (pedido por Pablo, backlog sin fecha — ver `memoria/STATE.md`).
**No implementado.** Objetivo: saber qué maneja el software contable mexicano
estándar (Aspel COI/SAE/NOI) antes de diseñar nuestras propias interfaces.

## Comparativo Aspel COI (contabilidad) vs módulo propio

| Tiene Aspel COI | Nosotros | Gap |
|---|---|---|
| Balanza, auxiliares, balance general, estado de resultados, libro diario | ✅ ya existe (fase 6C) | — |
| Catálogo de cuentas + **import Excel** | ✅ CRUD manual, ❌ sin import Excel/CSV | **Candidato real para import/export** — catálogo es de ~18 cuentas, bajo esfuerzo |
| Pólizas ingreso/egreso/diario | ✅ ya existe | — |
| Pólizas dinámicas desde lectura de CFDI (XML) | Nosotros generamos pólizas automático desde eventos internos (triggers) — enfoque más simple/integrado | Nuestro enfoque cubre mejor el caso porque es un solo sistema, no copiar el suyo |
| **Libro mayor consolidado** (todas las cuentas a la vez, no una por una) | Solo "auxiliar por cuenta" (una a la vez) | Reporte fácil de agregar sobre RPCs que ya existen (`libro_diario`/`auxiliares_cuenta`) — ROI alto, esfuerzo bajo |
| **Presupuestos** | No existe | No urgente |
| **Depreciación de activos fijos** | No existe (fuera de alcance histórico) | Ver `modulo-contable-memoria-tecnica.md` §11 — investigado, Pablo confirmó equipo inventariable, aún no implementado |
| Ajuste anual por inflación (INPC) | No existe | Nicho, solo aplica personas morales régimen general con montos altos — no prioritario |

## Aspel SAE (facturación/inventarios) y NOI (nómina)

- SAE: reportes venta/clientes/inventarios/compras/proveedores — ya cubiertos por
  farmacia/compras/BI, sin gap real.
- NOI: nómina/ISR/IMSS — confirma que nómina es módulo aparte grande, sigue **fuera
  de alcance permanente** (ya documentado en CLAUDE.md), no bolt-on sobre contabilidad.

## Import/export — qué pidió Pablo, para diseñar cuando se retome

Del mensaje original: "interfaces de carga de archivos, cuentas, catálogos, y
poderte conectar con el proyecto de células madre, generar una conexión API —
solo guarda para seguir con los puntos siguientes de un proceso de implementación
importación y exportación de información para el usuario final."

Puntos a diseñar cuando se retome (ninguno construido aún):

1. **Import de catálogo de cuentas** (CSV/Excel) — gap real vs Aspel, bajo esfuerzo,
   candidato para empezar. Reusa `CatalogosTab.tsx` (CRUD ya existe, falta bulk import).
2. **Export de información para usuario final** — más allá de los CSV de reportes
   que ya existen (`exportReporteCsv.ts`, `exportContabilidadCsv.ts`, `exportAnexo24.ts`)
   — aclarar con Pablo qué formato/alcance falta exactamente (¿Excel con formato?
   ¿paquete completo mensual? ¿algo tipo "respaldo" para el contador?).
3. **Conexión API con `celulas-madre-ventas`** — proyecto separado, Supabase distinto
   (`lwgawlxwrvvbvceugpjw`, ver skill `proyectos`). Antes de tocar nada ahí: validar
   stack completo (repo, `git remote -v`, `mcp__supabase__get_project_url`) por la
   máxima global de cambio de proyecto — nunca cruzar MCP entre los dos proyectos.
   Ya existe un puente documentado (tabla `integracion_clinicas`, celulas-madre-ventas
   lee doctors/clinics de clínica) — revisar ese patrón antes de diseñar una API nueva,
   puede que ya cubra parte de lo que se necesita.
4. Sin diseño de tablas/RPCs/RLS todavía para ninguno de los 3 puntos — próxima sesión
   empieza con brainstorming/plan, no con código directo (feature nueva, multi-archivo).

## Relaciones

- [[modulo-contable-memoria-tecnica]] — §10 (fase 9 IVA), §11 (activos fijos)
- `memoria/STATE.md` — backlog general del proyecto
