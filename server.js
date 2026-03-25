'use strict';
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const nunjucks = require('nunjucks');
const yaml     = require('js-yaml');

const app  = express();
const PORT = process.env.PORT || 3001;

const LANGS    = ['pt', 'en', 'es', 'it'];
const LANG_HTML = { pt: 'pt-BR', en: 'en', es: 'es', it: 'it' };
const CONTENT_DIR = path.join(__dirname, 'content');

/* ── Nunjucks ─────────────────────────────────────────────── */
nunjucks.configure(path.join(__dirname, 'views'), {
  autoescape: true,
  express: app,
  noCache: process.env.NODE_ENV !== 'production',
});
app.set('view engine', 'njk');

/* ── Content loader ───────────────────────────────────────── */
function parseFrontmatter(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw   = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  return yaml.load(match[1]) || {};
}

function loadYamlDir(dir, data) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (/\.ya?ml$/.test(f)) {
      const key = f.replace(/\.ya?ml$/, '');
      try {
        data[key] = yaml.load(fs.readFileSync(path.join(dir, f), 'utf8'));
      } catch (e) {
        console.error(`[content] Error loading ${dir}/${f}:`, e.message);
      }
    }
  }
}

function loadContent(lang, page) {
  const langDir = path.join(CONTENT_DIR, lang);

  // Page frontmatter
  const pageData = parseFrontmatter(path.join(langDir, `${page}.md`));

  // Load shared data first, then lang-specific overrides
  const data = {};
  loadYamlDir(path.join(CONTENT_DIR, '_shared', 'data'), data);
  loadYamlDir(path.join(langDir, 'data'), data);

  return { page: pageData, data };
}

function langUrls(page) {
  const urls = {};
  for (const l of LANGS) {
    urls[l] = page === 'index' ? `/${l}` : `/${l}/${page}`;
  }
  return urls;
}

function ctx(lang, page, extra = {}) {
  const { page: p, data } = loadContent(lang, page);
  return {
    lang,
    lang_html: LANG_HTML[lang],
    currentPage: page,
    base_url:  `/${lang}`,
    lang_urls: langUrls(page),
    page: p,
    data,
    ...extra,
  };
}

/* ── Redirects for legacy .html URLs ─────────────────────── */
app.get('/index.html',      (req, res) => res.redirect(301, '/pt'));
app.get('/equipe.html',      (req, res) => res.redirect(301, '/pt/equipe'));
app.get('/publicacoes.html', (req, res) => res.redirect(301, '/pt/publicacoes'));
app.get('/contato.html',     (req, res) => res.redirect(301, '/pt/contato'));

/* ── Root ────────────────────────────────────────────────── */
app.get('/', (req, res) => res.redirect('/pt'));

/* ── Language routes ──────────────────────────────────────── */
for (const lang of LANGS) {
  app.get(`/${lang}`,              (req, res) => res.render('index.njk',       ctx(lang, 'index')));
  app.get(`/${lang}/equipe`,       (req, res) => res.render('equipe.njk',      ctx(lang, 'equipe')));
  app.get(`/${lang}/publicacoes`,  (req, res) => res.render('publicacoes.njk', ctx(lang, 'publicacoes')));
  app.get(`/${lang}/contato`,      (req, res) => res.render('contato.njk',     ctx(lang, 'contato')));
}

/* ── Static assets (after routes) ────────────────────────── */
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, '0.0.0.0', () =>
  console.log(`CSI Lab running at http://localhost:${PORT}`));
