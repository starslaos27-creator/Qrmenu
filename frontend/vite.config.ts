import { existsSync, readFileSync, statSync, createReadStream, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
const patchLegacyLanguageBundle = (source: string) => {
  const patchPath = require.resolve("./legacy-language-patch.cjs");
  delete require.cache[patchPath];
  return (require(patchPath) as (input: string) => string)(source);
};
const patchLegacyModuleImports = (source: string) => {
  const patchPath = require.resolve("./legacy-language-patch.cjs");
  delete require.cache[patchPath];
  const patcher = require(patchPath) as ((input: string) => string) & { patchLegacyModuleImports: (input: string) => string };
  return patcher.patchLegacyModuleImports(source);
};

const legacyRoot = resolve("dist");
const sidebarRoot = resolve("src/components/Sidebar");
const sidebarAssets = new Map([
  ["/assets/manager-navigation.js", resolve(sidebarRoot, "manager-navigation.js")],
  ["/assets/manager-navigation.css", resolve(sidebarRoot, "manager-navigation.css")],
]);
const mime: Record<string, string> = {
  ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff": "font/woff",
  ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};

function legacyUi(): Plugin {
  return {
    name: "shopqr-legacy-ui-compatibility",
    // The legacy app is shipped as static files from `dist`, while Vite's
    // module scanner resolves imports from the source root. Map legacy module
    // URLs back to their real files so query-versioned imports in the iframe
    // can be resolved during development as well as served by the middleware.
    resolveId(source, importer) {
      const pathname = source.split(/[?#]/, 1)[0];
      let file: string;
      if (pathname === "/weekly-hours.js" || pathname.startsWith("/assets/")) {
        file = resolve(legacyRoot, `.${pathname}`);
      } else if ((pathname.startsWith("./") || pathname.startsWith("../")) && importer) {
        const importerPath = importer.split(/[?#]/, 1)[0];
        const importerFile = importerPath === "/weekly-hours.js"
          ? resolve(legacyRoot, "weekly-hours.js")
          : importerPath.startsWith("/assets/")
            ? resolve(legacyRoot, `.${importerPath}`)
            : null;
        if (!importerFile) return null;
        file = resolve(importerFile, "..", pathname);
      } else {
        return null;
      }
      if (!file.startsWith(`${legacyRoot}${sep}`) || !existsSync(file) || !statSync(file).isFile()) return null;
      return file + source.slice(pathname.length);
    },
    configureServer(server) {
      const watchedShellFiles = [
        ...sidebarAssets.values(),
        resolve('legacy-app.html'),
        resolve('legacy-language-patch.cjs'),
        resolve('public/assets/sidebar-brand.js'),
      ];
      server.watcher.add(watchedShellFiles);
      server.watcher.on("change", changedFile => {
        if (watchedShellFiles.includes(resolve(changedFile))) server.ws.send({ type: "full-reload" });
      });
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url || "/", "http://localhost");
        const sidebarFile = sidebarAssets.get(url.pathname);
        if (sidebarFile) {
          if (!existsSync(sidebarFile) || !statSync(sidebarFile).isFile()) { response.statusCode = 404; response.end(); return; }
          response.setHeader("Content-Type", mime[extname(sidebarFile)] || "application/octet-stream");
          response.setHeader("Cache-Control", "no-store");
          const source = readFileSync(sidebarFile, "utf8");
          response.end(extname(sidebarFile) === ".js" ? patchLegacyModuleImports(source) : source);
          return;
        }
        if (url.pathname === "/weekly-hours.js") {
          const entry = resolve("dist/weekly-hours.js");
          if (!existsSync(entry)) { response.statusCode = 404; response.end(); return; }
          response.setHeader("Content-Type", "text/javascript; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          createReadStream(entry).pipe(response);
          return;
        }
        if (url.pathname === "/runtime-config.js") {
          const requestOrigin = `${request.headers["x-forwarded-proto"] || "http"}://${request.headers.host || "localhost:5173"}`;
          const requestHost = new URL(requestOrigin).hostname;
          const defaultPublicOrigin = ["localhost", "127.0.0.1", "::1"].includes(requestHost) ? "https://starsmenu.org" : requestOrigin;
          response.setHeader("Content-Type", "text/javascript; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(`window.SHOPQR_PUBLIC_URL = ${JSON.stringify(process.env.SHOPQR_PUBLIC_URL || defaultPublicOrigin)};`);
          return;
        }
        const assetPath = decodeURIComponent(url.pathname);
        if (/^\/(assets|images|fonts)\//.test(assetPath) || /^\/icon[^/]*\.svg$/.test(assetPath)) {
          const file = resolve(legacyRoot, `.${assetPath}`);
          if (!file.startsWith(`${legacyRoot}${sep}`) || !existsSync(file) || !statSync(file).isFile()) {
            response.statusCode = 404;
            response.end();
            return;
          }
          response.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream");
          response.setHeader("Cache-Control", "no-store");
          if (assetPath === "/assets/index-BjXGGWCT.js") {
            response.end(patchLegacyLanguageBundle(readFileSync(file, "utf8")));
          } else if (extname(file) === ".js") {
            response.end(patchLegacyModuleImports(readFileSync(file, "utf8")));
          } else {
            createReadStream(file).pipe(response);
          }
          return;
        }
        const isLegacyFrame = url.searchParams.has("__legacy") || request.headers["sec-fetch-dest"] === "iframe";
        if (isLegacyFrame) {
          const html = injectRouteBridge(readFileSync(resolve("legacy-app.html"), "utf8"), true);
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(html);
          return;
        }
        next();
      });
    },
    closeBundle() {
      copyFileSync(resolve(sidebarRoot, "manager-navigation.js"), resolve(legacyRoot, "assets/manager-navigation.js"));
      copyFileSync(resolve(sidebarRoot, "manager-navigation.css"), resolve(legacyRoot, "assets/manager-navigation.css"));
      const legacyBundle = resolve(legacyRoot, "assets/index-BjXGGWCT.js");
      if (!existsSync(legacyBundle)) throw new Error("Legacy dashboard bundle is missing from dist");
      writeFileSync(legacyBundle, patchLegacyLanguageBundle(readFileSync(legacyBundle, "utf8")));
      const legacyAssets = resolve(legacyRoot, "assets");
      for (const entry of readdirSync(legacyAssets, { withFileTypes: true })) {
        if (!entry.isFile() || extname(entry.name) !== ".js" || entry.name === "index-BjXGGWCT.js") continue;
        const asset = resolve(legacyAssets, entry.name);
        const source = readFileSync(asset, "utf8");
        if (!source.includes("index-BjXGGWCT.js")) continue;
        const patched = patchLegacyModuleImports(source);
        if (patched !== source) writeFileSync(asset, patched);
      }
      const output = resolve("dist/legacy-app.html");
      writeFileSync(output, injectRouteBridge(readFileSync(resolve("legacy-app.html"), "utf8")));
    },
  };
}

function injectRouteBridge(html: string, withViteClient = false): string {
  const viteClient = withViteClient ? `<script type="module" src="/@vite/client"></script>` : "";
  const bridge = `<script>(()=>{const u=new URL(location.href);const embedded=u.searchParams.get('__path');if(embedded&&embedded.startsWith('/')&&!embedded.startsWith('//')){const target=new URL(embedded,location.origin);if(target.origin===location.origin)history.replaceState(history.state,'',target.pathname+target.search+target.hash)}else{u.searchParams.delete('__legacy');history.replaceState(history.state,'',u.pathname+u.search+u.hash)}for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=function(...args){const result=original(...args);parent.postMessage({type:'shopqr-route',method,path:location.pathname+location.search+location.hash},location.origin);return result}}window.addEventListener('message',event=>{if(event.origin!==location.origin||event.data?.type!=='shopqr-sync-route'||typeof event.data.path!=='string')return;const target=new URL(event.data.path,location.origin);if(target.origin!==location.origin||!target.pathname.startsWith('/'))return;const next=target.pathname+target.search+target.hash;const current=location.pathname+location.search+location.hash;if(current===next)return;history.replaceState(history.state,'',next);window.dispatchEvent(new PopStateEvent('popstate'))})})();</script>`;
  return html.replace("</head>", `${viteClient}${bridge}</head>`);
}

export default defineConfig({
  plugins: [react(), legacyUi()],
  // `legacy-app.html` is served as a static iframe shell by `legacyUi()`.
  // Scanning it as a Vite dependency entry makes Vite try to pre-transform
  // prebuilt `/assets/*` and `/weekly-hours.js` files from `dist` as source.
  optimizeDeps: { entries: ["index.html"], force: true },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: { "/api": process.env.BACKEND_URL || "http://127.0.0.1:4000" },
  },
  build: { outDir: "dist", emptyOutDir: false, rollupOptions: {
    input: { main: resolve("index.html"), weeklyHours: resolve("src/pages/settings/weekly-hours-entry.tsx") },
    output: { entryFileNames: chunk => chunk.name === "weeklyHours" ? "weekly-hours.js" : "assets/[name]-[hash].js" },
  } },
});
