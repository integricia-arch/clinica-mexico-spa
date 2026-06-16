// Copia el build estático de Docusaurus (manual-site/build) a dist/manual
// para que el mismo Worker de Cloudflare sirva /manual/* como archivos estáticos
// (Workers Assets resuelve rutas exactas antes de caer al fallback SPA).
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "manual-site", "build");
const dest = path.join(__dirname, "..", "dist", "manual");

if (!fs.existsSync(src)) {
  console.error(`[copy-manual-build] No existe ${src} — corre "npm run build" dentro de manual-site/ primero.`);
  process.exit(1);
}

fs.cpSync(src, dest, { recursive: true });
console.log(`[copy-manual-build] Copiado ${src} -> ${dest}`);
