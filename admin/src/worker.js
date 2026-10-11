// Cloudflare Worker for admin.hefzonashr.ir: files in public/ are served as they are
// (wrangler.jsonc), and the sign-in addresses (GitHub, and username/password in accounts.js), the site's message form and the
// Telegram bot (bot.js) land here.
import { onRequestGet as auth } from "./auth.js";
import { onRequestGet as callback } from "./callback.js";
import { onRequest as contact } from "./contact.js";
import { onRequest as bot, setup } from "./bot.js";
import { login, githubApi } from "./accounts.js";

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
    return env.ASSETS.fetch(request);
  }
};
