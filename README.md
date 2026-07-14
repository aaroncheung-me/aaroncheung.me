# aaroncheung.me

Source for [aaroncheung.me](https://aaroncheung.me), a software engineering
portfolio with live, interactive demos instead of screenshots and
descriptions: a game AI you can play, a real cursor heatmap, a real
database with real queries.

Plain HTML, CSS, and JavaScript. Zero frameworks, zero libraries, zero
build step. Every behavior on the site was built by hand, which means every
behavior is something I understand.

Three sites live in this one repo, sharing one design system (theme,
palette, CRT effect, fonts, footer chrome) through a small partials system:

- **`/`** is the main portfolio (the site this README is about)
- **`/art/`** is a separate digital art portfolio, presented as a screen
  quietly falling apart. Standalone mirror at
  [`art_portfolio`](https://github.com/aaroncheung-me/art_portfolio).
- **`/sound/`** is "From the Top", a personal essay about learning music,
  built like a print magazine. Standalone mirror at
  [`music_site`](https://github.com/aaroncheung-me/music_site).

## How it's built

Every word of content lives in JSON files under `data/` and gets rendered
onto the page by hand-rolled scripts (`js/render-lists.js`, `js/tui.js`).
Updating the site means editing data, not markup. Pages share layout
through a tiny partials system (`partials/`, loaded by
`js/include-partials.js`) instead of pulling in a framework for it.

Theming goes deeper than a dark-mode toggle: color palettes, font
switching, a CRT effect, and reduced-motion support all persist in
`localStorage`. Even the default font is self-hosted, so a fresh load never
phones home to a font CDN.

The individual live demos (the bitboard game AI, the cursor heatmap, the
ASCII art converter, the deployed database) each have their own standalone
repos, linked from each project's write-up on the site and cross-linked
below.

## Structure

```
index.html, css/, js/, data/, fonts/, partials/   -- main portfolio
art/                                              -- digital art site
sound/                                            -- music essay site
php/                                              -- backend for the live database demo
python/                                           -- Twitter/X art-posting bot (see its own repo)
```

## Running it locally

Serve the repo root with any static file server (`npx serve .`) and most of
the site works immediately. The database demo (`php/`) additionally needs:

1. A MySQL database, seeded from the schema in
   [`relational_database`](https://github.com/aaroncheung-me/relational_database).
2. `php/config.example.php` copied to `php/config.php` with real
   credentials filled in (gitignored, never commit real values), then
   served through any PHP-capable server.

## Related repos

- [jumpy](https://github.com/aaroncheung-me/jumpy): 2-player board game
  with a bitboard AI opponent
- [cursor_heatmap](https://github.com/aaroncheung-me/cursor_heatmap): live
  in-browser cursor heatmap
- [relational_database](https://github.com/aaroncheung-me/relational_database):
  schema and queries behind the live database demo
- [ascii_art_converter](https://github.com/aaroncheung-me/ascii_art_converter):
  image-to-ASCII converter
- [twitter_art_bot](https://github.com/aaroncheung-me/twitter_art_bot):
  Selenium bot that posted my art daily
- [art_portfolio](https://github.com/aaroncheung-me/art_portfolio):
  standalone mirror of `/art/`
- [music_site](https://github.com/aaroncheung-me/music_site): standalone
  mirror of `/sound/`