// The Telegram bot that writes posts: "new post" asks for a title, a section, tags and the text,
// then commits src/posts/<address>.md to main (which rebuilds the site); "edit post" takes a
// post's address and changes one part of it at a time; "delete post" removes one after asking.
// Only TELEGRAM_CHAT_ID can use it.
// Needs, besides the TELEGRAM_* settings of contact.js:
//   GITHUB_TOKEN  a fine-grained GitHub token with Contents: read and write on the repository (as a secret)
//   BOT           the KV namespace (wrangler.jsonc) that remembers where each conversation is
// Opening https://admin.hefzonashr.ir/telegram/setup once points Telegram at /telegram.
const REPO = "mamarezow/hefzonashr", BRANCH = "main", SITE = "https://hefzonashr.ir";
const SECTIONS = [
  { key: "essay", label: "جستار", form: "prose", tags: ["essay"] },
  { key: "note", label: "یادداشت", form: "prose", tags: ["note"] },
  { key: "poeticwords", label: "شاعرانه", form: "poem", tags: ["poem", "song"] },
  { key: "otherthings", label: "چیزهای دیگر", form: "prose", tags: ["otherthings"] }
];
// the same tags as src/_data/site.js
const TAGS = { essay: "جستار", note: "یادداشت", poem: "شعر", song: "ترانه", critique: "نقد", intro: "معرفی", otherthings: "دیگر" };
const NEW = "new post", EDIT = "edit post", DELETE = "delete post", DONE = "تمام", CANCEL = "لغو";
const MENU = { keyboard: [[{ text: NEW }, { text: EDIT }], [{ text: DELETE }]], resize_keyboard: true, is_persistent: true };
const WRITING = { keyboard: [[{ text: DONE }, { text: CANCEL }]], resize_keyboard: true, is_persistent: true };
const ASKING = { keyboard: [[{ text: CANCEL }]], resize_keyboard: true, is_persistent: true };
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function setup({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return new Response("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set", { status: 500 });
  if (!env.GITHUB_TOKEN) return new Response("GITHUB_TOKEN is not set", { status: 500 });
  if (!env.BOT) return new Response("the BOT KV namespace is not bound", { status: 500 });
  const r = await tg(env, "setWebhook", {
    url: new URL("/telegram", request.url).href,
    secret_token: await secret(env),
    allowed_updates: ["message", "callback_query"],
    max_connections: 1,                      // one update at a time, so a long text split in parts stays in order
    drop_pending_updates: true
  });
  if (!r.ok) return new Response("Telegram: " + r.description, { status: 502 });
  return new Response("ok; now send /start to the bot", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST" || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== await secret(env)) return new Response("Not Found", { status: 404 });
  const update = await request.json().catch(() => ({}));
  const chat = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
  if (String(chat) !== String(env.TELEGRAM_CHAT_ID)) return new Response("ok");   // not Mamareza: stay silent
  const bot = new Bot(env, chat);
  try {
    if (update.callback_query) await bot.press(update.callback_query);
    else if (update.message) await bot.message(update.message);
  } catch (e) {
    await bot.say("خطا: " + (e.message || e), MENU);
    await bot.forget();
  }
  return new Response("ok");                  // always 200, or Telegram sends the same update again
}

class Bot {
  constructor(env, chat) { this.env = env; this.chat = chat; this.key = "chat:" + chat; }
  say(text, reply_markup) { return tg(this.env, "sendMessage", { chat_id: this.chat, text, reply_markup, link_preview_options: { is_disabled: true } }); }
  async load() { return JSON.parse(await this.env.BOT.get(this.key) || "null"); }
  save(s) { return this.env.BOT.put(this.key, JSON.stringify(s), { expirationTtl: 86400 }); }
  forget() { return this.env.BOT.delete(this.key); }

  async message(m) {
    const text = m.text ?? m.caption ?? "";
    if (text === "/start" || text === CANCEL || text === "/cancel") { await this.forget(); return this.say("چه کار کنیم؟", MENU); }
    if (text === NEW) {
      await this.save({ mode: "new", step: "title", post: { tags: [] }, since: m.message_id });
      return this.say("عنوان نوشته چیست؟", ASKING);
    }
    if (text === EDIT || text === DELETE) {
      await this.save({ mode: text === EDIT ? "edit" : "delete", step: "url", since: m.message_id });
      return this.say("نشانی نوشته را بفرست.", ASKING);
    }
    const s = await this.load();
    if (!s) return this.say("یکی از دکمه‌ها را بزن.", MENU);
    if (!m.text && s.step !== "body") return this.say("فقط متن می‌شود فرستاد.");
    const p = s.post;

    switch (s.step) {
      case "title":
        p.title = oneLine(text);
        if (s.mode === "edit") return this.store(s, "عنوان");
        s.step = "section"; await this.save(s);
        return this.say("در کدام دسته؟", sectionKeys());
      case "subtitle":
        p.subtitle = oneLine(text);
        return this.store(s, "زیرعنوان");
      case "body":
        if (text === DONE) {
          if (!s.parts.length) return this.say("هنوز متنی نفرستادی.");
          p.body = s.parts.join("\n\n"); delete s.parts;
          if (s.mode === "edit") return this.store(s, "متن");
          s.slug = await this.freeSlug(); s.step = "review"; await this.save(s);
          await this.say("متن رسید.", MENU);
          return this.review(s);
        }
        if (!m.text) return this.say("فقط متن می‌شود فرستاد؛ عکس و فایل نه.");
        s.parts.push(p.form === "poem" ? m.text.replace(/\s+$/, "") : paragraphs(markdown(m.text, m.entities, await linkNames(m.text, m.entities))));
        await this.save(s);
        return tg(this.env, "setMessageReaction", { chat_id: this.chat, message_id: m.message_id, reaction: [{ type: "emoji", emoji: "👍" }] });
      case "slug": {
        const slug = text.trim().toLowerCase();
        if (!SLUG.test(slug)) return this.say("فقط حروف کوچک انگلیسی، عدد و خط تیره؛ مثلا silent-drivers");
        if (await this.taken(slug)) return this.say("این نشانی مال نوشتهٔ دیگری است؛ یکی دیگر بفرست.");
        s.slug = slug; s.step = "review"; await this.save(s);
        return this.review(s);
      }
      case "address": {
        const name = text.trim().toLowerCase();
        if (!SLUG.test(name)) return this.say("فقط حروف کوچک انگلیسی، عدد و خط تیره؛ مثلا silent-drivers");
        if (name !== s.slug && await this.taken(name, s.slug)) return this.say("این نشانی مال نوشتهٔ دیگری است؛ یکی دیگر بفرست.");
        if (name === s.slug) delete p.address; else p.address = name;
        return this.store(s, "نشانی");
      }
      case "url": {
        const found = await this.find(text);
        if (!found) return this.say("نوشته‌ای با این نشانی پیدا نکردم. نشانی کامل را بفرست، مثلا hefzonashr.ir/poeticwords/baqer");
        Object.assign(s, found, { step: "menu" }); await this.save(s);
        await this.say("پیدا شد.", MENU);
        return s.mode === "delete" ? this.confirmDelete(s) : this.menu(s);
      }
      default:
        return this.say("از دکمه‌های پیام بالا یکی را بزن، یا «لغو».");
    }
  }

  async press(q) {
    const [what, arg] = q.data.split(":"), at = { chat_id: this.chat, message_id: q.message.message_id };
    const answer = text => tg(this.env, "answerCallbackQuery", { callback_query_id: q.id, text });
    const s = await this.load();
    const p = s?.post;
    const close = () => tg(this.env, "editMessageReplyMarkup", { ...at, reply_markup: { inline_keyboard: [] } });
    if (!s || q.message.message_id < (s.since || 0)) { await answer("این دکمه دیگر کار نمی‌کند."); return close(); }

    if (what === "section" && s.step === "section") {
      const sec = SECTIONS.find(x => x.key === arg);
      p.form = sec.form;
      p.tags = s.mode === "edit"
        ? [...new Set([...p.tags.filter(t => !SECTIONS.some(x => x.tags.includes(t))), sec.tags[0]])]
        : [sec.tags[0]];
      await answer(); await tg(this.env, "editMessageText", { ...at, text: "دسته: " + sec.label });
      if (s.mode === "edit") return this.store(s, "دسته");
      s.step = "tags"; await this.save(s);
      return this.say("برچسب‌ها؟ هر چند تا که بخواهی را بزن، بعد «ادامه».", tagKeys(p.tags));
    }
    if (what === "tag" && s.step === "tags") {
      p.tags = p.tags.includes(arg) ? p.tags.filter(t => t !== arg) : [...p.tags, arg];
      await this.save(s); await answer();
      return tg(this.env, "editMessageReplyMarkup", { ...at, reply_markup: tagKeys(p.tags) });
    }
    if (what === "tags" && s.step === "tags") {
      if (!p.tags.length) return answer("دست‌کم یک برچسب لازم است.");
      await answer(); await tg(this.env, "editMessageText", { ...at, text: "برچسب‌ها: " + tagNames(p.tags) });
      if (s.mode === "edit") return this.store(s, "برچسب‌ها");
      s.step = "body"; s.parts = []; await this.save(s);
      return this.say(p.form === "poem"
        ? "حالا متن را بفرست؛ سطرها همان‌طور که می‌فرستی روی سایت می‌آیند. اگر چند پیام شد، همه را بفرست و آخر «تمام» را بزن."
        : "حالا متن را بفرست. پررنگ، کج و لینک‌های تلگرام روی سایت هم می‌آیند. اگر چند پیام شد، همه را بفرست و آخر «تمام» را بزن.", WRITING);
    }
    if (what === "publish" && s.step === "review") {
      await answer(); await close();
      const path = `src/posts/${s.slug}.md`;
      if (await this.taken(s.slug)) { s.step = "slug"; await this.save(s); return this.say("این نشانی همین حالا گرفته شد؛ نشانی دیگری بفرست.", ASKING); }
      p.date = tehranNow();
      p.telegram = await this.nextShort();
      await putFile(this.env, path, render(p), `New post: ${p.title} (from Telegram)`);
      await this.env.BOT.put("short", String(p.telegram));
      await this.forget();
      return this.say(`منتشر شد. تا یکی دو دقیقهٔ دیگر اینجاست:\n${postUrl(s)}\nلینک کوتاه: ${SITE.replace("https://", "")}/p/${p.telegram}`, MENU);
    }
    if (what === "slug" && s.step === "review") {
      await answer(); await close();
      s.step = "slug"; await this.save(s);
      return this.say("نشانی انگلیسی را بفرست؛ فقط حروف کوچک، عدد و خط تیره، مثلا silent-drivers", ASKING);
    }
    if (what === "delete" && s.step === "menu" && s.mode === "delete") {
      await answer(); await close();
      await deleteFile(this.env, `src/posts/${s.slug}.md`, `Delete post: ${p.title} (from Telegram)`, s.sha);
      await this.forget();
      return this.say(`«${p.title}» پاک شد؛ تا یکی دو دقیقهٔ دیگر از سایت هم برداشته می‌شود.`, MENU);
    }
    if (what === "cancel") {
      await answer(); await close(); await this.forget();
      return this.say(s.mode === "edit" ? "تمام شد." : s.mode === "delete" ? "پاک نشد." : "لغو شد.", MENU);
    }
    if (what === "edit" && s.step === "menu") {
      await answer(); await close();
      if (arg === "title") { s.step = "title"; await this.save(s); return this.say("عنوان تازه را بفرست.\nالان: " + p.title, ASKING); }
      if (arg === "subtitle") {
        s.step = "subtitle"; await this.save(s);
        return this.say("زیرعنوان تازه را بفرست." + (p.subtitle ? "\nالان: " + p.subtitle : ""), { inline_keyboard: [[{ text: "بدون زیرعنوان", callback_data: "nosub" }]] });
      }
      if (arg === "address") {
        s.step = "address"; await this.save(s);
        return this.say(`نشانی تازه را بفرست؛ فقط حروف کوچک انگلیسی، عدد و خط تیره. می‌آید زیر دسته‌اش، مثلا hefzonashr.ir/${sectionOf(p.tags).key}/silent-drivers\nنشانی قبلی هم به نشانی تازه می‌رود.\nالان: ${p.address || s.slug}`, ASKING);
      }
      if (arg === "section") { s.step = "section"; await this.save(s); return this.say("دستهٔ تازه؟", sectionKeys()); }
      if (arg === "tags") { s.step = "tags"; await this.save(s); return this.say("برچسب‌ها را عوض کن، بعد «ادامه».", tagKeys(p.tags)); }
      if (arg === "body") {
        s.step = "body"; s.parts = []; await this.save(s);
        await this.say("متن فعلی:");
        for (const part of chunks(p.body)) await this.say(part);
        return this.say("متن تازه را کامل بفرست و بعد «تمام» را بزن.", WRITING);
      }
    }
    if (what === "nosub" && s.step === "subtitle") {
      await answer(); await close();
      delete p.subtitle;
      return this.store(s, "زیرعنوان");
    }
    return answer("این دکمه دیگر کار نمی‌کند.");
  }

  async review(s) {
    const p = s.post, words = p.body.split(/\s+/).filter(Boolean).length;
    const r = await this.say([
      "عنوان: " + p.title,
      "دسته: " + sectionOf(p.tags).label,
      "برچسب‌ها: " + tagNames(p.tags),
      "متن: " + words.toLocaleString("fa-IR") + " کلمه",
      "نشانی: " + postUrl(s)
    ].join("\n"), { inline_keyboard: [[{ text: "انتشار", callback_data: "publish" }], [{ text: "تغییر نشانی", callback_data: "slug" }, { text: CANCEL, callback_data: "cancel" }]] });
    s.since = r.result?.message_id; await this.save(s);
  }

  async menu(s) {
    const r = await this.say(`کدام بخش «${s.post.title}» را عوض کنیم؟\n${postUrl(s)}`, { inline_keyboard: [
      [{ text: "عنوان", callback_data: "edit:title" }, { text: "زیرعنوان", callback_data: "edit:subtitle" }],
      [{ text: "دسته", callback_data: "edit:section" }, { text: "برچسب‌ها", callback_data: "edit:tags" }],
      [{ text: "متن", callback_data: "edit:body" }, { text: "نشانی", callback_data: "edit:address" }],
      [{ text: DONE, callback_data: "cancel" }]
    ] });
    s.since = r.result?.message_id; await this.save(s);
  }

  async confirmDelete(s) {
    const r = await this.say(`«${s.post.title}» پاک شود؟ این کار برنمی‌گردد.\n${postUrl(s)}`, { inline_keyboard: [
      [{ text: "بله، پاک کن", callback_data: "delete" }, { text: "نه", callback_data: "cancel" }]
    ] });
    s.since = r.result?.message_id; await this.save(s);
  }

  // edit mode: commit the change, then offer the menu again
  async store(s, part) {
    const path = `src/posts/${s.slug}.md`;
    s.sha = await putFile(this.env, path, render(s.post), `Edit post: ${s.post.title} (${part}, from Telegram)`, s.sha);
    s.step = "menu"; await this.save(s);
    await this.say(`${part} عوض شد؛ تا یکی دو دقیقهٔ دیگر روی سایت است.`, MENU);
    return this.menu(s);
  }

  // a post from any of its addresses: /<section>/<slug>/, the old /posts/<slug>/, a short link /p/<id>/, or an old address
  async find(input) {
    let u;
    try { u = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : "https://" + input.trim()); } catch { return null; }
    if (u.hostname.replace(/^www\./, "") !== "hefzonashr.ir") return null;
    const slugOf = path => decodeURIComponent(path).match(/^\/(?:posts|essay|note|poeticwords|otherthings)\/([a-z0-9-]+)\/?$/)?.[1];
    let slug = slugOf(u.pathname), file = slug && await getFile(this.env, `src/posts/${slug}.md`);
    if (!file) {
      // any other address (a chosen one, a short link, an old one): the site's page names the post's file
      slug = await this.fileAt(u.pathname);
      file = slug && await getFile(this.env, `src/posts/${slug}.md`);
    }
    return file ? { slug, sha: file.sha, post: parse(file.text) } : null;
  }

  // the post file behind an address on the site (its page carries <meta name="hefzonashr:file">)
  async fileAt(path) {
    const r = await fetch(SITE + path.replace(/\/?$/, "/"), { cf: { cacheTtl: 0 } }).catch(() => null);
    return r?.ok ? (await r.text()).match(/<meta name="hefzonashr:file" content="([a-z0-9-]+)">/)?.[1] : undefined;
  }

  // is this name already some other post's: its file, or an address (now or before) the site forwards
  async taken(name, own) {
    if (name !== own && await getFile(this.env, `src/posts/${name}.md`)) return true;
    const file = await this.fileAt(`/posts/${name}/`);
    return !!file && file !== own;
  }

  // the next short link /p/<n>: one past the highest the site has (/p/last.txt) or this bot gave out
  // (remembered, since the site takes a minute to rebuild after a post)
  async nextShort() {
    const r = await fetch(SITE + "/p/last.txt", { cf: { cacheTtl: 0 } }).catch(() => null);
    const site = r?.ok ? parseInt(await r.text(), 10) || 0 : 0;
    const mine = parseInt(await this.env.BOT.get("short") || "0", 10);
    if (!site && !mine) throw new Error("آخرین لینک کوتاه پیدا نشد.");
    return Math.max(site, mine) + 1;
  }

  // a default address for a new post, from today's date; Mamareza can change it before publishing
  async freeSlug() {
    const base = "post-" + tehranNow().slice(0, 10).replaceAll("-", "");
    for (let i = 1; ; i++) {
      const slug = i === 1 ? base : `${base}-${i}`;
      if (!await getFile(this.env, `src/posts/${slug}.md`)) return slug;
    }
  }
}

// ---- posts as files ----

// front matter as the site writes it (see src/posts); keys this bot doesn't know are kept as they are
export function parse(text) {
  const m = text.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error("این فایل سرصفحه ندارد.");
  const post = { tags: [], rest: [], body: m[2].replace(/^\n/, "") };
  let list = false;
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (list && /^\s+-\s*/.test(line)) { post.tags.push(line.replace(/^\s+-\s*/, "").trim()); continue; }
    list = false;
    if (!kv) { post.rest.push(line); continue; }
    const [, key, value] = kv;
    if (key === "title" || key === "subtitle") post[key] = scalar(value);
    else if (key === "date" || key === "telegram" || key === "form") post[key] = value.trim();
    else if (key === "address") post.address = scalar(value);
    else if (key === "tags") {
      if (value.trim()) post.tags = value.replace(/^\[|\]$/g, "").split(",").map(t => t.trim()).filter(Boolean);
      else list = true;
    } else post.rest.push(line);
  }
  return post;
}

export function render(p) {
  const head = ["---", "title: " + JSON.stringify(p.title)];
  if (p.subtitle) head.push("subtitle: " + JSON.stringify(p.subtitle));
  head.push("date: " + p.date);
  if (p.telegram) head.push("telegram: " + p.telegram);
  if (p.address) head.push("address: " + p.address);
  head.push("form: " + p.form, "tags: [" + p.tags.join(", ") + "]", ...(p.rest || []), "---");
  // poems start right under the front matter, like the others in src/posts
  return head.join("\n") + (p.form === "poem" ? "\n" : "\n\n") + p.body.replace(/\s+$/, "") + "\n";
}

const scalar = v => {
  v = v.trim();
  if (v.startsWith('"')) try { return JSON.parse(v); } catch { return v.slice(1, -1); }
  if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
};

// Telegram's bold, italic and links as Markdown
export function markdown(text, entities = [], names = {}) {
  const marks = [];
  for (const e of entities) {
    let a = e.offset, b = e.offset + e.length;
    while (a < b && /\s/.test(text[a])) a++;
    while (b > a && /\s/.test(text[b - 1])) b--;
    if (a === b) continue;
    if (e.type === "bold") marks.push([a, "**", 0], [b, "**", 1]);
    else if (e.type === "italic") marks.push([a, "*", 0], [b, "*", 1]);
    else if (e.type === "text_link") marks.push([a, "[", 0], [b, `](${e.url})`, 1]);
    // a bare address becomes a link named after its page: [name](address)
    else if (e.type === "url") marks.push([a, `[${names[a] || host(text.slice(a, b))}](` + (/^https?:\/\//i.test(text.slice(a, b)) ? "" : "https://"), 0], [b, ")", 1]);
  }
  // from the end, so earlier offsets stay right; at one spot a closing mark goes before an opening one
  marks.sort((x, y) => y[0] - x[0] || x[2] - y[2]);
  for (const [at, mark] of marks) text = text.slice(0, at) + mark + text.slice(at);
  return text;
}

const host = url => url.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].replace(/^www\./, "");

// the page titles of the bare addresses in a message, by offset; the site shows links as buttons
async function linkNames(text, entities = []) {
  const names = {};
  await Promise.all(entities.filter(e => e.type === "url").slice(0, 5).map(async e => {
    let url = text.slice(e.offset, e.offset + e.length);
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; hefzonashr-bot)" }, signal: AbortSignal.timeout(4000) });
      const html = (await r.text()).slice(0, 200000);
      const title = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || html.match(/<title[^>]*>([^<]+)/i))?.[1];
      if (title) names[e.offset] = decode(title).replace(/\s+/g, " ").replace(/[[\]]/g, "").trim();
    } catch {}
  }));
  return names;
}
const decode = s => s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|#39);/gi, (m, c) =>
  c[0] === "#" ? String.fromCodePoint(c[1].toLowerCase() === "x" ? parseInt(c.slice(2), 16) : +c.slice(1)) : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[c.toLowerCase()] ?? m);

// a prose message as Markdown paragraphs: a block of short lines (verse inside prose, between
// blank lines) keeps its line breaks (a "\" at a line's end); any other line is its own paragraph
const VERSE_LINE = 70;
const paragraphs = text => text.split(/\n[ \t]*\n/).flatMap(block => {
  const lines = block.split("\n").map(l => l.trim().replace(/\\$/, "").trimEnd()).filter(Boolean);
  return lines.length > 1 && lines.every(l => l.length <= VERSE_LINE) ? [lines.join("\\\n")] : lines;
}).join("\n\n");
const oneLine = text => text.replace(/\s+/g, " ").trim();
const sectionOf = tags => SECTIONS.find(x => x.tags.some(t => tags.includes(t))) || SECTIONS[3];
// a post's address on the site, under its section (src/posts/posts.11tydata.js)
// (its `address` if it has one, else the file name)
const postUrl = s => `${SITE}/${sectionOf(s.post.tags).key}/${s.post.address || s.slug}/`;
const tagNames = tags => tags.map(t => TAGS[t] || t).join("، ");
const rows = (items, n) => items.reduce((r, x, i) => (i % n ? r[r.length - 1].push(x) : r.push([x]), r), []);
const sectionKeys = () => ({ inline_keyboard: rows(SECTIONS.map(x => ({ text: x.label, callback_data: "section:" + x.key })), 2) });
const tagKeys = sel => ({ inline_keyboard: [
  ...rows(Object.keys(TAGS).map(k => ({ text: (sel.includes(k) ? "✓ " : "") + TAGS[k], callback_data: "tag:" + k })), 4),
  [{ text: "ادامه", callback_data: "tags" }]
] });

// pieces under Telegram's 4096-character limit, cut at line ends
function chunks(text, max = 4000) {
  const out = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut)); rest = rest.slice(cut).replace(/^\n+/, "");
  }
  if (rest) out.push(rest);
  return out;
}

// Iran has no daylight saving time since 2022
const tehranNow = () => new Date(Date.now() + 3.5 * 3600e3).toISOString().slice(0, 19) + "+03:30";

// ---- Telegram and GitHub ----

async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  return r.json().catch(() => ({ ok: false }));
}

// the webhook's shared secret, made from the bot token so there is nothing else to set
async function secret(env) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("hefzonashr-webhook:" + env.TELEGRAM_BOT_TOKEN));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function github(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "hefzonashr-bot", "Content-Type": "application/json" }
  });
}

async function getFile(env, path) {
  const r = await github(env, `contents/${path}?ref=${BRANCH}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  const j = await r.json();
  return { sha: j.sha, text: new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\n/g, "")), c => c.charCodeAt(0))) };
}

async function putFile(env, path, text, message, sha) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const r = await github(env, `contents/${path}`, { method: "PUT", body: JSON.stringify({ message, content: btoa(bin), branch: BRANCH, ...(sha && { sha }) }) });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.json().catch(() => ({}))).message || ""}`);
  return (await r.json()).content.sha;
}

async function deleteFile(env, path, message, sha) {
  const r = await github(env, `contents/${path}`, { method: "DELETE", body: JSON.stringify({ message, sha, branch: BRANCH }) });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.json().catch(() => ({}))).message || ""}`);
}
