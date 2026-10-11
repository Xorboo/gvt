# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Hugo static site for GVT (Games and Visuals Trójmiasto) gamedev meetups, using the PaperMod theme as a git submodule (`themes/PaperMod`). Production is https://gvt.xorb.ooo/ — Coolify auto-builds the `Dockerfile` (hugo build + nginx) on push to `master`.

## Commands

- `hugo server` — local dev server (site has `buildFuture: true`, so future-dated talks render)
- `hugo --minify` — production build to `public/` (`public/` is build output; don't hand-edit it)
- `npx prettier --write <file>` — format; `.prettierrc` uses `prettier-plugin-go-template` so Hugo templates in `layouts/` format correctly
- After fresh clone: `git submodule update --init` (theme won't build without it)

There are no tests.

## Hugo version management

The pinned Hugo version lives in exactly one place: the `FROM hugomods/hugo:X.Y.Z` line in the Dockerfile — to bump Hugo, change only that line. `config.yaml` sets `module.hugoVersion.min` as a compatibility floor (bump it only when the theme requires a newer Hugo). Local installs are managed via winget (`winget upgrade Hugo.Hugo.Extended`).

## Content model

- **Talks** live in `content/talks/YYYY-MM-DD-speaker.md`, one file per talk, with a matching cover image in `assets/images/talks/YYYY-MM-DD-speaker.{png,jpg,webp}`. Adding a talk = new md file + image. Front matter fields: `event` (e.g. `GVT #25` — free-form, events may have other names), `title` (talk name only), `date`, `speaker`, `speakerInfo` (markdown), `description`, `cover.image`, and optionally `youtube` (recording link). Display titles are recomposed as `event: title` by `layouts/_partials/full-title.html` — templates must use that partial instead of `.Title` wherever the full title should show.
- Custom front matter is rendered via the theme's extension points where possible: `layouts/_partials/extend_post_content.html` (theme hook, survives theme updates) embeds the `youtube` URL as an iframe (falls back to the cover image when there's no video) and shows `speaker`/`speakerInfo`; the footer credit and cover-hiding are plain config (`params.footer.text`, `params.cover.hiddenInSingle`).
- **Image policy**: `assets/images/talks/` holds full-size originals (any of png/jpg/webp — it doubles as the archive; never compress or delete them). The build serves only resized WebP variants and never publishes the originals. This is done by template forks marked with `GVT fork` comments: `layouts/_partials/cover.html` (webp srcset, no original in output) and `layouts/_partials/templates/{opengraph,twitter_cards,schema_json}.html` (social previews use `cover-social-url.html` → 1200px jpg). When updating the PaperMod submodule, re-diff these forks plus `layouts/list.html` (youtube icon on entries), `layouts/index.json` (search index with description/speaker/event), `layouts/_partials/header.html` (inline search widget, JS in `assets/js/header-search.js`), and the full-title forks (`layouts/single.html`, `layouts/archives.html`, `layouts/rss.xml`, `layouts/_partials/{head,post_nav_links}.html` — each swaps `.Title`/`.Name` for the `full-title.html` partial) against the theme versions and re-apply the marked changes.
- **Redirect pages** (e.g. `content/discord/`, `content/gizmo/`): front matter `type: redirect` + `target: <url>`, rendered by `layouts/redirect/single.html` as a meta-refresh page. Use this pattern for new short links like `/discord`.
- Known prettier gotcha: `prettier-plugin-go-template` errors with "unexpected end keyword" on comments like `{{/* end main */}}` — write them as `{{- /* end main */ -}}`.
- Site config, social links, and homepage text are all in `config.yaml`.

## Announcement generator

`/generator/` is a hidden page (`content/generator/index.md`, not in menus, lists, search, RSS or sitemap) that makes the meetup and speaker poster PNGs in the browser. The page markup is `layouts/generator/single.html`; the rest is plain static files in `static/generator/`:

- `templates/{horizontal,vertical}.svg` hold the whole poster design, shared by both poster types. To change the design, edit these SVGs. The `data-*` attributes (text fields, rows, text fitting, right anchoring for wider formats) are described in the comment at the top of `horizontal.svg`.
- `js/poster.js` holds the format list (sizes, which template), fills the templates from the form, shows them as previews and draws them on a canvas for PNG export. Fonts and images go inline as data URLs at export time, because an SVG drawn as an image cannot load files.
