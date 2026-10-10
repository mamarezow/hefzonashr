// Sign in with GitHub, step 1: send the browser to GitHub's consent page.
// Sveltia CMS opens this in a popup as /auth?provider=github; src/worker.js routes it here.
// Needs GITHUB_CLIENT_ID (and GITHUB_CLIENT_SECRET for /callback) in the Worker's settings.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get("provider") !== "github") return new Response("Unsupported provider", { status: 400 });
  if (!env.GITHUB_CLIENT_ID) return new Response("GITHUB_CLIENT_ID is not set", { status: 500 });

  const state = crypto.randomUUID().replaceAll("-", "");
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/callback`,
    // the repository is public, so public_repo is enough to write posts
    scope: "public_repo",
    state
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params}`,
      "Set-Cookie": `oauth-state=${state}; Path=/callback; Max-Age=600; HttpOnly; Secure; SameSite=Lax`
    }
  });
}
