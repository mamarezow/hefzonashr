// Panel accounts: signing in to admin.hefzonashr.ir with a username and password instead of GitHub.
// - The Telegram bot (bot.js) makes the account: anyone who starts the bot is asked for a username
//   (their Telegram username is offered) and a password (or the bot makes one, to be changed at the
//   first sign-in). Accounts of people other than TELEGRAM_CHAT_ID wait for Mamareza's «قبول».
// - /login checks the password and hands Sveltia CMS a session token ("hz_…") in place of a GitHub token.
// - /gh/api/… is the CMS's GitHub API (config.yml api_root): a session token is swapped for
//   GITHUB_TOKEN on its way to GitHub; a real GitHub token (Mamareza's GitHub sign-in) passes as it is.
// Everything lives in the BOT KV namespace: user:<name>, chat-user:<chat id>, session:<token>, acct:<chat id>.
import { tg } from "./bot.js";

const REPO = "mamarezow/hefzonashr";
const PANEL = "https://admin.hefzonashr.ir";
const NAME = /^[a-z0-9_]{3,32}$/;
export const ACCOUNT = "حساب پنل";
const MAKE = "رمز بساز", RESET = "رمز تازه", CANCEL = "لغو";
const SESSION_DAYS = 30, ITERATIONS = 100000;

// ---- passwords ----

const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
const random = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function hash(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: ITERATIONS }, key, 256));
}
async function setPassword(user, password, mustChange) {
  user.salt = random(16);
  user.hash = await hash(password, user.salt);
  user.mustChange = mustChange;
}
// easy to read and type: no 0/o, 1/l/i
function makePassword() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return [...crypto.getRandomValues(new Uint8Array(10))].map(b => abc[b % abc.length]).join("");
}
const getUser = async (env, name) => JSON.parse(await env.BOT.get("user:" + name) || "null");
const putUser = (env, user) => env.BOT.put("user:" + user.name, JSON.stringify(user));

// ---- the Telegram side ----

const keys = rows => ({ keyboard: rows.map(r => r.map(text => ({ text }))), resize_keyboard: true, is_persistent: true });

// Returns true when the message was about the account. `owner` is Mamareza's chat.
export async function accountMessage(env, m, owner, menu) {
  const chat = m.chat.id, text = (m.text || "").trim(), key = "acct:" + chat;
  const say = (t, markup) => tg(env, "sendMessage", { chat_id: chat, text: t, reply_markup: markup, link_preview_options: { is_disabled: true } });
  const done = owner ? menu : { remove_keyboard: true };
  const state = JSON.parse(await env.BOT.get(key) || "null");
  const mine = await env.BOT.get("chat-user:" + chat);

  if (text === CANCEL && state) { await env.BOT.delete(key); await say("باشد.", done); return true; }
  if (text === RESET && mine) {
    const user = await getUser(env, mine), password = makePassword();
    await setPassword(user, password, true); await putUser(env, user);
    await say(`رمز تازه: ${password}\nدر اولین ورود باید عوضش کنی.\n${PANEL}/login`, done);
    return true;
  }
  if (text === ACCOUNT || (!owner && (text === "/start" || !state))) {
    await env.BOT.delete(key);
    if (mine) {
      const user = await getUser(env, mine);
      await say(`حساب پنل تو:\nنام کاربری: ${user.name}\n${user.approved ? "ورود: " + PANEL + "/login" : "هنوز تأیید نشده."}\nاگر رمز را یادت رفته «${RESET}» را بزن.`,
        owner ? keys([[RESET], [CANCEL]]) : keys([[RESET]]));
      if (owner) await env.BOT.put(key, JSON.stringify({ step: "shown" }), { expirationTtl: 3600 });
      return true;
    }
    await env.BOT.put(key, JSON.stringify({ step: "name" }), { expirationTtl: 86400 });
    const suggest = (m.from?.username || "").toLowerCase();
    const offer = NAME.test(suggest) && !(await getUser(env, suggest)) ? [[suggest]] : [];
    await say("برای ورود به پنل حفظ و نشر یک نام کاربری لازم داری. چه نامی می‌خواهی؟\n(حروف کوچک انگلیسی، عدد و _ ، دست‌کم ۳ تا)", keys([...offer, [CANCEL]]));
    return true;
  }
  if (!state) return false;
  if (state.step === "shown") { await env.BOT.delete(key); return false; }

  if (state.step === "name") {
    const name = text.toLowerCase().replace(/^@/, "");
    if (!NAME.test(name)) { await say("فقط حروف کوچک انگلیسی، عدد و _ ، از ۳ تا ۳۲ تا. یکی دیگر بفرست."); return true; }
    if (await getUser(env, name)) { await say("این نام را کس دیگری دارد؛ یکی دیگر بفرست."); return true; }
    await env.BOT.put(key, JSON.stringify({ step: "password", name }), { expirationTtl: 86400 });
    await say(`نام کاربری: ${name}\nرمزت چه باشد؟ خودت بفرست (دست‌کم ۸ نویسه)، یا «${MAKE}» را بزن تا یکی بسازم که در اولین ورود عوضش کنی.`, keys([[MAKE], [CANCEL]]));
    return true;
  }
  if (state.step === "password") {
    let password = text, made = text === MAKE;
    if (made) password = makePassword();
    else {
      await tg(env, "deleteMessage", { chat_id: chat, message_id: m.message_id });   // don't leave the password in the chat
      if (password.length < 8) { await say("رمز دست‌کم ۸ نویسه باشد. دوباره بفرست."); return true; }
    }
    if (await getUser(env, state.name)) { await env.BOT.put(key, JSON.stringify({ step: "name" }), { expirationTtl: 86400 }); await say("این نام همین حالا گرفته شد؛ نام دیگری بفرست."); return true; }
    const user = { name: state.name, chat, telegram: m.from?.username || "", approved: owner, created: new Date().toISOString() };
    await setPassword(user, password, made);
    await putUser(env, user);
    await env.BOT.put("chat-user:" + chat, user.name);
    await env.BOT.delete(key);
    await say([
      "حساب ساخته شد.",
      "نام کاربری: " + user.name,
      made ? "رمز اولیه: " + password + "\nدر اولین ورود باید عوضش کنی." : "رمز: همانی که فرستادی (پیامش را پاک کردم).",
      owner ? "ورود: " + PANEL + "/login" : "وقتی محمدرضا تأییدش کند خبرت می‌کنم."
    ].join("\n"), done);
    if (!owner) await tg(env, "sendMessage", {
      chat_id: env.TELEGRAM_CHAT_ID,
      text: `درخواست حساب پنل:\nنام کاربری: ${user.name}${user.telegram ? "\nتلگرام: @" + user.telegram : ""}\nبا قبول، می‌تواند نوشته‌های سایت را عوض کند.`,
      reply_markup: { inline_keyboard: [[{ text: "قبول", callback_data: "acct-ok:" + user.name }, { text: "رد", callback_data: "acct-no:" + user.name }]] }
    });
    return true;
  }
  return false;
}

// Mamareza's «قبول» / «رد» under a request
export async function accountPress(env, q) {
  const [what, name] = q.data.split(":");
  const at = { chat_id: q.message.chat.id, message_id: q.message.message_id };
  const user = await getUser(env, name);
  await tg(env, "answerCallbackQuery", { callback_query_id: q.id });
  if (!user) return tg(env, "editMessageText", { ...at, text: `حساب ${name} دیگر نیست.` });
  if (what === "acct-ok") {
    user.approved = true; await putUser(env, user);
    await tg(env, "sendMessage", { chat_id: user.chat, text: `حسابت تأیید شد. ورود:\n${PANEL}/login` });
    return tg(env, "editMessageText", { ...at, text: `حساب ${name} تأیید شد.` });
  }
  await env.BOT.delete("user:" + name);
  await env.BOT.delete("chat-user:" + user.chat);
  await tg(env, "sendMessage", { chat_id: user.chat, text: "درخواست حساب پنل پذیرفته نشد." });
  return tg(env, "editMessageText", { ...at, text: `حساب ${name} رد و پاک شد.` });
}

// ---- /login ----

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function login({ request, env }) {
  if (request.method === "GET") return new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" } });
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const ip = request.headers.get("CF-Connecting-IP") || "?", tries = +(await env.BOT.get("rl:login:" + ip)) || 0;
  if (tries >= 10) return json({ error: "تلاش زیاد شد؛ ده دقیقهٔ دیگر دوباره امتحان کن." }, 429);
  const data = await request.json().catch(() => ({}));
  const name = String(data.username || "").trim().toLowerCase().replace(/^@/, ""), password = String(data.password || "");
  const user = NAME.test(name) ? await getUser(env, name) : null;
  if (!user || (await hash(password, user.salt)) !== user.hash) {
    await env.BOT.put("rl:login:" + ip, String(tries + 1), { expirationTtl: 600 });
    return json({ error: "نام کاربری یا رمز درست نیست." }, 401);
  }
  if (!user.approved) return json({ error: "حسابت هنوز تأیید نشده." }, 403);
  if (user.mustChange || data.newPassword) {
    const next = String(data.newPassword || "");
    if (!next) return json({ change: true });
    if (next.length < 8) return json({ change: true, error: "رمز تازه دست‌کم ۸ نویسه باشد." }, 400);
    if (next === password) return json({ change: true, error: "رمز تازه باید با رمز اولیه فرق کند." }, 400);
    await setPassword(user, next, false); await putUser(env, user);
  }
  const token = "hz_" + random(24);
  await env.BOT.put("session:" + token, user.name, { expirationTtl: SESSION_DAYS * 86400 });
  return json({ token });
}

// ---- the CMS's GitHub API ----

export async function githubApi({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/gh\/api\/v3/, "").replace(/^\/gh\/api\/graphql$/, "/graphql");
  if (path === url.pathname) return new Response("Not Found", { status: 404 });
  let auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^(token|bearer)\s+/i, "");
  if (token.startsWith("hz_")) {
    const name = await env.BOT.get("session:" + token), user = name && await getUser(env, name);
    if (!user?.approved) return json({ message: "Bad credentials" }, 401);
    if (path === "/user") return json({ id: 1e9 + user.chat % 1e9, login: user.name, name: user.name, email: null, avatar_url: "", html_url: "https://hefzonashr.ir/", bot: false });
    if (!(path === "/graphql" || path === "/rate_limit" || path.startsWith(`/repos/${REPO}/`) || path === `/repos/${REPO}`))
      return json({ message: "Not allowed" }, 403);
    auth = "Bearer " + env.GITHUB_TOKEN;
  }
  const headers = new Headers();
  for (const h of ["Accept", "Content-Type", "If-None-Match", "X-GitHub-Api-Version"]) if (request.headers.get(h)) headers.set(h, request.headers.get(h));
  if (auth) headers.set("Authorization", auth);
  headers.set("User-Agent", "hefzonashr-admin");
  const r = await fetch("https://api.github.com" + path + url.search, {
    method: request.method, headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer()
  });
  const out = new Headers(r.headers);
  out.delete("Content-Encoding"); out.delete("Content-Length");
  return new Response(r.body, { status: r.status, headers: out });
}

const PAGE = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>ورود به پنل حفظ و نشر</title>
<style>
@font-face { font-family: "Sahel"; src: url("/fonts/Sahel-FD.woff2") format("woff2"); font-weight: 400; font-display: swap; }
:root { --bg: #e9e7e1; --fg: #222; --line: #c9c5bb; --field: #f6f5f1; --accent: #f4c430; }
@media (prefers-color-scheme: dark) { :root { --bg: #1d1c1a; --fg: #e9e7e1; --line: #44413c; --field: #262522; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg); font: 16px/1.8 "Sahel", system-ui, sans-serif; padding: 16px; }
form { width: 100%; max-width: 340px; display: grid; gap: 12px; }
h1 { font-size: 1.15rem; font-weight: 400; margin: 0 0 8px; }
label { display: grid; gap: 4px; font-size: .9rem; }
input { font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--field); color: inherit; direction: ltr; text-align: left; }
button { font: inherit; padding: 10px; border: 0; border-radius: 10px; background: var(--accent); color: #222; cursor: pointer; }
.error { color: #c0392b; min-height: 1.8em; margin: 0; font-size: .9rem; }
.hint { font-size: .85rem; opacity: .75; margin: 0; }
[hidden] { display: none; }
</style>
</head>
<body>
<form id="f">
  <h1>ورود به پنل حفظ و نشر</h1>
  <label>نام کاربری <input name="username" autocomplete="username" autocapitalize="off" required></label>
  <label>رمز <input name="password" type="password" autocomplete="current-password" required></label>
  <div id="change" hidden>
    <p class="hint">بار اول است؛ یک رمز تازه برای خودت بگذار (دست‌کم ۸ نویسه).</p>
    <label>رمز تازه <input name="newPassword" type="password" autocomplete="new-password" minlength="8"></label>
    <label>تکرار رمز تازه <input name="again" type="password" autocomplete="new-password"></label>
  </div>
  <p class="error" id="err"></p>
  <button>ورود</button>
  <p class="hint">حساب نداری؟ ربات حفظ و نشر را در تلگرام استارت کن.</p>
</form>
<script>
const f = document.getElementById("f"), err = document.getElementById("err"), change = document.getElementById("change");
f.addEventListener("submit", async e => {
  e.preventDefault(); err.textContent = "";
  const d = Object.fromEntries(new FormData(f));
  if (change.hidden) delete d.newPassword;
  else if (d.newPassword !== d.again) { err.textContent = "دو رمز تازه یکی نیستند."; return; }
  delete d.again;
  const r = await fetch("/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : { error: "اتصال برقرار نشد." };
  if (j.change) { change.hidden = false; f.newPassword.required = true; f.newPassword.focus(); }
  if (j.error) err.textContent = j.error;
  if (j.token) { localStorage.setItem("sveltia-cms.user", JSON.stringify({ backendName: "github", token: j.token })); location.href = "/"; }
});
</script>
</body>
</html>`;
