# Eitashot

A production-ready Eitaa mini-app (screenshot/image sharing) built as a pnpm monorepo.

## Architecture

- **`artifacts/eitashot`** — React + Vite frontend (port 8080, preview path `/`)
- **`artifacts/api-server`** — Express + Node.js API server (port 8081, preview path `/api`)
- **`lib/db`** — Drizzle ORM schema + PostgreSQL client (shared library)
- **`lib/api-zod`** — Shared Zod API types
- **`deploy/`** — Docker + Caddy production deployment config

## How to run on Replit

Workflows are pre-configured. Both start automatically:
- **API Server** workflow: `pnpm --filter @workspace/api-server run dev`
- **Eitashot web** workflow: `pnpm --filter @workspace/eitashot run dev`

Database schema is managed with Drizzle Kit:
```bash
pnpm --filter @workspace/db run push
```

## Required environment variables

| Variable | Required in | Notes |
|---|---|---|
| `DATABASE_URL` | Always | Auto-provided by Replit |
| `SESSION_SECRET` | Production | JWT signing key |
| `EITAA_BOT_TOKEN` | Production | Login verification; dev mode skips this |
| `ADMIN_USERNAME` | Always | Sets which username gets admin access |
| `IDPAY_API_KEY` | Production | Payment processing |
| `APP_BASE_URL` | Production | For IDPay callbacks |
| `FRONTEND_URL` | Production | For payment redirects |

In development (`NODE_ENV=development`), Eitaa login is simulated via `GET /api/auth/dev-session`.

## Production deployment

See `deploy/DEPLOYMENT.md` for full Docker + Caddy VPS deployment guide.

## User preferences

- Keep agent actions minimal and efficient — avoid unnecessary screenshots or exploratory steps.
