/**
 * Servidor local de archivos — Integriclinica
 *
 * Almacena estudios, radiografías, PDFs y documentos de la clínica
 * en una carpeta local. NO sube nada a la nube.
 * Imágenes se convierten automáticamente a WebP (Sharp).
 *
 * Uso:
 *   node scripts/local-file-server.cjs
 *
 * Variables de entorno:
 *   PORT=3001
 *   FILES_DIR=C:\Clinica\Estudios
 *   API_KEY=clinica-local-2024
 *
 * Endpoints:
 *   GET  /health           → { ok: true }
 *   GET  /files/:nombre    → descarga/muestra el archivo
 *   PUT  /upload/:nombre   → sube archivo (body binario), imágenes → WebP automático
 *   GET  /list             → lista archivos con tamaño y fecha
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const FILES_DIR = process.env.FILES_DIR ?? path.join(os.homedir(), 'Clinica', 'Estudios');
const API_KEY = process.env.API_KEY ?? 'clinica-local-2024';
const HOST = process.env.HOST ?? '0.0.0.0';

// Sharp es opcional — si no está instalado, imágenes se guardan sin convertir
let sharp = null;
try {
  sharp = require('sharp');
  console.log('[FileServer] Sharp disponible — imágenes se convertirán a WebP');
} catch {
  console.warn('[FileServer] Sharp no disponible — imágenes se guardan sin comprimir');
  console.warn('[FileServer]   Para activar: npm install sharp');
}

// Extensiones que se convierten a WebP cuando Sharp está disponible
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif', '.bmp']);

const MIME = {
  '.pdf':  'application/pdf',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.tiff': 'image/tiff',
  '.dcm':  'application/dicom',
  '.zip':  'application/zip',
  '.xml':  'application/xml',
  '.txt':  'text/plain',
};

function getMime(filename) {
  return MIME[path.extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

function sanitize(name) {
  return path.basename(name.replace(/\.\./g, ''));
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// Convierte imagen a WebP con Sharp. Retorna el nombre final guardado.
async function processImage(inputBuffer, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const base = path.basename(originalName, ext);
  const outName = `${base}.webp`;
  const outPath = path.join(FILES_DIR, outName);

  await sharp(inputBuffer)
    .webp({ quality: 82 })   // 82% = excelente calidad, ~35% más pequeño que JPEG
    .toFile(outPath);

  return outName;
}

if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
  console.log(`[FileServer] Carpeta creada: ${FILES_DIR}`);
}

const server = http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const segments = url.pathname.split('/').filter(Boolean);

  // ── GET /health ────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      filesDir: FILES_DIR,
      port: PORT,
      sharp: !!sharp,
    }));
  }

  // ── GET /list ──────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/list') {
    if (req.headers['x-api-key'] !== API_KEY) {
      res.writeHead(401, cors);
      return res.end(JSON.stringify({ error: 'No autorizado' }));
    }
    const files = fs.readdirSync(FILES_DIR).map((name) => {
      const stat = fs.statSync(path.join(FILES_DIR, name));
      return { name, size: stat.size, modified: stat.mtime };
    });
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ files, count: files.length }));
  }

  // ── GET /files/:nombre ─────────────────────────────────────────
  if (req.method === 'GET' && segments[0] === 'files' && segments[1]) {
    const filename = sanitize(decodeURIComponent(segments[1]));
    const filepath = path.join(FILES_DIR, filename);
    if (!fs.existsSync(filepath)) {
      res.writeHead(404, cors);
      return res.end(JSON.stringify({ error: 'Archivo no encontrado' }));
    }
    const mime = getMime(filename);
    const stat = fs.statSync(filepath);
    const disposition = (mime.startsWith('image/') || mime === 'application/pdf')
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;
    res.writeHead(200, {
      ...cors,
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Content-Disposition': disposition,
      'Cache-Control': 'private, max-age=3600',
    });
    return fs.createReadStream(filepath).pipe(res);
  }

  // ── PUT /upload/:nombre ────────────────────────────────────────
  if (req.method === 'PUT' && segments[0] === 'upload' && segments[1]) {
    if (req.headers['x-api-key'] !== API_KEY) {
      res.writeHead(401, cors);
      return res.end(JSON.stringify({ error: 'No autorizado' }));
    }

    const rawName = sanitize(decodeURIComponent(segments[1]));
    const ext = path.extname(rawName).toLowerCase();
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      const localIP = getLocalIP();
      let savedName = rawName;

      // Convertir imagen a WebP si Sharp está disponible
      if (sharp && IMAGE_EXTS.has(ext)) {
        try {
          savedName = await processImage(buffer, rawName);
          const origKB = (buffer.length / 1024).toFixed(1);
          const newStat = fs.statSync(path.join(FILES_DIR, savedName));
          const newKB = (newStat.size / 1024).toFixed(1);
          console.log(`[FileServer] ✓ Imagen optimizada: ${rawName} → ${savedName} (${origKB} KB → ${newKB} KB)`);
        } catch (sharpErr) {
          console.warn('[FileServer] Sharp falló, guardando original:', sharpErr.message);
          fs.writeFileSync(path.join(FILES_DIR, rawName), buffer);
          savedName = rawName;
        }
      } else {
        // PDF u otro archivo — guardar directamente
        fs.writeFileSync(path.join(FILES_DIR, rawName), buffer);
        console.log(`[FileServer] ✓ Guardado: ${rawName} (${(buffer.length / 1024).toFixed(1)} KB)`);
      }

      const fileUrl = `http://${localIP}:${PORT}/files/${encodeURIComponent(savedName)}`;
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        filename: savedName,
        originalName: rawName,
        url: fileUrl,
        size: fs.statSync(path.join(FILES_DIR, savedName)).size,
      }));
    });

    req.on('error', (err) => {
      console.error('[FileServer] Error al recibir:', err);
      res.writeHead(500, cors);
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

server.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Servidor local de archivos — Integriclinica  ║');
  console.log(`║  http://${localIP}:${PORT}                    `);
  console.log(`║  Carpeta: ${FILES_DIR}`);
  console.log(`║  Imágenes → WebP: ${sharp ? 'ACTIVO' : 'inactivo (npm install sharp)'}`);
  console.log('╚══════════════════════════════════════════════╝');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FileServer] Puerto ${PORT} ocupado. Cambia PORT= o cierra el proceso.`);
  } else {
    console.error('[FileServer] Error:', err);
  }
  process.exit(1);
});
