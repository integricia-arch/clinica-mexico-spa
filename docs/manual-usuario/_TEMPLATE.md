_Copia este archivo a `<slug>.md` (mismo slug que en `manual_paginas`). Borra este bloque de instrucciones al llenar._

_ANTES DE ESCRIBIR — quién lo va a leer: cajero, recepcionista, enfermera, doctor — NO un dev. Escribe en "tú", palabras simples, cero jerga de sistemas ("RPC", "tabla", "endpoint") en las secciones de usuario. Verifica los pasos contra la pantalla real (lee el .tsx) antes de documentar — los flujos suelen tener pasos intermedios (wizards, gates) que no son obvios desde afuera. Si hay un paso previo obligatorio (ej. "abrir turno antes de cobrar"), va primero. **No usar comentarios HTML (`<!-- -->`) en este archivo ni en los manuales reales — rompen el build de Docusaurus (MDX). Usar texto en cursiva (`_así_`) para notas.**_

# <Título de la pantalla>

> Para qué sirve esta pantalla en una frase. Quién la usa (rol, en términos que la persona reconoce — "cajero", no "usuario con rol cajero").

## Operación — cómo se usa

### Cómo <hacer la tarea más común>

1. Paso concreto, verbo imperativo, en "tú".
2. Paso concreto.
3. Resultado esperado — qué debe ver la persona si funcionó.

### Cómo <segunda tarea común>

1. ...

## Reglas de negocio — por qué se comporta así

- **Lo que pasa:** <qué bloquea o exige el sistema, en palabras simples>.
  **Por qué:** <la razón, en una frase que cualquiera entienda>.

## Preguntas frecuentes

| Lo que pasa | Por qué pasa | Qué hacer |
|---|---|---|
| ... | ... | ... |

## Implementación — para el siguiente dev/agente

_El botón "?" dentro de la app corta el contenido justo antes de este encabezado (ver `paraUsuarioFinal()` en `ManualButton.tsx`) — todo lo de aquí abajo solo lo ve quien lee el archivo directamente o el portal Docusaurus._

- **Archivo(s) principal(es):** `src/pages/...`
- **Tablas Supabase involucradas:** `...`
- **RPCs/edge functions:** `...`
- **Cómo agregar un campo nuevo:** pasos concretos (migración, tipo, formulario, RLS si aplica)
- **Cómo agregar una regla de negocio nueva:** dónde vive la validación (frontend, RPC, trigger)

_/aprende YYYY-MM-DD_ — _marca cada edición relevante con fecha, igual que CLAUDE.md_
