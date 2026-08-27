# studies/ -- scaffold notes

Academic/admissions portfolio, meant to live at `aaroncheung.me/studies/`
alongside the main portfolio, `art/`, and `sound/`. This is a **scaffold**:
the mechanics (nav, routing, theming, widget bar) are real and working, but
most of the *content* is a bracketed placeholder for you to replace.

## What's a placeholder vs. real

Search for `[` in these files -- everything bracketed is a stand-in:

- `index.html` -- home hero tagline/meta line
- `data/about.json` -- second block ("[Why This Field]") is fully blank;
  the first block ("Outside the Classroom") is your real music/art/
  woodworking bio, lightly trimmed of SWE-portfolio-specific references
- `data/contact.json` -- one bracketed phrase in the first line
- `data/nav.json` -- the one example Case Studies page is entirely a
  template (title, technologies, summary, content, closing quote all
  bracketed)
- `data/citations.json`, `data/currently-exploring.json` -- fully placeholder

## Architecture (what's kept vs. dropped from the main site)

Same shell as the main portfolio -- a real folder-tree nav on the left,
breadcrumb above it, content pane on the right -- built from scratch as a
smaller, purpose-built clone rather than reusing `js/tui.js`/`render-lists.js`
directly (those are ~1000 lines wired to skills/experience/explorer/live-demo
features this site doesn't have).

**Kept:**
- Theme system: dark/light, 4 palettes, 3 fonts, CRT overlay + glitch
  flashes, reduced motion -- via `js/theme.js` (a local copy, see below),
  same `localStorage` keys as the main portfolio and `sound/` (so switching
  persists across all three when deployed together on the real domain)
- Footer cross-site tabs (Portfolio/Art/Sound/Studies) -- the shared
  `partials/footer.html` and `js/theme.js`'s `SITE_TABS` were both edited in
  the main repo to add the `/studies/` entry before being copied in here
- Mobile hamburger/tabbar nav (`js/mobile-nav.js`, generic chrome, needed no
  changes)
- The text-scramble reveal on page load, ambient CRT glitch flashes
- Static ASCII-style logo image (`data/images/logo_home.png`) on the home
  page

**Dropped:**
- Command palette (Ctrl+K), keyboard nav, and the typed-command File
  Explorer -- the breadcrumb box is a plain, non-clickable display now
- The animated ASCII-scramble logo effect (`js/ascii-logo.js`) -- home page
  just shows the static PNG
- Home page live-demo tiles (Lofi/Jumpy/Heatmap) and the "my other sites"
  tile grid -- home is just an intro now
- The terminal-style contact form (`js/contact_form.js`) -- Contact is plain
  text/links
- Skills package-info renderer, Experience timeline, everything specific to
  those sections -- there's one generic page renderer now
  (`renderGenericPage` in `js/studies-router.js`)

## Adding case studies later

Edit `data/nav.json`. Either pattern works with zero code changes:
- Add another page under the existing `"case-studies"` folder
- Or add a whole new folder (its own sub-pages) or a bare top-level page
  object to the top-level `data` array, no folder at all

The sidebar's **Case Study Nav** widget (`js/studies-widgets.js`) auto-
discovers every page in the tree except `home`/`about`/`contact`, in
document order -- it doesn't key off the `case-studies` id specifically, so
either pattern above shows up in the reading-progress indicator
automatically.

## This folder is fully self-contained

Every path `index.html` references is relative to `studies/` itself --
nothing points outside this folder. That's on purpose: copy the whole
`studies/` folder anywhere (a separate project, a new VS Code window, a
zip) and it renders and behaves identically, with no server config and no
sibling folders required. Verified by serving `studies/` alone as its own
web root (not the repo root) and exercising nav/routing/widgets/theme
toggles end to end.

What that means concretely -- `studies/` carries **its own frozen copies**
of everything the main site normally shares from the repo root:

- `css/tui.css` (copy of `/css/tui.css`)
- `js/theme.js`, `overlay-esc.js`, `lofi-player.js`, `glitch-artifacts.js`,
  `include-partials.js`, `mobile-nav.js` (copies of the same-named files
  under `/js/`)
- `partials/mobile-tabbar.html`, `mobile-header.html`, `footer.html`
  (copies of `/partials/`)
- `favicon.svg`, all 8 font `.woff2` files, `data/images/logo.png` and
  `logo_home.png` (copies)

Everything already under `studies/` proper (`css/studies.css`,
`js/studies-*.js`, `data/*.json`) was already self-contained.

**The tradeoff, same one the art/sound standalone-export workflow always
had:** these are frozen snapshots, not live links. If the main site's
`css/tui.css` or `js/theme.js` etc. change later, `studies/`'s copies won't
pick that up automatically -- you'd need to manually re-copy and diff
before overwriting, in case `studies/`'s copy has since diverged
(it currently hasn't). Two small things in the frozen copies only work
right when this site is actually deployed alongside the rest at
`aaroncheung.me`: the footer's site-tab buttons (`siteNavigate('/art/')`
etc.) navigate to root-absolute paths that won't exist on a standalone dev
server, and the footer's `[resume]` link points at `/aaron_cheung_resume.pdf`
which isn't copied here. Neither affects this site's own layout or
functionality -- they're just dead links until it's deployed for real.
