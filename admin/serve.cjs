const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const app = 'admin';
const port = Number(process.env.PORT || 5174);
const backendUrl = new URL(process.env.BACKEND_URL || 'http://127.0.0.1:4000');
if (backendUrl.protocol !== 'http:') {
  throw new Error('BACKEND_URL must use http:// for the local backend.');
}
{
  const root = path.resolve(__dirname, 'dist');
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const upstream = http.request({
          hostname: backendUrl.hostname,
          port: backendUrl.port || 80,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: backendUrl.host }
        }, backendRes => {
          res.writeHead(backendRes.statusCode || 502, backendRes.headers);
          backendRes.pipe(res);
        });
        upstream.on('error', error => {
          console.error(`${app}: backend request failed: ${error.message}`);
          if (!res.headersSent) {
            res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'BACKEND_UNAVAILABLE' }));
          } else {
            res.destroy(error);
          }
        });
        req.on('aborted', () => upstream.destroy());
        req.pipe(upstream);
        return;
      }
      let pathname = decodeURIComponent(url.pathname);
      let file = path.resolve(root, '.' + pathname);
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403); return res.end();
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        if (path.extname(file)) { res.writeHead(404); return res.end(); }
        file = path.join(root, 'index.html');
      }
      let body = fs.readFileSync(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(400); res.end('Bad request');
    }
  });
  server.on('error', error => { console.error(`${app}: ${error.message}`); process.exit(1); });
  server.listen(port, '127.0.0.1', () => console.log(`${app}: http://localhost:${port}`));
}
