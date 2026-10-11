// حفظ و نشر آثار: theme switch, short-link copy, justification, section swipe

const root = document.documentElement;
const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;

// ---- theme switch
const sw = document.querySelector("[data-tgl]");
if (sw) {
  sw.setAttribute("aria-checked", String(isDark()));
  sw.addEventListener("click", () => {
    const t = isDark() ? "light" : "dark";
    root.dataset.theme = t;
    try { localStorage.setItem("hefz-theme", t); } catch (e) {}
    sw.setAttribute("aria-checked", String(t === "dark"));
  });
}

// ---- copy the short link
const copyButtons = root => root.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => {
  const u = b.dataset.copy, label = b.querySelector(".u"), text = label.textContent;
  const done = () => {
    label.textContent = "کپی شد"; label.classList.add("ok");
    setTimeout(() => { label.textContent = text; label.classList.remove("ok"); }, 1600);
  };
  const select = () => { const r = document.createRange(); r.selectNodeContents(label); getSelection().removeAllRanges(); getSelection().addRange(r); };
  try { navigator.clipboard.writeText(u).then(done, select); } catch (e) { select(); }
}));
copyButtons(document);

// ---- the message form on /me/ (listened for on the document, so it also works after a swipe brings the page in)
document.addEventListener("submit", e => {
  const f = e.target.closest("[data-contact]");
  if (!f) return;
  e.preventDefault();
  const note = f.querySelector(".note"), btn = f.querySelector("button"), from = f.elements.email.value.trim();
  // optional: an email, or a Telegram username with or without @ (the server checks the same)
  if (from && !/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(from) && !/^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(from)) {
    note.textContent = "ایمیل یا شناسهٔ تلگرام درست نیست."; f.elements.email.focus(); return;
  }
  btn.disabled = true; note.textContent = "در حال فرستادن…";
  fetch(f.action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(f))) })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(d => { if (!d.ok) throw 0; f.reset(); note.textContent = "رسید؛ ممنون!"; })
    .catch(() => { note.textContent = "نرسید؛ دوباره امتحان کن."; })
    .finally(() => { btn.disabled = false; });
});
{ // back from the form's plain post, when JavaScript was off
  const sent = new URLSearchParams(location.search).get("sent"), note = document.querySelector("[data-contact] .note");
  if (sent && note) note.textContent = sent === "1" ? "رسید؛ ممنون!" : "نرسید؛ دوباره امتحان کن.";
}

// ---- justification: kashida + word spacing
// We break each paragraph into lines ourselves. A line may pull in one more word by
// tightening its spaces a little; otherwise the leftover gap is split between kashida
// (tatweel U+0640 stretching joined letters) and wider spaces. Kashidas go to the
// traditional spots first (after س ش ص ض, then before a word's last joined letter) and
// are spread across the line, not piled at one end. The HTML source stays clean;
// tatweels exist only on screen and are stripped on copy.
const KASHIDA = "ـ";
const DUAL = "بپتثجچحخسشصضطظعغفقکگلمنهیئيكـ";   // letters that join to the next letter
const JOINS = DUAL + "اآأإدذرزژوؤة";               // letters that can take a join from the previous one
const MAX_PER_WORD = 2;
const KASHIDA_SHARE = 0.5;   // part of a line's gap filled by stretching letters; spaces take the rest
const MIN_SPACE = 0.72;      // a space may shrink to this fraction of its normal width
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// best place for a tatweel in a word, as { at, rank } (lower rank is better), or null
function kashidaSpot(w) {
  if (w.replace(/[^\u0621-\u06FF]/g, "").length < 3) return null;   // short words like «به» look broken when stretched
  let best = null;
  for (let i = 0; i < w.length - 1; i++) {
    const a = w[i], b = w[i + 1];
    if (!DUAL.includes(a) || !JOINS.includes(b) || a === KASHIDA) continue;
    if (a === "ل" && "اآأإ".includes(b)) continue;          // keep the «لا» ligature
    const lastJoin = !JOINS.includes(w[i + 2] || "") || !DUAL.includes(b);
    const rank = "سشصض".includes(a) ? 0 : a === "ه" ? 2 : lastJoin ? 1 : 2;
    if (!best || rank < best.rank || (rank === best.rank && rank === 1)) best = { at: i + 1, rank };
  }
  return best;
}

// pick m items spread evenly over arr
const spread = (arr, m) => Array.from({ length: m }, (_, k) => arr[Math.floor((k + 0.5) * arr.length / m)]);

function justify(p) {
  if (p.dataset.src === undefined) {
    if (p.children.length) return;                 // paragraphs with links or emphasis keep plain justify
    p.dataset.src = p.textContent.trim().replace(/\s+/g, " ");
  }
  const src = p.dataset.src, list = src.split(" ");
  // measure words, a space and a tatweel in the paragraph's own font
  p.innerHTML = `<span class="ln end">${list.map(w => `<span>${esc(w)}</span>`).join(" ")}<span> </span><span>${KASHIDA.repeat(20)}</span></span>`;
  const spans = [...p.firstChild.children];
  const widths = spans.map(s => s.getBoundingClientRect().width);
  const kw = widths.pop() / 20, sp = widths.pop(), W = p.clientWidth;
  if (!kw || !sp || !W) { p.textContent = src; return; }

  const words = list.map((w, i) => ({ w, width: widths[i], spot: kashidaSpot(w), n: 0 }));
  const lines = [];
  for (let i = 0; i < words.length;) {
    let j = i + 1, used = words[i].width;
    while (j < words.length && used + sp + words[j].width <= W) used += sp + words[j++].width;
    let line = { from: i, to: j, gap: W - used, ws: 0 };
    if (j < words.length) {
      // could one more word fit by tightening the spaces?  take it when that bends the line less
      const tight = used + sp + words[j].width, gaps = j - i;
      const shrink = (tight - W) / gaps;
      const stretch = line.gap * (1 - KASHIDA_SHARE) / Math.max(1, gaps - 1);
      if (shrink <= sp * (1 - MIN_SPACE) && shrink < stretch) line = { from: i, to: j + 1, gap: 0, ws: -shrink - 0.5 };
    }
    lines.push(line);
    i = line.to;
  }

  lines.forEach((l, k) => {
    if (k === lines.length - 1 || l.gap <= 0) return;
    let budget = Math.floor(l.gap * KASHIDA_SHARE / kw);
    const cand = words.slice(l.from, l.to).filter(o => o.spot);
    for (let pass = 0; pass < MAX_PER_WORD && budget > 0; pass++)
      for (let rank = 0; rank <= 2 && budget > 0; rank++) {
        const group = cand.filter(o => o.spot.rank === rank && o.n === pass);
        spread(group, Math.min(budget, group.length)).forEach(o => { o.n++; budget--; });
      }
  });

  const word = o => o.n ? o.w.slice(0, o.spot.at) + KASHIDA.repeat(o.n) + o.w.slice(o.spot.at) : o.w;
  p.innerHTML = lines.map((l, k) =>
    `<span class="ln${k === lines.length - 1 ? " end" : ""}"${l.ws ? ` style="word-spacing:${l.ws.toFixed(2)}px"` : ""}>` +
    esc(words.slice(l.from, l.to).map(word).join(" ")) + "</span>").join("");
}

const justifyAll = root => root.querySelectorAll(".prose p").forEach(justify);
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => justifyAll(document));
const mainEl = document.querySelector("main");
if (mainEl) {
  let w = mainEl.clientWidth, t;
  new ResizeObserver(() => {
    const nw = mainEl.clientWidth;
    if (nw === w) return;
    w = nw; clearTimeout(t); t = setTimeout(() => justifyAll(mainEl), 120);
  }).observe(mainEl);
}

// copying gives the original text: no tatweels, and our line breaks become spaces again
document.addEventListener("copy", e => {
  const sel = getSelection();
  if (!sel.rangeCount || !sel.getRangeAt(0).cloneContents().querySelector?.(".ln") && !sel.toString().includes(KASHIDA)) return;
  const text = sel.toString().replaceAll(KASHIDA, "").replace(/([^\n])\n(?=[^\n])/g, "$1 ");
  e.clipboardData.setData("text/plain", text);
  e.preventDefault();
});


// ---- phones: swipe sideways, between the sections and from one post to the next
// The sections form a ring: home (it has no button), then the pills in order; home sits
// past both ends. On a post, a swipe does what the arrow buttons under it do. Each
// neighbouring page is fetched ahead of time and slides in beside this one, following
// the finger 1:1, and the yellow marker glides between the pills with it; a quick flick is
// enough. Clicking a link inside the site swaps the page the same way, without a reload, on
// every screen. The address and history follow, so back, forward and sharing work as if the
// page was opened by its link.
(() => {
  const nav = document.querySelector(".pills"), pills = nav ? [...nav.querySelectorAll("a")] : [];
  const ring = ["/", ...pills.map(a => a.getAttribute("href"))];
  const ringAt = path => /^\/(page\/\d+\/)?$/.test(path) ? 0 : ring.indexOf(path);
  const main = () => document.querySelector("main");
  if (!main()) return;
  const touch = matchMedia("(pointer: coarse)").matches;
  const rtl = document.documentElement.dir === "rtl";
  // the page a swipe brings in: side 1 = finger moving right, so it comes from the left
  const toward = side => {
    const i = ringAt(location.pathname);
    if (i >= 0) return ring[(i + ((side > 0) === rtl ? 1 : -1) + ring.length) % ring.length];
    const a = main().querySelector(`.pn a[rel=${(side > 0) === rtl ? "next" : "prev"}]`);
    return a ? a.getAttribute("href") : null;
  };
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPRING = "cubic-bezier(.22,1,.36,1)";

  // pages by address: what's loaded is in `ready`, so a swipe never waits
  const pages = new Map(), ready = new Map();
  const load = url => {
    if (!pages.has(url)) pages.set(url, fetch(url).then(r => r.ok ? r.text() : Promise.reject()).then(t => {
      const d = new DOMParser().parseFromString(t, "text/html"), on = d.querySelector(".pills a.on");
      const v = { html: d.querySelector("main").innerHTML, title: d.title, pill: on && on.getAttribute("href") };
      ready.set(url, v); return v;
    }).catch(() => { pages.delete(url); return null; }));
    return pages.get(url);
  };
  const lit = pills.find(a => a.classList.contains("on"));
  const here = { html: main().innerHTML, title: document.title, pill: lit && lit.getAttribute("href") };
  ready.set(location.pathname, here); pages.set(location.pathname, Promise.resolve(here));
  const idle = window.requestIdleCallback || (f => setTimeout(f, 300));
  const warm = () => touch && idle(() => [1, -1].map(toward).forEach(u => u && load(u)));
  warm();

  // the marker: a yellow block under the pills that glides from one to the next (home has none, so it fades)
  const mark = document.createElement("i");
  mark.className = "mark"; mark.setAttribute("aria-hidden", "true"); nav && nav.prepend(mark);
  const pillOf = href => pills.find(a => a.getAttribute("href") === href);
  const box = a => { const r = a.getBoundingClientRect(), n = nav.getBoundingClientRect(); return [r.left - n.left, r.top - n.top, r.width, r.height]; };
  function markAt(from, to, t) {
    const fa = pillOf(from), ta = pillOf(to), A = fa ? box(fa) : null, B = ta ? box(ta) : null, a = A || B, b = B || A;
    if (!a) return;
    const v = a.map((x, k) => x + (b[k] - x) * t);
    Object.assign(mark.style, { transform: `translate(${v[0]}px,${v[1]}px)`, width: v[2] + "px", height: v[3] + "px", opacity: String((A ? 1 - t : 0) + (B ? t : 0)) });
    pills.forEach(p => p.classList.toggle("lit", p === (t < 0.5 ? fa : ta)));
  }
  const unmark = () => { nav && nav.classList.remove("moving"); mark.style.transition = "none"; mark.style.opacity = "0"; pills.forEach(a => a.classList.remove("lit")); };

  // put a page in place of the current one: the copy that slid in, or one rebuilt from its HTML
  let other = null, curPill = here.pill, toPill = null;
  function show(url, page, push) {
    const m = main(), r = m.getBoundingClientRect(), docTop = r.top + scrollY;
    if (other) { m.replaceChildren(...other.childNodes); other.remove(); other = null; }
    else { m.innerHTML = page.html; justifyAll(m); }
    m.style.cssText = ""; document.title = page.title;
    copyButtons(m);
    if (r.top < 0) scrollTo(0, docTop);
    pills.forEach(a => { const on = a.getAttribute("href") === page.pill; a.classList.toggle("on", on); on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); });
    curPill = page.pill; unmark();
    if (push) history.pushState({ swiped: 1 }, "", url);
    warm();
  }
  history.replaceState({ swiped: 1 }, "");
  addEventListener("popstate", e => {
    if (!e.state || !e.state.swiped) return;
    const url = location.pathname;
    load(url).then(pg => pg ? show(url, pg, false) : location.reload());
  });

  // a click on a link inside the site: the page comes in place of this one (fetched while the
  // pointer rested on the link), at the same spot a swipe would leave it
  let busy = false;   // a swipe is finishing
  const inside = e => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target || a.hasAttribute("download") || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || u.search || /\.[a-z0-9]+$/i.test(u.pathname) || (u.hash && u.pathname === location.pathname)) return null;
    return u.pathname;
  };
  ["pointerover", "focusin", "touchstart"].forEach(t => addEventListener(t, e => { const u = inside(e); u && load(u); }, { passive: true }));
  addEventListener("click", e => {
    const url = inside(e);
    if (!url || busy) return;
    e.preventDefault();
    load(url).then(pg => {
      if (!pg) { location.href = url; return; }
      if (url !== location.pathname) show(url, pg, true);
      else show(url, pg, false);
    });
  });

  // the finger
  if (!touch) return;
  const scrollsX = n => { for (; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if ((o === "auto" || o === "scroll") && n.scrollWidth > n.clientWidth + 2) return true; } return false; };
  // how fast the finger was going at the end (px per ms), from its last moments only: a held finger is not a flick
  let samples = [];
  const flick = () => { const now = performance.now(), rec = samples.filter(q => now - q[0] < 120), a = rec[0], b = rec.at(-1); return a && b && b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) : 0; };
  let sx = null, sy = 0, lock = false, startTg = null, m = null, target = null, side = 1, W = 0, p = 0;
  const pose = q => {
    m.style.transform = `translate3d(${side * W * q}px,0,0)`;
    if (other) other.style.transform = `translate3d(${side * W * (q - 1)}px,0,0)`;
    markAt(curPill, toPill, Math.max(0, Math.min(1, q)));
  };
  const MV = { passive: false };   // only on while a finger that may swipe is down, so ordinary scrolling never waits for it
  addEventListener("touchstart", e => {
    sx = null; if (busy || e.touches.length > 1) return;
    const t = e.touches[0];
    // the screen edges belong to the browser's own back swipe; a zoomed-in page pans instead
    if (t.clientX < 20 || t.clientX > innerWidth - 20 || (window.visualViewport && visualViewport.scale > 1.01)) return;
    startTg = e.target; sx = t.clientX; sy = t.clientY; lock = false; samples = [];
    addEventListener("touchmove", mv, MV);
  }, { passive: true });
  function mv(e) {
    if (sx == null || (!lock && e.touches.length > 1)) { sx = null; removeEventListener("touchmove", mv, MV); return; }
    const x = e.touches[0].clientX, mx = x - sx, my = e.touches[0].clientY - sy;
    if (!lock) {
      if (Math.hypot(mx, my) < 6) return;
      if (Math.abs(mx) <= Math.abs(my) * 1.2 || scrollsX(startTg) || String(getSelection())) { sx = null; return; }
      side = mx < 0 ? -1 : 1; target = toward(side);
      if (!target) { sx = null; return; }   // a page outside the ring with no arrows: nothing to swipe to
      m = main(); W = innerWidth;
      const r = m.getBoundingClientRect(), top = Math.max(r.top, 0), page = target && ready.get(target);
      if (page) {
        other = document.createElement("main");
        other.innerHTML = page.html; other.setAttribute("aria-hidden", "true");
        Object.assign(other.style, { position: "fixed", top: top + "px", left: r.left + "px", width: r.width + "px", height: innerHeight - top + "px", overflow: "hidden", pointerEvents: "none", margin: "0", willChange: "transform" });
        m.after(other); justifyAll(other);
      } else if (target) load(target);
      toPill = page ? page.pill : pillOf(target) ? target : null;
      m.style.willChange = "transform"; m.style.transition = "none";
      nav && nav.classList.add("moving"); mark.style.transition = "none";
      sx = x - (mx > 0 ? 6 : -6);   // start from where the finger is now: no jump
      lock = true;
    }
    if (e.cancelable) e.preventDefault();
    let dx = x - sx; if (dx * side < 0) dx /= 4;   // pulled back past the start: barely moves
    p = dx * side / W; if (!other) p /= 3;         // nothing that way (or not loaded yet): give a little
    samples.push([performance.now(), x]); if (samples.length > 6) samples.shift();
    pose(p);
  }
  function end() {
    removeEventListener("touchmove", mv, MV);
    if (sx == null) return; sx = null; if (!lock) return; lock = false;
    const v = flick() * side, q = Math.max(0, p) * (other ? 1 : 3);
    const commit = !!target && (q > 0.3 || (v > 0.3 && q > 0.04)) && v > -0.2;
    const left = commit ? 1 - q : q;
    const ms = calm() ? 0 : Math.round(Math.max(200, Math.min(420, left * W / Math.max(Math.abs(v), 1) * 1.5)));
    busy = true;
    [m, other].forEach(n => n && (n.style.transition = `transform ${ms}ms ${SPRING}`));
    mark.style.transition = ["transform", "width", "height", "opacity"].map(k => `${k} ${ms}ms ${SPRING}`).join();
    pose(commit ? 1 : 0);
    setTimeout(() => {
      busy = false;
      if (commit && other) show(target, ready.get(target), true);
      // not fetched yet (a fast swipe): wait for it here instead of reloading the whole page
      else if (commit) load(target).then(pg => pg ? show(target, pg, true) : (location.href = target));
      else { if (other) { other.remove(); other = null; } m.style.cssText = ""; unmark(); }
    }, ms + 20);
  }
  addEventListener("touchend", end); addEventListener("touchcancel", end);
})();
