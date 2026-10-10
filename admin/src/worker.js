// Cloudflare Worker for admin.hefzonashr.ir: files in public/ are served as they are
// (wrangler.jsonc), and the two sign-in addresses that have no file land here.
import { onRequestGet as auth } from "./auth.js";
import { onRequestGet as callback } from "./callback.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/auth") return auth({ request, env });
    if (request.method === "GET" && pathname === "/callback") return callback({ request, env });
    return env.ASSETS.fetch(request);
  }
};
