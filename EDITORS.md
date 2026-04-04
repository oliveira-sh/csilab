# How to Edit This Site

A practical guide for non-technical editors. No coding experience required.

---

## Where things live

```
content/
  _shared/data/
    team.yaml          ← ALL team members (edit here to add/remove/update people)
    team_tags.yaml     ← tag vocabulary translated into 4 languages
    publications.yaml  ← publication list (edit manually or use the fetch script)

  pt/data/             ← Portuguese-specific labels (section headings, role names)
  en/data/             ← English-specific labels
  es/data/             ← Spanish-specific labels
  it/data/             ← Italian-specific labels

  pt/ en/ es/ it/      ← Page titles, descriptions, and UI text (*.md files)
```

**The golden rule:** team member data lives in exactly **one file** — `content/_shared/data/team.yaml`. You never need to touch the per-language directories to add a person.

---

## How to add a new team member

Open `content/_shared/data/team.yaml` and add an entry to the correct section.

### Faculty / Coordinators / Collaborators

```yaml
- name: "Firstname Lastname"          # name without Prof./Profa. prefix
  gender: f                            # omit this line for male members
  role_key: associate_professor        # see role keys below
  tags: [machine_learning, nlp]        # see tag list below
  links:
    - text: "✉ email@ufop.edu.br"
      href: "mailto:email@ufop.edu.br"
    - key: profile
      href: "https://csilab.ufop.br/people/firstname-lastname"
    - text: "Lattes →"
      href: "http://lattes.cnpq.br/YOUR_ID"
```

**Available role keys:**

| Key | PT | EN |
|---|---|---|
| `coordinator` | Coordenador | Coordinator |
| `coordinator_f` | Coordenadora | Coordinator |
| `associate_professor` | Professor Associado | Associate Professor |
| `associate_professor_f` | Professora Associada | Associate Professor |
| `collaborating_researcher` | Pesquisador Colaborador | Collaborating Researcher |
| `collaborating_researcher_f` | Pesquisadora Colaboradora | Collaborating Researcher |

### PhD / Master's / Undergrad students

```yaml
- name: "Firstname Lastname"
  year: 2024                           # year they started
  links:
    - text: "Lattes →"
      href: "http://lattes.cnpq.br/YOUR_ID"
```

### Alumni

```yaml
alumni_grad:
  members:
    - "Existing Name"
    - "New Graduate Name"   # just add a line
```

---

## How to add or edit research tags

Tags replace the old free-text `areas` field. Each tag is an ID that maps to a translation in all four languages.

**To use an existing tag**, add its ID to the member's `tags` list in `team.yaml`.

**To create a new tag**, open `content/_shared/data/team_tags.yaml` and add:

```yaml
your_new_tag_id:
  pt: "Tradução em Português"
  en: "English Translation"
  es: "Traducción al Español"
  it: "Traduzione in Italiano"
```

Then use `your_new_tag_id` in any member's `tags` list.

**Available tags** (excerpt — see `team_tags.yaml` for the full list):

`artificial_intelligence` · `machine_learning` · `deep_learning` · `nlp` · `computer_vision` · `biometrics` · `pattern_recognition` · `data_science` · `multiobjective_optimization` · `spatial_analysis` · `databases` · `statistical_methods` · `social_network_analysis` · `evolutionary_algorithms` · `computational_intelligence` · `time_series` · `text_classification` · `applied_ml` · ...

---

## How to update page text (titles, descriptions, UI strings)

Each page has a `.md` file per language with its heading text. For example, to change the team page subtitle in English:

1. Open `content/en/equipe.md`
2. Edit the frontmatter fields (between the `---` lines)
3. Save

The file looks like:
```markdown
---
title: "Team — CSI Lab · UFOP"
page_label: "People"
page_title: "CSI Lab Team"
page_sub: "Professors, collaborators, graduate and undergraduate students..."
join_text: "Interested in joining CSI Lab?"
join_btn: "Get in Touch"
---
```

Section headings on the team page (like "Faculty", "PhD Students") live in `content/en/data/team_i18n.yaml`.

---

## How to update publications

### Option A — Edit the YAML manually

Open `content/_shared/data/publications.yaml` and add a new entry under the correct year:

```yaml
- year: 2026
  items:
    - authors: "Author A, Author B, Author C"
      title: "Title of the Paper"
      journal: "Conference or Journal Name"
      venue_suffix: "pp. 1–10. Publisher"
      url: "https://doi.org/..."
      badge: "Springer"
```

**Badge values:** `Springer`, `IEEE`, `SBC`, `Elsevier`, `Wiley`, or any short label.

### Option B — Fetch from OpenAlex automatically

Run the following command in your terminal from the project folder:

```bash
npm run fetch:pubs
```

This queries OpenAlex (a free academic database) for UFOP publications, merges the results with your existing file, and writes the updated YAML. After running:

1. **Review** `content/_shared/data/publications.yaml` — the API doesn't always find every paper (especially Brazilian conference papers without DOIs).
2. **Add missing entries** manually.
3. **Commit** the updated file.

---

## How to change section labels in a specific language

If a section heading needs to change only in one language (e.g., fix the Spanish wording for "PhD Students"):

1. Open `content/es/data/team_i18n.yaml`
2. Find the `phd_students` block under `groups:`
3. Edit the `title:` value
4. Save

Changes here affect only the Spanish version of the page.

---

## Quick reference — files to edit per task

| Task | File |
|---|---|
| Add / remove a team member | `content/_shared/data/team.yaml` |
| Add / rename a research tag | `content/_shared/data/team_tags.yaml` |
| Add / remove a publication | `content/_shared/data/publications.yaml` |
| Change page titles or descriptions | `content/{lang}/*.md` |
| Change section headings or role names | `content/{lang}/data/team_i18n.yaml` |
| Change nav links or footer text | `content/{lang}/data/nav.yaml`, `footer.yaml` |
| Update news or awards | `content/{lang}/data/news.yaml`, `awards.yaml` |

---

## Running the site locally

```bash
npm run dev    # starts development server at http://localhost:3001
```

You do not need to restart the server after editing YAML or Markdown files — just refresh the browser.
