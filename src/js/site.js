// حفظ و نشر آثار: theme switch, short-link copy, kashida justification

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

// ---- kashida justification
// Browsers only stretch spaces in Persian, so on each line we first lengthen joined
// letters with tatweel (U+0640), then let justify spread the rest over the spaces.
// The HTML source stays clean; tatweels exist only on screen and are stripped on copy.
const KASHIDA = "ـ";
const DUAL = "بپتثجچحخسشصضطظعغفقکگلمنهیئيكـ";   // letters that join to the next letter
const JOINS = DUAL + "اآأإدذرزژوؤة";               // letters that can take a join from the previous one
const MAX_PER_WORD = 2;
const KASHIDA_SHARE = 0.5;                        // part of each line's gap filled by stretching; spaces take the rest
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function kashidaSpot(w) {
  // last place inside the word where a tatweel can sit; skip «لا» so the ligature survives
  for (let i = w.length - 2; i >= 0; i--) {
    const a = w[i], b = w[i + 1];
    if (DUAL.includes(a) && JOINS.includes(b) && a !== KASHIDA && !(a === "ل" && "اآأإ".includes(b))) return i + 1;
  }
  return -1;
}

function justifyKashida(p) {
  if (p.dataset.src === undefined) {
    if (p.children.length) return;                 // paragraphs with links or emphasis keep plain justify
    p.dataset.src = p.textContent;
  }
  const src = p.dataset.src;
  p.style.textAlign = "start";
  p.innerHTML = src.split(" ").map(w => `<span class="w">${esc(w)}</span>`).join(" ");
  const words = [...p.querySelectorAll(".w")];
  if (!words.length) return;
  const probe = document.createElement("span");
  probe.textContent = KASHIDA.repeat(20);
  p.appendChild(probe);
  const kw = probe.getBoundingClientRect().width / 20;
  probe.remove();
  if (!kw) { p.textContent = src; p.style.textAlign = ""; return; }
  const box = p.getBoundingClientRect();
  const lines = [];
  for (const s of words) {
    const top = Math.round(s.offsetTop);
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.top - top) < 4) last.words.push(s); else lines.push({ top, words: [s] });
  }
  lines.slice(0, -1).forEach(line => {
    const first = line.words[0].getBoundingClientRect(), end = line.words[line.words.length - 1].getBoundingClientRect();
    const used = Math.max(first.right, end.right) - Math.min(first.left, end.left);
    let budget = Math.floor((box.width - used) * KASHIDA_SHARE / kw);
    const slots = line.words.map(s => ({ s, at: kashidaSpot(s.textContent), n: 0 })).filter(o => o.at > 0);
    if (!slots.length) return;
    // one per word per pass, at most MAX_PER_WORD passes
    for (let pass = 0; pass < MAX_PER_WORD && budget > 0; pass++)
      for (const o of slots) { if (budget <= 0) break; o.n++; budget--; }
    slots.forEach(o => { if (o.n) { const t = o.s.textContent; o.s.textContent = t.slice(0, o.at) + KASHIDA.repeat(o.n) + t.slice(o.at); } });
  });
  p.style.textAlign = "";
  // safety: if the stretched text wrapped differently, fall back to plain justify
  const lineCount = new Set(words.map(s => Math.round(s.offsetTop / 4))).size;
  if (lineCount !== lines.length) p.textContent = src;
}

const prose = [...document.querySelectorAll(".prose p")];
if (prose.length) {
  const run = () => prose.forEach(justifyKashida);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(run);
  let w = prose[0].parentElement.clientWidth, t;
  new ResizeObserver(() => {
    const nw = prose[0].parentElement.clientWidth;
    if (nw === w) return;
    w = nw; clearTimeout(t); t = setTimeout(run, 120);
  }).observe(prose[0].parentElement);
}

// copying gives the original words, without tatweels
document.addEventListener("copy", e => {
  const sel = getSelection().toString();
  if (!sel.includes(KASHIDA)) return;
  e.clipboardData.setData("text/plain", sel.replaceAll(KASHIDA, ""));
  e.preventDefault();
});
