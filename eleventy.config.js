import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

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
    const plain = line.replace(/[*_`#>\[\]]/g, "");
    if (plain.length <= 160) return plain;
    return plain.slice(0, plain.lastIndexOf(" ", 160)) + "…";
  });

  // a poem as stanzas (<p>) of lines (<br>): same look as the plain text, and readers that
  // ignore CSS, like Telegram Instant View, keep every line break
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  eleventyConfig.addFilter("poemHtml", raw => raw.replace(/\r/g, "").trim().split(/\n[ \t]*\n/)
    .map(st => `<p>${st.split("\n").map(esc).join("<br>\n")}</p>`).join("\n"));

  // newest-first collection: «previous» is the older post, «next» the newer one
  eleventyConfig.addFilter("older", (posts, url) => { const i = posts.findIndex(p => p.url === url); return i >= 0 ? posts[i + 1] : undefined; });
  eleventyConfig.addFilter("newer", (posts, url) => { const i = posts.findIndex(p => p.url === url); return i > 0 ? posts[i - 1] : undefined; });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk"
  };
}
