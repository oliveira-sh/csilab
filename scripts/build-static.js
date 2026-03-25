'use strict';
/**
 * Pre-renders every Express route to static HTML in dist/.
 * Run after starting server.js (server must be up on PORT before calling this).
 *
 * Output layout mirrors the URL scheme:
 *   dist/index.html            ← meta-refresh redirect to /pt
 *   dist/pt/index.html
 *   dist/pt/equipe/index.html
 *   dist/pt/publicacoes/index.html
 *   dist/pt/contato/index.html
 *   dist/{en,es,it}/...        ← same pattern
 *   dist/css/, dist/js/, ...   ← copied from public/
 */

const http  = require('http');
const fs    = require('fs');
const fsp   = fs.promises;
const path  = require('path');

const PORT   = process.env.PORT || 3001;
const DIST   = path.join(__dirname, '..', 'dist');
const PUBLIC = path.join(__dirname, '..', 'public');

const PAGES = ['equipe', 'publicacoes', 'contato'];

// PT is the default language — served at the root path (no /pt prefix).
// Other languages get their own prefix (/en, /es, /it).
const ROUTES = [
  // Portuguese (root-level)
  ['/', 'index.html'],
  ...PAGES.map(p => [`/${p}`, `${p}/index.html`]),
  // Other languages
  ...['en', 'es', 'it'].flatMap(lang => [
    [`/${lang}`, `${lang}/index.html`],
    ...PAGES.map(p => [`/${lang}/${p}`, `${lang}/${p}/index.html`]),
  ]),
];

function fetchPage(route) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: PORT, path: route };
    http.get(opts, (res) => {
      // Follow one level of redirect (e.g. /  → /pt)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`${route} returned HTTP ${res.statusCode}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  for (const entry of await fsp.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else {
      await fsp.copyFile(s, d);
    }
  }
}

async function main() {
  // Clean dist/
  await fsp.rm(DIST, { recursive: true, force: true });
  await fsp.mkdir(DIST, { recursive: true });

  // Render each route
  for (const [route, outFile] of ROUTES) {
    const html    = await fetchPage(route);
    const outPath = path.join(DIST, outFile);
    await fsp.mkdir(path.dirname(outPath), { recursive: true });
    await fsp.writeFile(outPath, html);
    console.log(`  wrote  dist/${outFile}`);
  }

  // Copy public/ assets (css, js, images, fonts)
  await copyDir(PUBLIC, DIST);
  console.log('  copied public/ → dist/');

  console.log(`\nBuild complete — ${ROUTES.length} pages, assets copied.`);
}

main().catch(err => { console.error(err); process.exit(1); });
