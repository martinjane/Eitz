# Eitashot

A production-grade Eitaa mini-app for quick image editing and channel content preparation, built as a pnpm monorepo.

## Architecture

- **`artifacts/eitashot`** — React + Vite frontend (served on `/`)
- **`artifacts/api-server`** — Express + Node.js API server (served on `/api`)
- **`lib/db`** — Drizzle ORM schema + PostgreSQL client (shared library)
- **`lib/api-zod`** — Shared Zod API types
- **`deploy/`** — Docker + Caddy production deployment config

## Development

Start both services with:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/eitashot run dev
```

Database schema is managed with Drizzle Kit:

```bash
pnpm --filter @workspace/db run push
```

## Test Mode

The app uses a `TEST_MODE` environment variable to switch between normal (default) and test behavior:

| `TEST_MODE` | Behavior |
|---|---|
| `false` (or absent) | Normal mode: no dev session, Eitaa auth for login, guests see a login prompt |
| `true` | Test mode (explicit opt-in): dev session auto-login, Eitaa auth optional, bot messaging skipped |

When `TEST_MODE=true` (testing) the dev-session endpoint is enabled. For local testing, set `TEST_MODE=true` in your environment.

When `TEST_MODE=false`, the following environment variables are required:

- `EITAA_BOT_TOKEN` — Bot token for hash verification and sending messages
- `IDPAY_API_KEY` — Payment processing
- `APP_BASE_URL` — For IDPay callbacks
- `FRONTEND_URL` — For payment redirects

Shared variables:

- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — JWT signing key
- `ADMIN_USERNAME` — Username that gets admin access

## Production Deployment

See `deploy/DEPLOYMENT.md` for full Docker + Caddy VPS deployment guide.
