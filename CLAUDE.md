# CSI Lab Static Site — Agent Notes

## Project overview
Content-driven Node.js site (Express on port 3001) replicating the CSI Lab (csilab.ufop.br).
Trilingual: **PT** (default), **EN**, **ES**, **IT** — URL scheme `/{lang}[/page]`.

### Key files
- `server.js` — Express routes, Nunjucks config, content loader
- `views/*.njk` — Nunjucks templates (`base.njk`, `index.njk`, `equipe.njk`, `publicacoes.njk`, `contato.njk`, `_macros.njk`)
- `content/{lang}/*.md` — per-page frontmatter (title, hero text, form labels…)
- `content/{lang}/data/*.yaml` — structured data (nav, team, awards, news, FAQ…)
- `content/_shared/data/publications.yaml` — single shared publications file (English, all languages)
- `public/css/main.css` — design tokens + layout
- `public/css/dropdown.css` — nav dropdowns, accordions, news, team cards, lang switcher
- `public/js/main.js` — accordion factory, counter animation, AOS init, scroll-zoom observer

## Start dev server
```
cd /home/olvr/Desktop/zyvolab-static
npm run dev          # nodemon (port 3001)
# or
node server.js
```

## Pending: Download external images from csilab.ufop.br

The server at `csilab.ufop.br` (IP 200.239.129.47) **blocks server-side TCP connections** from this machine
(curl/wget time out). Images ARE served to browsers normally.

### Images needed and their destination paths

| External URL | Save to (relative to `public/`) | Used in |
|---|---|---|
| `https://csilab.ufop.br/sites/default/files/csilab2/files/logo_csi_lab_-_invertida_com_texto_0.png` | `images/logo-csilab.png` | nav + footer (currently using text fallback) |
| `https://csilab.ufop.br/sites/default/files/styles/os_files_xxlarge/public/csilab2/files/logo-ufop.png` | `images/logo-ufop.png` | footer (currently using text fallback) |
| `https://csilab.ufop.br/profiles/openscholar/themes/hwpi_basetheme/images/ufop-logo.png` | `images/ufop-logo.png` | favicon (currently using `images/favicon.svg`) |
| `https://csilab.ufop.br/sites/default/files/styles/os_slideshow_16%3A9_660/public/csilab2/files/foto.png` | `images/foto-equipe.png` | hero card (currently `about-image-1.jpg`), and was used in FAQ |
| `https://csilab.ufop.br/sites/default/files/styles/os_slideshow_16%3A9_660/public/csilab2/files/csilab_marca_4.png` | `images/csilab-marca.png` | about-images grid (currently `about-image-2.jpg`) |
| `https://csilab.ufop.br/sites/default/files/styles/os_slideshow_16%3A9_660/public/csilab2/files/screenshot_2023-12-14_at_22.47.00.png` | `images/evento-2023.png` | about-images grid (currently `about-image-3.jpg`) |
| `https://csilab.ufop.br/sites/default/files/styles/os_slideshow_16%3A9_660/public/csilab2/files/whatsapp_image_2024-04-06_at_21.32.36.jpeg` | `images/evento-2024.jpg` | about-images grid (currently `about-image-4.jpg`) |

### How to download (if/when network access is available)
```bash
cd /home/olvr/Desktop/zyvolab-static/public/images

curl -L -o logo-csilab.png \
  "https://csilab.ufop.br/sites/default/files/csilab2/files/logo_csi_lab_-_invertida_com_texto_0.png"

curl -L -o logo-ufop.png \
  "https://csilab.ufop.br/sites/default/files/styles/os_files_xxlarge/public/csilab2/files/logo-ufop.png"

curl -L -o foto-equipe.png \
  "https://csilab.ufop.br/sites/default/files/styles/os_slideshow_16%3A9_660/public/csilab2/files/foto.png"

curl -L -o csilab-marca.png \
  "https://csilab.ufop.br/sites/default/files/styles/os_slideshow_16%3A9_660/public/csilab2/files/csilab_marca_4.png"

curl -L -o evento-2023.png \
  "https://csilab.ufop.br/sites/default/files/styles/os_slideshow_16%3A9_660/public/csilab2/files/screenshot_2023-12-14_at_22.47.00.png"

curl -L -o evento-2024.jpg \
  "https://csilab.ufop.br/sites/default/files/styles/os_slideshow_16%3A9_660/public/csilab2/files/whatsapp_image_2024-04-06_at_21.32.36.jpeg"
```

### After downloading, update these template references in `views/base.njk` and `views/index.njk`:

**Nav logo** (`views/base.njk`) — already uses `<img src="/images/logo-csilab.png">` with text fallback via `onerror`.

**Footer logo** (`views/base.njk`) — already uses `<img src="/images/logo-csilab.png">` with text fallback.

**Footer UFOP logo** (`views/base.njk`) — already uses `<img src="/images/logo-ufop.png">` with `onerror` hide.

**Hero card / About images** (`views/index.njk`) — update `src` attributes for `about-image-1/2/3/4.jpg` to use the downloaded filenames.

## Auto-fetching publications (future option)

Publications live in `content/_shared/data/publications.yaml` and are maintained manually.
When the list needs updating, the two best no-key free APIs are:

### Option A — OpenAlex

OpenAlex (`https://api.openalex.org`) is a fully open academic knowledge graph, no API key required.

**Find works by institution:**
```
GET https://api.openalex.org/works?filter=institutions.ror:https://ror.org/036rp1748&sort=publication_year:desc&per-page=50
```
UFOP's ROR ID is `036rp1748`. Each result contains `title`, `authorships[].author.display_name`, `primary_location.source.display_name` (venue), `doi`, and `publication_year`.

**Find works by author name (fuzzy):**
```
GET https://api.openalex.org/authors?search=Gladston+Moreira&filter=affiliations.institution.ror:https://ror.org/036rp1748
```
Then fetch their works:
```
GET https://api.openalex.org/works?filter=author.id:<openalex_author_id>&sort=publication_year:desc
```

**Example Node.js fetch:**
```js
const res = await fetch(
  'https://api.openalex.org/works?filter=institutions.ror:https://ror.org/036rp1748' +
  '&sort=publication_year:desc&per-page=50',
  { headers: { 'User-Agent': 'csilab-site/1.0 (mailto:gladston@ufop.edu.br)' } }
);
const { results } = await res.json();
```
OpenAlex asks for a `User-Agent` with a contact email (polite pool = faster rate limits).

---

### Option B — CrossRef

CrossRef (`https://api.crossref.org`) indexes DOI-registered works. Useful when DOIs are known.

**Search by author affiliation:**
```
GET https://api.crossref.org/works?query.affiliation=UFOP&query.author=Gladston+Moreira&rows=20&sort=published&order=desc
```

**Fetch a single work by DOI:**
```
GET https://api.crossref.org/works/10.1007/s10651-025-00649-7
```
Returns structured `author[]`, `title[]`, `container-title[]` (journal), `published.date-parts`, `URL`.

**Limitations:** CrossRef only covers DOI-registered content — conference papers without DOIs (SBC proceedings, some IEEE) may be missing.

---

### Recommendation

Use **OpenAlex** as primary source (better coverage of Brazilian venues like SBC) and **CrossRef** to enrich missing DOIs. A maintenance script would fetch both, merge by title, and output the YAML structure used by `publications.yaml`.

The fetch should be run manually as a one-off update step, not on every server request.

## Design tokens (CSS custom properties)
```css
--color-primary: #0B0C10   /* page background */
--color-surface: #1F2833   /* cards, nav, sections */
--color-accent:  #E94F37   /* coral red — CTAs, highlights */
--color-steel:   #566573   /* muted blue-grey */
--color-muted:   #8892B0   /* secondary text */
--color-text:    #E2E8F0   /* primary text */
--font-primary:  "Funnel Sans"
--font-secondary:"Inter"
```

## Architecture notes
- Hero background: `public/images/banner.jpg` (set in main.css `.hero-section`)
- Counter section (`#numeros`) background: `public/images/banner.jpg`
- Accordions: generic `initAccordion()` factory in main.js
  - Consultorias uses `class="consult-accordion"` container
  - FAQ uses `id="faq"` container
  - Both are now side-by-side in `#consultorias` section (no images)
- AOS: CDN `unpkg.com/aos@2.3.4` — `once:true, duration:800, offset:60`
  - No CSS animation fallback (was causing blink); JS fallback at 3s instead
- Fonts: self-hosted woff2 in `public/fonts/` (Funnel Sans + Inter)
