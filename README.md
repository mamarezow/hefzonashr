# حفظ و نشر آثار

Source of [hefzonashr.ir](https://hefzonashr.ir): a static site built with [Eleventy](https://www.11ty.dev/) and published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.

## Writing a post

One Markdown file per post in `src/posts/`. The file name becomes the address (`src/posts/zaman.md` → `/posts/zaman/`).

```yaml
---
title: زمان، تنها پول رایج
subtitle: optional second line under the title
date: 2024-11-24T16:10:53+03:30
telegram: 186          # Telegram message id; gives the short link hefzonashr.ir/p/186
form: prose            # prose (justified with kashida) or poem (lines kept exactly as written)
tags: [essay]          # keys from src/_data/site.js
---
```

Tag keys: `essay` جستار، `note` یادداشت، `poem` شعر، `poeticwords` ترانه، `critique` نقد، `intro` معرفی، `otherthings` دیگر. Each tag has a page at `/<key>/`; the buttons under the header point at جستار، یادداشت، ترانه، چیزهای دیگر (`/essay/`, `/note/`, `/poeticwords/`, `/otherthings/`) and the about page `/me/`.

The three posts in `src/posts/` are temporary samples from the Telegram channel, only there to show the layout.

## Local preview

```sh
npm install
npm start        # http://localhost:8080
```

## Notes

- Font: Sahel by Saber Rastikerdar (v3.4.0, SIL OFL, `src/fonts/`), Farsi-digit cut for text and the Latin-digit cut for short links.
- Dates are shown in the Persian calendar, computed at build time (Asia/Tehran).
- Kashida justification runs in the browser (`src/js/site.js`); the HTML stays clean, and copied text has no tatweels.
- Post pages use plain `<article>` markup with Open Graph and `article:*` tags, ready for a Telegram Instant View template.
