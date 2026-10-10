// Sign in with GitHub, step 2: trade GitHub's code for a token and hand it to the CMS window
// that opened the popup, using the message handshake Sveltia/Decap CMS expect.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)oauth-state=([^;]+)/)?.[1];

  let result;
  if (!code || !state || state !== saved) {
    result = { error: "Sign-in expired or was tampered with. Please try again." };
  } else {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "hefzonashr-admin" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code })
    });
    const data = await res.json().catch(() => ({}));
    result = data.access_token ? { token: data.access_token } : { error: data.error_description || "GitHub did not return a token." };
  }

  const status = result.token ? "success" : "error";
  const message = `authorization:github:${status}:${JSON.stringify({ provider: "github", ...result })}`;
  // JSON-encode for the script, and keep "<" out of it so nothing can close the tag
  const js = value => JSON.stringify(value).replaceAll("<", "\\u003c");
  const html = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ورود</title><body style="font: 16px/1.8 system-ui, sans-serif; padding: 24px"><p id="note"></p><script>
(() => {
  const msg = ${js(message)}, token = ${js(result.token || "")}, error = ${js(result.error || "")};
  // also keep the sign-in where the panel looks for it on load, so a reload of the panel works
  // even when the handshake below can't reach it (the link to the opening window can be lost
  // while the popup is on github.com)
  if (token) try { localStorage.setItem("sveltia-cms.user", JSON.stringify({ backendName: "github", token })); } catch (e) {}
  window.addEventListener("message", e => {
    if (e.origin === location.origin && e.data === "authorizing:github") window.opener.postMessage(msg, location.origin);
  }, { once: true });
  if (window.opener) window.opener.postMessage("authorizing:github", location.origin);
  // the panel closes this window when the handshake works; if it is still open, say what to do
  setTimeout(() => {
    document.getElementById("note").textContent = token
      ? "وارد شدی. این پنجره را ببند و صفحهٔ پنل را یک بار تازه کن (Reload)."
      : "ورود انجام نشد: " + error;
  }, window.opener ? 2500 : 0);
})();
</script>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": "oauth-state=; Path=/callback; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
    }
  });
}
