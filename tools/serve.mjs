// Static server with HTTP Range support.
// Safari refuses to play <video> unless the server answers Range with 206.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';

const ROOT = process.argv[2] || process.cwd();
const PORT = Number(process.argv[3] || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const path = join(ROOT, normalize(rel));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  let st;
  try {
    st = statSync(path);
  } catch {
    res.writeHead(404).end('not found');
    return;
  }

  const type = TYPES[extname(path).toLowerCase()] || 'application/octet-stream';
  const base = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let start = m[1] === '' ? null : Number(m[1]);
      let end = m[2] === '' ? null : Number(m[2]);
      if (start === null) {
        // suffix range: last N bytes
        start = Math.max(0, st.size - (end ?? 0));
        end = st.size - 1;
      } else if (end === null || end >= st.size) {
        end = st.size - 1;
      }
      if (start > end || start >= st.size) {
        res.writeHead(416, { ...base, 'Content-Range': `bytes */${st.size}` }).end();
        return;
      }
      res.writeHead(206, {
        ...base,
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Content-Length': end - start + 1,
      });
      createReadStream(path, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(200, { ...base, 'Content-Length': st.size });
  createReadStream(path).pipe(res);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`serving ${ROOT} on http://0.0.0.0:${PORT}`);
});
