<!--
Copia este archivo a <slug>.md (mismo slug que en manual_paginas).
Borra estos comentarios al llenar.
-->

# <Título de la pantalla>

> Para qué sirve esta pantalla en una frase. Quién la usa (rol).

## Operación — cómo se usa

<!-- Una sub-sección por tarea concreta, no por botón. -->

### Cómo <hacer la tarea más común>

1. Paso concreto, verbo imperativo.
2. Paso concreto.
3. Resultado esperado — qué debe ver el usuario si funcionó.

### Cómo <segunda tarea común>

1. ...

## Reglas de negocio — por qué se comporta así

<!-- El "por qué" detrás de validaciones, bloqueos, cálculos automáticos.
     Esto es lo que evita el "¿por qué no me deja...?" en el chat de ayuda. -->

- **Regla:** <qué bloquea o exige el sistema>.
  **Razón:** <por qué existe esa regla — normativa, error pasado, lógica de negocio>.

## Errores frecuentes

<!-- Síntoma → causa → qué hacer. Si el usuario llega aquí buscando, debe resolver solo. -->

| Síntoma | Causa | Qué hacer |
|---|---|---|
| ... | ... | ... |

## Implementación — para el siguiente dev/agente

<!-- Esta sección NO es para el usuario final. Es para quien extienda esta pantalla. -->

- **Archivo(s) principal(es):** `src/pages/...`
- **Tablas Supabase involucradas:** `...`
- **RPCs/edge functions:** `...`
- **Cómo agregar un campo nuevo:** <pasos concretos: migración, tipo, formulario, RLS si aplica>
- **Cómo agregar una regla de negocio nueva:** <dónde vive la validación: frontend, RPC, trigger>

---
<!-- /aprende YYYY-MM-DD --> <!-- marca cada edición relevante con fecha, igual que CLAUDE.md -->
