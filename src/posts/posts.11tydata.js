export default {
  layout: "post.njk",
  permalink: data => `/posts/${data.page.fileSlug}/`,
  eleventyComputed: {
    // light up the header button of the post's section, if it has one
    pill: data => {
      const pill = data.site.pills.find(p => p.tags.some(t => (data.tags || []).includes(t)));
      return pill ? pill.url : "";
    }
  }
};
