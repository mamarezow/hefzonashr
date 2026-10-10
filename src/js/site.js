// حفظ و نشر آثار: theme switch, short-link copy, justification

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
document.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => {
  const u = b.dataset.copy, label = b.querySelector(".u"), text = label.textContent;
  const done = () => {
    label.textContent = "کپی شد"; label.classList.add("ok");
    setTimeout(() => { label.textContent = text; label.classList.remove("ok"); }, 1600);
  };
  const select = () => { const r = document.createRange(); r.selectNodeContents(label); getSelection().removeAllRanges(); getSelection().addRange(r); };
  try { navigator.clipboard.writeText(u).then(done, select); } catch (e) { select(); }
}));

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

const prose = [...document.querySelectorAll(".prose p")];
if (prose.length) {
  const run = () => prose.forEach(justify);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(run);
  let w = prose[0].parentElement.clientWidth, t;
  new ResizeObserver(() => {
    const nw = prose[0].parentElement.clientWidth;
    if (nw === w) return;
    w = nw; clearTimeout(t); t = setTimeout(run, 120);
  }).observe(prose[0].parentElement);
}

// copying gives the original text: no tatweels, and our line breaks become spaces again
document.addEventListener("copy", e => {
  const sel = getSelection();
  if (!sel.rangeCount || !sel.getRangeAt(0).cloneContents().querySelector?.(".ln") && !sel.toString().includes(KASHIDA)) return;
  const text = sel.toString().replaceAll(KASHIDA, "").replace(/([^\n])\n(?=[^\n])/g, "$1 ");
  e.clipboardData.setData("text/plain", text);
  e.preventDefault();
});
