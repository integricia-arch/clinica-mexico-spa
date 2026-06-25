// scripts/generate-loyalty-icon.mjs
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

const sizes = [192, 512]

for (const size of sizes) {
  const rx = Math.round(size * 0.208)   // radio de esquinas ~40/192
  const sw = Math.round(size * 0.052)   // stroke width
  const pad = Math.round(size * 0.167)  // padding lateral
  const top = Math.round(size * 0.333)  // top del wallet
  const h = Math.round(size * 0.5)      // alto del wallet
  const lineY = Math.round(size * 0.458) // línea horizontal
  const coinX = Math.round(size * 0.625) // monedero derecho X
  const coinW = Math.round(size * 0.208) // ancho monedero
  const coinH = Math.round(size * 0.167) // alto monedero
  const coinRx = Math.round(size * 0.042)
  const walletRx = Math.round(size * 0.063)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#0f766e"/>
  <rect x="${pad}" y="${top}" width="${size - pad * 2}" height="${h}" rx="${walletRx}" fill="none" stroke="white" stroke-width="${sw}"/>
  <line x1="${pad}" y1="${lineY}" x2="${size - pad}" y2="${lineY}" stroke="white" stroke-width="${sw}"/>
  <rect x="${coinX}" y="${lineY}" width="${coinW}" height="${coinH}" rx="${coinRx}" fill="white"/>
</svg>`

  const buf = Buffer.from(svg)
  await sharp(buf).png().toFile(`public/icons/loyalty-${size}.png`)
  console.log(`✓ public/icons/loyalty-${size}.png`)
}
