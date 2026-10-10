export default {
  title: "حفظ و نشر آثار",
  url: "https://hefzonashr.ir",
  domain: "hefzonashr.ir",
  author: "محمدرضا",
  description: "شعر، ترانه، جستار و یادداشت‌های محمدرضا",
  memorial: "این سایت با فونت ساحل نوشته شده؛ به یاد صابر راستی‌کردار.",
  // the five buttons under the header
  // `tags`: posts with any of these tags light up the button
  // links under the text on /me, shown as icons
  social: [
    { name: "تلگرام", icon: "telegram", url: "https://t.me/hefzonashr" },
    { name: "اینستاگرام", icon: "instagram", url: "https://instagram.com/mamarezow" },
    { name: "لینکدین", icon: "linkedin", url: "https://www.linkedin.com/in/mohammadreza-lotfalizade-3341a6167/" }
  ],
  pills: [
    { label: "جستار", url: "/essay/", tags: ["essay"] },
    { label: "یادداشت", url: "/note/", tags: ["note"] },
    { label: "شاعرانه", url: "/poeticwords/", tags: ["poem", "song"] },
    { label: "چیزهای دیگر", url: "/otherthings/", tags: ["otherthings"] },
    { label: "محمدرضا", url: "/me/", tags: [] }
  ],
  // post tags: key used in front matter -> label shown on the site; each has a page at /<key>/
  tags: {
    essay: "جستار",
    note: "یادداشت",
    poem: "شعر",
    song: "ترانه",
    critique: "نقد",
    intro: "معرفی",
    otherthings: "دیگر"
  },
  // heading on a tag's page when it differs from the tag label
  tagTitles: { otherthings: "چیزهای دیگر" }
};
