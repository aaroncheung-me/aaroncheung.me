# studies/

Academic/admissions portfolio at `aaroncheung.me/studies/`, alongside the
main portfolio, `art/`, and `sound/`. Where the main portfolio is framed for
recruiters, this one is framed for admissions readers: case studies with
the reasoning behind the work, plus an About page on the life outside it.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Page shell + the static home page (hero, "find me", "the work" grid) |
| `css/studies.css` | Studies-only styles: widget, case-study cards, case-study content blocks |
| `js/studies-boot.js` | Startup: loads partials and the nav tree, then starts the router |
| `js/studies-render.js` | Builds the left nav tree from `data/nav.json` + `data/case-studies/`; defines the Resume page and `NON_CASE_STUDY_IDS` |
| `js/studies-router.js` | `goToPage()`, breadcrumb, text scramble, and the page renderers (home/about/contact get their own, everything else uses `renderGenericPage`) |
| `js/studies-cards.js` | Case-study summary cards (home grid + top of each case study) and the home hero's case-study count |
| `js/studies-widgets.js` | Sidebar widget rotator: Case Study Nav and the Lofi Generator |
| `data/nav.json` | The order case studies appear in (a list of ids) |
| `data/case-studies/<id>.json` | One case study each: its folder, pages, and sub-folders |
| `data/about.json`, `data/contact.json` | About and Contact page content |
| `data/documents/` | Original PDFs linked from the case studies |
| `data/images/<project>/` | Figures (SVG) and screenshots (WebP), one folder per case study |
| `data/images/og-preview.jpg` | Link-preview image (1200x630) for shared links, same style as the main site's |

## Shared with the main site

Like `art/` and `sound/`, this site loads the repo's shared files by
root-absolute path: `/css/tui.css`, `/js/{theme,overlay-esc,lofi-player,
glitch-artifacts,include-partials,mobile-nav,home-tiles}.js`,
`/partials/{mobile-tabbar,mobile-header,footer}.html`, `/favicon.svg`,
`/fonts/`, and `/data/images/logo*.png`. So:

- It has to be served from the repo root (`localhost/studies/`), not as its
  own web root.
- Theme, palette, font, CRT, motion, and lofi on/off are shared with every
  other site through the same `localStorage` keys.
- The `/studies/` footer tab lives in `/js/theme.js`'s `SITE_TABS` and
  `/partials/footer.html`.
- The Resume page shows `/aaron_cheung_resume.pdf`, the same file as the
  main site.

**Cache busting:** `.htaccess` caches CSS/JS for 30 days. Whenever a CSS or
JS file changes, bump its `?v=` in `index.html`.

## Adding or editing a case study

Each case study is its own file, `data/case-studies/<id>.json`, holding one
folder node (`type: "folder"`, `id`, `name`, `children: [...]`). To add one,
create the file and add its id to `data/nav.json`, where the list order is
the nav order. Inside the folder:

- a page whose id ends in `-case-study`: this is the "primary" page. It gets
  the summary card (from its `summary` and `closingQuote` fields) and
  appears in the home page's "the work" grid
- optional supporting pages beside it (Process Notes, Research Index)
- optional sub-folders (Diagrams, Visual Reference), one page per figure

The home grid, the hero's "N case studies" count, and the Case Study Nav
widget all read this tree, so a new folder shows up everywhere with no code
changes. The widget's reading-progress steps through each project's direct
child pages only; sub-folder pages are skipped on purpose.

Page fields: `id`, `name` (nav label; HTML entities like `&amp;` are fine),
`title`, `date`, `technologies[]`, `summary`, `content[]`, `closingQuote`.
`content[]` entries are raw HTML. Use the patterns in `css/studies.css`:
`case-study-figure` (+ `-wide` for screenshots), `case-study-note`,
`case-study-worknote`, `case-study-pdf-link`, `case-study-table`.
Give every `<img>` its `width`/`height` (the image's real pixel size) so the
page doesn't jump while it loads, and save screenshots as WebP.

Folders start collapsed. To open one by default, add its id to
`DEFAULT_EXPANDED_FOLDERS` in `js/studies-render.js`.

## Live Lofi Generator demo

The Lofi Generator case study embeds the same full control panel as the
main site's Projects page. Any `content[]` entry containing the
`lofi-sketch-demo` markup gets mounted by `mountLofiDemo()` in
`js/studies-router.js`. The sidebar widget uses the main site's
`initTileLofi()` (`/js/home-tiles.js`). The panel, the widget, and the footer
`♪` toggle all stay in sync.

## Differences from the main portfolio

Same shell (nav tree, breadcrumb, content pane), but built as a smaller
clone rather than reusing `js/tui.js`/`js/render-lists.js`, which are wired
to skills/experience/explorer features this site doesn't have.

Not carried over: the Ctrl+K command palette and the typed-command File
Explorer (the breadcrumb is display-only), the animated ASCII logo (home
shows the static PNG), the home live-demo tiles, and the terminal-style
contact form. Nav rows are still keyboard-operable: Tab between them,
Enter/Space to open.
