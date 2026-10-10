const TZ = "Asia/Tehran";
const faDate = new Intl.DateTimeFormat("fa-IR", { calendar: "persian", day: "numeric", month: "long", year: "numeric", timeZone: TZ });

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/fonts": "fonts", "src/css": "css", "src/js": "js", "src/CNAME": "CNAME", "src/.nojekyll": ".nojekyll" });

  // all posts, newest first
  eleventyConfig.addCollection("posts", api =>
    api.getFilteredByGlob("src/posts/*.md").sort((a, b) => b.date - a.date));

  // posts that came from the Telegram channel get a short link /p/<message id>/
  eleventyConfig.addCollection("shortlinked", api =>
    api.getFilteredByGlob("src/posts/*.md").filter(p => p.data.telegram));

  // «۲۱ اسفند ۱۴۰۴»
  eleventyConfig.addFilter("jdate", d => faDate.format(d));
  eleventyConfig.addFilter("iso", d => d.toISOString());

  // posts carrying a given tag key
  eleventyConfig.addFilter("withTag", (posts, key) => posts.filter(p => (p.data.tags || []).includes(key)));

  // one-line teaser for lists: front-matter `excerpt`, else the first non-empty line of the text
  eleventyConfig.addFilter("teaser", post => {
    if (post.data.excerpt) return post.data.excerpt;
    const line = (post.rawInput || "").split("\n").map(s => s.replace(/[‏‎]/g, "").trim()).find(Boolean) || "";
    const plain = line.replace(/[*_`#>\[\]]/g, "");
    if (plain.length <= 160) return plain;
    return plain.slice(0, plain.lastIndexOf(" ", 160)) + "…";
  });

  eleventyConfig.addFilter("byUrl", (posts, url) => posts.find(p => p.url === url));

  // newest-first collection: «previous» is the older post, «next» the newer one
  eleventyConfig.addFilter("older", (posts, url) => { const i = posts.findIndex(p => p.url === url); return i >= 0 ? posts[i + 1] : undefined; });
  eleventyConfig.addFilter("newer", (posts, url) => { const i = posts.findIndex(p => p.url === url); return i > 0 ? posts[i - 1] : undefined; });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk"
  };
}
