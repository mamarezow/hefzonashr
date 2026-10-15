// The in-place editor on admin.hefzonashr.ir, added to every page of the site by src/panel.js.
// Signed in (the username/password of /login), a bar at the bottom offers «پست جدید» and, on a
// post, «ویرایش»: the title, subtitle, text and tags become editable right where they are, and
// saving commits the post to main (the site rebuilds in a few minutes).
(() => {
  const TAGS = { essay: "جستار", note: "یادداشت", poem: "شعر", song: "ترانه", critique: "نقد", intro: "معرفی", otherthings: "دیگر" };
  const KEY = "sveltia-cms.user";   // the same sign-in as the old panel at /cms/
  const token = (() => { try { return JSON.parse(localStorage.getItem(KEY) || "null")?.token || ""; } catch { return ""; } })();
  const root = document.documentElement, main = () => document.querySelector("main");
  const bar = document.createElement("div");
  bar.className = "hz-bar"; bar.dir = "rtl";
  document.body.append(bar);

  const el = (tag, attrs = {}, text) => { const e = document.createElement(tag); Object.assign(e, attrs); if (text != null) e.textContent = text; return e; };
  const btn = (text, onclick, cls = "") => el("button", { type: "button", className: "hz-b " + cls, onclick }, text);
  let mode = "view", draft = null, note = "";
  // typing without pasted formatting where the browser can; plain contenteditable elsewhere
  const editable = e => { try { e.contentEditable = "plaintext-only"; } catch { e.contentEditable = "true"; } e.classList.add("hz-field"); e.spellcheck = false; return e; };

  if (!token.startsWith("hz_")) { bar.append(el("a", { className: "hz-b", href: "/login" }, "ورود به پنل")); return; }

  async function call(method, path, body) {
    const r = await fetch(path, { method, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : { error: "اتصال برقرار نشد." };
    if (r && r.status === 401) { try { localStorage.removeItem(KEY); } catch {} location.href = "/login"; }
    if (!r || !r.ok) throw new Error(j.error || "خطا " + (r && r.status));
    return j;
  }

  function show() {
    bar.replaceChildren();
    if (mode === "view") {
      bar.append(btn("پست جدید", write, "hz-main"));
      if (main()?.querySelector("article[data-file]")) bar.append(btn("ویرایش", edit));
      bar.append(btn("خروج", () => { try { localStorage.removeItem(KEY); } catch {} location.reload(); }, "hz-quiet"));
    } else {
      bar.append(btn(mode === "new" ? "انتشار" : "ذخیره", save, "hz-main"), btn("لغو", cancel, "hz-quiet"));
    }
    if (note) bar.append(el("span", { className: "hz-note" }, note));
  }
  const say = text => { note = text; show(); };

  // the editable post: a title, a subtitle, the text exactly as in its file, and every tag as a toggle
  function editor(article, d) {
    article.querySelector("header").replaceChildren(
      editable(el("h1", {}, d.title)), editable(el("h2", {}, d.subtitle)));
    const [h1, h2] = article.querySelectorAll("header .hz-field");
    h1.dataset.ph = "عنوان"; h2.dataset.ph = "زیرعنوان (اختیاری)";
    const body = editable(el("div", { className: "body hz-text" }, d.body));
    body.dataset.ph = "متن";
    article.querySelector(".body").replaceWith(body);
    const tags = new Set(d.tags);
    const form = () => d.form || (tags.has("poem") || tags.has("song") ? "poem" : "prose");
    const look = () => { body.classList.toggle("poem", form() === "poem"); body.classList.toggle("prose", form() !== "poem"); };
    const row = article.querySelector(".postfoot .row");
    const chips = el("span", { className: "tags" });
    for (const [k, label] of Object.entries(TAGS)) {
      const c = btn(label, () => { tags.has(k) ? tags.delete(k) : tags.add(k); c.classList.toggle("on", tags.has(k)); look(); }, "tag hz-tag");
      c.classList.remove("hz-b"); c.classList.toggle("on", tags.has(k));
      chips.append(c);
    }
    row.replaceChildren(chips);
    let address;
    if (!d.file) {
      address = el("input", { className: "hz-address", dir: "ltr", placeholder: "address (optional)", autocapitalize: "off", spellcheck: false });
      row.append(address);
    }
    look();
    draft = { d, read: () => ({ file: d.file, sha: d.sha, title: h1.innerText, subtitle: h2.innerText, body: body.innerText, tags: [...tags], address: address?.value }) };
    root.classList.add("hz-editing");
    (d.title ? body : h1).focus();
  }

  let before = null;   // the page as it was, for «لغو»
  async function edit() {
    const article = main().querySelector("article[data-file]");
    say("در حال خواندن متن…");
    try {
      const d = await call("GET", "/panel/api/post?file=" + encodeURIComponent(article.dataset.file));
      before = main().innerHTML; mode = "edit"; note = "";
      editor(article, d); show();
    } catch (e) { say(e.message); }
  }
  function write() {
    before = main().innerHTML; mode = "new"; note = "";
    const m = main();
    m.innerHTML = '<article><header></header><div class="body"></div><footer class="postfoot"><div class="row"></div></footer></article>';
    editor(m.querySelector("article"), { title: "", subtitle: "", body: "", tags: [] });
    scrollTo(0, 0); show();
  }
  function cancel() {
    if (!confirm("تغییرها کنار گذاشته شوند؟")) return;
    main().innerHTML = before; done("");
  }
  function done(text) { mode = "view"; draft = null; root.classList.remove("hz-editing"); say(text); }

  async function save() {
    const data = draft.read();
    say(mode === "new" ? "در حال انتشار…" : "در حال ذخیره…");
    try {
      const r = await call("POST", "/panel/api/post", data);
      // leave the new words on the page, no longer editable, until the site has rebuilt
      for (const f of main().querySelectorAll(".hz-field")) { f.contentEditable = "false"; f.classList.remove("hz-field"); }
      const row = main().querySelector(".postfoot .row");
      row.replaceChildren(el("span", { className: "tags" }));
      for (const k of data.tags) row.firstChild.append(el("a", { className: "tag", href: "/" + k + "/" }, TAGS[k]));
      if (mode === "edit") draft.d.sha = r.sha;
      done(mode === "new" ? "منتشر شد؛ چند دقیقهٔ دیگر روی سایت است: " + r.url.replace("https://", "") : "ذخیره شد؛ چند دقیقهٔ دیگر روی سایت است.");
    } catch (e) { note = e.message; show(); }
  }

  // while editing, leaving the page asks first
  addEventListener("beforeunload", e => { if (draft) e.preventDefault(); });
  addEventListener("click", e => {
    const a = draft && e.target.closest && e.target.closest("a[href]");
    if (a && !confirm("از ویرایش بیرون بروی؟ تغییرها ذخیره نمی‌شوند.")) { e.preventDefault(); e.stopImmediatePropagation(); }
    else if (a) done("");
  }, true);
  // the site swaps pages in place (src/js/site.js): the bar follows the page that is showing
  new MutationObserver(() => { if (mode === "view") { note = ""; show(); } }).observe(main(), { childList: true });
  show();
})();
