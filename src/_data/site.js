export default {
  title: "حفظ و نشر آثار",
  url: "https://hefzonashr.ir",
  domain: "hefzonashr.ir",
  author: "محمدرضا",
  description: "شعر، ترانه، جستار و یادداشت‌های محمدرضا",
  memorial: "این سایت با فونت ساحل نوشته شده؛ به یاد صابر راستی‌کردار.",
  // the five buttons under the header
  pills: [
    { label: "جستار", url: "/jostar/" },
    { label: "یادداشت", url: "/yaddasht/" },
    { label: "ترانه", url: "/taraneh/" },
    { label: "چیزهای دیگر", url: "/digar/" },
    { label: "محمدرضا", url: "/about/" }
  ],
  // post tags: key used in front matter -> label shown on the site; each has a page at /<key>/
  tags: {
    jostar: "جستار",
    yaddasht: "یادداشت",
    sher: "شعر",
    taraneh: "ترانه",
    naqd: "نقد",
    moarefi: "معرفی",
    digar: "دیگر"
  },
  // heading on a tag's page when it differs from the tag label
  tagTitles: { digar: "چیزهای دیگر" }
};
