# Pipeline Videos Marketing IntegriKa

> Última actualización: 2026-06-23 — sesión completa guardada

## Arquitectura final: 100% ElevenLabs

```
ElevenLabs MCP (audio) → ElevenLabs Avatar Lip Sync (video) → Studio (ensamble)
```

Sin HeyGen. Sin CapCut. Todo en ElevenLabs.

---

## AUDIO COMPLETO ✅

### Videos principales

| # | Tema | Voz | Música | SRT |
|---|------|-----|--------|-----|
| 1 | El problema (90s) | `tts_¿Te_p_084354.mp3` | `music__091426.mp3` | ✅ |
| 2 | Demo agenda (3min) | `tts_¿Qué__084820.mp3` | `music__091527.mp3` | ✅ |
| 3 | Demo farmacia (3min) | `tts_¿Sabe_084927.mp3` | `music__091547.mp3` | ✅ |
| 4 | ROI (60s) | `tts_Antes_085028.mp3` | `music__091607.mp3` | ✅ |
| 5 | CFDI (90s) | `tts_Cada__085104.mp3` | `music__091624.mp3` | ✅ |

### Hooks IG/TikTok

| Hook | Tema | Voz | Música |
|------|------|-----|--------|
| #1 | No-shows | `tts_Tu_cl_091824.mp3` | `music__091912.mp3` |
| #2 | Inventario | `tts_¿Sabe_091834.mp3` | `music__091920.mp3` |
| #3 | CFDI/SAT | `tts_Tu_pa_091844.mp3` | `music__091927.mp3` |
| #4 | Sistemas | `tts_Agend_091855.mp3` | `music__091934.mp3` |

### Pitch Page (integrika.mx/pitch)
- Voz: `tts_Si_ti_092156.mp3`
- Música: `music__092217.mp3`
- SRT: ✅

### SFX (compartidos todos los videos)
- Transición: `sfx_Subtl_091449.mp3`
- CTA: `sfx_Gentl_091446.mp3`

**Archivos en:** `C:\Users\pablo\Desktop\integrika-videos\audio\`

---

## PROMPTS VISUALES ✅

Ruta: `C:\Users\pablo\Desktop\integrika-videos\prompts\`

Cada prompt incluye: nombre audio, prompt visual para avatar, texto overlay por tiempo, colores.

---

## PRÓXIMO PASO: Avatar + Lip Sync

### Setup (ya hecho)
Playwright MCP agregado a `~/.claude.json` con token. **Requiere reinicio de Claude.**

### Flujo tras reinicio
1. Playwright navega ElevenLabs → Sincronización labial
2. Avatar: **Sofia** (pendiente confirmar)
3. Subir audio TTS → generar lip sync → descargar MP4
4. Studio: agregar música + texto + SFX
5. Exportar 16:9 (YouTube/LinkedIn) + 9:16 (IG/TikTok)

### Créditos video: 26 disponibles (Veo 3.1 Fast)

---

## Config ElevenLabs
- Voz: `mujer integrika` — `6ThqsR1TdYsqzC9MLvUe` — modelo `eleven_v3`
- Página historial: `https://elevenlabs.io/app/history`
- Studio: `https://elevenlabs.io/studio`
- Lip sync: `https://elevenlabs.io/lip-sync`

## Colores marca
`#0D9488` teal · `#10B981` emerald · `#1E293B` dark · `#EF4444` alerta

## Tags
#integrika #marketing #elevenlabs #avatar #lipsync #pipeline
