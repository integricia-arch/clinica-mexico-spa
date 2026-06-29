# ElevenLabs — Configuración IntegriKa

> Última actualización: 2026-06-23

## Suscripción

- **Plan:** Creator ($22/mes)
- **Caracteres:** 9,354 / 123,087 usados
- **Voice slots:** 2/30 usados
- **Clonación:** Habilitada (instant + professional)

## Voz Principal

- **Nombre:** mujer integrika
- **voice_id:** `6ThqsR1TdYsqzC9MLvUe`
- **Tipo:** generated

## Config actual (problema: robótica/plana)

```
velocidad:   0.96
estabilidad: 47   ← demasiado alta = robótico/sin expresión
similitud:   80
modelo:      eleven_multilingual_v2
```

## Config recomendada (más expresiva)

```
modelo:      eleven_v3         ← más nuevo, mejor prosodia ES
estabilidad: 25–35             ← bajar = más variación natural
similitud:   80                ← mantener
velocidad:   0.96              ← mantener
style:       35–50             ← nuevo parámetro en v3/multilingual_v2
```

## Otras voces en librería

| ID | Nombre | Tipo |
|----|--------|------|
| `c0DgbnqslcBhYw7n7CdM` | anuncio1 | generated |
| `9XaoraKgpXhItOQktYsV` | Zabra - Energetic Announcer | professional |

## Modelos disponibles para español

| Modelo | ES | Notas |
|--------|----|-------|
| `eleven_v3` | ✅ | Más nuevo, mejor expresividad — **recomendado** |
| `eleven_multilingual_v2` | ✅ | Probado, buena prosodia |
| `eleven_flash_v2_5` | ✅ | Rápido, menos expresivo |
| `eleven_turbo_v2_5` | ✅ | Balance velocidad/calidad |
| `eleven_turbo_v2` | ❌ | Solo inglés |
| `eleven_flash_v2` | ❌ | Solo inglés |

## MCP Config (`~/.claude.json`)

```json
"elevenlabs": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@elevenlabs/elevenlabs-mcp@latest"],
  "env": {
    "ELEVENLABS_API_KEY": "<en ~/.claude.json>",
    "ELEVENLABS_MCP_BASE_PATH": "C:\\Users\\pablo\\Desktop\\integrika-videos",
    "ELEVENLABS_MCP_OUTPUT_MODE": "files"
  }
}
```

## Output paths

- Audios: `C:\Users\pablo\Desktop\integrika-videos\audio\`
- Scripts: `C:\Users\pablo\Desktop\integrika-videos\scripts\`
- Videos: `C:\Users\pablo\Desktop\integrika-videos\videos\`

## Spec del proyecto

`docs/superpowers/specs/2026-06-22-elevenlabs-heygen-marketing-videos-design.md`

## Tags

#elevenlabs #integrika #marketing #tts #configuracion
