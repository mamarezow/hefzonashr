// The message form on hefzonashr.ir/me/ and the comment box under each post post here with a
// message and, if they like, the sender's email or Telegram username; it goes to Mamareza's
// Telegram through a bot. A comment also names its post (`post`: the short link, `page`: its address). Set in the Cloudflare dashboard (Worker > Settings > Variables and Secrets):
//   TELEGRAM_BOT_TOKEN  the bot's token from @BotFather (as a secret)
//   TELEGRAM_CHAT_ID    the numeric id of the account that should receive the messages
// Against spam, besides the hidden field only bots fill in: the page says how long the form was
// being filled in (`ms`; a script that posts straight away gets a quiet "ok" and nothing is sent),
// one address may send 5 messages in 10 minutes, the same text is sent once a day, and the whole
// site at most 100 a day (counted in the BOT KV namespace, bot.js).
// The page sends JSON with fetch; without JavaScript the plain form post works too and
// comes back to the page with ?sent=1 or ?sent=0.
const SITE = "https://hefzonashr.ir";
const cors = { "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" };
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const POST = /^hefzonashr\.ir\/(p\/\d+|[a-z]+\/[a-z0-9-]+\/?)$/, PAGE = /^\/[a-z]+\/[a-z0-9-]+\/$/;
const TELEGRAM = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;   // a Telegram username, with or without @

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } });
  const json = (request.headers.get("content-type") || "").includes("application/json");
  let back = ok => `${SITE}/me/?sent=${ok ? 1 : 0}#contact`;
  const answer = (ok, status) => json
    ? new Response(JSON.stringify({ ok }), { status, headers: { ...cors, "Content-Type": "application/json" } })
    : Response.redirect(back(ok), 303);

  let data;
  try { data = json ? await request.json() : Object.fromEntries(await request.formData()); } catch { return answer(false, 400); }
  const message = String(data.message || "").trim(), from = String(data.email || "").trim();
  const post = POST.test(data.post || "") ? data.post : "", page = PAGE.test(data.page || "") ? data.page : "";
  if (page) back = ok => `${SITE}${page}?sent=${ok ? 1 : 0}#comment`;
  if (data.website) return answer(true, 200);                       // the hidden field only bots fill in
  if (json && !(Number(data.ms) >= 2000)) return answer(true, 200);  // filled in faster than a person can
  if (!message || message.length > 4000 || (from && !EMAIL.test(from) && !TELEGRAM.test(from))) return answer(false, 400);
  const sender = !from ? "anonymous" : EMAIL.test(from) ? from : "@" + from.replace(/^@/, "");
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return answer(false, 503);
  let seenKey = "";
  if (env.BOT) {
    const ip = request.headers.get("CF-Connecting-IP") || "?", day = new Date().toISOString().slice(0, 10);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message)))].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
    const [mine, all, seen] = await Promise.all([`rl:ip:${ip}`, `rl:day:${day}`, `rl:text:${hash}`].map(k => env.BOT.get(k)));
    if (seen) return answer(true, 200);                                // the same text again: already sent
    if (+mine >= 5 || +all >= 100) return answer(false, 429);
    await Promise.all([
      env.BOT.put(`rl:ip:${ip}`, String(+mine + 1), { expirationTtl: 600 }),
      env.BOT.put(`rl:day:${day}`, String(+all + 1), { expirationTtl: 172800 })
    ]);
    seenKey = `rl:text:${hash}`;
  }

  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `${post ? "comment for " + post : "message from hefzonashr.ir"}\n${sender}\n\n${message}`, link_preview_options: { is_disabled: true } })
  });
  if (r.ok && seenKey) await env.BOT.put(seenKey, "1", { expirationTtl: 86400 });
  return answer(r.ok, r.ok ? 200 : 502);
}
