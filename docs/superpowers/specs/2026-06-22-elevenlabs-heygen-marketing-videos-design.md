# Spec: Pipeline de Videos de Marketing IntegriKa
**Fecha:** 2026-06-22  
**Estado:** Aprobado  
**Autor:** Pablo + Claude

---

## Objetivo

Producir videos de marketing para IntegriKa usando ElevenLabs (voz) + HeyGen Avatar IV (video), operados directamente desde Claude Code via MCP. Output: videos listos para publicar en YouTube, LinkedIn e Instagram/TikTok.

---

## Arquitectura

```
Claude Code (terminal)
    ├── ElevenLabs MCP  →  genera audio .mp3 (voz ES-MX profesional de librería)
    ├── HeyGen MCP      →  produce video .mp4 (Avatar IV + audio)
    └── Claude          →  escribe scripts, dirige producción

Outputs:
    YouTube   →  video largo 3-5 min (demo completo, landscape 16:9)
    LinkedIn  →  clip 60-90 seg horizontal
    IG / TT   →  clip 30-60 seg vertical 9:16 (subtítulos automáticos HeyGen)
```

**Flujo por video:**
1. Usuario describe tema
2. Claude escribe script en español MX con tono IntegriKa
3. ElevenLabs MCP genera audio con voz profesional elegida
4. HeyGen MCP crea video Avatar IV + audio
5. Video descargado, listo para publicar

---

## Setup MCPs

### ElevenLabs MCP
```json
"elevenlabs": {
  "command": "npx",
  "args": ["-y", "@elevenlabs/elevenlabs-mcp@latest"],
  "env": { "ELEVENLABS_API_KEY": "<desde elevenlabs.io/app/settings/api-keys>" }
}
```

### HeyGen MCP
```json
"heygen": {
  "command": "npx",
  "args": ["-y", "@heygen/mcp@latest"],
  "env": { "HEYGEN_API_KEY": "<desde app.heygen.com/settings/api>" }
}
```

Ambas entradas van en la sección `mcpServers` de `~/.claude/settings.json`.

---

## Identidad de marca

- **Nombre:** IntegriKa
- **Colores:** teal `#0891B2` + emerald `#059669`
- **Tipografía:** Syne (display) + Plus Jakarta Sans (body)
- **Tono:** directo, confianza, técnico-accesible, español MX
- **Voz:** profesional de librería ElevenLabs en español MX (masculina o femenina, elegir en setup)
- **Avatar:** HeyGen Avatar IV de librería, profesional, neutro

---

## Serie de videos

| # | Título | Duración | Enfoque | Prioridad |
|---|--------|----------|---------|-----------|
| 1 | "El problema que resuelve IntegriKa" | 90 seg | Pain point clínicas sin software | 🔴 Primero |
| 2 | "Demo: agenda + Google Calendar" | 3 min | Flujo cita completo | Alta |
| 3 | "Demo: farmacia + corte de caja" | 3 min | POS + turno | Alta |
| 4 | "ROI en 30 días" | 60 seg | +$13,601 MXN/mes neto vs plan Profesional | Alta |
| 5 | "CFDI 4.0 sin dolores de cabeza" | 90 seg | Diferenciador vs Huli/Mi-Consultorio/Medesk | Media |

**Primer video de producción:** Video #1 — valida pipeline completo, el más corto.

---

## Distribución

| Plataforma | Formato | Fuente |
|------------|---------|--------|
| YouTube | 16:9, video completo + descripción SEO | Video principal |
| LinkedIn | 16:9, clip 60-90 seg + copy B2B | Recorte del principal |
| Instagram / TikTok | 9:16, clip 30-60 seg + subtítulos | Recorte vertical |

**Cadencia:** 1 video largo/semana + 2-3 clips derivados = 5 videos cubre 2-3 meses de contenido.

**Subida a plataformas:** manual por el usuario. Videos llegan a carpeta de descargas.

---

## Fuera de alcance (v1)

- Subida automática a YouTube/redes
- Grabación de pantalla del sistema en el video
- Subtítulos quemados fuera de HeyGen
- Música de fondo personalizada

---

## Datos de mercado (pitch)

- TAM: 310k+ clínicas MX, solo 18% con software
- Posicionamiento: "Sistema Operativo de Clínica" (nueva categoría)
- Beachhead: clínicas estética/spa CDMX-GDL-MTY, 3-10 doctores
- ROI calculado: +$13,601 MXN/mes neto vs plan Profesional $5,999/mes
- Competidores: Huli, Mi-Consultorio, Medesk
