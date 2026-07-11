# Runbook: rotación de la service role key

**Cuándo usar**: sospecha de filtración de la clave de `service_role` de Supabase (apareció en un log, se commiteó por error, se compartió por canal inseguro).

**Tiempo estimado**: 10-15 min. Sin downtime si se sigue el orden — las Edge Functions siguen corriendo con la clave vieja hasta que se actualiza el secret en cada lugar.

## Pasos

1. **Generar la clave nueva** en Supabase Dashboard → Project Settings → API → fila de service role → "Roll key" (confirmar visualmente el botón exacto, puede variar de nombre).
2. **No revocar la clave vieja todavía.** Supabase genera la nueva sin invalidar la anterior hasta confirmarlo explícitamente — evita downtime mientras se actualizan los consumidores.
3. **Actualizar el secret en GitHub Actions**: `gh secret set <nombre del secret, ver CLAUDE.md sección Secrets>` (sin `--body` para que lo pida por prompt oculto, nunca en texto plano de la terminal).
4. **Actualizar el secret en Supabase Dashboard → Edge Functions → Secrets** (lugar separado de GitHub Actions, cada Edge Function que la usa la lee de ahí en runtime).
5. **Actualizar las variables de entorno locales** de cada desarrollador con acceso (archivo de configuración local del proyecto) — avisar por el canal del equipo, no automatizable.
6. **Confirmar que las Edge Functions funcionan** con la clave nueva: smoke test manual (ej. `stripe-webhook` con evento de test) y revisar logs vía `net._http_response` (ver `memoria/STATE.md`, no existe `logs` como subcomando CLI).
7. **Revocar la clave vieja** en Supabase Dashboard una vez confirmado el Paso 6.
8. **Documentar el incidente** en `memoria/diario/YYYY-MM-DD.md`: qué se filtró, cómo, y si el secret-scanning de CI lo hubiera atrapado.

## Rollback

Si algo se rompe después del Paso 4 y la causa es la clave nueva: usar la vieja de nuevo (si no se llegó al Paso 7) mientras se diagnostica.
