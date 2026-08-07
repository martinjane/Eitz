---
name: Eitashot DB migrations
description: Database schema must be pushed manually; tables do not auto-create on first boot.
---

## Rule
After any schema change (or on first setup), run:
```
cd lib/db
pnpm drizzle-kit push
```

**Why:** The project uses Drizzle ORM with `drizzle-kit push` (not migrations applied at runtime). On the first boot the DB connection works fine but queries fail with "Failed query" because the tables don't exist yet.

**How to apply:** If the API returns 500 on any DB-backed route immediately after a fresh setup or schema change, run `pnpm drizzle-kit push` from `lib/db/`. Migration files land in `lib/db/drizzle/`.
