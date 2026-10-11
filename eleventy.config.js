import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import redirects from "./src/_data/redirects.js";

const TZ = "Asia/Tehran";
// dates are shown as month and year only («اردیبهشت ۱۳۹۹»), never the day
const faDate = new Intl.DateTimeFormat("fa-IR", { calendar: "persian", month: "long", year: "numeric", timeZone: TZ });
const ym = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: TZ });

export default function (eleventyConfig) {
  // ?v=<hash> on css/js links, so browsers drop a cached copy as soon as the file changes
  eleventyConfig.addFilter("v", path =>
    `${path}?v=${createHash("md5").update(readFileSync(`src${path}`)).digest("hex").slice(0, 8)}`);

  eleventyConfig.addPassthroughCopy({ "src/fonts": "fonts", "src/css": "css", "src/js": "js", "src/CNAME": "CNAME", "src/.nojekyll": ".nojekyll" });

  // all posts, newest first; posts sharing a timestamp keep channel order
  eleventyConfig.addCollection("posts", api =>
    api.getFilteredByGlob("src/posts/*.md").sort((a, b) => (b.date - a.date) || ((b.data.telegram || 0) - (a.data.telegram || 0))));

  // posts that came from the Telegram channel get a short link /p/<message id>/
  eleventyConfig.addCollection("shortlinked", api =>
    api.getFilteredByGlob("src/posts/*.md").filter(p => p.data.telegram));

  // addresses that forward to a post. A post's names: its `address`, its file name, and every `address`
  // it had before (read from git history); each name forwards from /posts/<name>/ (where every post lived
  // until 2026-10-11) and from every section, so a renamed or re-sectioned post keeps its old links.
  // Plus the Finglish names from before 2026-10-10 (src/_data/redirects.js).
  eleventyConfig.addCollection("moved", api => {
    const posts = api.getFilteredByGlob("src/posts/*.md"), bySlug = s => posts.find(p => p.page.fileSlug === s);
    const past = pastAddresses(), roots = ["posts", "essay", "note", "poeticwords", "otherthings"];
    const owner = new Map(posts.map(p => [p.url, null]));       // real post pages are never overwritten
    const add = (from, post) => { if (!owner.has(from)) owner.set(from, post); };
    for (const names of [p => [p.data.address], p => [p.page.fileSlug], p => past[p.page.fileSlug] || []])
      for (const post of posts) for (const name of names(post)) if (name) for (const root of roots) add(`/${root}/${name}/`, post);
    for (const [from, to] of Object.entries(redirects)) { const post = bySlug(to.split("/")[2]); if (post) add(from, post); }
    return [...owner].filter(([, post]) => post).map(([from, post]) => ({ from, post }));
  });

  eleventyConfig.addFilter("jdate", d => {
    const parts = Object.fromEntries(faDate.formatToParts(d).map(p => [p.type, p.value]));
    return `${parts.month} ${parts.year}`;
  });
  // machine-readable date at the same precision: 2020-05
  eleventyConfig.addFilter("iso", d => ym.format(d));

  // posts carrying a given tag key
  eleventyConfig.addFilter("withTag", (posts, keys) => {
    keys = [].concat(keys);
    return posts.filter(p => (p.data.tags || []).some(t => keys.includes(t)));
  });

  // one-line teaser for lists: front-matter `excerpt`, else the first non-empty line of the text
  eleventyConfig.addFilter("teaser", post => {
    if (post.data.excerpt) return post.data.excerpt;
    const line = (post.rawInput || "").split("\n").map(s => s.replace(/[‏‎]/g, "").trim()).find(Boolean) || "";
    // Markdown left out: links keep their text, a line-break "\" goes
    const plain = line.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\\$/, "").replace(/[*_`#>\[\]]/g, "").trim();
    if (plain.length <= 160) return plain;
    return plain.slice(0, plain.lastIndexOf(" ", 160)) + "…";
  });

  // a poem as stanzas (<p>) of lines (<br>): same look as the plain text, and readers that
  // ignore CSS, like Telegram Instant View, keep every line break
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  eleventyConfig.addFilter("poemHtml", raw => raw.replace(/\r/g, "").trim().split(/\n[ \t]*\n/)
    .map(st => `<p>${st.split("\n").map(esc).join("<br>\n")}</p>`).join("\n"));

  // newest-first collection: «previous» is the older post, «next» the newer one
  // the post living at a given url (used by the forwarding pages for old addresses)
  eleventyConfig.addFilter("atUrl", (posts, url) => posts.find(p => p.url === url));

  eleventyConfig.addFilter("older", (posts, url) => { const i = posts.findIndex(p => p.url === url); return i >= 0 ? posts[i + 1] : undefined; });
  eleventyConfig.addFilter("newer", (posts, url) => { const i = posts.findIndex(p => p.url === url); return i > 0 ? posts[i - 1] : undefined; });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk"
  };
}

// every `address:` a post file has ever had, by file name, from git history (empty without git)
function pastAddresses() {
  const out = {};
  let log = "";
  try { log = execSync("git log --format= -p --no-renames -- src/posts", { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }); } catch { return out; }
  let file = "";
  for (const line of log.split("\n")) {
    const f = line.match(/^diff --git a\/src\/posts\/([^/]+)\.md /);
    if (f) { file = f[1]; continue; }
    const a = line.match(/^[-+]address:\s*["']?([a-z0-9-]+)["']?\s*$/);
    if (a && file) (out[file] ||= new Set()).add(a[1]);
  }
  for (const k in out) out[k] = [...out[k]];
  return out;
}
