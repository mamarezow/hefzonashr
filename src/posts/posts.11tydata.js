export default {
  layout: "post.njk",
  permalink: data => `/posts/${data.page.fileSlug}/`,
  eleventyComputed: {
    // light up the header button of the post's section, if it has one
    pill: data => {
      const urls = data.site.pills.map(p => p.url);
      const k = (data.tags || []).find(k => urls.includes(`/${k}/`));
      return k ? `/${k}/` : "";
    }
  }
};
