#!/usr/bin/env node
/**
 * Validate OpenAlex-fetched publications against the curated legacy list.
 *
 * USAGE
 * ──────
 * 1. Save the curated (legacy) YAML to a temp file from git:
 *
 *      git show HEAD:content/_shared/data/publications.yaml > /tmp/legacy-pubs.yaml
 *
 * 2. Run the fetch script to produce a new candidate file:
 *
 *      npm run fetch:pubs
 *
 * 3. Run this validator:
 *
 *      node scripts/validate-publications.js \
 *        /tmp/legacy-pubs.yaml \
 *        content/_shared/data/publications.yaml
 *
 * OUTPUT
 * ──────
 * - MATCHED  : legacy paper was found in the new file ✓
 * - MISSING  : legacy paper is absent from the new file — add it manually
 * - NEW      : paper exists in new file only (from API, not in legacy)
 *
 * The script exits with code 1 if any legacy paper is missing, so it can
 * be used as a CI gate.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTitle(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function loadPubs(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }
  const parsed = yaml.load(fs.readFileSync(abs, 'utf8')) || {};
  const all = [];
  for (const block of (parsed.years || [])) {
    for (const item of (block.items || [])) {
      all.push({ year: block.year, ...item });
    }
  }
  return all;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const [,, legacyPath, newPath] = process.argv;

if (!legacyPath || !newPath) {
  console.error('Usage: node scripts/validate-publications.js <legacy.yaml> <new.yaml>');
  process.exit(1);
}

const legacy = loadPubs(legacyPath);
const newPubs = loadPubs(newPath);

const newTitles = new Set(newPubs.map(p => normalizeTitle(p.title)));

const matched  = [];
const missing  = [];

for (const p of legacy) {
  const norm = normalizeTitle(p.title);
  if (newTitles.has(norm)) {
    matched.push(p);
  } else {
    missing.push(p);
  }
}

// Papers in new but not in legacy
const legacyTitles = new Set(legacy.map(p => normalizeTitle(p.title)));
const added = newPubs.filter(p => !legacyTitles.has(normalizeTitle(p.title)));

// ── Report ────────────────────────────────────────────────────────────────────

const W = 72;
const line = '─'.repeat(W);
console.log(`\n${'═'.repeat(W)}`);
console.log('  Publication Validation Report');
console.log(`${'═'.repeat(W)}`);
console.log(`  Legacy file : ${legacyPath}`);
console.log(`  New file    : ${newPath}`);
console.log(`  Legacy total: ${legacy.length} papers`);
console.log(`  New total   : ${newPubs.length} papers`);
console.log(line);

if (matched.length) {
  console.log(`\n  ✓ MATCHED (${matched.length}/${legacy.length} legacy papers found in new file)`);
  for (const p of matched) {
    console.log(`    [${p.year}] ${p.title.slice(0, 65)}`);
  }
}

if (missing.length) {
  console.log(`\n  ✗ MISSING — ${missing.length} legacy paper(s) NOT found in new file`);
  console.log('    Add these manually to publications.yaml:');
  for (const p of missing) {
    console.log(`\n    # [${p.year}] — needs manual re-entry`);
    console.log(`    - authors: "${p.authors}"`);
    console.log(`      title: "${p.title}"`);
    console.log(`      journal: "${p.journal}"`);
    if (p.url)          console.log(`      url: "${p.url}"`);
    if (p.badge)        console.log(`      badge: "${p.badge}"`);
    if (p.venue_suffix) console.log(`      venue_suffix: "${p.venue_suffix}"`);
  }
}

if (added.length) {
  console.log(`\n  + NEW API papers not in legacy (${added.length}) — review before committing:`);
  for (const p of added) {
    console.log(`    [${p.year}] ${p.title.slice(0, 65)}`);
  }
}

console.log(`\n${'═'.repeat(W)}`);
console.log(`  Result: ${matched.length} matched, ${missing.length} missing, ${added.length} new`);
console.log(`${'═'.repeat(W)}\n`);

if (missing.length > 0) {
  console.error(`FAIL: ${missing.length} curated paper(s) missing from new file. Review above.`);
  process.exit(1);
} else {
  console.log('PASS: all curated papers are present in the new file.');
}
