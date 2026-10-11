// The message form on hefzonashr.ir/me/ posts here with a message and, if they like, the sender's
// email or Telegram username; it goes to Mamareza's Telegram through a bot. Set in the Cloudflare dashboard (Worker > Settings > Variables and Secrets):
//   TELEGRAM_BOT_TOKEN  the bot's token from @BotFather (as a secret)
//   TELEGRAM_CHAT_ID    the numeric id of the account that should receive the messages
// The page sends JSON with fetch; without JavaScript the plain form post works too and
// comes back to the page with ?sent=1 or ?sent=0.
const SITE = "https://hefzonashr.ir";
const cors = { "Access-Control-Allow-Origin": SITE, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" };
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const TELEGRAM = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;   // a Telegram username, with or without @

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST, OPTIONS" } });
  const json = (request.headers.get("content-type") || "").includes("application/json");
  const answer = (ok, status) => json
    ? new Response(JSON.stringify({ ok }), { status, headers: { ...cors, "Content-Type": "application/json" } })
    : Response.redirect(`${SITE}/me/?sent=${ok ? 1 : 0}#contact`, 303);

  let data;
  try { data = json ? await request.json() : Object.fromEntries(await request.formData()); } catch { return answer(false, 400); }
  const message = String(data.message || "").trim(), from = String(data.email || "").trim();
  if (data.website) return answer(true, 200);                       // the hidden field only bots fill in
  if (!message || message.length > 4000 || (from && !EMAIL.test(from) && !TELEGRAM.test(from))) return answer(false, 400);
  const sender = !from ? "anonymous" : EMAIL.test(from) ? from : "@" + from.replace(/^@/, "");
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return answer(false, 503);

  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `message from hefzonashr.ir\n${sender}\n\n${message}`, link_preview_options: { is_disabled: true } })
  });
  return answer(r.ok, r.ok ? 200 : 502);
}
