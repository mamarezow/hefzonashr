// the header button (section) a post belongs to, by its tags; a post with none goes under «چیزهای دیگر»
const section = data => (data.site.pills.find(p => p.tags.some(t => (data.tags || []).includes(t))) || { url: "/otherthings/" }).url;

export default {
  layout: "post.njk",
  // under the post's section (/essay/<name>/, /poeticwords/<name>/ …); the old /posts/<name>/ forwards here
  permalink: data => `${section(data)}${data.page.fileSlug}/`,
  eleventyComputed: {
    // light up the header button of the post's section, if it has one
    pill: section
  }
};
