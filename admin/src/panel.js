// The panel at admin.hefzonashr.ir is the site itself: its pages are passed through from
// hefzonashr.ir with public/panel.js and panel.css added, which let a signed-in account edit a
// post in place or write a new one. Saving goes through /panel/api/post, a commit to main like the
// Telegram bot's (bot.js), so the site rebuilds. Sign-in is the username/password of accounts.js.
// The old Sveltia panel stays at /cms/.
import { sessionUser } from "./accounts.js";
import { Bot, parse, render, paragraphs, getFile, putFile, tehranNow, sectionOf, TAGS } from "./bot.js";

const SITE = "https://hefzonashr.ir";
const FILE = /^[a-z0-9-]+$/;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clean = v => String(v || "").replace(/\r\n?/g, "\n");
const oneLine = v => clean(v).replace(/\s+/g, " ").trim();

// a page of the site, with the panel added
export async function page({ request }) {
  const url = new URL(request.url);
  const r = await fetch(SITE + url.pathname + url.search, { cf: { cacheTtl: 0 }, redirect: "manual" });
  const headers = new Headers(r.headers);
  headers.set("X-Robots-Tag", "noindex");
  headers.set("Cache-Control", "no-store");
  const to = headers.get("Location");
  if (to) headers.set("Location", to.replace(SITE, url.origin));
  if (!(headers.get("Content-Type") || "").includes("text/html")) return new Response(r.body, { status: r.status, headers });
  headers.delete("Content-Length");
  return new HTMLRewriter()
    .on("head", { element: e => e.append('<link rel="stylesheet" href="/panel.css"><script src="/panel.js" defer></script>', { html: true }) })
    .transform(new Response(r.body, { status: r.status, headers }));
}

// GET ?file=<name>: a post's parts; POST: save a post (with `file`) or publish a new one
export async function api({ request, env }) {
  const token = (request.headers.get("Authorization") || "").replace(/^bearer\s+/i, "");
  const user = await sessionUser(env, token);
  if (!user) return json({ error: "دوباره وارد شو." }, 401);
  try {
    if (request.method === "GET") {
      const file = new URL(request.url).searchParams.get("file") || "";
      const f = FILE.test(file) && await getFile(env, `src/posts/${file}.md`);
      if (!f) return json({ error: "این پست پیدا نشد." }, 404);
      const p = parse(f.text);
      return json({ file, sha: f.sha, title: p.title || "", subtitle: p.subtitle || "", body: p.body, tags: p.tags, form: p.form });
    }
    if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
    const d = await request.json().catch(() => ({}));
    const title = oneLine(d.title), subtitle = oneLine(d.subtitle), body = clean(d.body).replace(/\s+$/, "");
    const tags = [...new Set((Array.isArray(d.tags) ? d.tags : []).filter(t => TAGS[t]))];
    if (!title) return json({ error: "عنوان خالی است." }, 400);
    if (!body.trim()) return json({ error: "متن خالی است." }, 400);
    if (!tags.length) return json({ error: "دست‌کم یک برچسب لازم است." }, 400);
    const by = ` (from the panel, ${user.name})`;

    if (d.file) {
      if (!FILE.test(d.file)) return json({ error: "این پست پیدا نشد." }, 404);
      const path = `src/posts/${d.file}.md`, f = await getFile(env, path);
      if (!f) return json({ error: "این پست پیدا نشد." }, 404);
      if (f.sha !== d.sha) return json({ error: "این پست در این فاصله جای دیگری عوض شده؛ صفحه را تازه کن و دوباره ویرایش کن." }, 409);
      const p = parse(f.text);
      Object.assign(p, { title, subtitle, body, tags });
      const sha = await putFile(env, path, render(p), `Edit post: ${title}${by}`, f.sha);
      return json({ sha, url: `${SITE}/${sectionOf(tags).key}/${p.address || d.file}/` });
    }

    // a new post: like the bot's «پست جدید»
    const bot = new Bot(env, user.chat);
    let slug = String(d.address || "").trim().toLowerCase();
    if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return json({ error: "نشانی فقط حروف کوچک انگلیسی، عدد و خط تیره باشد." }, 400);
    if (slug && await bot.taken(slug)) return json({ error: "این نشانی را پست دیگری دارد." }, 409);
    if (!slug) slug = await bot.freeSlug();
    const form = tags.includes("poem") || tags.includes("song") ? "poem" : "prose";
    const p = { title, subtitle, date: tehranNow(), telegram: await bot.nextShort(), form, tags, rest: [],
      body: form === "poem" ? body : paragraphs(body) };
    await putFile(env, `src/posts/${slug}.md`, render(p), `New post: ${title}${by}`);
    await env.BOT.put("short", String(p.telegram));
    return json({ url: `${SITE}/${sectionOf(tags).key}/${slug}/`, short: `${SITE.replace("https://", "")}/p/${p.telegram}` });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
