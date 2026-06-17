/**
 * Servidor local de archivos — Integriclinica
 *
 * Almacena estudios, radiografías, PDFs y documentos de la clínica
 * en una carpeta local. NO sube nada a la nube.
 *
 * Uso:
 *   node scripts/local-file-server.cjs
 *
 * Variables de entorno (opcional):
 *   PORT=3001              Puerto del servidor (default: 3001)
 *   FILES_DIR=C:\Clinica\Estudios    Carpeta donde guardar los archivos
 *   API_KEY=tu-clave-secreta         Clave de autenticación
 *
 * Endpoints:
 *   GET  /health           → { ok: true }
 *   GET  /files/:nombre    → descarga o muestra el archivo
 *   PUT  /upload/:nombre   → sube un archivo (body = binario del archivo)
 *   GET  /list             → lista todos los archivos con tamaño y fecha
 *
 * Ejemplo de subida desde browser:
 *   const res = await fetch('http://localhost:3001/upload/paciente-123-rx.pdf', {
 *     method: 'PUT',
 *     headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/octet-stream' },
 *     body: archivoBlob,
 *   });
 *   const { url } = await res.json(); // guarda esta URL en Supabase
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const FILES_DIR = process.env.FILES_DIR ?? path.join(os.homedir(), 'Clinica', 'Estudios');
const API_KEY = process.env.API_KEY ?? 'clinica-local-2024';
const HOST = process.env.HOST ?? '0.0.0.0'; // escucha en toda la red local

// Crear carpeta si no existe
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
  console.log(`[FileServer] Carpeta creada: ${FILES_DIR}`);
}

// MIME types comunes en clínica
const MIME = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.dcm': 'application/dicom',
  '.zip': 'application/zip',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

function getMime(filename) {
  const ext = path.extname(filename).toLowerCase();
  return MIME[ext] ?? 'application/octet-stream';
}

// Sanitiza el nombre de archivo: evita path traversal
function sanitize(name) {
  return path.basename(name.replace(/\.\./g, ''));
}

// Obtiene la IP local para mostrarla en el inicio
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const segments = url.pathname.split('/').filter(Boolean);

  // ── GET /health ────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, filesDir: FILES_DIR, port: PORT }));
  }

  // ── GET /list ──────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/list') {
    if (req.headers['x-api-key'] !== API_KEY) {
      res.writeHead(401, corsHeaders);
      return res.end(JSON.stringify({ error: 'No autorizado' }));
    }
    const files = fs.readdirSync(FILES_DIR).map((name) => {
      const stat = fs.statSync(path.join(FILES_DIR, name));
      return { name, size: stat.size, modified: stat.mtime };
    });
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ files }));
  }

  // ── GET /files/:nombre ─────────────────────────────────────────
  if (req.method === 'GET' && segments[0] === 'files' && segments[1]) {
    const filename = sanitize(segments[1]);
    const filepath = path.join(FILES_DIR, filename);
    if (!fs.existsSync(filepath)) {
      res.writeHead(404, corsHeaders);
      return res.end(JSON.stringify({ error: 'Archivo no encontrado' }));
    }
    const mime = getMime(filename);
    const stat = fs.statSync(filepath);
    // PDFs e imágenes se muestran inline en el browser; el resto se descargan
    const disposition = (mime.startsWith('image/') || mime === 'application/pdf')
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;
    res.writeHead(200, {
      ...corsHeaders,
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
      res.writeHead(401, corsHeaders);
      return res.end(JSON.stringify({ error: 'No autorizado' }));
    }

    const filename = sanitize(decodeURIComponent(segments[1]));
    const filepath = path.join(FILES_DIR, filename);
    const writeStream = fs.createWriteStream(filepath);
    let size = 0;

    req.on('data', (chunk) => { size += chunk.length; writeStream.write(chunk); });
    req.on('end', () => {
      writeStream.end();
      const localIP = getLocalIP();
      const fileUrl = `http://${localIP}:${PORT}/files/${encodeURIComponent(filename)}`;
      console.log(`[FileServer] ✓ Guardado: ${filename} (${(size / 1024).toFixed(1)} KB)`);
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, filename, url: fileUrl, size }));
    });
    req.on('error', (err) => {
      console.error('[FileServer] Error al recibir archivo:', err);
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // 404 genérico
  res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

server.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   Servidor local de archivos — Integriclinica');
  console.log(`║   Escuchando en: http://${localIP}:${PORT}`);
  console.log(`║   Carpeta:       ${FILES_DIR}`);
  console.log(`║   API Key:       ${API_KEY}`);
  console.log('╠═══════════════════════════════════════════╣');
  console.log('║   Endpoints:');
  console.log(`║   GET  http://${localIP}:${PORT}/health`);
  console.log(`║   GET  http://${localIP}:${PORT}/files/:nombre`);
  console.log(`║   PUT  http://${localIP}:${PORT}/upload/:nombre`);
  console.log(`║   GET  http://${localIP}:${PORT}/list`);
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[FileServer] ✗ Puerto ${PORT} ocupado. Cambia PORT= o cierra el proceso que lo usa.`);
  } else {
    console.error('[FileServer] Error:', err);
  }
  process.exit(1);
});
