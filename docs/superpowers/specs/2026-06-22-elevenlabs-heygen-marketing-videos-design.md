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

## Base de contenido para scripts

### El problema (fricciones reales con costo)
| Fricción | Costo |
|----------|-------|
| Paciente llama a las 9pm, nadie contesta → cita perdida | −$800 MXN c/u |
| No-shows sin recordatorio (22–35% de citas) | −$3,200/mes |
| Robo hormiga en farmacia sin trazabilidad | −$3,200/mes |
| Sin CFDI: empresa no puede deducir, elige otra clínica | −Clientes |
| Diferencia de caja no detectada hasta fin de mes | −$1,800/sem |
| 3 sistemas distintos que no se comunican | −Productividad |

### Stats de impacto
- **70%** menos no-shows con recordatorios T-24h y T-2h automáticos
- **310,133** clínicas privadas en MX — solo **18%** tiene software real
- **24/7** el bot agenda sin secretaria (a las 2am si hace falta)
- **9+ módulos** completamente integrados — sin integraciones ni add-ons

### ROI calculado (vs plan Profesional $5,999/mes)
| Concepto | Recuperación |
|----------|-------------|
| 1 no-show evitado/semana ($800 × 4) | +$3,200/mes |
| Reducción robo hormiga farmacia (4% de $80k inventario) | +$3,200/mes |
| Ahorro vs secretaria extra ($7,500 salario − $2,499 plan) | +$5,001/mes |
| Citas recuperadas fuera de horario (3/semana × $600) | +$7,200/mes |
| **Total neto** | **+$13,601/mes** |

### Tabla competitiva
| Feature | IntegriKa | Huli | Mi-Consultorio | Medesk |
|---------|-----------|------|----------------|--------|
| Bot IA Telegram/WhatsApp | ✅ | Add-on caro | ❌ | ❌ |
| Farmacia POS con FEFO | ✅ | ❌ | ❌ | ❌ |
| CFDI 4.0 nativo | ✅ | ❌ | Parcial | Incompleto |
| 3-Way Match anti-robo | ✅ | ❌ | ❌ | ❌ |
| Google Calendar sync | ✅ | ❌ | ❌ | Parcial |
| BI Dashboard tiempo real | ✅ | ❌ | ❌ | Básico |
| Multi-clínica/franquicias | ✅ | Parcial | ❌ | ✅ |
| Pagos Stripe integrados | ✅ | ❌ | ❌ | ❌ |
| Almacén + órdenes de compra | ✅ | ❌ | ❌ | ❌ |
| 100% hecho para México | ✅ | Parcial | ✅ | No |

### Módulos principales (para mencionar en scripts)
1. **Bot IA (Claude Sonnet)** — agenda a las 2am sin secretaria
2. **Recordatorios automáticos** — T-24h y T-2h por Telegram
3. **Agenda multi-doctor** — Google Calendar sincronizado bidireccional
4. **Expediente clínico** — NOM-004, notas SOAP, recetas, consentimientos
5. **Farmacia POS completa** — FEFO, medicamentos controlados (COFEPRIS), corte Z/X
6. **Almacén y Compras** — 3-Way Match anti-robo, auto-reorden
7. **CFDI 4.0 nativo** — sin contador intermediario, CSD en Vault
8. **Pagos Stripe** — Card, OXXO, SPEI, terminal física
9. **Business Intelligence** — KPIs tiempo real, rotación ABC, alertas

### Posicionamiento
- Tagline: *"La clínica que funciona sola no existe todavía. Hasta hoy."*
- Categoría: "Sistema Operativo de Clínica" (nueva categoría, no EHR)
- vs. competencia: *"Huli, Mi-Consultorio y Medesk son soluciones parciales. IntegriKa es el único que integra bot IA, farmacia FEFO, CFDI nativo y BI en un solo precio."*
- Beachhead: clínicas estética/spa CDMX-GDL-MTY, 3-10 doctores
- TAM: 310k+ clínicas MX, 82% sin software real

### Precios (para CTAs)
- Básico: $999/mes (1 doctor)
- Esencial: $2,499/mes (hasta 5 doctores) — **más vendido**
- Profesional: $5,999/mes (hasta 15 doctores + CFDI + Stripe)
- Empresarial: precio personalizado (franquicias, grupos médicos)
