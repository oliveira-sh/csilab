#!/usr/bin/env node
/**
 * Fetch publications from OpenAlex for CSI Lab faculty and update
 * content/_shared/data/publications.yaml
 *
 * Usage:
 *   node scripts/fetch-publications.js           ← skip if data < 12 h old
 *   node scripts/fetch-publications.js --force   ← always fetch
 *
 * HOW IT WORKS
 * ─────────────
 * Fully data-driven from content/_shared/data/team.yaml.
 * No member list is maintained here.
 *
 * Resolution per faculty member:
 *   orcid       → OpenAlex ORCID filter  (anchor ✓, guaranteed unique)
 *   openalex_id → used directly           (anchor ✓, pre-verified)
 *   neither     → member is skipped entirely (no name guessing)
 *
 * Institution guard (UFOP):
 *   A paper is only kept when the matching anchor author's affiliation
 *   in *that specific paper* includes "Ouro Preto".
 *   This eliminates false positives from authors who share a name with
 *   a faculty member or who published from a different institution.
 *
 * TO ADD A NEW MEMBER
 * ────────────────────
 * Add `orcid: "0000-0002-xxxx-xxxx"` to their entry in team.yaml.
 * No changes here required.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const OPENALEX_BASE = 'https://api.openalex.org';
const USER_AGENT    = 'csilab-site/1.0 (mailto:gladston@ufop.edu.br)';
const TEAM_FILE     = path.join(__dirname, '../content/_shared/data/team.yaml');
const OUT_FILE      = path.join(__dirname, '../content/_shared/data/publications.yaml');
const PER_PAGE      = 50;
const MAX_PAGES     = 20;
const STALE_HOURS   = 12;

const FACULTY_GROUPS = ['coordinators', 'professors', 'collaborators'];

// ── Staleness check ───────────────────────────────────────────────────────────

function dataIsFresh() {
  if (!fs.existsSync(OUT_FILE)) return false;
  const ageHours = (Date.now() - fs.statSync(OUT_FILE).mtimeMs) / 3_600_000;
  return ageHours < STALE_HOURS;
}

// ── OpenAlex helpers ──────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAlex HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function resolveByOrcid(orcid) {
  const { results } = await fetchJson(
    `${OPENALEX_BASE}/authors?filter=orcid:${encodeURIComponent(orcid)}&per-page=1`
  );
  return results[0]?.id?.replace('https://openalex.org/', '') ?? null;
}

// Fields we actually need — keeps response payloads smaller.
const SELECT_FIELDS = [
  'id', 'doi', 'title', 'authorships', 'publication_year',
  'primary_location', 'cited_by_count', 'counts_by_year',
].join(',');

async function fetchWorksForAuthors(ids) {
  const base =
    `${OPENALEX_BASE}/works` +
    `?filter=author.id:${ids.join('|')}` +
    `&select=${SELECT_FIELDS}` +
    `&sort=publication_year:desc` +
    `&per-page=${PER_PAGE}`;
  const first = await fetchJson(`${base}&page=1`);
  const pages = Math.min(Math.ceil(first.meta.count / PER_PAGE), MAX_PAGES);
  console.log(`  OpenAlex: ${first.meta.count} total works, fetching first ${pages * PER_PAGE}`);
  const works = [...first.results];
  for (let p = 2; p <= pages; p++) {
    const { results } = await fetchJson(`${base}&page=${p}`);
    works.push(...results);
  }
  return works;
}

// ── Institution guards ────────────────────────────────────────────────────────

// Returns true when the authorship lists "Ouro Preto" (UFOP) as an affiliation.
function hasUFOPAffiliation(authorship) {
  return (authorship.institutions || []).some(inst =>
    /ouro preto/i.test(inst.display_name || '')
  );
}

// Returns true when ANY institution in the authorship is Brazilian (country_code BR).
function hasBrazilianAffiliation(authorship) {
  return (authorship.institutions || []).some(inst => inst.country_code === 'BR');
}

// ── Country aggregation ───────────────────────────────────────────────────────
// Counts the number of papers that have at least one author from each country.

function aggregateCountries(works) {
  const counts = {};
  for (const w of works) {
    const seen = new Set();
    for (const a of w.authorships) {
      for (const inst of (a.institutions || [])) {
        const cc = inst.country_code;
        if (cc && !seen.has(cc)) {
          seen.add(cc);
          counts[cc] = (counts[cc] || 0) + 1;
        }
      }
    }
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([, a], [, b]) => b - a)
  );
}

// ── Citations by year ─────────────────────────────────────────────────────────
// For each year Y, counts how many times CSI Lab papers were cited by papers
// published in Y — NOT the total citations of papers published in Y.
// Uses the `counts_by_year` field returned by OpenAlex per work.

function aggregateCitationsByYear(works) {
  const byYear = {};
  for (const w of works) {
    for (const { year, cited_by_count } of (w.counts_by_year || [])) {
      byYear[year] = (byYear[year] || 0) + cited_by_count;
    }
  }
  return Object.fromEntries(
    Object.entries(byYear)
      .map(([k, v]) => [Number(k), v])
      .sort(([a], [b]) => a - b)
  );
}

// ── Entry builder ─────────────────────────────────────────────────────────────

function workToEntry(w) {
  const entry = {
    authors: w.authorships.map(a => a.author.display_name).join(', '),
    title:   w.title,
    journal: w.primary_location?.source?.display_name || 'Unknown venue',
  };

  // OpenAlex work ID — used by the cited-by dropdown to fetch citing papers
  const oid = w.id?.replace('https://openalex.org/', '');
  if (oid) entry.oa_id = oid;

  if (w.doi) entry.url = `https://doi.org/${w.doi.replace(/^https?:\/\/doi\.org\//i, '')}`;
  if (w.cited_by_count > 0) entry.cited_by_count = w.cited_by_count;

  // Distinct country codes of all author institutions — used by the map filter
  const countries = new Set();
  for (const a of w.authorships) {
    for (const inst of (a.institutions || [])) {
      if (inst.country_code) countries.add(inst.country_code);
    }
  }
  if (countries.size) entry.author_countries = [...countries].sort();

  const v = entry.journal;
  if      (/springer/i.test(v))                                         entry.badge = 'Springer';
  else if (/ieee/i.test(v))                                             entry.badge = 'IEEE';
  else if (/elsevier/i.test(v))                                         entry.badge = 'Elsevier';
  else if (/wiley/i.test(v))                                            entry.badge = 'Wiley';
  else if (/SBC|SBBD|SIBGRAPI|BRACIS|STIL|ENIAC|SBCAS|GEOINFO/i.test(v)) entry.badge = 'SBC';
  return { year: w.publication_year, entry };
}

// ── Group by year ─────────────────────────────────────────────────────────────

function groupByYear(entries) {
  const byYear = {};
  for (const { year, entry } of entries) {
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(entry);
  }
  return byYear;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const force = process.argv.includes('--force');

  if (!force && dataIsFresh()) {
    const ageMin = Math.round((Date.now() - fs.statSync(OUT_FILE).mtimeMs) / 60_000);
    console.log(`Publications data is ${ageMin}m old (< ${STALE_HOURS}h). Skipping fetch.`);
    console.log('Pass --force to override.\n');
    return;
  }

  // 1. Load members from team.yaml
  const teamData = yaml.load(fs.readFileSync(TEAM_FILE, 'utf8'));
  const members  = FACULTY_GROUPS.flatMap(g => teamData[g]?.members || []).filter(m => m.name);
  console.log(`Loaded ${members.length} faculty members from team.yaml\n`);

  // 2. Resolve OpenAlex IDs
  console.log('Resolving OpenAlex author IDs...\n');
  const resolved = [];
  for (const m of members) {
    let id = null, anchor = false, note = '';
    if (m.orcid) {
      id = await resolveByOrcid(m.orcid);
      anchor = !!id;
      note = id ? `ORCID ${m.orcid} → anchor ✓` : `ORCID ${m.orcid} → not found`;
    } else if (m.openalex_id) {
      id     = m.openalex_id.replace('https://openalex.org/', '');
      anchor = true;
      note   = `openalex_id → anchor ✓`;
    } else {
      console.log(`  ${m.name.padEnd(34)} ${'(skipped)'.padEnd(16)} no orcid or openalex_id in team.yaml`);
      continue;
    }
    console.log(`  ${m.name.padEnd(34)} ${(id || '(not found)').padEnd(16)} ${note}`);
    if (id) resolved.push({ name: m.name, resolvedId: id, anchor });
  }

  const allIds    = resolved.map(r => r.resolvedId);
  const anchorIds = new Set(resolved.map(r => r.resolvedId));
  console.log(`\n  ${allIds.length} resolved, ${anchorIds.size} anchors\n`);

  if (!anchorIds.size) throw new Error('No anchor authors — aborting.');

  // 3. Fetch works
  console.log('Fetching works...');
  const works = await fetchWorksForAuthors(allIds);
  console.log(`  Received ${works.length} works`);

  // 4. Filter — three conditions must hold:
  //
  //    a) publication year >= 2015
  //    b) at least one anchor author is listed as UFOP-affiliated in this paper
  //    c) co-author plausibility:
  //       • if 2+ CSI Lab members appear → accept (strong team signal)
  //       • if sole-authored → accept
  //       • if only 1 CSI Lab member → at least one non-anchor author must be
  //         affiliated with a Brazilian institution.
  //         Rationale: OpenAlex sometimes merges different people who share a
  //         name (e.g. two "Rodrigo Silva"s). The merging can preserve a UFOP
  //         affiliation tag while the paper itself is from a different researcher
  //         whose co-authors are all outside Brazil.  Requiring a Brazilian
  //         co-author closes this gap without over-filtering legitimate
  //         interdisciplinary papers (which are co-authored by Brazilian
  //         university colleagues).

  const anchorFull = new Set([...anchorIds].map(id => `https://openalex.org/${id}`));

  const filtered = works.filter(w => {
    if (w.publication_year < 2015) return false;

    const allAnchors  = w.authorships.filter(a => anchorFull.has(a.author.id));
    const ufopAnchors = allAnchors.filter(a => hasUFOPAffiliation(a));

    // (b) must have at least one UFOP-affiliated anchor
    if (ufopAnchors.length === 0) return false;

    // (c) multiple CSI Lab members → strong signal, accept
    if (allAnchors.length >= 2) return true;

    // (c) sole-authored → accept
    if (w.authorships.length === 1) return true;

    // (c) single anchor: require at least one non-anchor Brazilian co-author
    return w.authorships.some(a =>
      !anchorFull.has(a.author.id) && hasBrazilianAffiliation(a)
    );
  });
  console.log(`  After year + UFOP + co-author plausibility filter: ${filtered.length} works`);

  // 5. Aggregate data for visualisations
  const country_counts    = aggregateCountries(filtered);
  const citations_by_year = aggregateCitationsByYear(filtered);

  const topCountries = Object.entries(country_counts).slice(0, 5).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`  Country contributions: ${Object.keys(country_counts).length} countries (top: ${topCountries})`);
  console.log(`  Citations timeline: ${Object.keys(citations_by_year).length} years`);

  // 6. Write (fresh data only — no merge with existing)
  const byYear = groupByYear(filtered.map(workToEntry));
  const years  = Object.keys(byYear)
    .map(Number).sort((a, b) => b - a)
    .map(year => ({ year, items: byYear[year] }));

  const output = yaml.dump({ country_counts, citations_by_year, years }, { lineWidth: 140, quotingType: '"' });
  fs.writeFileSync(OUT_FILE, output, 'utf8');
  console.log(`\nDone — written to ${OUT_FILE}`);
  console.log('Review the file, then commit.');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
