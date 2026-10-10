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

Tag keys: `essay` جستار، `note` یادداشت، `poem` شعر، `song` ترانه، `critique` نقد، `intro` معرفی، `otherthings` دیگر. Each tag has a page at `/<key>/`. The buttons under the header point at جستار (`/essay/`), یادداشت (`/note/`), شاعرانه (`/poeticwords/`, poems and songs together), چیزهای دیگر (`/otherthings/`) and the about page `/me/`.

Dates are shown as month and year only.

## Admin panel

[admin.hefzonashr.ir](https://admin.hefzonashr.ir) runs [Sveltia CMS](https://github.com/sveltia/sveltia-cms) from `admin/`, hosted on Cloudflare Pages (root directory `admin`, no build command, output directory `public`). Each save in the panel is a commit to `main`, which rebuilds the site.

- `admin/public/config.yml`: the panel's fields. Two lists over the same `src/posts/` folder: شعر و ترانه (`form: poem`, plain text box so lines stay exactly as typed) and جستار و یادداشت (`form: prose`, Markdown editor). Keep the tag options in step with `src/_data/site.js`. A third list, صفحه‌ها, edits the about page `src/me.md` (/me/). Posts for چیزهای دیگر are ordinary posts tagged `otherthings`.
- `admin/functions/`: «ورود با گیت‌هاب». `/auth` sends the browser to GitHub and `/callback` hands the token back to the panel. They read `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from the Cloudflare Pages settings; the GitHub OAuth app's callback URL is `https://admin.hefzonashr.ir/callback`.
- New posts get a file name like `poem-20261010` unless a Latin name is typed in the panel's Slug side panel when creating it.

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
