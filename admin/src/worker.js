// Cloudflare Worker for admin.hefzonashr.ir: files in public/ are served as they are
// (wrangler.jsonc), and the sign-in addresses (GitHub, and username/password in accounts.js), the site's message form and the
// Telegram bot (bot.js) land here. Any other address is a page of the site with the in-place editor
// added (panel.js); the old Sveltia panel is at /cms/.
import { onRequestGet as auth } from "./auth.js";
import { onRequestGet as callback } from "./callback.js";
import { onRequest as contact } from "./contact.js";
import { onRequest as bot, setup } from "./bot.js";
import { login, githubApi } from "./accounts.js";
import { page, api } from "./panel.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/auth") return auth({ request, env });
    if (request.method === "GET" && pathname === "/callback") return callback({ request, env });
    if (pathname === "/contact") return contact({ request, env });
    if (pathname === "/login") return login({ request, env });
    if (pathname.startsWith("/gh/api/")) return githubApi({ request, env });
    if (pathname === "/telegram") return bot({ request, env });
    if (request.method === "GET" && pathname === "/telegram/setup") return setup({ request, env });
    if (pathname === "/panel/api/post") return api({ request, env });
    const file = await env.ASSETS.fetch(request);
    if (file.status !== 404 || !["GET", "HEAD"].includes(request.method)) return file;
    return page({ request, env });
  }
};
