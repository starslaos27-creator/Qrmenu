const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const patchLegacyLanguageBundle = require('./legacy-language-patch.cjs');

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2' };
const app = 'frontend';
const port = Number(process.env.PORT || 5173);
const lanAddresses = Object.values(os.networkInterfaces()).flat().filter(item => item && item.family === 'IPv4' && !item.internal).map(item => item.address);
const privateAddress = lanAddresses.find(ip => /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip));
const publicOrigin = (process.env.SHOPQR_PUBLIC_URL || `http://${privateAddress || lanAddresses[0] || 'localhost'}:${port}`).replace(/\/+$/, '');
const compressedFiles = new Map();
{
  const root = path.resolve(__dirname, 'dist');
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/runtime-config.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(`window.SHOPQR_PUBLIC_URL = ${JSON.stringify(publicOrigin)};`);
      }
      if (url.pathname.startsWith('/api/')) {
        const backendUrl = new URL(process.env.BACKEND_URL || 'http://127.0.0.1:4000');
        const upstream = http.request(new URL(`${url.pathname}${url.search}`, backendUrl), {
          method: req.method,
          headers: { ...req.headers, host: backendUrl.host },
        }, backendRes => {
          res.writeHead(backendRes.statusCode || 502, backendRes.headers);
          backendRes.pipe(res);
        });
        upstream.on('error', () => {
          if (res.headersSent) return res.destroy();
          res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Local backend is unavailable.' }));
        });
        req.pipe(upstream);
        return;
      }
      const legacyFrame = url.searchParams.has('__legacy') || req.headers['sec-fetch-dest'] === 'iframe';
      let file = legacyFrame
        ? path.join(root, 'legacy-app.html')
        : path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403); return res.end();
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        if (path.extname(file)) { res.writeHead(404); return res.end(); }
        file = path.join(root, 'index.html');
      }
      let body = fs.readFileSync(file);
      if (url.pathname === '/assets/index-BjXGGWCT.js') {
        body = Buffer.from(patchLegacyLanguageBundle(body.toString('utf8')));
      }
      const ext = path.extname(file);
      const contentType = types[ext] || 'application/octet-stream';
      const fileName = path.basename(file);
      const hashMatch = fileName.match(/[.-]([A-Za-z0-9_-]{8})\.(?:js|css|svg|png|jpg|webp|woff2?)$/);
      const isMutableNavigationAsset = /^manager-navigation\.(?:js|css)$/i.test(fileName);
      const isHashedAsset = !isMutableNavigationAsset && Boolean(hashMatch && /[A-Z0-9]/.test(hashMatch[1]));
      const headers = {
        'Content-Type': contentType,
        'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-store',
      };
      let responseBody = body;
      const acceptsGzip = /(?:^|,)\s*gzip\s*(?:,|$)/i.test(req.headers['accept-encoding'] || '');
      const compressible = /^(text\/|application\/(?:javascript|json|xml))/.test(contentType);
      if (acceptsGzip && compressible && body.length >= 512) {
        const stat = fs.statSync(file);
        const cacheKey = `${file}:${stat.mtimeMs}:${stat.size}`;
        responseBody = compressedFiles.get(cacheKey);
        if (!responseBody) {
          responseBody = zlib.gzipSync(body, { level: zlib.constants.Z_BEST_SPEED });
          compressedFiles.set(cacheKey, responseBody);
          if (compressedFiles.size > 64) compressedFiles.delete(compressedFiles.keys().next().value);
        }
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
      }
      headers['Content-Length'] = responseBody.length;
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : responseBody);
    } catch {
      res.writeHead(400); res.end('Bad request');
    }
  });
  server.on('error', error => { console.error(`${app}: ${error.message}`); process.exit(1); });
      server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`${app}: http://localhost:${port}; customer links: ${publicOrigin}`));
}
