export default {
  title: "حفظ و نشر آثار",
  url: "https://hefzonashr.ir",
  domain: "hefzonashr.ir",
  author: "محمدرضا",
  description: "شعر، ترانه، جستار و یادداشت‌های محمدرضا",
  memorial: "این سایت با فونت ساحل نوشته شده؛ به یاد صابر راستی‌کردار.",
  // the five buttons under the header
  pills: [
    { label: "جستار", url: "/essay/" },
    { label: "یادداشت", url: "/note/" },
    { label: "ترانه", url: "/poeticwords/" },
    { label: "چیزهای دیگر", url: "/otherthings/" },
    { label: "محمدرضا", url: "/me/" }
  ],
  // post tags: key used in front matter -> label shown on the site; each has a page at /<key>/
  tags: {
    essay: "جستار",
    note: "یادداشت",
    poem: "شعر",
    poeticwords: "ترانه",
    critique: "نقد",
    intro: "معرفی",
    otherthings: "دیگر"
  },
  // heading on a tag's page when it differs from the tag label
  tagTitles: { otherthings: "چیزهای دیگر" }
};
