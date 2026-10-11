// the header button (section) a post belongs to, by its tags; a post with none goes under «چیزهای دیگر»
const section = data => (data.site.pills.find(p => p.tags.some(t => (data.tags || []).includes(t))) || { url: "/otherthings/" }).url;

export default {
  layout: "post.njk",
  // under the post's section (/essay/<name>/, /poeticwords/<name>/ …); <name> is the front matter's
  // `address` if it has one, else the file name. Every older address forwards here (the "moved" collection).
  permalink: data => `${section(data)}${data.address || data.page.fileSlug}/`,
  eleventyComputed: {
    // light up the header button of the post's section, if it has one
    pill: section
  }
};
