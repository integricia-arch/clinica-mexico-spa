# Normatividad Contable — Fuente Local

Copias legales (dominio público / material académico gratuito) de la ley y norma
que respaldan el módulo contable. Ver citas puntuales en
`memoria/proyectos/modulo-contable-memoria-tecnica.md` §12.

**NO incluye** los libros de texto comerciales recomendados por Pablo
(*Contabilidad Básica* — Moreno Fernández; *Principios de Contabilidad* — Romero
López). Son material con derechos de autor — comprar edición legal (Porrúa,
Amazon, McGraw-Hill) si se quiere esa referencia también en local.

## Contenido

`fuente-pdf/` — PDF original tal cual descargado de la fuente oficial.
`markdown/` — misma fuente convertida con MarkItDown, para grep/lectura rápida.

| Archivo | Fuente | Cubre |
|---|---|---|
| `LISR_vigente` | diputados.gob.mx (Cámara de Diputados, texto vigente) | Art. 34 tasas depreciación fiscal |
| `LIVA_vigente` | diputados.gob.mx | Art. 15 fracc. XIV exención IVA servicios médicos |
| `Reglamento_LIVA` | diputados.gob.mx | Art. 41 acota exención a médico/veterinario/dentista |
| `NIF_A2_postulados_basicos` | fcaenlinea1.unam.mx (material académico) | Devengación contable |
| `NIF_MarcoConceptual_SerieA` | hubspot/curso universitario | Postulado dualidad económica (partida doble) |
| `NIF_B2_flujos_efectivo` | ccpudg.org.mx (boletín) | Base de `flujo_efectivo` (filtra por `fecha_pago`) |
| `NIF_B3_resultado_integral` | cinif.org.mx (proyecto auscultación) | Base de `pnl_mensual`/`estado_resultados` |
| `NIF_C6_propiedades_planta_equipo` | ccpudg.org.mx (boletín) | Depreciación contable, activos fijos (pendiente §11) |

## Cuándo usarlos (proceso obligatorio)

1. **Antes de construir un módulo contable/fiscal nuevo:** correr `markitdown` sobre
   cualquier fuente nueva relevante (ya está aquí para lo existente), leer la
   sección aplicable, y solo entonces escribir la migración/RPC. Nunca asumir
   tratamiento fiscal (ver regla `sin_configurar` de IVA — mismo principio).
2. **Al modificar un módulo ya construido:** releer la sección de norma que lo
   respalda (tabla arriba) antes del cambio — confirma que el cambio no rompe
   el cumplimiento ya validado.
3. **Cualquier hallazgo de descuido normativo** (como el de psicólogos/
   nutriólogos sin exención IVA, detectado 2026-07-20): documentar en
   `modulo-contable-memoria-tecnica.md` §12 con la cita exacta, y corregir el
   dato en catálogo/DB — no dejarlo solo anotado.

## Actualizar

Estas leyes/normas cambian (reformas DOF, nuevas NIF). Repetir la descarga desde
las URLs fuente cuando haya reforma relevante — no asumir vigencia indefinida.
