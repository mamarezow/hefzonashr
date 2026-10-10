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
  const literal = JSON.stringify(message).replaceAll("<", "\\u003c");
  const html = `<!doctype html><meta charset="utf-8"><title>…</title><script>
(() => {
  const msg = ${literal};
  window.addEventListener("message", e => {
    if (e.origin === location.origin && e.data === "authorizing:github") window.opener.postMessage(msg, location.origin);
  }, { once: true });
  if (window.opener) window.opener.postMessage("authorizing:github", location.origin);
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
