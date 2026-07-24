# fslides gateway (`api.fslides.dev`)

The single server-side component of fslides. Decks stay static; this Cloudflare
Worker brokers GitHub identity so published decks get inline commenting —
including on private repos — with no PATs and no deck-side infrastructure.

## How it works

1. Player shows **Sign in with GitHub** → opens `api.fslides.dev/auth/login?origin=<deck-origin>` in a popup
2. Worker redirects to the **fslides GitHub App** authorize page
3. Callback exchanges the code and posts `{ type: 'fslides-auth', token, expiresAt }`
   to the deck window (origin-pinned), then the popup closes
4. The player calls `api.github.com` directly with the user-to-server token —
   the worker never stores anything

Security posture: the GitHub App has **issues read/write only**, installed
per-repo; tokens are user-to-server (expire ~8h); `state` is HMAC-signed with
a 10-minute TTL; the callback posts only to the origin that initiated login;
allowed origins are suffix-filtered (`.github.io`, `localhost` by default).

## One-time setup

1. **Create the GitHub App** (org settings → Developer settings → GitHub Apps → New):
   - Name: `fslides`
   - Homepage: `https://fslides.dev`
   - Callback URL: `https://api.fslides.dev/auth/callback`
   - ✅ Request user authorization (OAuth) during installation
   - ✅ Expire user authorization tokens
   - Webhook: off (for now)
   - Permissions: **Issues: Read & write** — nothing else
   - Where can it be installed: Any account
2. **Cloudflare**: add the `fslides.dev` zone (point the domain's nameservers at Cloudflare)
3. **Deploy**:
   ```bash
   cd packages/gateway
   npx wrangler login
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler deploy
   ```
4. Smoke test: `curl https://api.fslides.dev/healthz` → `ok`

## Local development

```bash
npx wrangler dev --var ALLOWED_ORIGIN_SUFFIXES=".github.io,localhost,127.0.0.1" \
  --var GITHUB_CLIENT_ID="…" --var GITHUB_CLIENT_SECRET="…"
# gateway on http://localhost:8787 — point a deck's config at it:
# gateway: 'http://localhost:8787'
```

## Deck wiring

`fuckslides.config.js`:

```js
module.exports = {
  // …
  repo: 'owner/name',                    // comments target
  gateway: 'https://api.fslides.dev',    // sign-in broker (scaffold default)
};
```

Commenters need the fslides GitHub App **installed on the deck repo**
(GitHub prompts for this during first sign-in) and read access to the repo.
